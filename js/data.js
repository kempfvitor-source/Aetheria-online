'use strict';
/* ============ AETHERIA ONLINE — dados do jogo ============ */
const TILE = 48;
const MAX_LEVEL = 60;
const INV_SIZE = 40;
const CASH_ENABLED = false; // Loja de cash: manter false até integrar um gateway de pagamento

const RARITY = [
  { n: 'Comum', c: '#cfd3dc', m: 1 },
  { n: 'Incomum', c: '#6fe07a', m: 1.18 },
  { n: 'Raro', c: '#58aaff', m: 1.4 },
  { n: 'Épico', c: '#c77dff', m: 1.7 },
  { n: 'Lendário', c: '#ffb637', m: 2.1 },
];

const SLOTS = ['weapon', 'helm', 'chest', 'gloves', 'boots', 'ring', 'amulet'];
const SLOT_NAME = { weapon: 'Arma', helm: 'Elmo', chest: 'Armadura', gloves: 'Luvas', boots: 'Botas', ring: 'Anel', amulet: 'Amuleto' };
const SLOT_ICON = { weapon: '⚔️', helm: '🪖', chest: '🛡️', gloves: '🧤', boots: '🥾', ring: '💍', amulet: '📿' };
const ATTR_NAME = { str: 'Força', agi: 'Agilidade', int: 'Inteligência', vit: 'Vitalidade' };
const ATTR_DESC = {
  str: 'Aumenta o ataque de Guerreiros e Clérigos.',
  agi: 'Aumenta crítico, esquiva e velocidade de ataque. Ataque de Arqueiros.',
  int: 'Aumenta a mana máxima. Ataque de Magos e Clérigos.',
  vit: 'Aumenta a vida máxima e a defesa.',
};

function xpNeed(l) { return Math.floor(50 * Math.pow(l, 2.1) + 50 * l); }

