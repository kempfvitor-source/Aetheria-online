#!/usr/bin/env node
'use strict';
/* ============================================================================
   AETHERIA ONLINE — servidor próprio, sem dependências (Node 18+).
   Uso:  node server.js            (porta 8080)   |   PORT=3000 node server.js

   Serve os arquivos do jogo, um WebSocket em /ws (jogadores em tempo real por zona,
   chat, saves na nuvem, ranking) e o PAINEL ADM em /admin (moderação + funil).

   Variáveis de ambiente:
     ADMIN_KEY     senha do ADM (painel /admin e comando /adm no chat do jogo)
     GITHUB_TOKEN  (opcional) token do GitHub com permissão "gist": guarda saves,
                   ranking, skins e estatísticas num Gist secreto, para nada se
                   perder quando o servidor gratuito dorme ou reinicia.
     GIST_ID       (opcional) usa um Gist específico em vez de procurar/criar.

   IMPORTANTE: este servidor é um "relay" — a lógica do jogo roda no navegador de
   cada jogador. Antes de ativar a loja de dinheiro real (CASH_ENABLED em
   js/data.js) é preciso mover a validação de itens/ouro/XP para o servidor e
   integrar um gateway de pagamento com confirmação no servidor (webhook).
   ============================================================================ */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = +process.env.PORT || 8080, ROOT = __dirname, SAVES = path.join(ROOT, 'saves');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(6).toString('hex');
const GH_TOKEN = process.env.GITHUB_TOKEN || '', GH_API = process.env.GITHUB_API || 'https://api.github.com', GIST_DESC = 'aetheria-online-data (nao apagar)';
const LIM = { events: 5000, sessions: 4000, chat: 400 };
fs.mkdirSync(SAVES, { recursive: true });

function validSave(s) { return s && s.v === 1 && typeof s.name === 'string' && s.name.length <= 16 && typeof s.cls === 'string' && s.lvl >= 1 && s.lvl <= 60 && Array.isArray(s.inv) && s.inv.length <= 200; }
function nameKey(n) { return [...String(n).toLowerCase().trim()].map(c => /[a-z0-9]/.test(c) ? c : '_' + c.codePointAt(0).toString(16)).join('').slice(0, 120) || '_'; }
const now = () => Date.now();
const qOrder = id => { const m = /^q(\d)_(\d)$/.exec(id); return m ? +m[1] * 10 + +m[2] : 999; };

/* ============================ Armazenamento ============================ */
// DB: tudo que o painel usa. SAVES: progresso de cada jogador (pid -> save).
let DB = { v: 2, players: {}, sessions: [], events: [], chat: [], grants: {}, bans: {}, ipBans: {}, settings: { maint: false, maintMsg: '', motd: '' }, started: now() };
let SAVEMAP = {};
const store = { mode: GH_TOKEN ? 'gist' : 'local', gistId: process.env.GIST_ID || null, dirty: false, savesDirty: false, lastSync: 0, lastErr: '', syncing: false, loaded: false, gistOk: false };

function loadLocal() {
  try { const d = JSON.parse(fs.readFileSync(path.join(SAVES, '_data.json'), 'utf8')); if (d && d.v === 2) DB = Object.assign(DB, d); } catch (e) { }
  try { const g = JSON.parse(fs.readFileSync(path.join(SAVES, '_grants.json'), 'utf8')); if (g && typeof g === 'object') DB.grants = Object.assign(g, DB.grants); } catch (e) { }
  for (const f of fs.readdirSync(SAVES)) if (f.endsWith('.json') && f[0] !== '_') { try { const s = JSON.parse(fs.readFileSync(path.join(SAVES, f), 'utf8')); if (validSave(s)) SAVEMAP[f.slice(0, -5)] = s; } catch (e) { } }
}
let localT = null;
function writeLocalSoon() {
  clearTimeout(localT);
  localT = setTimeout(() => { fs.writeFile(path.join(SAVES, '_data.json'), JSON.stringify(DB), () => { }); }, 1500);
}
function markDirty(saves) { store.dirty = true; if (saves) store.savesDirty = true; writeLocalSoon(); }

