/**
 * armor.js — 防具系统(纯数据,不依赖 items.js 以避免循环引用)。
 *
 * 七个防具槽位(与「服装」的 帽/上衣/裤/鞋 完全独立):
 *   head 头部防具 / body 上身防具 / hands 手部防具 / legs 腿部防具 / feet 脚步防具
 *   ring 戒指 / earring 耳环
 *
 * 等级体系(1~150):
 *   · 1~40   可在各地「商店」买到
 *   · 41~100 可在「市场」买到
 *   · 101~150 只能靠「镶嵌宝石」逐级提升(每颗宝石 +10 级,最多 5 颗到 150)
 *   · 镶嵌过宝石的防具可在市场流通(购买 / 出售);但 130 级以上的防具不得出售
 *
 * 数值与价格随等级增长;防具名称由「等级档位前缀 + 部位名 + Lv.等级」组成。
 * 等级同时决定品级(见 data/grade.js)与盔甲色泽(见 armorBand 的 tint)。
 */

/** 七个防具槽位(顺序即 UI 展示顺序) */
export const ARMOR_SLOTS = ['head', 'body', 'hands', 'legs', 'feet', 'ring', 'earring'];

/** 槽位中文名 */
export const ARMOR_SLOT_CN = {
  head: '头部防具',
  body: '上身防具',
  hands: '手部防具',
  legs: '腿部防具',
  feet: '脚步防具',
  ring: '戒指',
  earring: '耳环',
};

/** 等级区间 */
export const ARMOR_MIN_LEVEL = 1;
export const ARMOR_MAX_LEVEL = 150;
export const ARMOR_SHOP_MAX = 40;    // 商店仅售 ≤40
export const ARMOR_MARKET_MAX = 100; // 市场售 1~100
export const ARMOR_GEM_STEP = 10;    // 每颗宝石 +10 级
export const ARMOR_MAX_GEMS = 5;     // 最多 5 颗宝石 → 100 + 50 = 150

/** 各槽位的基础倾向:主属性权重 + 图标 + 部位名 + 基础价 */
export const ARMOR_BASE = {
  head:    { name: '头盔', icon: '🪖', hp: 3.2, atk: 0.06, mp: 0.02, price: 42 },
  body:    { name: '胸甲', icon: '🛡️', hp: 5.0, atk: 0.08, mp: 0.02, price: 58 },
  hands:   { name: '护手', icon: '🧤', hp: 2.2, atk: 0.12, mp: 0.02, price: 46 },
  legs:    { name: '护腿', icon: '🦿', hp: 3.4, atk: 0.06, mp: 0.02, price: 50 },
  feet:    { name: '战靴', icon: '🥾', hp: 2.4, atk: 0.06, mp: 0.02, price: 44 },
  ring:    { name: '指环', icon: '💍', hp: 1.2, atk: 0.14, mp: 0.10, price: 66 },
  earring: { name: '耳饰', icon: '👂', hp: 1.4, atk: 0.08, mp: 0.14, price: 62 },
};

/** 等级档位前缀(决定造型气质与命名) */
const BANDS = [
  { max: 20,  name: '粗制', tint: '#8a7f63' },
  { max: 40,  name: '铁制', tint: '#8d949e' },
  { max: 60,  name: '精钢', tint: '#a8b4c2' },
  { max: 80,  name: '秘银', tint: '#c9d6e6' },
  { max: 100, name: '龙鳞', tint: '#4f9a7a' },
  { max: 120, name: '星辰', tint: '#8f7fe0' },
  { max: 150, name: '神话', tint: '#e8cd6e' },
];

/** 该等级所属档位 */
export function armorBand(level) {
  for (const b of BANDS) if (level <= b.max) return b;
  return BANDS[BANDS.length - 1];
}