/* ---------- Classes ---------- */
const CLASSES = {
  warrior: {
    name: 'Guerreiro', icon: '⚔️', main: ['str'], range: 62, ranged: false, color: '#c44536', trim: '#f1c40f', hair: '#5b3a1e',
    weapon: 'Espada', wIcon: '🗡️', hp: 150, hpL: 24, mp: 50, mpL: 4, base: { str: 9, agi: 5, int: 3, vit: 8 },
    desc: 'Combatente de linha de frente. Muita vida, defesa alta e golpes em área.',
    skills: [
      { id: 'w1', name: 'Golpe Brutal', icon: '💥', lvl: 1, mp: 8, cd: 4, type: 'target', mul: 1.9, desc: 'Um golpe poderoso em um único alvo.' },
      { id: 'w2', name: 'Redemoinho', icon: '🌀', lvl: 6, mp: 16, cd: 8, type: 'aoeSelf', mul: 1.35, radius: 120, desc: 'Gira a lâmina atingindo todos ao redor.' },
      { id: 'w3', name: 'Grito de Guerra', icon: '📣', lvl: 14, mp: 22, cd: 30, type: 'buff', buff: { atk: 0.25, dur: 12 }, desc: 'Aumenta seu ataque em 25% por 12s.' },
      { id: 'w4', name: 'Investida Sísmica', icon: '🌋', lvl: 24, mp: 34, cd: 18, type: 'dash', mul: 2.7, radius: 130, stun: 1.6, desc: 'Avança até o alvo, causa dano em área e atordoa.' },
    ],
    passives: [
      { id: 'wp1', name: 'Pele de Ferro', icon: '🛡️', stat: 'defPct', per: 3, desc: '+3% de defesa por nível.' },
      { id: 'wp2', name: 'Vigor', icon: '❤️', stat: 'hpPct', per: 2, desc: '+2% de vida máxima por nível.' },
    ],
  },
  archer: {
    name: 'Arqueira', icon: '🏹', main: ['agi'], range: 330, ranged: true, color: '#2e8b57', trim: '#e8d8a0', hair: '#d9a441',
    weapon: 'Arco', wIcon: '🏹', hp: 110, hpL: 17, mp: 60, mpL: 5, base: { str: 4, agi: 10, int: 4, vit: 6 },
    desc: 'Ataques rápidos à distância com alta chance de crítico.',
    skills: [
      { id: 'a1', name: 'Tiro Preciso', icon: '🎯', lvl: 1, mp: 8, cd: 4, type: 'target', mul: 2.0, desc: 'Uma flecha certeira de alto dano.' },
      { id: 'a2', name: 'Chuva de Flechas', icon: '🌧️', lvl: 6, mp: 18, cd: 9, type: 'aoeTarget', mul: 1.4, radius: 110, desc: 'Flechas caem sobre a área do alvo.' },
      { id: 'a3', name: 'Passo do Vento', icon: '💨', lvl: 14, mp: 20, cd: 28, type: 'buff', buff: { spd: 0.35, dodge: 20, dur: 9 }, desc: '+35% de velocidade e +20% de esquiva por 9s.' },
      { id: 'a4', name: 'Flecha Perfurante', icon: '☄️', lvl: 24, mp: 32, cd: 16, type: 'aoeTarget', mul: 3.0, radius: 90, desc: 'Um disparo devastador que atravessa os inimigos.' },
    ],
    passives: [
      { id: 'ap1', name: 'Olho de Águia', icon: '🦅', stat: 'crit', per: 1.5, desc: '+1,5% de chance de crítico por nível.' },
      { id: 'ap2', name: 'Mãos Ágeis', icon: '✋', stat: 'aspd', per: 2.5, desc: '+2,5% de velocidade de ataque por nível.' },
    ],
  },
  mage: {
    name: 'Maga', icon: '🔮', main: ['int'], range: 310, ranged: true, color: '#5b4bd6', trim: '#9be7ff', hair: '#e8e8f5',
    weapon: 'Cajado', wIcon: '🪄', hp: 95, hpL: 14, mp: 110, mpL: 9, base: { str: 3, agi: 5, int: 11, vit: 5 },
    desc: 'Magias destrutivas em área. Frágil, mas com o maior dano do jogo.',
    skills: [
      { id: 'm1', name: 'Bola de Fogo', icon: '🔥', lvl: 1, mp: 10, cd: 4, type: 'aoeTarget', mul: 1.9, radius: 60, desc: 'Explode no alvo atingindo inimigos próximos.' },
      { id: 'm2', name: 'Nova de Gelo', icon: '❄️', lvl: 6, mp: 20, cd: 10, type: 'aoeSelf', mul: 1.25, radius: 140, slow: 4, desc: 'Congela e desacelera inimigos ao redor.' },
      { id: 'm3', name: 'Barreira Arcana', icon: '🔰', lvl: 14, mp: 28, cd: 30, type: 'buff', buff: { shield: 0.35, dur: 12 }, desc: 'Escudo que absorve dano igual a 35% da sua vida.' },
      { id: 'm4', name: 'Meteoro', icon: '☄️', lvl: 24, mp: 45, cd: 22, type: 'aoeTarget', mul: 3.8, radius: 150, desc: 'Invoca um meteoro colossal sobre o alvo.' },
    ],
    passives: [
      { id: 'mp1', name: 'Poder Arcano', icon: '✨', stat: 'dmgPct', per: 2, desc: '+2% de dano por nível.' },
      { id: 'mp2', name: 'Meditação', icon: '🧘', stat: 'mpRegen', per: 10, desc: '+10% de regeneração de mana por nível.' },
    ],
  },
  cleric: {
    name: 'Clérigo', icon: '✝️', main: ['int', 'str'], range: 250, ranged: true, color: '#d9b44a', trim: '#ffffff', hair: '#8a5a2b',
    weapon: 'Cetro', wIcon: '🔱', hp: 125, hpL: 19, mp: 90, mpL: 7, base: { str: 6, agi: 4, int: 8, vit: 7 },
    desc: 'Guerreiro sagrado equilibrado: causa dano de luz e cura a si mesmo.',
    skills: [
      { id: 'c1', name: 'Luz Sagrada', icon: '🌟', lvl: 1, mp: 9, cd: 4, type: 'target', mul: 1.85, desc: 'Um raio de luz fere o alvo.' },
      { id: 'c2', name: 'Cura Divina', icon: '💚', lvl: 6, mp: 24, cd: 12, type: 'heal', heal: 0.3, desc: 'Recupera 30% da sua vida máxima.' },
      { id: 'c3', name: 'Bênção', icon: '🙏', lvl: 14, mp: 26, cd: 30, type: 'buff', buff: { def: 0.3, regen: 0.03, dur: 14 }, desc: '+30% de defesa e regeneração por 14s.' },
      { id: 'c4', name: 'Julgamento', icon: '⚡', lvl: 24, mp: 38, cd: 18, type: 'aoeTarget', mul: 3.0, radius: 130, stun: 1, desc: 'A ira dos céus cai sobre a área e atordoa.' },
    ],
    passives: [
      { id: 'cp1', name: 'Fé Inabalável', icon: '🕊️', stat: 'hpPct', per: 2, desc: '+2% de vida máxima por nível.' },
      { id: 'cp2', name: 'Luz Interior', icon: '💡', stat: 'dmgPct', per: 1.5, desc: '+1,5% de dano por nível.' },
    ],
  },
};
const SKILL_MAX = 10;

