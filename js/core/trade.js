/**
 * TradeEngine — 市场定价、手续费与节日引擎。
 *
 * 职责:
 *   · 计算货物在当前 5 小时轮次的浮动价格(市场买价 / 均价 / 卖价基准)
 *   · 按场景给出买 / 卖手续费(商店 3% / 市场 12% / 主城 17%~40% / 特殊币 7%~70%)
 *   · 主城节日判定(每 7 天随机 1 小时,节日期间主城手续费全免)
 *   · 玩家货架挂单的成交判定(挂售价 ≤ 均价 × (45% ± 浮动) 即被买走)
 *
 * 所有随机均以本局种子为基准,保证同一轮次内价格稳定、可复现。
 */

import { ITEMS, sellPrice, tokenPrice } from '../data/items.js?v=20261007i';
import {
  FEES, FESTIVAL, SELL_FLOOR, SELL_FLOOR_FLOAT,
  hash01, priceTick, priceMul, msToNextTick, festivalState, cityFee, tokenFee,
} from '../data/trade.js?v=20261007i';

/** 市场总体景气度加成(整体买价的一个偏置) */
export class TradeEngine {
  constructor({ seed = 1 } = {}) {
    this.seed = seed >>> 0;
    this.tick = priceTick();
  }

  /** 若跨过新的价格轮次则刷新缓存 */
  refresh(now = Date.now()) {
    const t = priceTick(now);
    if (t !== this.tick) this.tick = t;
    return this.tick;
  }

  /** 距下次价格刷新剩余毫秒 */
  msToNextPriceChange(now = Date.now()) { return msToNextTick(now); }

  /** 当前是否主城节日 */
  festival(now = Date.now()) { return festivalState(this.seed, now); }

  /**
   * 市场买入价:物品基准价 × 浮动倍率 × (1 + 手续费)
   * @param {string} itemId
   * @param {number} fee 手续费比例
   */
  marketBuyPrice(itemId, fee = 0, now = Date.now()) {
    const it = ITEMS[itemId];
    if (!it) return 0;
    const mul = priceMul(itemId, this.seed, priceTick(now));
    return Math.max(1, Math.round((it.price || 0) * mul * (1 + fee)));
  }

  /** 市场基准均价(不含手续费) */
  marketAvg(itemId, now = Date.now()) {
    const it = ITEMS[itemId];
    if (!it) return 0;
    const mul = priceMul(itemId, this.seed, priceTick(now));
    return Math.max(1, Math.round((it.price || 0) * mul));
  }

  /** 市场卖出净得:基于市场均价 × 卖出系数(默认 0.5)再扣手续费 */
  marketSellNet(itemId, fee = 0, now = Date.now()) {
    const avg = this.marketAvg(itemId, now);
    const base = Math.round(avg * 0.5);
    return Math.max(1, Math.round(base * (1 - fee)));
  }

  /** 价格相对基准的涨跌(用于 UI 标注:>1 涨 / <1 跌) */
  priceTrend(itemId, now = Date.now()) {
    return priceMul(itemId, this.seed, priceTick(now)); // 0.7~1.4
  }

  /**
   * 场景手续费。
   * @param {'shop'|'market'|'city'|'token'} kind
   * @param {number} [venueFee] 特殊交易场所自有 fee(有则优先)
   * @param {boolean} [isCity] 当前是否身处主城
   */
  feeFor(kind, venueFee, isCity = false, now = Date.now()) {
    this.refresh(now);
    const fest = this.festival(now);
    switch (kind) {
      case 'shop':
        return { fee: FEES.shop, festival: false };
      case 'market':
        return { fee: FEES.market, festival: false };
      case 'token':
        return { fee: Number.isFinite(venueFee) ? venueFee : tokenFee(this.seed, this.tick), festival: false };
      case 'city':
        if (fest.active) return { fee: 0, festival: true };
        return { fee: cityFee(this.seed, this.tick), festival: false };
      default:
        return { fee: FEES.market, festival: false };
    }
  }

  /**
   * 玩家货架挂单成交判定。
   * 规则:挂售价 ≤ 市场均价 × (SELL_FLOOR ± 浮动) 即被买走(明显偏低则秒卖)。
   * @returns {{sold:boolean, threshold:number, gain:number}}
   */
  trySellListing(itemId, listPrice, fee, now = Date.now()) {
    const avg = this.marketAvg(itemId, now);
    // 浮动:每个轮次稳定,按 itemId 抖动
    const jitter = (hash01(`${this.seed}:${priceTick(now)}:${itemId}:floor`) - 0.5) * 2 * SELL_FLOOR_FLOAT;
    const ratio = Math.max(0.2, SELL_FLOOR + jitter);
    const threshold = Math.max(1, Math.round(avg * ratio));
    if (listPrice <= threshold) {
      const gain = Math.max(1, Math.round(listPrice * (1 - fee)));
      return { sold: true, threshold, gain };
    }
    return { sold: false, threshold, gain: 0 };
  }

  /** 特殊币标价(专属场所):基准 token 价 × 浮动 × (1+fee) */
  venuePrice(itemId, fee = 0, now = Date.now()) {
    const base = tokenPrice(itemId);
    if (!base) return 0;
    const mul = priceMul(itemId, this.seed, priceTick(now));
    return Math.max(1, Math.round(base * mul * (1 + fee)));
  }
}

export { FESTIVAL, SELL_FLOOR };
