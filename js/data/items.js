/**
 * items.js — 物品与商店数据。
 *
 * 分类 category:
 *   potion  药品:恢复 血量(heal) / 魔力(mp) / 战力(power)
 *   food    食品:恢复 行动力(ap)
 *   weapon  武器:装备后提升战力 / 生命(level 决定品级,见 data/grade.js)
 *   armor   防具:独立于服饰的护甲格位(head/body/hands/legs/feet/ring/earring),会画在人物身上
 *   outfit  服饰:装备后提升生命 / 魔力(含「皇帝的新装」这类特殊服饰)
 *   vehicle 载具:减少地图旅行的行动力消耗,并加快旅途的真实耗时
 *            speedMul 为旅途耗时倍率(越小越快,1 = 步行)
 *   misc    杂物:无效果,可捡拾、可出售换取金币
 *   token   交易币:专属交易场所专用,不能换成金币(见 data/market.js)
 *   material 材料:锻造武器所需(见 data/forge.js)
 *   blueprint 图纸:使用后解锁锻造配方
 *   gem     宝石:交给精益师镶嵌进武器(见 data/gems.js)
 * rare: true 的物品不会进普通商店,只在专属交易场所低概率出现。
 * noTrade: true 的物品无法在商店 / 市场买卖(如锻造武器、图纸)。
 *
 * effect(消耗品):{ kind: 'heal'|'mp'|'power'|'ap'|'full'|'rest_haste'|'travel_haste', amount }
 *   full         生命与魔力尽数回满
 *   rest_haste   缩短之后 N 次休息的真实耗时
 *   travel_haste 缩短之后 N 段旅途的真实耗时
 * equipment:slot + stats { atkPower, maxHp, maxMp, apMax, travelDiscount, shopDiscount, goldBonus, restBonus }
 *
 * sell 未填时按 price 的 50% 计算。
 */

import { MATERIAL_ITEMS, BLUEPRINT_ITEMS, FORGED_ITEMS } from './forge.js?v=20261007b';
import { GEM_ITEMS } from './gems.js?v=20261007b';
import { buildArmorCatalog, ARMOR_MAX_GEMS } from './armor.js?v=20261007b';
import { isSellLockedLevel } from './grade.js?v=20261007b';
import { EXTRA_ITEMS, EXTRA_GEAR, buildMajorSets } from './extras.js?v=20261007b';

export const ITEM_CATEGORY_CN = {
  potion: '药品',
  food: '食品',
  weapon: '武器',
  armor: '防具',
  outfit: '服饰',
  vehicle: '载具',
  misc: '杂物',
  token: '交易币',
  material: '材料',
  blueprint: '图纸',
  gem: '宝石',
  relic: '圣物',
};

/** 1 枚特殊交易币 ≈ 7 金币的货值(见 data/market.js) */
export const TOKEN_PER_GOLD = 1 / 7;

/** 物品的特殊币标价(≈买价的七分之一,至少 1 枚) */
export function tokenPrice(itemId) {
  const it = ITEMS[itemId];
  return it ? Math.max(1, Math.round((it.price || 0) * TOKEN_PER_GOLD)) : 0;
}

/** 地区主题 → 专属交易币 */
export const THEME_TOKEN = {
  village: 'token_village',
  forest: 'token_forest',
  mountain: 'token_mountain',
  city: 'token_city',
  port: 'token_port',
  sky: 'token_sky',
  ruins: 'token_ruins',
  cliff: 'token_cliff',
  camp: 'token_camp',
};

export function tokenForTheme(theme) {
  return THEME_TOKEN[theme] || THEME_TOKEN.village;
}

