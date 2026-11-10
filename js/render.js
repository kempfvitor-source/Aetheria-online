'use strict';
/* ============ Renderização (Canvas 2D, arte procedural) ============ */
const RD = { cv: null, g: null, W: 0, H: 0, zoom: 1, dpr: 1, cam: { x: 0, y: 0 }, chunks: new Map(), spr: null, sprZone: -1, parts: [], texts: [], projs: [], teles: [], amb: [], mini: null, vig: null, shake: 0 };
const CH = 12, CHPX = CH * TILE;
const ORE_C = ['', '#c9772e', '#aab4bd', '#e6edf5', '#f2c230', '#7fe0d0', '#b05cff', '#ff7ad0'];

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; } else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}
function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, 6.2832); }
function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, 6.2832); }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function resizeCanvas() {
  const cv = RD.cv; RD.dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rot = document.body.classList.contains('rot'), w = rot ? window.innerHeight : window.innerWidth, h = rot ? window.innerWidth : window.innerHeight;
  RD.SW = w; RD.SH = h;
  cv.width = Math.round(w * RD.dpr); cv.height = Math.round(h * RD.dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
  RD.zoom = Math.max(0.62, Math.min(1.5, Math.min(w / 1050, h / 600) * 1.0));
  if (Math.min(w, h) < 520) RD.zoom = Math.max(RD.zoom, h > w ? 0.82 : 0.7);
  RD.W = w / RD.zoom; RD.H = h / RD.zoom; RD.vig = null;
}

/* ---------- Chunks de terreno ---------- */
function clearChunks() { RD.chunks.clear(); RD.mini = null; }
function makeChunk(W, cx, cy) {
  const c = mkCanvas(CHPX, CHPX), g = c.getContext('2d'), pal = W.Z.pal, x0 = cx * CH - 1, y0 = cy * CH - 1, x1 = cx * CH + CH, y1 = cy * CH + CH;
  g.translate(-cx * CHPX, -cy * CHPX);
  const T = (x, y) => (x < 0 || y < 0 || x >= W.w || y >= W.h) ? T_CLIFF : W.tiles[y * W.w + x];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    g.fillStyle = pal.g1; g.fillRect(x * TILE, y * TILE, TILE + 1, TILE + 1);
  }
  g.fillStyle = pal.g2; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (T(x, y) === T_G2) { circ(g, (x + 0.5) * TILE, (y + 0.5) * TILE, TILE * 0.8); g.fill(); }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    for (let k = 0; k < 5; k++) {
      const hx = hash2(x * 7 + k, y * 13, 5), hy = hash2(x * 3, y * 11 + k, 9), hv = hash2(x + k, y - k, 21);
      g.fillStyle = hv > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
      g.fillRect(x * TILE + hx * 44, y * TILE + hy * 44, 2 + hv * 3, 2 + hx * 4);
    }
  }
  const blob = (tt, r, col) => { g.fillStyle = col; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (T(x, y) === tt) { circ(g, (x + 0.5) * TILE, (y + 0.5) * TILE, TILE * r); g.fill(); } };
  blob(T_PATH, 0.84, shade(pal.path, -0.22)); blob(T_PATH, 0.76, pal.path);
  const floorC = pal.floor || shade(pal.path, 0.12);
  blob(T_FLOOR, 0.86, shade(floorC, -0.3)); blob(T_FLOOR, 0.78, floorC);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = T(x, y);
    if (t === T_PATH || t === T_FLOOR) for (let k = 0; k < 3; k++) { g.fillStyle = hash2(x, y, k + 40) > 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.13)'; ell(g, x * TILE + hash2(x, y, k) * 40 + 4, y * TILE + hash2(y, x, k + 3) * 40 + 4, 3 + hash2(x, y, k + 9) * 3, 2); g.fill(); }
    if (t === T_FLOOR) { g.strokeStyle = 'rgba(0,0,0,0.10)'; g.lineWidth = 1; const o = (y & 1) * 12; g.beginPath(); g.moveTo(x * TILE, y * TILE + 0.5); g.lineTo(x * TILE + TILE, y * TILE + 0.5); g.moveTo(x * TILE, y * TILE + 24.5); g.lineTo(x * TILE + TILE, y * TILE + 24.5); g.moveTo(x * TILE + 12.5 + o, y * TILE); g.lineTo(x * TILE + 12.5 + o, y * TILE + 24); g.moveTo(x * TILE + 36.5 - o, y * TILE + 24); g.lineTo(x * TILE + 36.5 - o, y * TILE + 48); g.stroke(); }
  }
  blob(T_WATER, 0.92, pal.shore); blob(T_WATER, 0.76, shade(pal.water, -0.12)); blob(T_WATER, 0.66, pal.water);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (T(x, y) === T_CLIFF) {
    const px = x * TILE, py = y * TILE, south = T(x, y + 1) !== T_CLIFF;
    g.fillStyle = shade(pal.cliff, -0.28); g.fillRect(px, py, TILE + 1, TILE + 1);
    g.fillStyle = pal.cliff; g.fillRect(px, py, TILE + 1, south ? TILE - 15 : TILE + 1);
    g.fillStyle = 'rgba(255,255,255,0.10)'; ell(g, px + 10 + hash2(x, y, 3) * 26, py + 8 + hash2(x, y, 4) * 20, 9, 5); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.13)'; ell(g, px + 8 + hash2(x, y, 5) * 30, py + 14 + hash2(x, y, 6) * 16, 7, 4); g.fill();
    if (T(x, y - 1) !== T_CLIFF) { g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(px, py, TILE + 1, 3); }
  }
  return c;
}
function getChunk(W, cx, cy) {
  const k = cx + ',' + cy; let c = RD.chunks.get(k);
  if (!c) { if (RD.chunks.size > 24) { const first = RD.chunks.keys().next().value; RD.chunks.delete(first); } c = makeChunk(W, cx, cy); }
  else RD.chunks.delete(k);
  RD.chunks.set(k, c); return c;
}

/* ---------- Sprites pré-renderizados (árvores, rochas, recursos) ---------- */
function buildSprites(W) {
  const pal = W.Z.pal, th = W.Z.theme, S = { tree: [], rock: [], ore: null, wood: null, herb: null };
  for (let v = 0; v < 2; v++) {
    const c = mkCanvas(130, 160), g = c.getContext('2d'); g.translate(65, 148);
    g.fillStyle = 'rgba(0,0,0,0.25)'; ell(g, 0, 2, 26, 8); g.fill();
    if (th === 'snow') {
      g.fillStyle = pal.trunk; g.fillRect(-5, -22, 10, 24);
      for (let i = 0; i < 4; i++) { const y = -18 - i * 24, w = 40 - i * 8; g.fillStyle = shade(pal.leaf, i * 0.06); g.beginPath(); g.moveTo(-w, y); g.lineTo(0, y - 40); g.lineTo(w, y); g.closePath(); g.fill(); g.fillStyle = pal.leaf2; g.beginPath(); g.moveTo(-w * 0.55, y - 16); g.lineTo(0, y - 40); g.lineTo(w * 0.55, y - 16); g.lineTo(w * 0.2, y - 20); g.lineTo(0, y - 14); g.lineTo(-w * 0.25, y - 21); g.closePath(); g.fill(); }
    } else if (th === 'desert' && v === 0) {
      g.fillStyle = pal.leaf; rrect(g, -9, -70, 18, 72, 9); g.fill(); rrect(g, -30, -52, 12, 30, 6); g.fill(); g.fillRect(-24, -30, 18, 9); rrect(g, 18, -62, 12, 34, 6); g.fill(); g.fillRect(6, -38, 18, 9);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(-4, -66, 3, 62); g.fillStyle = '#ff7ab0'; circ(g, 0, -72, 5); g.fill();
    } else if (th === 'desert') {
      g.strokeStyle = pal.trunk; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(12, -50, 2, -98); g.stroke();
      for (let i = 0; i < 7; i++) { const a = -2.9 + i * 0.45; g.strokeStyle = i % 2 ? pal.leaf : pal.leaf2; g.lineWidth = 7; g.beginPath(); g.moveTo(2, -98); g.quadraticCurveTo(2 + Math.cos(a) * 30, -98 + Math.sin(a) * 30 - 12, 2 + Math.cos(a) * 52, -98 + Math.sin(a) * 34 + 14); g.stroke(); }
    } else if (th === 'ash') {
      g.strokeStyle = pal.trunk; g.lineCap = 'round'; g.lineWidth = 10; g.beginPath(); g.moveTo(0, 0); g.lineTo(v ? 6 : -4, -60); g.stroke();
      const br = [[-30, -90, 6], [26, -100, 6], [-16, -112, 4], [38, -70, 4], [-40, -64, 4]];
      for (const [bx, by, lw] of br) { g.lineWidth = lw; g.beginPath(); g.moveTo(v ? 6 : -4, -56); g.quadraticCurveTo(bx * 0.4, by * 0.8, bx, by); g.stroke(); g.fillStyle = pal.leaf2; g.shadowColor = pal.leaf2; g.shadowBlur = 10; circ(g, bx, by, 3); g.fill(); g.shadowBlur = 0; }
    } else if (th === 'void') {
      const sp = [[0, -120, 22], [-26, -70, 14], [24, -84, 15]];
      for (const [sx, sy, sw] of sp) { const gr = g.createLinearGradient(sx - sw, 0, sx + sw, 0); gr.addColorStop(0, pal.leaf); gr.addColorStop(0.5, pal.leaf2); gr.addColorStop(1, shade(pal.leaf, -0.4)); g.fillStyle = gr; g.shadowColor = pal.leaf2; g.shadowBlur = 14; g.beginPath(); g.moveTo(sx - sw, 0); g.lineTo(sx - sw * 0.5, sy * 0.75); g.lineTo(sx, sy); g.lineTo(sx + sw * 0.5, sy * 0.75); g.lineTo(sx + sw, 0); g.closePath(); g.fill(); g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo(sx - sw * 0.2, -4); g.lineTo(sx - sw * 0.1, sy * 0.8); g.lineTo(sx + sw * 0.1, sy * 0.6); g.closePath(); g.fill(); }
    } else {
      g.fillStyle = pal.trunk; g.beginPath(); g.moveTo(-9, 0); g.lineTo(-6, -50); g.lineTo(6, -50); g.lineTo(9, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(1, -50, 5, 50);
      const bl = v ? [[0, -78, 36], [-24, -62, 24], [24, -64, 25], [0, -104, 26]] : [[-14, -72, 30], [18, -76, 30], [0, -100, 28], [0, -58, 26]];
      for (const [bx, by, br] of bl) { g.fillStyle = shade(pal.leaf, -0.18); circ(g, bx, by + 4, br); g.fill(); }
      for (const [bx, by, br] of bl) { g.fillStyle = pal.leaf; circ(g, bx, by, br); g.fill(); }
      for (const [bx, by, br] of bl) { g.fillStyle = pal.leaf2; g.globalAlpha = 0.55; circ(g, bx - br * 0.25, by - br * 0.3, br * 0.55); g.fill(); g.globalAlpha = 1; }
      if (th === 'swamp') { g.strokeStyle = shade(pal.leaf, -0.25); g.lineWidth = 2; for (let i = 0; i < 9; i++) { const sx = -34 + i * 8.5; g.beginPath(); g.moveTo(sx, -56); g.lineTo(sx + 2, -30 + (i % 3) * 8); g.stroke(); } }
      if (th === 'meadow' || th === 'town') { g.fillStyle = v ? '#ffd0e8' : '#fff3a8'; for (let i = 0; i < 9; i++) { circ(g, -28 + hash2(i, v, 1) * 56, -110 + hash2(i, v, 2) * 60, 2.4); g.fill(); } }
    }
    S.tree.push(c);
    const r = mkCanvas(80, 70), q = r.getContext('2d'); q.translate(40, 58);
    q.fillStyle = 'rgba(0,0,0,0.25)'; ell(q, 0, 2, 24, 7); q.fill();
    q.fillStyle = shade(pal.rock, -0.25); q.beginPath(); q.moveTo(-24, 0); q.lineTo(-20, -22); q.lineTo(-6, v ? -40 : -32); q.lineTo(14, -30); q.lineTo(24, -10); q.lineTo(22, 0); q.closePath(); q.fill();
    q.fillStyle = pal.rock; q.beginPath(); q.moveTo(-20, -4); q.lineTo(-17, -21); q.lineTo(-6, v ? -37 : -29); q.lineTo(8, -27); q.lineTo(4, -6); q.closePath(); q.fill();
    q.fillStyle = 'rgba(255,255,255,0.22)'; q.beginPath(); q.moveTo(-14, -20); q.lineTo(-6, v ? -34 : -27); q.lineTo(2, -26); q.closePath(); q.fill();
    if (th === 'snow') { q.fillStyle = '#fff'; ell(q, -4, v ? -36 : -29, 12, 4); q.fill(); }
    S.rock.push(r);
  }
  const oc = ORE_C[W.id] || '#ccc';
  let c = mkCanvas(70, 64), g = c.getContext('2d'); g.translate(35, 54);
  g.fillStyle = 'rgba(0,0,0,0.25)'; ell(g, 0, 2, 22, 7); g.fill();
  g.fillStyle = '#5a5f6a'; g.beginPath(); g.moveTo(-22, 0); g.lineTo(-16, -22); g.lineTo(0, -32); g.lineTo(16, -24); g.lineTo(22, 0); g.closePath(); g.fill();
  g.fillStyle = '#767c88'; g.beginPath(); g.moveTo(-16, -3); g.lineTo(-12, -20); g.lineTo(0, -29); g.lineTo(4, -6); g.closePath(); g.fill();
  g.shadowColor = oc; g.shadowBlur = 8; g.fillStyle = oc; for (const [x, y] of [[-8, -14], [6, -20], [10, -8], [-2, -6]]) { g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 4, y); g.lineTo(x, y + 5); g.lineTo(x - 4, y); g.closePath(); g.fill(); }
  S.ore = c;
  c = mkCanvas(70, 64); g = c.getContext('2d'); g.translate(35, 54);
  g.fillStyle = 'rgba(0,0,0,0.25)'; ell(g, 0, 2, 24, 7); g.fill();
  for (const [x, y] of [[-12, -4], [12, -4], [0, -16]]) { g.fillStyle = pal.trunk; rrect(g, x - 14, y - 8, 28, 14, 6); g.fill(); g.fillStyle = shade(pal.trunk, 0.45); ell(g, x + 11, y - 1, 4, 6); g.fill(); g.strokeStyle = shade(pal.trunk, 0.1); g.lineWidth = 1; ell(g, x + 11, y - 1, 2, 3); g.stroke(); }
  g.fillStyle = '#ddd'; g.fillRect(-2, -34, 3, 16); g.fillStyle = '#b0b8c0'; g.beginPath(); g.moveTo(1, -36); g.lineTo(12, -32); g.lineTo(1, -24); g.closePath(); g.fill();
  S.wood = c;
  c = mkCanvas(60, 60); g = c.getContext('2d'); g.translate(30, 50);
  g.fillStyle = 'rgba(0,0,0,0.2)'; ell(g, 0, 2, 16, 5); g.fill();
  const hc = ['', '#ffd86b', '#b8e0ff', '#ff9ad5', '#ffb04a', '#bfeaff', '#ff6a3a', '#c9a6ff'][W.id] || '#fff';
  g.strokeStyle = '#3f9a48'; g.lineWidth = 3; g.lineCap = 'round';
  for (const [x, y] of [[-12, -20], [0, -30], [12, -22]]) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(x * 0.3, y * 0.6, x, y); g.stroke(); }
  g.fillStyle = '#4fb85a'; ell(g, -8, -6, 8, 4); g.fill(); ell(g, 9, -8, 8, 4); g.fill();
  g.shadowColor = hc; g.shadowBlur = 8; g.fillStyle = hc; for (const [x, y] of [[-12, -20], [0, -30], [12, -22]]) { circ(g, x, y, 5); g.fill(); }
  g.shadowBlur = 0; g.fillStyle = '#fff8'; for (const [x, y] of [[-12, -20], [0, -30], [12, -22]]) { circ(g, x - 1, y - 1, 2); g.fill(); }
  S.herb = c;
  RD.spr = S; RD.sprZone = W.id;
}

