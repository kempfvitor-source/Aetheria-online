'use strict';
/* ============ Lógica do jogo ============ */
const G = { world: null, mobs: [], peers: new Map(), time: 0, started: false, qMark: null, input: { x: 0, y: 0 }, keys: {}, near: null, saveT: 0, achT: 0 };
let S = null;
const P = { x: 0, y: 0, dir: 1, moving: false, atkT: 0, atkCd: 0, hp: 1, mp: 1, target: null, engage: false, cds: {}, buffs: [], shield: 0, lastCombat: -99, cast: null, dead: false, moveTo: null, st: { maxHp: 1, maxMp: 1 }, potCd: 0, bubble: null, bubbleT: 0,
  lvlOk(z) { return S.lvl >= zoneReq(z); } };
const SAVE_KEY = 'aetheria_save_v1';
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => Math.floor(n).toLocaleString('pt-BR');
function zoneReq(z) { return z.safe ? 1 : Math.max(1, z.lvl[0] - 1); }
function today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

/* ---------- Save ---------- */
function newSave(name, cls) {
  const s = { v: 1, name, cls, lvl: 1, xp: 0, gold: 60, gems: 0, attr: { str: 0, agi: 0, int: 0, vit: 0 }, pts: 0, sp: 0, skills: {}, inv: new Array(INV_SIZE).fill(null), eq: {}, zone: 0, x: 0, y: 0,
    quests: { done: {}, active: {} }, daily: { date: '', list: [] }, wings: { t: 0, s: 0 }, prof: {}, stats: { kills: 0, bosses: 0, deaths: 0, maxEnh: 0, gathers: 0, crafts: 0, legend: 0, played: 0 }, ach: {}, login: { date: '', streak: 0 }, disc: { 0: 1 }, opts: { sfx: true }, created: Date.now(), t: Date.now() };
  for (const k in PROFS) s.prof[k] = { l: 1, xp: 0 };
  s.skills[CLASSES[cls].skills[0].id] = 1;
  s.eq.weapon = genEquip(1, { slot: 'weapon', r: 0, cls });
  s.inv[0] = { id: 'hp1', q: 8 }; s.inv[1] = { id: 'mp1', q: 5 }; s.inv[2] = { id: 'scroll', q: 2 };
  return s;
}
function validSave(s) { return s && s.v === 1 && typeof s.name === 'string' && CLASSES[s.cls] && s.lvl >= 1 && s.lvl <= MAX_LEVEL && Array.isArray(s.inv) && s.eq && s.quests && s.wings && s.prof && s.stats; }
function loadLocal() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return validSave(s) ? s : null; } catch (e) { return null; } }
function saveLocal() { if (!S) return; S.x = Math.round(P.x); S.y = Math.round(P.y); S.t = Date.now(); S.power = P.st.power | 0; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
function saveAll(cloud) { saveLocal(); if (cloud) Net.saveCloud(S); }

/* ---------- Equipamentos ---------- */
function rollRarity(bonus) { const r = Math.random() * (1 - (bonus || 0)); return r < 0.004 ? 4 : r < 0.028 ? 3 : r < 0.12 ? 2 : r < 0.4 ? 1 : 0; }
function genEquip(ilvl, o) {
  o = o || {}; ilvl = Math.max(1, Math.min(MAX_LEVEL, Math.round(ilvl)));
  const slot = o.slot || pick(['weapon', 'weapon', 'helm', 'chest', 'chest', 'gloves', 'boots', 'ring', 'amulet']);
  let r = o.r != null ? o.r : rollRarity(o.bonus); if (o.minR) r = Math.max(r, o.minR);
  const m = RARITY[r].m, cls = o.cls || (S && S.cls) || 'warrior', e = { eq: 1, slot, ilvl, r, enh: 0, aff: {} }, tier = tierOfLevel(ilvl);
  if (slot === 'weapon') { e.atk = Math.round((5 + ilvl * 3) * m); e.cls = cls; e.name = CLASSES[cls].weapon + ' ' + TIER_PREFIX[tier]; }
  else if (slot === 'ring') { e.atk = Math.round((1 + ilvl * 0.7) * m); e.name = 'Anel ' + TIER_PREFIX[tier]; }
  else if (slot === 'amulet') { e.hp = Math.round((18 + ilvl * 8) * m); e.name = 'Amuleto ' + TIER_PREFIX[tier]; }
  else { const k = { helm: 0.9, chest: 1.3, gloves: 0.65, boots: 0.65 }[slot]; e.def = Math.round((2 + ilvl * k) * m); e.name = SLOT_NAME[slot] + ' ' + TIER_PREFIX[tier]; }
  const main = CLASSES[cls].main, pool = ['str', 'agi', 'int', 'vit', 'hp', 'crit', 'mp', main[0], 'vit'];
  for (let i = 0; i < r; i++) {
    const k = pick(pool);
    const v = k === 'hp' ? Math.round(ilvl * 5 * rnd(0.7, 1.3) + 10) : k === 'mp' ? Math.round(ilvl * 3 * rnd(0.7, 1.3) + 6) : k === 'crit' ? Math.round(rnd(1, 3) + r * 0.5) : Math.max(1, Math.round((1 + ilvl * 0.24) * rnd(0.7, 1.3)));
    e.aff[k] = (e.aff[k] || 0) + v;
  }
  return e;
}
function eqSell(e) { const m = RARITY[e.r].m; return Math.round((5 + e.ilvl * 4) * m * m * (1 + e.enh * 0.25)); }
function eqScore(e) { if (!e) return 0; const em = 1 + e.enh * 0.08; let s = (e.atk || 0) * em * 1.0 + (e.def || 0) * em * 1.3 + (e.hp || 0) * em * 0.12; for (const k in e.aff) s += e.aff[k] * (k === 'hp' ? 0.12 : k === 'mp' ? 0.08 : k === 'crit' ? 4 : 2.2); return Math.round(s); }
function itemName(it) { return it.eq ? it.name + (it.enh ? ' +' + it.enh : '') : ITEMS[it.id].name; }

/* ---------- Inventário ---------- */
function countItem(id) { let n = 0; for (const it of S.inv) if (it && it.id === id) n += it.q; return n; }
function addItem(id, q) {
  q = q || 1; for (const it of S.inv) if (it && it.id === id) { it.q += q; UI.dirty.inv = 1; return true; }
  const i = S.inv.indexOf(null); if (i < 0) { UI.toast('Mochila cheia!', 'bad'); return false; }
  S.inv[i] = { id, q }; UI.dirty.inv = 1; return true;
}
function addEquip(e) { const i = S.inv.indexOf(null); if (i < 0) { UI.toast('Mochila cheia! Item perdido: ' + e.name, 'bad'); return false; } S.inv[i] = e; UI.dirty.inv = 1; if (e.r >= 4) S.stats.legend++; return true; }
function removeItem(id, q) { for (let i = 0; i < S.inv.length; i++) { const it = S.inv[i]; if (it && it.id === id) { const t = Math.min(q, it.q); it.q -= t; q -= t; if (it.q <= 0) S.inv[i] = null; if (q <= 0) break; } } UI.dirty.inv = 1; }
function hasAll(need) { return need.every(([id, q]) => countItem(id) >= q); }
function gainGold(n) { S.gold += Math.round(n); UI.dirty.hud = 1; }

/* ---------- Atributos derivados ---------- */
function passiveVal(stat) { let v = 0; for (const p of CLASSES[S.cls].passives) if (p.stat === stat) v += (S.skills[p.id] || 0) * p.per; return v; }
function totalAttrs() { const C = CLASSES[S.cls], a = { str: C.base.str + S.attr.str, agi: C.base.agi + S.attr.agi, int: C.base.int + S.attr.int, vit: C.base.vit + S.attr.vit }; for (const sl in S.eq) { const e = S.eq[sl]; if (e) for (const k in e.aff) if (k in a) a[k] += e.aff[k]; } return a; }
function recalc() {
  const C = CLASSES[S.cls], a = totalAttrs(), L = S.lvl; let wAtk = 0, def = 0, hp = 0, mp = 0, crit = 0;
  for (const sl in S.eq) { const e = S.eq[sl]; if (!e) continue; const em = 1 + e.enh * 0.08; if (e.atk) wAtk += e.atk * em; if (e.def) def += e.def * em; if (e.hp) hp += e.hp * em; if (e.aff.hp) hp += e.aff.hp; if (e.aff.mp) mp += e.aff.mp; if (e.aff.crit) crit += e.aff.crit; }
  const b = { atk: 0, def: 0, spd: 0, dodge: 0, regen: 0 }; for (const bf of P.buffs) for (const k in b) if (bf[k]) b[k] += bf[k];
  let main = 0; for (const m of C.main) main += a[m]; main /= C.main.length;
  const wb = wingBonus(S.wings), st = P.st;
  st.attrs = a; st.atk = Math.round((wAtk + main * 2.2 + L * 1.5) * (1 + wb) * (1 + b.atk));
  st.def = Math.round((def + a.vit * 1.0 + L * 0.5) * (1 + wb) * (1 + passiveVal('defPct') / 100) * (1 + b.def));
  st.maxHp = Math.round((C.hp + C.hpL * (L - 1) + a.vit * 12 + hp) * (1 + wb) * (1 + passiveVal('hpPct') / 100));
  st.maxMp = Math.round(C.mp + C.mpL * (L - 1) + a.int * 6 + mp);
  st.crit = Math.min(70, 5 + a.agi * 0.12 + crit + passiveVal('crit')); st.dodge = Math.min(45, a.agi * 0.08 + b.dodge);
  st.aspd = Math.max(0.42, (C.ranged ? 1.1 : 1.0) / (1 + a.agi * 0.004 + passiveVal('aspd') / 100));
  st.spd = 195 * (1 + b.spd); st.dmgPct = passiveVal('dmgPct') / 100; st.mpRegen = 1 + passiveVal('mpRegen') / 100; st.regen = b.regen;
  st.power = Math.round(st.atk * 2.2 + st.def * 1.6 + st.maxHp * 0.22 + st.crit * 6);
  P.hp = Math.min(P.hp, st.maxHp); P.mp = Math.min(P.mp, st.maxMp); UI.dirty.hud = 1; UI.dirty.char = 1;
}

/* ---------- Zonas e monstros ---------- */
function spawnMob(sp) {
  const def = MOBS[sp.mob], s = mobStats(def, sp.elite);
  return { sp, def, lvl: def.lvl, elite: !!sp.elite, x: sp.x, y: sp.y, hx: sp.x, hy: sp.y, hp: s.hp, maxHp: s.hp, atk: s.atk, defv: s.def, xp: s.xp, gold: s.gold, state: 'idle', wt: rnd(0, 3), wx: sp.x, wy: sp.y, atkCd: rnd(0.3, 1), stun: 0, slow: 0, flash: 0, dead: false, respawnAt: 0, seed: Math.random() * 10, dir: 1, moving: false, rad: def.boss ? 34 : sp.elite ? 20 : 15, spawnT: 0, atkAnim: 0, special: 5 };
}
function enterZone(id, fromId, keepPos) {
  const W = getWorld(id); G.world = W; S.zone = id; S.disc[id] = 1; clearChunks();
  if (keepPos && canStand(W, S.x, S.y, 12)) { P.x = S.x; P.y = S.y; }
  else if (fromId != null && fromId > id) { P.x = W.exit.x; P.y = W.exit.y; }
  else { P.x = W.entry.x; P.y = W.entry.y; }
  G.mobs = W.spawns.map(spawnMob); for (const n of W.nodes) n.readyAt = 0;
  P.target = null; P.moveTo = null; P.cast = null; P.engage = false; RD.parts.length = 0; RD.projs.length = 0; RD.teles.length = 0; RD.texts.length = 0;
  G.path = null; G.pathT = 0; G.peers.clear(); Net.setZone(id); Net.track('zone', { z: id }); UI.zoneBanner(W.Z); UI.dirty.all = 1; saveLocal();
}
function usePortal(p) {
  const Z = ZONES[p.to]; if (!P.lvlOk(Z)) { UI.toast('Você precisa do nível ' + zoneReq(Z) + ' para entrar em ' + Z.name + '.', 'bad'); return; }
  UI.fade(() => enterZone(p.to, G.world.id)); Sfx.play('portal');
}
function teleportTo(id) {
  if (id === G.world.id) return; const cost = id === 0 ? 0 : 20 + id * 45;
  if (S.gold < cost) { UI.toast('Ouro insuficiente.', 'bad'); return; }
  S.gold -= cost; Net.track('tp', { z: id }); UI.closeAll(); UI.fade(() => enterZone(id, null)); Sfx.play('portal');
}

/* ---------- Combate ---------- */
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function nearestMob(maxD, pred) { let best = null, bd = maxD; for (const m of G.mobs) { if (m.dead || (pred && !pred(m))) continue; const d = dist(P, m); if (d < bd) { bd = d; best = m; } } return best; }
function hitMob(m, mul, o) {
  if (m.dead) return; o = o || {};
  let dmg = P.st.atk * mul * (1 + P.st.dmgPct) * rnd(0.9, 1.1) * 120 / (120 + m.defv);
  const crit = Math.random() * 100 < P.st.crit; if (crit) dmg *= 1.6;
  dmg = Math.max(1, Math.round(dmg)); m.hp -= dmg; m.flash = 0.12; P.lastCombat = G.time;
  if (m.state !== 'chase') { m.state = 'chase'; }
  if (o.stun) m.stun = Math.max(m.stun, m.def.boss ? o.stun * 0.4 : o.stun); if (o.slow) m.slow = Math.max(m.slow, o.slow);
  fxText(m.x, m.y - mobHeight(m) - 4, (crit ? '✦' : '') + fmt(dmg), crit ? '#ffd24a' : '#ffffff', crit);
  fxBurst(m.x, m.y - 16, o.color || '#fff', crit ? 8 : 4, 90); Sfx.play(crit ? 'crit' : 'hit');
  if (m.hp <= 0) killMob(m);
}
function killMob(m) {
  m.dead = true; m.respawnAt = G.time + (m.def.boss ? 240 : m.elite ? 45 : 14); fxBurst(m.x, m.y - 14, m.def.c, 16, 150); if (m.def.boss) { RD.shake = 14; fxRing(m.x, m.y, 160, '#ffd24a', 0.8); }
  const diff = S.lvl - m.lvl; let xm = diff >= 10 ? 0.1 : diff >= 7 ? 0.35 : diff >= 5 ? 0.7 : 1; if (m.def.boss) xm = Math.max(xm, 0.5);
  // grupo: com N companheiros na mesma zona, XP e ouro ganham +20% por companheiro e são divididos igualmente
  const mates = Net.partyMates(), pk = mates.length, share = pk ? { mob: m.def.id, items: [], eq: [] } : null;
  let xpv = Math.max(1, Math.round(m.xp * xm)), gold = Math.round(m.gold * rnd(0.7, 1.3));
  if (pk) { xpv = Math.max(1, Math.round(m.xp * (1 + 0.2 * pk) / (pk + 1))); gold = Math.max(1, Math.round(gold * (1 + 0.2 * pk) / (pk + 1))); share.xp = xpv; share.gold = gold; xpv = Math.max(1, Math.round(xpv * xm)); }
  gainXp(xpv); gainGold(gold); fxText(m.x, m.y - 6, '+' + gold + ' 🪙', '#ffd24a');
  S.stats.kills++; if (m.def.boss) { S.stats.bosses++; Net.track('boss', { m: m.def.id }); UI.toast('Chefe derrotado: ' + m.def.name + '!', 'gold'); Net.announce('derrotou ' + m.def.name + '!'); }
  dropLoot(m, share, mates); questEvent('kill', m.def.id); if (share) Net.pshare(share);
  if (P.target === m) { P.target = null; if (P.engage) { const n = nearestMob(260, x => x.state === 'chase'); if (n) P.target = n; else P.engage = false; } }
}
// share/mates: quando em grupo, materiais vão para todos na zona e cada equipamento é sorteado entre os membros
function dropLoot(m, share, mates) {
  const b = m.def.boss, e = m.elite, drops = [];
  if (b || Math.random() < 0.3) drops.push(['m_' + m.def.id, b ? 3 : 1]);
  if (b || Math.random() < (e ? 0.2 : 0.025)) drops.push(['stone', b ? rint(1, 2) : 1]);
  if (b || Math.random() < (e ? 0.18 : 0.015)) drops.push(['feather', b ? rint(3, 5) : 1]);
  if (Math.random() < 0.06) { const t = Math.max(1, POT_LVL.filter((l, i) => i > 0 && m.lvl >= l).length); drops.push([(Math.random() < 0.6 ? 'hp' : 'mp') + t, 1]); }
  let dy = 22; if (share) share.items = drops.slice(0, 6);
  for (const [id, q] of drops) if (addItem(id, q)) { fxText(m.x, m.y - dy, ITEMS[id].icon + ' ' + ITEMS[id].name + (q > 1 ? ' x' + q : ''), RARITY[ITEMS[id].r || 0].c); dy += 16; UI.note('Obteve ' + ITEMS[id].name + (q > 1 ? ' x' + q : '') + '.', 'loot'); }
  const n = b ? 2 : (Math.random() < (e ? 0.4 : 0.05) ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const eo = { bonus: b ? 0.3 : e ? 0.12 : 0, minR: b && i === 0 ? 2 : 0 };
    if (share) { const w = Math.floor(Math.random() * (mates.length + 1)); if (w > 0) { const mt = mates[w - 1]; share.eq.push({ to: mt.id, l: m.lvl, b: eo.bonus, r: eo.minR }); UI.note('👥 Sorteio do grupo: ' + mt.n + ' ficou com o equipamento.', 'sys'); continue; } }
    const eq = genEquip(m.lvl, eo);
    if (addEquip(eq)) { fxText(m.x, m.y - dy, SLOT_ICON[eq.slot] + ' ' + eq.name, RARITY[eq.r].c, eq.r >= 3); dy += 18; UI.note('Obteve [' + RARITY[eq.r].n + '] ' + eq.name + '.', 'r' + eq.r); if (eq.r >= 3) { Sfx.play('rare'); fxPillar(m.x, m.y, RARITY[eq.r].c); if (eq.r >= 4) Net.announce('encontrou o item Lendário ' + eq.name + '!'); } }
  }
}
function gainXp(n) {
  if (S.lvl >= MAX_LEVEL) return; S.xp += n; fxText(P.x, P.y - 74, '+' + fmt(n) + ' XP', '#b58cff');
  while (S.lvl < MAX_LEVEL && S.xp >= xpNeed(S.lvl)) {
    S.xp -= xpNeed(S.lvl); S.lvl++; S.pts += 4; S.sp += 1;
    for (const sk of CLASSES[S.cls].skills) if (S.lvl >= sk.lvl && !S.skills[sk.id]) { S.skills[sk.id] = 1; UI.toast('Nova habilidade: ' + sk.name + '!', 'gold'); }
    recalc(); P.hp = P.st.maxHp; P.mp = P.st.maxMp; fxPillar(P.x, P.y, '#ffd24a'); fxRing(P.x, P.y, 120, '#ffd24a', 0.8); Sfx.play('level');
    Net.track('lvl', { l: S.lvl });
    UI.toast('Nível ' + S.lvl + '! +4 pontos de atributo, +1 ponto de habilidade.', 'gold'); UI.note('Você alcançou o nível ' + S.lvl + '!', 'sys');
    if (S.lvl === WING_UNLOCK_LVL) UI.toast('A Guardiã Seraphine quer falar com você sobre suas Asas.', 'gold');
    if (S.lvl % 10 === 0) Net.announce('alcançou o nível ' + S.lvl + '!');
    refreshQuestMark(); saveAll(true); Net.pushRank();
  }
  if (S.lvl >= MAX_LEVEL) S.xp = 0; UI.dirty.hud = 1;
}
function hurtPlayer(raw, src) {
  if (P.dead) return;
  if (Math.random() * 100 < P.st.dodge) { fxText(P.x, P.y - 60, 'Esquiva', '#9fe0ff'); return; }
  let dmg = Math.max(1, Math.round(raw * rnd(0.9, 1.1) * 120 / (120 + P.st.def)));
  if (P.shield > 0) { const ab = Math.min(P.shield, dmg); P.shield -= ab; dmg -= ab; if (dmg <= 0) { fxText(P.x, P.y - 60, 'Absorvido', '#9fe0ff'); return; } }
  P.hp -= dmg; P.lastCombat = G.time; P.cast = null; fxText(P.x, P.y - 58, '-' + fmt(dmg), '#ff6a5a'); Sfx.play('hurt'); UI.dirty.hud = 1;
  if (!P.target && src && !src.dead) { P.target = src; }
  if (P.hp <= 0) die(src);
}
function die(src) {
  Net.track('death', { m: src && src.def ? src.def.id : '', z: G.world ? G.world.id : 0 });
  P.hp = 0; P.dead = true; P.target = null; P.engage = false; P.moveTo = null; S.stats.deaths++;
  const loss = S.lvl >= 5 ? Math.min(S.xp, Math.round(xpNeed(S.lvl) * 0.04)) : 0; S.xp -= loss;
  for (const m of G.mobs) if (m.state === 'chase') m.state = 'return';
  UI.showDeath(loss); Sfx.play('death'); UI.dirty.hud = 1;
}
function respawn(town) {
  P.dead = false; recalc(); P.hp = P.st.maxHp * 0.6; P.mp = P.st.maxMp * 0.6; P.buffs = []; P.shield = 0; recalc();
  if (town && G.world.id !== 0) enterZone(0, null); else { P.x = G.world.entry.x; P.y = G.world.entry.y; }
  UI.hideDeath();
}
function addBuff(key, name, icon, b) { P.buffs = P.buffs.filter(x => x.key !== key); P.buffs.push(Object.assign({ key, name, icon, until: G.time + b.dur }, b)); recalc(); UI.dirty.buffs = 1; }

function playerAttack() {
  const m = P.target, C = CLASSES[S.cls]; P.atkCd = P.st.aspd; P.atkT = 0.3; P.atkN = ((P.atkN | 0) + 1) % 1000; P.dir = m.x >= P.x ? 1 : -1; P.lastCombat = G.time; P.cast = null;
  if (C.ranged) fxProj({ x: P.x + P.dir * 12, y: P.y - 28, target: m, speed: 620, color: C.trim, arrow: S.cls === 'archer', size: 5, onHit: () => hitMob(m, 1, { color: C.trim }) });
  else { fxSlash(P.x + P.dir * 22, P.y, P.dir); hitMob(m, 1); }
  Sfx.play(C.ranged ? 'shoot' : 'swing');
}
function skillLevelCap(sk, lv) { return sk.lvl + lv * 2; }
function useSkill(i) {
  if (P.dead || !G.started) return; const C = CLASSES[S.cls], sk = C.skills[i], lv = S.skills[sk.id] || 0;
  if (!lv) { UI.toast('Habilidade desbloqueada no nível ' + sk.lvl + '.', 'bad'); return; }
  if ((P.cds[sk.id] || 0) > G.time) return;
  if (P.mp < sk.mp) { UI.toast('Mana insuficiente.', 'bad'); return; }
  const mul = (sk.mul || 0) * (1 + 0.1 * (lv - 1)); let m = P.target;
  const needT = sk.type === 'target' || sk.type === 'aoeTarget' || sk.type === 'dash', range = sk.type === 'dash' ? 300 : C.range + 20;
  if (needT) {
    if (!m || m.dead) { m = nearestMob(range + 120); if (m) P.target = m; }
    if (!m) { UI.toast('Nenhum alvo.', 'bad'); return; }
    if (dist(P, m) > range + m.rad) { P.engage = true; UI.toast('Fora de alcance.', 'bad'); return; }
    P.dir = m.x >= P.x ? 1 : -1; P.engage = true;
  }
  P.mp -= sk.mp; P.cds[sk.id] = G.time + sk.cd; P.atkT = 0.3; P.atkN = ((P.atkN | 0) + 1) % 1000; P.lastCombat = G.time; P.cast = null; Sfx.play('skill'); UI.dirty.hud = 1;
  const col = C.trim, o = { stun: sk.stun, slow: sk.slow, color: col };
  const aoe = (x, y, r) => { fxRing(x, y, r, col, 0.5); fxBurst(x, y - 10, col, 18, 200); for (const t of G.mobs) if (!t.dead && Math.hypot(t.x - x, t.y - y) <= r + t.rad) hitMob(t, mul, o); };
  if (sk.type === 'target') { if (C.ranged) fxProj({ x: P.x, y: P.y - 28, target: m, speed: 700, color: col, size: 9, trail: 1, arrow: S.cls === 'archer', onHit: () => hitMob(m, mul, o) }); else { fxSlash(P.x + P.dir * 22, P.y, P.dir, col); fxRing(m.x, m.y, 40, col); hitMob(m, mul, o); } }
  else if (sk.type === 'aoeSelf') aoe(P.x, P.y, sk.radius);
  else if (sk.type === 'aoeTarget') { const tx = m.x, ty = m.y; if (sk.radius >= 130) { fxTele(tx, ty, sk.radius, 0.55, col, () => { RD.shake = 10; aoe(tx, ty, sk.radius); fxPillar(tx, ty, col); }); } else fxProj({ x: P.x, y: P.y - 28, tx, ty, speed: 640, color: col, size: 9, trail: 1, onHit: () => aoe(tx, ty, sk.radius) }); }
  else if (sk.type === 'dash') { const dx = m.x - P.x, dy = m.y - P.y, d = Math.hypot(dx, dy) || 1, steps = Math.max(0, Math.floor((d - 40) / 8)); for (let k = 0; k < steps; k++) { if (!moveEnt(G.world, P, dx / d * 8, dy / d * 8, 12)) break; if (k % 3 === 0) fxBurst(P.x, P.y - 10, col, 2, 40); } RD.shake = 10; aoe(P.x, P.y, sk.radius); }
  else if (sk.type === 'buff') { const b = Object.assign({}, sk.buff); if (b.shield) { P.shield = Math.round(P.st.maxHp * b.shield * (1 + 0.08 * (lv - 1))); P.shieldUntil = G.time + b.dur; } addBuff(sk.id, sk.name, sk.icon, b); fxRing(P.x, P.y, 60, col, 0.6); fxPillar(P.x, P.y, col); }
  else if (sk.type === 'heal') { const h = Math.round(P.st.maxHp * (sk.heal + 0.02 * (lv - 1))); P.hp = Math.min(P.st.maxHp, P.hp + h); fxText(P.x, P.y - 60, '+' + fmt(h), '#7dff8a', true); fxPillar(P.x, P.y, '#7dff8a'); }
}
function usePotion(kind) {
  if (P.dead) return; if (P.potCd > G.time) return;
  let best = null; for (let t = 4; t >= 1; t--) { const id = kind + t; if (S.lvl >= ITEMS[id].req && countItem(id) > 0) { best = id; break; } }
  if (!best) { UI.toast('Sem poções de ' + (kind === 'hp' ? 'vida' : 'mana') + '.', 'bad'); return; }
  useItemId(best);
}
function useItemId(id) {
  const it = ITEMS[id]; if (!it.use || countItem(id) < 1 || P.dead) return;
  if (it.use === 'hp' || it.use === 'mp') {
    if (S.lvl < it.req) { UI.toast('Requer nível ' + it.req + '.', 'bad'); return; } if (P.potCd > G.time) { UI.toast('Poção em recarga.', 'bad'); return; }
    if (it.use === 'hp') { P.hp = Math.min(P.st.maxHp, P.hp + it.val); fxText(P.x, P.y - 60, '+' + it.val, '#7dff8a'); } else { P.mp = Math.min(P.st.maxMp, P.mp + it.val); fxText(P.x, P.y - 60, '+' + it.val, '#7fb0ff'); }
    P.potCd = G.time + 6; Sfx.play('potion');
  } else if (it.use === 'return') { if (G.world.id === 0) { UI.toast('Você já está na vila.', 'bad'); return; } if (G.time - P.lastCombat < 5) { UI.toast('Não pode usar em combate.', 'bad'); return; } UI.closeAll(); UI.fade(() => enterZone(0, null)); }
  else if (it.use === 'elx') { addBuff(id, it.name, it.icon, Object.assign({}, it.buff)); Sfx.play('potion'); }
  removeItem(id, 1); UI.dirty.hud = 1;
}

/* ---------- IA dos monstros ---------- */
function updateMob(m, dt) {
  if (m.dead) { if (G.time >= m.respawnAt) Object.assign(m, spawnMob(m.sp), { spawnT: 0 }); return; }
  m.spawnT += dt; if (m.flash > 0) m.flash -= dt; if (m.atkAnim > 0) m.atkAnim -= dt; if (m.slow > 0) m.slow -= dt;
  if (m.stun > 0) { m.stun -= dt; m.moving = false; return; }
  const W = G.world, d = dist(m, P), boss = m.def.boss, spd = (boss ? 78 : m.def.ranged ? 72 : 88) * (m.slow > 0 ? 0.5 : 1), aggro = boss ? 270 : m.elite ? 220 : 175 - Math.max(0, Math.min(90, (S.lvl - m.lvl - 4) * 15));
  const go = (tx, ty, v) => { const dx = tx - m.x, dy = ty - m.y, dd = Math.hypot(dx, dy); if (dd < 2) { m.moving = false; return true; } m.moving = moveEnt(W, m, dx / dd * v * dt, dy / dd * v * dt, 10) || m.moving; if (Math.abs(dx) > 2) m.dir = dx > 0 ? 1 : -1; return false; };
  m.moving = false;
  if (m.state === 'idle') {
    if (!P.dead && d < aggro && !W.Z.safe) { m.state = 'chase'; return; }
    m.wt -= dt; if (m.wt <= 0) { m.wt = rnd(2, 6); m.wx = m.hx + rnd(-70, 70); m.wy = m.hy + rnd(-70, 70); }
    if (!boss) go(m.wx, m.wy, 28);
  } else if (m.state === 'chase') {
    if (P.dead || Math.hypot(m.x - m.hx, m.y - m.hy) > (boss ? 420 : 560) || d > 640) { m.state = 'return'; return; }
    const ar = m.def.ranged ? 230 : m.rad + 30; m.atkCd -= dt; if (Math.abs(P.x - m.x) > 3) m.dir = P.x > m.x ? 1 : -1;
    if (d > ar) go(P.x, P.y, spd);
    else if (m.atkCd <= 0) {
      m.atkCd = boss ? 1.4 : 1.7; m.atkAnim = 0.3;
      if (m.def.ranged) fxProj({ x: m.x, y: m.y - 24, target: P, speed: 330, color: m.def.c, size: 6, trail: 1, onHit: () => hurtPlayer(m.atk, m) });
      else hurtPlayer(m.atk, m);
    }
    if (boss) { m.special -= dt; if (m.special <= 0) { m.special = m.hp < m.maxHp * 0.5 ? 4.5 : 7; const tx = P.x, ty = P.y, r = 115; fxTele(tx, ty, r, 1.25, '#ff3a2a', () => { RD.shake = 12; fxBurst(tx, ty, '#ff6a3a', 26, 240); if (!m.dead && Math.hypot(P.x - tx, P.y - ty) < r) hurtPlayer(m.atk * 2.3, m); }); } }
    for (const o of G.mobs) if (o !== m && !o.dead && o.state === 'chase') { const dx = m.x - o.x, dy = m.y - o.y, dd = Math.hypot(dx, dy); if (dd < 26 && dd > 0.01) moveEnt(W, m, dx / dd * 40 * dt, dy / dd * 40 * dt, 10); }
  } else { m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.25 * dt); if (go(m.hx, m.hy, 150)) m.state = 'idle'; }
}