/* ---------- Monstros ---------- */
const MOBS = {
  slime: { name: 'Gosma Orvalhada', kind: 'slime', c: '#7ad67a', lvl: 1, mat: 'Gel Orvalhado' },
  boar: { name: 'Javali Bravo', kind: 'beast', c: '#9a6b45', lvl: 3, mat: 'Presa de Javali' },
  sprite: { name: 'Fada Travessa', kind: 'flyer', c: '#ff9ad5', lvl: 5, ranged: 1, mat: 'Pó de Fada' },
  kingslime: { name: 'Rei Gosma', kind: 'slime', c: '#3fb8a0', lvl: 8, boss: 1, mat: 'Coroa Gelatinosa' },

  wolf: { name: 'Lobo Sombrio', kind: 'beast', c: '#55607a', lvl: 8, mat: 'Pele de Lobo' },
  shroom: { name: 'Cogumelo Andante', kind: 'shroom', c: '#d9534f', lvl: 10, mat: 'Esporo Rubro' },
  goblin: { name: 'Goblin Saqueador', kind: 'humanoid', c: '#7fae4a', lvl: 13, mat: 'Orelha de Goblin' },
  ent: { name: 'Ent Ancião', kind: 'golem', c: '#6b4f2a', c2: '#3f8f3f', lvl: 16, boss: 1, mat: 'Coração de Seiva' },

  toad: { name: 'Sapo Venenoso', kind: 'slime', c: '#8faa3c', lvl: 16, mat: 'Glândula Tóxica' },
  spider: { name: 'Aranha do Brejo', kind: 'spider', c: '#4d3b5c', lvl: 19, mat: 'Seda Viscosa' },
  hag: { name: 'Bruxa do Lodo', kind: 'humanoid', c: '#5a7a5a', lvl: 22, ranged: 1, mat: 'Olho de Bruxa' },
  hydra: { name: 'Hidra do Pântano', kind: 'dragon', c: '#3f7f5f', lvl: 25, boss: 1, mat: 'Escama de Hidra' },

  scorpion: { name: 'Escorpião Dourado', kind: 'spider', c: '#d4a437', lvl: 25, mat: 'Ferrão Dourado' },
  mummy: { name: 'Múmia Errante', kind: 'humanoid', c: '#d8cfa8', lvl: 28, mat: 'Faixa Antiga' },
  djinn: { name: 'Djinn de Areia', kind: 'flyer', c: '#e6b35a', lvl: 32, ranged: 1, mat: 'Areia Encantada' },
  pharaoh: { name: 'Faraó Esquecido', kind: 'humanoid', c: '#e8c547', lvl: 35, boss: 1, mat: 'Máscara Solar' },

  icewolf: { name: 'Lobo Glacial', kind: 'beast', c: '#bfe3f5', lvl: 35, mat: 'Presa de Gelo' },
  icegolem: { name: 'Golem de Gelo', kind: 'golem', c: '#8fc7e8', c2: '#e8f7ff', lvl: 39, mat: 'Núcleo Gélido' },
  wraith: { name: 'Espectro da Nevasca', kind: 'flyer', c: '#cfd8ff', lvl: 43, ranged: 1, mat: 'Véu Espectral' },
  wyrm: { name: 'Wyrm de Cristal', kind: 'dragon', c: '#7fd4ff', lvl: 46, boss: 1, mat: 'Escama Cristalina' },

  imp: { name: 'Diabrete de Lava', kind: 'humanoid', c: '#e2572b', lvl: 46, mat: 'Chifre Ardente' },
  salamander: { name: 'Salamandra Ígnea', kind: 'beast', c: '#ff8a3c', lvl: 49, mat: 'Cauda Flamejante' },
  magma: { name: 'Golem de Magma', kind: 'golem', c: '#4a2f2a', c2: '#ff6a1f', lvl: 53, mat: 'Núcleo de Magma' },
  ifrit: { name: 'Ifrit, Senhor das Brasas', kind: 'dragon', c: '#ff5a2a', lvl: 56, boss: 1, mat: 'Chama Eterna' },

  voidknight: { name: 'Cavaleiro do Vazio', kind: 'humanoid', c: '#6b4fa8', lvl: 56, mat: 'Fragmento Sombrio' },
  apparition: { name: 'Aparição do Véu', kind: 'flyer', c: '#b58cff', lvl: 58, ranged: 1, mat: 'Essência do Véu' },
  colossus: { name: 'Colosso Abissal', kind: 'golem', c: '#2e2447', c2: '#b58cff', lvl: 60, mat: 'Núcleo Abissal' },
  archon: { name: 'Arconte do Véu', kind: 'dragon', c: '#9b5cff', lvl: 62, boss: 1, mat: 'Coração do Véu' },
};
for (const k in MOBS) MOBS[k].id = k;

function mobStats(def, elite) {
  const L = def.lvl;
  let hp = 38 + 9 * Math.pow(L, 1.42), atk = 6 + L * 3.1, d = L * 1.6, xp = 9 + L * 5.6, gold = 2 + L * 1.1;
  if (def.ranged) { hp *= 0.8; atk *= 0.9; }
  if (elite) { hp *= 3.2; atk *= 1.45; xp *= 4; gold *= 4; }
  if (def.boss) { hp *= 26; atk *= 2.0; d *= 1.2; xp *= 45; gold *= 40; }
  return { hp: Math.round(hp), atk: Math.round(atk), def: Math.round(d), xp: Math.round(xp), gold: Math.round(gold) };
}

