/**
 * gems.js — 宝石与「精益师」镶嵌系统(纯数据)。
 *
 * 宝石(gem)提供四种性能:
 *   力量(gem_strength) → 战力(atkPower)
 *   魔力(gem_magic)    → 魔力上限(maxMp)
 *   勇敢(gem_brave)    → 每场战斗开始获得护甲(startBlock)
 *   生命(gem_life)     → 生命上限(maxHp)
 *
 * 宝石本身不能直接装备:必须交给各大主城的「精益师」,镶嵌进武器(占用武器宝石槽)。
 *   镶嵌后的武器在背包中独占一格,可随时由精益师取下宝石(取下会损耗,宝石降级为碎片)。
 *
 * 宝石来源:宝石商购买 / 战斗掉落 / 剧情奖励(自然获取难度较大,数量较少)。
 * 宝石可在市场自由买卖。
 */

/** 宝石性能说明(用于 UI) */
export const GEM_STAT_CN = {
  atkPower:   '力量',
  maxMp:      '魔力',
  startBlock: '勇敢',
  maxHp:      '生命',
  mpPerTurn:  '回魔',
};

/** 四种基础宝石 */
export const GEM_ITEMS = {
  gem_strength: { id: 'gem_strength', name: '力量宝石', category: 'gem', gem: 'strength', price: 240, icon: '🔴', tradeable: true, desc: '精琢的赤色宝石。镶嵌后:战力 +4。' },
  gem_magic:    { id: 'gem_magic',    name: '魔力宝石', category: 'gem', gem: 'magic',    price: 240, icon: '🔵', tradeable: true, desc: '精琢的青色宝石。镶嵌后:魔力上限 +3。' },
  gem_brave:    { id: 'gem_brave',    name: '勇敢宝石', category: 'gem', gem: 'brave',    price: 240, icon: '🟡', tradeable: true, desc: '精琢的琥珀宝石。镶嵌后:每场战斗开始获得 6 点护甲。' },
  gem_life:     { id: 'gem_life',     name: '生命宝石', category: 'gem', gem: 'life',     price: 240, icon: '🟢', tradeable: true, desc: '精琢的碧色宝石。镶嵌后:生命上限 +12。' },

  // ===== 神话宝石(极稀有套装):三颗各自独立 0.03% 概率现身神秘商店,仅此一处出售 =====
  gem_myth_guard:  { id: 'gem_myth_guard',  name: '神话宝石·守御', category: 'gem', gem: 'myth', myth: true, noTrade: true, price: 10000000000, icon: '💠', desc: '龙脊深处的传说结晶。单颗毫无灵光,须与「破军」「灵犀」同镶一件武器,方能觉醒套装之力。' },
  gem_myth_might:  { id: 'gem_myth_might',  name: '神话宝石·破军', category: 'gem', gem: 'myth', myth: true, noTrade: true, price: 10000000000, icon: '🔱', desc: '龙脊深处的传说结晶。单颗毫无灵光,须与「守御」「灵犀」同镶一件武器,方能觉醒套装之力。' },
  gem_myth_spirit: { id: 'gem_myth_spirit', name: '神话宝石·灵犀', category: 'gem', gem: 'myth', myth: true, noTrade: true, price: 10000000000, icon: '✨', desc: '龙脊深处的传说结晶。单颗毫无灵光,须与「守御」「破军」同镶一件武器,方能觉醒套装之力。' },
};

/** 宝石类型 -> 镶嵌所提供的装备属性 */
export const GEM_EFFECT = {
  strength: { atkPower: 4 },
  magic:    { maxMp: 3 },
  brave:    { startBlock: 6 },
  life:     { maxHp: 12 },
};

/** 神话宝石三颗(顺序即套装所需) */
export const MYTH_GEM_IDS = ['gem_myth_guard', 'gem_myth_might', 'gem_myth_spirit'];

/**
 * 神话套装:三颗神话宝石同镶于「同一件武器」时生效。
 * 缺任意一颗都无任何效果。
 */
export const GEM_SET = {
  ids: MYTH_GEM_IDS,
  bonus: { startBlock: 120, atkPower: 120, mpPerTurn: 30, maxHp: 300 },
};

/** 套装说明(UI) */
export const GEM_SET_DESC = '集齐三颗同镶一件武器:护甲 +120 · 战力 +120 · 每回合回魔 +30 · 生命上限 +300';

/**
 * 若 gems 中集齐全部神话宝石,返回套装加成;否则返回空对象。
 * 只要缺一颗(或缺两颗),即视为无任何效果。
 */
export function gemSetBonus(gems) {
  if (!Array.isArray(gems) || !gems.length) return {};
  const have = new Set(gems);
  if (!GEM_SET.ids.every((id) => have.has(id))) return {};
  return { ...GEM_SET.bonus };
}

/** 宝石按性能的中文标签(前缀,如「力量宝石」) */
export function gemLabel(gemId) {
  const it = GEM_ITEMS[gemId];
  return it ? it.name : gemId;
}

/** 珠宝商 / 精益师名称池 */
export const JEWELER_NAMES = [
  '玲珑阁', '点石坊', '流光斋', '嵌玉轩', '叠翠楼', '宝华堂', '珠玑号', '明鉴斋',
];

/** 宝石商名称池 */
export const GEMSHOP_NAMES = [
  '琳琅宝石行', '宝光阁', '彩石斋', '明珠号', '璞玉坊', '璀璨轩', '莹石堂', '曜石行',
];

/** 镶嵌手续费(金币,按槽位与宝石价值决定) */
export const SOCKET_GOLD_PER_GEM = 60;

/** 取下宝石的损耗:有几率把宝石打成碎片 */
export const UNSOCKET_SHARD_CHANCE = 0.6;

/** 宝石掉落池(战斗 / 剧情;权重越低越稀有) */
export const GEM_DROPS = [
  { id: 'gem_life',     w: 10 },
  { id: 'gem_strength', w: 10 },
  { id: 'gem_magic',    w: 10 },
  { id: 'gem_brave',    w: 8 },
];

/** 按权重随机取一种宝石;flip 返回 0~1 */
export function rollGem(flip) {
  const total = GEM_DROPS.reduce((s, g) => s + g.w, 0);
  let r = flip() * total;
  for (const g of GEM_DROPS) {
    r -= g.w;
    if (r <= 0) return g.id;
  }
  return GEM_DROPS[0].id;
}
