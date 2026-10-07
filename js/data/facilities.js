/**
 * facilities.js — 主城设施(地点卡)的数据与规则(纯数据 / 纯函数)。
 *
 * 11 座主城各追加 6 个设施地点:
 *   酒店(旅店) / 酒馆 / 神秘商店 / 银行 / 交易所 / 仓库
 *
 * 时间模型:与交易系统一致,沿用「真实时间派生」。汇率 / 利率 / 行情每
 * EXCHANGE_TICK_MS(1 小时)轮换一次,以 (seed, tick) 稳定哈希得出,不落存档。
 *
 * 存款利息在「到期时刻」结算(真实时间),未到期取回只退本金。
 */

import { ITEMS, SHOP_STOCK } from './items.js?v=20261007m';
import { hash01 } from './trade.js?v=20261007m';

/** 金融轮次(汇率 / 利率 / 行情):每 1 小时一轮 */
export const EXCHANGE_TICK_MS = 60 * 60 * 1000;

export function exchangeTick(now = Date.now()) {
  return Math.floor(now / EXCHANGE_TICK_MS);
}

export function msToNextExchange(now = Date.now()) {
  return EXCHANGE_TICK_MS - (now % EXCHANGE_TICK_MS);
}

// ===== 主城设施地点卡(注入到每个主城地区的 stops 末尾) =====
export const CITY_FACILITY_STOPS = [
  { key: 'fac_hotel', name: '旅店', theme: 'city', facility: 'hotel', hint: '旅店可休息回血、换装、回看剧情,还可托服务生寄存与跑腿。', services: { hotel: true } },
  { key: 'fac_tavern', name: '酒馆', theme: 'city', facility: 'tavern', hint: '酒馆里可购物、打工,也能下角斗场一搏。', services: { tavern: true } },
  { key: 'fac_mystery', name: '神秘商店', theme: 'city', facility: 'mystery', hint: '神秘商店只摆高价限定珍品,行情轮换,过时不候。', services: { mystery: true } },
  { key: 'fac_bank', name: '银行', theme: 'city', facility: 'bank', hint: '银行可定期存款生息,也能按浮动汇率兑换特殊交易币。', services: { bank: true } },
  { key: 'fac_exchange', name: '交易所', theme: 'city', facility: 'exchange', hint: '交易所的标的随行情涨跌,低买高卖。', services: { exchange: true } },
  { key: 'fac_warehouse', name: '仓库', theme: 'city', facility: 'warehouse', hint: '仓库可寄存多余物品,按价值收取管理费。', services: { warehouse: true } },
];

/** 设施中文名(面板标题 / 地图按钮) */
export const FACILITY_CN = {
  hotel: '酒店', tavern: '酒馆', mystery: '神秘商店', bank: '银行', exchange: '交易所', warehouse: '仓库',
};
/** 设施类型键(地图按钮 / 服务标签的顺序) */
export const FACILITY_KEYS = ['hotel', 'tavern', 'mystery', 'bank', 'exchange', 'warehouse'];
export const FACILITY_ICON = {
  hotel: '🏨', tavern: '🍺', mystery: '🌌', bank: '🏦', exchange: '📈', warehouse: '📦',
};

// ===== 银行:定期存款 =====
/** 存款期限(真实时间)与基准利率(到期一次性计息) */
export const BANK_TERMS = [
  { id: 't1h', name: '1 小时', hours: 1, rate: 0.006 },
  { id: 't6h', name: '6 小时', hours: 6, rate: 0.04 },
  { id: 't24h', name: '24 小时', hours: 24, rate: 0.14 },
  { id: 't72h', name: '72 小时', hours: 72, rate: 0.40 },
];

/** 某期限当前利率(基准 ±20%,每小时轮换) */
export function bankRate(termId, seed, tick) {
  const t = BANK_TERMS.find((x) => x.id === termId);
  if (!t) return 0;
  const m = hash01(`${seed}:bank:${termId}:${tick}`);
  return t.rate * (0.8 + m * 0.4);
}

// ===== 银行:兑换特殊交易币 =====
/** 全部特殊交易币 id(与 items.js 的 token_* 对应) */
export const TOKEN_LIST = [
  'token_village', 'token_forest', 'token_mountain', 'token_city', 'token_port',
  'token_sky', 'token_ruins', 'token_cliff', 'token_camp',
];
/** 兑换手续费 */
export const TOKEN_EX_FEE = 0.04;
/** 单个交易币的金币价(基准 280,±18%,每小时轮换) */
export function tokenRate(tokenId, seed, tick) {
  const m = hash01(`${seed}:token:${tokenId}:${tick}`);
  return Math.round(280 * (0.82 + m * 0.36));
}