async function gh(method, url, body) {
  const r = await fetch(url.startsWith('http') ? url : GH_API + url, { method, headers: { Authorization: 'Bearer ' + GH_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'aetheria-online', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error('GitHub ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return url.includes('/raw/') || url.includes('gist.githubusercontent') ? r.text() : r.json();
}
async function gistFile(g, name) { const f = g.files && g.files[name]; if (!f) return null; return f.truncated ? gh('GET', f.raw_url) : f.content; }
async function loadGist() {
  if (!store.gistId) {
    for (let page = 1; page <= 5 && !store.gistId; page++) {
      const list = await gh('GET', '/gists?per_page=100&page=' + page); if (!list.length) break;
      const g = list.find(x => x.description === GIST_DESC); if (g) store.gistId = g.id;
    }
  }
  if (!store.gistId) {
    const g = await gh('POST', '/gists', { description: GIST_DESC, public: false, files: { 'data.json': { content: JSON.stringify(DB) }, 'saves.json': { content: JSON.stringify(SAVEMAP) } } });
    store.gistId = g.id; console.log('Gist de dados criado: ' + g.id); return;
  }
  const g = await gh('GET', '/gists/' + store.gistId);
  const d = await gistFile(g, 'data.json'), s = await gistFile(g, 'saves.json');
  const gd = d ? JSON.parse(d) : null, gs = s ? JSON.parse(s) : null;
  if (gd && gd.v === 2) mergeDB(gd);
  if (gs && typeof gs === 'object') for (const k in gs) if (validSave(gs[k]) && !(SAVEMAP[k] && (SAVEMAP[k].t || 0) > (gs[k].t || 0))) SAVEMAP[k] = gs[k];
}
// junta os dados do Gist com o que já existe localmente (o Gist é a base; o local acrescenta o que for mais novo)
function mergeDB(g) {
  const local = DB, out = Object.assign({}, local, g);
  out.players = Object.assign({}, g.players || {});
  for (const id in local.players) { const a = local.players[id], b = out.players[id]; if (!b || (a.last || 0) > (b.last || 0)) out.players[id] = b ? Object.assign({}, b, a, { play: Math.max(a.play, b.play), conn: Math.max(a.conn, b.conn), sess: Math.max(a.sess, b.sess) }) : a; }
  const after = (arr, key) => { const m = Math.max(0, ...(arr || []).map(x => x[key] || 0)); return m; };
  const join = (ga, la, key, lim) => { const m = after(ga, key); return (ga || []).concat((la || []).filter(x => (x[key] || 0) > m)).slice(-lim); };
  out.events = join(g.events, local.events, 'ts', LIM.events); out.sessions = join(g.sessions, local.sessions, 'e', LIM.sessions); out.chat = join(g.chat, local.chat, 'ts', LIM.chat);
  out.grants = Object.assign({}, local.grants, g.grants); out.bans = Object.assign({}, local.bans, g.bans); out.ipBans = Object.assign({}, local.ipBans, g.ipBans);
  out.started = Math.min(local.started || now(), g.started || now()); DB = out;
}
async function connectGist() {
  try { await Promise.race([loadGist(), new Promise((_, no) => setTimeout(() => no(new Error('tempo esgotado')), 20000))]); store.gistOk = true; store.lastErr = ''; console.log('Dados carregados do Gist ' + store.gistId); for (const id in SAVEMAP) { const p = player(id); if (!p.n) fromSave(p, SAVEMAP[id]); } return true; }
  catch (e) { store.lastErr = 'Não consegui ler o Gist (nada será enviado até conseguir, para não apagar dados): ' + String(e.message || e).slice(0, 160); console.error(store.lastErr); return false; }
}
setInterval(() => { if (store.mode === 'gist' && !store.gistOk) connectGist().then(ok => ok && sync(true)); }, 3 * 60 * 1000);
async function sync(force) {
  if (store.mode !== 'gist' || !store.gistOk || store.syncing || (!store.dirty && !force)) return;
  store.syncing = true; const saves = store.savesDirty; store.dirty = false; store.savesDirty = false;
  try {
    const files = { 'data.json': { content: JSON.stringify(DB) } }; if (saves || force) files['saves.json'] = { content: JSON.stringify(SAVEMAP) };
    await gh('PATCH', '/gists/' + store.gistId, { files }); store.lastSync = now(); store.lastErr = '';
  } catch (e) { store.dirty = true; if (saves) store.savesDirty = true; store.lastErr = String(e.message || e).slice(0, 200); console.error('Falha ao salvar no Gist:', store.lastErr); }
  store.syncing = false;
}
setInterval(() => sync(false), 90 * 1000);
async function shutdown() { console.log('Encerrando: salvando dados...'); for (const c of clients) endSession(c); try { fs.writeFileSync(path.join(SAVES, '_data.json'), JSON.stringify(DB)); } catch (e) { } store.syncing = false; await Promise.race([sync(true), new Promise(r => setTimeout(r, 20000))]); process.exit(0); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);

/* ============================ Jogadores e eventos ============================ */
function player(pid) {
  let p = DB.players[pid];
  if (!p) p = DB.players[pid] = { id: pid, n: '', c: '', first: now(), last: now(), lvl: 1, maxL: 1, z: 0, play: 0, conn: 0, sess: 0, zt: {}, q: {}, aq: [], done: 0, deaths: 0, kills: 0, gold: 0, w: 0, ev: {}, ban: 0, mute: 0, note: '' };
  return p;
}
function pushCap(arr, item, lim) { arr.push(item); if (arr.length > lim) arr.splice(0, arr.length - lim); }
function logEvent(p, e, d) { pushCap(DB.events, { ts: now(), p: p.id, n: p.n, e, d: d || {}, l: p.lvl, z: p.z }, LIM.events); p.ev[e] = (p.ev[e] || 0) + 1; markDirty(); }
function fromSave(p, s) {
  p.n = String(s.name).slice(0, 16); p.c = String(s.cls).slice(0, 12); p.lvl = s.lvl | 0; p.maxL = Math.max(p.maxL, p.lvl); p.gold = +s.gold || 0; p.w = (s.wings && s.wings.t) | 0;
  if (s.stats) { p.deaths = s.stats.deaths | 0; p.kills = s.stats.kills | 0; }
  if (s.quests) {
    const done = s.quests.done || {}, act = s.quests.active || {}; p.done = Object.keys(done).length; p.aq = Object.keys(act).filter(k => /^q\d_\d$/.test(k)).sort((a, b) => qOrder(a) - qOrder(b));
    for (const id in done) if (/^q\d_\d$/.test(id)) { const q = p.q[id] || (p.q[id] = {}); if (q.t == null) { q.t = -1; q.tt = q.tt || now(); } }
    for (const id of p.aq) if (!p.q[id]) p.q[id] = { a: p.play, at: now(), d0: p.deaths };
  }
}
const EV_OK = new Set(['start', 'lvl', 'zone', 'qa', 'qr', 'qt', 'death', 'boss', 'npc', 'enh', 'forge', 'brew', 'wings', 'tp', 'respawn']);
function cleanEv(d) {
  const o = {}; if (!d || typeof d !== 'object') return o;
  if (typeof d.q === 'string' && /^q\d_\d$/.test(d.q)) o.q = d.q;
  if (Number.isFinite(d.z)) o.z = Math.max(0, Math.min(20, d.z | 0));
  if (Number.isFinite(d.l)) o.l = Math.max(1, Math.min(60, d.l | 0));
  if (typeof d.m === 'string' && /^[a-z0-9_]{1,24}$/.test(d.m)) o.m = d.m;
  if (typeof d.k === 'string' && /^[a-z0-9_]{1,24}$/.test(d.k)) o.k = d.k;
  if (d.ok != null) o.ok = d.ok ? 1 : 0; if (d.nw) o.nw = 1;
  return o;
}
function onEvent(c, e, d) {
  const p = c.p; if (!p || !EV_OK.has(e)) return; d = cleanEv(d);
  if (e === 'zone' && d.z != null) p.z = d.z;
  if (e === 'lvl' && d.l) { p.lvl = d.l; p.maxL = Math.max(p.maxL, d.l); }
  if (e === 'death') p.deaths++;
  if (e === 'qa' && d.q) { p.q[d.q] = { a: p.play, at: now(), d0: p.deaths }; if (!p.aq.includes(d.q)) p.aq.push(d.q); p.aq.sort((a, b) => qOrder(a) - qOrder(b)); }
  if (e === 'qr' && d.q && p.q[d.q]) { p.q[d.q].r = p.play; }
  if (e === 'qt' && d.q) { const q = p.q[d.q] || (p.q[d.q] = { a: null, at: null, d0: p.deaths }); q.t = p.play; q.tt = now(); q.dd = q.d0 != null ? p.deaths - q.d0 : null; p.aq = p.aq.filter(x => x !== d.q); p.done++; }
  if (c.sess) { c.sess.last = e; c.sess.l1 = p.lvl; }
  logEvent(p, e, d);
}
function startSession(c) { c.sess = { p: c.p.id, s: now(), e: 0, act: 0, l0: c.p.lvl, l1: c.p.lvl, z: c.p.z, q: '', last: '' }; c.p.sess++; c.p.last = now(); }
function endSession(c) {
  const S = c.sess; if (!S) return; c.sess = null; const p = c.p;
  S.e = now(); S.l1 = p.lvl; S.z = p.z; S.q = p.aq[0] || ''; S.n = p.n;
  if (S.e - S.s > 3000) pushCap(DB.sessions, S, LIM.sessions);
  p.last = now(); markDirty();
}

/* ============================ HTTP + API do painel ============================ */
const tokens = new Map(), loginTries = new Map();
function ipOf(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
const ipHash = ip => crypto.createHash('sha256').update('aeth:' + ip).digest('hex').slice(0, 12);
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function readBody(req) { return new Promise((ok, no) => { let b = ''; req.on('data', d => { b += d; if (b.length > 20000) { no(new Error('grande')); req.destroy(); } }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); }); }
function authed(req) { const t = req.headers['x-adm'], s = t && tokens.get(t); if (!s || s < now()) { if (t) tokens.delete(t); return false; } return true; }
function safeEq(a, b) { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); }

async function api(req, res, p) {
  if (p === '/api/login' && req.method === 'POST') {
    const ip = ipOf(req), tr = (loginTries.get(ip) || []).filter(t => t > now() - 600000);
    if (tr.length >= 8) return json(res, 429, { err: 'Muitas tentativas. Espere 10 minutos.' });
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { err: 'pedido inválido' }); }
    if (!safeEq(b.key || '', ADMIN_KEY)) { tr.push(now()); loginTries.set(ip, tr); return json(res, 401, { err: 'Senha incorreta.' }); }
    const t = crypto.randomBytes(24).toString('hex'); tokens.set(t, now() + 12 * 3600e3); return json(res, 200, { token: t });
  }
  if (!authed(req)) return json(res, 401, { err: 'Faça login.' });
  if (p === '/api/state') {
    const online = [...clients].filter(c => c.p).map(c => ({ id: c.p.id, n: c.p.n, l: c.p.lvl, z: c.zone, since: c.sess ? c.sess.s : now(), idle: Math.round((now() - (c.lastSt || c.t0)) / 1000), admin: !!c.admin, ip: c.ipH }));
    return json(res, 200, {
      now: now(), online, players: DB.players, sessions: DB.sessions, events: DB.events.slice(-1500), chat: DB.chat, grants: DB.grants, settings: DB.settings, ipBans: DB.ipBans,
      server: { started: BOOT, dataSince: DB.started, mem: Math.round(process.memoryUsage().rss / 1048576), store: { mode: store.mode, ok: store.gistOk, gistId: store.gistId ? store.gistId.slice(0, 6) + '…' : null, lastSync: store.lastSync, err: store.lastErr, loaded: store.loaded }, node: process.version },
    });
  }
  if (p === '/api/player') { const id = new URL(req.url, 'http://x').searchParams.get('id'); const pl = DB.players[id]; if (!pl) return json(res, 404, { err: 'não encontrado' }); return json(res, 200, { player: pl, events: DB.events.filter(e => e.p === id).slice(-400), sessions: DB.sessions.filter(s => s.p === id).slice(-100), save: SAVEMAP[id] ? { gold: SAVEMAP[id].gold, lvl: SAVEMAP[id].lvl, skins: SAVEMAP[id].skins || {}, played: SAVEMAP[id].stats && SAVEMAP[id].stats.played } : null }); }
  if (p === '/api/action' && req.method === 'POST') {
    let b; try { b = await readBody(req); } catch (e) { return json(res, 400, { err: 'pedido inválido' }); }
    try { const r = adminAction(b); return json(res, 200, Object.assign({ ok: true }, r)); } catch (e) { return json(res, 400, { err: String(e.message || e) }); }
  }
  json(res, 404, { err: 'rota desconhecida' });
}
const sendTo = (pid, obj) => { let n = 0; for (const c of clients) if (c.pid === pid) { wsSend(c.sock, obj); n++; } return n; };
const txt = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n || 200);
function adminAction(b) {
  const a = b.a, pid = typeof b.pid === 'string' ? b.pid : '', pl = DB.players[pid];
  const needP = () => { if (!pl) throw new Error('Jogador não encontrado.'); };
  const admLog = (what, d) => { if (pl) logEvent(pl, 'adm', Object.assign({ k: what }, d)); else markDirty(); };
  switch (a) {
    case 'announce': { const m = txt(b.msg, 200); if (!m) throw new Error('Mensagem vazia.'); for (const c of clients) wsSend(c.sock, { t: 'admmsg', m, kind: 'all' }); pushCap(DB.chat, { ts: now(), p: 'adm', n: 'ADM', m, k: 2 }, LIM.chat); markDirty(); return { sent: clients.size }; }
    case 'whisper': { needP(); const m = txt(b.msg, 200); if (!m) throw new Error('Mensagem vazia.'); const n = sendTo(pid, { t: 'admmsg', m, kind: 'pm' }); if (!n) throw new Error('Jogador não está online.'); admLog('msg'); return {}; }
    case 'kick': { needP(); const n = sendTo(pid, { t: 'kicked', m: txt(b.msg, 200) || 'Você foi desconectado por um ADM.' }); for (const c of clients) if (c.pid === pid) setTimeout(() => c.sock.destroy(), 300); if (!n) throw new Error('Jogador não está online.'); admLog('kick'); return {}; }
    case 'ban': {
      needP(); pl.ban = b.on ? 1 : 0; pl.banMsg = txt(b.msg, 200);
      if (b.on) { for (const c of clients) if (c.pid === pid) { if (c.ipH && b.ip) DB.ipBans[c.ipH] = { pid, n: pl.n, ts: now() }; wsSend(c.sock, { t: 'kicked', m: 'Você foi banido.' + (pl.banMsg ? ' Motivo: ' + pl.banMsg : ''), ban: 1 }); setTimeout(() => c.sock.destroy(), 300); } if (b.ip && pl.ip) DB.ipBans[pl.ip] = { pid, n: pl.n, ts: now() }; }
      else { for (const h in DB.ipBans) if (DB.ipBans[h].pid === pid) delete DB.ipBans[h]; }
      admLog(b.on ? 'ban' : 'unban'); return {};
    }
    case 'mute': { needP(); pl.mute = b.on ? 1 : 0; sendTo(pid, { t: 'admmsg', m: b.on ? 'Você foi silenciado no chat por um ADM.' : 'Seu chat foi liberado.', kind: 'pm' }); admLog(b.on ? 'mute' : 'unmute'); return {}; }
    case 'give': {
      needP(); const g = { gold: Math.max(0, Math.min(1e7, +b.gold | 0)), xp: Math.max(0, Math.min(1e8, +b.xp | 0)), item: /^[a-z0-9_]{1,16}$/.test(b.item || '') ? b.item : '', q: Math.max(1, Math.min(999, +b.q | 0 || 1)) };
      if (!g.gold && !g.xp && !g.item) throw new Error('Nada para dar.'); const n = sendTo(pid, { t: 'admcmd', c: 'give', g, m: txt(b.msg, 120) }); if (!n) throw new Error('Jogador precisa estar online para receber.'); admLog('give', { k: 'give' }); return {};
    }
    case 'tp': { needP(); const z = Math.max(0, Math.min(20, +b.z | 0)); if (!sendTo(pid, { t: 'admcmd', c: 'tp', z })) throw new Error('Jogador não está online.'); admLog('tp', { z }); return {}; }
    case 'heal': { needP(); if (!sendTo(pid, { t: 'admcmd', c: 'heal' })) throw new Error('Jogador não está online.'); admLog('heal'); return {}; }
    case 'skin': {
      const name = txt(b.name || (pl && pl.n), 16), skin = String(b.skin || ''); if (!name || !/^[a-z0-9_]{1,24}$/.test(skin)) throw new Error('Dados inválidos.');
      grant(name, skin, !!b.on); return {};
    }
    case 'note': { needP(); pl.note = txt(b.text, 500); markDirty(); return {}; }
    case 'maint': { DB.settings.maint = !!b.on; DB.settings.maintMsg = txt(b.msg, 200); if (b.on && b.kick) for (const c of clients) if (!c.admin) { wsSend(c.sock, { t: 'kicked', m: DB.settings.maintMsg || 'Servidor em manutenção. Volte daqui a pouco!' }); setTimeout(() => c.sock.destroy(), 300); } markDirty(); return {}; }
    case 'motd': { DB.settings.motd = txt(b.msg, 200); markDirty(); return {}; }
    case 'unbanip': { delete DB.ipBans[String(b.h)]; markDirty(); return {}; }
    case 'forget': { needP(); if (b.confirm !== pl.n) throw new Error('Confirmação incorreta.'); delete DB.players[pid]; DB.events = DB.events.filter(e => e.p !== pid); DB.sessions = DB.sessions.filter(s => s.p !== pid); markDirty(); return {}; }
    case 'wipeStats': { if (b.confirm !== 'APAGAR') throw new Error('Digite APAGAR para confirmar.'); DB.events = []; DB.sessions = []; DB.chat = []; for (const id in DB.players) { const q = DB.players[id]; q.play = 0; q.conn = 0; q.sess = 0; q.zt = {}; q.q = {}; q.ev = {}; q.first = now(); if (SAVEMAP[id]) fromSave(q, SAVEMAP[id]); } DB.started = now(); markDirty(); return {}; }
    case 'sync': { sync(true); return {}; }
  }
  throw new Error('Ação desconhecida.');
}
function grant(name, skin, on) {
  const nk = nameKey(name); DB.grants[nk] = DB.grants[nk] || {}; if (on) DB.grants[nk][skin] = 1; else delete DB.grants[nk][skin];
  for (const o of clients) if (o.nk === nk) wsSend(o.sock, { t: 'skins', skins: DB.grants[nk] }); markDirty();
}

const BOOT = now();
const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (p.startsWith('/api/')) return api(req, res, p).catch(e => json(res, 500, { err: 'erro interno' }));
  if (p === '/healthz') return json(res, 200, { ok: true, loaded: store.loaded });
  if (p === '/') p = '/index.html'; if (p === '/admin' || p === '/admin/') p = '/admin.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep) || file.startsWith(SAVES) || path.basename(file) === 'server.js' || path.basename(file).startsWith('.') || file.includes(path.sep + '.')) { res.writeHead(403); return res.end('Proibido'); }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end('Não encontrado'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(data); });
});

