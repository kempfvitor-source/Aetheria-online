#!/usr/bin/env node
'use strict';
/* ============================================================================
   AETHERIA ONLINE — servidor próprio (opcional), sem dependências.
   Uso:  node server.js            (porta 8080)   |   PORT=3000 node server.js
   Serve os arquivos do jogo e um WebSocket em /ws para: jogadores em tempo real
   por zona, chat global, saves na nuvem (pasta ./saves) e ranking.

   IMPORTANTE: este servidor é um "relay" — a lógica do jogo roda no navegador de
   cada jogador. Antes de ativar a loja de dinheiro real (CASH_ENABLED em
   js/data.js) é preciso mover a validação de itens/ouro/XP para o servidor e
   integrar um gateway de pagamento com confirmação no servidor (webhook).
   ============================================================================ */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = +process.env.PORT || 8080, ROOT = __dirname, SAVES = path.join(ROOT, 'saves');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };
fs.mkdirSync(SAVES, { recursive: true });

const rank = new Map(); // pid -> linha do ranking
for (const f of fs.readdirSync(SAVES)) if (f.endsWith('.json') && f[0] !== '_') { try { const s = JSON.parse(fs.readFileSync(path.join(SAVES, f), 'utf8')); rank.set(f.slice(0, -5), rankRow(s)); } catch (e) { } }
function rankRow(s) { return { n: String(s.name).slice(0, 16), c: String(s.cls), l: s.lvl | 0, xp: +s.xp || 0, p: s.power | 0, w: (s.wings && s.wings.t) | 0 }; }
function validSave(s) { return s && s.v === 1 && typeof s.name === 'string' && s.name.length <= 16 && typeof s.cls === 'string' && s.lvl >= 1 && s.lvl <= 60 && Array.isArray(s.inv) && s.inv.length <= 200; }

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep) || file.startsWith(SAVES) || path.basename(file) === 'server.js') { res.writeHead(403); return res.end('Proibido'); }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end('Não encontrado'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data); });
});

/* ---------- ADM e skins ----------
   Defina a chave com a variável ADMIN_KEY (ex.: ADMIN_KEY=minhasenha node server.js).
   No jogo, digite no chat:  /adm minhasenha   e depois   /skin dar NomeDoJogador godslayer */
const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(6).toString('hex');
const GRANTS_FILE = path.join(SAVES, '_grants.json'); let grants = {};
try { grants = JSON.parse(fs.readFileSync(GRANTS_FILE, 'utf8')); } catch (e) { }
function nameKey(n) { return [...String(n).toLowerCase().trim()].map(c => /[a-z0-9]/.test(c) ? c : '_' + c.codePointAt(0).toString(16)).join('').slice(0, 120) || '_'; }

/* ---------- WebSocket mínimo (RFC 6455) ---------- */
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
  const c = { sock, pid: null, zone: -1, s: null, lastChat: 0, saveT: null }; let buf = Buffer.alloc(0);
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
      if (op === 1) { let m; try { m = JSON.parse(payload.toString('utf8')); } catch (e) { continue; } try { onMsg(c, m); } catch (e) { } }
    }
  });
  const bye = () => { clients.delete(c); };
  sock.on('close', bye); sock.on('error', bye);
});

function onMsg(c, m) {
  if (m.t === 'hello') {
    if (typeof m.id !== 'string' || m.id.length < 8 || m.id.length > 80) return c.sock.destroy();
    c.pid = crypto.createHash('sha256').update(m.id).digest('hex').slice(0, 16); clients.add(c);
    let save = null; try { save = JSON.parse(fs.readFileSync(path.join(SAVES, c.pid + '.json'), 'utf8')); } catch (e) { }
    return wsSend(c.sock, { t: 'welcome', pid: c.pid, save });
  }
  if (!c.pid) return;
  if (m.t === 'st' && m.s && typeof m.s === 'object') {
    const s = m.s; c.zone = m.z | 0; const nk = nameKey(s.n || '?'); if (c.nk !== nk) { c.nk = nk; wsSend(c.sock, { t: 'skins', skins: grants[nk] || {} }); }
    c.s = { n: String(s.n || '?').slice(0, 16), c: String(s.c || 'warrior').slice(0, 12), l: Math.max(1, Math.min(60, s.l | 0)), x: Math.round(+s.x || 0), y: Math.round(+s.y || 0), d: s.d < 0 ? -1 : 1, w: Math.max(0, Math.min(10, s.w | 0)), a: s.a | 0, dead: s.dead ? 1 : 0, sk: typeof s.sk === 'string' && /^[a-z0-9_]{1,24}$/.test(s.sk) ? s.sk : '' };
  } else if (m.t === 'chat' && typeof m.m === 'string') {
    const now = Date.now(); if (now - c.lastChat < 700) return; c.lastChat = now;
    const out = { t: 'chat', id: c.pid, n: c.s ? c.s.n : '?', m: m.m.replace(/[\u0000-\u001f]/g, '').slice(0, 140), k: m.k ? 1 : 0 };
    for (const o of clients) wsSend(o.sock, out);
  } else if (m.t === 'save' && validSave(m.s)) {
    const js = JSON.stringify(m.s); if (js.length > 300000) return;
    rank.set(c.pid, rankRow(m.s)); clearTimeout(c.saveT);
    c.saveT = setTimeout(() => fs.writeFile(path.join(SAVES, c.pid + '.json'), js, () => { }), 500);
  } else if (m.t === 'adm') {
    c.admin = typeof m.key === 'string' && m.key.length === ADMIN_KEY.length && crypto.timingSafeEqual(Buffer.from(m.key), Buffer.from(ADMIN_KEY)); wsSend(c.sock, { t: 'adm', ok: c.admin });
  } else if (m.t === 'grant') {
    const name = String(m.name || '').slice(0, 16), skin = String(m.skin || '');
    if (!c.admin) return wsSend(c.sock, { t: 'granted', ok: false, err: 'apenas ADM' });
    if (!name || !/^[a-z0-9_]{1,24}$/.test(skin)) return wsSend(c.sock, { t: 'granted', ok: false, err: 'dados inválidos' });
    const nk = nameKey(name); grants[nk] = grants[nk] || {}; if (m.on) grants[nk][skin] = 1; else delete grants[nk][skin];
    fs.writeFile(GRANTS_FILE, JSON.stringify(grants), () => { });
    for (const o of clients) if (o.nk === nk) wsSend(o.sock, { t: 'skins', skins: grants[nk] });
    wsSend(c.sock, { t: 'granted', ok: true, name, on: !!m.on });
  } else if (m.t === 'rank') {
    const list = [...rank.entries()].map(([id, r]) => Object.assign({ id }, r)).sort((a, b) => b.l - a.l || b.xp - a.xp).slice(0, 50);
    wsSend(c.sock, { t: 'rank', list });
  }
}
setInterval(() => {
  const zones = new Map(); for (const c of clients) if (c.s) { if (!zones.has(c.zone)) zones.set(c.zone, []); zones.get(c.zone).push(c); }
  for (const [z, arr] of zones) { const list = arr.slice(0, 80).map(c => [c.pid, c.s]); for (const c of arr) wsSend(c.sock, { t: 'peers', z, list, on: clients.size }); }
}, 100);

server.listen(PORT, () => console.log('Aetheria Online rodando em http://localhost:' + PORT + '\nChave de ADM: ' + ADMIN_KEY + '  (no chat do jogo: /adm ' + ADMIN_KEY + ')'));