/* ---------- Personagens ---------- */
function drawWings(g, tier, t, moving) {
  const wd = WINGS[tier]; if (!wd) return;
  const s = 0.75 + tier * 0.065, fl = Math.sin(t * (moving ? 10 : 3.5)) * 0.16;
  for (const side of [-1, 1]) {
    g.save(); g.translate(side * 3, -27); g.scale(side * s, s); g.rotate(-0.25 - fl);
    const gr = g.createLinearGradient(0, -30, 40, 10); gr.addColorStop(0, wd.c1); gr.addColorStop(1, wd.c2);
    g.fillStyle = gr; g.shadowColor = wd.c2; g.shadowBlur = tier >= 3 ? 12 : 4;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(8, -26, 30, -36, 44, -24); g.bezierCurveTo(40, -14, 40, -8, 36, -2);
    g.bezierCurveTo(32, 2, 30, 6, 26, 8); g.bezierCurveTo(20, 10, 18, 14, 13, 14); g.bezierCurveTo(8, 14, 3, 10, 0, 0); g.fill();
    g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(2, -2); g.quadraticCurveTo(18, -20, 38, -20); g.moveTo(3, 0); g.quadraticCurveTo(18, -8, 34, -4); g.moveTo(3, 2); g.quadraticCurveTo(14, 2, 24, 6); g.stroke();
    g.restore();
  }
}
function drawHero(g, x, y, o) {
  const C = CLASSES[o.cls] || CLASSES.warrior, t = o.t || 0, mv = o.moving, bob = mv ? Math.sin(t * 13) * 1.6 : Math.sin(t * 2.6) * 0.8;
  g.save(); g.translate(x, y); if (o.alpha != null) g.globalAlpha = o.alpha;
  g.fillStyle = 'rgba(0,0,0,0.28)'; ell(g, 0, 0, 15, 5.5); g.fill();
  if (o.dead) { g.rotate(1.45); g.translate(-14, -6); }
  const FXS = o.skin && SKIN_FX[o.skin] && !o.dead ? SKIN_FX[o.skin] : null; if (FXS) FXS.back(g, t, mv);
  if (o.wings) drawWings(g, o.wings, t, mv);
  g.scale(o.dir || 1, 1);
  const l = mv ? Math.sin(t * 13) * 3.5 : 0;
  g.fillStyle = '#3a2f2a'; rrect(g, -7, -11 + Math.max(0, l) * 0.5 - 0, 5.5, 11 - Math.max(0, l) * 0.5, 2); g.fill(); rrect(g, 1.5, -11 + Math.max(0, -l) * 0.5, 5.5, 11 - Math.max(0, -l) * 0.5, 2); g.fill();
  g.translate(0, bob);
  const SK = o.skin && SKIN_DRAW[o.skin] ? o.skin : null, armC = SK ? SKINS[SK].arm : shade(C.color, 0.1);
  if (SK) SKIN_DRAW[SK](g, t, mv); else {
  // corpo
  const gr = g.createLinearGradient(0, -32, 0, -8); gr.addColorStop(0, shade(C.color, 0.18)); gr.addColorStop(1, shade(C.color, -0.22));
  g.fillStyle = gr; g.beginPath(); g.moveTo(-8, -31); g.lineTo(8, -31); g.lineTo(10.5, -9); g.lineTo(-10.5, -9); g.closePath(); g.fill();
  g.fillStyle = C.trim; g.fillRect(-1.5, -31, 3, 22); g.fillRect(-10.5, -12, 21, 3);
  g.fillStyle = shade(C.color, -0.35); g.fillRect(-9.5, -18, 19, 2.5);
  // braço de trás
  g.fillStyle = shade(C.color, -0.1); rrect(g, -11.5, -30, 5, 13, 2.5); g.fill();
  // cabeça
  g.fillStyle = '#f4d3b5'; circ(g, 0, -39, 9.5); g.fill();
  g.fillStyle = C.hair; g.beginPath(); g.arc(0, -40, 10, Math.PI * 1.02, Math.PI * 2.08); g.quadraticCurveTo(4, -43, -2, -42); g.quadraticCurveTo(-8, -41, -10, -34); g.closePath(); g.fill();
  g.fillStyle = '#2a2030'; circ(g, 2.2, -38, 1.5); g.fill(); circ(g, 6.6, -38, 1.5); g.fill();
  g.fillStyle = 'rgba(255,120,120,0.35)'; ell(g, 6, -34.5, 2.4, 1.3); g.fill();
  if (o.cls === 'mage') { g.fillStyle = shade(C.color, -0.15); g.beginPath(); g.moveTo(-13, -45); g.lineTo(13, -45); g.lineTo(3, -50); g.lineTo(-3, -66); g.lineTo(-5, -50); g.closePath(); g.fill(); g.fillStyle = C.trim; g.fillRect(-7, -50, 12, 2.5); }
  else if (o.cls === 'warrior') { g.fillStyle = '#b8c0cc'; g.beginPath(); g.arc(0, -41, 10.5, Math.PI, 0); g.lineTo(10.5, -39); g.lineTo(-10.5, -39); g.closePath(); g.fill(); g.fillStyle = C.color; g.beginPath(); g.moveTo(-1, -51); g.quadraticCurveTo(-10, -60, -13, -50); g.lineTo(-2, -47); g.closePath(); g.fill(); }
  else if (o.cls === 'archer') { g.fillStyle = shade(C.color, -0.1); g.beginPath(); g.arc(-1, -41, 11, Math.PI * 0.95, Math.PI * 1.95); g.lineTo(-3, -45); g.closePath(); g.fill(); g.fillStyle = '#ff5a5a'; g.beginPath(); g.moveTo(-6, -50); g.lineTo(-12, -62); g.lineTo(-3, -52); g.closePath(); g.fill(); }
  else { g.strokeStyle = '#ffe58a'; g.lineWidth = 2; g.shadowColor = '#ffe58a'; g.shadowBlur = 6; ell(g, 0, -54, 7, 2.4); g.stroke(); g.shadowBlur = 0; }
  }
  // braço + arma
  const a = o.atk > 0 ? o.atk : 0, sw = a > 0 ? Math.sin((1 - a) * Math.PI) : 0;
  g.save(); g.translate(8, -28);
  if (o.cls === 'archer') {
    g.rotate(-0.1); g.fillStyle = armC; rrect(g, -2, -2, 12, 5, 2.5); g.fill();
    g.translate(13, 0); g.strokeStyle = '#8a5a2b'; g.lineWidth = 3; g.beginPath(); g.arc(-6, 0, 15, -1.15, 1.15); g.stroke();
    g.strokeStyle = '#eee'; g.lineWidth = 1; g.beginPath(); g.moveTo(0.2, -13.6); g.lineTo(-6 * sw, 0); g.lineTo(0.2, 13.6); g.stroke();
  } else {
    g.rotate(0.35 - sw * 1.9 + (a > 0 ? 0.9 * (1 - a) : 0));
    g.fillStyle = armC; rrect(g, -2.5, -2, 5, 13, 2.5); g.fill();
    g.translate(0, 10); g.rotate(0.95);
    if (o.cls === 'warrior') { g.fillStyle = '#e6ecf2'; g.beginPath(); g.moveTo(-2.5, 0); g.lineTo(-2.5, -24); g.lineTo(0, -29); g.lineTo(2.5, -24); g.lineTo(2.5, 0); g.closePath(); g.fill(); g.fillStyle = '#9aa6b4'; g.fillRect(0, -25, 2.5, 25); g.fillStyle = C.trim; g.fillRect(-6, -1, 12, 3); g.fillStyle = '#5a3a20'; g.fillRect(-1.5, 2, 3, 6); }
    else if (o.cls === 'mage') { g.fillStyle = '#7a5230'; g.fillRect(-1.5, -30, 3, 38); g.fillStyle = C.trim; g.shadowColor = C.trim; g.shadowBlur = 10; circ(g, 0, -33, 5); g.fill(); g.shadowBlur = 0; g.fillStyle = '#fff'; circ(g, -1.5, -34.5, 1.6); g.fill(); }
    else { g.fillStyle = '#d8d0c0'; g.fillRect(-1.5, -26, 3, 34); g.fillStyle = '#ffd86b'; g.shadowColor = '#ffd86b'; g.shadowBlur = 8; g.beginPath(); g.moveTo(0, -38); g.lineTo(6, -30); g.lineTo(0, -24); g.lineTo(-6, -30); g.closePath(); g.fill(); g.shadowBlur = 0; }
  }
  g.restore(); if (FXS) FXS.front(g, t, mv); g.restore();
}
function drawNpc(g, n, t) {
  const d = n.def;
  if (d.crystal) {
    const by = Math.sin(t * 2) * 4; g.save(); g.translate(n.x, n.y);
    g.fillStyle = 'rgba(0,0,0,0.25)'; ell(g, 0, 4, 20, 7); g.fill();
    g.fillStyle = '#8a8f9a'; g.beginPath(); g.moveTo(-18, 6); g.lineTo(-10, -8); g.lineTo(10, -8); g.lineTo(18, 6); g.closePath(); g.fill();
    g.shadowColor = '#7fe0ff'; g.shadowBlur = 22; const gr = g.createLinearGradient(-12, 0, 12, 0); gr.addColorStop(0, '#bff3ff'); gr.addColorStop(0.5, '#5ac8ff'); gr.addColorStop(1, '#3a7fe0');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -70 + by); g.lineTo(13, -44 + by); g.lineTo(0, -16 + by); g.lineTo(-13, -44 + by); g.closePath(); g.fill();
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(0, -70 + by); g.lineTo(-13, -44 + by); g.lineTo(-3, -44 + by); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(127,224,255,' + (0.35 + Math.sin(t * 3) * 0.2) + ')'; g.lineWidth = 2; ell(g, 0, 2, 26 + Math.sin(t * 2) * 3, 9); g.stroke();
    g.restore(); return;
  }
  g.save(); g.translate(n.x, n.y); const bob = Math.sin(t * 2.2 + n.x) * 0.8;
  g.fillStyle = 'rgba(0,0,0,0.28)'; ell(g, 0, 0, 15, 5.5); g.fill();
  if (n.key === 'wings') drawWings(g, 7, t, false);
  g.translate(0, bob);
  const gr = g.createLinearGradient(0, -32, 0, 0); gr.addColorStop(0, shade(d.c, 0.15)); gr.addColorStop(1, shade(d.c, -0.3));
  g.fillStyle = gr; g.beginPath(); g.moveTo(-8, -31); g.lineTo(8, -31); g.lineTo(12, -1); g.lineTo(-12, -1); g.closePath(); g.fill();
  g.fillStyle = '#ffe9a8'; g.fillRect(-1.5, -31, 3, 30);
  g.fillStyle = '#f4d3b5'; circ(g, 0, -39, 9.5); g.fill();
  g.fillStyle = d.hair; g.beginPath(); g.arc(0, -40, 10.3, Math.PI, 0); g.lineTo(10, -33); g.lineTo(7, -41); g.lineTo(-7, -41); g.lineTo(-10, -33); g.closePath(); g.fill();
  g.fillStyle = '#2a2030'; circ(g, -3, -38, 1.4); g.fill(); circ(g, 3, -38, 1.4); g.fill();
  g.restore();
}
function drawMob(g, m, t) {
  const d = m.def, c = d.c, c2 = d.c2 || shade(c, 0.4), sc = (d.boss ? 2.1 : m.elite ? 1.3 : 1) * (m.spawnT < 0.4 ? m.spawnT / 0.4 : 1), tt = t + m.seed;
  g.save(); g.translate(m.x, m.y);
  g.fillStyle = 'rgba(0,0,0,0.28)'; ell(g, 0, 0, 16 * sc, 6 * sc); g.fill();
  if (m.elite || d.boss) { g.strokeStyle = d.boss ? 'rgba(255,90,60,0.55)' : 'rgba(255,210,80,0.55)'; g.lineWidth = 2; ell(g, 0, 0, (20 + Math.sin(tt * 4) * 2) * sc, 8 * sc); g.stroke(); }
  g.scale(sc * (m.dir || 1), sc);
  if (m.flash > 0) g.filter = 'brightness(2.2)';
  if (m.slow > 0) { g.shadowColor = '#7fd0ff'; g.shadowBlur = 10; }
  const mv = m.moving, wob = Math.sin(tt * (mv ? 11 : 3));
  switch (d.kind) {
    case 'slime': {
      const sq = 1 + wob * 0.09; const gr = g.createRadialGradient(-4, -14, 2, 0, -8, 20); gr.addColorStop(0, shade(c, 0.45)); gr.addColorStop(1, shade(c, -0.15));
      g.fillStyle = gr; g.beginPath(); g.moveTo(-16 * sq, 0); g.bezierCurveTo(-18 * sq, -22 / sq, 18 * sq, -22 / sq, 16 * sq, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; ell(g, -6, -12 / sq, 4, 2.5); g.fill();
      g.fillStyle = '#1a2030'; circ(g, 3, -8, 2); g.fill(); circ(g, 9, -8, 2); g.fill();
      if (d.boss) { g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(-8, -15 / sq); g.lineTo(-9, -24 / sq); g.lineTo(-4, -19 / sq); g.lineTo(0, -26 / sq); g.lineTo(4, -19 / sq); g.lineTo(9, -24 / sq); g.lineTo(8, -15 / sq); g.closePath(); g.fill(); }
      break;
    }
    case 'beast': {
      g.fillStyle = shade(c, -0.3); for (const [lx, ph] of [[-11, 0], [-5, 1.6], [6, 3.1], [12, 4.7]]) g.fillRect(lx, -8 + (mv ? Math.sin(tt * 11 + ph) * 2 : 0), 4, 9);
      g.strokeStyle = c; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-15, -14); g.quadraticCurveTo(-24, -20 + wob * 3, -22, -26); g.stroke();
      g.fillStyle = c; ell(g, 0, -15, 17, 9.5); g.fill(); g.fillStyle = shade(c, 0.25); ell(g, -2, -18, 11, 4); g.fill();
      g.fillStyle = c; circ(g, 16, -20, 8); g.fill(); g.beginPath(); g.moveTo(11, -26); g.lineTo(12, -34); g.lineTo(17, -27); g.closePath(); g.fill(); g.beginPath(); g.moveTo(17, -27); g.lineTo(21, -34); g.lineTo(22, -24); g.closePath(); g.fill();
      g.fillStyle = shade(c, -0.35); ell(g, 22, -18, 4, 3); g.fill(); g.fillStyle = '#fff'; g.fillRect(20, -16, 2, 3);
      g.fillStyle = '#ff4a3a'; circ(g, 17, -22, 1.6); g.fill();
      break;
    }
    case 'flyer': {
      const hy = -26 + Math.sin(tt * 3) * 4, fl = Math.sin(tt * 18) * 0.5;
      g.fillStyle = shade(c, 0.5); g.globalAlpha = 0.6; g.save(); g.translate(-3, hy); g.rotate(-0.5 - fl); ell(g, -9, -6, 11, 5); g.fill(); g.restore(); g.save(); g.translate(3, hy); g.rotate(0.5 + fl); ell(g, 9, -6, 11, 5); g.fill(); g.restore(); g.globalAlpha = 1;
      g.shadowColor = c; g.shadowBlur = 14; const gr = g.createRadialGradient(-2, hy - 3, 1, 0, hy, 11); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, c); gr.addColorStop(1, shade(c, -0.3));
      g.fillStyle = gr; g.beginPath(); g.moveTo(-9, hy); g.bezierCurveTo(-9, hy - 14, 9, hy - 14, 9, hy); g.bezierCurveTo(8, hy + 8, 3, hy + 10, 0, hy + 16 + wob * 2); g.bezierCurveTo(-3, hy + 10, -8, hy + 8, -9, hy); g.fill();
      g.shadowBlur = 0; g.fillStyle = '#1a1030'; circ(g, 1, hy - 2, 1.6); g.fill(); circ(g, 5.5, hy - 2, 1.6); g.fill();
      break;
    }
    case 'shroom': {
      g.fillStyle = '#efe2c4'; rrect(g, -7, -18, 14, 18, 5); g.fill(); g.fillStyle = '#1a2030'; circ(g, 1, -9, 1.6); g.fill(); circ(g, 5, -9, 1.6); g.fill();
      g.fillStyle = shade(c, -0.25); g.beginPath(); g.moveTo(-19, -15); g.bezierCurveTo(-18, -42 + wob, 18, -42 + wob, 19, -15); g.closePath(); g.fill();
      g.fillStyle = c; g.beginPath(); g.moveTo(-17, -17); g.bezierCurveTo(-16, -40 + wob, 16, -40 + wob, 17, -17); g.closePath(); g.fill();
      g.fillStyle = '#fff'; circ(g, -7, -26, 3); g.fill(); circ(g, 6, -30, 2.5); g.fill(); circ(g, 9, -21, 2); g.fill();
      break;
    }
    case 'humanoid': {
      const l = mv ? Math.sin(tt * 11) * 3 : 0;
      g.fillStyle = shade(c, -0.45); g.fillRect(-6, -10 + Math.max(0, l) * 0.5, 5, 10); g.fillRect(1, -10 + Math.max(0, -l) * 0.5, 5, 10);
      g.fillStyle = shade(c, -0.2); g.beginPath(); g.moveTo(-8, -29); g.lineTo(8, -29); g.lineTo(10, -9); g.lineTo(-10, -9); g.closePath(); g.fill();
      g.fillStyle = shade(c, -0.45); g.fillRect(-10, -14, 20, 3);
      g.fillStyle = c; circ(g, 0, -36, 9); g.fill();
      g.beginPath(); g.moveTo(-8, -38); g.lineTo(-16, -44); g.lineTo(-7, -32); g.closePath(); g.fill(); g.beginPath(); g.moveTo(8, -38); g.lineTo(16, -44); g.lineTo(7, -32); g.closePath(); g.fill();
      g.fillStyle = '#ffe14a'; circ(g, 1.5, -37, 1.8); g.fill(); circ(g, 6, -37, 1.8); g.fill();
      g.save(); g.translate(9, -26); g.rotate(0.5 - (m.atkAnim > 0 ? Math.sin(m.atkAnim * 10) * 1.2 : 0)); g.fillStyle = '#6b4a2b'; g.fillRect(-1.5, -20, 3, 26); g.fillStyle = c2; circ(g, 0, -22, 4.5); g.fill(); g.restore();
      if (d.boss) { g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(-8, -43); g.lineTo(-8, -52); g.lineTo(-4, -47); g.lineTo(0, -54); g.lineTo(4, -47); g.lineTo(8, -52); g.lineTo(8, -43); g.closePath(); g.fill(); }
      break;
    }
    case 'spider': {
      g.strokeStyle = shade(c, -0.3); g.lineWidth = 2.2; g.lineCap = 'round';
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const a = (i - 1.5) * 0.45, k = Math.sin(tt * (mv ? 14 : 2) + i * 1.7 + s) * 3; g.beginPath(); g.moveTo(s * 5, -9); g.lineTo(s * (15 + i), -18 + a * 8 + k * 0.4); g.lineTo(s * (22 + i * 1.5), -1 + a * 5 + k); g.stroke(); }
      g.fillStyle = c; ell(g, -6, -11, 12, 9); g.fill(); g.fillStyle = shade(c, 0.3); ell(g, -8, -14, 6, 3); g.fill();
      g.fillStyle = shade(c, -0.15); circ(g, 8, -9, 6.5); g.fill(); g.fillStyle = '#ff3a3a'; circ(g, 9, -11, 1.4); g.fill(); circ(g, 12.5, -10, 1.4); g.fill();
      if (d.id === 'scorpion') { g.strokeStyle = c; g.lineWidth = 4; g.beginPath(); g.moveTo(-16, -12); g.quadraticCurveTo(-28, -26, -14, -32 + wob * 2); g.stroke(); g.fillStyle = '#7a2a1a'; circ(g, -13, -32 + wob * 2, 3); g.fill(); }
      break;
    }
    case 'golem': {
      const br = Math.sin(tt * 2.5) * 1;
      g.fillStyle = shade(c, -0.3); rrect(g, -13, -12, 10, 12, 3); g.fill(); rrect(g, 3, -12, 10, 12, 3); g.fill();
      g.fillStyle = c; rrect(g, -17, -40 + br, 34, 30, 8); g.fill(); g.fillStyle = shade(c, 0.2); rrect(g, -13, -38 + br, 16, 10, 5); g.fill();
      g.fillStyle = shade(c, -0.15); rrect(g, -26, -38 + br, 10, 26, 5); g.fill(); rrect(g, 16, -38 + br + (m.atkAnim > 0 ? -6 : 0), 10, 26, 5); g.fill();
      g.fillStyle = c; rrect(g, -8, -52 + br, 16, 14, 4); g.fill();
      g.shadowColor = c2; g.shadowBlur = 10; g.fillStyle = c2; g.fillRect(-4, -47 + br, 3, 3); g.fillRect(3, -47 + br, 3, 3); circ(g, 0, -24 + br, 4.5); g.fill();
      break;
    }
    case 'dragon': {
      const hy = -24 + Math.sin(tt * 2) * 3, fl = Math.sin(tt * 5) * 0.3;
      for (const s of [-1, 1]) { g.save(); g.translate(-4, hy - 4); g.rotate(s * (0.5 + fl) - 0.2); g.fillStyle = shade(c, -0.35); g.beginPath(); g.moveTo(0, 0); g.lineTo(-10, -30 * s); g.lineTo(-20, -18 * s); g.lineTo(-24, -26 * s); g.lineTo(-30, -8 * s); g.closePath(); g.fill(); g.restore(); }
      for (let i = 6; i >= 0; i--) { const sx = -i * 6.5, sy = hy + 10 + Math.sin(tt * 4 + i * 0.7) * 3 + i * 1.2; g.fillStyle = i % 2 ? c : shade(c, -0.15); circ(g, sx, sy, 9 - i * 0.9); g.fill(); }
      g.fillStyle = c; ell(g, 8, hy, 13, 10); g.fill(); g.fillStyle = shade(c, 0.3); ell(g, 6, hy - 4, 7, 3); g.fill();
      g.fillStyle = shade(c, -0.1); rrect(g, 14, hy - 4, 14, 10, 4); g.fill();
      g.fillStyle = '#f5f0e0'; g.beginPath(); g.moveTo(2, hy - 8); g.lineTo(-4, hy - 22); g.lineTo(7, hy - 9); g.closePath(); g.fill(); g.beginPath(); g.moveTo(9, hy - 9); g.lineTo(8, hy - 22); g.lineTo(14, hy - 8); g.closePath(); g.fill();
      g.shadowColor = '#ffe14a'; g.shadowBlur = 8; g.fillStyle = '#ffe14a'; circ(g, 15, hy - 2, 2.2); g.fill();
      break;
    }
  }
  g.restore();
}
function mobHeight(m) { return (m.def.kind === 'golem' ? 56 : m.def.kind === 'humanoid' ? 50 : m.def.kind === 'dragon' ? 52 : 40) * (m.def.boss ? 2.1 : m.elite ? 1.3 : 1); }