export const ITEMS = {
  // ===== 药品 =====
  hp_small:    { id: 'hp_small',    name: '金创药',   category: 'potion', price: 20, icon: '🧪', desc: '恢复 15 点生命。',        effect: { kind: 'heal',  amount: 15 } },
  hp_large:    { id: 'hp_large',    name: '伤愈散',   category: 'potion', price: 55, icon: '⚗️', desc: '恢复 45 点生命。',        effect: { kind: 'heal',  amount: 45 } },
  mp_small:    { id: 'mp_small',    name: '凝神散',   category: 'potion', price: 25, icon: '🫧', desc: '恢复 2 点魔力。',         effect: { kind: 'mp',    amount: 2 } },
  mp_large:    { id: 'mp_large',    name: '回气丹',   category: 'potion', price: 60, icon: '🔮', desc: '恢复 5 点魔力。',         effect: { kind: 'mp',    amount: 5 } },
  power_elixir:{ id: 'power_elixir',name: '战力药剂', category: 'potion', price: 70, icon: '💪', desc: '下一场战斗战力 +3。',      effect: { kind: 'power', amount: 3 } },
  phoenix_blood:{ id: 'phoenix_blood',name:'不死鸟之血', category: 'potion', price: 760, icon: '🩸', rare: true, desc: '传说一滴即续命。生命与魔力尽数回满。', effect: { kind: 'full', amount: 0 } },

  // ===== 战斗专用药剂(仅战斗中可用) =====
  antidote:    { id: 'antidote',    name: '解毒剂',   category: 'potion', price: 35, icon: '🌿', desc: '战斗中使用,清除自身易伤 / 虚弱 / 脆弱。', effect: { kind: 'cleanse', amount: 0 } },
  rage_potion: { id: 'rage_potion', name: '狂怒药剂', category: 'potion', price: 65, icon: '🔥', desc: '战斗中使用,本场战斗获得 3 点力量。', effect: { kind: 'rage', amount: 3 } },
  guard_potion:{ id: 'guard_potion',name: '护盾药剂', category: 'potion', price: 45, icon: '🛡️', desc: '战斗中使用,立即获得 10 点护甲。', effect: { kind: 'block_potion', amount: 10 } },
  energy_drink:{ id: 'energy_drink',name: '能量饮',   category: 'potion', price: 50, icon: '⚡', desc: '战斗中使用,立即恢复 2 点能量。', effect: { kind: 'energy', amount: 2 } },
  smoke_bomb:  { id: 'smoke_bomb',  name: '烟雾弹',   category: 'potion', price: 80, icon: '💨', desc: '战斗中使用,立即逃离当前战斗(剧情战斗可重试)。', effect: { kind: 'escape', amount: 0 } },
  lucky_coin:  { id: 'lucky_coin',  name: '幸运币',   category: 'potion', price: 120, icon: '🪙', rare: true, desc: '下场战斗胜利时金币收益翻倍。', effect: { kind: 'gold_luck', amount: 1 } },

  // ===== 加速恢复(缩短酒店休整 / 旅途的真实耗时) =====
  swift_incense:{ id: 'swift_incense', name: '醒神香', category: 'potion', price: 90,  icon: '🕯️', desc: '点上一支,下一次在酒店休整的耗时缩短至四分之一。', effect: { kind: 'rest_haste',   amount: 1 } },
  long_incense: { id: 'long_incense',  name: '长明香', category: 'potion', price: 160, icon: '🪔', desc: '能烧一整夜。接下来 2 次在酒店休整的耗时缩短至四分之一。', effect: { kind: 'rest_haste', amount: 2 } },
  wind_tonic:   { id: 'wind_tonic',    name: '疾风饮', category: 'potion', price: 110, icon: '🥤', desc: '一口气灌下,下一段旅途的耗时减半。', effect: { kind: 'travel_haste', amount: 1 } },

  // ===== 食品(恢复行动力) =====
  bread:       { id: 'bread',       name: '干面包',   category: 'food',   price: 12, icon: '🍞', desc: '恢复 2 点行动力。',        effect: { kind: 'ap', amount: 2 } },
  dried_meat:  { id: 'dried_meat',  name: '肉干',     category: 'food',   price: 28, icon: '🍖', desc: '恢复 4 点行动力。',        effect: { kind: 'ap', amount: 4 } },
  honey_cake:  { id: 'honey_cake',  name: '蜜糕',     category: 'food',   price: 55, icon: '🍯', desc: '恢复 8 点行动力。',        effect: { kind: 'ap', amount: 8 } },

  // ===== 武器(战力)—— 按职业划分:不同职业有多种不同武器,效果各异 =====
  // career 字段限定职业;swordsman 剑术 / mage 魔法 / cavalier 骑兵 / aviator 飞行 / mariner 航海 / theologian 经典
  // level 字段决定「品级」(见 data/grade.js):普通 1~24 / 精良 25~49 / 稀有 50~84 / 史诗 85~119 / 传说 120~150,
  //   品级越高买入价越贵;130 级以上不得出售。
  // ---- 剑术(剑 / 刀) ----
  iron_sword:  { id: 'iron_sword',  name: '铁剑',     category: 'weapon', career: 'swordsman', level: 10, price: 60,  icon: '🗡️', desc: '战力 +2。',  equipment: { slot: 'weapon', stats: { atkPower: 2 } } },
  steel_blade: { id: 'steel_blade', name: '精钢长剑', category: 'weapon', career: 'swordsman', level: 40, price: 160, icon: '⚔️', desc: '战力 +4,生命 +6。', equipment: { slot: 'weapon', stats: { atkPower: 4, maxHp: 6 } } },
  dragon_fang: { id: 'dragon_fang', name: '龙牙短刃', category: 'weapon', career: 'swordsman', level: 58, price: 320, icon: '🐉', desc: '战力 +7,生命 +10。', equipment: { slot: 'weapon', stats: { atkPower: 7, maxHp: 10 } } },
  // ---- 魔法(法杖) ----
  oak_staff:     { id: 'oak_staff',     name: '橡木法杖',   category: 'weapon', career: 'mage', level: 12, price: 70,  icon: '🪄', desc: '战力 +1,魔力 +2。', equipment: { slot: 'weapon', stats: { atkPower: 1, maxMp: 2 } } },
  crystal_staff: { id: 'crystal_staff', name: '水晶法杖',   category: 'weapon', career: 'mage', level: 42, price: 180, icon: '💎', desc: '战力 +3,魔力 +4。', equipment: { slot: 'weapon', stats: { atkPower: 3, maxMp: 4 } } },
  void_scepter:  { id: 'void_scepter',  name: '虚空权杖',   category: 'weapon', career: 'mage', level: 60, price: 340, icon: '🔮', desc: '战力 +5,魔力 +6,生命 +4。', equipment: { slot: 'weapon', stats: { atkPower: 5, maxMp: 6, maxHp: 4 } } },
  // ---- 骑兵(长枪) ----
  iron_spear:    { id: 'iron_spear',    name: '铁枪',       category: 'weapon', career: 'cavalier', level: 10, price: 65,  icon: '🔱', desc: '战力 +2,生命 +4。', equipment: { slot: 'weapon', stats: { atkPower: 2, maxHp: 4 } } },
  steel_lance:   { id: 'steel_lance',   name: '精钢骑枪',   category: 'weapon', career: 'cavalier', level: 40, price: 170, icon: '⚔️', desc: '战力 +4,生命 +8。', equipment: { slot: 'weapon', stats: { atkPower: 4, maxHp: 8 } } },
  dragon_piercer:{ id: 'dragon_piercer',name: '破龙骑枪',   category: 'weapon', career: 'cavalier', level: 58, price: 330, icon: '🐲', desc: '战力 +6,生命 +12。', equipment: { slot: 'weapon', stats: { atkPower: 6, maxHp: 12 } } },
  // ---- 飞行(飞刀 / 弓) ----
  wind_dagger:   { id: 'wind_dagger',   name: '风刃飞刀',   category: 'weapon', career: 'aviator', level: 10, price: 60,  icon: '🗡️', desc: '战力 +2,行动力上限 +1。', equipment: { slot: 'weapon', stats: { atkPower: 2, apMax: 1 } } },
  sky_bow:       { id: 'sky_bow',       name: '苍穹弓',     category: 'weapon', career: 'aviator', level: 42, price: 175, icon: '🏹', desc: '战力 +4,行动力上限 +1。', equipment: { slot: 'weapon', stats: { atkPower: 4, apMax: 1 } } },
  falcon_blade:  { id: 'falcon_blade',  name: '隼翼弯刀',   category: 'weapon', career: 'aviator', level: 58, price: 320, icon: '🦅', desc: '战力 +6,行动力上限 +2,生命 +4。', equipment: { slot: 'weapon', stats: { atkPower: 6, apMax: 2, maxHp: 4 } } },
  // ---- 航海(弯刀 / 鱼叉) ----
  cutlass:       { id: 'cutlass',       name: '水手弯刀',   category: 'weapon', career: 'mariner', level: 10, price: 65,  icon: '🗡️', desc: '战力 +2,生命 +3。', equipment: { slot: 'weapon', stats: { atkPower: 2, maxHp: 3 } } },
  trident:       { id: 'trident',       name: '三叉戟',     category: 'weapon', career: 'mariner', level: 42, price: 175, icon: '🔱', desc: '战力 +4,魔力 +1,生命 +5。', equipment: { slot: 'weapon', stats: { atkPower: 4, maxMp: 1, maxHp: 5 } } },
  leviathan_hook:{ id: 'leviathan_hook',name: '利维坦钩',   category: 'weapon', career: 'mariner', level: 58, price: 330, icon: '🪝', desc: '战力 +6,生命 +8,魔力 +2。', equipment: { slot: 'weapon', stats: { atkPower: 6, maxHp: 8, maxMp: 2 } } },
  // ---- 经典(圣典 / 权杖) ----
  prayer_book:   { id: 'prayer_book',   name: '祈祷圣典',   category: 'weapon', career: 'theologian', level: 12, price: 70, icon: '📖', desc: '战力 +1,魔力 +3。', equipment: { slot: 'weapon', stats: { atkPower: 1, maxMp: 3 } } },
  holy_scepter:  { id: 'holy_scepter',  name: '圣光权杖',   category: 'weapon', career: 'theologian', level: 44, price: 185, icon: '✨', desc: '战力 +3,魔力 +5,生命 +3。', equipment: { slot: 'weapon', stats: { atkPower: 3, maxMp: 5, maxHp: 3 } } },
  scripture:     { id: 'scripture',     name: '降魔真经',   category: 'weapon', career: 'theologian', level: 60, price: 350, icon: '📜', desc: '战力 +5,魔力 +7,生命 +6。', equipment: { slot: 'weapon', stats: { atkPower: 5, maxMp: 7, maxHp: 6 } } },

  // ===== 防具(与服饰完全独立:各占自己的格位,且会与服饰一同画在人物身上) =====
  // armorSlot: head 头部 / body 上身 / hands 手部 / legs 腿部 / feet 脚步 / ring 戒指 / earring 耳环
  // level 决定品级(见 data/grade.js),也决定盔甲的色泽档位(见 data/armor.js 的 armorBand)
  padded_armor:  { id: 'padded_armor',  name: '棉甲',     category: 'armor', armorSlot: 'body', level: 12, price: 50,  icon: '🧥', desc: '生命 +6。软甲,轻便但挡得住割伤。', equipment: { slot: 'body', stats: { maxHp: 6 } } },
  chain_mail:    { id: 'chain_mail',    name: '锁子甲',   category: 'armor', armorSlot: 'body', level: 30, price: 130, icon: '🛡️', desc: '生命 +14,战力 +1。铁环相扣,刀枪难入。', equipment: { slot: 'body', stats: { maxHp: 14, atkPower: 1 } } },
  plate_armor:   { id: 'plate_armor',   name: '板甲',     category: 'armor', armorSlot: 'body', level: 45, price: 260, icon: '🛡️', desc: '生命 +22,战力 +2。重铠,刀枪不入。', equipment: { slot: 'body', stats: { maxHp: 22, atkPower: 2 } } },
  mithril_mail:  { id: 'mithril_mail',  name: '秘银锁甲', category: 'armor', armorSlot: 'body', level: 60, price: 480, icon: '💠', desc: '生命 +30,战力 +3,魔力 +2。秘银所铸,轻若无物。', equipment: { slot: 'body', stats: { maxHp: 30, atkPower: 3, maxMp: 2 } } },
  // 原先混在「服饰」里的护甲类装备,现各归其防具格位
  leather_armor: { id: 'leather_armor', name: '皮甲',     category: 'armor', armorSlot: 'body',  level: 22, price: 120, icon: '🥋', desc: '生命 +14。护住胸口,也护住一口气。', equipment: { slot: 'body', stats: { maxHp: 14 } } },
  iron_helm:     { id: 'iron_helm',     name: '铁盔',     category: 'armor', armorSlot: 'head',  level: 30, price: 160, icon: '⛑️', desc: '生命 +10,战力 +1。沉是沉了些,顶得住一刀。', equipment: { slot: 'head', stats: { maxHp: 10, atkPower: 1 } } },
  iron_greaves:  { id: 'iron_greaves',  name: '铁护腿',   category: 'armor', armorSlot: 'legs',  level: 32, price: 180, icon: '🦿', desc: '生命 +8,战力 +1。沉得抬腿都费劲。', equipment: { slot: 'legs', stats: { maxHp: 8, atkPower: 1 } } },
  iron_boots:    { id: 'iron_boots',    name: '铁靴',     category: 'armor', armorSlot: 'feet',  level: 31, price: 170, icon: '🥾', desc: '生命 +9。每一步都砸出响。', equipment: { slot: 'feet', stats: { maxHp: 9 } } },
  dragon_scale_mail: { id: 'dragon_scale_mail', name: '龙鳞甲', category: 'armor', armorSlot: 'body', level: 82, price: 600, icon: '🛡️', desc: '生命 +22,战力 +2。鳞片扣在身上,像有一层皮。', equipment: { slot: 'body', stats: { maxHp: 22, atkPower: 2 } } },

  // ===== 服饰(可自由搭配:帽子 / 衣服 / 裤子 / 鞋子 四个部位各一件) =====
  // equipment.slot: hat 帽子 / top 衣服 / bottom 裤子 / shoes 鞋子
  // look:  像素人物的外观配色与样式(见 ui/scene.js);hide: true 表示穿上后该部位「看不见」
  // 特殊增益(可叠加):shopDiscount 商店折扣 / goldBonus 金币收益 / restBonus 休息多回行动力
  //                   travelDiscount 旅行行动力折扣 / apMax 行动力上限

  // ---- 帽子 ----
  straw_hat:    { id: 'straw_hat',    name: '草帽',   category: 'outfit', price: 30,  icon: '👒', desc: '生命 +2。廉价的遮阳物,村口人手一顶。', equipment: { slot: 'hat', stats: { maxHp: 2 } }, look: { hat: '#c9b06a', hatHi: '#e3d18f', style: 'straw' } },
  leather_cap:  { id: 'leather_cap',  name: '皮帽',   category: 'outfit', price: 70,  icon: '🧢', desc: '生命 +4。硬邦邦的熟皮,挡得住树枝。', equipment: { slot: 'hat', stats: { maxHp: 4 } }, look: { hat: '#5a3f2a', hatHi: '#7c5a3c', style: 'cap' } },
  feather_cap:  { id: 'feather_cap',  name: '羽饰帽', category: 'outfit', price: 120, icon: '🎩', desc: '生命 +3,魔力 +1。插一根野雉尾羽,看着精神。', equipment: { slot: 'hat', stats: { maxHp: 3, maxMp: 1 } }, look: { hat: '#3d4a63', hatHi: '#5b6c8c', style: 'feather' } },
  scholar_hood: { id: 'scholar_hood', name: '学者兜帽', category: 'outfit', price: 150, icon: '🧣', desc: '魔力 +2。兜帽压得极低,连眼睛都藏在阴影里。', equipment: { slot: 'hat', stats: { maxMp: 2 } }, look: { hat: '#453a6b', hatHi: '#5b4d8c', style: 'hood' } },
  crown:        { id: 'crown',        name: '王冠',   category: 'outfit', price: 520, icon: '👑', desc: '魔力 +3,生命 +6。特殊:商店购物 9 折。', equipment: { slot: 'hat', stats: { maxMp: 3, maxHp: 6, shopDiscount: 0.1 } }, look: { hat: '#c9a227', hatHi: '#e8cd6e', style: 'crown' } },
  emperor_new_hat: { id: 'emperor_new_hat', name: '皇帝的新帽', category: 'outfit', price: 999, icon: '✨', desc: '戴上后头顶空空,只有风。', equipment: { slot: 'hat', stats: {} }, hide: true, look: { style: 'none' } },

  // ---- 衣服 ----
  hemp_shirt:    { id: 'hemp_shirt',    name: '麻布短褂', category: 'outfit', price: 25,  icon: '👕', desc: '生命 +3。洗得发白,但干净。', equipment: { slot: 'top', stats: { maxHp: 3 } }, look: { cloth: '#8a7f63', cloth2: '#a2987a', trim: '#6d6450' } },
  traveler_cloak:{ id: 'traveler_cloak', name: '旅人斗篷', category: 'outfit', price: 40,  icon: '🧥', desc: '生命 +5,魔力 +1。风里雨里都跟着你。', equipment: { slot: 'top', stats: { maxHp: 5, maxMp: 1 } }, look: { cloth: '#4a5a4a', cloth2: '#5f7360', trim: '#c9a227' } },
  noble_robe:    { id: 'noble_robe',     name: '贵族长袍', category: 'outfit', price: 140, icon: '👘', desc: '魔力 +2,生命 +4。料子好得不像赶路人穿的。', equipment: { slot: 'top', stats: { maxMp: 2, maxHp: 4 } }, look: { cloth: '#4b3a63', cloth2: '#6a5590', trim: '#c9a227' } },
  scholar_robe:  { id: 'scholar_robe',   name: '学者长袍', category: 'outfit', price: 200, icon: '🥼', desc: '魔力 +3。袖口宽大,藏得下书也藏得下刀。', equipment: { slot: 'top', stats: { maxMp: 3 } }, look: { cloth: '#3a3f6b', cloth2: '#525a94', trim: '#6fc0e8' } },
  pilgrim_mantle:{ id: 'pilgrim_mantle', name: '朝圣斗篷', category: 'outfit', price: 240, icon: '🧎', desc: '生命 +5。特殊:休息时多恢复 3 点行动力。', equipment: { slot: 'top', stats: { maxHp: 5, restBonus: 3 } }, look: { cloth: '#6b6349', cloth2: '#8b8260', trim: '#d9d2c0' } },
  merchant_vest: { id: 'merchant_vest',  name: '商人马甲', category: 'outfit', price: 300, icon: '🦺', desc: '生命 +4。特殊:金币收益 +20%。', equipment: { slot: 'top', stats: { maxHp: 4, goldBonus: 0.2 } }, look: { cloth: '#7a4a2a', cloth2: '#9c6739', trim: '#e8cd6e' } },
  wind_coat:     { id: 'wind_coat',      name: '风衣',     category: 'outfit', price: 260, icon: '🧥', desc: '生命 +6,旅行行动力消耗 −1。', equipment: { slot: 'top', stats: { maxHp: 6, travelDiscount: 1 } }, look: { cloth: '#355364', cloth2: '#4a7288', trim: '#8fb6c9' } },
  emperor_new_clothes: { id: 'emperor_new_clothes', name: '皇帝的新衣', category: 'outfit', price: 999, icon: '✨', desc: '传说中只有智者才能看见的华服。穿上它……上身什么也没有。', equipment: { slot: 'top', stats: {} }, hide: true, look: { style: 'none' } },

  // ---- 裤子 ----
  patched_pants: { id: 'patched_pants', name: '补丁布裤', category: 'outfit', price: 20,  icon: '👖', desc: '生命 +2。补了七次,还舍不得扔。', equipment: { slot: 'bottom', stats: { maxHp: 2 } }, look: { pants: '#4a4136' } },
  leather_pants: { id: 'leather_pants', name: '皮裤',     category: 'outfit', price: 90,  icon: '👖', desc: '生命 +5。骑马赶路不容易磨破。', equipment: { slot: 'bottom', stats: { maxHp: 5 } }, look: { pants: '#5a3f2a' } },
  sailor_trousers:{ id: 'sailor_trousers', name: '水手裤', category: 'outfit', price: 110, icon: '👖', desc: '生命 +4,旅行行动力消耗 −1。裤脚总带着盐渍。', equipment: { slot: 'bottom', stats: { maxHp: 4, travelDiscount: 1 } }, look: { pants: '#2c4a5a' } },
  silk_pants:    { id: 'silk_pants',    name: '绸裤',     category: 'outfit', price: 130, icon: '👖', desc: '魔力 +2。走起路来没有声音。', equipment: { slot: 'bottom', stats: { maxMp: 2 } }, look: { pants: '#5a4a6b' } },
  emperor_new_pants: { id: 'emperor_new_pants', name: '皇帝的新裤', category: 'outfit', price: 999, icon: '✨', desc: '穿上后膝下生风,凉飕飕的。', equipment: { slot: 'bottom', stats: {} }, hide: true, look: { style: 'none' } },

  // ---- 鞋子 ----
  cloth_shoes:   { id: 'cloth_shoes',   name: '布鞋',     category: 'outfit', price: 15,  icon: '👟', desc: '生命 +1。走十里就该换一双。', equipment: { slot: 'shoes', stats: { maxHp: 1 } }, look: { boot: '#3b342a' } },
  leather_boots: { id: 'leather_boots', name: '皮靴',     category: 'outfit', price: 80,  icon: '🥾', desc: '生命 +4。踩进泥里也不怕。', equipment: { slot: 'shoes', stats: { maxHp: 4 } }, look: { boot: '#4a3423' } },
  dancer_shoes:  { id: 'dancer_shoes',  name: '舞鞋',     category: 'outfit', price: 140, icon: '🩰', desc: '魔力 +2。轻得几乎感觉不到脚。', equipment: { slot: 'shoes', stats: { maxMp: 2 } }, look: { boot: '#8a5a63' } },
  swift_boots:   { id: 'swift_boots',   name: '疾行靴',   category: 'outfit', price: 220, icon: '👢', desc: '生命 +6,魔力 +1,战力 +1。特殊:旅行行动力消耗 −2。鞋底薄,脚感却轻。', equipment: { slot: 'shoes', stats: { maxHp: 6, maxMp: 1, atkPower: 1, travelDiscount: 2 } }, look: { boot: '#2f4a5a' } },
  emperor_new_boots: { id: 'emperor_new_boots', name: '皇帝的新靴', category: 'outfit', price: 999, icon: '✨', desc: '踩着虚无赶路,石子硌得生疼。', equipment: { slot: 'shoes', stats: {} }, hide: true, look: { style: 'none' } },

  // ===== 绝世稀有(不会出现在普通商店,只在专属交易场所低概率上架) =====
  starfall_blade:   { id: 'starfall_blade',   name: '陨星剑',   category: 'weapon', career: 'swordsman', level: 138, price: 980,  icon: '🌠', rare: true, desc: '剑脊嵌着一小块落星,挥动时带着余温。战力 +18,生命 +12。', equipment: { slot: 'weapon', stats: { atkPower: 18, maxHp: 12 } } },
  void_mantle:      { id: 'void_mantle',      name: '虚无斗篷', category: 'outfit', price: 1040, icon: '🌑', rare: true, desc: '披上像被夜色收进去。生命 +34,魔力 +6。', equipment: { slot: 'top', stats: { maxHp: 34, maxMp: 6 } }, look: { cloth: '#2a2740', cloth2: '#3b3760', trim: '#9b7fe8' } },
  prophet_circlet:  { id: 'prophet_circlet',  name: '先知之冠', category: 'outfit', price: 900,  icon: '👑', rare: true, desc: '冠心一颗缓慢转动的星。魔力 +7,生命 +8。特殊:商店购物 8 折。', equipment: { slot: 'hat', stats: { maxMp: 7, maxHp: 8, shopDiscount: 0.2 } }, look: { hat: '#3a2f6b', hatHi: '#9b7fe8', style: 'crown' } },
  titan_greaves:    { id: 'titan_greaves',    name: '泰坦护腿', category: 'armor', armorSlot: 'legs', level: 100, price: 860,  icon: '🦿', rare: true, desc: '沉得像两条石柱。生命 +18,战力 +3。', equipment: { slot: 'legs', stats: { maxHp: 18, atkPower: 3 } } },
  gale_boots:       { id: 'gale_boots',       name: '疾风长靴', category: 'outfit', price: 820,  icon: '👢', rare: true, desc: '生命 +14,魔力 +3,战力 +2。特殊:旅行行动力消耗 −5。落地无声。', equipment: { slot: 'shoes', stats: { maxHp: 14, maxMp: 3, atkPower: 2, travelDiscount: 5 } }, look: { boot: '#20404a' } },
  sage_stone:       { id: 'sage_stone',       name: '贤者之石', category: 'misc',   price: 880,  icon: '💎', rare: true, desc: '握久了他做梦。卖给识货者可换大钱。' },

  // ===== 记忆之书(圣物):使用后跳过对应区间的主线剧情,获取该区间全部奖励,并以一卷书页简述所发生的故事 =====
  memory_book_a: { id: 'memory_book_a', name: '记忆之书·壹', category: 'relic', price: 2000, icon: '📕', desc: '翻开后可跳过主线剧情第 1~14 章,获取全部奖励,直达第十五章。仅在第 1~14 章境内可用。', effect: { kind: 'skip_chapter', from: 'ch01', to: 'ch14', next: 'ch15' } },
  memory_book_b: { id: 'memory_book_b', name: '记忆之书·贰', category: 'relic', price: 3000, icon: '📗', desc: '翻开后可跳过主线剧情第 15~26 章,获取全部奖励,直达最终决战第二十七章。仅在第 15~26 章境内可用。', effect: { kind: 'skip_chapter', from: 'ch15', to: 'ch26', next: 'ch27' } },

  // ===== 特殊交易币(专属交易场所专用;不能换成金币,只能在对应主题的集市里花) =====
  token_village:  { id: 'token_village',  name: '谷币',   category: 'token', price: 280, icon: '🌾', sell: 0, desc: '村集通行的凭票,只在乡野的专属集市里认。' },
  token_forest:   { id: 'token_forest',   name: '松脂珠', category: 'token', price: 280, icon: '🍃', sell: 0, desc: '凝住的松脂,林间集市把它当钱使。' },
  token_mountain: { id: 'token_mountain', name: '雪晶',   category: 'token', price: 280, icon: '❄️', sell: 0, desc: '雪岭里结出的透明晶石,山民认它。' },
  token_city:     { id: 'token_city',     name: '银筹',   category: 'token', price: 280, icon: '🪙', sell: 0, desc: '王城黑市流通的银质筹码。' },
  token_port:     { id: 'token_port',     name: '贝壳币', category: 'token', price: 280, icon: '🐚', sell: 0, desc: '远洋商船带来的贝壳,只认港口。' },
  token_sky:      { id: 'token_sky',      name: '云绵石', category: 'token', price: 280, icon: '☁️', sell: 0, desc: '浮空岛上采的轻石,云间集市通用。' },
  token_ruins:    { id: 'token_ruins',    name: '残碑片', category: 'token', price: 280, icon: '🪨', sell: 0, desc: '废墟里掘出的古碑残片,拾荒者的硬通货。' },
  token_cliff:    { id: 'token_cliff',    name: '崖铁钉', category: 'token', price: 280, icon: '⛏️', sell: 0, desc: '凿崖留下的铁钉,崖民当钱攒。' },
  token_camp:     { id: 'token_camp',     name: '营灰印', category: 'token', price: 280, icon: '🔥', sell: 0, desc: '烧过的营灰压成的印记,荒野营地认它。' },

  // ===== 载具(降低旅行行动力消耗,并加快旅途的真实耗时) =====
  // equipment.stats.travelDiscount:降低行动力消耗;speedMul:旅途耗时倍率(越小越快)
  // terrain:该载具可通行的地形(land 陆地 / plateau 高原 / sea 海面·港口 / sky 浮空);
  //         徒步不受地形限制,但装备的载具走不了的地形就无法出发
  // 载具同样占装备格,除旅行特效外也给基础参数(兽力坐骑额外带战力)
  old_horse:   { id: 'old_horse',   name: '老马',     category: 'vehicle', price: 90,  icon: '🐴', terrain: ['land', 'plateau'], desc: '生命 +8,战力 +1。旅途耗时 ×0.75,行动力消耗 −1。只走陆地与高原。', speedMul: 0.75, equipment: { slot: 'vehicle', stats: { maxHp: 8, atkPower: 1, travelDiscount: 1 } } },
  cart:        { id: 'cart',        name: '板车',     category: 'vehicle', price: 180, icon: '🛒', terrain: ['land', 'plateau'], desc: '生命 +14。旅途耗时 ×0.55,行动力消耗 −2。只走陆地与高原。', speedMul: 0.55, equipment: { slot: 'vehicle', stats: { maxHp: 14, travelDiscount: 2 } } },
  swift_horse: { id: 'swift_horse', name: '快马',     category: 'vehicle', price: 260, icon: '🐎', terrain: ['land', 'plateau'], desc: '生命 +16,战力 +1。旅途耗时 ×0.45,行动力消耗 −2。只走陆地与高原。', speedMul: 0.45, equipment: { slot: 'vehicle', stats: { maxHp: 16, atkPower: 1, travelDiscount: 2 } } },
  snow_leopard:{ id: 'snow_leopard',name: '雪豹',     category: 'vehicle', price: 420, icon: '🐆', terrain: ['land', 'plateau'], desc: '生命 +22,战力 +2。旅途耗时 ×0.34,行动力消耗 −3。只走陆地与高原,不渡海。', speedMul: 0.34, equipment: { slot: 'vehicle', stats: { maxHp: 22, atkPower: 2, travelDiscount: 3 } } },
  skiff:       { id: 'skiff',       name: '快帆船',   category: 'vehicle', price: 320, icon: '⛵', terrain: ['sea'], desc: '生命 +16,魔力 +1。旅途耗时 ×0.38,行动力消耗 −2。只走海面与港口。', speedMul: 0.38, equipment: { slot: 'vehicle', stats: { maxHp: 16, maxMp: 1, travelDiscount: 2 } } },
  steamship:   { id: 'steamship',   name: '轮船',     category: 'vehicle', price: 440, icon: '🚢', terrain: ['sea'], desc: '生命 +22,魔力 +2。旅途耗时 ×0.30,行动力消耗 −3。只走海面与港口。', speedMul: 0.30, equipment: { slot: 'vehicle', stats: { maxHp: 22, maxMp: 2, travelDiscount: 3 } } },
  wind_glider: { id: 'wind_glider', name: '风翼',     category: 'vehicle', price: 360, icon: '🪂', terrain: ['land', 'plateau', 'sky'], desc: '生命 +18,魔力 +2,战力 +1。旅途耗时 ×0.30,行动力消耗 −3,行动力上限 +2。走陆地、高原与浮空,不渡海。', speedMul: 0.30, equipment: { slot: 'vehicle', stats: { maxHp: 18, maxMp: 2, atkPower: 1, travelDiscount: 3, apMax: 2 } } },
  airship:     { id: 'airship',     name: '飞艇',     category: 'vehicle', price: 680, icon: '🎈', terrain: ['land', 'plateau', 'sea', 'sky'], desc: '生命 +26,魔力 +3,战力 +2。旅途耗时 ×0.18,行动力消耗 −4,行动力上限 +2。可飞跃全部地区。', speedMul: 0.18, equipment: { slot: 'vehicle', stats: { maxHp: 26, maxMp: 3, atkPower: 2, travelDiscount: 4, apMax: 2 } } },

  // ===== 杂物(可捡拾 / 可出售) =====
  herbs:       { id: 'herbs',       name: '草药',     category: 'misc', price: 10, icon: '🌿', desc: '寻常草药,可卖给商人。' },
  wolf_pelt:   { id: 'wolf_pelt',   name: '狼皮',     category: 'misc', price: 18, icon: '🐺', desc: '完整的狼皮,值几个钱。' },
  old_coin:    { id: 'old_coin',    name: '古币',     category: 'misc', price: 30, icon: '🪙', desc: '不知年代的旧钱,收藏者或愿出价。' },
  bone_charm:  { id: 'bone_charm',  name: '骨符',     category: 'misc', price: 45, icon: '🦴', desc: '教团遗落的骨符,阴森但值钱。' },
};