// ===== 交易所:投资项目 =====
export const INVEST_PROJECTS = [
  { id: 'caravan', name: '北境商队', desc: '往返龙骨荒原的商队份额,战事一起便大涨大落。' },
  { id: 'mining', name: '黑曜矿脉', desc: '黑曜矿城的采矿份额,产量稳定但受行情牵动。' },
  { id: 'shipping', name: '浮岛航运', desc: '云端浮岛的航运股份,天空之城通航后炙手可热。' },
  { id: 'weaving', name: '王城织造', desc: '王城丝织作坊的份额,主城节日期间最是紧俏。' },
];

/** 某标的当前单价(每份):以 seed 定基准,逐轮波动 */
export function investPrice(projectId, seed, tick) {
  const base = 60 + Math.round(hash01(`${seed}:inv:${projectId}:base`) * 440);
  const a = hash01(`${seed}:inv:${projectId}:${tick}:a`);
  const b = hash01(`${seed}:inv:${projectId}:${tick}:b`);
  const mix = a * 0.65 + b * 0.35;
  return Math.max(15, Math.round(base * (0.55 + mix * 1.15)));
}

/** 上一轮单价(用于涨跌箭头) */
export function investPrevPrice(projectId, seed, tick) {
  return investPrice(projectId, seed, Math.max(0, tick - 1));
}

// ===== 仓库:寄存管理费 =====
export const WAREHOUSE = {
  feeRate: 0.05,   // 按物品基准价 × 数量收取管理费
  minFee: 1,       // 单次最低管理费
};

/** 仓库管理费(存入 / 取出各计一次) */
export function warehouseFee(itemId, qty = 1) {
  const base = ITEMS[itemId]?.price || 0;
  return Math.max(WAREHOUSE.minFee, Math.round(base * Math.max(1, qty) * WAREHOUSE.feeRate));
}

// ===== 神秘商店:高价限定珍品 =====
const MYSTERY_POOL = [
  'phoenix_blood', 'lucky_coin', 'sage_stone', 'void_mantle', 'prophet_circlet',
  'titan_greaves', 'gale_boots', 'starfall_blade', 'dragon_scale_mail', 'airship',
];
/** 本轮上架的 4 件珍品(每轮换一次) */
export function mysteryStock(seed, tick, count = 4) {
  const pool = MYSTERY_POOL.filter((id) => ITEMS[id]);
  const picked = [];
  const used = new Set();
  for (let i = 0; i < count && i < pool.length; i++) {
    let idx = Math.floor(hash01(`${seed}:mystery:${tick}:${i}`) * pool.length) % pool.length;
    let guard = 0;
    while (used.has(idx) && guard++ < pool.length) idx = (idx + 1) % pool.length;
    used.add(idx);
    picked.push(pool[idx]);
  }
  return picked;
}

/** 珍品的溢价售价(基准价 ×1.35~1.85) */
export function mysteryPrice(itemId, seed, tick) {
  const base = ITEMS[itemId]?.price || 100;
  const m = hash01(`${seed}:mysteryprice:${itemId}:${tick}`);
  return Math.round(base * (1.35 + m * 0.5));
}

// ===== 酒馆 =====
/** 酒馆货架(主城常备货) */
export const TAVERN_STOCK = SHOP_STOCK.city || SHOP_STOCK.village;
/** 酒馆购物手续费 */
export const TAVERN_FEE = 0.03;
/** 酒馆请客(恢复行动力)价格 */
export const TAVERN_MEAL_GOLD = 20;
export const TAVERN_MEAL_AP = 4;

/** 角斗场档位:报名费 → 胜利奖金(报名费倍数) */
export const ARENA_TIERS = [
  { id: 'a1', name: '见习场', entry: 20, mul: 2.2, enemyLv: 0 },
  { id: 'a2', name: '精锐场', entry: 80, mul: 2.6, enemyLv: 2 },
  { id: 'a3', name: '死斗场', entry: 240, mul: 3.2, enemyLv: 5 },
];

// ===== 酒店服务生:寄存与跑腿 =====
export const BELLHOP = {
  escrowKinds: 3,        // 最多代存 3 种道具
  goldFeeRate: 0.01,     // 代存金币保管费(存入时一次性收取)
  errandFee: 0.10,       // 跑腿代购服务费(按货价)
  errandSeconds: 90,     // 跑腿耗时(与玩家走一趟相当)
};

/** 跑腿代购可选的货品(酒馆常备货) */
export function errandCatalog() {
  return TAVERN_STOCK.filter((id) => ITEMS[id]);
}