/* ---------- Interação ---------- */
function findNear() {
  const W = G.world; let best = null, bd = 1e9;
  for (const p of W.portals) { const d = dist(P, p); if (d < 80 && d < bd) { bd = d; best = { type: 'portal', o: p, label: 'Entrar: ' + ZONES[p.to].name }; } }
  for (const n of W.npcs) { const d = dist(P, n); if (d < 85 && d < bd) { bd = d; best = { type: 'npc', o: n, label: (n.def.crystal ? 'Usar ' : 'Falar com ') + n.def.name }; } }
  for (const n of W.nodes) { if (G.time < n.readyAt) continue; const d = dist(P, n); if (d < 62 && d < bd) { bd = d; best = { type: 'node', o: n, label: 'Coletar ' + ITEMS[n.kind + n.tier].name }; } }
  return best;
}
function interact(t) {
  t = t || G.near; if (!t || P.dead) return;
  if (t.type === 'portal') usePortal(t.o); else if (t.type === 'npc') { UI.openNpc(t.o.key); Sfx.play('ui'); } else if (t.type === 'node') startGather(t.o);
}
const NODE_PROF = { ore: 'mining', wood: 'logging', herb: 'herbalism' };
// XP de profissão por coleta: cresce com o tier para acompanhar profNeed().
// Com isso, liberar o tier seguinte leva ~40 coletas no tier 1 e ~65-75 nos demais (antes: ~300 e ~950+).
function gatherXp(tier) { return 45 * tier * tier + 60 * tier; }
const NODE_RESPAWN = 50; // segundos até o ponto de coleta voltar (antes: 80)
function startGather(n) {
  if (P.cast) return; const pk = NODE_PROF[n.kind], pr = S.prof[pk];
  if (pr.l < tierReq(n.tier)) { UI.toast(PROFS[pk].name + ' nível ' + tierReq(n.tier) + ' necessário (você: ' + pr.l + ').', 'bad'); return; }
  P.cast = { t: 0, dur: Math.max(1.4, 2.8 - pr.l * 0.025), node: n, pk }; P.moveTo = null; P.engage = false;
}
function finishGather(c) {
  const n = c.node, pr = S.prof[c.pk]; if (G.time < n.readyAt) return; n.readyAt = G.time + NODE_RESPAWN;
  const q = 1 + (Math.random() < 0.35 + pr.l * 0.012 ? 1 : 0) + (Math.random() < pr.l * 0.008 ? 1 : 0), id = n.kind + n.tier;
  if (addItem(id, q)) { fxText(n.x, n.y - 30, ITEMS[id].icon + ' +' + q + ' ' + ITEMS[id].name, '#d8ffd0'); UI.note('Coletou ' + ITEMS[id].name + ' x' + q + '.', 'loot'); }
  gainProf(c.pk, gatherXp(n.tier)); S.stats.gathers += q; for (let i = 0; i < q; i++) questEvent('gather', n.tier); gainXp(Math.round(4 + MOBS[ZONES[n.tier].mobs[0]].lvl * 2.2)); Sfx.play('gather');
  if (Math.random() < 0.03) { addItem('feather', 1); fxText(n.x, n.y - 46, '🪶 Pena Etérea!', RARITY[3].c, true); }
}
function gainProf(k, xp) { const pr = S.prof[k]; if (pr.l >= PROF_MAX) return; pr.xp += xp; while (pr.l < PROF_MAX && pr.xp >= profNeed(pr.l)) { pr.xp -= profNeed(pr.l); pr.l++; UI.toast(PROFS[k].name + ' subiu para o nível ' + pr.l + '!', 'gold'); } UI.dirty.prof = 1; }

