/**
 * pois.js — 通关第一大章后在世界地图上随机出现的兴趣点(POI)。
 *
 * 三类 POI:
 *   restaurant 餐厅 —— 恢复行动力 + 购买食品
 *   hotel      酒店 —— 休息(多房型,恢复效果与耗时不同)+ 换装(仅限酒店)
 *   market     商市 —— 武器商 / 防具商 / 药商
 *
 * POI 在世界坐标(x:0~100, y:0~100)上随机分布,数量为 POI_COUNT。
 * 每个 POI 有自己的命名(随机取自名称池)与主题色。
 */

/** POI 总数 */
export const POI_COUNT = 10;

/** POI 类型中文名 */
export const POI_TYPE_CN = {
  restaurant: '餐厅',
  hotel: '酒店',
  market: '商市',
};

/** POI 图标 */
export const POI_ICON = {
  restaurant: '🍲',
  hotel: '🏨',
  market: '🏪',
};

// ============================================================
// 铁匠铺 / 宝石商 / 精益师:主城全有,其他地区为随机流动摊位
// ============================================================

/**
 * 三类摊位:
 *   铁匠(blacksmith) —— 用材料 + 金币 + 图纸锻造特殊武器
 *   宝石商(gemshop)  —— 售卖宝石
 *   精益师(jeweler)  —— 把宝石镶嵌进武器
 */
export const STALL_CN = {
  blacksmith: '铁匠铺',
  gemshop: '宝石商',
  jeweler: '精益师',
  shop: '商店',
  market: '市场',
};

export const STALL_ICON = {
  blacksmith: '🔨',
  gemshop: '💎',
  jeweler: '🔧',
};

/** 三类摊位类型 */
export const STALL_TYPES = ['blacksmith', 'gemshop', 'jeweler'];

/**
 * 非主城地区每类摊位的出现概率:
 *   每个非主城地区对每一类摊位各自独立掷 10%,不设固定摊位。
 */
export const STALL_SPAWN_CHANCE = 0.1;

/**
 * 随机流动摊位:每个非主城地区对每类摊位独立掷点,每次世界地图刷新时重抽。
 * @param {() => number} rng 返回 0~1
 * @param {string[]} allRegions 全部地区 id
 * @param {string[]} cityRegions 主城地区 id(主城恒有,不参与掷点)
 * @returns {{blacksmith:string[],gemshop:string[],jeweler:string[]}}
 */
export function rollRoamingStalls(rng, allRegions, cityRegions) {
  const out = { blacksmith: [], gemshop: [], jeweler: [] };
  const cities = new Set(cityRegions || []);
  for (const id of allRegions || []) {
    if (cities.has(id)) continue;
    for (const type of STALL_TYPES) {
      if (rng() < STALL_SPAWN_CHANCE) out[type].push(id);
    }
  }
  return out;
}

/** 汇总某地区拥有的摊位类型(主城全有 + 随机流动位) */
export function stallsAtRegion(regionId, isCity, roaming) {
  return STALL_TYPES.filter((type) => isCity || (roaming?.[type] || []).includes(regionId));
}


/** 餐厅名称池 */
const RESTAURANT_NAMES = [
  '老酒栈', '醉仙楼', '风来酒馆', '旅人食肆', '野炊铺',
  '铁锅饭庄', '河畔小馆', '落日酒家', '烟火食堂', '粗茶淡饭',
];

/** 酒店名称池 */
const HOTEL_NAMES = [
  '安心客栈', '青云酒楼', '归雁旅馆', '夜泊客栈', '温馨驿站',
  '金穗酒店', '月下客栈', '避风港旅馆', '锦程大酒店', '梦乡客栈',
];

/** 商市名称池 */
const MARKET_NAMES = [
  '兴隆集市', '万通商市', '四海货栈', '聚财宝市', '金鳞商街',
  '百家集市', '万货云集', '通衢大市', '琳琅商市', '珍宝集市',
];

/** 餐厅提供的食品(可购买) */
export const RESTAURANT_FOOD = ['bread', 'dried_meat', 'honey_cake'];

/**
 * 酒店房型:
 *   name      房型名
 *   apRecover 恢复行动力
 *   seconds   真实耗时(秒)
 *   gold      费用
 *   heal      额外恢复血量比例(0~1)
 */
export const HOTEL_ROOMS = [
  { id: 'economy', name: '普通通铺', apRecover: 6, seconds: 30, gold: 10, heal: 0 },
  { id: 'standard', name: '标准客房', apRecover: 10, seconds: 60, gold: 30, heal: 0.2 },
  { id: 'deluxe', name: '豪华套房', apRecover: 15, seconds: 120, gold: 80, heal: 0.5 },
  { id: 'royal', name: '皇家别院', apRecover: 25, seconds: 240, gold: 200, heal: 1 },
];

/**
 * 商市商人类型:
 *   weapon    武器商(按职业出售多种武器)
 *   armor     防具商(出售防具,与服装独立)
 *   medicine  药商(出售药品)
 */
export const MARKET_MERCHANTS = [
  { id: 'weapon', name: '武器商', icon: '⚔️', desc: '按职业出售各式武器' },
  { id: 'armor', name: '防具商', icon: '🛡️', desc: '出售护甲与护具(独立于服装)' },
  { id: 'medicine', name: '药商', icon: '🧪', desc: '出售各类药品与解毒剂' },
];

/** 从名称池中随机取一个名字 */
function pickName(rng, pool) {
  return pool[Math.floor(rng.next() * pool.length)];
}

/**
 * 生成 POI 列表。
 * @param {() => number} rng  返回 0~1 的随机函数
 * @returns {Array<{id, type, name, icon, x, y}>}
 */
export function generatePois(rng) {
  const pois = [];
  const types = ['restaurant', 'hotel', 'market'];
  // 保证每类至少 2 个,剩余随机分配
  const typeAssign = [];
  for (const t of types) {
    typeAssign.push(t, t);
  }
  while (typeAssign.length < POI_COUNT) {
    typeAssign.push(types[Math.floor(rng.next() * types.length)]);
  }
  // 打乱类型分配
  for (let i = typeAssign.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [typeAssign[i], typeAssign[j]] = [typeAssign[j], typeAssign[i]];
  }

  const usedPositions = [];
  for (let i = 0; i < POI_COUNT; i++) {
    const type = typeAssign[i];
    let name;
    if (type === 'restaurant') name = pickName(rng, RESTAURANT_NAMES);
    else if (type === 'hotel') name = pickName(rng, HOTEL_NAMES);
    else name = pickName(rng, MARKET_NAMES);

    // 在世界地图上随机分布,避免与已有 POI / 主城过近
    let x, y, tries = 0;
    do {
      x = 5 + Math.floor(rng.next() * 90);
      y = 5 + Math.floor(rng.next() * 90);
      tries++;
    } while (tries < 30 && usedPositions.some((p) => Math.hypot(p.x - x, p.y - y) < 12));
    usedPositions.push({ x, y });

    pois.push({
      id: `poi_${i + 1}`,
      type,
      name,
      icon: POI_ICON[type],
      x,
      y,
    });
  }
  return pois;
}
