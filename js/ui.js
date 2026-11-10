'use strict';
/* ============ Interface (HUD, janelas, lojas, título) ============ */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MENU = [['char', '🧝', 'Personagem', 'C'], ['inv', '🎒', 'Mochila', 'I'], ['skills', '✨', 'Habilidades', 'K'], ['quests', '📜', 'Missões', 'L'], ['prof', '⚒️', 'Profissões', 'P'], ['wings', '🪽', 'Asas', 'O'], ['skins', '🎭', 'Visuais', 'V'], ['map', '🗺️', 'Mapa', 'M'], ['rank', '🏆', 'Ranking', 'R'], ['cash', '💎', 'Loja', ''], ['settings', '⚙️', 'Opções', '']];
const TITLES = { char: 'Personagem', inv: 'Mochila', skills: 'Habilidades', quests: 'Missões', prof: 'Profissões', wings: 'Asas', skins: 'Visuais', map: 'Mapa de Aetheria', rank: 'Ranking', cash: 'Loja de Cristais', settings: 'Opções', smith: 'Ferreiro Brom', alch: 'Alquimista Mirela', merchant: 'Mercador Tobias' };
const WIDE = { smith: 1, cash: 1, merchant: 1 };

const UI = {
  dirty: {}, wins: [], sel: { inv: -1, eq: null, enh: null }, tab: { quests: 'main', smith: 'enh', alch: 'shop', merchant: 'sell', cash: 'gems', forgeT: 1 }, npc: null, slots: [], cache: {}, miniT: 0, rank: null, cls: 'warrior', touch: false,
  toast(msg, cls) { const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.textContent = msg; const t = $('toasts'); t.appendChild(d); while (t.children.length > 4) t.firstChild.remove(); setTimeout(() => d.remove(), 3600); },
  _line(html, cls) { const l = $('chatlog'), p = document.createElement('p'); if (cls) p.className = cls; p.innerHTML = html; const stick = l.scrollTop + l.clientHeight >= l.scrollHeight - 30; l.appendChild(p); while (l.children.length > 80) l.firstChild.remove(); if (stick) l.scrollTop = l.scrollHeight; },
  log(msg, cls) { this._line(esc(msg), cls || 'sys'); },
  chat(name, msg, kind, me) { if (kind) this._line('<span class="w">[Mundo] ' + esc(name) + ' ' + esc(msg) + '</span>'); else this._line('<span class="n">' + esc(name) + ':</span> ' + esc(msg), me ? 'me' : ''); if (!me && !kind && this.touch && !$('chat').classList.contains('open')) $('chatbtn').style.boxShadow = '0 0 12px #7fe0ff'; },
  zoneBanner(Z) { const b = $('banner'); b.innerHTML = '<h2>' + esc(Z.name) + '</h2><p>' + (Z.safe ? 'Zona segura' : 'Níveis ' + Z.lvl[0] + ' – ' + Z.lvl[1]) + '</p>'; b.classList.add('on'); clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('on'), 2600); $('zname').textContent = Z.name; },
  fade(cb) { const f = $('fade'); f.classList.add('on'); setTimeout(() => { cb(); setTimeout(() => f.classList.remove('on'), 120); }, 300); },
  netStatus() {
    const m = Net.mode, txt = m === 'claude' || m === 'ws' ? '🟢 Online · ' + Net.online + (Net.online === 1 ? ' jogador' : ' jogadores') : m === 'cloud' ? '🟡 Nuvem ativa' : Net.ready ? '⚪ Offline (save local)' : '… conectando';
    if ($('netst')) $('netst').textContent = txt; if ($('titlenet')) $('titlenet').textContent = Net.ready ? txt : 'Conectando ao servidor…';
  },
  showDeath(loss) { $('deathmsg').textContent = loss ? 'Você perdeu ' + fmt(loss) + ' de experiência.' : 'Levante-se, aventureiro.'; $('death').classList.remove('hidden'); this.closeAll(); },
  hideDeath() { $('death').classList.add('hidden'); },
  modal(html) { const m = $('modal'); m.innerHTML = '<div class="panel deathbox">' + html + '</div>'; m.classList.remove('hidden'); },
  closeModal() { $('modal').classList.add('hidden'); },
  loginReward(day, gold, items) {
    let h = '<h2>Recompensa Diária</h2><p>Dia <b class="gold">' + day + '</b> de 7 consecutivos</p><div class="stars">' + '★'.repeat(day) + '<s>' + '★'.repeat(7 - day) + '</s></div><p>🪙 ' + fmt(gold) + ' ouro</p>';
    for (const [id, n] of items) h += '<p>' + ITEMS[id].icon + ' ' + esc(ITEMS[id].name) + ' x' + n + '</p>';
    this.modal(h + '<p class="dim small">Volte amanhã — o 7º dia dá Penas Etéreas e Pedras de Reforço.</p><div class="row"><button class="btn gold" data-act="closeModal">Receber</button></div>');
  },

  tutorial(i) {
    const T = this.touch, steps = [
      ['🌟', 'Bem-vindo a Aetheria!', 'Explore 7 regiões, derrote chefes, evolua suas Asas e torne-se uma lenda. Este guia rápido mostra o básico.'],
      ['🕹️', 'Andar e atacar', T ? 'Use o <b>joystick</b> à esquerda para andar. O botão vermelho <b>⚔</b> ataca o inimigo mais próximo — seu herói continua atacando sozinho. <b>🎯</b> troca de alvo.' : 'Ande com <b>WASD</b> ou clicando no chão. <b>Espaço</b> ataca o inimigo mais próximo (ou clique nele) — seu herói continua atacando sozinho. <b>Tab</b> troca de alvo.'],
      ['✨', 'Habilidades e poções', T ? 'Os botões redondos em volta do ataque são suas <b>habilidades</b> (novas nos níveis 6, 14 e 24). <b>🧪</b> cura vida e <b>⚗️</b> recupera mana.' : 'Teclas <b>1 a 4</b> usam suas habilidades (novas nos níveis 6, 14 e 24). <b>Q</b> bebe poção de vida e <b>E</b> poção de mana.'],
      ['📜', 'Missões e caminho', 'Fale com a <b>Mestra Elowen</b> (❗ sobre a cabeça) para pegar missões. Depois toque em <b>🧭 Destacar caminho</b>: setas douradas no chão guiam você até o objetivo.' + (T ? ' Toque em NPCs, portais e recursos para interagir.' : ' <b>F</b> interage com NPCs, portais e recursos.')],
      ['🎒', 'Ficando mais forte', (T ? 'No menu <b>☰</b>' : 'Nos botões à direita') + ' você abre <b>Personagem</b> (atributos a cada nível), <b>Mochila</b> (equipe itens com ▲), <b>Habilidades</b> e <b>Profissões</b>. O Ferreiro reforça e forja equipamentos.'],
      ['🪽', 'Asas e mundo online', 'No nível 10 suas <b>Asas</b> despertam com a Guardiã Seraphine. Outros jogadores aparecem no mundo e no chat. O jogo salva sozinho. Boa aventura!'],
    ], s = steps[i]; if (!s) return this.acts.tutend();
    this.modal('<div style="font-size:42px;line-height:1">' + s[0] + '</div><h2>' + s[1] + '</h2><p style="text-align:left">' + s[2] + '</p><div class="stars" style="font-size:12px">' + steps.map((_, k) => k === i ? '●' : '<s>●</s>').join('') + '</div><div class="row">' + (i < steps.length - 1 ? '<button class="btn ghost" data-act="tutend">Pular</button><button class="btn gold" data-act="tut:' + (i + 1) + '">Próximo ▶</button>' : '<button class="btn gold" data-act="tutend">Começar!</button>') + '</div>');
  },
  /* ---------- HUD ---------- */
  start() {
    $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
    $('menu').innerHTML = MENU.map(m => '<button class="mbtn" data-act="toggle:' + m[0] + '" title="' + m[2] + (m[3] ? ' (' + m[3] + ')' : '') + '">' + m[1] + '<small>' + m[2] + '</small></button>').join('');
    this.buildBars(); $('pport').textContent = CLASSES[S.cls].icon; this.dirty.all = 1; this.netStatus();
    if (!S.tut) { const m = $('modal'); this._pend = m.classList.contains('hidden') ? null : m.innerHTML; this.tutorial(0); }
    this.log('Bem-vindo a Aetheria, ' + S.name + '!', 'sys');
    this.log(this.touch ? 'Use o joystick para andar e ⚔ para atacar. Toque em NPCs para falar.' : 'WASD/clique para andar · Espaço ataca · 1-4 habilidades · Q/E poções · F interage · Enter conversa.', 'sys');
  },
  buildBars() {
    const C = CLASSES[S.cls]; this.slots = [];
    const mk = (cont, cls, key, act, type, i) => { const b = document.createElement('button'); b.className = 'slot ' + cls; b.dataset.down = act; b.innerHTML = '<span class="ic"></span><span class="k">' + key + '</span><span class="q"></span><span class="cd"></span><span class="cdt"></span>'; cont.appendChild(b); this.slots.push({ el: b, ic: b.children[0], q: b.children[2], cd: b.children[3], cdt: b.children[4], type, i }); return b; };
    const hb = $('hotbar'), ta = $('tact'); hb.innerHTML = ''; ta.innerHTML = '';
    for (let i = 0; i < 4; i++) { mk(hb, '', i + 1, 'skill:' + i, 'skill', i); mk(ta, 's' + i, '', 'skill:' + i, 'skill', i); }
    mk(hb, 'sep', 'Q', 'pot:hp', 'pot', 'hp'); mk(hb, '', 'E', 'pot:mp', 'pot', 'mp'); mk(ta, 'p0', '', 'pot:hp', 'pot', 'hp'); mk(ta, 'p1', '', 'pot:mp', 'pot', 'mp');
    const a = mk(ta, 'atk', '', 'attack', 'atk', 0); a.children[0].textContent = C.wIcon; const t = mk(ta, 'tg', '', 'nexttarget', 'tg', 0); t.children[0].textContent = '🎯';
  },
  frame(dt) {
    const c = this.cache, st = P.st, set = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
    set('hp', Math.ceil(P.hp) + '/' + st.maxHp, v => { $('hpf').style.width = Math.max(0, P.hp / st.maxHp * 100) + '%'; $('hpt').textContent = v; });
    set('mp', Math.floor(P.mp) + '/' + st.maxMp, v => { $('mpf').style.width = Math.max(0, P.mp / st.maxMp * 100) + '%'; $('mpt').textContent = v; });
    set('xp', S.lvl + ':' + Math.floor(S.xp), () => { const n = xpNeed(S.lvl), f = S.lvl >= MAX_LEVEL ? 1 : S.xp / n; $('xpf').style.width = f * 100 + '%'; $('xpt').textContent = S.lvl >= MAX_LEVEL ? 'Nível máximo' : 'XP ' + fmt(S.xp) + ' / ' + fmt(n) + '  (' + (f * 100).toFixed(1) + '%)'; });
    set('nm', S.name + S.lvl, () => { $('pname').textContent = S.name; $('plvl').textContent = 'Nv. ' + S.lvl; });
    set('gold', S.gold, v => { $('gold').textContent = '🪙 ' + fmt(v) + '   💎 ' + (S.gems || 0); });
    const m = P.target && !P.target.dead ? P.target : null;
    set('tg', m ? m.def.id + (m.elite ? 'e' : '') : '', v => { $('tframe').classList.toggle('hidden', !v); if (m) { $('tname').textContent = (m.elite ? '★ ' : '') + m.def.name; $('tlvl').textContent = 'Nv. ' + m.lvl; } });
    if (m) set('thp', Math.ceil(m.hp), v => { $('thpf').style.width = Math.max(0, m.hp / m.maxHp * 100) + '%'; $('thpt').textContent = fmt(v) + ' / ' + fmt(m.maxHp); });
    set('near', G.near ? G.near.label : '', v => { const p = $('prompt'); p.classList.toggle('hidden', !v); if (v) p.innerHTML = '<kbd>F</kbd>' + esc(v); });
    const C = CLASSES[S.cls];
    for (const s of this.slots) {
      if (s.type === 'skill') { const sk = C.skills[s.i], lv = S.skills[sk.id] || 0, left = (P.cds[sk.id] || 0) - G.time; set('si' + s.i + s.el.className[5], sk.icon + lv, () => { s.ic.textContent = sk.icon; s.el.classList.toggle('lock', !lv); s.el.title = sk.name; }); s.cd.style.height = left > 0 ? Math.min(100, left / sk.cd * 100) + '%' : '0'; const tx = left > 0 ? (left >= 1 ? Math.ceil(left) : left.toFixed(1)) : (lv && P.mp < sk.mp ? '💧' : ''); if (s.cdt.textContent !== String(tx)) s.cdt.textContent = tx; }
      else if (s.type === 'pot') { let n = 0, tint = ''; for (let t = 4; t >= 1; t--) { const id = s.i + t; if (S.lvl >= ITEMS[id].req) n += countItem(id); } const left = P.potCd - G.time; if (s.ic.textContent !== (s.i === 'hp' ? '🧪' : '⚗️')) s.ic.textContent = s.i === 'hp' ? '🧪' : '⚗️'; if (s.q.textContent !== String(n)) s.q.textContent = n; s.cd.style.height = left > 0 ? left / 6 * 100 + '%' : '0'; s.el.classList.toggle('lock', !n); }
    }
    if (this.dirty.buffs || this.dirty.all || (G.time | 0) !== c.bt) { c.bt = G.time | 0; $('buffs').innerHTML = P.buffs.map(b => '<div class="buff" title="' + esc(b.name) + '">' + b.icon + '<b>' + Math.ceil(b.until - G.time) + '</b></div>').join(''); this.dirty.buffs = 0; }
    this.miniT += dt; if (this.miniT > 0.2) { this.miniT = 0; drawMini($('mini')); }
    if (this.dirty.quest || this.dirty.all) { this.dirty.quest = 0; let h = ''; let n = 0; const tb = k => '<button class="trk' + (S.track === k ? ' on' : '') + '" data-act="track:' + k + '">🧭</button>'; for (const id in S.quests.active) { if (n++ >= 3) break; const q = QUEST_BY_ID[id], p = S.quests.active[id]; h += '<div>' + tb('q:' + id) + '<h4>' + esc(q.name) + '</h4>' + (p >= q.obj.n ? '<span class="good">Concluída — entregue!</span>' : esc(objText(q.obj)) + ' ' + p + '/' + q.obj.n) + '</div>'; } if (S.track && S.track[0] === 'd') { const d = S.daily.list[+S.track.slice(2)]; if (d) h += '<div>' + tb(S.track) + '<h4>Contrato diário</h4>' + esc(MOBS[d.mob].name) + ' ' + d.prog + '/' + d.n + '</div>'; } if (!n && G.qMark === '!') h = '<div><h4>Nova missão disponível</h4>Fale com a Mestra Elowen</div>'; $('tracker').innerHTML = h; const qb = document.querySelector('[data-act="toggle:quests"]'); if (qb) { let d = qb.querySelector('.dot'); if (G.qMark) { if (!d) { d = document.createElement('span'); d.className = 'dot'; qb.appendChild(d); } d.textContent = G.qMark; } else if (d) d.remove(); } }
    if (this.wins.length && (this.dirty.all || this.dirty.inv || this.dirty.char || this.dirty.prof || this.dirty.win)) this.renderWins();
    this.dirty = {};
  },

  /* ---------- Janelas ---------- */
  open(id, npc) {
    this.npc = npc || null; const max = this.touch || window.innerWidth < 900 ? 1 : 2;
    this.wins = this.wins.filter(w => w !== id); this.wins.push(id); while (this.wins.length > max) this.wins.shift();
    if (id === 'rank') { this.rank = null; Net.getRank().then(r => { this.rank = r; this.dirty.win = 1; }); }
    $('menu').classList.remove('open'); this.sel.inv = -1; this.buildWins(); Sfx.play('ui');
  },
  close(id) { this.wins = this.wins.filter(w => w !== id); if (!this.wins.length) this.npc = null; this.buildWins(); },
  closeAll() { this.wins = []; this.npc = null; this.buildWins(); $('menu').classList.remove('open'); this.closeModal(); },
  toggle(id) { if (this.wins.includes(id)) this.close(id); else this.open(id, null); },
  openNpc(key) {
    Net.track('npc', { k: key });
    if (key === 'quest' || key === 'scout') { this.tab.quests = 'main'; this.open('quests', key); }
    else if (key === 'smith') this.open('smith', key); else if (key === 'alch') this.open('alch', key); else if (key === 'merchant') this.open('merchant', key);
    else if (key === 'wings') this.open('wings', key); else if (key === 'cash') this.open('cash', key); else if (key === 'tele') this.open('map', key);
  },
  buildWins() { $('wins').innerHTML = this.wins.map(id => '<div class="win panel' + (WIDE[id] ? ' wide' : '') + '" data-w="' + id + '"><header><h3>' + TITLES[id] + '</h3><button class="x" data-act="close:' + id + '">✕</button></header><div class="body"></div></div>').join(''); this.renderWins(); },
  renderWins() { const keep = {}, act = document.activeElement && document.activeElement.id; $('wins').querySelectorAll('input[id],select[id]').forEach(i => keep[i.id] = i.value); for (const el of $('wins').children) { const b = el.querySelector('.body'), sc = b.scrollTop; b.innerHTML = this.R[el.dataset.w].call(this); b.scrollTop = sc; } for (const id in keep) { const i = $(id); if (i) { i.value = keep[id]; if (act === id) i.focus(); } } $('wins').querySelectorAll('canvas[data-skin]').forEach(cv => { const g = cv.getContext('2d'); g.clearRect(0, 0, 120, 140); g.save(); g.translate(60, 124); g.scale(2, 2); drawHero(g, 0, 0, { cls: S.cls, dir: 1, t: G.time, skin: cv.dataset.skin }); g.restore(); }); const cv = $('wingcv'); if (cv) { const g = cv.getContext('2d'); g.clearRect(0, 0, 220, 150); g.save(); g.translate(110, 128); g.scale(2, 2); drawHero(g, 0, 0, { cls: S.cls, dir: 1, t: G.time, wings: Math.max(1, S.wings.t) }); g.restore(); } },

  itemHTML(it, o) {
    o = o || {};
    if (!it.eq) { const d = ITEMS[it.id]; return '<h4 style="color:' + RARITY[d.r || 0].c + '">' + d.icon + ' ' + esc(d.name) + (it.q > 1 ? ' x' + it.q : '') + '</h4><p class="dim">' + esc(d.desc) + '</p>' + (d.req > 1 ? '<p class="' + (S.lvl >= d.req ? 'dim' : 'bad') + '">Requer nível ' + d.req + '</p>' : '') + '<p class="gold small">Venda: ' + d.sell + ' 🪙 cada</p>'; }
    const R = RARITY[it.r], em = 1 + it.enh * 0.08, cur = S.eq[it.slot]; let h = '<h4 style="color:' + R.c + '">' + SLOT_ICON[it.slot] + ' ' + esc(itemName(it)) + '</h4><p class="dim small">' + R.n + ' · ' + SLOT_NAME[it.slot] + ' · Nível de item ' + it.ilvl + '</p>';
    if (it.atk) h += '<p>Ataque <b>' + Math.round(it.atk * em) + '</b></p>'; if (it.def) h += '<p>Defesa <b>' + Math.round(it.def * em) + '</b></p>'; if (it.hp) h += '<p>Vida <b>+' + Math.round(it.hp * em) + '</b></p>';
    for (const k in it.aff) h += '<p class="good">+' + it.aff[k] + (k === 'crit' ? '% Crítico' : k === 'hp' ? ' Vida' : k === 'mp' ? ' Mana' : ' ' + ATTR_NAME[k]) + '</p>';
    if (S.lvl < it.ilvl) h += '<p class="bad">Requer nível ' + it.ilvl + '</p>'; if (it.slot === 'weapon' && it.cls !== S.cls) h += '<p class="bad">Apenas ' + CLASSES[it.cls].name + '</p>';
    if (o.compare && cur !== it) { const d = eqScore(it) - eqScore(cur); h += '<p class="' + (d >= 0 ? 'good' : 'bad') + '">' + (d >= 0 ? '▲ +' : '▼ ') + d + ' de poder em relação ao equipado</p>'; }
    return h + '<p class="gold small">Venda: ' + fmt(eqSell(it)) + ' 🪙</p>';
  },
  cellHTML(it, act, sel) {
    if (!it) return '<button class="cell" data-act="' + act + '"></button>';
    if (it.eq) { const up = S.lvl >= it.ilvl && (it.slot !== 'weapon' || it.cls === S.cls) && eqScore(it) > eqScore(S.eq[it.slot]) && S.eq[it.slot] !== it; return '<button class="cell r' + it.r + (sel ? ' sel' : '') + '" data-act="' + act + '">' + (it.slot === 'weapon' ? CLASSES[it.cls].wIcon : SLOT_ICON[it.slot]) + (it.enh ? '<span class="e">+' + it.enh + '</span>' : '') + (up ? '<span class="up">▲</span>' : '') + '</button>'; }
    const d = ITEMS[it.id]; return '<button class="cell r' + (d.r || 0) + (sel ? ' sel' : '') + '" data-act="' + act + '">' + d.icon + '<span class="q">' + it.q + '</span></button>';
  },
  invHTML(shop) {
    let h = '<div class="row small"><span class="gold">🪙 ' + fmt(S.gold) + '</span><span class="sp"></span><span class="dim">' + S.inv.filter(x => x).length + '/' + S.inv.length + ' espaços</span></div><div class="grid" style="margin-top:6px">';
    S.inv.forEach((it, i) => h += this.cellHTML(it, 'invsel:' + i, this.sel.inv === i)); h += '</div>';
    const it = S.inv[this.sel.inv];
    if (it) { h += '<div class="detail">' + this.itemHTML(it, { compare: 1 }) + '<div class="row" style="margin-top:6px">'; if (it.eq) h += '<button class="btn sm" data-act="equip">Equipar</button>'; else if (ITEMS[it.id].use) h += '<button class="btn sm" data-act="useinv">Usar</button>'; if (shop) h += '<button class="btn sm gold" data-act="sell:0">Vender</button>' + (!it.eq && it.q > 1 ? '<button class="btn sm gold" data-act="sell:1">Vender tudo</button>' : ''); h += '<span class="sp"></span><button class="btn sm red" data-act="drop">Descartar</button></div></div>'; }
    else h += '<p class="dim small c">Toque em um item para ver os detalhes.' + (shop ? '' : ' Para vender, visite o Mercador Tobias na vila.') + '</p>';
    if (shop) h += '<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="selljunk">Vender equipamentos Comuns e Incomuns</button></div>';
    return h;
  },
  potShopHTML() { let h = ''; const ids = []; for (let t = 1; t <= 4; t++) ids.push('hp' + t, 'mp' + t); ids.push('scroll'); for (const id of ids) { const d = ITEMS[id], ok = S.lvl >= (d.req || 1); h += '<div class="li"><div class="ic">' + d.icon + '</div><div class="tx"><b>' + esc(d.name) + '</b><span>' + esc(d.desc) + (d.req > 1 ? ' Nível ' + d.req + '.' : '') + ' Você tem ' + countItem(id) + '.</span></div><button class="btn sm' + (ok ? '' : ' off') + '" data-act="buy:' + id + ':1">' + d.price + ' 🪙</button><button class="btn sm' + (ok ? '' : ' off') + '" data-act="buy:' + id + ':10">x10</button></div>'; } return h; },
  needHTML(need, gold) { return need.map(([id, q]) => '<span class="' + (countItem(id) >= q ? 'good' : 'bad') + '">' + ITEMS[id].icon + ' ' + esc(ITEMS[id].name) + ' ' + countItem(id) + '/' + q + '</span>').join(' · ') + (gold ? ' · <span class="' + (S.gold >= gold ? 'good' : 'bad') + '">🪙 ' + fmt(gold) + '</span>' : ''); },
  tabsHTML(key, tabs) { return '<div class="tabs">' + tabs.map(t => '<button class="tab' + (this.tab[key] === t[0] ? ' on' : '') + '" data-act="tab:' + key + ':' + t[0] + '">' + t[1] + '</button>').join('') + '</div>'; },

  R: {
    char() {
      const st = P.st, a = st.attrs, C = CLASSES[S.cls]; let h = '<div class="row" style="margin-bottom:8px"><b class="cz gold">' + esc(S.name) + '</b><span class="dim">' + C.icon + ' ' + C.name + ' · Nível ' + S.lvl + '</span><span class="sp"></span><span class="gold">⚡ Poder ' + fmt(st.power) + '</span></div><div class="eqgrid">';
      for (const s of SLOTS) { const e = S.eq[s]; h += e ? this.cellHTML(e, 'eqsel:' + s, this.sel.eq === s) : '<button class="cell" style="opacity:.45" data-act="eqsel:' + s + '">' + SLOT_ICON[s] + '<small>' + SLOT_NAME[s] + '</small></button>'; }
      h += '</div>'; const se = S.eq[this.sel.eq]; if (se) h += '<div class="detail" style="margin:0 0 10px">' + this.itemHTML(se) + '<div class="row" style="margin-top:6px"><button class="btn sm" data-act="unequip:' + this.sel.eq + '">Desequipar</button></div></div>';
      h += '<div class="stats"><div>Ataque <b>' + fmt(st.atk) + '</b></div><div>Defesa <b>' + fmt(st.def) + '</b></div><div>Vida <b>' + fmt(st.maxHp) + '</b></div><div>Mana <b>' + fmt(st.maxMp) + '</b></div><div>Crítico <b>' + st.crit.toFixed(1) + '%</b></div><div>Esquiva <b>' + st.dodge.toFixed(1) + '%</b></div><div>Ataques/s <b>' + (1 / st.aspd).toFixed(2) + '</b></div><div>Bônus das Asas <b>+' + (wingBonus(S.wings) * 100).toFixed(1) + '%</b></div></div>';
      h += '<h4 class="cz gold" style="margin:12px 0 6px">Atributos <span class="dim small" style="font-family:inherit">— pontos livres: <b class="' + (S.pts ? 'good' : '') + '">' + S.pts + '</b></span></h4>';
      for (const k in ATTR_NAME) h += '<div class="li"><div class="tx"><b>' + ATTR_NAME[k] + ' ' + a[k] + (C.main.includes(k) ? ' <span class="gold small">★ principal</span>' : '') + '</b><span>' + ATTR_DESC[k] + '</span></div><button class="btn sm' + (S.pts ? '' : ' off') + '" data-act="attr:' + k + ':1">+1</button><button class="btn sm' + (S.pts >= 5 ? '' : ' off') + '" data-act="attr:' + k + ':5">+5</button></div>';
      return h + '<p class="dim small">Tempo de jogo: ' + Math.floor(S.stats.played / 3600) + 'h ' + Math.floor(S.stats.played / 60 % 60) + 'min · Monstros: ' + fmt(S.stats.kills) + ' · Chefes: ' + S.stats.bosses + ' · Mortes: ' + S.stats.deaths + '</p>';
    },
    inv() { return this.invHTML(false); },
    skills() {
      const C = CLASSES[S.cls]; let h = '<p>Pontos de habilidade: <b class="' + (S.sp ? 'good' : 'gold') + '">' + S.sp + '</b> <span class="dim small">(1 por nível)</span></p><h4 class="cz gold" style="margin:6px 0">Ativas</h4>';
      C.skills.forEach((sk, i) => { const lv = S.skills[sk.id] || 0, need = skillLevelCap(sk, lv); h += '<div class="li"><div class="ic">' + sk.icon + '</div><div class="tx"><b>' + sk.name + ' <span class="gold small">' + (lv ? 'Nv. ' + lv + '/' + SKILL_MAX : 'Nível ' + sk.lvl) + '</span></b><span>' + sk.desc + (sk.mul ? ' Dano: ' + Math.round(sk.mul * (1 + 0.1 * (Math.max(1, lv) - 1)) * 100) + '%.' : '') + ' Mana ' + sk.mp + ' · Recarga ' + sk.cd + 's · Tecla ' + (i + 1) + '</span></div>' + (lv && lv < SKILL_MAX ? '<button class="btn sm' + (S.sp && S.lvl >= need ? '' : ' off') + '" data-act="upskill:' + sk.id + '">' + (S.lvl >= need ? '+' : 'Nv.' + need) + '</button>' : lv ? '<span class="gold">MÁX</span>' : '<span class="dim">🔒</span>') + '</div>'; });
      h += '<h4 class="cz gold" style="margin:10px 0 6px">Passivas</h4>';
      for (const ps of C.passives) { const lv = S.skills[ps.id] || 0, need = 3 + lv * 4; h += '<div class="li"><div class="ic">' + ps.icon + '</div><div class="tx"><b>' + ps.name + ' <span class="gold small">Nv. ' + lv + '/' + SKILL_MAX + '</span></b><span>' + ps.desc + '</span></div>' + (lv < SKILL_MAX ? '<button class="btn sm' + (S.sp && S.lvl >= need ? '' : ' off') + '" data-act="upskill:' + ps.id + '">' + (S.lvl >= need ? '+' : 'Nv.' + need) + '</button>' : '<span class="gold">MÁX</span>') + '</div>'; }
      return h;
    },
    quests() {
      const at = this.npc === 'quest' || this.npc === 'scout', tabs = [['main', 'História'], ['daily', 'Contratos'], ['ach', 'Conquistas']]; if (this.npc === 'scout') tabs.push(['shop', 'Suprimentos']);
      let h = this.tabsHTML('quests', tabs), t = this.tab.quests;
      if (t === 'shop') return h + this.potShopHTML();
      if (t === 'main') {
        h += '<p class="small" style="margin:0 0 6px">🧭 <b class="gold">Destacar caminho</b>: setas no chão levam você até o objetivo da missão.</p>'; if (!at) h += '<p class="dim small">Aceite e entregue missões com a <b>Mestra Elowen</b> (vila) ou com o <b>Batedor Kael</b> na entrada de cada região.</p>';
        const order = { ready: 0, active: 1, available: 2, level: 3 }; let shown = 0;
        const rw = q => '<span class="gold">Recompensa: ' + fmt(q.reward.xp) + ' XP · ' + fmt(q.reward.gold) + ' 🪙' + q.reward.items.map(([id, n]) => ' · ' + ITEMS[id].icon + ' ' + ITEMS[id].name + ' x' + n).join('') + '</span>';
        QUESTS.map(q => [q, questStatus(q)]).filter(x => x[1] in order).sort((a, b) => order[a[1]] - order[b[1]]).forEach(([q, s]) => {
          if (s === 'level' && shown++ > 0) return; const p = S.quests.active[q.id] || 0;
          h += '<div class="li" style="align-items:flex-start"><div class="ic">' + (s === 'ready' ? '❓' : s === 'active' ? '⚔️' : s === 'level' ? '🔒' : '❗') + '</div><div class="tx"><b>' + esc(q.name) + ' <span class="dim small">' + esc(ZONES[q.zone].name) + ' · Nv. ' + q.reqLvl + '</span></b><span>' + esc(q.text) + '</span><span style="color:var(--txt)">' + esc(objText(q.obj)) + ': ' + Math.min(p, q.obj.n) + '/' + q.obj.n + '</span>' + rw(q) + (s === 'active' ? '<div class="pb"><i style="width:' + p / q.obj.n * 100 + '%"></i></div>' : '') + '</div>' +
            ((s === 'ready' || s === 'active') ? '<button class="btn sm' + (S.track === 'q:' + q.id ? ' gold' : ' ghost') + '" data-act="track:q:' + q.id + '" title="Destacar caminho">🧭</button>' : '') + (s === 'ready' ? '<button class="btn sm gold' + (at ? '' : ' off') + '" data-act="turnin:' + q.id + '">Entregar</button>' : s === 'available' ? '<button class="btn sm' + (at ? '' : ' off') + '" data-act="accept:' + q.id + '">Aceitar</button>' : s === 'level' ? '<span class="bad small">Nv. ' + q.reqLvl + '</span>' : '') + '</div>';
        });
        if (QUESTS.every(q => S.quests.done[q.id])) h += '<p class="gold c">Você concluiu toda a história de Aetheria. Lenda!</p>';
        return h + '<p class="dim small c">Missões concluídas: ' + Object.keys(S.quests.done).length + '/' + QUESTS.length + '</p>';
      }
      if (t === 'daily') { h += '<p class="dim small">Três contratos novos todos os dias, ajustados ao seu nível.</p>'; S.daily.list.forEach((d, i) => { const r = dailyReward(i), done = d.prog >= d.n; h += '<div class="li"><div class="ic">📋</div><div class="tx"><b>Derrote ' + d.n + ' × ' + esc(MOBS[d.mob].name) + '</b><span class="gold">' + fmt(r.xp) + ' XP · ' + fmt(r.gold) + ' 🪙' + r.items.map(([id, n]) => ' · ' + ITEMS[id].icon + ' x' + n).join('') + '</span><div class="pb"><i style="width:' + Math.min(100, d.prog / d.n * 100) + '%"></i></div><span>' + d.prog + '/' + d.n + '</span></div>' + (!d.claimed && d.prog < d.n ? '<button class="btn sm' + (S.track === 'd:' + i ? ' gold' : ' ghost') + '" data-act="track:d:' + i + '" title="Destacar caminho">🧭</button>' : '') + (d.claimed ? '<span class="good">✔</span>' : '<button class="btn sm gold' + (done ? '' : ' off') + '" data-act="daily:' + i + '">Receber</button>') + '</div>'; }); return h; }
      for (const a of ACHS) h += '<div class="li" style="' + (S.ach[a.id] ? '' : 'opacity:.6') + '"><div class="ic">' + (S.ach[a.id] ? '🏆' : '🔒') + '</div><div class="tx"><b>' + a.name + '</b><span>' + a.desc + ' <span class="gold">+' + fmt(a.gold) + ' 🪙</span></span></div></div>';
      return h;
    },
    prof() {
      let h = '<p class="dim small">Colete recursos pelo mundo (⛏️ minério, 🪵 madeira, 🌿 ervas) e fabrique com o Ferreiro e a Alquimista. Cada região exige nível de profissão: ' + [1, 2, 3, 4, 5, 6, 7].map(t => tierReq(t)).join(' / ') + '.</p>';
      for (const k in PROFS) { const pr = S.prof[k], n = profNeed(pr.l); h += '<div class="li"><div class="ic">' + PROFS[k].icon + '</div><div class="tx"><b>' + PROFS[k].name + ' <span class="gold small">Nv. ' + pr.l + '/' + PROF_MAX + '</span></b><div class="pb"><i style="width:' + (pr.l >= PROF_MAX ? 100 : pr.xp / n * 100) + '%"></i></div><span>' + (pr.l >= PROF_MAX ? 'Máximo' : fmt(pr.xp) + ' / ' + fmt(n)) + '</span></div></div>'; }
      return h;
    },
    wings() {
      const w = S.wings, at = this.npc === 'wings'; let h = '<div class="c"><canvas id="wingcv" width="220" height="150" style="width:220px;height:150px"></canvas></div>';
      if (!w.t) return h + '<p class="c">' + (S.lvl >= WING_UNLOCK_LVL ? 'A Guardiã Seraphine pode despertar suas asas.' : 'As Asas despertam no <b class="gold">nível ' + WING_UNLOCK_LVL + '</b>. Elas aumentam ataque, defesa e vida e evoluem por 10 tiers.') + '</p><div class="row" style="justify-content:center"><button class="btn gold' + (S.lvl >= WING_UNLOCK_LVL && at ? '' : ' off') + '" data-act="wunlock">Despertar Asas</button></div>' + (at ? '' : '<p class="dim small c">Visite a Guardiã Seraphine na Vila de Lumina.</p>');
      const c = wingCost(w.t), max = w.t >= 10 && w.s >= 10;
      h += '<h3 class="c cz" style="margin:0;color:' + WINGS[w.t].c2 + '">' + WINGS[w.t].name + '</h3><p class="c dim small" style="margin:2px">Tier ' + w.t + ' de 10</p><div class="c stars">' + '★'.repeat(w.s) + '<s>' + '★'.repeat(10 - w.s) + '</s></div><p class="c">Bônus atual: <b class="good">+' + (wingBonus(w) * 100).toFixed(1) + '%</b> de Ataque, Defesa e Vida</p>';
      if (max) return h + '<p class="c gold">Suas asas alcançaram a forma Divina.</p>';
      return h + '<div class="detail c"><p>Próxima estrela: ' + this.needHTML([['feather', c.feathers]], c.gold) + '</p><div class="row" style="justify-content:center;margin-top:6px"><button class="btn gold' + (at ? '' : ' off') + '" data-act="wup">Evoluir</button></div>' + (at ? '' : '<p class="dim small">Evolua com a Guardiã Seraphine na vila.</p>') + '</div><p class="dim small c">Penas Etéreas: chefes, elites (★), missões, contratos diários e recompensa de login.</p>';
    },
    skins() {
      let h = '<p class="dim small">Skins mudam apenas a aparência do personagem — os outros jogadores também veem. São entregues pela administração do jogo.</p>';
      for (const k in SKINS) { const d = SKINS[k], own = S.skins[k], on = S.skin === k; h += '<div class="li" style="' + (on ? 'border-color:var(--gold)' : own ? '' : 'opacity:.6') + '"><canvas data-skin="' + k + '" width="120" height="140" style="width:60px;height:70px;flex:none"></canvas><div class="tx"><b style="color:' + d.c + '">' + d.icon + ' ' + d.name + (d.adm ? ' <span class="small" style="color:#ff8ad0">★ ADM</span>' : '') + '</b><span>' + d.desc + '</span></div>' + (on ? '<button class="btn sm ghost" data-act="skin:">Remover</button>' : own ? '<button class="btn sm gold" data-act="skin:' + k + '">Equipar</button>' : '<span class="dim small">🔒 Bloqueada</span>') + '</div>'; }
      if (Net.isAdmin) h += '<div class="detail"><h4 class="gold">🛡️ Painel ADM — dar ou tirar skin</h4><p class="dim small">Digite o nome exato do personagem. Também funciona no chat: <b>/skin dar Nome godslayer</b></p><input id="admname" class="txt" maxlength="16" placeholder="Nome do personagem" style="margin:4px 0;font-size:14px;padding:6px 9px"><div class="row"><select id="admskin" class="txt" style="flex:1;width:auto;font-size:14px;padding:6px">' + Object.keys(SKINS).map(k => '<option value="' + k + '">' + SKINS[k].name + '</option>').join('') + '</select><button class="btn sm gold" data-act="admgrant:1">Dar</button><button class="btn sm red" data-act="admgrant:0">Tirar</button></div></div>';
      else if (Net.mode === 'ws') h += '<p class="dim small c">ADM: digite <b>/adm &lt;chave&gt;</b> no chat para liberar o painel.</p>';
      return h;
    },
    map() {
      const at = this.npc === 'tele'; let h = at ? '<p class="dim small">O cristal leva você a qualquer região já descoberta.</p>' : '<p class="dim small">Use um Cristal de Teleporte (na vila e na entrada de cada região) para viajar.</p>';
      for (const Z of ZONES) { const disc = S.disc[Z.id], here = G.world.id === Z.id, cost = Z.id === 0 ? 0 : 20 + Z.id * 45, bq = Z.boss ? S.quests.done['q' + Z.id + '_4'] : 0; h += '<div class="li" style="' + (disc ? '' : 'opacity:.55') + '"><div class="ic">' + (Z.safe ? '🏠' : bq ? '👑' : disc ? '🗺️' : '❔') + '</div><div class="tx"><b>' + esc(Z.name) + (here ? ' <span class="good small">(você está aqui)</span>' : '') + '</b><span>' + (Z.safe ? 'Zona segura · NPCs e lojas' : 'Níveis ' + Z.lvl[0] + '–' + Z.lvl[1] + ' · Chefe: ' + MOBS[Z.boss].name) + '</span></div>' + (at && disc && !here ? '<button class="btn sm" data-act="tp:' + Z.id + '">' + (cost ? cost + ' 🪙' : 'Grátis') + '</button>' : !disc ? '<span class="dim small">Não descoberta</span>' : '') + '</div>'; }
      return h;
    },
    rank() {
      let h = '<p class="dim small">' + (Net.mode === 'claude' || Net.mode === 'ws' ? 'Jogadores online agora: <b class="good">' + Net.online + '</b>' : 'Você está offline — o ranking mostra apenas dados locais.') + '</p>';
      if (!this.rank) return h + '<p class="c dim">Carregando…</p>';
      this.rank.forEach((r, i) => h += '<div class="li" style="' + (r.n === S.name ? 'border-color:var(--gold)' : '') + '"><div class="ic">' + (i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1) + '</div><div class="tx"><b>' + esc(r.n) + ' <span class="dim small">' + CLASSES[r.c].icon + ' ' + CLASSES[r.c].name + '</span></b><span>Nível ' + r.l + ' · Poder ' + fmt(r.p) + (r.w ? ' · 🪽 T' + r.w : '') + '</span></div></div>');
      return h;
    },
    smith() {
      let h = this.tabsHTML('smith', [['enh', 'Reforçar'], ['forge', 'Forjar'], ['shop', 'Loja']]); const t = this.tab.smith;
      if (t === 'enh') {
        h += '<p class="dim small">Reforce equipamentos até +15. Cada nível dá +8% nos atributos base. A partir de +7, uma falha reduz 1 nível.</p><div class="grid">'; const list = [];
        for (const s of SLOTS) if (S.eq[s]) list.push(S.eq[s]); for (const it of S.inv) if (it && it.eq) list.push(it);
        list.forEach((e, i) => h += this.cellHTML(e, 'enhsel:' + i, this.sel.enh === e)); h += '</div>'; const e = list.includes(this.sel.enh) ? this.sel.enh : null;
        if (e) { h += '<div class="detail">' + this.itemHTML(e); if (e.enh >= 15) h += '<p class="gold">Reforço máximo.</p>'; else { const c = enhCost(e); h += '<p>+' + e.enh + ' → <b class="gold">+' + (e.enh + 1) + '</b> · Chance: <b class="' + (ENH_RATE[e.enh] >= 60 ? 'good' : 'bad') + '">' + ENH_RATE[e.enh] + '%</b></p><p>' + this.needHTML([['stone', c.stones]], c.gold) + '</p><div class="row"><button class="btn gold" data-act="enh">Reforçar</button></div>'; } h += '</div>'; }
        else h += '<p class="dim small c">Selecione um equipamento.</p>'; return h;
      }
      if (t === 'forge') {
        const pl = S.prof.smithing.l, T = this.tab.forgeT, r = forgeRecipe(T); h += '<p class="small">Forja: <b class="gold">Nv. ' + pl + '</b> <span class="dim">— itens forjados são no mínimo Incomuns, com mais chance de raridade alta.</span></p><div class="tabs">';
        for (let i = 1; i <= 7; i++) h += '<button class="tab' + (T === i ? ' on' : '') + '" data-act="forget:' + i + '">T' + i + (pl < tierReq(i) ? ' 🔒' : '') + '</button>';
        h += '</div><div class="detail"><h4>' + esc(ZONES[T].name) + ' — item nível ' + r.ilvl + '</h4><p>' + this.needHTML(r.need, r.gold) + '</p>' + (pl < r.lvl ? '<p class="bad">Requer Forja nível ' + r.lvl + '</p>' : '') + '<div class="row" style="margin-top:6px">';
        for (const s of SLOTS) h += '<button class="btn sm" data-act="forge:' + T + ':' + s + '">' + SLOT_ICON[s] + ' ' + SLOT_NAME[s] + '</button>';
        const sr = stoneRecipe(T); return h + '</div></div><div class="li"><div class="ic">💠</div><div class="tx"><b>Pedra de Reforço</b><span>' + this.needHTML(sr.need, sr.gold) + '</span></div><button class="btn sm" data-act="fstone:' + T + '">Criar</button></div>';
      }
      const il = ZONES[tierOfLevel(S.lvl)].lvl[0]; h += '<p class="dim small">Equipamentos Comuns de nível ' + il + '. Os melhores itens vêm de monstros, chefes e da Forja.</p>';
      for (const s of SLOTS) h += '<div class="li"><div class="ic">' + SLOT_ICON[s] + '</div><div class="tx"><b>' + SLOT_NAME[s] + ' ' + TIER_PREFIX[tierOfLevel(il)] + '</b><span>Comum · nível ' + il + '</span></div><button class="btn sm" data-act="buygear:' + s + '">' + fmt(gearPrice(il)) + ' 🪙</button></div>';
      return h;
    },
    alch() {
      let h = this.tabsHTML('alch', [['shop', 'Loja'], ['brew', 'Alquimia']]); if (this.tab.alch === 'shop') return h + this.potShopHTML();
      const pl = S.prof.alchemy.l; h += '<p class="small">Alquimia: <b class="gold">Nv. ' + pl + '</b></p>';
      ALCH.forEach((r, i) => { const d = ITEMS[r.out[0]]; h += '<div class="li" style="' + (pl >= r.lvl ? '' : 'opacity:.55') + '"><div class="ic">' + d.icon + '</div><div class="tx"><b>' + esc(d.name) + ' x' + r.out[1] + '</b><span>' + this.needHTML(r.need, r.gold) + '</span></div>' + (pl >= r.lvl ? '<button class="btn sm" data-act="brew:' + i + '">Preparar</button>' : '<span class="bad small">Nv. ' + r.lvl + '</span>') + '</div>'; });
      return h;
    },
    merchant() {
      let h = this.tabsHTML('merchant', [['sell', 'Vender'], ['buy', 'Comprar']]); if (this.tab.merchant === 'sell') return h + this.invHTML(true);
      for (const id of ['stone', 'scroll']) { const d = ITEMS[id]; h += '<div class="li"><div class="ic">' + d.icon + '</div><div class="tx"><b>' + d.name + '</b><span>' + d.desc + ' Você tem ' + countItem(id) + '.</span></div><button class="btn sm" data-act="buy:' + id + ':1">' + d.price + ' 🪙</button></div>'; }
      return h;
    },
    cash() {
      let h = '<div class="cashhead"><h2 class="cz">EM BREVE</h2><p style="margin:4px 0 0">A Loja de Cristais ainda não está aberta. Nenhuma compra com dinheiro real é possível no momento.</p><p class="small" style="margin:4px 0 0">Seu saldo: 💎 <b>' + (S.gems || 0) + '</b> Cristais</p></div>' + this.tabsHTML('cash', [['gems', '💎 Cristais'], ['items', '🎁 Itens e VIP']]);
      if (this.tab.cash === 'gems') { h += '<div class="packs">'; for (const p of CASH_PACKS) h += '<div class="pack soon"><div class="big">' + p.icon + '</div><b>' + fmt(p.gems) + ' Cristais</b>' + (p.bonus ? '<span class="good small">+' + p.bonus + ' bônus</span>' : '<span class="small">&nbsp;</span>') + '<p class="gold" style="margin:4px 0">' + p.price + '</p><button class="btn sm off" disabled>EM BREVE</button></div>'; return h + '</div><p class="dim small c">Pagamentos via Pix e cartão serão liberados em uma atualização futura.</p>'; }
      for (const it of CASH_ITEMS) h += '<div class="li soon"><div class="ic">' + it.icon + '</div><div class="tx"><b>' + it.name + '</b><span>' + it.desc + '</span></div><button class="btn sm off" disabled>💎 ' + it.gems + ' · EM BREVE</button></div>';
      return h;
    },
    settings() {
      return '<div class="li"><div class="ic">🔊</div><div class="tx"><b>Efeitos sonoros</b><span>' + (S.opts.sfx ? 'Ativados' : 'Desativados') + '</span></div><button class="btn sm" data-act="sfx">' + (S.opts.sfx ? 'Desligar' : 'Ligar') + '</button></div>' +
        '<div class="li"><div class="ic">💾</div><div class="tx"><b>Salvar agora</b><span>O jogo salva sozinho a cada 20 segundos' + (Net.db || Net.ws ? ' e também na nuvem.' : ' neste navegador.') + '</span></div><button class="btn sm" data-act="savenow">Salvar</button></div>' +
        '<div class="li"><div class="ic">🎓</div><div class="tx"><b>Tutorial</b><span>Rever o guia rápido do jogo.</span></div><button class="btn sm" data-act="tut:0">Ver</button></div>' +
        '<div class="li"><div class="ic">⛶</div><div class="tx"><b>Tela cheia</b><span>Recomendado no celular, em modo paisagem.</span></div><button class="btn sm" data-act="fs">Alternar</button></div>' +
        '<div class="detail small"><h4>Controles — PC</h4><p>WASD ou setas: andar · Clique: andar / atacar / interagir · Espaço: atacar o inimigo mais próximo · Tab: trocar alvo · 1–4: habilidades · Q / E: poção de vida / mana · F: interagir · Enter: chat · C I K L P O V M R: janelas · Esc: fechar</p><h4 style="margin-top:6px">Controles — Celular</h4><p>Joystick à esquerda para andar · ⚔ ataca o inimigo mais próximo · botões redondos: habilidades e poções · 🎯 troca de alvo · toque em NPCs, portais e recursos para interagir.</p></div>' +
        '<div class="li" style="margin-top:8px"><div class="ic">🗑️</div><div class="tx"><b>Apagar personagem</b><span>Começar do zero. Não pode ser desfeito.</span></div><button class="btn sm red" data-act="askreset">Apagar</button></div><p class="dim small c">Aetheria Online · v1.0</p>';
    },
  },

  /* ---------- Ações ---------- */
  acts: {
    toggle(id) { UI.toggle(id); }, close(id) { UI.close(id); }, closeModal() { UI.closeModal(); },
    tab(k, v) { UI.tab[k] = v; UI.sel.inv = -1; UI.dirty.win = 1; },
    invsel(i) { UI.sel.inv = UI.sel.inv === +i ? -1 : +i; UI.dirty.win = 1; }, eqsel(s) { UI.sel.eq = UI.sel.eq === s ? null : s; UI.dirty.win = 1; },
    equip() { equipInv(UI.sel.inv); UI.sel.inv = -1; }, unequip(s) { unequip(s); UI.sel.eq = null; },
    useinv() { const it = S.inv[UI.sel.inv]; if (it && !it.eq) useItemId(it.id); UI.dirty.win = 1; },
    sell(all) { sellInv(UI.sel.inv, all === '1'); if (!S.inv[UI.sel.inv]) UI.sel.inv = -1; }, selljunk() { sellJunk(); UI.sel.inv = -1; },
    drop() { const it = S.inv[UI.sel.inv]; if (!it) return; UI.modal('<h2>Descartar item?</h2><p>' + esc(itemName(it)) + (it.q > 1 ? ' x' + it.q : '') + ' será destruído.</p><div class="row"><button class="btn red" data-act="dropyes">Descartar</button><button class="btn ghost" data-act="closeModal">Cancelar</button></div>'); },
    dropyes() { S.inv[UI.sel.inv] = null; UI.sel.inv = -1; UI.closeModal(); UI.dirty.all = 1; },
    attr(k, n) { addAttr(k, +n); }, upskill(id) { upSkill(id); },
    accept(id) { acceptQuest(id); UI.dirty.win = 1; }, turnin(id) { turnInQuest(id); UI.dirty.all = 1; }, daily(i) { claimDaily(+i); UI.dirty.all = 1; },
    wunlock() { wingsUnlock(); }, wup() { wingsUpgrade(); }, tp(id) { teleportTo(+id); },
    enhsel(i) { const list = []; for (const s of SLOTS) if (S.eq[s]) list.push(S.eq[s]); for (const it of S.inv) if (it && it.eq) list.push(it); UI.sel.enh = list[+i] || null; UI.dirty.win = 1; },
    enh() { if (UI.sel.enh) enhance(UI.sel.enh); }, forget(t) { UI.tab.forgeT = +t; UI.dirty.win = 1; }, forge(t, s) { forge(+t, s); }, fstone(t) { forgeStone(+t); },
    buygear(s) { buyGear(s); }, buy(id, q) { if (ITEMS[id].req && S.lvl < ITEMS[id].req) { UI.toast('Requer nível ' + ITEMS[id].req + '.', 'bad'); return; } buyItem(id, +q); }, brew(i) { brew(+i); },
    respawn(t) { respawn(t === '1'); },
    skin(id) { equipSkin(id || null); }, admgrant(on) { const n = ($('admname').value || '').trim(); if (!n) { UI.toast('Digite o nome do personagem.', 'bad'); return; } Net.grant(n, $('admskin').value, on === '1'); },
    track(a, b) { toggleTrack(a + ':' + b); if (S.track && UI.touch) UI.closeAll(); }, tut(i) { UI.tutorial(+i); }, tutend() { S.tut = 1; UI.closeModal(); if (UI._pend) { $('modal').innerHTML = UI._pend; $('modal').classList.remove('hidden'); UI._pend = null; } },
    sfx() { S.opts.sfx = !S.opts.sfx; UI.dirty.win = 1; }, savenow() { saveAll(true); Net.pushRank(); UI.toast('Jogo salvo.', 'good'); },
    fs() { if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { } } else goFull(true); },
    askreset() { UI.modal('<h2>Apagar personagem?</h2><p>' + esc(S.name) + ' (nível ' + S.lvl + ') será apagado para sempre.</p><div class="row"><button class="btn red" data-act="resetyes">Apagar para sempre</button><button class="btn ghost" data-act="closeModal">Cancelar</button></div>'); },
    resetyes() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } const fresh = newSave(S.name, S.cls); fresh.t = Date.now(); Net.saveCloud(fresh); G.started = false; S = null; UI.closeAll(); $('hud').classList.add('hidden'); UI.title(null); },
    pickcls(c) { UI.cls = c; const n = $('newname'); UI._nm = n ? n.value : ''; UI.title(null, true); },
    create() { goFull(); const n = ($('newname').value || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 14); if (n.length < 3) { $('titleerr').textContent = 'Escolha um nome com pelo menos 3 letras.'; return; } Sfx.unlock(); startGame(newSave(n, UI.cls)); saveAll(true); },
    cont() { goFull(); Sfx.unlock(); startGame(UI._save); }, newchar() { UI.title(null, true); },
  },
  runAct(str) { const p = str.split(':'), f = this.acts[p[0]]; if (f) f.apply(null, p.slice(1)); },

  /* ---------- Tela de título ---------- */
  title(save, force) {
    this._save = save; const t = $('title'); t.classList.remove('hidden'); let h;
    if (save && !force) {
      const C = CLASSES[save.cls];
      h = '<div class="row"><canvas id="tprev" width="144" height="168" style="width:72px;height:84px"></canvas><div class="sp"><b class="cz gold" style="font-size:20px">' + esc(save.name) + '</b><br><span class="dim">' + C.icon + ' ' + C.name + ' · Nível ' + save.lvl + ' · ' + esc(ZONES[save.zone] ? ZONES[save.zone].name : '') + '</span></div></div><div class="row" style="margin-top:12px"><button class="btn gold" style="flex:1;font-size:17px;min-height:44px" data-act="cont">▶ Continuar aventura</button></div>';
    } else {
      h = '<b class="cz gold">Criar personagem</b><div class="classes">' + Object.keys(CLASSES).map(k => '<button class="cls' + (this.cls === k ? ' on' : '') + '" data-act="pickcls:' + k + '"><canvas data-cls="' + k + '" width="144" height="168"></canvas><b>' + CLASSES[k].name + '</b></button>').join('') + '</div><p class="small dim" style="margin:0 0 8px;min-height:2.6em">' + CLASSES[this.cls].desc + '</p><input id="newname" class="txt" maxlength="14" placeholder="Nome do personagem" value="' + esc(this._nm || '') + '"><p id="titleerr" class="bad small" style="margin:4px 0;min-height:1.2em"></p><div class="row"><button class="btn gold" style="flex:1;font-size:17px;min-height:44px" data-act="create">⚔ Entrar em Aetheria</button></div>' + (save ? '<p class="dim small c" style="margin:8px 0 0">Criar um novo personagem substitui o atual (' + esc(save.name) + ').</p>' : '');
    }
    $('titlebody').innerHTML = h; this.netStatus();
    const draw = (cv, cls, wings, skin) => { const g = cv.getContext('2d'); g.clearRect(0, 0, 144, 168); g.save(); g.translate(72, 150); g.scale(2.6, 2.6); drawHero(g, 0, 0, { cls, dir: 1, t: 1, wings, skin }); g.restore(); };
    document.querySelectorAll('#titlebody canvas[data-cls]').forEach(cv => draw(cv, cv.dataset.cls, 0)); if ($('tprev')) draw($('tprev'), save.cls, save.wings.t, save.skin);
  },
};