/* ---------- Missões ---------- */
function questStatus(q) { if (S.quests.done[q.id]) return 'done'; if (q.id in S.quests.active) return S.quests.active[q.id] >= q.obj.n ? 'ready' : 'active'; if (q.prev && !S.quests.done[q.prev]) return 'locked'; if (S.lvl < q.reqLvl) return 'level'; return 'available'; }
function refreshQuestMark() { let mk = null; for (const q of QUESTS) { const s = questStatus(q); if (s === 'ready') { mk = '?'; break; } if (s === 'available') mk = '!'; } if (!mk && S.daily.list.some(d => !d.claimed && d.prog >= d.n)) mk = '?'; G.qMark = mk; UI.dirty.quest = 1; }
function questMarker() { return G.qMark; }
function objText(o) { return o.type === 'kill' ? 'Derrote ' + MOBS[o.mob].name : o.type === 'drop' ? 'Colete ' + o.what + ' (' + MOBS[o.mob].name + ')' : 'Colete recursos em ' + ZONES[o.tier].name; }
function questEvent(type, arg) {
  let ch = false;
  for (const id in S.quests.active) {
    const q = QUEST_BY_ID[id], o = q.obj, p = S.quests.active[id]; if (p >= o.n) continue;
    if ((type === 'kill' && o.type === 'kill' && o.mob === arg) || (type === 'kill' && o.type === 'drop' && o.mob === arg && Math.random() < o.chance) || (type === 'gather' && o.type === 'gather' && o.tier === arg)) {
      S.quests.active[id] = p + 1; ch = true; if (o.type === 'drop') fxText(P.x, P.y - 90, o.what + ' ' + (p + 1) + '/' + o.n, '#ffe9a8');
      if (p + 1 >= o.n) { Net.track('qr', { q: id }); UI.toast('Missão concluída: ' + q.name + '. Volte a um mestre de missões.', 'gold'); Sfx.play('quest'); }
    }
  }
  if (type === 'kill') for (const d of S.daily.list) if (!d.claimed && d.mob === arg && d.prog < d.n) { d.prog++; ch = true; if (d.prog >= d.n) UI.toast('Contrato diário concluído!', 'gold'); }
  if (ch) refreshQuestMark();
}
function acceptQuest(id) { const q = QUEST_BY_ID[id]; if (questStatus(q) !== 'available') return; S.quests.active[id] = 0; Net.track('qa', { q: id }); UI.toast('Missão aceita: ' + q.name + ' — toque em 🧭 para destacar o caminho.', 'good'); Sfx.play('ui'); refreshQuestMark(); }
function giveReward(r) { if (r.xp) gainXp(r.xp); if (r.gold) gainGold(r.gold); for (const [id, n] of (r.items || [])) addItem(id, n); }
function turnInQuest(id) {
  const q = QUEST_BY_ID[id]; if (questStatus(q) !== 'ready') return; delete S.quests.active[id]; S.quests.done[id] = 1; Net.track('qt', { q: id }); giveReward(q.reward);
  UI.toast('Recompensa: ' + fmt(q.reward.xp) + ' XP, ' + fmt(q.reward.gold) + ' ouro' + (q.reward.items.length ? ' e itens' : '') + '.', 'gold'); Sfx.play('quest'); refreshQuestMark(); saveAll(true);
}
function dailyReward(i) { return { xp: Math.round(xpNeed(S.lvl) * (0.08 + i * 0.03)), gold: 80 + S.lvl * 35 * (i + 1), items: i === 2 ? [['feather', 3], ['stone', 1]] : [['feather', 1 + i]] }; }
function checkDaily() {
  const t = today();
  if (S.daily.date !== t) { const z = ZONES[tierOfLevel(S.lvl)]; S.daily = { date: t, list: [0, 1, 2].map(i => ({ mob: z.mobs[i], n: 30 + i * 15, prog: 0, claimed: false })) }; }
  if (S.login.date !== t) {
    const y = new Date(Date.now() - 864e5), ys = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
    S.login.streak = S.login.date === ys ? S.login.streak + 1 : 1; S.login.date = t;
    const day = ((S.login.streak - 1) % 7) + 1, gold = Math.round((60 + S.lvl * 25) * (1 + day * 0.15)), items = [['hp' + Math.max(1, POT_LVL.filter((l, i) => i > 0 && S.lvl >= l).length), 3]];
    if (day === 3 || day === 5) items.push(['feather', 2]); if (day === 7) { items.push(['feather', 6]); items.push(['stone', 2]); }
    gainGold(gold); for (const [id, n] of items) addItem(id, n); UI.loginReward(day, gold, items);
  }
  refreshQuestMark();
}
function claimDaily(i) { const d = S.daily.list[i]; if (!d || d.claimed || d.prog < d.n) return; d.claimed = true; giveReward(dailyReward(i)); UI.toast('Contrato entregue!', 'gold'); Sfx.play('quest'); refreshQuestMark(); }