/* ---------- Efeitos ---------- */
function fxText(x, y, text, color, big) { RD.texts.push({ x: x + (Math.random() - 0.5) * 16, y, text, color, big, life: 1.1, vy: -46 }); if (RD.texts.length > 60) RD.texts.shift(); }
function fxBurst(x, y, color, n, sp) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = (sp || 110) * (0.3 + Math.random()); RD.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 2 + Math.random() * 3 }); } if (RD.parts.length > 500) RD.parts.splice(0, RD.parts.length - 500); }
function fxRing(x, y, r, color, dur) { RD.parts.push({ ring: 1, x, y, r, color, life: dur || 0.45, max: dur || 0.45 }); }
function fxSlash(x, y, dir, color) { RD.parts.push({ slash: 1, x, y, dir, color: color || '#fff', life: 0.22, max: 0.22 }); }
function fxProj(o) { RD.projs.push(o); }
function fxTele(x, y, r, dur, color, cb) { RD.teles.push({ x, y, r, t: 0, dur, color: color || '#ff3a2a', cb }); }
function fxPillar(x, y, color) { RD.parts.push({ pillar: 1, x, y, color, life: 1.2, max: 1.2 }); }

function updateFx(dt) {
  for (let i = RD.parts.length - 1; i >= 0; i--) { const p = RD.parts[i]; p.life -= dt; if (p.life <= 0) { RD.parts.splice(i, 1); continue; } if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; } }
  for (let i = RD.texts.length - 1; i >= 0; i--) { const p = RD.texts[i]; p.life -= dt; p.y += p.vy * dt; p.vy *= 0.96; if (p.life <= 0) RD.texts.splice(i, 1); }
  for (let i = RD.projs.length - 1; i >= 0; i--) {
    const p = RD.projs[i], tx = p.target ? p.target.x : p.tx, ty = (p.target ? p.target.y : p.ty) - (p.target ? 18 : 0), dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), st = p.speed * dt;
    if (d <= st + 6 || (p.target && p.target.dead)) { RD.projs.splice(i, 1); if (p.onHit) p.onHit(tx, ty); continue; }
    p.x += dx / d * st; p.y += dy / d * st; p.ang = Math.atan2(dy, dx);
    if (p.trail && Math.random() < 0.6) RD.parts.push({ x: p.x, y: p.y, vx: 0, vy: -10, life: 0.3, max: 0.3, color: p.color, size: 3 });
  }
  for (let i = RD.teles.length - 1; i >= 0; i--) { const p = RD.teles[i]; p.t += dt; if (p.t >= p.dur) { RD.teles.splice(i, 1); if (p.cb) p.cb(); } }
  if (RD.shake > 0) RD.shake = Math.max(0, RD.shake - dt * 30);
}