/* ---------- Zonas ---------- */
const ZONES = [
  { id: 0, name: 'Vila de Lumina', safe: true, w: 46, h: 38, lvl: [1, 60], theme: 'town',
    pal: { g1: '#63b356', g2: '#58a74d', path: '#d2bd8a', water: '#4fb3e0', shore: '#e6d9a8', cliff: '#7c8a6a', floor: '#cfc6b4', leaf: '#3c9447', leaf2: '#5cc46a', trunk: '#6b4a2b', rock: '#9aa0a8', tint: null }, fx: 'petal' },
  { id: 1, name: 'Campos de Aurora', lvl: [1, 7], w: 96, h: 60, theme: 'meadow', mobs: ['slime', 'boar', 'sprite'], boss: 'kingslime',
    pal: { g1: '#6cbd55', g2: '#5fb04b', path: '#d6c08c', water: '#4fb3e0', shore: '#e6d9a8', cliff: '#8a9a72', leaf: '#3f9a48', leaf2: '#74d06e', trunk: '#6b4a2b', rock: '#a0a6ae', tint: null }, fx: 'petal' },
  { id: 2, name: 'Floresta Sussurrante', lvl: [7, 15], w: 96, h: 60, theme: 'forest', mobs: ['wolf', 'shroom', 'goblin'], boss: 'ent',
    pal: { g1: '#3f8a56', g2: '#357a4c', path: '#8f7d5c', water: '#3a8fb0', shore: '#5d7a55', cliff: '#4c5e4a', leaf: '#256b45', leaf2: '#3fa06a', trunk: '#4a3423', rock: '#7a8088', tint: 'rgba(10,40,50,0.22)' }, fx: 'firefly' },
  { id: 3, name: 'Pântano Névoa-Verde', lvl: [15, 24], w: 96, h: 60, theme: 'swamp', mobs: ['toad', 'spider', 'hag'], boss: 'hydra',
    pal: { g1: '#5c7044', g2: '#52653d', path: '#7a6a4a', water: '#4d7a55', shore: '#4a5a3a', cliff: '#3f4a38', leaf: '#44603a', leaf2: '#7a9a4a', trunk: '#3a2f25', rock: '#6a7068', tint: 'rgba(40,60,20,0.25)' }, fx: 'fog' },
  { id: 4, name: 'Ruínas de Solária', lvl: [24, 34], w: 96, h: 60, theme: 'desert', mobs: ['scorpion', 'mummy', 'djinn'], boss: 'pharaoh',
    pal: { g1: '#e3c98a', g2: '#d9bd7c', path: '#c9a868', water: '#3fc0b8', shore: '#f2e2b0', cliff: '#b58a55', leaf: '#5aa055', leaf2: '#8fd07a', trunk: '#8a6a3a', rock: '#c8a878', tint: 'rgba(255,190,90,0.10)' }, fx: 'dust' },
  { id: 5, name: 'Picos de Cristal Gélido', lvl: [34, 45], w: 96, h: 60, theme: 'snow', mobs: ['icewolf', 'icegolem', 'wraith'], boss: 'wyrm',
    pal: { g1: '#e9f2fa', g2: '#dce9f5', path: '#b9c9da', water: '#7fc4ea', shore: '#c7e3f5', cliff: '#8aa0b8', leaf: '#2f6a5a', leaf2: '#f5fbff', trunk: '#4a3a30', rock: '#9fb4c8', tint: 'rgba(120,170,255,0.10)' }, fx: 'snow' },
  { id: 6, name: 'Terras de Cinzas', lvl: [45, 55], w: 96, h: 60, theme: 'ash', mobs: ['imp', 'salamander', 'magma'], boss: 'ifrit',
    pal: { g1: '#4a3f3c', g2: '#423733', path: '#6a5a50', water: '#ff6a1f', shore: '#2a1f1c', cliff: '#2e2624', leaf: '#3a2a26', leaf2: '#ff8a3c', trunk: '#241a18', rock: '#5a4a46', tint: 'rgba(255,80,20,0.10)' }, fx: 'ember' },
  { id: 7, name: 'Cidadela do Véu', lvl: [55, 60], w: 96, h: 60, theme: 'void', mobs: ['voidknight', 'apparition', 'colossus'], boss: 'archon',
    pal: { g1: '#3a2f5c', g2: '#332a52', path: '#5a4a8a', water: '#1a1030', shore: '#6a4fc0', cliff: '#221a3a', leaf: '#7a4fd0', leaf2: '#c9a6ff', trunk: '#2a2040', rock: '#5a4f7a', tint: 'rgba(90,40,160,0.16)' }, fx: 'mote' },
];
const TIER_PREFIX = ['', 'de Aprendiz', 'Silvestre', 'do Brejo', 'Solar', 'Glacial', 'Ígneo', 'do Véu'];
function tierOfLevel(l) { for (let i = 7; i >= 1; i--) if (l >= ZONES[i].lvl[0]) return i; return 1; }

