/**
 * extras.js — 扩充内容(纯数据)。
 *
 *   · 特殊消耗品:改名卡 / 美梦药水 / 职业药水 / 星辉秘典
 *   · 大职介套装(晋升赠送的一整套服饰,不可买卖)
 *   · 扩充的日常服饰 / 武器(带等级,价格随等级递增)
 *
 * 不依赖 items.js,由 items.js 在末尾 Object.assign 合并。
 */

// ============================================================
// 特殊消耗品
// ============================================================
export const EXTRA_ITEMS = {
  rename_card: {
    id: 'rename_card', name: '改名卡', category: 'potion', price: 500000, icon: '📛',
    desc: '极昂贵的符卡,划去旧名、写上新名。在角色弹窗中使用。',
    effect: { kind: 'rename', amount: 0 },
  },
  dream_potion: {
    id: 'dream_potion', name: '美梦药水', category: 'potion', price: 800000, icon: '🧴',
    desc: '饮下后会做一个很长的梦,醒来换了一副孩童模样。在角色弹窗中使用。',
    effect: { kind: 'dream', amount: 0 },
  },
  career_elixir: {
    id: 'career_elixir', name: '职业药水', category: 'potion', price: 6000, icon: '🍶',
    desc: '饮下后职业等级 +1(不超过职业上限)。',
    effect: { kind: 'career_exp', amount: 1 },
  },
  star_codex: {
    id: 'star_codex', name: '星辉秘典', category: 'potion', price: 300000, icon: '📘',
    desc: '职业等级超过 100 后,唯有此物能继续提升职业等级。',
    effect: { kind: 'career_levelup', amount: 0 },
  },
};

// ============================================================
// 大职介套装(晋升时整套赠送;不可买卖)
// ============================================================
/** 六大职介系的配色 */
const MAJOR_SETS = [
  { key: 'apprentice', major: '学徒系', cloth: '#6d5a3a', cloth2: '#8d7449', trim: '#c9a227', hat: '#6d5a3a', boot: '#4a3423' },
  { key: 'scholar',    major: '学士系', cloth: '#3a3f6b', cloth2: '#525a94', trim: '#6fc0e8', hat: '#3a3f6b', boot: '#2f3550' },
  { key: 'deacon',     major: '执事系', cloth: '#4a3a4a', cloth2: '#6a5568', trim: '#c98fb8', hat: '#4a3a4a', boot: '#332a33' },
  { key: 'professor',  major: '教授系', cloth: '#2f4a4a', cloth2: '#436a68', trim: '#e8cd6e', hat: '#2f4a4a', boot: '#22383a' },
  { key: 'priest',     major: '祭司系', cloth: '#5a4a2a', cloth2: '#857138', trim: '#f1c40f', hat: '#5a4a2a', boot: '#3f3418' },
  { key: 'psalmist',   major: '和诗系', cloth: '#4a2f3a', cloth2: '#7a4a5e', trim: '#e8a0c0', hat: '#4a2f3a', boot: '#33202a' },
];

/**
 * 生成 6 套大职介套装(每套 4 件:帽 / 上衣 / 裤 / 鞋)。
 * 越靠后的职介系,数值越高。
 */
export function buildMajorSets() {
  const out = {};
  MAJOR_SETS.forEach((s, i) => {
    const tierHp = 6 + i * 7;
    const tierMp = 1 + i * 2;
    const tierAtk = i * 2;
    const tier = `Lv.${(i + 1) * 21}`;
    const mk = (slot, name, stats, look) => ({
      id: `set_${s.key}_${slot}`,
      name: `${s.major}·${name}`,
      category: 'outfit',
      outfitSlot: slot,
      level: (i + 1) * 21,
      price: 400 + i * 600,
      icon: { hat: '🎩', top: '🥼', bottom: '👖', shoes: '👢' }[slot],
      noTrade: true,
      desc: `${s.major}的制式${name}(${tier})。晋升大职介时整副赠予,不可买卖。`,
      equipment: { slot, stats },
      look,
    });
    out[`set_${s.key}_hat`]    = mk('hat',    '冠帽', { maxHp: Math.round(tierHp * 0.5), maxMp: tierMp }, { hat: s.hat, hatHi: s.trim, style: i >= 3 ? 'crown' : 'hood' });
    out[`set_${s.key}_top`]    = mk('top',    '长袍', { maxHp: tierHp, maxMp: tierMp, atkPower: tierAtk }, { cloth: s.cloth, cloth2: s.cloth2, trim: s.trim });
    out[`set_${s.key}_bottom`] = mk('bottom', '下装', { maxHp: Math.round(tierHp * 0.6), maxMp: Math.round(tierMp * 0.5) }, { pants: s.cloth2 });
    out[`set_${s.key}_shoes`]  = mk('shoes',  '履',   { maxHp: Math.round(tierHp * 0.4), travelDiscount: i >= 2 ? 1 : 0 }, { boot: s.boot });
  });
  return out;
}