/* ---------- Quadro principal ---------- */
function worldToScreen(x, y) { return { x: (x - RD.cam.x) * RD.zoom, y: (y - RD.cam.y) * RD.zoom }; }
function screenToWorld(sx, sy) { return { x: sx / RD.zoom + RD.cam.x, y: sy / RD.zoom + RD.cam.y }; }

function drawLabel(g, x, y, text, color, size, bold) {
  g.font = (bold ? '700 ' : '600 ') + (size || 11) + 'px "Alegreya Sans", system-ui, sans-serif'; g.textAlign = 'center';
  g.lineWidth = 3; g.strokeStyle = 'rgba(10,8,25,0.85)'; g.strokeText(text, x, y); g.fillStyle = color || '#fff'; g.fillText(text, x, y);
}
function drawBar(g, x, y, w, h, f, col) { g.fillStyle = 'rgba(10,8,25,0.8)'; rrect(g, x - w / 2 - 1, y - 1, w + 2, h + 2, 2); g.fill(); g.fillStyle = col; g.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, f)), h); }

function render(time) {
  const g = RD.g, W = G.world; if (!W) return;
  if (RD.sprZone !== W.id) buildSprites(W);
  const z = RD.zoom * RD.dpr, vw = RD.W, vh = RD.H, mw = W.w * TILE, mh = W.h * TILE;
  let cx = P.x - vw / 2, cy = P.y - vh / 2 - 10;
  cx = mw > vw ? Math.max(0, Math.min(mw - vw, cx)) : (mw - vw) / 2; cy = mh > vh ? Math.max(0, Math.min(mh - vh, cy)) : (mh - vh) / 2;
  if (RD.shake > 0) { cx += (Math.random() - 0.5) * RD.shake; cy += (Math.random() - 0.5) * RD.shake; }
  RD.cam.x = cx; RD.cam.y = cy;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0c0a18'; g.fillRect(0, 0, RD.cv.width, RD.cv.height);
  g.setTransform(z, 0, 0, z, -Math.round(cx * z), -Math.round(cy * z));
  const c0x = Math.max(0, Math.floor(cx / CHPX)), c0y = Math.max(0, Math.floor(cy / CHPX)), c1x = Math.min(Math.ceil(W.w / CH) - 1, Math.floor((cx + vw) / CHPX)), c1y = Math.min(Math.ceil(W.h / CH) - 1, Math.floor((cy + vh) / CHPX));
  for (let y = c0y; y <= c1y; y++) for (let x = c0x; x <= c1x; x++) g.drawImage(getChunk(W, x, y), x * CHPX, y * CHPX);
  // brilho animado da água / lava
  const t0x = Math.max(0, Math.floor(cx / TILE)), t0y = Math.max(0, Math.floor(cy / TILE)), t1x = Math.min(W.w - 1, Math.floor((cx + vw) / TILE)), t1y = Math.min(W.h - 1, Math.floor((cy + vh) / TILE));
  const lava = W.Z.theme === 'ash', vd = W.Z.theme === 'void';
  g.lineWidth = 2; g.lineCap = 'round';
  for (let y = t0y; y <= t1y; y++) for (let x = t0x; x <= t1x; x++) if (W.tiles[y * W.w + x] === T_WATER) {
    const h = hash2(x, y, 77); if (h > 0.55) continue;
    const a = 0.25 + Math.sin(time * 2 + h * 40) * 0.2, px = x * TILE + 10 + h * 30, py = y * TILE + 12 + hash2(y, x, 78) * 24 + Math.sin(time + h * 9) * 2;
    if (vd) { g.fillStyle = 'rgba(220,200,255,' + (a + 0.2) + ')'; circ(g, px, py, 1.4); g.fill(); }
    else { g.strokeStyle = lava ? 'rgba(255,230,120,' + (a + 0.15) + ')' : 'rgba(255,255,255,' + a + ')'; g.beginPath(); g.moveTo(px - 7, py); g.quadraticCurveTo(px, py - 3, px + 7, py); g.stroke(); }
  }
  drawPath(g, time);
  // telegrafias no chão
  for (const p of RD.teles) { const f = p.t / p.dur; g.fillStyle = p.color; g.globalAlpha = 0.16 + f * 0.2; ell(g, p.x, p.y, p.r, p.r * 0.62); g.fill(); g.globalAlpha = 0.8; g.strokeStyle = p.color; g.lineWidth = 2; ell(g, p.x, p.y, p.r, p.r * 0.62); g.stroke(); ell(g, p.x, p.y, p.r * f, p.r * 0.62 * f); g.stroke(); g.globalAlpha = 1; }
  // portais
  for (const p of W.portals) {
    g.save(); g.translate(p.x, p.y - 26);
    for (let i = 0; i < 3; i++) { g.strokeStyle = ['#7fe0ff', '#b58cff', '#ffffff'][i]; g.globalAlpha = 0.75 - i * 0.2; g.lineWidth = 4 - i; g.shadowColor = '#7fb0ff'; g.shadowBlur = 16; g.beginPath(); g.ellipse(0, 0, 20 + i * 5 + Math.sin(time * 3 + i) * 2, 34 + i * 5, 0, time * (1.5 + i * 0.4), time * (1.5 + i * 0.4) + 4.6); g.stroke(); }
    g.shadowBlur = 0; g.globalAlpha = 0.5; const gr = g.createRadialGradient(0, 0, 2, 0, 0, 30); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#7fb0ff'); gr.addColorStop(1, 'rgba(90,60,200,0)'); g.fillStyle = gr; ell(g, 0, 0, 20, 34); g.fill();
    g.restore(); g.globalAlpha = 1;
    const tz = ZONES[p.to]; drawLabel(g, p.x, p.y - 78, tz.name, '#bfe6ff', 13, true); if (!tz.safe) drawLabel(g, p.x, p.y - 64, 'Nv. ' + tz.lvl[0] + '–' + tz.lvl[1], P.lvlOk(tz) ? '#d8ffd0' : '#ff8a8a', 11);
  }
  // lista ordenada por Y
  const list = [], x0 = cx - 90, x1 = cx + vw + 90, y0 = cy - 60, y1 = cy + vh + 170;
  for (const o of W.objs) { if (o.y < y0) continue; if (o.y > y1 + 120) break; if (o.x > x0 - 150 && o.x < x1 + 150) list.push({ y: o.y, k: 0, o }); }
  for (const n of W.nodes) if (n.x > x0 && n.x < x1 && n.y > y0 && n.y < y1) list.push({ y: n.y, k: 1, o: n });
  for (const n of W.npcs) if (n.x > x0 && n.x < x1 && n.y > y0 && n.y < y1) list.push({ y: n.y, k: 2, o: n });
  for (const m of G.mobs) if (!m.dead && m.x > x0 && m.x < x1 && m.y > y0 && m.y < y1) list.push({ y: m.y, k: 3, o: m });
  for (const p of G.peers.values()) if (p.rx > x0 && p.rx < x1 && p.ry > y0 && p.ry < y1) list.push({ y: p.ry, k: 4, o: p });
  list.push({ y: P.y, k: 5, o: P });
  list.sort((a, b) => a.y - b.y);
  const now = G.time, S_ = RD.spr, th = W.Z.theme;
  for (const it of list) {
    const o = it.o;
    if (it.k === 0) {
      if (o.type === 'tree') { const im = S_.tree[o.v], w = 130 * o.s, h = 160 * o.s; const behind = P.y < o.y && P.y > o.y - 110 * o.s && Math.abs(P.x - o.x) < 34 * o.s; if (behind) g.globalAlpha = 0.45; g.drawImage(im, o.x - w / 2, o.y - 148 * o.s, w, h); g.globalAlpha = 1; }
      else if (o.type === 'rock') { const w = 80 * o.s, h = 70 * o.s; g.drawImage(S_.rock[o.v], o.x - w / 2, o.y - 58 * o.s, w, h); }
      else if (o.type === 'deco') {
        if (th === 'desert' || th === 'ash' || th === 'void') { g.fillStyle = th === 'void' ? 'rgba(200,170,255,0.5)' : 'rgba(0,0,0,0.18)'; ell(g, o.x, o.y, 4 + o.v, 2.5); g.fill(); }
        else if (o.v < 2 && th !== 'snow' && th !== 'swamp') { g.fillStyle = ['#fff', '#ffd86b', '#ff9ad5', '#b8a0ff'][(o.x | 0) % 4]; for (let i = 0; i < 5; i++) { circ(g, o.x + Math.cos(i * 1.257) * 3, o.y + Math.sin(i * 1.257) * 3, 1.8); g.fill(); } g.fillStyle = '#ffb02e'; circ(g, o.x, o.y, 1.5); g.fill(); }
        else { g.strokeStyle = th === 'snow' ? '#a8c0d8' : shade(W.Z.pal.g1, -0.25); g.lineWidth = 1.6; const sw = Math.sin(now * 2 + o.x) * 1.5; g.beginPath(); g.moveTo(o.x - 3, o.y); g.lineTo(o.x - 5 + sw, o.y - 8); g.moveTo(o.x, o.y); g.lineTo(o.x + sw, o.y - 11); g.moveTo(o.x + 3, o.y); g.lineTo(o.x + 5 + sw, o.y - 8); g.stroke(); }
      }
      else if (o.type === 'house') {
        const x = o.x - o.w / 2, y = o.y - o.h; g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 6, o.y - 6, o.w, 12);
        g.fillStyle = '#e9dcc0'; g.fillRect(x + 8, y + o.h * 0.42, o.w - 16, o.h * 0.58); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 8, y + o.h * 0.42, o.w - 16, 10);
        g.fillStyle = '#6b4a2b'; g.fillRect(x + 8, y + o.h * 0.42, 6, o.h * 0.58); g.fillRect(x + o.w - 14, y + o.h * 0.42, 6, o.h * 0.58); g.fillRect(x + 8, o.y - 6, o.w - 16, 6);
        g.fillStyle = shade(o.c, -0.25); g.beginPath(); g.moveTo(x - 6, y + o.h * 0.48); g.lineTo(o.x, y - 34); g.lineTo(x + o.w + 6, y + o.h * 0.48); g.closePath(); g.fill();
        g.fillStyle = o.c; g.beginPath(); g.moveTo(x, y + o.h * 0.42); g.lineTo(o.x, y - 28); g.lineTo(x + o.w, y + o.h * 0.42); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(x + 20, y + o.h * 0.38); g.lineTo(o.x, y - 20); g.lineTo(o.x, y + o.h * 0.38); g.closePath(); g.fill();
        g.fillStyle = '#5a3a20'; rrect(g, o.x - 14, o.y - 46, 28, 46, 12); g.fill(); g.fillStyle = '#ffd86b'; circ(g, o.x + 7, o.y - 22, 2); g.fill();
        g.fillStyle = '#ffe9a0'; g.shadowColor = '#ffd86b'; g.shadowBlur = 12; g.fillRect(x + 28, o.y - 52, 22, 22); g.fillRect(x + o.w - 50, o.y - 52, 22, 22); g.shadowBlur = 0;
        g.strokeStyle = '#6b4a2b'; g.lineWidth = 2; g.strokeRect(x + 28, o.y - 52, 22, 22); g.strokeRect(x + o.w - 50, o.y - 52, 22, 22);
      }
      else if (o.type === 'stall') { g.fillStyle = '#6b4a2b'; g.fillRect(o.x - 34, o.y - 50, 4, 50); g.fillRect(o.x + 30, o.y - 50, 4, 50); g.fillRect(o.x - 34, o.y - 22, 68, 8); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#ff5aa0' : '#fff'; g.fillRect(o.x - 39 + i * 13, o.y - 64, 13, 16); } g.fillStyle = '#7fe0ff'; g.shadowColor = '#7fe0ff'; g.shadowBlur = 8; for (const dx of [-16, 0, 16]) { g.beginPath(); g.moveTo(o.x + dx, o.y - 36); g.lineTo(o.x + dx + 5, o.y - 29); g.lineTo(o.x + dx, o.y - 22); g.lineTo(o.x + dx - 5, o.y - 29); g.closePath(); g.fill(); } g.shadowBlur = 0; }
    } else if (it.k === 1) {
      const ready = now >= o.readyAt, im = S_[o.kind]; g.globalAlpha = ready ? 1 : 0.28; g.drawImage(im, o.x - im.width / 2, o.y - im.height + 10); g.globalAlpha = 1;
      if (ready && Math.sin(now * 3 + o.x) > 0.6) { g.fillStyle = '#fff'; circ(g, o.x + Math.sin(now * 5 + o.y) * 10, o.y - 24 + Math.cos(now * 4) * 6, 1.5); g.fill(); }
    } else if (it.k === 2) {
      drawNpc(g, o, now); drawLabel(g, o.x, o.y - (o.def.crystal ? 82 : 60), o.def.name, '#ffe9a8', 12, true); drawLabel(g, o.x, o.y - (o.def.crystal ? 69 : 47), '<' + o.def.title + '>', '#9fe0b0', 10);
      if (o.key === 'quest' || o.key === 'scout') { const mk = questMarker(); if (mk) drawLabel(g, o.x, o.y - 76 + Math.sin(now * 4) * 3, mk, mk === '?' ? '#ffd24a' : '#ffe14a', 22, true); }
    } else if (it.k === 3) {
      drawMob(g, o, now); const hh = mobHeight(o);
      const tg = P.target === o; if (tg) { g.strokeStyle = '#ff5a4a'; g.lineWidth = 2; g.setLineDash([6, 4]); g.lineDashOffset = -now * 20; ell(g, o.x, o.y, o.rad + 8, (o.rad + 8) * 0.4); g.stroke(); g.setLineDash([]); }
      const dl = o.lvl - S.lvl, nc = o.def.boss ? '#ff9a5a' : o.elite ? '#ffd24a' : dl >= 5 ? '#ff7a7a' : dl <= -6 ? '#a0a0a8' : '#ffffff';
      drawLabel(g, o.x, o.y - hh - 12, (o.elite ? '★ ' : '') + o.def.name + '  Nv.' + o.lvl, nc, o.def.boss ? 13 : 11, o.def.boss);
      if (o.hp < o.maxHp || tg) drawBar(g, o.x, o.y - hh - 8, o.def.boss ? 90 : 40, o.def.boss ? 6 : 4, o.hp / o.maxHp, '#e0463a');
    } else if (it.k === 4) {
      drawHero(g, o.rx, o.ry, { skin: o.sk, cls: o.c, dir: o.d, t: now + o.seed, moving: o.mv, atk: o.atkT > 0 ? o.atkT / 0.3 : 0, wings: o.w, dead: o.dead });
      const ty = o.sk === 'godslayer' ? 12 : 0; drawLabel(g, o.rx, o.ry - 66 - ty, o.n + '  Nv.' + o.l, ty ? '#ffe9a8' : '#9fd8ff', 11, true); const eo = skinTitle(g, o.rx, o.ry - 66 - ty - 13, o.sk, now, o.mv);
      if (o.bubble && now < o.bubbleT) drawBubble(g, o.rx, o.ry - 82 - ty - eo, o.bubble);
    } else {
      drawHero(g, P.x, P.y, { skin: S.skin, cls: S.cls, dir: P.dir, t: now, moving: P.moving, atk: P.atkT > 0 ? P.atkT / 0.3 : 0, wings: S.wings.t, dead: P.dead });
      if (P.shield > 0) { g.strokeStyle = 'rgba(127,208,255,0.8)'; g.fillStyle = 'rgba(127,208,255,0.15)'; g.lineWidth = 2; ell(g, P.x, P.y - 24, 24, 34); g.fill(); g.stroke(); }
      const ty = S.skin === 'godslayer' ? 12 : 0; drawLabel(g, P.x, P.y - 66 - ty, S.name, '#ffe9a8', 12, true); const eo = skinTitle(g, P.x, P.y - 66 - ty - 14, S.skin, now, P.moving);
      if (P.bubble && now < P.bubbleT) drawBubble(g, P.x, P.y - 82 - ty - eo, P.bubble);
      if (P.cast) { drawBar(g, P.x, P.y - 84, 50, 5, P.cast.t / P.cast.dur, '#ffd24a'); }
    }
  }
  // projéteis e partículas
  for (const p of RD.projs) { g.save(); g.translate(p.x, p.y); g.rotate(p.ang || 0); g.shadowColor = p.color; g.shadowBlur = 12; if (p.arrow) { g.strokeStyle = '#e8d8a0'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-12, 0); g.lineTo(8, 0); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(12, 0); g.lineTo(5, -3.5); g.lineTo(5, 3.5); g.closePath(); g.fill(); } else { g.fillStyle = p.color; circ(g, 0, 0, p.size || 6); g.fill(); g.fillStyle = '#fff'; circ(g, 0, 0, (p.size || 6) * 0.45); g.fill(); } g.restore(); }
  for (const p of RD.parts) {
    const f = p.life / p.max;
    if (p.ring) { g.globalAlpha = f; g.strokeStyle = p.color; g.lineWidth = 4 * f + 1; ell(g, p.x, p.y, p.r * (1 - f * 0.7), p.r * (1 - f * 0.7) * 0.62); g.stroke(); }
    else if (p.slash) { g.globalAlpha = f; g.strokeStyle = p.color; g.lineWidth = 5 * f + 1; g.lineCap = 'round'; g.beginPath(); g.arc(p.x, p.y - 20, 30, p.dir > 0 ? -1.1 : Math.PI - 1.1 + 0, p.dir > 0 ? 1.1 : Math.PI + 1.1); g.stroke(); }
    else if (p.paw) { g.globalAlpha = Math.min(1, f * 1.5) * 0.85; g.fillStyle = '#ffe0a0'; g.shadowColor = '#f5c542'; g.shadowBlur = 8; ell(g, p.x, p.y, 4.2, 2.6); g.fill(); for (const dx of [-4.4, 0, 4.4]) { ell(g, p.x + dx, p.y - 4.2 + Math.abs(dx) * 0.25, 1.7, 1.3); g.fill(); } g.shadowBlur = 0; }
    else if (p.pillar) { g.globalAlpha = f * 0.7; const gr = g.createLinearGradient(0, p.y - 160, 0, p.y); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, p.color); g.fillStyle = gr; g.fillRect(p.x - 22, p.y - 160, 44, 160); }
    else { g.globalAlpha = Math.min(1, f * 1.6); g.fillStyle = p.color; circ(g, p.x, p.y, p.size * (0.4 + f * 0.6)); g.fill(); }
  }
  g.globalAlpha = 1;
  for (const p of RD.texts) { g.globalAlpha = Math.min(1, p.life * 2); const sz = p.big ? 20 : 14; g.font = '800 ' + sz + 'px "Alegreya Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 3.5; g.strokeStyle = 'rgba(10,8,25,0.9)'; g.strokeText(p.text, p.x, p.y); g.fillStyle = p.color; g.fillText(p.text, p.x, p.y); }
  g.globalAlpha = 1;
  // destino do clique
  if (P.moveTo && !P.moveTo.ent) { g.strokeStyle = 'rgba(255,233,168,0.8)'; g.lineWidth = 2; ell(g, P.moveTo.x, P.moveTo.y, 9 + Math.sin(now * 8) * 2, 4); g.stroke(); }
  // espaço de tela: ambiente, tinta, vinheta
  g.setTransform(RD.dpr, 0, 0, RD.dpr, 0, 0); const sw = RD.SW, sh = RD.SH;
  if (W.Z.pal.tint) { g.fillStyle = W.Z.pal.tint; g.fillRect(0, 0, sw, sh); }
  drawAmbient(g, W.Z.fx, sw, sh, now);
  if (!RD.vig || RD.vig.width !== sw) { const c = mkCanvas(sw, sh), q = c.getContext('2d'), gr = q.createRadialGradient(sw / 2, sh / 2, Math.min(sw, sh) * 0.35, sw / 2, sh / 2, Math.max(sw, sh) * 0.75); gr.addColorStop(0, 'rgba(10,6,30,0)'); gr.addColorStop(1, 'rgba(10,6,30,0.55)'); q.fillStyle = gr; q.fillRect(0, 0, sw, sh); RD.vig = c; }
  g.drawImage(RD.vig, 0, 0);
  if (P.hp < P.st.maxHp * 0.25 && !P.dead) { g.fillStyle = 'rgba(200,20,20,' + (0.12 + Math.sin(now * 6) * 0.06) + ')'; g.fillRect(0, 0, sw, sh); }
}
function drawBubble(g, x, y, text) {
  g.font = '600 12px "Alegreya Sans", system-ui, sans-serif'; const t = text.length > 42 ? text.slice(0, 41) + '…' : text, w = g.measureText(t).width + 14;
  g.fillStyle = 'rgba(255,255,255,0.94)'; rrect(g, x - w / 2, y - 16, w, 20, 8); g.fill(); g.beginPath(); g.moveTo(x - 4, y + 3); g.lineTo(x, y + 9); g.lineTo(x + 4, y + 3); g.fill();
  g.fillStyle = '#221a3a'; g.textAlign = 'center'; g.fillText(t, x, y - 2);
}
function drawAmbient(g, kind, sw, sh, t) {
  if (RD.amb.length < 46) for (let i = RD.amb.length; i < 46; i++) RD.amb.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), p: Math.random() * 6.28 });
  const camx = RD.cam.x * RD.zoom, camy = RD.cam.y * RD.zoom;
  for (let i = 0; i < RD.amb.length; i++) {
    const a = RD.amb[i]; let x, y;
    const wrap = (v, m) => ((v % m) + m) % m;
    if (kind === 'petal') { x = wrap(a.x * sw + t * 22 * a.s - camx * 0.3, sw); y = wrap(a.y * sh + t * 16 * a.s + Math.sin(t + a.p) * 12 - camy * 0.3, sh); if (i > 22) continue; g.fillStyle = 'rgba(255,214,232,0.8)'; g.save(); g.translate(x, y); g.rotate(t * a.s + a.p); ell(g, 0, 0, 4, 2); g.fill(); g.restore(); }
    else if (kind === 'firefly') { x = wrap(a.x * sw + Math.sin(t * 0.5 * a.s + a.p) * 40 - camx * 0.4, sw); y = wrap(a.y * sh + Math.cos(t * 0.4 * a.s + a.p) * 30 - camy * 0.4, sh); const al = 0.4 + Math.sin(t * 3 * a.s + a.p) * 0.4; if (al <= 0) continue; g.fillStyle = 'rgba(210,255,140,' + al + ')'; g.shadowColor = '#d2ff8c'; g.shadowBlur = 8; circ(g, x, y, 1.8); g.fill(); g.shadowBlur = 0; }
    else if (kind === 'fog') { if (i > 9) continue; x = wrap(a.x * sw + t * 9 * a.s - camx * 0.2, sw + 300) - 150; y = a.y * sh; const gr = g.createRadialGradient(x, y, 10, x, y, 170); gr.addColorStop(0, 'rgba(200,230,190,0.13)'); gr.addColorStop(1, 'rgba(200,230,190,0)'); g.fillStyle = gr; g.fillRect(x - 170, y - 170, 340, 340); }
    else if (kind === 'dust') { x = wrap(a.x * sw + t * 70 * a.s - camx * 0.3, sw); y = wrap(a.y * sh + Math.sin(t + a.p) * 8 - camy * 0.3, sh); g.fillStyle = 'rgba(255,235,180,0.45)'; g.fillRect(x, y, 6 * a.s, 1.2); }
    else if (kind === 'snow') { x = wrap(a.x * sw + Math.sin(t * a.s + a.p) * 24 - camx * 0.3, sw); y = wrap(a.y * sh + t * 46 * a.s - camy * 0.3, sh); g.fillStyle = 'rgba(255,255,255,0.85)'; circ(g, x, y, 1.2 + a.s); g.fill(); }
    else if (kind === 'ember') { x = wrap(a.x * sw + Math.sin(t * a.s + a.p) * 18 - camx * 0.3, sw); y = wrap(a.y * sh - t * 40 * a.s - camy * 0.3, sh); g.fillStyle = 'rgba(255,' + (120 + (i * 5) % 100) + ',40,0.8)'; g.shadowColor = '#ff6a1f'; g.shadowBlur = 6; circ(g, x, y, 1 + a.s); g.fill(); g.shadowBlur = 0; }
    else if (kind === 'mote') { x = wrap(a.x * sw + Math.sin(t * 0.3 * a.s + a.p) * 50 - camx * 0.4, sw); y = wrap(a.y * sh - t * 12 * a.s - camy * 0.4, sh); g.fillStyle = 'rgba(201,166,255,' + (0.4 + Math.sin(t * 2 + a.p) * 0.3) + ')'; g.shadowColor = '#b58cff'; g.shadowBlur = 8; circ(g, x, y, 1.6 * a.s); g.fill(); g.shadowBlur = 0; }
  }
}