/* ---------- Itens ---------- */
const ORE = ['', 'Cobre', 'Ferro', 'Prata', 'Ouro', 'Mithril', 'Adamantita', 'Oricalco'];
const WOOD = ['', 'Carvalho', 'Salgueiro', 'Cipreste', 'Palmeira-Solar', 'Pinho-Gélido', 'Cinzalenha', 'Ébano do Véu'];
const HERB = ['', 'Flor-da-Aurora', 'Musgo-Lunar', 'Lótus do Brejo', 'Cacto-Solar', 'Rosa-de-Gelo', 'Flor-de-Brasa', 'Orquídea do Véu'];
const ITEMS = {
  stone: { name: 'Pedra de Reforço', icon: '💠', desc: 'Usada pelo Ferreiro para reforçar equipamentos.', price: 600, r: 2 },
  feather: { name: 'Pena Etérea', icon: '🪶', desc: 'Material raro usado para evoluir suas Asas.', price: 0, sell: 40, r: 3 },
  scroll: { name: 'Pergaminho de Retorno', icon: '📜', desc: 'Teleporta você para a Vila de Lumina.', price: 80, use: 'return', r: 1 },
  elx_atk: { name: 'Elixir da Fúria', icon: '🧉', desc: '+15% de ataque por 10 minutos.', price: 0, sell: 60, use: 'elx', buff: { atk: 0.15, dur: 600 }, r: 2 },
  elx_def: { name: 'Elixir da Rocha', icon: '🍵', desc: '+20% de defesa por 10 minutos.', price: 0, sell: 60, use: 'elx', buff: { def: 0.2, dur: 600 }, r: 2 },
};
const POT_HP = [0, 90, 280, 750, 1700], POT_MP = [0, 60, 160, 380, 800], POT_LVL = [0, 1, 15, 30, 45], POT_PRICE = [0, 18, 70, 240, 650];
const POT_NAME = ['', 'Pequena', 'Média', 'Grande', 'Suprema'];
for (let i = 1; i <= 4; i++) {
  ITEMS['hp' + i] = { name: 'Poção de Vida ' + POT_NAME[i], icon: '🧪', desc: 'Recupera ' + POT_HP[i] + ' de vida.', price: POT_PRICE[i], use: 'hp', val: POT_HP[i], req: POT_LVL[i], r: Math.min(i - 1, 3), tint: '#ff5a6a' };
  ITEMS['mp' + i] = { name: 'Poção de Mana ' + POT_NAME[i], icon: '⚗️', desc: 'Recupera ' + POT_MP[i] + ' de mana.', price: Math.round(POT_PRICE[i] * 0.9), use: 'mp', val: POT_MP[i], req: POT_LVL[i], r: Math.min(i - 1, 3), tint: '#5aa0ff' };
}
for (let i = 1; i <= 7; i++) {
  ITEMS['ore' + i] = { name: 'Minério de ' + ORE[i], icon: '⛏️', desc: 'Minério de tier ' + i + '. Usado na Forja.', sell: 4 * i, tier: i, r: 0 };
  ITEMS['wood' + i] = { name: 'Madeira de ' + WOOD[i], icon: '🪵', desc: 'Madeira de tier ' + i + '. Usada na Forja.', sell: 3 * i, tier: i, r: 0 };
  ITEMS['herb' + i] = { name: HERB[i], icon: '🌿', desc: 'Erva de tier ' + i + '. Usada na Alquimia.', sell: 3 * i, tier: i, r: 0 };
}
for (const k in MOBS) ITEMS['m_' + k] = { name: MOBS[k].mat, icon: MOBS[k].boss ? '👑' : '🦴', desc: 'Material obtido de ' + MOBS[k].name + '.', sell: Math.round(3 + MOBS[k].lvl * (MOBS[k].boss ? 12 : 1.2)), r: MOBS[k].boss ? 3 : 0 };
for (const k in ITEMS) { ITEMS[k].id = k; if (ITEMS[k].sell == null) ITEMS[k].sell = Math.round((ITEMS[k].price || 0) * 0.25); }

/* ---------- Profissões ---------- */
const PROFS = {
  mining: { name: 'Mineração', icon: '⛏️', res: 'ore', gather: true },
  logging: { name: 'Lenhador', icon: '🪓', res: 'wood', gather: true },
  herbalism: { name: 'Herbalismo', icon: '🌿', res: 'herb', gather: true },
  smithing: { name: 'Forja', icon: '🔨' },
  alchemy: { name: 'Alquimia', icon: '⚗️' },
};
const PROF_MAX = 50;
function profNeed(l) { return Math.floor(40 * Math.pow(l, 1.7) + 30 * l); }
function tierReq(t) { return (t - 1) * 7 + 1; } // nível de profissão necessário por tier

