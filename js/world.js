'use strict';
/* ============ Geração procedural das zonas (determinística: igual para todos os jogadores) ============ */
const T_G = 0, T_G2 = 1, T_PATH = 2, T_WATER = 3, T_CLIFF = 4, T_FLOOR = 5;

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fnoise(x, y, s) { return vnoise(x, y, s) * 0.65 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.35; }

const WORLD_CACHE = {};
function getWorld(id) { return WORLD_CACHE[id] || (WORLD_CACHE[id] = genWorld(id)); }

function genWorld(id) {
  const Z = ZONES[id], w = Z.w, h = Z.h, R = mulberry(1337 + id * 7919);
  const W = { id, Z, w, h, tiles: new Uint8Array(w * h), solid: new Uint8Array(w * h), objs: [], nodes: [], spawns: [], npcs: [], portals: [], keep: new Uint8Array(w * h) };
  const I = (x, y) => y * w + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const set = (x, y, t, keep) => { if (inb(x, y)) { W.tiles[I(x, y)] = t; if (keep) W.keep[I(x, y)] = 1; } };
  const disc = (cx, cy, r, t) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, t, true); };
  const line = (x0, y0, x1, y1, r, t) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2); for (let i = 0; i <= n; i++) disc(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, r, t); };
  const addNpc = (key, tx, ty) => W.npcs.push({ key, def: NPCS[key], x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });

  if (Z.theme === 'town') {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) W.tiles[I(x, y)] = fnoise(x / 5, y / 5, 11) > 0.55 ? T_G2 : T_G;
    const cx = 23, cy = 19;
    for (let y = 16; y <= 22; y++) for (let x = 4; x <= 8; x++) if ((x - 6) ** 2 / 5 + (y - 19) ** 2 / 9 <= 1) set(x, y, T_WATER);
    line(10, cy, 43, cy, 1.2, T_PATH); line(cx, 9, cx, 30, 1.2, T_PATH);
    const spots = { quest: [23, 9], smith: [11, 13], alch: [35, 13], merchant: [11, 30], wings: [35, 30], cash: [29, 23] };
    line(11, 13, 17, 16, 0.9, T_PATH); line(35, 13, 29, 16, 0.9, T_PATH); line(11, 30, 17, 23, 0.9, T_PATH); line(35, 30, 29, 23, 0.9, T_PATH);
    disc(cx, cy, 6.6, T_FLOOR);
    for (const k in spots) { disc(spots[k][0], spots[k][1], 1.6, T_FLOOR); addNpc(k, spots[k][0], spots[k][1]); }
    W.npcs.push({ key: 'tele', def: NPCS.tele, x: (cx + 0.5) * TILE, y: (cy + 0.5) * TILE });
    const houses = [[20, 3, 7, 4, '#7a4fd0'], [8, 8, 6, 4, '#a0522d'], [33, 8, 6, 4, '#2f9a8a'], [8, 25, 6, 4, '#c08a2a'], [33, 25, 6, 4, '#d8d8f0']];
    for (const [hx, hy, hw, hh, c] of houses) {
      for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) { W.solid[I(x, y)] = 1; W.keep[I(x, y)] = 1; }
      W.objs.push({ type: 'house', x: (hx + hw / 2) * TILE, y: (hy + hh) * TILE, w: hw * TILE, h: hh * TILE, c });
    }
    W.objs.push({ type: 'stall', x: 30.5 * TILE, y: 22.2 * TILE });
    W.entry = { x: 23.5 * TILE, y: 22.5 * TILE }; W.exit = { x: 42.5 * TILE, y: 19.5 * TILE };
    W.portals.push({ x: 43.5 * TILE, y: 19.5 * TILE, to: 1 });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y), i = I(x, y);
      if (W.tiles[i] === T_WATER) { W.solid[i] = 1; continue; }
      if (W.keep[i]) continue;
      if (edge < 2 || (edge < 4 && R() < 0.6)) { if (!(x > 38 && Math.abs(y - 19) < 3)) { W.solid[i] = 1; W.objs.push({ type: 'tree', x: (x + 0.5) * TILE, y: (y + 0.8) * TILE, v: R() < 0.5 ? 0 : 1, s: 0.9 + R() * 0.4 }); } }
      else if (R() < 0.05) W.objs.push({ type: 'deco', x: (x + R()) * TILE, y: (y + R()) * TILE, v: Math.floor(R() * 4) });
      else if (R() < 0.012 && (x - cx) ** 2 + (y - cy) ** 2 > 90) { W.solid[i] = 1; W.objs.push({ type: 'tree', x: (x + 0.5) * TILE, y: (y + 0.8) * TILE, v: 1, s: 1 }); }
    }
  } else {
    const p1 = R() * 6, p2 = R() * 6, mid = h / 2;
    const py = x => mid + Math.sin(x * 0.085 + p1) * 9 + Math.sin(x * 0.21 + p2) * 3.5;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n1 = fnoise(x / 10, y / 10, id * 31 + 1), n2 = fnoise(x / 7, y / 7, id * 31 + 2), n3 = fnoise(x / 5, y / 5, id * 31 + 3);
      let t = n3 > 0.55 ? T_G2 : T_G;
      if (n1 < 0.3) t = T_WATER; else if (n2 > 0.71) t = T_CLIFF;
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y); if (edge < 2) t = T_CLIFF;
      W.tiles[I(x, y)] = t;
    }
    for (let x = 3; x <= w - 4; x++) disc(x, py(x), 1.25, T_PATH);
    const ex = 4, ey = Math.round(py(4)), xx = w - 5, xy = Math.round(py(w - 5));
    disc(ex + 2, ey, 4.5, T_G); disc(xx - 1, xy, 3.5, T_G);
    for (let x = 3; x <= 12; x++) disc(x, py(x), 1.25, T_PATH);
    const ax = Math.floor(w * 0.68), ay = py(ax) < mid ? h - 11 : 10;
    line(ax, py(ax), ax, ay, 1.1, T_PATH); disc(ax, ay, 6.5, T_FLOOR);
    W.boss = { x: (ax + 0.5) * TILE, y: (ay + 0.5) * TILE, tx: ax, ty: ay };
    W.entry = { x: (ex + 2.5) * TILE, y: (ey + 0.5) * TILE }; W.exit = { x: (xx - 1.5) * TILE, y: (xy + 0.5) * TILE };
    W.portals.push({ x: (ex - 0.5) * TILE, y: (ey + 0.5) * TILE, to: id - 1 });
    if (id < ZONES.length - 1) W.portals.push({ x: (xx + 0.9) * TILE, y: (xy + 0.5) * TILE, to: id + 1 });
    addNpc('scout', ex + 3, ey - 3); W.npcs.push({ key: 'tele', def: NPCS.tele, x: (ex + 3.5) * TILE, y: (ey + 3.5) * TILE });
    W.keep[I(ex + 3, ey - 3)] = 1; W.keep[I(ex + 3, ey + 3)] = 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = I(x, y), t = W.tiles[i];
      if (t === T_WATER || t === T_CLIFF) { W.solid[i] = 1; continue; }
      if (W.keep[i] || t === T_PATH || t === T_FLOOR) continue;
      const n4 = fnoise(x / 6, y / 6, id * 31 + 4), r = R();
      if (n4 > 0.5 && r < 0.2) { W.solid[i] = 1; W.objs.push({ type: 'tree', x: (x + 0.5) * TILE, y: (y + 0.8) * TILE, v: R() < 0.5 ? 0 : 1, s: 0.9 + R() * 0.45 }); }
      else if (r > 0.985) { W.solid[i] = 1; W.objs.push({ type: 'rock', x: (x + 0.5) * TILE, y: (y + 0.75) * TILE, v: R() < 0.5 ? 0 : 1, s: 0.8 + R() * 0.5 }); }
      else if (r > 0.9) W.objs.push({ type: 'deco', x: (x + R()) * TILE, y: (y + R()) * TILE, v: Math.floor(R() * 4) });
    }
  }
  // alcance por flood-fill a partir da entrada
  const reach = new Uint8Array(w * h), st = [I(Math.floor(W.entry.x / TILE), Math.floor(W.entry.y / TILE))];
  reach[st[0]] = 1;
  while (st.length) {
    const i = st.pop(), x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = I(nx, ny); if (!reach[j] && !W.solid[j]) { reach[j] = 1; st.push(j); } }
  }
  W.reach = reach;
  if (Z.theme !== 'town') {
    const cand = [];
    for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) { const i = I(x, y); if (reach[i] && !W.keep[i]) cand.push(i); }
    const far = (x, y, p, d) => Math.hypot((x + 0.5) * TILE - p.x, (y + 0.5) * TILE - p.y) > d * TILE;
    const taken = [];
    const pick = (minD, test) => {
      for (let tries = 0; tries < 400; tries++) {
        const i = cand[Math.floor(R() * cand.length)], x = i % w, y = (i / w) | 0;
        if (!far(x, y, W.entry, 9) || !far(x, y, W.exit, 4) || !far(x, y, W.boss, 9)) continue;
        if (test && !test(x, y)) continue;
        let ok = true; for (const t of taken) if (Math.abs(t[0] - x) + Math.abs(t[1] - y) < minD) { ok = false; break; }
        if (ok) { taken.push([x, y]); return [x, y]; }
      }
      return null;
    };
    for (let n = 0; n < 84; n++) {
      const p = pick(3); if (!p) break;
      const prog = (p[0] - 10) / (w - 20) + (R() - 0.5) * 0.16, idx = prog < 0.36 ? 0 : prog < 0.7 ? 1 : 2;
      W.spawns.push({ x: (p[0] + 0.5) * TILE, y: (p[1] + 0.5) * TILE, mob: Z.mobs[idx], elite: R() < 0.06 });
    }
    W.spawns.push({ x: W.boss.x, y: W.boss.y, mob: Z.boss, boss: true });
    const kinds = ['ore', 'wood', 'herb'];
    for (let n = 0; n < 90; n++) { /* 30 pontos de cada recurso por zona (antes: 14) */ const p = pick(2); if (!p) break; W.nodes.push({ kind: kinds[n % 3], tier: id, x: (p[0] + 0.5) * TILE, y: (p[1] + 0.6) * TILE, readyAt: 0 }); }
  }
  W.objs.sort((a, b) => a.y - b.y);
  return W;
}
function isSolidPx(W, x, y) { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); if (tx < 0 || ty < 0 || tx >= W.w || ty >= W.h) return true; return W.solid[ty * W.w + tx] === 1; }
function canStand(W, x, y, r) { return !isSolidPx(W, x - r, y - r) && !isSolidPx(W, x + r, y - r) && !isSolidPx(W, x - r, y + r) && !isSolidPx(W, x + r, y + r); }
function moveEnt(W, e, dx, dy, r) {
  let moved = false;
  if (dx && canStand(W, e.x + dx, e.y, r)) { e.x += dx; moved = true; }
  if (dy && canStand(W, e.x, e.y + dy, r)) { e.y += dy; moved = true; }
  return moved;
}