/* ---------- Minimapa ---------- */
function buildMini(W) {
  const s = 2, c = mkCanvas(W.w * s, W.h * s), g = c.getContext('2d'), pal = W.Z.pal;
  for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) { const t = W.tiles[y * W.w + x], sol = W.solid[y * W.w + x]; g.fillStyle = t === T_WATER ? pal.water : t === T_CLIFF ? shade(pal.cliff, -0.3) : t === T_PATH ? pal.path : t === T_FLOOR ? (pal.floor || pal.path) : sol ? shade(pal.leaf, -0.1) : pal.g1; g.fillRect(x * s, y * s, s, s); }
  RD.mini = c; RD.miniId = W.id;
}
function drawMini(cv) {
  const W = G.world; if (!W) return; if (!RD.mini || RD.miniId !== W.id) buildMini(W);
  const g = cv.getContext('2d'), cw = cv.width, chh = cv.height, s = 2, px = P.x / TILE * s, py = P.y / TILE * s;
  let ox = px - cw / 2, oy = py - chh / 2; ox = Math.max(0, Math.min(RD.mini.width - cw, ox)); oy = Math.max(0, Math.min(RD.mini.height - chh, oy));
  if (RD.mini.width < cw) ox = (RD.mini.width - cw) / 2; if (RD.mini.height < chh) oy = (RD.mini.height - chh) / 2;
  g.fillStyle = '#0c0a18'; g.fillRect(0, 0, cw, chh); g.drawImage(RD.mini, -ox, -oy);
  const dot = (x, y, c, r) => { g.fillStyle = c; g.beginPath(); g.arc(x / TILE * s - ox, y / TILE * s - oy, r, 0, 6.3); g.fill(); };
  for (const n of W.nodes) if (G.time >= n.readyAt) dot(n.x, n.y, n.kind === 'ore' ? '#d0d6e0' : n.kind === 'wood' ? '#b07a3a' : '#7fe07a', 1.2);
  for (const m of G.mobs) if (!m.dead) dot(m.x, m.y, m.def.boss ? '#ff5a2a' : m.elite ? '#ffd24a' : '#e0463a', m.def.boss ? 3.5 : 1.5);
  for (const n of W.npcs) dot(n.x, n.y, '#ffe14a', 2.2);
  for (const p of W.portals) dot(p.x, p.y, '#7fe0ff', 3);
  for (const p of G.peers.values()) dot(p.rx, p.ry, '#5ab0ff', 2.2);
  dot(P.x, P.y, '#fff', 3); g.strokeStyle = '#221a3a'; g.lineWidth = 1; g.beginPath(); g.arc(px - ox, py - oy, 3, 0, 6.3); g.stroke();
}

