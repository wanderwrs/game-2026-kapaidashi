/**
 * forge.js — 铁匠与锻造系统(纯数据,不依赖 items.js 以避免循环引用)。
 *
 * 玩法:
 *   1. 玩家在旅途中收集「锻造材料」(剧情奖励 / 打怪掉落 / NPC 赠送)。
 *   2. 从剧情或 NPC 处获得「图纸」,使用后解锁对应配方。
 *   3. 在铁匠铺消耗 材料 + 金币(需已解锁图纸),锻造出带特殊性能的武器。
 *
 * 锻造武器 forged:true / noTrade:true —— 不进入商店与市场,无法买卖、无法被交易。
 * sockets:该武器可镶嵌的宝石槽数(见 gems.js / 精益师)。
 */

/** 材料中文类别(并入 items.js 的 ITEM_CATEGORY_CN) */
export const MATERIAL_CATEGORY_CN = { material: '材料', blueprint: '图纸', gem: '宝石' };

/** 锻造材料 */
export const MATERIAL_ITEMS = {
  mat_iron:    { id: 'mat_iron',    name: '铁矿石',   category: 'material', price: 14,  icon: '⛏️', desc: '锻造武器的基础材料,矿镇与山道常见。' },
  mat_wood:    { id: 'mat_wood',    name: '硬木',     category: 'material', price: 12,  icon: '🪵', desc: '烧成上好的炭火,也是枪杆与法杖的材料。' },
  mat_leather: { id: 'mat_leather', name: '兽皮',     category: 'material', price: 16,  icon: '🟫', desc: '鞣制后可用于护手与握柄。' },
  mat_crystal: { id: 'mat_crystal', name: '魔晶',     category: 'material', price: 48,  icon: '🔷', desc: '蕴含微弱魔力的晶体,锻造法杖与秘银所需。' },
  mat_scale:   { id: 'mat_scale',   name: '龙鳞',     category: 'material', price: 130, icon: '🐉', desc: '极难获得的龙鳞,只在高阶战斗后偶尔掉落。', rare: true },
  mat_meteor:  { id: 'mat_meteor',  name: '陨铁',     category: 'material', price: 220, icon: '☄️', desc: '自天外坠落的金属,坚韧异常,可铸传世之器。', rare: true },
  mat_shard:   { id: 'mat_shard',   name: '宝石碎片', category: 'material', price: 70,  icon: '💠', desc: '宝石打磨的碎屑,可用于强化镶嵌。' },
};

/** 锻造图纸(消耗品:使用后解锁对应配方) */
export const BLUEPRINT_ITEMS = {
  bp_frost: { id: 'bp_frost', name: '图纸·霜锋',   category: 'blueprint', career: 'swordsman',  price: 0, icon: '📜', desc: '记载霜锋剑锻造法的残页。使用后解锁配方。' },
  bp_star:  { id: 'bp_star',  name: '图纸·星辉',   category: 'blueprint', career: 'mage',       price: 0, icon: '📜', desc: '记载星辉法杖锻造法的残页。使用后解锁配方。' },
  bp_lance: { id: 'bp_lance', name: '图纸·破军',   category: 'blueprint', career: 'cavalier',   price: 0, icon: '📜', desc: '记载破军长枪锻造法的残页。使用后解锁配方。' },
  bp_gale:  { id: 'bp_gale',  name: '图纸·追风',   category: 'blueprint', career: 'aviator',    price: 0, icon: '📜', desc: '记载追风双刃锻造法的残页。使用后解锁配方。' },
  bp_tide:  { id: 'bp_tide',  name: '图纸·潮汐',   category: 'blueprint', career: 'mariner',    price: 0, icon: '📜', desc: '记载潮汐三叉锻造法的残页。使用后解锁配方。' },
  bp_halo:  { id: 'bp_halo',  name: '图纸·圣辉',   category: 'blueprint', career: 'theologian', price: 0, icon: '📜', desc: '记载圣辉权杖锻造法的残页。使用后解锁配方。' },
};

/**
 * 锻造武器(全部带特殊性能,且无法通过商店 / 市场买卖)
 * sockets:可镶嵌宝石的槽位数量
 */