/* ---------- Ferreiro, Forja, Alquimia, Asas, Lojas ---------- */
const ENH_RATE = [100, 100, 100, 90, 80, 70, 60, 50, 42, 35, 28, 22, 17, 13, 10];
function enhCost(e) { return { gold: Math.round((40 + e.ilvl * 14) * (e.enh + 1) * (1 + e.r * 0.25)), stones: 1 + Math.floor(e.enh / 4) }; }
function enhance(e) {
  if (e.enh >= 15) return; const c = enhCost(e);
  if (S.gold < c.gold || countItem('stone') < c.stones) { UI.toast('Faltam materiais ou ouro.', 'bad'); return; }
  S.gold -= c.gold; removeItem('stone', c.stones);
  const enhOk = Math.random() * 100 < ENH_RATE[e.enh]; Net.track('enh', { ok: enhOk, l: e.enh + 1 });
  if (enhOk) { e.enh++; S.stats.maxEnh = Math.max(S.stats.maxEnh, e.enh); UI.toast('Sucesso! ' + e.name + ' +' + e.enh, 'gold'); Sfx.play('level'); if (e.enh >= 10) Net.announce('reforçou ' + e.name + ' até +' + e.enh + '!'); }
  else { if (e.enh >= 7) { e.enh--; UI.toast('Falhou... o item caiu para +' + e.enh + '.', 'bad'); } else UI.toast('O reforço falhou.', 'bad'); Sfx.play('death'); }
  recalc(); UI.dirty.all = 1;
}
function forgeRecipe(t) { return { need: [['ore' + t, 8], ['wood' + t, 5], ['m_' + ZONES[t].mobs[0], 4]], gold: 60 * t * t, ilvl: Math.round((ZONES[t].lvl[0] + ZONES[t].lvl[1]) / 2), lvl: tierReq(t) }; }
function forge(t, slot) {
  const r = forgeRecipe(t), pr = S.prof.smithing;
  if (pr.l < r.lvl) { UI.toast('Forja nível ' + r.lvl + ' necessário.', 'bad'); return; }
  if (!hasAll(r.need) || S.gold < r.gold) { UI.toast('Faltam materiais ou ouro.', 'bad'); return; }
  if (S.inv.indexOf(null) < 0) { UI.toast('Mochila cheia!', 'bad'); return; }
  for (const [id, q] of r.need) removeItem(id, q); S.gold -= r.gold;
  const e = genEquip(r.ilvl, { slot, bonus: Math.min(0.6, 0.25 + pr.l * 0.007), minR: 1 }); addEquip(e); Net.track('forge', { k: slot }); gainProf('smithing', 25 + t * 18); S.stats.crafts++;
  UI.toast('Forjou [' + RARITY[e.r].n + '] ' + e.name + '!', e.r >= 3 ? 'gold' : 'good'); Sfx.play(e.r >= 3 ? 'rare' : 'gather'); UI.dirty.all = 1;
}
function stoneRecipe(t) { return { need: [['ore' + t, 12]], gold: 120 + t * 40, lvl: tierReq(t) }; }
function forgeStone(t) { const r = stoneRecipe(t); if (S.prof.smithing.l < r.lvl || !hasAll(r.need) || S.gold < r.gold) { UI.toast('Faltam materiais, ouro ou nível de Forja.', 'bad'); return; } for (const [id, q] of r.need) removeItem(id, q); S.gold -= r.gold; addItem('stone', 1); gainProf('smithing', 12 + t * 8); S.stats.crafts++; UI.toast('Criou uma Pedra de Reforço.', 'good'); Sfx.play('gather'); UI.dirty.all = 1; }
const ALCH = [
  { out: ['hp1', 2], need: [['herb1', 3]], lvl: 1 }, { out: ['mp1', 2], need: [['herb1', 3]], lvl: 1 },
  { out: ['hp2', 2], need: [['herb2', 4]], lvl: 8 }, { out: ['elx_def', 1], need: [['herb2', 5], ['wood2', 3]], lvl: 10 }, { out: ['elx_atk', 1], need: [['herb3', 5], ['ore2', 3]], lvl: 13 }, { out: ['mp2', 2], need: [['herb3', 4]], lvl: 15 },
  { out: ['hp3', 2], need: [['herb4', 4]], lvl: 22 }, { out: ['mp3', 2], need: [['herb5', 4]], lvl: 29 }, { out: ['feather', 1], need: [['herb5', 10], ['herb4', 10]], lvl: 30, gold: 1500 },
  { out: ['hp4', 2], need: [['herb6', 5]], lvl: 36 }, { out: ['mp4', 2], need: [['herb7', 5]], lvl: 43 },
];
function brew(i) {
  const r = ALCH[i]; if (S.prof.alchemy.l < r.lvl) { UI.toast('Alquimia nível ' + r.lvl + ' necessário.', 'bad'); return; }
  if (!hasAll(r.need) || S.gold < (r.gold || 0)) { UI.toast('Faltam materiais.', 'bad'); return; }
  for (const [id, q] of r.need) removeItem(id, q); S.gold -= r.gold || 0; if (!addItem(r.out[0], r.out[1])) return;
  gainProf('alchemy', 14 + r.lvl * 2.2); Net.track('brew', { k: r.out[0] }); S.stats.crafts++; UI.toast('Preparou ' + ITEMS[r.out[0]].name + ' x' + r.out[1] + '.', 'good'); Sfx.play('potion'); UI.dirty.all = 1;
}
function wingsUnlock() { if (S.wings.t > 0 || S.lvl < WING_UNLOCK_LVL) return; S.wings = { t: 1, s: 0 }; recalc(); fxPillar(P.x, P.y, '#fff'); UI.toast('Suas Asas despertaram!', 'gold'); Sfx.play('level'); Net.announce('despertou suas Asas!'); UI.dirty.all = 1; }
function wingsUpgrade() {
  const w = S.wings; if (!w.t || (w.t >= 10 && w.s >= 10)) return; const c = wingCost(w.t);
  if (countItem('feather') < c.feathers || S.gold < c.gold) { UI.toast('Faltam Penas Etéreas ou ouro.', 'bad'); return; }
  removeItem('feather', c.feathers); S.gold -= c.gold; w.s++; Net.track('wings', { l: w.t * 10 + w.s });
  if (w.s >= 10 && w.t < 10) { w.t++; w.s = 0; fxPillar(P.x, P.y, WINGS[w.t].c2); UI.toast('Suas asas evoluíram: ' + WINGS[w.t].name + '!', 'gold'); Sfx.play('level'); Net.announce('evoluiu para ' + WINGS[w.t].name + '!'); } else Sfx.play('gather');
  recalc(); UI.dirty.all = 1;
}
function buyItem(id, q) { const c = ITEMS[id].price * q; if (S.gold < c) { UI.toast('Ouro insuficiente.', 'bad'); return; } if (!addItem(id, q)) return; S.gold -= c; Sfx.play('coin'); UI.dirty.all = 1; }
function gearPrice(ilvl) { return Math.round((5 + ilvl * 4) * 9); }
function buyGear(slot) { const ilvl = ZONES[tierOfLevel(S.lvl)].lvl[0], c = gearPrice(ilvl); if (S.gold < c) { UI.toast('Ouro insuficiente.', 'bad'); return; } if (S.inv.indexOf(null) < 0) { UI.toast('Mochila cheia!', 'bad'); return; } S.gold -= c; addEquip(genEquip(ilvl, { slot, r: 0 })); Sfx.play('coin'); UI.dirty.all = 1; }
function sellInv(i, all) { const it = S.inv[i]; if (!it) return; if (it.eq) { gainGold(eqSell(it)); S.inv[i] = null; } else { const q = all ? it.q : 1, v = ITEMS[it.id].sell * q; gainGold(v); it.q -= q; if (it.q <= 0) S.inv[i] = null; } Sfx.play('coin'); UI.dirty.all = 1; }
function sellJunk() { let g = 0, n = 0; for (let i = 0; i < S.inv.length; i++) { const it = S.inv[i]; if (it && it.eq && it.r <= 1 && !it.lock) { g += eqSell(it); S.inv[i] = null; n++; } } if (n) { gainGold(g); UI.toast('Vendeu ' + n + ' itens por ' + fmt(g) + ' ouro.', 'good'); Sfx.play('coin'); } else UI.toast('Nenhum equipamento Comum/Incomum para vender.', 'bad'); UI.dirty.all = 1; }
function equipInv(i) {
  const e = S.inv[i]; if (!e || !e.eq) return; if (S.lvl < e.ilvl) { UI.toast('Requer nível ' + e.ilvl + '.', 'bad'); return; }
  if (e.slot === 'weapon' && e.cls !== S.cls) { UI.toast('Arma de outra classe.', 'bad'); return; }
  S.inv[i] = S.eq[e.slot] || null; S.eq[e.slot] = e; recalc(); Sfx.play('equip'); UI.dirty.all = 1;
}
function unequip(slot) { const e = S.eq[slot]; if (!e) return; const i = S.inv.indexOf(null); if (i < 0) { UI.toast('Mochila cheia!', 'bad'); return; } S.inv[i] = e; delete S.eq[slot]; recalc(); UI.dirty.all = 1; }
function addAttr(k, n) { n = Math.min(n, S.pts); if (n <= 0) return; S.attr[k] += n; S.pts -= n; recalc(); UI.dirty.all = 1; }
function upSkill(id) {
  const C = CLASSES[S.cls], sk = C.skills.find(s => s.id === id), ps = C.passives.find(s => s.id === id), lv = S.skills[id] || 0;
  if (S.sp < 1 || lv >= SKILL_MAX) return;
  if (sk) { if (!lv) return; if (S.lvl < skillLevelCap(sk, lv)) { UI.toast('Requer nível ' + skillLevelCap(sk, lv) + '.', 'bad'); return; } }
  else if (ps && S.lvl < 3 + lv * 4) { UI.toast('Requer nível ' + (3 + lv * 4) + '.', 'bad'); return; }
  S.skills[id] = lv + 1; S.sp--; recalc(); Sfx.play('ui'); UI.dirty.all = 1;
}
function checkAch() { for (const a of ACHS) if (!S.ach[a.id] && a.test(S)) { S.ach[a.id] = 1; gainGold(a.gold); UI.toast('🏆 Conquista: ' + a.name + ' (+' + fmt(a.gold) + ' ouro)', 'gold'); Sfx.play('quest'); } }