/** 防具数值(随等级线性成长,主属性至少 1) */
export function armorStats(slot, level) {
  const base = ARMOR_BASE[slot];
  if (!base) return {};
  const lv = Math.max(ARMOR_MIN_LEVEL, Math.min(ARMOR_MAX_LEVEL, Math.round(level)));
  const st = {
    maxHp: Math.max(1, Math.round(lv * base.hp)),
    atkPower: Math.round(lv * base.atk),
    maxMp: Math.round(lv * base.mp),
  };
  if (st.atkPower <= 0) delete st.atkPower;
  if (st.maxMp <= 0) delete st.maxMp;
  return st;
}

/** 防具售价(随等级超线性增长) */
export function armorPrice(slot, level) {
  const base = ARMOR_BASE[slot];
  if (!base) return 1;
  const lv = Math.max(ARMOR_MIN_LEVEL, lv2(level));
  return Math.max(1, Math.round(base.price * Math.pow(lv, 1.45)));
}
function lv2(level) { return Math.min(ARMOR_MAX_LEVEL, Math.round(level)); }

/** 防具名称 */
export function armorName(slot, level) {
  const base = ARMOR_BASE[slot];
  if (!base) return '防具';
  return `${armorBand(lv2(level)).name}${base.name} Lv.${lv2(level)}`;
}

/** 防具描述 */
export function armorDesc(slot, level) {
  const st = armorStats(slot, level);
  const parts = [];
  if (st.maxHp) parts.push(`生命 +${st.maxHp}`);
  if (st.atkPower) parts.push(`战力 +${st.atkPower}`);
  if (st.maxMp) parts.push(`魔力 +${st.maxMp}`);
  const lv = lv2(level);
  const src = lv <= ARMOR_SHOP_MAX ? '商店可购' : (lv <= ARMOR_MARKET_MAX ? '市场流通' : '镶嵌升阶');
  return `${parts.join(',')}。【${lv} 级防具 · ${src}】`;
}

/**
 * 生成一件防具的物品定义(静态目录与动态实例共用)。
 * @param {string} slot  ARMOR_SLOTS 之一
 * @param {number} level 1~150
 * @param {string} [id]  指定 id(静态目录用稳定 id;动态实例留空由 Economy 分配)
 * @param {string[]} [gems] 已镶嵌的宝石(动态实例)
 */
export function makeArmor(slot, level, id, gems = []) {
  const base = ARMOR_BASE[slot];
  if (!base) return null;
  const lv = Math.max(ARMOR_MIN_LEVEL, Math.min(ARMOR_MAX_LEVEL, Math.round(level)));
  const def = {
    id: id || null,
    name: armorName(slot, lv),
    category: 'armor',
    armorSlot: slot,
    level: lv,
    icon: base.icon,
    tint: armorBand(lv).tint,
    price: armorPrice(slot, lv),
    desc: armorDesc(slot, lv),
    equipment: { slot, stats: armorStats(slot, lv) },
    sockets: Math.max(0, ARMOR_MAX_GEMS - gems.length),
    gems: [...gems],
  };
  return def;
}

/** 静态防具目录 id(供商店 / 市场货架引用) */
export function armorId(slot, level) {
  return `armor_${slot}_${Math.round(level)}`;
}

/** 商店在售等级(≤40) */
export const ARMOR_SHOP_LEVELS = [5, 10, 15, 20, 25, 30, 35, 40];
/** 市场在售等级(41~100) */
export const ARMOR_MARKET_LEVELS = [45, 55, 65, 75, 85, 95, 100];

/** 生成静态防具目录(并入 ITEMS) */
export function buildArmorCatalog() {
  const out = {};
  for (const slot of ARMOR_SLOTS) {
    for (const lv of ARMOR_SHOP_LEVELS) {
      const id = armorId(slot, lv);
      out[id] = makeArmor(slot, lv, id);
    }
    for (const lv of ARMOR_MARKET_LEVELS) {
      const id = armorId(slot, lv);
      out[id] = makeArmor(slot, lv, id);
    }
  }
  return out;
}

/** 等级 → 该等级在商店 / 市场是否可得 */
export function armorSource(level) {
  if (level <= ARMOR_SHOP_MAX) return 'shop';
  if (level <= ARMOR_MARKET_MAX) return 'market';
  return 'forge';
}