/* ---------- Caminho destacado da missão (setas sequenciais no chão) ---------- */
function drawPath(g, t) {
  const pa = G.path; if (!pa || !pa.pts || pa.pts.length < 2) return;
  const pts = pa.pts, gap = 36; let acc = 0, next = 34, n = 0;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 1; i < pts.length && n < 18; i++) {
    const a = pts[i - 1], b = pts[i], seg = Math.hypot(b.x - a.x, b.y - a.y); if (seg < 0.01) continue;
    while (next <= acc + seg && n < 18) {
      const f = (next - acc) / seg, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, ang = Math.atan2(b.y - a.y, b.x - a.x);
      const ph = (((t * 1.5 - n * 0.16) % 1) + 1) % 1, al = Math.sin(Math.PI * Math.min(1, ph * 1.5));
      if (al > 0.03) {
        g.save(); g.translate(x, y); g.scale(1, 0.72); g.rotate(ang); g.globalAlpha = al * 0.95; const s = 1.1 + al * 0.3; g.scale(s, s);
        g.shadowColor = '#ffd24a'; g.shadowBlur = 14; g.fillStyle = '#ffe58a'; g.strokeStyle = 'rgba(70,35,0,0.9)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(11, 0); g.lineTo(-8, -12); g.lineTo(-3, 0); g.lineTo(-8, 12); g.closePath(); g.fill(); g.shadowBlur = 0; g.stroke(); g.restore();
      }
      next += gap; n++;
    }
    acc += seg;
  }
  g.restore(); g.globalAlpha = 1;
  if (Math.hypot(pa.tx - P.x, pa.ty - P.y) > 60) { const r = 20 + Math.sin(t * 4) * 4; g.strokeStyle = 'rgba(255,229,138,0.9)'; g.lineWidth = 3; g.shadowColor = '#ffd24a'; g.shadowBlur = 12; ell(g, pa.tx, pa.ty, r, r * 0.6); g.stroke(); g.shadowBlur = 0; drawLabel(g, pa.tx, pa.ty - 96 + Math.sin(t * 3) * 3, '▼ ' + pa.label, '#ffe58a', 12, true); }
}