/** 某个大职介名对应的整套服饰 id(晋升时整套赠送) */
export function majorSetIds(major) {
  const s = MAJOR_SETS.find((x) => x.major === major);
  if (!s) return [];
  return ['hat', 'top', 'bottom', 'shoes'].map((slot) => `set_${s.key}_${slot}`);
}

// ============================================================
// 扩充的日常服饰 / 武器(带等级,价格不同)
// ============================================================
export const EXTRA_GEAR = {
  // ---- 服饰:帽子 ----
  bamboo_hat:  { id: 'bamboo_hat',  name: '竹笠',     category: 'outfit', level: 5,  price: 40,  icon: '🎋', desc: '生命 +3。雨里也能眯着眼赶路。', equipment: { slot: 'hat', stats: { maxHp: 3 } }, look: { hat: '#9aa86a', hatHi: '#bcc78c', style: 'straw' } },
  fur_hood:    { id: 'fur_hood',    name: '绒球冬帽', category: 'outfit', level: 18, price: 130, icon: '🧢', desc: '生命 +6,魔力 +1。顶上那颗绒球被风吹得直晃。', equipment: { slot: 'hat', stats: { maxHp: 6, maxMp: 1 } }, look: { hat: '#a8452f', hatHi: '#d4694f', style: 'cap' } },
  laurel_crown:{ id: 'laurel_crown',name: '桂冠',     category: 'outfit', level: 34, price: 300, icon: '🌿', desc: '魔力 +3,生命 +4。只有被承认的人配戴。', equipment: { slot: 'hat', stats: { maxMp: 3, maxHp: 4 } }, look: { hat: '#4f7a3a', hatHi: '#7fb05e', style: 'crown' } },
  // ---- 服饰:上衣 ----
  fisher_smock:{ id: 'fisher_smock',name: '渔家罩衫', category: 'outfit', level: 9,  price: 60,  icon: '👕', desc: '生命 +4,旅行行动力消耗 −1。沾着洗不掉的鱼腥味。', equipment: { slot: 'top', stats: { maxHp: 4, travelDiscount: 1 } }, look: { cloth: '#3f5a6b', cloth2: '#54798f', trim: '#cfd8dd' } },
  quilted_coat:{ id: 'quilted_coat',name: '夹棉短袄', category: 'outfit', level: 22, price: 180, icon: '🧥', desc: '生命 +12。里外三层棉,冬日赶路不抖。', equipment: { slot: 'top', stats: { maxHp: 12 } }, look: { cloth: '#6b3f3f', cloth2: '#8c5555', trim: '#e0c9a0' } },
  astral_robe: { id: 'astral_robe', name: '星纹法袍', category: 'outfit', level: 48, price: 520, icon: '🥼', desc: '魔力 +5,生命 +8。袖口绣着慢慢转动的星轨。', equipment: { slot: 'top', stats: { maxMp: 5, maxHp: 8 } }, look: { cloth: '#2f2f5e', cloth2: '#474780', trim: '#9b7fe8' } },
  // ---- 服饰:裤子 ----
  canvas_shorts:{ id: 'canvas_shorts',name: '帆布短裤', category: 'outfit', level: 12, price: 80,  icon: '👖', desc: '生命 +5,旅行行动力消耗 −1。', equipment: { slot: 'bottom', stats: { maxHp: 5, travelDiscount: 1 } }, look: { pants: '#7a6a4a' } },
  fur_trousers:{ id: 'fur_trousers', name: '兽皮长裤', category: 'outfit', level: 26, price: 210, icon: '👖', desc: '生命 +9,战力 +1。', equipment: { slot: 'bottom', stats: { maxHp: 9, atkPower: 1 } }, look: { pants: '#5a452f' } },
  // ---- 服饰:鞋子 ----
  straw_sandals:{ id: 'straw_sandals',name: '草鞋',    category: 'outfit', level: 3,  price: 20,  icon: '👡', desc: '生命 +2,旅行行动力消耗 −1。', equipment: { slot: 'shoes', stats: { maxHp: 2, travelDiscount: 1 } }, look: { boot: '#8a7a52' } },
  trail_boots: { id: 'trail_boots',  name: '远行靴',   category: 'outfit', level: 30, price: 240, icon: '🥾', desc: '生命 +7,旅行行动力消耗 −2。鞋底磨平了三次。', equipment: { slot: 'shoes', stats: { maxHp: 7, travelDiscount: 2 } }, look: { boot: '#4a3f2f' } },
  // ---- 武器(按等级补充) ----
  apprentice_blade: { id: 'apprentice_blade', name: '学徒短剑',   category: 'weapon', career: 'swordsman', level: 8,  price: 90,  icon: '🗡️', desc: '战力 +3。新手铁匠的第一件正经作品。', equipment: { slot: 'weapon', stats: { atkPower: 3 } } },
  runed_blade:      { id: 'runed_blade',      name: '铭文长剑',   category: 'weapon', career: 'swordsman', level: 45, price: 620, icon: '⚔️', desc: '战力 +11,生命 +8。剑身刻着一段没人读得懂的铭文。', equipment: { slot: 'weapon', stats: { atkPower: 11, maxHp: 8 } } },
  apprentice_wand:  { id: 'apprentice_wand',  name: '学徒魔杖',   category: 'weapon', career: 'mage', level: 8,  price: 95,  icon: '🪄', desc: '战力 +2,魔力 +3。', equipment: { slot: 'weapon', stats: { atkPower: 2, maxMp: 3 } } },
  runed_staff:      { id: 'runed_staff',      name: '铭文法杖',   category: 'weapon', career: 'mage', level: 45, price: 640, icon: '🔮', desc: '战力 +9,魔力 +9。', equipment: { slot: 'weapon', stats: { atkPower: 9, maxMp: 9 } } },
  drill_lance:      { id: 'drill_lance',      name: '操练长枪',   category: 'weapon', career: 'cavalier', level: 10, price: 100, icon: '🔱', desc: '战力 +3,生命 +5。', equipment: { slot: 'weapon', stats: { atkPower: 3, maxHp: 5 } } },
  storm_lance:      { id: 'storm_lance',      name: '风暴骑枪',   category: 'weapon', career: 'cavalier', level: 50, price: 700, icon: '⚡', desc: '战力 +11,生命 +14。', equipment: { slot: 'weapon', stats: { atkPower: 11, maxHp: 14 } } },
  wing_chakram:     { id: 'wing_chakram',     name: '翼环',       category: 'weapon', career: 'aviator', level: 10, price: 95,  icon: '🪃', desc: '战力 +3,行动力上限 +1。', equipment: { slot: 'weapon', stats: { atkPower: 3, apMax: 1 } } },
  gale_chakram:     { id: 'gale_chakram',     name: '烈风环刃',   category: 'weapon', career: 'aviator', level: 50, price: 690, icon: '🌪️', desc: '战力 +10,行动力上限 +2。', equipment: { slot: 'weapon', stats: { atkPower: 10, apMax: 2 } } },
  harbor_saber:     { id: 'harbor_saber',     name: '港卫弯刀',   category: 'weapon', career: 'mariner', level: 10, price: 98,  icon: '🗡️', desc: '战力 +3,生命 +4。', equipment: { slot: 'weapon', stats: { atkPower: 3, maxHp: 4 } } },
  deep_trident:     { id: 'deep_trident',     name: '深渊三叉',   category: 'weapon', career: 'mariner', level: 50, price: 710, icon: '🔱', desc: '战力 +10,生命 +10,魔力 +3。', equipment: { slot: 'weapon', stats: { atkPower: 10, maxHp: 10, maxMp: 3 } } },
  novice_psalter:   { id: 'novice_psalter',   name: '初修诗篇',   category: 'weapon', career: 'theologian', level: 8,  price: 92,  icon: '📖', desc: '战力 +2,魔力 +3。', equipment: { slot: 'weapon', stats: { atkPower: 2, maxMp: 3 } } },
  hymnal_scepter:   { id: 'hymnal_scepter',   name: '圣咏权杖',   category: 'weapon', career: 'theologian', level: 48, price: 660, icon: '✨', desc: '战力 +9,魔力 +10,生命 +6。', equipment: { slot: 'weapon', stats: { atkPower: 9, maxMp: 10, maxHp: 6 } } },
};
