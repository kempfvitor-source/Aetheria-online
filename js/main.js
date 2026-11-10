'use strict';
/* ============ Som, entrada e laço principal ============ */
const Sfx = {
  ctx: null, last: {},
  unlock() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { } },
  tone(f, d, type, vol, to, delay) { const c = this.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02); },
  play(n) {
    if (!this.ctx || !S || !S.opts.sfx || this.ctx.state !== 'running') return; const now = performance.now(); if (now - (this.last[n] || 0) < 50) return; this.last[n] = now;
    try {
      switch (n) {
        case 'hit': this.tone(180, 0.07, 'square', 0.05, 90); break; case 'crit': this.tone(520, 0.12, 'square', 0.06, 160); break;
        case 'swing': this.tone(320, 0.08, 'triangle', 0.05, 120); break; case 'shoot': this.tone(700, 0.09, 'triangle', 0.04, 300); break;
        case 'skill': this.tone(300, 0.22, 'sawtooth', 0.05, 900); break; case 'hurt': this.tone(140, 0.12, 'sawtooth', 0.06, 70); break;
        case 'potion': this.tone(500, 0.15, 'sine', 0.07, 900); break; case 'coin': this.tone(1200, 0.07, 'square', 0.03); this.tone(1600, 0.09, 'square', 0.03, 0, 0.06); break;
        case 'ui': this.tone(660, 0.05, 'sine', 0.04); break; case 'equip': this.tone(240, 0.1, 'square', 0.04, 480); break; case 'gather': this.tone(440, 0.1, 'triangle', 0.06, 660); break;
        case 'level': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.07, 0, i * 0.1)); break;
        case 'quest': [659, 880, 1175].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.07, 0, i * 0.09)); break;
        case 'rare': [784, 988, 1319, 1568].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.06, 0, i * 0.07)); break;
        case 'death': this.tone(300, 0.6, 'sawtooth', 0.06, 50); break; case 'portal': this.tone(200, 0.5, 'sine', 0.07, 1200); break;
      }
    } catch (e) { }
  },
};

function stagePt(e) { return UI.rot ? { x: e.clientY, y: window.innerWidth - e.clientX } : { x: e.clientX, y: e.clientY }; }
function layout() {
  const st = $('stage'), rot = UI.touch && window.innerHeight > window.innerWidth; UI.rot = rot; document.body.classList.toggle('rot', rot);
  if (rot) { st.style.width = window.innerHeight + 'px'; st.style.height = window.innerWidth + 'px'; st.style.left = window.innerWidth + 'px'; } else { st.style.width = st.style.height = st.style.left = ''; }
  resizeCanvas(); document.body.classList.toggle('short', RD.SH < 480);
}
function goFull(manual) {
  if (!UI.touch && !manual) return;
  try { const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen; if (!rq) { if (manual) UI.toast('Tela cheia indisponível aqui.', 'bad'); return; }
    Promise.resolve(rq.call(el, { navigationUI: 'hide' })).then(() => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } setTimeout(layout, 300); }).catch(() => { if (manual) UI.toast('Tela cheia indisponível aqui.', 'bad'); });
  } catch (e) { }
}
function attackNearest() { if (P.dead) return; let m = P.target && !P.target.dead ? P.target : nearestMob(480); if (!m) { UI.toast('Nenhum inimigo por perto.', 'bad'); return; } P.target = m; P.engage = true; P.moveTo = null; P.cast = null; }
function nextTarget() { const l = G.mobs.filter(m => !m.dead && dist(P, m) < 560).sort((a, b) => dist(P, a) - dist(P, b)); if (!l.length) return; const i = l.indexOf(P.target); P.target = l[(i + 1) % l.length]; }
function pickAt(wx, wy) {
  let best = null, bd = 1e9; const W = G.world;
  for (const m of G.mobs) { if (m.dead) continue; const d = Math.hypot(m.x - wx, m.y - mobHeight(m) * 0.45 - wy); if (d < m.rad + 22 && d < bd) { bd = d; best = { type: 'mob', o: m }; } }
  if (best) return best;
  for (const n of W.npcs) { const d = Math.hypot(n.x - wx, n.y - 28 - wy); if (d < 40 && d < bd) { bd = d; best = { type: 'npc', o: n }; } }
  for (const p of W.portals) { const d = Math.hypot(p.x - wx, p.y - 26 - wy); if (d < 48 && d < bd) { bd = d; best = { type: 'portal', o: p }; } }
  for (const n of W.nodes) { if (G.time < n.readyAt) continue; const d = Math.hypot(n.x - wx, n.y - 16 - wy); if (d < 32 && d < bd) { bd = d; best = { type: 'node', o: n }; } }
  return best;
}
function downAct(a) {
  if (!G.started) return; Sfx.unlock(); const p = a.split(':');
  if (p[0] === 'skill') useSkill(+p[1]); else if (p[0] === 'pot') usePotion(p[1]); else if (p[0] === 'attack') attackNearest(); else if (p[0] === 'nexttarget') nextTarget();
}