/* ---------- Loop de atualização ---------- */
function update(dt) {
  G.time += dt; S.stats.played += dt; const W = G.world, st = P.st;
  if (P.atkT > 0) P.atkT -= dt; P.atkCd -= dt;
  if (P.buffs.length && P.buffs.some(b => b.until <= G.time)) { P.buffs = P.buffs.filter(b => b.until > G.time); recalc(); UI.dirty.buffs = 1; }
  if (P.shield > 0 && G.time > (P.shieldUntil || 0)) P.shield = 0;
  if (!P.dead) {
    let ix = G.input.x, iy = G.input.y; const K = G.keys;
    if (K.KeyW || K.ArrowUp) iy -= 1; if (K.KeyS || K.ArrowDown) iy += 1; if (K.KeyA || K.ArrowLeft) ix -= 1; if (K.KeyD || K.ArrowRight) ix += 1;
    let mx = 0, my = 0; const m = P.target && !P.target.dead ? P.target : (P.target = null), C = CLASSES[S.cls];
    if (ix || iy) { const l = Math.hypot(ix, iy); mx = ix / Math.max(1, l); my = iy / Math.max(1, l); P.moveTo = null; P.engage = false; P.cast = null; }
    else if (P.moveTo) {
      const dx = P.moveTo.x - P.x, dy = P.moveTo.y - P.y, d = Math.hypot(dx, dy), stop = P.moveTo.ent ? 58 : 7;
      if (d <= stop) { const e = P.moveTo.ent; P.moveTo = null; if (e) interact(e); } else { mx = dx / d; my = dy / d; P.moveTo.stuck = (P.moveTo.stuck || 0); }
    } else if (P.engage && m && !P.cast) { const dx = m.x - P.x, dy = m.y - P.y, d = Math.hypot(dx, dy); if (d > (C.range + m.rad) * 0.92) { mx = dx / d; my = dy / d; } }
    if (mx || my) {
      const ox = P.x, oy = P.y; moveEnt(W, P, mx * st.spd * dt, my * st.spd * dt, 12); P.moving = Math.abs(P.x - ox) + Math.abs(P.y - oy) > 0.01; if (Math.abs(mx) > 0.15) P.dir = mx > 0 ? 1 : -1;
      if (P.moveTo) { if (!P.moving) { P.moveTo.stuck += dt; if (P.moveTo.stuck > 0.35) P.moveTo = null; } else P.moveTo.stuck = 0; }
    } else P.moving = false;
    if (m && !P.cast && P.atkCd <= 0 && dist(P, m) <= C.range + m.rad && (P.engage || !P.moving)) { playerAttack(); }
    if (P.cast) { P.cast.t += dt; if (Math.random() < 0.2) fxBurst(P.cast.node.x, P.cast.node.y - 14, '#ffe9a8', 1, 50); if (P.cast.t >= P.cast.dur) { const c = P.cast; P.cast = null; finishGather(c); } }
    const ooc = G.time - P.lastCombat > 5;
    P.hp = Math.min(st.maxHp, P.hp + st.maxHp * ((ooc ? 0.03 : 0.002) + (st.regen || 0)) * dt); P.mp = Math.min(st.maxMp, P.mp + st.maxMp * (ooc ? 0.045 : 0.012) * st.mpRegen * dt);
    G.near = findNear();
  } else G.near = null;
  for (const mob of G.mobs) updateMob(mob, dt);
  for (const p of G.peers.values()) { const k = Math.min(1, dt * 10); if (Math.hypot(p.x - p.rx, p.y - p.ry) > 400) { p.rx = p.x; p.ry = p.y; } p.mv = Math.hypot(p.x - p.rx, p.y - p.ry) > 3; p.rx += (p.x - p.rx) * k; p.ry += (p.y - p.ry) * k; if (p.atkT > 0) p.atkT -= dt; }
  G.pathT = (G.pathT || 0) - dt; if (G.pathT <= 0) { G.pathT = 0.35; updatePath(); }
  updateFx(dt); Net.tick(dt);
  G.saveT += dt; if (G.saveT > 20) { G.saveT = 0; saveLocal(); G.cloudN = (G.cloudN || 0) + 1; if (G.cloudN % 4 === 0) { Net.saveCloud(S); Net.pushRank(); } }
  G.achT += dt; if (G.achT > 3) { G.achT = 0; checkAch(); if (S.daily.date !== today()) checkDaily(); }
}
function startGame(save) {
  S = save; if (!S.skins) S.skins = {}; if (S.skin && !S.skins[S.skin]) S.skin = null; if (!S.opts) S.opts = { sfx: true }; if (!S.disc) S.disc = { 0: 1 }; if (S.inv.length < INV_SIZE) while (S.inv.length < INV_SIZE) S.inv.push(null);
  for (const k in PROFS) if (!S.prof[k]) S.prof[k] = { l: 1, xp: 0 };
  P.buffs = []; P.cds = {}; P.dead = false; P.hp = 1e9; P.mp = 1e9; recalc(); P.hp = P.st.maxHp; P.mp = P.st.maxMp;
  Net.track('start', { nw: (S.stats.played || 0) < 3, l: S.lvl });
  G.started = true; Net.watchGrants(); enterZone(ZONES[S.zone] ? S.zone : 0, null, true); checkDaily(); UI.start(); Net.pushRank();
}