// ===== 并入锻造 / 图纸 / 宝石类物品(见 data/forge.js、data/gems.js) =====
Object.assign(ITEMS, MATERIAL_ITEMS, BLUEPRINT_ITEMS, FORGED_ITEMS, GEM_ITEMS);
// 图纸不可买卖(仅用于解锁配方)
for (const id of Object.keys(BLUEPRINT_ITEMS)) ITEMS[id].noTrade = true;

// ===== 并入扩充内容:特殊消耗品 / 大职介套装 / 扩充服饰武器 / 防具目录 =====
Object.assign(ITEMS, EXTRA_ITEMS, buildMajorSets(), EXTRA_GEAR, buildArmorCatalog());

/**
 * 某物品是否可买卖。
 *   · 交易币 / 图纸 不可买卖
 *   · 锻造装备不可交易
 *   · 镶嵌过宝石的武器 / 防具可在市场流通(见 data/armor.js 与 core/economy.js 的镶嵌逻辑)
 *   · 等级超过 SELL_LOCK_LEVEL(130)的武器 / 防具不得出售
 */
export function isTradeable(id) {
  const it = ITEMS[id];
  if (!it) return false;
  if (it.category === 'token' || it.category === 'blueprint') return false;
  if (it.forged) return false;
  if ((it.category === 'weapon' || it.category === 'armor') && isSellLockedLevel(it.level)) return false;
  const socketed = !!(it.gems && it.gems.length);
  if (it.noTrade && !socketed) return false;
  return true;
}