/* ---------- Skins ---------- */
const SKIN_DRAW = {
  godslayer(g, t) {
    const sw = Math.sin(t * 2.4), pu = 0.5 + Math.sin(t * 3.2) * 0.5;
    g.lineCap = 'round';
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { g.lineWidth = 2.6 - k; g.strokeStyle = (s < 0) !== (k === 1) ? 'rgba(176,120,255,' + (0.8 - k * 0.3) + ')' : 'rgba(255,214,110,' + (0.85 - k * 0.3) + ')'; g.beginPath(); g.moveTo(s * 9, -27); g.bezierCurveTo(s * (23 + sw * 3 + k * 4), -22 - k * 5, s * (21 - sw * 4 + k * 3), -8, s * (17 + sw * 3 + k * 5), 1 - k * 5); g.stroke(); }
    // capa externa branca com barra em pontas
    g.fillStyle = '#f3effc'; g.beginPath(); g.moveTo(-9, -31); g.lineTo(9, -31); g.lineTo(15.5, -3); g.lineTo(12.5, 0.5); g.lineTo(9.5, -2.5); g.lineTo(6, 0.5); g.lineTo(-6, 0.5); g.lineTo(-9.5, -2.5); g.lineTo(-12.5, 0.5); g.lineTo(-15.5, -3); g.closePath(); g.fill();
    const rg = g.createLinearGradient(0, -31, 0, 0); rg.addColorStop(0, '#221a33'); rg.addColorStop(1, '#0f0b18');
    g.fillStyle = rg; g.beginPath(); g.moveTo(-8, -31); g.lineTo(8, -31); g.lineTo(11.5, -2); g.lineTo(-11.5, -2); g.closePath(); g.fill();
    const pg = g.createLinearGradient(0, -31, 0, 0); pg.addColorStop(0, '#7a4fe0'); pg.addColorStop(0.5, '#4b2aa6'); pg.addColorStop(1, '#2c1670');
    g.fillStyle = pg; g.beginPath(); g.moveTo(-3.6, -31); g.lineTo(3.6, -31); g.lineTo(4.8, -4); g.lineTo(0, 1); g.lineTo(-4.8, -4); g.closePath(); g.fill();
    g.strokeStyle = '#f5c542'; g.lineWidth = 1.3; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-3.6, -31); g.lineTo(-4.8, -4); g.lineTo(0, 1); g.lineTo(4.8, -4); g.lineTo(3.6, -31); g.moveTo(-9, -31); g.lineTo(-15.5, -3); g.lineTo(-12.5, 0.5); g.lineTo(-9.5, -2.5); g.lineTo(-6, 0.5); g.moveTo(9, -31); g.lineTo(15.5, -3); g.lineTo(12.5, 0.5); g.lineTo(9.5, -2.5); g.lineTo(6, 0.5); g.stroke();
    g.fillStyle = '#f5c542'; g.fillRect(-0.8, -17, 1.6, 9.5); g.fillRect(-3, -14.5, 6, 1.6); g.fillRect(-10.6, -11.5, 6, 1.3); g.fillRect(4.6, -11.5, 6, 1.3);
    for (const [x, y, p] of [[-7.5, -20, 0], [7.2, -17, 1.3], [-8.6, -7, 2.1], [8.4, -6.5, 3.4], [-6.4, -26, 4.2], [6.6, -25, 5]]) { const a = 0.35 + Math.sin(t * 3 + p) * 0.35; if (a <= 0.05) continue; g.fillStyle = 'rgba(255,224,140,' + a + ')'; g.beginPath(); g.moveTo(x, y - 1.6); g.lineTo(x + 0.5, y - 0.5); g.lineTo(x + 1.6, y); g.lineTo(x + 0.5, y + 0.5); g.lineTo(x, y + 1.6); g.lineTo(x - 0.5, y + 0.5); g.lineTo(x - 1.6, y); g.lineTo(x - 0.5, y - 0.5); g.closePath(); g.fill(); }
    g.fillStyle = '#17131f'; rrect(g, -12, -30, 5, 13, 2.5); g.fill(); g.fillStyle = '#f5c542'; g.fillRect(-12, -20, 5, 1.8);
    for (const s of [-1, 1]) { for (let k = 0; k < 4; k++) { g.fillStyle = k === 3 ? '#e4dcf7' : '#ffffff'; g.save(); g.translate(s * (10 + k * 2.6), -29.5 + k * 1.3); g.rotate(s * (0.25 + k * 0.12 + sw * 0.04)); ell(g, 0, 0, 4.8, 2.5); g.fill(); g.restore(); } g.fillStyle = '#f5c542'; ell(g, s * 9, -31, 4, 2.2); g.fill(); g.fillStyle = '#fff3b0'; ell(g, s * 8.4, -31.6, 1.8, 0.8); g.fill(); }
    g.shadowColor = '#c9a6ff'; g.shadowBlur = 6 + pu * 8; g.fillStyle = '#b07aff'; g.beginPath(); g.moveTo(0, -30.5); g.lineTo(3.3, -26.5); g.lineTo(0, -22.5); g.lineTo(-3.3, -26.5); g.closePath(); g.fill(); g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,' + (0.5 + pu * 0.4) + ')'; g.beginPath(); g.moveTo(0, -29.5); g.lineTo(1.2, -26.8); g.lineTo(-1.2, -26.8); g.closePath(); g.fill();
    // auréola (metade de trás), cabeça, cabelo
    const hr = t * 1.2; g.strokeStyle = 'rgba(255,214,110,0.95)'; g.lineWidth = 1.7; g.shadowColor = '#ffd66e'; g.shadowBlur = 10; g.beginPath(); g.ellipse(0, -37, 17.5, 4.6, 0, Math.PI, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
    g.fillStyle = '#f4d3b5'; circ(g, 0, -39, 9.5); g.fill();
    g.fillStyle = '#efeafc'; for (const [x, y, r] of [[-7, -44, 5.5], [-1, -47, 6], [6, -45, 5.5], [-10, -39, 4.2], [9.5, -41, 3.6], [2, -43.5, 4.5], [-10.5, -34.5, 2.8]]) { circ(g, x, y, r); g.fill(); }
    g.fillStyle = '#d9d1f2'; circ(g, -4, -42, 2.6); g.fill(); circ(g, 4, -44, 2.2); g.fill(); g.fillStyle = '#ffffff'; circ(g, -7.5, -46, 1.8); g.fill(); circ(g, 1, -49.5, 1.6); g.fill();
    g.shadowColor = '#c9a6ff'; g.shadowBlur = 6 + pu * 7; g.fillStyle = '#9a5cff'; g.fillRect(1, -40, 2.6, 3.6); g.fillRect(5.6, -40, 2.6, 3.6); g.shadowBlur = 0; g.fillStyle = '#fff'; g.fillRect(1.6, -39.6, 1, 1.2); g.fillRect(6.2, -39.6, 1, 1.2);
    g.strokeStyle = 'rgba(190,140,255,' + (0.35 + pu * 0.35) + ')'; g.lineWidth = 1; g.beginPath(); g.moveTo(8.4, -38.6); g.quadraticCurveTo(12, -41 - pu, 13.5, -44 - pu * 2); g.stroke();
    g.strokeStyle = '#2a2030'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0.4, -41.6); g.lineTo(4, -40.8); g.moveTo(5, -40.8); g.lineTo(8.8, -41.8); g.stroke();
    // coroa
    const cg = g.createLinearGradient(0, -61, 0, -47); cg.addColorStop(0, '#fff3b0'); cg.addColorStop(0.5, '#f5c542'); cg.addColorStop(1, '#c08a1e');
    g.fillStyle = cg; g.beginPath(); g.moveTo(-9.5, -47); g.lineTo(-11, -55.5); g.lineTo(-6.5, -50); g.lineTo(-4.8, -58); g.lineTo(-2, -50.5); g.lineTo(0, -63); g.lineTo(2, -50.5); g.lineTo(4.8, -58); g.lineTo(6.5, -50); g.lineTo(11, -55.5); g.lineTo(9.5, -47); g.closePath(); g.fill();
    g.fillStyle = '#b8801a'; g.fillRect(-9.5, -48.6, 19, 2); g.fillStyle = '#fff3b0'; g.fillRect(-9.5, -49.2, 19, 0.7);
    g.shadowColor = '#c9a6ff'; g.shadowBlur = 6 + pu * 8; g.fillStyle = '#b07aff'; g.beginPath(); g.moveTo(0, -56); g.lineTo(2.4, -52); g.lineTo(0, -48.6); g.lineTo(-2.4, -52); g.closePath(); g.fill(); g.shadowBlur = 0;
    g.fillStyle = '#b07aff'; circ(g, -6.4, -48, 0.9); g.fill(); circ(g, 6.4, -48, 0.9); g.fill();
    // brilho em cruz na gema da coroa
    g.save(); g.translate(0, -52.3); g.rotate(t * 0.8); g.globalAlpha = 0.35 + pu * 0.55; g.fillStyle = '#ffffff'; for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -0.7); g.lineTo(5 + pu * 3, 0); g.lineTo(0, 0.7); g.closePath(); g.fill(); } g.restore();
    // auréola (metade da frente) com estrelas orbitando
    g.strokeStyle = 'rgba(255,214,110,0.95)'; g.lineWidth = 1.7; g.shadowColor = '#ffd66e'; g.shadowBlur = 10; g.beginPath(); g.ellipse(0, -37, 17.5, 4.6, 0, 0.22, Math.PI - 0.22); g.stroke();
    for (let k = 0; k < 3; k++) { const a = hr + k * 2.094, y = Math.sin(a); if (y < 0) continue; g.fillStyle = '#fffbe0'; circ(g, Math.cos(a) * 17.5, -37 + y * 4.6, 1.3); g.fill(); } g.shadowBlur = 0;
  },
  padreh(g) {
    g.fillStyle = '#15141a'; g.beginPath(); g.moveTo(-8.5, -31); g.lineTo(8.5, -31); g.lineTo(12.5, -1); g.lineTo(-12.5, -1); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(-0.6, -28, 1.2, 27);
    g.fillStyle = '#15141a'; rrect(g, -12, -30, 5, 13, 2.5); g.fill();
    for (const s of [-1, 1]) { g.fillStyle = '#5b2aa8'; g.beginPath(); g.moveTo(s * 3, -31); g.lineTo(s * 7.5, -31); g.lineTo(s * 9, -7); g.lineTo(s * 4.5, -7); g.closePath(); g.fill(); g.strokeStyle = '#e8b53a'; g.lineWidth = 1; g.beginPath(); g.moveTo(s * 3, -31); g.lineTo(s * 4.5, -7); g.lineTo(s * 9, -7); g.lineTo(s * 7.5, -31); g.stroke(); g.fillStyle = '#e8b53a'; g.fillRect(s * 6.6 - 0.6, -15, 1.2, 5); g.fillRect(s * 6.6 - 2, -13.6, 4, 1.2); }
    g.fillStyle = '#ffffff'; g.fillRect(-2.6, -31.5, 5.2, 2.8);
    g.strokeStyle = '#e8b53a'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-2.6, -29); g.lineTo(0, -23.5); g.lineTo(2.6, -29); g.stroke(); g.fillStyle = '#f5c542'; g.fillRect(-0.7, -24, 1.4, 5.2); g.fillRect(-2.2, -22.6, 4.4, 1.4);
    g.fillStyle = '#f4d3b5'; circ(g, 0, -39, 9.5); g.fill();
    g.fillStyle = '#8f7f76'; g.beginPath(); g.arc(0, -40.5, 10, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(8, -45); g.lineTo(5, -43.5); g.lineTo(1, -45.5); g.lineTo(-3, -43.5); g.lineTo(-7, -44.5); g.lineTo(-9.6, -39); g.closePath(); g.fill();
    g.fillStyle = '#a89a90'; g.beginPath(); g.moveTo(-6, -48.5); g.lineTo(-1, -52); g.lineTo(5, -50); g.lineTo(2, -47.5); g.closePath(); g.fill();
    g.fillStyle = '#1a1420'; circ(g, 2.2, -38.4, 1.5); g.fill(); circ(g, 6.6, -38.4, 1.5); g.fill();
    g.strokeStyle = '#1a1420'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0.4, -41.2); g.lineTo(3.8, -40.4); g.moveTo(5.2, -40.4); g.lineTo(8.6, -41.4); g.stroke();
    g.fillStyle = '#fff'; g.strokeStyle = '#1a1420'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(1.2, -35); g.quadraticCurveTo(4.6, -31.4, 8, -35.4); g.closePath(); g.fill(); g.stroke();
  },
  tanderw(g, t) {
    const sw = Math.sin(t * 3);
    // cachecol esvoaçando atrás
    g.fillStyle = '#2f8a56'; g.beginPath(); g.moveTo(-6, -31); g.quadraticCurveTo(-16, -30 + sw * 2, -22, -24 + sw * 4); g.lineTo(-20, -19 + sw * 4); g.quadraticCurveTo(-14, -25 + sw * 2, -6, -27); g.closePath(); g.fill();
    const gr = g.createLinearGradient(0, -32, 0, -8); gr.addColorStop(0, '#d79a58'); gr.addColorStop(1, '#a86c34');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-8.5, -31); g.lineTo(8.5, -31); g.lineTo(10.5, -9); g.lineTo(-10.5, -9); g.closePath(); g.fill();
    g.fillStyle = '#f5e6c8'; rrect(g, -5.5, -28, 11, 12.5, 3); g.fill();
    // emblema de chihuahua no peito
    g.fillStyle = '#8a5a2b'; g.beginPath(); g.moveTo(-4.2, -22.5); g.lineTo(-4.8, -27.4); g.lineTo(-1.6, -24.6); g.closePath(); g.fill(); g.beginPath(); g.moveTo(4.2, -22.5); g.lineTo(4.8, -27.4); g.lineTo(1.6, -24.6); g.closePath(); g.fill();
    circ(g, 0, -21.6, 3.2); g.fill(); g.fillStyle = '#f5e6c8'; ell(g, 0, -20.4, 1.5, 1.2); g.fill(); g.fillStyle = '#2a1a10'; circ(g, -1.3, -22.3, 0.55); g.fill(); circ(g, 1.3, -22.3, 0.55); g.fill(); circ(g, 0, -20.7, 0.5); g.fill();
    g.fillStyle = '#5a3a20'; g.fillRect(-10.5, -13.5, 21, 3); g.fillStyle = '#f2c230'; rrect(g, -2.4, -14.2, 4.8, 4.4, 1); g.fill(); g.fillStyle = '#8a5a2b'; circ(g, 0, -12, 1.1); g.fill();
    g.fillStyle = '#c98a4b'; rrect(g, -12, -30, 5, 13, 2.5); g.fill(); g.fillStyle = '#f5e6c8'; g.fillRect(-12, -20.5, 5, 2.4);
    g.fillStyle = '#3fa66a'; rrect(g, -8.5, -33, 17, 4.6, 2.3); g.fill(); g.fillStyle = '#2f8a56'; g.fillRect(-3, -31.5, 1.2, 3); g.fillRect(2, -31.5, 1.2, 3);
    // cabeça com capuz de orelhas pontudas
    for (const s of [-1, 1]) { g.save(); g.translate(s * 7, -46); g.rotate(s * (0.32 + sw * 0.05)); g.fillStyle = '#c98a4b'; g.beginPath(); g.moveTo(-4.2, 1); g.quadraticCurveTo(s * 1.5, -14, s * 2.5, -17); g.quadraticCurveTo(s * 5, -8, 4.2, 1); g.closePath(); g.fill(); g.fillStyle = '#f2b8a8'; g.beginPath(); g.moveTo(-2, 0); g.quadraticCurveTo(s * 1.4, -9, s * 2.2, -12.5); g.quadraticCurveTo(s * 3, -6, 2, 0); g.closePath(); g.fill(); g.restore(); }
    g.fillStyle = '#f4d3b5'; circ(g, 0, -39, 9.5); g.fill();
    g.fillStyle = '#c98a4b'; g.beginPath(); g.arc(0, -40, 10.6, Math.PI * 0.98, Math.PI * 2.02); g.quadraticCurveTo(6, -44.5, 0, -44); g.quadraticCurveTo(-6, -44.5, -10.6, -39); g.closePath(); g.fill();
    g.fillStyle = '#f5e6c8'; ell(g, 0, -47.6, 3.4, 2.3); g.fill(); g.fillStyle = '#2a1a10'; circ(g, -3.6, -48.6, 0.9); g.fill(); circ(g, 3.6, -48.6, 0.9); g.fill(); ell(g, 0, -47.9, 1.1, 0.8); g.fill();
    g.fillStyle = '#4a2e18'; circ(g, 2.2, -38.6, 1.6); g.fill(); circ(g, 6.6, -38.6, 1.6); g.fill(); g.fillStyle = '#fff'; circ(g, 2.7, -39.1, 0.55); g.fill(); circ(g, 7.1, -39.1, 0.55); g.fill();
    g.strokeStyle = '#4a2e18'; g.lineWidth = 1.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(2.4, -34.8); g.quadraticCurveTo(4.6, -32.8, 6.8, -34.8); g.stroke();
    g.fillStyle = 'rgba(255,130,120,0.4)'; ell(g, 7.2, -35.6, 2, 1.1); g.fill();
  },
};