/* ============================ WebSocket mínimo (RFC 6455) ============================ */
const clients = new Set();
function wsSend(sock, obj) {
  if (sock.destroyed) return; const data = Buffer.from(JSON.stringify(obj)), n = data.length; let head;
  if (n < 126) head = Buffer.from([0x81, n]); else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(n, 2); } else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  try { sock.write(Buffer.concat([head, data])); } catch (e) { }
}
server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (req.url.split('?')[0] !== '/ws' || !key) return sock.destroy();
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64') + '\r\n\r\n');
  const c = { sock, pid: null, p: null, zone: -1, s: null, lastChat: 0, saveT: null, t0: now(), lastSt: 0, evN: 0, evT: now(), ipH: ipHash(ipOf(req)) }; let buf = Buffer.alloc(0);
  sock.setNoDelay(true);
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]); if (buf.length > 1 << 20) return sock.destroy();
    for (;;) {
      if (buf.length < 2) return; const op = buf[0] & 15, masked = buf[1] & 128; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 600000) return sock.destroy(); const need = off + (masked ? 4 : 0) + len; if (buf.length < need) return;
      let payload = buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const m = buf.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      buf = buf.subarray(need);
      if (op === 8) return sock.destroy(); if (op === 9) { try { sock.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); } catch (e) { } continue; }
      if (op === 1) { let m; try { m = JSON.parse(payload.toString('utf8')); } catch (e) { continue; } try { onMsg(c, m); } catch (e) { console.error('msg', e); } }
    }
  });
  let gone = false;
  const bye = () => { if (gone) return; gone = true; clients.delete(c); if (c.p) endSession(c); if (![...clients].some(o => o.p)) setTimeout(() => { if (![...clients].some(o => o.p)) sync(false); }, 4000); };
  sock.on('close', bye); sock.on('error', bye); sock.on('end', bye);
});