function setupInput() {
  const cv = RD.cv, isTyping = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
  const WINKEY = { KeyC: 'char', KeyI: 'inv', KeyK: 'skills', KeyL: 'quests', KeyP: 'prof', KeyO: 'wings', KeyV: 'skins', KeyM: 'map', KeyR: 'rank' };
  window.addEventListener('keydown', e => {
    if (isTyping()) { if (e.code === 'Escape') document.activeElement.blur(); return; }
    if (!G.started) return; if (e.ctrlKey || e.metaKey || e.altKey) return;
    G.keys[e.code] = true; Sfx.unlock();
    if (e.repeat) { if (e.code === 'Space' || e.code === 'Tab') e.preventDefault(); return; }
    if (e.code === 'Space') { e.preventDefault(); attackNearest(); }
    else if (e.code.startsWith('Digit') && +e.code[5] >= 1 && +e.code[5] <= 4) useSkill(+e.code[5] - 1);
    else if (e.code === 'KeyQ') usePotion('hp'); else if (e.code === 'KeyE') usePotion('mp'); else if (e.code === 'KeyF') interact();
    else if (e.code === 'Tab') { e.preventDefault(); nextTarget(); }
    else if (e.code === 'Enter') { e.preventDefault(); $('chat').classList.add('open'); $('chatin').focus(); }
    else if (e.code === 'Escape') { if (UI.wins.length || !$('modal').classList.contains('hidden')) UI.closeAll(); else { P.target = null; P.engage = false; } }
    else if (WINKEY[e.code]) UI.toggle(WINKEY[e.code]);
  });
  window.addEventListener('keyup', e => { G.keys[e.code] = false; });
  window.addEventListener('blur', () => { G.keys = {}; G.input.x = G.input.y = 0; });
  cv.addEventListener('pointerdown', e => {
    if (!G.started || P.dead) return; Sfx.unlock(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    $('menu').classList.remove('open');
    const sp = stagePt(e), w = screenToWorld(sp.x, sp.y), hit = pickAt(w.x, w.y);
    if (hit && hit.type === 'mob') { P.target = hit.o; P.engage = true; P.moveTo = null; P.cast = null; }
    else if (hit) { const f = findNear(); if (dist(P, hit.o) < 64) interact({ type: hit.type, o: hit.o }); else { P.moveTo = { x: hit.o.x, y: hit.o.y + (hit.type === 'npc' ? 30 : 0), ent: { type: hit.type, o: hit.o } }; P.engage = false; P.cast = null; } }
    else { P.moveTo = { x: w.x, y: w.y }; P.engage = false; P.cast = null; }
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  // joystick virtual
  const joy = $('joy'), knob = $('joyk'); let jid = null;
  const jmove = e => { const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = joy.offsetWidth / 2 - 14; let dx = e.clientX - cx, dy = e.clientY - cy; if (UI.rot) { const t = dx; dx = dy; dy = -t; } const d = Math.hypot(dx, dy); if (d > max) { dx = dx / d * max; dy = dy / d * max; } knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; const dead = 0.18, nx = dx / max, ny = dy / max; G.input.x = Math.abs(nx) > dead || Math.abs(ny) > dead ? nx : 0; G.input.y = Math.abs(nx) > dead || Math.abs(ny) > dead ? ny : 0; };
  const jend = e => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; G.input.x = G.input.y = 0; };
  joy.addEventListener('pointerdown', e => { e.preventDefault(); jid = e.pointerId; try { joy.setPointerCapture(jid); } catch (x) { } Sfx.unlock(); jmove(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend); joy.addEventListener('lostpointercapture', jend);
  document.addEventListener('pointerdown', e => { const el = e.target.closest && e.target.closest('[data-down]'); if (el) { e.preventDefault(); downAct(el.dataset.down); } });
  document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('[data-act]'); if (el) { Sfx.unlock(); UI.runAct(el.dataset.act); } });
  $('prompt').addEventListener('click', () => interact());
  $('menubtn').addEventListener('click', () => { $('menu').classList.toggle('open'); $('chat').classList.remove('open'); });
  $('chatbtn').addEventListener('click', () => { const c = $('chat'); c.classList.toggle('open'); $('chatbtn').style.boxShadow = ''; $('menu').classList.remove('open'); if (c.classList.contains('open')) { const l = $('chatlog'); l.scrollTop = l.scrollHeight; } });
  $('chatform').addEventListener('submit', e => { e.preventDefault(); const i = $('chatin'); if (i.value.trim()[0] === '/') runCommand(i.value); else if (i.value.trim()) Net.say(i.value); i.value = ''; i.blur(); if (UI.touch) $('chat').classList.remove('open'); });
  window.addEventListener('resize', layout); window.addEventListener('orientationchange', () => setTimeout(layout, 250)); document.addEventListener('fullscreenchange', () => setTimeout(layout, 150));
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.started) { saveLocal(); G.keys = {}; } });
  window.addEventListener('pagehide', () => { if (G.started) saveLocal(); });
  const setTouch = () => { if (UI.touch) return; UI.touch = true; document.body.classList.add('touch'); layout(); };
  if ((window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && window.innerWidth < 1000)) setTouch();
  window.addEventListener('touchstart', setTouch, { once: true, passive: true });
}