/** 该物品是否因等级过高(>130)而不可出售 */
export function isSellLocked(id) {
  const it = ITEMS[id];
  if (!it) return true;
  if (it.category !== 'weapon' && it.category !== 'armor') return false;
  return isSellLockedLevel(it.level);
}

/** 某武器的宝石槽数(普通武器默认 1,需显式 sockets 覆盖) */
export function socketsOf(id) {
  const it = ITEMS[id];
  if (!it) return 0;
  if (it.category === 'weapon') return Number.isFinite(it.sockets) ? it.sockets : 1;
  if (it.category === 'armor') return Number.isFinite(it.sockets) ? it.sockets : ARMOR_MAX_GEMS;
  return 0;
}

/** 某防具属于哪个防具槽位(非防具返回 null) */
export function armorSlotOf(id) {
  const it = ITEMS[id];
  return it && it.category === 'armor' ? (it.armorSlot || 'body') : null;
}

/** 防具当前等级(非防具返回 0) */
export function armorLevelOf(id) {
  const it = ITEMS[id];
  return it && it.category === 'armor' ? (it.level || 1) : 0;
}

/** 出售价:未显式给出则取买价的 50%(向下取整) */
export function sellPrice(itemId) {
  const it = ITEMS[itemId];
  if (!it) return 0;
  return it.sell ?? Math.floor((it.price || 0) * 0.5);
}