/* ---------- Asas ---------- */
const WINGS = [null,
  { name: 'Asas de Aprendiz', c1: '#e8eef5', c2: '#b8c6d8' },
  { name: 'Asas do Vento', c1: '#b6f0d2', c2: '#57c79a' },
  { name: 'Asas de Cristal', c1: '#bfeaff', c2: '#56b6f0' },
  { name: 'Asas Flamejantes', c1: '#ffd27a', c2: '#ff6a2a' },
  { name: 'Asas Glaciais', c1: '#f0fbff', c2: '#7fd0ff' },
  { name: 'Asas Sombrias', c1: '#a58cd8', c2: '#3a2466' },
  { name: 'Asas Celestiais', c1: '#fff6c8', c2: '#f5c542' },
  { name: 'Asas Dracônicas', c1: '#ff9a8a', c2: '#a3182a' },
  { name: 'Asas Etéreas', c1: '#e3c8ff', c2: '#9b5cff' },
  { name: 'Asas Divinas', c1: '#ffffff', c2: '#ffd86b' },
];
const WING_UNLOCK_LVL = 10;
function wingCost(t) { return { feathers: t * 2 + 1, gold: 150 * t * t + 100 }; }
function wingBonus(w) { return w && w.t ? ((w.t - 1) * 10 + w.s) * 0.005 : 0; }

/* ---------- NPCs ---------- */
const NPCS = {
  quest: { name: 'Mestra Elowen', title: 'Missões', c: '#7a4fd0', hair: '#f0e6ff', icon: '❗' },
  smith: { name: 'Ferreiro Brom', title: 'Forja e Reforço', c: '#8a5a3a', hair: '#3a2a20', icon: '🔨' },
  alch: { name: 'Alquimista Mirela', title: 'Poções e Alquimia', c: '#2f9a8a', hair: '#ff8ab0', icon: '⚗️' },
  merchant: { name: 'Mercador Tobias', title: 'Compra e Venda', c: '#c08a2a', hair: '#5a4030', icon: '💰' },
  wings: { name: 'Guardiã Seraphine', title: 'Asas', c: '#e8e8ff', hair: '#ffd86b', icon: '🪽' },
  cash: { name: 'Emissária Lux', title: 'Loja de Cristais', c: '#ff5aa0', hair: '#7fe0ff', icon: '💎' },
  tele: { name: 'Cristal de Teleporte', title: 'Viagem', icon: '🌀', crystal: true },
  scout: { name: 'Batedor Kael', title: 'Posto Avançado', c: '#4a6a8a', hair: '#2a2a2a', icon: '⛺' },
};