function onMsg(c, m) {
  if (m.t === 'hello') {
    if (c.pid || typeof m.id !== 'string' || m.id.length < 8 || m.id.length > 80) return c.sock.destroy();
    const pid = crypto.createHash('sha256').update(m.id).digest('hex').slice(0, 16), known = DB.players[pid];
    if ((known && known.ban) || DB.ipBans[c.ipH]) { wsSend(c.sock, { t: 'kicked', m: 'Você foi banido deste servidor.' + (known && known.banMsg ? ' Motivo: ' + known.banMsg : ''), ban: 1 }); return setTimeout(() => c.sock.destroy(), 300); }
    if (DB.settings.maint && !(typeof m.adm === 'string' && safeEq(m.adm, ADMIN_KEY))) { wsSend(c.sock, { t: 'kicked', m: DB.settings.maintMsg || 'Servidor em manutenção. Volte daqui a pouco!' }); return setTimeout(() => c.sock.destroy(), 300); }
    c.pid = pid; c.p = player(pid); c.p.ip = c.ipH; clients.add(c);
    const save = SAVEMAP[pid] || null; if (save && !c.p.n) fromSave(c.p, save);
    startSession(c); markDirty();
    return wsSend(c.sock, { t: 'welcome', pid, save, motd: DB.settings.motd || '' });
  }
  if (!c.pid) return;
  if (m.t === 'st' && m.s && typeof m.s === 'object') {
    const s = m.s; c.zone = m.z | 0; c.lastSt = now(); const nk = nameKey(s.n || '?'); if (c.nk !== nk) { c.nk = nk; wsSend(c.sock, { t: 'skins', skins: DB.grants[nk] || {} }); }
    c.s = { n: String(s.n || '?').slice(0, 16), c: String(s.c || 'warrior').slice(0, 12), l: Math.max(1, Math.min(60, s.l | 0)), x: Math.round(+s.x || 0), y: Math.round(+s.y || 0), d: s.d < 0 ? -1 : 1, w: Math.max(0, Math.min(10, s.w | 0)), a: s.a | 0, dead: s.dead ? 1 : 0, sk: typeof s.sk === 'string' && /^[a-z0-9_]{1,24}$/.test(s.sk) ? s.sk : '' };
    const p = c.p; if (p.n !== c.s.n) { p.n = c.s.n; markDirty(); } p.c = c.s.c; if (c.s.l > p.lvl) { p.lvl = c.s.l; p.maxL = Math.max(p.maxL, p.lvl); } if (c.zone >= 0) p.z = c.zone;
  } else if (m.t === 'chat' && typeof m.m === 'string') {
    const t = now(); if (t - c.lastChat < 700) return; c.lastChat = t;
    if (c.p.mute) return wsSend(c.sock, { t: 'admmsg', m: 'Você está silenciado e não pode usar o chat.', kind: 'pm' });
    const out = { t: 'chat', id: c.pid, n: c.s ? c.s.n : '?', m: m.m.replace(/[\u0000-\u001f]/g, '').slice(0, 140), k: m.k ? 1 : 0 };
    for (const o of clients) wsSend(o.sock, out);
    pushCap(DB.chat, { ts: t, p: c.pid, n: out.n, m: out.m, k: out.k }, LIM.chat); markDirty();
  } else if (m.t === 'save' && validSave(m.s)) {
    const js = JSON.stringify(m.s); if (js.length > 300000) return;
    SAVEMAP[c.pid] = m.s; fromSave(c.p, m.s); clearTimeout(c.saveT);
    c.saveT = setTimeout(() => fs.writeFile(path.join(SAVES, c.pid + '.json'), js, () => { }), 500); markDirty(true);
  } else if (m.t === 'ev' && typeof m.e === 'string') {
    const t = now(); if (t - c.evT > 10000) { c.evT = t; c.evN = 0; } if (++c.evN > 40) return; onEvent(c, m.e, m.d);
  } else if (m.t === 'adm') {
    c.admin = typeof m.key === 'string' && safeEq(m.key, ADMIN_KEY); wsSend(c.sock, { t: 'adm', ok: c.admin });
  } else if (m.t === 'grant') {
    const name = String(m.name || '').slice(0, 16), skin = String(m.skin || '');
    if (!c.admin) return wsSend(c.sock, { t: 'granted', ok: false, err: 'apenas ADM' });
    if (!name || !/^[a-z0-9_]{1,24}$/.test(skin)) return wsSend(c.sock, { t: 'granted', ok: false, err: 'dados inválidos' });
    grant(name, skin, !!m.on); wsSend(c.sock, { t: 'granted', ok: true, name, on: !!m.on });
  } else if (m.t === 'rank') {
    const list = Object.entries(SAVEMAP).filter(([id]) => !(DB.players[id] && DB.players[id].ban)).map(([id, s]) => ({ id, n: String(s.name).slice(0, 16), c: String(s.cls), l: s.lvl | 0, xp: +s.xp || 0, p: s.power | 0, w: (s.wings && s.wings.t) | 0 })).sort((a, b) => b.l - a.l || b.xp - a.xp).slice(0, 50);
    wsSend(c.sock, { t: 'rank', list });
  }
}
// posições por zona (10x/s)
setInterval(() => {
  const zones = new Map(); for (const c of clients) if (c.s) { if (!zones.has(c.zone)) zones.set(c.zone, []); zones.get(c.zone).push(c); }
  for (const [z, arr] of zones) { const list = arr.slice(0, 80).map(c => [c.pid, c.s]); for (const c of arr) wsSend(c.sock, { t: 'peers', z, list, on: clients.size }); }
}, 100);
// tempo de jogo: "ativo" = mexeu/agiu no último minuto
setInterval(() => {
  const t = now(), seen = new Set();
  for (const c of clients) {
    if (!c.p || seen.has(c.pid)) continue; seen.add(c.pid); const p = c.p; p.conn += 5; p.last = t;
    if (c.lastSt && t - c.lastSt < 60000) { p.play += 5; const z = c.zone >= 0 ? c.zone : p.z; p.zt[z] = (p.zt[z] || 0) + 5; if (c.sess) c.sess.act += 5; }
  }
  if (seen.size) markDirty();
}, 5000);

/* ============================ Início ============================ */
(async () => {
  loadLocal();
  if (store.mode === 'gist') { for (let i = 0; i < 3 && !(await connectGist()); i++) await new Promise(r => setTimeout(r, 4000)); }
  store.loaded = true;
  for (const id in SAVEMAP) { const p = player(id); if (!p.n) fromSave(p, SAVEMAP[id]); }
  server.listen(PORT, () => {
    console.log('Aetheria Online rodando em http://localhost:' + PORT);
    console.log('Painel ADM: http://localhost:' + PORT + '/admin');
    console.log(process.env.ADMIN_KEY ? 'Chave de ADM: definida pela variável ADMIN_KEY.' : 'Chave de ADM (temporária): ' + ADMIN_KEY + '  — defina ADMIN_KEY para fixar.');
    console.log('Armazenamento: ' + (store.mode === 'gist' ? (store.gistOk ? 'Gist do GitHub (permanente)' : 'Gist do GitHub INDISPONÍVEL — tentando de novo a cada 3 min') : 'arquivos locais (somem quando o servidor gratuito reinicia)'));
  });
})();
