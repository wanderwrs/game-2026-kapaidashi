/**
 * world.js — 世界地图布局,以及里程 / 真实耗时 / 穿梭费用 / 行动力消耗的换算。
 *
 * 两级地图(世界地图 → 地区地图):
 *   · 世界地图:15 个「地区」(每个地区 = 一个章节)分布在世界坐标上,可在地区之间旅行
 *   · 地区地图:每个地区内 3 个「地点」(见 regions.js),在地区内短途移动
 *
 * 距离单位统一为「里」。
 *   · 地区内相邻两地点 = STOP_SPACING 里
 *   · 地区之间 = 保底 BASE_DISTANCE 里 + 世界坐标直线距离 × DISTANCE_SCALE
 *
 * 真实耗时 = 里程 ÷ 步行速度 × 载具倍率,并夹在 [MIN_TRIP_SECONDS, MAX_TRIP_SECONDS]。
 * 步行速度 0.35 里/秒 ⇒ 25 里约 1.2 分钟,109 里约 5 分钟(封顶)。
 */

/** 步行速度(里 / 秒)。数值越大,旅途越快 */
export const WALK_SPEED = 0.35;
/** 单段旅途最短 / 最长的真实耗时(秒) */
export const MIN_TRIP_SECONDS = 20;
export const MAX_TRIP_SECONDS = 300;
/** 同一地区内相邻两地点之间的里程 */
export const STOP_SPACING = 25;
/** 地区之间的保底里程(即便坐标很近,如王城与王城广场) */
export const BASE_DISTANCE = 40;
/** 世界坐标(0~100)换算为「里」的比例 */
export const DISTANCE_SCALE = 0.75;

/**
 * 地形:载具只能在允许的地形上通行(徒步不受限)。
 *   land 陆地 / plateau 高原 / sea 海面·港口 / sky 浮空
 */
export const TERRAIN_CN = { land: '陆地', plateau: '高原', sea: '海面·港口', sky: '浮空' };

/**
 * 世界地图布局。
 *   x / y  为 0~100 的百分比坐标(左上为原点)
 *   city   是否「主城」——主城之间可花金币「穿梭」(瞬达)
 *   level  该地区的怪物等级(= 章节序号),用于途中随机遭遇的难度
 *   terrain 该地区的地形,决定哪些载具可以抵达(见 items.js 载具的 terrain)
 */
export const WORLD = {
  ch01: { x: 16, y: 34, level: 1, city: false, terrain: 'land' },
  ch02: { x: 26, y: 24, level: 2, city: false, terrain: 'land' },
  ch02b: { x: 36, y: 18, level: 3, city: false, terrain: 'land' },
  ch03: { x: 44, y: 34, level: 3, city: true, terrain: 'land' },
  ch04: { x: 28, y: 66, level: 4, city: true, terrain: 'sea' },
  ch05: { x: 56, y: 16, level: 5, city: false, terrain: 'plateau' },
  ch06: { x: 48, y: 50, level: 6, city: false, terrain: 'land' },
  ch07: { x: 62, y: 42, level: 7, city: false, terrain: 'land' },
  ch08: { x: 74, y: 30, level: 8, city: false, terrain: 'plateau' },
  ch09: { x: 86, y: 14, level: 9, city: true, terrain: 'sky' },
  ch10: { x: 18, y: 84, level: 10, city: true, terrain: 'sea' },
  ch11: { x: 58, y: 64, level: 11, city: true, terrain: 'land' },
  ch12: { x: 68, y: 72, level: 12, city: false, terrain: 'land' },
  ch13: { x: 76, y: 58, level: 13, city: false, terrain: 'land' },
  ch14: { x: 54, y: 10, level: 14, city: false, terrain: 'plateau' },
  ch15: { x: 46, y: 37, level: 15, city: true, terrain: 'land' },
};

/** 某地区的地形 */
export function regionTerrain(id) {
  return WORLD[id]?.terrain || 'land';
}

/** 主城顺序(穿梭只发生在主城之间) */
export const CITY_ORDER = Object.keys(WORLD).filter((id) => WORLD[id].city);

/** 世界坐标直线距离(0~100 单位) */
function euclid(a, b) {
  const wa = WORLD[a];
  const wb = WORLD[b];
  if (!wa || !wb) return 0;
  return Math.hypot(wa.x - wb.x, wa.y - wb.y);
}

/** 两个地区之间的里程(里) */
export function regionDistance(a, b) {
  if (a === b) return 0;
  return Math.round(BASE_DISTANCE + euclid(a, b) * DISTANCE_SCALE);
}

/** 同一地区内两个地点之间的里程(里) */
export function stopDistance(i, j) {
  return Math.abs(i - j) * STOP_SPACING;
}

/**
 * 由里程换算真实耗时(秒)。
 * @param {number} dist  里程(里)
 * @param {number} speedMul 载具倍率(<1 更快,1 = 步行)
 */
export function tripSeconds(dist, speedMul = 1) {
  const raw = (dist / WALK_SPEED) * speedMul;
  return Math.max(MIN_TRIP_SECONDS, Math.min(MAX_TRIP_SECONDS, Math.round(raw)));
}

/**
 * 旅行消耗的行动力。
 * @param {number} dist 里程(里)
 * @param {number} discount 载具的行动力折扣(每段至少 1)
 */
export function travelApCost(dist, discount = 0) {
  if (dist <= 0) return 0;
  return Math.max(1, Math.round(dist / 30) * 2 - discount);
}

/** 主城之间「穿梭」所需金币(随里程递增) */
export function shuttleGold(dist) {
  return 10 + Math.round(dist * 1.2);
}

/** 世界地图上显示的怪物等级描述 */
export function levelLabel(level) {
  if (level <= 3) return '低危';
  if (level <= 6) return '中危';
  if (level <= 10) return '高危';
  if (level <= 13) return '险境';
  return '绝境';
}