/** 商店库存:按地区主题配置(买价 = ITEMS.price,可受服饰折扣影响) */
export const SHOP_STOCK = {
  village: ['hp_small', 'bread', 'hemp_shirt', 'patched_pants', 'cloth_shoes', 'straw_hat', 'old_horse', 'antidote'],
  forest:  ['hp_small', 'dried_meat', 'mp_small', 'leather_cap', 'leather_boots', 'iron_sword', 'swift_horse', 'antidote', 'guard_potion'],
  mountain:['hp_small', 'hp_large', 'mp_small', 'leather_armor', 'iron_helm', 'iron_greaves', 'iron_boots', 'steel_blade', 'dragon_scale_mail', 'cart', 'snow_leopard', 'rage_potion', 'guard_potion'],
  city:    ['hp_large', 'mp_large', 'power_elixir', 'swift_incense', 'wind_tonic', 'noble_robe', 'silk_pants', 'feather_cap', 'dancer_shoes', 'crown', 'merchant_vest', 'steel_blade', 'swift_horse', 'airship', 'emperor_new_clothes', 'emperor_new_pants', 'emperor_new_hat', 'emperor_new_boots', 'antidote', 'rage_potion', 'energy_drink', 'smoke_bomb'],
  port:    ['hp_small', 'dried_meat', 'mp_large', 'wind_tonic', 'noble_robe', 'sailor_trousers', 'swift_boots', 'wind_coat', 'cart', 'skiff', 'steamship', 'energy_drink'],
  sky:     ['mp_large', 'honey_cake', 'power_elixir', 'swift_incense', 'long_incense', 'scholar_robe', 'scholar_hood', 'feather_cap', 'swift_horse', 'wind_glider', 'airship', 'energy_drink', 'smoke_bomb'],
  ruins:   ['hp_small', 'dried_meat', 'leather_pants', 'pilgrim_mantle', 'bone_charm', 'cart', 'antidote', 'smoke_bomb'],
  cliff:   ['hp_small', 'mp_small', 'iron_sword', 'swift_boots', 'wind_coat', 'swift_horse', 'guard_potion'],
  camp:    ['hp_small', 'bread', 'patched_pants', 'straw_hat', 'iron_sword', 'old_horse', 'antidote'],
};

/** 可捡拾杂物池:战斗胜利后有小概率获得 */
export const LOOT_MISC = ['herbs', 'wolf_pelt', 'old_coin', 'bone_charm'];
