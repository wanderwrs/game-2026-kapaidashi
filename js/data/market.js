/**
 * market.js — 「市场」(玩家集市)与「专属交易场所」的规则数据。
 *
 * 市场:全品类货物,由不同玩家设摊发售;每笔交易额外收取成交额的 10% 作为管理费。
 * 专属交易场所:只有部分地区才有,位置随机;只收当地主题的特殊交易币,
 *   管理费在 5%~70% 之间随机,货架里还有低概率出现的绝世稀有物。
 *
 * 特殊交易币的获取:宝箱 / 剧情推进 / 该地图打工,概率 30%~90%,
 *   单次获得数量的平均值 = 平均货物售出价格的七分之一(TOKEN_AVG_YIELD)。
 */

import { ITEMS, sellPrice, TOKEN_PER_GOLD } from './items.js?v=20261001b';

/** 市场每笔交易的额外管理费比例 */
export const MARKET_FEE = 0.1;

const GOODS = Object.values(ITEMS).filter((it) => it.category !== 'token' && !it.rare && !it.noTrade);
const AVG_SELL = GOODS.reduce((s, it) => s + sellPrice(it.id), 0) / Math.max(1, GOODS.length);
/** 单次获得特殊交易币的平均数量(≈ 平均货物售出价格的七分之一) */
export const TOKEN_AVG_YIELD = Math.max(1, Math.round(AVG_SELL * TOKEN_PER_GOLD));

/**
 * 市场摊主(玩家身份)。全部摊位合起来覆盖市场里的全部货物。
 * categories:该摊主发售的物品分类
 */
export const MARKET_SELLERS = [
  { id: 'herbalist', name: '「苦根」', title: '游方药贩', icon: '🧪', categories: ['potion'] },
  { id: 'baker',     name: '「胖婶」', title: '干粮客',   icon: '🍞', categories: ['food'] },
  { id: 'smith',     name: '「锤三」', title: '铁匠',     icon: '⚔️', categories: ['weapon'] },
  { id: 'tailor',    name: '「细针」', title: '裁缝',     icon: '🧵', categories: ['outfit'] },
  { id: 'caravan',   name: '「远辙」', title: '车马行东家', icon: '🐎', categories: ['vehicle'] },
  { id: 'junker',    name: '「零碎」', title: '杂货摊主', icon: '🪙', categories: ['misc'] },
];

/** 市场全部摊位(每摊给出其货物 id 列表;不含交易币与绝世稀有) */
export function marketStalls() {
  return MARKET_SELLERS
    .map((s) => ({
      ...s,
      items: Object.values(ITEMS)
        .filter((it) => it.category !== 'token' && !it.rare && s.categories.includes(it.category))
        .map((it) => it.id),
    }))
    .filter((s) => s.items.length > 0);
}

/** 该地区是否会出现专属交易场所 */
export const VENUE_CHANCE = 0.55;

/** 专属交易场所的管理费:5%~70% */
export function venueFee(rng) {
  return Math.round((0.05 + rng.next() * 0.65) * 100) / 100;
}

/**
 * 专属交易场所的货架:该主题的常规货 + 低概率上架的绝世稀有。
 * @param {string[]} baseStock 该主题的常规货(SHOP_STOCK[theme])
 * @param {() => number} flip 返回 0~1 的随机数
 */
export function venueStock(baseStock, flip) {
  const out = [...(baseStock || [])];
  const pool = Object.values(ITEMS).filter((it) => it.rare).map((it) => it.id);
  let added = 0;
  while (pool.length && added < 2 && flip() < 0.25) {
    out.push(pool.splice(Math.floor(flip() * pool.length), 1)[0]);
    added += 1;
  }
  return out;
}

/**
 * 一次特殊交易币的获取。
 * @param {() => number} flip 返回 0~1 的随机数
 * @returns {number} 获得数量(0 表示这次没拿到)
 */
export function tokenDrop(flip) {
  const chance = 0.3 + flip() * 0.6;      // 30%~90%
  if (flip() >= chance) return 0;
  return Math.max(1, Math.round(TOKEN_AVG_YIELD * (0.5 + flip())));
}
