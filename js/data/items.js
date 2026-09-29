/**
 * items.js — 物品与商店数据。
 *
 * 分类 category:
 *   potion  药品:恢复 血量(heal) / 魔力(mp) / 战力(power)
 *   food    食品:恢复 行动力(ap)
 *   weapon  武器:装备后提升战力 / 生命
 *   outfit  服饰:装备后提升生命 / 魔力(含「皇帝的新装」这类特殊服饰)
 *   vehicle 载具:减少地图旅行消耗的行动力
 *   misc    杂物:无效果,可捡拾、可出售换取金币
 *
 * effect(消耗品):{ kind: 'heal'|'mp'|'power'|'ap', amount }
 * equipment:slot + stats { atkPower, maxHp, maxMp, apMax, travelDiscount }
 *
 * sell 未填时按 price 的 50% 计算。
 */

export const ITEM_CATEGORY_CN = {
  potion: '药品',
  food: '食品',
  weapon: '武器',
  outfit: '服饰',
  vehicle: '载具',
  misc: '杂物',
};

export const ITEMS = {
  // ===== 药品 =====
  hp_small:    { id: 'hp_small',    name: '金创药',   category: 'potion', price: 20, icon: '🧪', desc: '恢复 15 点生命。',        effect: { kind: 'heal',  amount: 15 } },
  hp_large:    { id: 'hp_large',    name: '白药',     category: 'potion', price: 55, icon: '⚗️', desc: '恢复 45 点生命。',        effect: { kind: 'heal',  amount: 45 } },
  mp_small:    { id: 'mp_small',    name: '凝神散',   category: 'potion', price: 25, icon: '🫧', desc: '恢复 2 点魔力。',         effect: { kind: 'mp',    amount: 2 } },
  mp_large:    { id: 'mp_large',    name: '回气丹',   category: 'potion', price: 60, icon: '🔮', desc: '恢复 5 点魔力。',         effect: { kind: 'mp',    amount: 5 } },
  power_elixir:{ id: 'power_elixir',name: '战力药剂', category: 'potion', price: 70, icon: '💪', desc: '下一场战斗战力 +3。',      effect: { kind: 'power', amount: 3 } },

  // ===== 食品(恢复行动力) =====
  bread:       { id: 'bread',       name: '干面包',   category: 'food',   price: 12, icon: '🍞', desc: '恢复 2 点行动力。',        effect: { kind: 'ap', amount: 2 } },
  dried_meat:  { id: 'dried_meat',  name: '肉干',     category: 'food',   price: 28, icon: '🍖', desc: '恢复 4 点行动力。',        effect: { kind: 'ap', amount: 4 } },
  honey_cake:  { id: 'honey_cake',  name: '蜜糕',     category: 'food',   price: 55, icon: '🍯', desc: '恢复 8 点行动力。',        effect: { kind: 'ap', amount: 8 } },

  // ===== 武器(战力) =====
  iron_sword:  { id: 'iron_sword',  name: '铁剑',     category: 'weapon', price: 60,  icon: '🗡️', desc: '战力 +2。',  equipment: { slot: 'weapon', stats: { atkPower: 2 } } },
  steel_blade: { id: 'steel_blade', name: '精钢长剑', category: 'weapon', price: 160, icon: '⚔️', desc: '战力 +4,生命 +6。', equipment: { slot: 'weapon', stats: { atkPower: 4, maxHp: 6 } } },
  dragon_fang: { id: 'dragon_fang', name: '龙牙短刃', category: 'weapon', price: 320, icon: '🐉', desc: '战力 +7,生命 +10。', equipment: { slot: 'weapon', stats: { atkPower: 7, maxHp: 10 } } },

  // ===== 服饰 =====
  traveler_cloak:{ id: 'traveler_cloak', name: '旅人斗篷', category: 'outfit', price: 40,  icon: '🧥', desc: '生命 +5,魔力 +1。',   equipment: { slot: 'outfit', stats: { maxHp: 5, maxMp: 1 } } },
  leather_armor: { id: 'leather_armor',  name: '皮甲',     category: 'outfit', price: 120, icon: '🥋', desc: '生命 +14。',          equipment: { slot: 'outfit', stats: { maxHp: 14 } } },
  noble_robe:    { id: 'noble_robe',     name: '贵族长袍', category: 'outfit', price: 140, icon: '👘', desc: '魔力 +2,生命 +4。',   equipment: { slot: 'outfit', stats: { maxMp: 2, maxHp: 4 } } },
  emperor_new_clothes: {
    id: 'emperor_new_clothes', name: '皇帝的新装', category: 'outfit', price: 999, icon: '✨',
    desc: '传说中只有智者才能看见的华服。穿上它……你什么也没穿上。',
    equipment: { slot: 'outfit', stats: {} },
  },

  // ===== 载具(降低旅行行动力消耗) =====
  old_horse:   { id: 'old_horse',   name: '老马',     category: 'vehicle', price: 90,  icon: '🐴', desc: '旅行行动力消耗 −1(每段至少 1)。', equipment: { slot: 'vehicle', stats: { travelDiscount: 1 } } },
  cart:        { id: 'cart',        name: '板车',     category: 'vehicle', price: 180, icon: '🛒', desc: '旅行行动力消耗 −2。',             equipment: { slot: 'vehicle', stats: { travelDiscount: 2 } } },
  wind_glider: { id: 'wind_glider', name: '风翼',     category: 'vehicle', price: 360, icon: '🪂', desc: '旅行行动力消耗 −3,行动力上限 +2。', equipment: { slot: 'vehicle', stats: { travelDiscount: 3, apMax: 2 } } },

  // ===== 杂物(可捡拾 / 可出售) =====
  herbs:       { id: 'herbs',       name: '草药',     category: 'misc', price: 10, icon: '🌿', desc: '寻常草药,可卖给商人。' },
  wolf_pelt:   { id: 'wolf_pelt',   name: '狼皮',     category: 'misc', price: 18, icon: '🐺', desc: '完整的狼皮,值几个钱。' },
  old_coin:    { id: 'old_coin',    name: '古币',     category: 'misc', price: 30, icon: '🪙', desc: '不知年代的旧钱,收藏者或愿出价。' },
  bone_charm:  { id: 'bone_charm',  name: '骨符',     category: 'misc', price: 45, icon: '🦴', desc: '教团遗落的骨符,阴森但值钱。' },
};

