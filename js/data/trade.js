/**
 * trade.js — 交易与定价规则(纯数据 / 纯函数)。
 *
 * 手续费:
 *   商店(shop)      :固定 3%
 *   市场(market)    :固定 12%
 *   主城(city)      :17% ~ 40% 浮动
 *   特殊交易币(token):7% ~ 70% 浮动
 *   主城节日         :主城手续费全免
 *
 * 价格浮动:货物价格每 5 小时(PRICE_TICK_MS)浮动一次,倍率 PRICE_MIN~PRICE_MAX。
 *
 * 节日:每 7 个自然日随机出现 1 小时的主城节日;累计节日时长上限 30 小时(FESTIVAL.bankHours)。
 *
 * 玩家货架:市场里可租货架挂售自己的物品。
 *   起始 5 个,最多 30 个;每开一个货架的费用 = 上一货架费用 × 1.3。
 *   挂售价须 ≤ 当前市场均价 × (45% ± 浮动);明显低于该线会被买家立即买走(秒卖)。
 */

/** 手续费配置 */
export const FEES = {
  shop: 0.03,
  market: 0.12,
  cityMin: 0.17,
  cityMax: 0.40,
  tokenMin: 0.07,
  tokenMax: 0.70,
};

/** 节日配置 */
export const FESTIVAL = {
  periodDays: 7,      // 每 7 个自然日
  windowHours: 1,     // 出现 1 小时
  bankHours: 30,      // 累计免费时长上限(小时)
};

/** 价格浮动:每 5 小时刷新一次 */
export const PRICE_TICK_MS = 5 * 60 * 60 * 1000;
export const PRICE_MIN = 0.70;
export const PRICE_MAX = 1.40;

/** 玩家货架配置 */
export const SHELF = {
  start: 5,           // 初始货架数
  step: 5,            // 每次扩展的货架数
  max: 30,            // 最多货架数
  baseCost: 120,      // 第一个扩容包的费用
  costMul: 1.3,       // 每进一步,费用 ×1.3
};

/** 卖出判定:挂售价 ≤ 市场均价 × (SELL_FLOOR ± float) 即被买走 */
export const SELL_FLOOR = 0.45;
export const SELL_FLOOR_FLOAT = 0.08;

/** 稳定字符串哈希(用于把 (seed, tick, itemId) 映射为 0~1 的确定值) */
export function hash01(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0) / 4294967296;
}

/** 当前价格轮次(每 PRICE_TICK_MS 一次) */
export function priceTick(now = Date.now()) {
  return Math.floor(now / PRICE_TICK_MS);
}

/**
 * 某物品在当前轮次的价格倍率(PRICE_MIN ~ PRICE_MAX)。
 * @param {string} itemId
 * @param {number} seed  本局种子
 * @param {number} tick  价格轮次
 */
export function priceMul(itemId, seed, tick) {
  const a = hash01(`${seed}:${tick}:${itemId}:a`);
  const b = hash01(`${seed}:${tick}:${itemId}:b`);
  // 用两次哈希平滑成 0~1,再映射到 [PRICE_MIN, PRICE_MAX]
  const mix = (a * 0.6 + b * 0.4);
  return PRICE_MIN + mix * (PRICE_MAX - PRICE_MIN);
}

/**
 * 下一次价格刷新剩余的毫秒数
 */
export function msToNextTick(now = Date.now()) {
  return PRICE_TICK_MS - (now % PRICE_TICK_MS);
}

/**
 * 节日判定:每 FESTIVAL.periodDays 天随机 1 小时。
 * 以 seed 与「周期序号」确定该周期内节日的起始偏移(0~ (period-window))。
 * @returns {{active:boolean, until:number, remainMs:number}} 当前是否处于节日
 */
export function festivalState(seed, now = Date.now()) {
  const periodMs = FESTIVAL.periodDays * 24 * 60 * 60 * 1000;
  const windowMs = FESTIVAL.windowHours * 60 * 60 * 1000;
  const idx = Math.floor(now / periodMs);
  const offset = hash01(`${seed}:festival:${idx}`) * (periodMs - windowMs);
  const start = idx * periodMs + offset;
  const end = start + windowMs;
  const active = now >= start && now < end;
  return { active, until: end, remainMs: Math.max(0, end - now) };
}

/** 主城手续费(非节日,17%~40% 浮动,每 5 小时随价格轮次变化) */
export function cityFee(seed, tick) {
  const m = hash01(`${seed}:${tick}:cityfee`);
  return FEES.cityMin + m * (FEES.cityMax - FEES.cityMin);
}

/** 特殊交易币手续费(7%~70%,沿用原有专属场所的每场所随机 fee 时,这里给出兜底浮动) */
export function tokenFee(seed, tick) {
  const m = hash01(`${seed}:${tick}:tokenfee`);
  return FEES.tokenMin + m * (FEES.tokenMax - FEES.tokenMin);
}

/** 货架扩容费用:第 index 个扩容包(从 0 开始)的费用 */
export function shelfUpgradeCost(index) {
  return Math.round(SHELF.baseCost * Math.pow(SHELF.costMul, index));
}

export function pct(x) {
  return `${Math.round(x * 100)}%`;
}