export const FORGED_ITEMS = {
  forged_frost: {
    id: 'forged_frost', name: '霜锋剑', category: 'weapon', career: 'swordsman', forged: true, noTrade: true, sockets: 5, price: 0, icon: '❄️',
    desc: '【锻造·特殊】寒霜凝于剑脊,挥动时带起白雾。战力 +9,生命 +6;镶嵌后更强。',
    equipment: { slot: 'weapon', stats: { atkPower: 9, maxHp: 6 } },
  },
  forged_star: {
    id: 'forged_star', name: '星辉法杖', category: 'weapon', career: 'mage', forged: true, noTrade: true, sockets: 5, price: 0, icon: '🌟',
    desc: '【锻造·特殊】杖顶嵌着一粒星砂,夜里有微光。战力 +6,魔力 +6。',
    equipment: { slot: 'weapon', stats: { atkPower: 6, maxMp: 6 } },
  },
  forged_lance: {
    id: 'forged_lance', name: '破军长枪', category: 'weapon', career: 'cavalier', forged: true, noTrade: true, sockets: 5, price: 0, icon: '🔱',
    desc: '【锻造·特殊】枪尖淬过陨铁,冲阵时势不可挡。战力 +8,生命 +12。',
    equipment: { slot: 'weapon', stats: { atkPower: 8, maxHp: 12 } },
  },
  forged_gale: {
    id: 'forged_gale', name: '追风双刃', category: 'weapon', career: 'aviator', forged: true, noTrade: true, sockets: 5, price: 0, icon: '🌪️',
    desc: '【锻造·特殊】刃轻如羽,出鞘带风。战力 +7,行动力上限 +2。',
    equipment: { slot: 'weapon', stats: { atkPower: 7, apMax: 2 } },
  },
  forged_tide: {
    id: 'forged_tide', name: '潮汐三叉', category: 'weapon', career: 'mariner', forged: true, noTrade: true, sockets: 5, price: 0, icon: '🌊',
    desc: '【锻造·特殊】叉身凝着不散的潮气。战力 +8,生命 +8,魔力 +2。',
    equipment: { slot: 'weapon', stats: { atkPower: 8, maxHp: 8, maxMp: 2 } },
  },
  forged_halo: {
    id: 'forged_halo', name: '圣辉权杖', category: 'weapon', career: 'theologian', forged: true, noTrade: true, sockets: 5, price: 0, icon: '✨',
    desc: '【锻造·特殊】杖身刻满古老经文,握之安心。战力 +6,魔力 +7,生命 +6。',
    equipment: { slot: 'weapon', stats: { atkPower: 6, maxMp: 7, maxHp: 6 } },
  },
};

/**
 * 锻造配方
 *   blueprint  所需图纸(须已解锁)
 *   materials  所需材料 { itemId: qty }
 *   gold       所需金币
 *   result     产物(锻造武器 id)
 */
export const FORGE_RECIPES = [
  { id: 'r_frost', blueprint: 'bp_frost', result: 'forged_frost', gold: 160, materials: { mat_iron: 3, mat_crystal: 2, mat_leather: 1 } },
  { id: 'r_star',  blueprint: 'bp_star',  result: 'forged_star',  gold: 160, materials: { mat_wood: 3, mat_crystal: 3 } },
  { id: 'r_lance', blueprint: 'bp_lance', result: 'forged_lance', gold: 200, materials: { mat_iron: 4, mat_meteor: 1, mat_leather: 2 } },
  { id: 'r_gale',  blueprint: 'bp_gale',  result: 'forged_gale',  gold: 180, materials: { mat_iron: 2, mat_leather: 3, mat_wood: 1 } },
  { id: 'r_tide',  blueprint: 'bp_tide',  result: 'forged_tide',  gold: 200, materials: { mat_iron: 3, mat_scale: 1, mat_crystal: 2 } },
  { id: 'r_halo',  blueprint: 'bp_halo',  result: 'forged_halo',  gold: 220, materials: { mat_wood: 2, mat_crystal: 4, mat_scale: 1 } },
];

/** 快速查表:配方 by 产物 id */
export const RECIPE_BY_RESULT = Object.fromEntries(FORGE_RECIPES.map((r) => [r.result, r]));

/** 快速查表:图纸 id -> 配方 */
export const RECIPE_BY_BLUEPRINT = Object.fromEntries(FORGE_RECIPES.map((r) => [r.blueprint, r]));

/**
 * 铁匠铺的锻造材料收购(铁匠也会收购玩家的多余材料,按材料价 60% 收)
 */
export const MATERIAL_SELL_RATE = 0.6;

/** 打怪 / 剧情掉落材料池(越稀有概率越低) */
export const MATERIAL_DROPS = [
  { id: 'mat_iron',    w: 34 },
  { id: 'mat_wood',    w: 30 },
  { id: 'mat_leather', w: 24 },
  { id: 'mat_crystal', w: 10 },
  { id: 'mat_shard',   w: 6 },
  { id: 'mat_scale',   w: 2 },
  { id: 'mat_meteor',  w: 1 },
];

/** 按权重随机取一种掉落材料 */
export function rollMaterial(flip) {
  const total = MATERIAL_DROPS.reduce((s, m) => s + m.w, 0);
  let r = flip() * total;
  for (const m of MATERIAL_DROPS) {
    r -= m.w;
    if (r <= 0) return m.id;
  }
  return MATERIAL_DROPS[0].id;
}