function titleBg(t) {
  const cv = $('titlebg'), w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#120a2e'); gr.addColorStop(0.55, '#2a1a5e'); gr.addColorStop(1, '#0f2a3a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { const x = hash2(i, 1, 3) * w, y = hash2(i, 2, 3) * h * 0.8, a = 0.3 + Math.sin(t * (0.5 + hash2(i, 3, 3) * 2) + i) * 0.3; g.fillStyle = 'rgba(255,240,210,' + Math.max(0, a) + ')'; g.fillRect(x, y, 1.6, 1.6); }
  for (let l = 0; l < 3; l++) { g.fillStyle = ['#1a1240', '#140e33', '#0c0a22'][l]; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 24) g.lineTo(x, h - 60 - l * -26 - fnoise(x / 260 + l * 9 + t * 0.01 * (l + 1), l, 5) * (170 - l * 40)); g.lineTo(w, h); g.fill(); }
  for (let i = 0; i < 26; i++) { const x = (hash2(i, 5, 8) * w + t * 12 * (0.4 + hash2(i, 6, 8))) % w, y = h - ((hash2(i, 7, 8) * h + t * 18 * (0.5 + hash2(i, 8, 8))) % h); g.fillStyle = 'rgba(201,166,255,' + (0.25 + hash2(i, 9, 8) * 0.4) + ')'; g.beginPath(); g.arc(x, y, 1.5 + hash2(i, 4, 8) * 2, 0, 6.3); g.fill(); }
}

let _last = 0;
function loop(ts) {
  requestAnimationFrame(loop); const dt = Math.min(0.05, (ts - _last) / 1000 || 0.016); _last = ts;
  if (G.started && S) { update(dt); render(G.time); UI.frame(dt); } else titleBg(ts / 1000);
}
function boot() {
  RD.cv = $('cv'); RD.g = RD.cv.getContext('2d'); layout(); setupInput();
  const local = loadLocal(); UI.title(local); Net.init();
  Net.whenReady(() => { UI.netStatus(); if (G.started) { Net.setZone(G.world.id); Net.pushRank(); Net.watchGrants(); UI.dirty.win = 1; return; } const c = Net.cloudSave; if (c && (!local || (c.t || 0) > (local.t || 0))) UI.title(c); });
  requestAnimationFrame(loop);
}
window.addEventListener('error', e => { try { console.error('ERR', e.message, e.filename, e.lineno); } catch (x) { } });
boot();