const SKIN_FX = {
  godslayer: {
    back(g, t) {
      const pu = 0.5 + Math.sin(t * 2.2) * 0.5;
      // círculo arcano no chão
      g.save(); g.scale(1, 0.36); g.rotate(t * 0.7); g.lineWidth = 1.6; g.shadowColor = '#b58cff'; g.shadowBlur = 12;
      g.strokeStyle = 'rgba(255,214,110,' + (0.55 + pu * 0.3) + ')'; circ(g, 0, 0, 30); g.stroke(); g.strokeStyle = 'rgba(190,140,255,' + (0.5 + pu * 0.3) + ')'; circ(g, 0, 0, 24); g.stroke();
      g.beginPath(); for (let k = 0; k < 2; k++) for (let i = 0; i < 3; i++) { const a = k * Math.PI + i * 2.0944 - Math.PI / 2, a2 = a + 2.0944; g.moveTo(Math.cos(a) * 24, Math.sin(a) * 24); g.lineTo(Math.cos(a2) * 24, Math.sin(a2) * 24); } g.stroke();
      g.fillStyle = 'rgba(255,230,160,0.95)'; for (let i = 0; i < 8; i++) { const a = i * 0.7854; g.beginPath(); g.arc(Math.cos(a) * 27, Math.sin(a) * 27, 1.6, 0, 6.3); g.fill(); }
      g.restore();
      const gr = g.createRadialGradient(0, -2, 2, 0, -2, 30); gr.addColorStop(0, 'rgba(176,120,255,' + (0.3 + pu * 0.15) + ')'); gr.addColorStop(1, 'rgba(176,120,255,0)'); g.fillStyle = gr; ell(g, 0, -2, 30, 11); g.fill();
      // raios de luz e brilho atrás do corpo
      g.save(); g.translate(0, -34); g.rotate(t * 0.25);
      for (let i = 0; i < 10; i++) { g.rotate(0.6283); const L = 34 + Math.sin(t * 2 + i * 1.7) * 8; const lg = g.createLinearGradient(0, 0, 0, -L); lg.addColorStop(0, i % 2 ? 'rgba(255,220,130,0.34)' : 'rgba(190,140,255,0.3)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(-2.6, 0); g.lineTo(0, -L); g.lineTo(2.6, 0); g.closePath(); g.fill(); }
      g.restore();
      const hg = g.createRadialGradient(0, -30, 4, 0, -30, 34); hg.addColorStop(0, 'rgba(160,110,255,0.34)'); hg.addColorStop(1, 'rgba(160,110,255,0)'); g.fillStyle = hg; circ(g, 0, -30, 34); g.fill();
      SKIN_FX.godslayer.shards(g, t, false);
    },
    shards(g, t, front) {
      for (let k = 0; k < 4; k++) {
        const a = t * 1.7 + k * 1.5708, z = Math.sin(a); if ((z > 0) !== front) continue;
        const x = Math.cos(a) * 23, y = -24 + z * 5 + Math.sin(t * 2.5 + k) * 3, sc = 0.85 + z * 0.25;
        g.save(); g.translate(x, y); g.scale(sc, sc); g.rotate(Math.sin(t * 2 + k) * 0.3); g.shadowColor = '#c9a6ff'; g.shadowBlur = 10;
        g.fillStyle = k % 2 ? '#ffd66e' : '#a06bff'; g.beginPath(); g.moveTo(0, -5.5); g.lineTo(2.6, 0); g.lineTo(0, 5.5); g.lineTo(-2.6, 0); g.closePath(); g.fill(); g.shadowBlur = 0;
        g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.moveTo(0, -5.5); g.lineTo(-2.6, 0); g.lineTo(-0.6, 0); g.closePath(); g.fill(); g.restore();
      }
    },
    front(g, t) {
      SKIN_FX.godslayer.shards(g, t, true);
      for (let k = 0; k < 9; k++) {
        const ph = ((t * 0.55 + k / 9) % 1), al = Math.sin(Math.PI * ph); if (al < 0.05) continue;
        const x = (hash2(k, 3, 55) - 0.5) * 40 + Math.sin(t * 1.5 + k) * 3, y = 2 - ph * 66, r = 1 + hash2(k, 5, 55) * 1.3;
        g.fillStyle = (k % 2 ? 'rgba(255,224,140,' : 'rgba(200,160,255,') + al + ')'; g.shadowColor = k % 2 ? '#ffd66e' : '#b58cff'; g.shadowBlur = 6;
        if (k % 3 === 0) { g.beginPath(); g.moveTo(x, y - r * 2.4); g.lineTo(x + r * 0.6, y - r * 0.6); g.lineTo(x + r * 2.4, y); g.lineTo(x + r * 0.6, y + r * 0.6); g.lineTo(x, y + r * 2.4); g.lineTo(x - r * 0.6, y + r * 0.6); g.lineTo(x - r * 2.4, y); g.lineTo(x - r * 0.6, y - r * 0.6); g.closePath(); g.fill(); } else { circ(g, x, y, r); g.fill(); }
      }
      g.shadowBlur = 0;
    },
  },
};
SKIN_FX.tanderw = {
  bone(g, t, front) {
    const a = t * 1.9, z = Math.sin(a); if ((z > 0) !== front) return;
    g.save(); g.translate(Math.cos(a) * 22, -26 + z * 5 + Math.sin(t * 2.6) * 2); g.rotate(t * 1.3); const sc = 0.9 + z * 0.2; g.scale(sc, sc);
    g.shadowColor = '#ffd66e'; g.shadowBlur = 9; g.fillStyle = '#f5c542'; g.fillRect(-4.5, -1.3, 9, 2.6); for (const [x, y] of [[-5, -1.6], [-5, 1.6], [5, -1.6], [5, 1.6]]) { circ(g, x, y, 2); g.fill(); }
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,250,210,0.8)'; g.fillRect(-4, -1, 8, 0.8); g.restore();
  },
  back(g, t) { SKIN_FX.tanderw.bone(g, t, false); },
  front(g, t) { SKIN_FX.tanderw.bone(g, t, true); },
};
function skinTitle(g, x, y, skin, t, moving) {
  if (skin === 'tanderw' && moving && Math.random() < 0.09) RD.parts.push({ paw: 1, x: x + (Math.random() - 0.5) * 12, y: y + 80 + Math.random() * 4, life: 1.3, max: 1.3 });
  if (skin !== 'godslayer') return 0;
  g.save(); g.shadowColor = '#ffd66e'; g.shadowBlur = 10 + Math.sin(t * 3) * 4; drawLabel(g, x, y, '✦ GODSLAYER ✦', '#ffe58a', 11, true); g.restore();
  if (moving && Math.random() < 0.4) RD.parts.push({ x: x + (Math.random() - 0.5) * 22, y: y + 46 + Math.random() * 30, vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 40, life: 0.7, max: 0.7, color: Math.random() < 0.5 ? '#ffd66e' : '#b58cff', size: 2 + Math.random() * 1.5 });
  return 13;
}
