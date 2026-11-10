'use strict';
/* ============ Rede: multiplayer em tempo real, chat, ranking e save na nuvem ============
   Dois modos automáticos:
   1) "claude"  — hospedado como artifact: usa as capacidades room/db/user da plataforma.
   2) "ws"      — hospedado em servidor próprio (server.js incluso): WebSocket em /ws.
   Sem nenhum dos dois, o jogo roda offline com save local. */
const Net = {
  mode: 'offline', ready: false, lobby: null, zroom: null, zunsub: null, db: null, user: null, uid: null, online: 1, lastMi: {}, seq: Math.floor(Math.random() * 1e6), st: 0, lastState: '', zone: -1, ztoken: 0, ws: null, wsId: null, saving: false, ranking: false, rankCache: null, cloudSave: null, readyCbs: [],
  whenReady(cb) { if (this.ready) cb(); else this.readyCbs.push(cb); },
  _done() { if (this.ready) return; this.ready = true; this.readyCbs.forEach(f => f()); this.readyCbs = []; UI.netStatus(); },
  async init() {
    setTimeout(() => this._done(), 6000);
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        const [room, db, user] = await Promise.all([claude.use('room').catch(() => null), claude.use('db').catch(() => null), claude.use('user').catch(() => null)]);
        this.user = user; this.db = db;
        if (user && user.id) { try { this.uid = await user.id(); } catch (e) { } }
        if (user && user.canEdit) { try { this.isAdmin = !!(await user.canEdit()); } catch (e) { } }
        if (room) { this.lobby = room; this.mode = 'claude'; room.onPeers(ch => this._lobbyPeers(ch), () => { this.lobby = null; this.mode = 'offline'; UI.netStatus(); }); }
        else if (db) this.mode = 'cloud';
        if (db && this.uid) { try { const snap = await Promise.race([db.doc('data/users/' + this.uid + '/save').get(), new Promise(r => setTimeout(() => r(null), 4000))]); if (snap && snap.exists) { const d = snap.data(); if (d && d.s && validSave(JSON.parse(JSON.stringify(d.s)))) this.cloudSave = JSON.parse(JSON.stringify(d.s)); } } catch (e) { } }
      } else if (location.protocol === 'http:' || location.protocol === 'https:') await this._wsConnect();
    } catch (e) { }
    this._done();
  },
  /* ---- modo claude ---- */
  _clean(pr) {
    if (!pr || typeof pr !== 'object') return null; const n = typeof pr.n === 'string' ? pr.n.slice(0, 16) : null; if (!n) return null;
    return { n, c: CLASSES[pr.c] ? pr.c : 'warrior', l: Math.max(1, Math.min(MAX_LEVEL, pr.l | 0)), x: +pr.x || 0, y: +pr.y || 0, d: pr.d < 0 ? -1 : 1, w: Math.max(0, Math.min(10, pr.w | 0)), a: pr.a | 0, dead: !!pr.dead, sk: SKINS[pr.sk] ? pr.sk : null };
  },
  _lobbyPeers(ch) {
    this.online = Math.max(1, ch.peers.filter(p => p.kind === 'viewer').length); UI.netStatus();
    for (const p of ch.left) delete this.lastMi[p.peer];
    for (const p of ch.joined) this.lastMi[p.peer] = (p.presence && p.presence.mi) || 0;
    for (const p of ch.updated) {
      const pr = p.presence || {}, mi = pr.mi || 0;
      if (mi && mi !== this.lastMi[p.peer] && !p.sameTab && typeof pr.m === 'string' && typeof pr.n === 'string') this._recv(p.peer, pr.n.slice(0, 16), pr.m.slice(0, 140), pr.k | 0);
      this.lastMi[p.peer] = mi;
    }
  },
  _recv(peerId, name, msg, kind) { UI.chat(name, msg, kind); if (kind === 0) { const z = G.peers.get(peerId); if (z) { z.bubble = msg; z.bubbleT = G.time + 5; } } },
  _applyPeers(list) {
    const seen = new Set();
    for (const [id, pr] of list) {
      const c = this._clean(pr); if (!c) continue; seen.add(id); let p = G.peers.get(id);
      if (!p) { p = { rx: c.x, ry: c.y, seed: Math.random() * 10, atkT: 0, la: c.a }; G.peers.set(id, p); }
      if (c.a !== p.la) { p.la = c.a; p.atkT = 0.3; } Object.assign(p, c);
    }
    for (const id of [...G.peers.keys()]) if (!seen.has(id)) G.peers.delete(id);
  },
  async setZone(id) {
    this.zone = id; this.lastState = ''; this.lobbySync(); const token = ++this.ztoken;
    if (this.mode === 'claude' && this.lobby) {
      try {
        if (this.zunsub) { this.zunsub(); this.zunsub = null; } const old = this.zroom; this.zroom = null; if (old) await old.leave().catch(() => { });
        const r = await this.lobby.join('zona-' + id); if (token !== this.ztoken) { r.leave().catch(() => { }); return; }
        this.zroom = r; this.zunsub = r.onPeers(ch => { if (this.zroom === r) this._applyPeers(ch.peers.filter(p => !p.sameTab && p.kind === 'viewer').map(p => [p.peer, p.presence])); }, () => { if (this.zroom === r) this.zroom = null; });
      } catch (e) { }
    }
  },
  lobbySync() { if (!S) return; if (this.mode === 'claude' && this.lobby) this.lobby.presence({ n: S.name, c: S.cls, l: S.lvl, z: this.zone }).catch(() => { }); },
  tick(dt) {
    this.st += dt; if (this.st < 0.1) return; this.st = 0; if (!S) return;
    const s = { n: S.name, c: S.cls, l: S.lvl, x: Math.round(P.x), y: Math.round(P.y), d: P.dir, w: S.wings.t, a: P.atkN | 0, dead: P.dead ? 1 : 0, sk: S.skin || '' };
    const js = JSON.stringify(s); if (js === this.lastState) return; this.lastState = js;
    if (this.zroom) this.zroom.presence(s).catch(() => { });
    else if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'st', z: this.zone, s }));
  },
  say(text, kind) {
    text = String(text).replace(/[\u0000-\u001f​-‏‪-‮]/g, '').trim().slice(0, 140); if (!text || !S) return;
    if (!kind) { UI.chat(S.name, text, 0, true); P.bubble = text; P.bubbleT = G.time + 5; } else UI.chat(S.name, text, 1, true);
    if (this.mode === 'claude' && this.lobby) this.lobby.presence({ n: S.name, mi: ++this.seq, m: text, k: kind | 0 }).catch(() => { });
    else if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'chat', m: text, k: kind | 0 }));
  },
  announce(text) { this.say(text, 1); },
  async saveCloud(s) {
    if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify({ t: 'save', s })); return; }
    if (!this.db || !this.uid || this.saving || this.cloudDenied) return; this.saving = true;
    try { await this.db.doc('data/users/' + this.uid + '/save').set({ s: JSON.parse(JSON.stringify(s)), t: Date.now() }); } catch (e) { if (e && e.code === 'invalid_argument') this.cloudDenied = true; }
    this.saving = false;
  },
  async pushRank() {
    if (!S) return; this.lobbySync(); const row = { n: S.name, c: S.cls, l: S.lvl, xp: S.xp, p: P.st.power | 0, w: S.wings.t, t: Date.now() };
    if (this.ws && this.ws.readyState === 1) return; // o servidor próprio monta o ranking a partir dos saves
    if (!this.db || !this.uid || this.ranking || this.cloudDenied) return; this.ranking = true;
    try { await this.db.doc('ranking/' + this.uid).set(row); } catch (e) { }
    this.ranking = false;
  },
  async getRank() {
    let rows = [];
    try {
      if (this.ws && this.ws.readyState === 1) rows = await new Promise(res => { this._rankRes = res; this.ws.send(JSON.stringify({ t: 'rank' })); setTimeout(() => res([]), 3000); });
      else if (this.db) { const q = await Promise.race([this.db.collection('ranking').orderBy('l', 'desc').limit(60).get(), new Promise(r => setTimeout(() => r(null), 5000))]); if (q) rows = q.docs.map(d => Object.assign({ id: d.id }, d.data())); }
    } catch (e) { }
    rows = rows.filter(r => r && typeof r.n === 'string').map(r => ({ id: r.id, n: r.n.slice(0, 16), c: CLASSES[r.c] ? r.c : 'warrior', l: Math.max(1, Math.min(MAX_LEVEL, r.l | 0)), xp: +r.xp || 0, p: r.p | 0, w: r.w | 0 }));
    if (S && !rows.some(r => r.id === this.uid || (r.n === S.name && r.l === S.lvl))) rows.push({ id: 'me', n: S.name, c: S.cls, l: S.lvl, xp: S.xp, p: P.st.power | 0, w: S.wings.t });
    rows.sort((a, b) => b.l - a.l || b.xp - a.xp || b.p - a.p); return rows.slice(0, 50);
  },
  /* ---- telemetria para o painel ADM (só no servidor próprio) ---- */
  evq: [],
  track(e, d) {
    if (this.mode !== 'ws' && this.ready) return; const m = { t: 'ev', e, d: d || {} };
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); else if (this.evq.length < 60) this.evq.push(m);
  },
  _flushEv() { if (!this.ws || this.ws.readyState !== 1) return; for (const m of this.evq) this.ws.send(JSON.stringify(m)); this.evq = []; },
  _admCmd(m) {
    if (!S || !G.started) return;
    if (m.c === 'give') { const g = m.g || {}; if (g.gold) gainGold(g.gold); if (g.xp) gainXp(g.xp); if (g.item && ITEMS[g.item]) addItem(g.item, g.q || 1); UI.toast('🎁 Presente da Administração' + (m.m ? ': ' + m.m : '!'), 'gold'); Sfx.play('rare'); saveAll(true); UI.dirty.all = 1; }
    else if (m.c === 'tp' && ZONES[m.z]) { if (P.dead) respawn(false); UI.closeAll(); UI.fade(() => enterZone(m.z, null)); UI.toast('Um ADM teleportou você para ' + ZONES[m.z].name + '.', 'gold'); }
    else if (m.c === 'heal') { if (P.dead) respawn(false); P.hp = P.st.maxHp; P.mp = P.st.maxMp; UI.dirty.hud = 1; fxPillar(P.x, P.y, '#7dff8a'); UI.toast('Um ADM restaurou sua vida e mana.', 'good'); }
  },
  _kicked(msg) {
    this.kicked = true; try { this.ws && this.ws.close(); } catch (e) { } if (G.started) saveLocal();
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(8,6,20,.92);color:#fff;font:600 18px/1.5 sans-serif;text-align:center;padding:24px';
    d.innerHTML = '<div style="max-width:420px"><div style="font-size:42px">⚠️</div><p></p><button style="margin-top:14px;padding:10px 22px;border:0;border-radius:8px;background:#7a4fd0;color:#fff;font:inherit;cursor:pointer">Recarregar</button></div>';
    d.querySelector('p').textContent = msg || 'Você foi desconectado.'; d.querySelector('button').onclick = () => location.reload(); document.body.appendChild(d);
  },
  /* ---- skins: concessão por ADM ---- */
  isAdmin: false, gunsub: null, gname: null,
  watchGrants() {
    if (!S || this.gname === S.name) return; if (this.mode === 'ws') { this.lastState = ''; return; }
    if (!this.db) return; this.gname = S.name; if (this.gunsub) { try { this.gunsub(); } catch (e) { } }
    try { this.gunsub = this.db.doc('grants/' + nameKey(S.name)).onSnapshot(snap => { if (snap.metadata && snap.metadata.fromCache) return; const d = snap.exists ? snap.data() : null; applyGrants(d && d.skins); }, () => { this.gname = null; }); } catch (e) { this.gname = null; }
  },
  admLogin(key) { this._admKey = key; if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'adm', key })); },
  async grant(name, skin, on) {
    name = String(name).trim().slice(0, 16); if (!SKINS[skin] || !name) return;
    if (!this.isAdmin) { UI.log('Apenas ADM pode usar este comando.' + (this.mode === 'ws' ? ' Use /adm <chave>.' : ''), 'sys'); return; }
    if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify({ t: 'grant', name, skin, on: !!on })); return; }
    if (!this.db) { UI.log('Sem conexão com o servidor: não é possível conceder skins agora.', 'sys'); return; }
    try { const ref = this.db.doc('grants/' + nameKey(name)), snap = await ref.get(), skins = Object.assign({}, snap.exists && snap.data().skins); if (on) skins[skin] = 1; else delete skins[skin]; await ref.set({ name, skins, t: Date.now() }); UI.log('Skin ' + SKINS[skin].name + (on ? ' concedida a ' : ' removida de ') + name + '.', 'sys'); UI.toast('Skin ' + (on ? 'concedida a ' : 'removida de ') + name + '.', 'good'); }
    catch (e) { UI.log('Não foi possível alterar as skins de ' + name + ' (sem permissão ou sem conexão).', 'sys'); }
  },
  /* ---- modo servidor próprio (WebSocket) ---- */
  _wsConnect() {
    return new Promise(res => {
      let tok = null; try { tok = localStorage.getItem('aetheria_token'); if (!tok) { tok = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('aetheria_token', tok); } } catch (e) { tok = 'anon' + Math.random(); }
      let ws; try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return res(); }
      const fail = setTimeout(() => res(), 3000);
      ws.onopen = () => { this.ws = ws; this.mode = 'ws'; let adm = null; try { adm = localStorage.getItem('aetheria_adm'); } catch (e) { } ws.send(JSON.stringify(adm ? { t: 'hello', id: tok, adm } : { t: 'hello', id: tok })); };
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'welcome') { this.wsId = m.pid; this.uid = m.pid; if (m.save && validSave(m.save)) this.cloudSave = m.save; if (m.motd) setTimeout(() => { UI.log('📢 ' + m.motd, 'sys'); }, 1500); clearTimeout(fail); res(); this._flushEv(); }
        else if (m.t === 'peers') { if (m.z === this.zone && Array.isArray(m.list)) this._applyPeers(m.list.filter(p => p[0] !== this.wsId)); this.online = m.on | 0 || 1; UI.netStatus(); }
        else if (m.t === 'chat' && m.id !== this.wsId) this._recv(m.id, String(m.n || '?').slice(0, 16), String(m.m || '').slice(0, 140), m.k | 0);
        else if (m.t === 'skins') applyGrants(m.skins);
        else if (m.t === 'admmsg') { const t = String(m.m || '').slice(0, 200); UI.log((m.kind === 'pm' ? '🛡️ ADM (privado): ' : '📢 ADM: ') + t, 'r4'); UI.toast((m.kind === 'pm' ? '🛡️ ' : '📢 ') + t, 'gold'); }
        else if (m.t === 'admcmd') this._admCmd(m);
        else if (m.t === 'kicked') this._kicked(String(m.m || '').slice(0, 220));
        else if (m.t === 'adm') { this.isAdmin = !!m.ok; try { if (m.ok && this._admKey) localStorage.setItem('aetheria_adm', this._admKey); } catch (e) { } UI.log(m.ok ? 'Modo ADM ativado.' : 'Chave de ADM incorreta.', 'sys'); UI.dirty.win = 1; }
        else if (m.t === 'granted') UI.log(m.ok ? 'Skin ' + (m.on ? 'concedida a ' : 'removida de ') + m.name + '.' : 'Não foi possível: ' + (m.err || 'sem permissão') + '.', 'sys');
        else if (m.t === 'rank' && this._rankRes) { this._rankRes(Array.isArray(m.list) ? m.list : []); this._rankRes = null; }
      };
      ws.onclose = () => { if (this.kicked) { this.ws = null; this.mode = 'offline'; return; } if (this.ws === ws) { this.ws = null; this.mode = 'offline'; G.peers.clear(); UI.netStatus(); setTimeout(() => this._wsConnect().then(() => { if (this.ws) { this.lastState = ''; this.isAdmin = false; UI.netStatus(); } }), 4000); } };
      ws.onerror = () => { };
    });
  },
};
