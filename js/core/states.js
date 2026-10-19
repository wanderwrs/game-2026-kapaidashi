/**
 * states.js — 界面状态常量。
 *
 * 独立成模块,避免 core/facility-actions.js 与 core/game.js 相互 import 形成循环依赖。
 * game.js 仍会 re-export,外部(如 ui.js)的 `import { GameState } from './game.js'` 不受影响。
 */
export const GameState = Object.freeze({
  MENU: 'menu',
  CAREER: 'career',
  NARRATIVE: 'narrative',
  MAP: 'map',
  WORLD: 'world',
  TRAVEL: 'travel',
  SHOP: 'shop',
  MARKET: 'market',
  BAG: 'bag',
  JOB: 'job',
  BATTLE: 'battle',
  REWARD: 'reward',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
  CREDITS: 'credits',
  RESTAURANT: 'restaurant',
  HOTEL: 'hotel',
  MARKET_POI: 'market_poi',
  MERCHANT: 'merchant',
  BLACKSMITH: 'blacksmith',
  GEMSHOP: 'gemshop',
  JEWELER: 'jeweler',
  FACILITY: 'facility',
});