/* ---------- Missões principais ---------- */
const QUEST_TEXT = [null,
  [['Gosmas no Caminho', 'As gosmas tomaram a estrada para os Campos de Aurora. Limpe o caminho para os viajantes.'],
   ['Presas Afiadas', 'Os javalis destroem as plantações. Traga presas como prova de que a manada recuou.'],
   ['Brilho Travesso', 'As fadas estão roubando as lanternas da vila. Dê-lhes uma lição.'],
   ['Primeira Colheita', 'Toda aventureira precisa de um ofício. Colete recursos dos campos: minério, madeira ou ervas.'],
   ['O Rei Gelatinoso', 'No coração dos campos reina uma gosma colossal. Derrote o Rei Gosma!']],
  [['Uivos na Névoa', 'Lobos sombrios cercam os lenhadores da Floresta Sussurrante. Reduza a alcateia.'],
   ['Esporos Rubros', 'A alquimista precisa de esporos dos cogumelos andantes para um antídoto.'],
   ['Acampamento Goblin', 'Goblins saqueadores montaram acampamento. Expulse-os da floresta.'],
   ['Madeira e Metal', 'O posto avançado precisa de materiais. Colete recursos da floresta.'],
   ['A Fúria do Ancião', 'O Ent Ancião foi corrompido por uma energia estranha. Liberte-o de seu tormento.']],
  [['Coaxar Venenoso', 'Os sapos do pântano envenenam a água. Elimine-os.'],
   ['Fios do Brejo', 'A seda das aranhas do brejo é rara e resistente. Colete algumas amostras.'],
   ['Maldição do Lodo', 'Bruxas conduzem rituais na névoa. Interrompa-os.'],
   ['Riquezas Submersas', 'Há recursos valiosos sob a lama. Colete o que puder.'],
   ['Sete Cabeças', 'A Hidra desperta. Corte o mal pela raiz... várias vezes.']],
  [['Ferrões na Areia', 'Escorpiões dourados infestam as ruínas de Solária.'],
   ['Faixas Antigas', 'As faixas das múmias guardam inscrições antigas. Recupere-as.'],
   ['Ventos Encantados', 'Djinns rebeldes atormentam as caravanas. Derrote-os.'],
   ['Tesouros do Deserto', 'O deserto esconde ouro e ervas raras. Colete recursos.'],
   ['O Faraó Esquecido', 'O antigo rei de Solária se levantou de sua tumba. Devolva-o ao descanso.']],
  [['Caçada Gelada', 'Lobos glaciais descem das montanhas. Proteja a passagem.'],
   ['Núcleos Gélidos', 'Os golens de gelo guardam núcleos de puro frio. Traga alguns.'],
   ['Sussurros da Nevasca', 'Espectros vagam na tempestade. Dê-lhes paz.'],
   ['Veios de Mithril', 'As montanhas são ricas em mithril. Colete recursos dos picos.'],
   ['O Wyrm de Cristal', 'Um dragão de gelo e cristal dorme no cume. Chegou a hora de acordá-lo.']],
  [['Diabretes em Chamas', 'Diabretes de lava espalham incêndios. Apague-os — do seu jeito.'],
   ['Caudas Flamejantes', 'As caudas das salamandras ardem para sempre. Reúna algumas.'],
   ['Coração de Magma', 'Golens de magma bloqueiam o caminho para a Cidadela.'],
   ['Forja do Mundo', 'A adamantita só existe perto da lava. Colete recursos.'],
   ['O Senhor das Brasas', 'Ifrit comanda as Terras de Cinzas. Enfrente-o.']],
  [['Guardas do Vazio', 'Cavaleiros do Vazio patrulham a Cidadela. Abra caminho.'],
   ['Essência do Véu', 'As aparições carregam a essência que rasga o mundo. Colete-a.'],
   ['Colossos Abissais', 'Os colossos sustentam o portal do Arconte. Derrube-os.'],
   ['Ecos de Outro Mundo', 'Os recursos do Véu são os mais raros de Aetheria. Colete-os.'],
   ['O Arconte do Véu', 'A fonte de toda a corrupção aguarda no trono. Salve Aetheria!']],
];
const QUESTS = [];
(function buildQuests() {
  for (let z = 1; z <= 7; z++) {
    const Z = ZONES[z], [a, b, c] = Z.mobs, lo = Z.lvl[0], hi = Z.lvl[1], span = hi - lo;
    const req = [lo, lo + Math.round(span * 0.25), lo + Math.round(span * 0.5), lo + Math.round(span * 0.6), lo + Math.round(span * 0.85)];
    const objs = [
      { type: 'kill', mob: a, n: 14 + z * 4 },
      { type: 'drop', mob: b, n: 10 + z * 2, chance: 0.45, what: MOBS[b].mat },
      { type: 'kill', mob: c, n: 18 + z * 5 },
      { type: 'gather', tier: z, n: 10 + z * 2 },
      { type: 'kill', mob: Z.boss, n: 1 },
    ];
    for (let i = 0; i < 5; i++) {
      const boss = i === 4, L = Math.max(1, req[i]);
      QUESTS.push({
        id: 'q' + z + '_' + i, zone: z, name: QUEST_TEXT[z][i][0], text: QUEST_TEXT[z][i][1], reqLvl: L,
        prev: i > 0 ? 'q' + z + '_' + (i - 1) : (z > 1 ? 'q' + (z - 1) + '_4' : null), obj: objs[i],
        reward: { xp: Math.round(xpNeed(L) * (boss ? 0.6 : 0.3)), gold: Math.round((60 + L * 28) * (boss ? 3 : 1)),
          items: boss ? [['feather', 4 + z], ['stone', 1 + (z > 3 ? 1 : 0)]] : (i === 1 ? [['hp' + Math.min(4, 1 + Math.floor(L / 15)), 5]] : i === 3 ? [['feather', 1]] : []) },
      });
    }
  }
})();
const QUEST_BY_ID = {}; QUESTS.forEach(q => QUEST_BY_ID[q.id] = q);