/* ---------- Destacar caminho da missão ---------- */
function toggleTrack(key) { S.track = S.track === key ? null : key; G.pathT = 0; G.path = null; UI.dirty.quest = 1; UI.dirty.win = 1; if (S.track) { updatePath(); if (!G.path) UI.toast('Caminho indisponível agora.', 'bad'); } }
function trackTarget() {
  const key = S.track; if (!key) return null; const W = G.world; let zone, mob = null, tier = 0, label, npc = false;
  if (key[0] === 'q') { const q = QUEST_BY_ID[key.slice(2)]; if (!q || !(q.id in S.quests.active)) { S.track = null; UI.dirty.quest = 1; return null; } label = q.name; zone = q.zone; if (S.quests.active[q.id] >= q.obj.n) npc = true; else if (q.obj.type === 'gather') tier = q.obj.tier; else mob = q.obj.mob; }
  else { const d = S.daily.list[+key.slice(2)]; if (!d || d.claimed || d.prog >= d.n) { S.track = null; UI.dirty.quest = 1; return null; } label = 'Contrato: ' + MOBS[d.mob].name; mob = d.mob; zone = ZONES.findIndex(z => z.mobs && z.mobs.includes(d.mob)); }
  const near = (list, f) => { let b = null, bd = 1e12; for (const o of list) { if (f && !f(o)) continue; const dd = (o.x - P.x) ** 2 + (o.y - P.y) ** 2; if (dd < bd) { bd = dd; b = o; } } return b; };
  if (npc) { const n = W.npcs.find(n => n.key === 'quest' || n.key === 'scout'); return n ? { x: n.x, y: n.y + 34, label: 'Entregar: ' + label } : null; }
  if (zone !== W.id) { const p = W.portals.find(p => zone > W.id ? p.to === W.id + 1 : p.to === W.id - 1); return p ? { x: p.x, y: p.y, label: 'Rumo a ' + ZONES[zone].name } : null; }
  if (tier) { const n = near(W.nodes, n => G.time >= n.readyAt && S.prof[NODE_PROF[n.kind]].l >= tierReq(n.tier)) || near(W.nodes); return n ? { x: n.x, y: n.y + 20, label } : null; }
  const m = near(G.mobs, m => !m.dead && m.def.id === mob) || near(W.spawns, s => s.mob === mob); return m ? { x: m.x, y: m.y, label } : null;
}
function updatePath() {
  const tg = trackTarget(); if (!tg) { G.path = null; return; }
  const W = G.world, w = W.w, h = W.h, N = w * h, dist = G._pd && G._pd.length === N ? G._pd : (G._pd = new Int32Array(N)); dist.fill(-1);
  let tx = Math.max(0, Math.min(w - 1, Math.floor(tg.x / TILE))), ty = Math.max(0, Math.min(h - 1, Math.floor(tg.y / TILE)));
  if (W.solid[ty * w + tx]) { let f = null; for (let r = 1; r < 6 && !f; r++) for (let y = ty - r; y <= ty + r && !f; y++) for (let x = tx - r; x <= tx + r; x++) if (x >= 0 && y >= 0 && x < w && y < h && !W.solid[y * w + x] && W.reach[y * w + x]) { f = [x, y]; break; } if (!f) { G.path = null; return; } tx = f[0]; ty = f[1]; }
  const px = Math.floor(P.x / TILE), py = Math.floor(P.y / TILE), start = py * w + px, q = G._pq && G._pq.length === N ? G._pq : (G._pq = new Int32Array(N)); let qh = 0, qt = 0;
  dist[ty * w + tx] = 0; q[qt++] = ty * w + tx;
  while (qh < qt) { const i = q[qh++]; if (i === start) break; const x = i % w, y = (i / w) | 0, d = dist[i] + 1; if (x > 0 && dist[i - 1] < 0 && !W.solid[i - 1]) { dist[i - 1] = d; q[qt++] = i - 1; } if (x < w - 1 && dist[i + 1] < 0 && !W.solid[i + 1]) { dist[i + 1] = d; q[qt++] = i + 1; } if (y > 0 && dist[i - w] < 0 && !W.solid[i - w]) { dist[i - w] = d; q[qt++] = i - w; } if (y < h - 1 && dist[i + w] < 0 && !W.solid[i + w]) { dist[i + w] = d; q[qt++] = i + w; } }
  if (start < 0 || start >= N || dist[start] < 0) { G.path = null; return; }
  const pts = [{ x: P.x, y: P.y }]; let cx = px, cy = py;
  for (let k = 0; k < 40 && dist[cy * w + cx] > 0; k++) {
    let bx = cx, by = cy, bd = dist[cy * w + cx];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const d = dist[ny * w + nx]; if (d < 0) continue; if (dx && dy && (W.solid[cy * w + nx] || W.solid[ny * w + cx])) continue; if (d < bd) { bd = d; bx = nx; by = ny; } }
    if (bx === cx && by === cy) break; cx = bx; cy = by; pts.push({ x: (cx + 0.5) * TILE, y: (cy + 0.5) * TILE });
  }
  if (dist[cy * w + cx] === 0) pts.push({ x: tg.x, y: tg.y });
  G.path = { pts, tx: tg.x, ty: tg.y, label: tg.label };
}