/** 出售价:未显式给出则取买价的 50%(向下取整) */
export function sellPrice(itemId) {
  const it = ITEMS[itemId];
  if (!it) return 0;
  return it.sell ?? Math.floor((it.price || 0) * 0.5);
}

/** 商店库存:按地区主题配置(买价 = ITEMS.price) */
export const SHOP_STOCK = {
  village: ['hp_small', 'bread', 'traveler_cloak', 'iron_sword', 'old_horse'],
  forest:  ['hp_small', 'dried_meat', 'mp_small', 'iron_sword'],
  mountain:['hp_small', 'hp_large', 'mp_small', 'leather_armor', 'steel_blade'],
  city:    ['hp_large', 'mp_large', 'power_elixir', 'noble_robe', 'steel_blade', 'emperor_new_clothes'],
  port:    ['hp_small', 'dried_meat', 'mp_large', 'noble_robe', 'cart'],
  sky:     ['mp_large', 'honey_cake', 'power_elixir', 'wind_glider'],
  ruins:   ['hp_small', 'dried_meat', 'leather_armor', 'bone_charm'],
  cliff:   ['hp_small', 'mp_small', 'iron_sword'],
  camp:    ['hp_small', 'bread', 'iron_sword'],
};

/** 可捡拾杂物池:战斗胜利后有小概率获得 */
export const LOOT_MISC = ['herbs', 'wolf_pelt', 'old_coin', 'bone_charm'];
