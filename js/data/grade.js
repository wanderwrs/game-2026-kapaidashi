/**
 * grade.js — 武器 / 防具的通用「品级」(纯数据,不依赖 items.js 以避免循环引用)。
 *
 * 五档品级,由装备等级(level)划分:
 *   普通 1~24 / 精良 25~49 / 稀有 50~84 / 史诗 85~119 / 传说 120~150
 *
 * 等级同时决定价格:等级越高、品级越高,买入价越贵 —— 武器的价格在 items.js 中随品级递增,
 * 防具的价格由 data/armor.js 的 armorPrice 按等级计算,因此「不同品级价格不同」天然成立。
 *
 * 出售限制:130 级以上的武器 / 防具不得出售(见 SELL_LOCK_LEVEL)。
 */

/** 五档品级(顺序即由低到高) */
const GRADES = [
  { key: 'common', name: '普通', color: '#9aa4b0', min: 1,   max: 24 },
  { key: 'fine',   name: '精良', color: '#5ec26a', min: 25,  max: 49 },
  { key: 'rare',   name: '稀有', color: '#4a9de0', min: 50,  max: 84 },
  { key: 'epic',   name: '史诗', color: '#b06fe0', min: 85,  max: 119 },
  { key: 'legend', name: '传说', color: '#e8a13a', min: 120, max: 150 },
];

/** 装备等级上限(与防具一致) */
const GRADE_MAX_LEVEL = 150;
/** 超过此等级的武器 / 防具不得出售 */
export const SELL_LOCK_LEVEL = 130;

/** 等级 → 品级定义 */
function gradeAt(level) {
  const lv = Math.max(1, Math.min(GRADE_MAX_LEVEL, Math.round(Number(level) || 1)));
  for (let i = GRADES.length - 1; i >= 0; i--) if (lv >= GRADES[i].min) return GRADES[i];
  return GRADES[0];
}

/** 该等级是否已超过出售上限 */
export function isSellLockedLevel(level) {
  return Math.round(Number(level) || 0) > SELL_LOCK_LEVEL;
}

/**
 * 物品品级:仅武器与防具论品级(按其 level 字段),其余物品返回 null。
 * @returns {{key:string,name:string,color:string,min:number,max:number}|null}
 */
export function gradeOf(item) {
  if (!item) return null;
  if (item.category !== 'weapon' && item.category !== 'armor') return null;
  return gradeAt(item.level || 1);
}