/* ---------- Skins ---------- */
function applyGrants(sk) {
  if (!S) return; const next = {}; for (const k in (sk || {})) if (SKINS[k] && sk[k]) next[k] = 1;
  for (const k in next) if (!S.skins[k]) { UI.toast('🎭 Você recebeu a skin ' + SKINS[k].name + '! Abra "Visuais" para equipar.', 'gold'); UI.log('Nova skin desbloqueada: ' + SKINS[k].name + '.', 'r4'); Sfx.play('rare'); fxPillar(P.x, P.y, SKINS[k].c); }
  for (const k in S.skins) if (!next[k]) UI.log('A skin ' + SKINS[k].name + ' foi removida da sua conta.', 'sys');
  S.skins = next; if (S.skin && !next[S.skin]) S.skin = null; UI.dirty.win = 1; saveLocal();
}
function equipSkin(id) { if (id && !S.skins[id]) return; S.skin = id || null; Net.lastState = ''; fxRing(P.x, P.y, 50, id ? SKINS[id].c : '#fff', 0.5); Sfx.play('equip'); UI.dirty.win = 1; saveLocal(); }
function runCommand(text) {
  const a = text.trim().split(/\s+/), cmd = a[0].toLowerCase();
  if (cmd === '/adm') { if (Net.mode === 'ws') Net.admLogin(a[1] || ''); else UI.log(Net.isAdmin ? 'Você é ADM (dono/editor desta página).' : 'Você não é ADM aqui.', 'sys'); return; }
  if (cmd === '/grupo' || cmd === '/g' || cmd === '/party') {
    const sub = (a[1] || '').toLowerCase(), nm = a.slice(2).join(' ');
    if (sub === 'convidar' || sub === 'invite') { if (!nm) UI.log('Uso: /grupo convidar <jogador>', 'sys'); else Net.partySend('invite', { name: nm }); }
    else if (sub === 'aceitar') Net.partySend('accept'); else if (sub === 'recusar') Net.partySend('decline'); else if (sub === 'sair') Net.partySend('leave');
    else UI.log(Net.inParty() ? '👥 Grupo: ' + Net.party.members.map(m => m.n + ' (Nv.' + m.l + ')').join(', ') + '. /grupo sair para deixar.' : 'Grupo (até 4): /grupo convidar <jogador> · /grupo aceitar · /grupo recusar · /grupo sair. Também dá para tocar em um jogador para convidar.', 'sys');
    return;
  }
  if (cmd === '/skin') {
    const sub = (a[1] || '').toLowerCase();
    if (sub === 'lista' || !sub) { UI.log('Skins: ' + Object.keys(SKINS).map(k => k + ' (' + SKINS[k].name + ')').join(', ') + '. Uso: /skin dar <jogador> <skin> · /skin tirar <jogador> <skin>', 'sys'); return; }
    if (sub === 'dar' || sub === 'tirar') { const skin = (a[a.length - 1] || '').toLowerCase(), name = a.slice(2, -1).join(' '); if (a.length < 4 || !SKINS[skin] || !name) { UI.log('Uso: /skin ' + sub + ' <jogador> <' + Object.keys(SKINS).join('|') + '>', 'sys'); return; } Net.grant(name, skin, sub === 'dar'); return; }
  }
  UI.log('Comando desconhecido. Comandos: /grupo · /skin lista · /skin dar · /skin tirar · /adm', 'sys');
}