/* ---------- Conquistas ---------- */
const ACHS = [
  { id: 'k100', name: 'Caçador Iniciante', desc: 'Derrote 100 monstros.', test: s => s.stats.kills >= 100, gold: 200 },
  { id: 'k1000', name: 'Exterminador', desc: 'Derrote 1.000 monstros.', test: s => s.stats.kills >= 1000, gold: 1500 },
  { id: 'k10000', name: 'Lenda Viva', desc: 'Derrote 10.000 monstros.', test: s => s.stats.kills >= 10000, gold: 12000 },
  { id: 'b1', name: 'Mata-Chefes', desc: 'Derrote seu primeiro chefe.', test: s => s.stats.bosses >= 1, gold: 300 },
  { id: 'b25', name: 'Terror dos Chefes', desc: 'Derrote 25 chefes.', test: s => s.stats.bosses >= 25, gold: 4000 },
  { id: 'l10', name: 'Aventureiro', desc: 'Alcance o nível 10.', test: s => s.lvl >= 10, gold: 300 },
  { id: 'l30', name: 'Veterano', desc: 'Alcance o nível 30.', test: s => s.lvl >= 30, gold: 2500 },
  { id: 'l50', name: 'Herói de Aetheria', desc: 'Alcance o nível 50.', test: s => s.lvl >= 50, gold: 9000 },
  { id: 'l60', name: 'Ascendido', desc: 'Alcance o nível máximo.', test: s => s.lvl >= 60, gold: 30000 },
  { id: 'e7', name: 'Aço Temperado', desc: 'Reforce um item até +7.', test: s => s.stats.maxEnh >= 7, gold: 1200 },
  { id: 'e12', name: 'Obra-Prima', desc: 'Reforce um item até +12.', test: s => s.stats.maxEnh >= 12, gold: 8000 },
  { id: 'w3', name: 'Asas de Cristal', desc: 'Evolua suas asas até o tier 3.', test: s => s.wings.t >= 3, gold: 1500 },
  { id: 'w7', name: 'Voo Celestial', desc: 'Evolua suas asas até o tier 7.', test: s => s.wings.t >= 7, gold: 10000 },
  { id: 'g200', name: 'Coletor Dedicado', desc: 'Colete 200 recursos.', test: s => s.stats.gathers >= 200, gold: 800 },
  { id: 'c50', name: 'Artesão', desc: 'Fabrique 50 itens.', test: s => s.stats.crafts >= 50, gold: 1000 },
  { id: 'leg', name: 'Brilho Dourado', desc: 'Obtenha um item Lendário.', test: s => s.stats.legend >= 1, gold: 5000 },
];

/* ---------- Loja de Cash (EM BREVE) ---------- */
const CASH_PACKS = [
  { id: 'p1', gems: 100, bonus: 0, price: 'R$ 4,90', icon: '💎' },
  { id: 'p2', gems: 500, bonus: 50, price: 'R$ 19,90', icon: '💎' },
  { id: 'p3', gems: 1200, bonus: 180, price: 'R$ 44,90', icon: '💠' },
  { id: 'p4', gems: 2500, bonus: 500, price: 'R$ 89,90', icon: '💠' },
  { id: 'p5', gems: 6500, bonus: 1800, price: 'R$ 199,90', icon: '👑' },
];
const CASH_ITEMS = [
  { id: 'vip', name: 'Passe VIP (30 dias)', icon: '👑', gems: 600, desc: '+20% de XP e ouro, teleporte grátis e borda dourada no nome.' },
  { id: 'bag', name: 'Expansão de Mochila', icon: '🎒', gems: 250, desc: '+10 espaços permanentes no inventário.' },
  { id: 'xp', name: 'Tônico de Experiência', icon: '📈', gems: 120, desc: '+50% de XP por 2 horas.' },
  { id: 'skin1', name: 'Visual: Asas de Borboleta', icon: '🦋', gems: 800, desc: 'Aparência exclusiva para suas asas.' },
  { id: 'mount', name: 'Montaria: Grifo Real', icon: '🦅', gems: 1500, desc: '+40% de velocidade de movimento fora de combate.' },
  { id: 'pet', name: 'Mascote: Dragãozinho', icon: '🐉', gems: 900, desc: 'Companheiro que coleta ouro automaticamente.' },
  { id: 'rename', name: 'Troca de Nome', icon: '✒️', gems: 300, desc: 'Altere o nome do seu personagem.' },
  { id: 'reset', name: 'Pergaminho de Renascimento', icon: '♻️', gems: 200, desc: 'Redistribua todos os atributos e pontos de habilidade.' },
];

/* ---------- Skins (apenas visuais; concedidas por um ADM) ---------- */
const SKINS = {
  godslayer: { name: 'GODSLAYER', icon: '👑', arm: '#17131f', desc: 'Skin exclusiva da Administração. Manto divino, coroa e auréola, círculo arcano, cristais em órbita e rastro de luz.', c: '#ffb637', adm: 1 },
  padreh: { name: 'PADREH', icon: '✝️', arm: '#15141a', desc: 'Batina preta com estola roxa bordada em ouro.', c: '#c77dff' },
  tanderw: { name: 'Tanderw', icon: '🐶', arm: '#c98a4b', desc: 'O Guardião Chihuahua: capuz de orelhas pontudas, cachecol verde, pegadas brilhantes e um ossinho dourado em órbita.', c: '#e8b060' },
};
function nameKey(n) { return [...String(n).toLowerCase().trim()].map(c => /[a-z0-9]/.test(c) ? c : '_' + c.codePointAt(0).toString(16)).join('').slice(0, 120) || '_'; }
