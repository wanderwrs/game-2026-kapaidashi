/**
 * pets.js — 宠物系统(纯数据)。
 *
 * 稀有度:
 *   common 常规(12 种)  —— 市场常驻(每次刷新随机上架一部分),价格几百~几千
 *   rare   稀有(5 种)   —— 市场每次刷新有 5%~15% 概率出现,价格数万~十几万
 *   mythic 神话(2 种)   —— 市场每次刷新仅 0.001% 概率出现,价格数百万
 *
 * 宠物也能通过剧情赠送获得。
 *
 * 技能(战斗内自动生效,只带 1 只出战):
 *   heal        每回合开始时恢复 X 点生命
 *   auto_attack 每回合对敌人造成 X 点伤害
 *   atk_up      战斗开始时获得 X 点力量
 *   mp_regen    每回合开始时恢复 X 点魔力
 */

export const PET_RARITY = { common: '常规', rare: '稀有', mythic: '神话' };

/** 技能中文 */
export const PET_SKILL_CN = {
  heal: '回春',
  auto_attack: '撕咬',
  atk_up: '威压',
  mp_regen: '灵息',
};

/** 技能描述 */
export function petSkillText(skill) {
  if (!skill) return '无特殊技能';
  switch (skill.kind) {
    case 'heal':        return `每回合恢复 ${skill.amount} 点生命`;
    case 'auto_attack': return `每回合自动攻击,造成 ${skill.amount} 点伤害`;
    case 'atk_up':      return `战斗开始获得 ${skill.amount} 点力量`;
    case 'mp_regen':    return `每回合恢复 ${skill.amount} 点魔力`;
    default:            return '无特殊技能';
  }
}

/** 稀有度对应的市场出现概率 */
export const PET_SPAWN_CHANCE = { common: 1, rare: 0.10, mythic: 0.00001 };
/** 稀有宠物出现概率区间(用于文档/展示) */
export const PET_RARE_RANGE = [0.05, 0.15];
/** 神话宠物出现概率 */
export const PET_MYTHIC_CHANCE = 0.00001; // 0.001%

/** 19 种宠物:12 常规 + 5 稀有 + 2 神话 */
export const PETS = {
  // ===== 常规 12 种 =====
  pet_chick:   { id: 'pet_chick',   name: '小黄鸡', rarity: 'common', icon: '🐤', price: 600,   skill: { kind: 'heal', amount: 3 },        desc: '毛茸茸的一团,贴着你打盹,伤口就没那么疼了。' },
  pet_rabbit:  { id: 'pet_rabbit',  name: '灰兔',   rarity: 'common', icon: '🐰', price: 900,   skill: { kind: 'mp_regen', amount: 1 },    desc: '耳朵一动一动,像在替你听风的走向。' },
  pet_dog:     { id: 'pet_dog',     name: '柴犬',   rarity: 'common', icon: '🐕', price: 1600,  skill: { kind: 'auto_attack', amount: 3 }, desc: '见谁都摇尾巴,见敌就龇牙。' },
  pet_cat:     { id: 'pet_cat',     name: '花猫',   rarity: 'common', icon: '🐈', price: 1400,  skill: { kind: 'auto_attack', amount: 2 }, desc: '白天睡,夜里替你踩点。' },
  pet_sparrow: { id: 'pet_sparrow', name: '山雀',   rarity: 'common', icon: '🐦', price: 800,   skill: { kind: 'mp_regen', amount: 1 },    desc: '落在你肩上,哼不成调的小曲。' },
  pet_hedgehog:{ id: 'pet_hedgehog',name: '刺猬',   rarity: 'common', icon: '🦔', price: 1800,  skill: { kind: 'atk_up', amount: 1 },      desc: '缩成一颗带刺的球,吓得敌人不敢近身。' },
  pet_goat:    { id: 'pet_goat',    name: '山羊',   rarity: 'common', icon: '🐐', price: 1100,  skill: { kind: 'heal', amount: 2 },        desc: '什么草都吃,也没少吃你的干粮。' },
  pet_squirrel:{ id: 'pet_squirrel',name: '松鼠',   rarity: 'common', icon: '🐿️', price: 1200,  skill: { kind: 'auto_attack', amount: 2 }, desc: '把坚果扔得又准又狠。' },
  pet_duck:    { id: 'pet_duck',    name: '小鸭',   rarity: 'common', icon: '🦆', price: 700,   skill: { kind: 'heal', amount: 2 },        desc: '摇摇摆摆跟在脚后,掉进泥坑也不哭。' },
  pet_hamster: { id: 'pet_hamster', name: '仓鼠',   rarity: 'common', icon: '🐹', price: 1000,  skill: { kind: 'mp_regen', amount: 1 },    desc: '两颊塞满食物,也不知道在想什么。' },
  pet_turtle:  { id: 'pet_turtle',  name: '乌龟',   rarity: 'common', icon: '🐢', price: 2200,  skill: { kind: 'heal', amount: 4 },        desc: '走得很慢,却从没走丢过。' },
  pet_fox:     { id: 'pet_fox',     name: '赤狐',   rarity: 'common', icon: '🦊', price: 2600,  skill: { kind: 'atk_up', amount: 1 },      desc: '眼睛里像是藏着什么坏主意。' },

  // ===== 稀有 5 种 =====
  pet_whitewolf:{ id: 'pet_whitewolf',name: '白狼', rarity: 'rare', icon: '🐺', price: 46000,  skill: { kind: 'auto_attack', amount: 6 }, desc: '雪线之上的孤影,认定了就不再回头。' },
  pet_snowfox: { id: 'pet_snowfox', name: '雪狐',   rarity: 'rare', icon: '🦊', price: 38000,  skill: { kind: 'heal', amount: 6 },        desc: '走过的地方会结一层薄霜。' },
  pet_thunder_eagle: { id: 'pet_thunder_eagle', name: '雷鹰', rarity: 'rare', icon: '🦅', price: 62000, skill: { kind: 'atk_up', amount: 3 },    desc: '翼尖带着细小的电光,鸣声能传三座山。' },
  pet_jade_snake: { id: 'pet_jade_snake', name: '碧蛇', rarity: 'rare', icon: '🐍', price: 42000, skill: { kind: 'auto_attack', amount: 5 }, desc: '盘在你腕上,凉得像一块玉。' },
  pet_unicorn: { id: 'pet_unicorn', name: '独角兽', rarity: 'rare', icon: '🦄', price: 88000,  skill: { kind: 'heal', amount: 8 },        desc: '传说只在月圆夜现身,角上凝着露水。' },

  // ===== 神话 2 种 =====
  pet_baby_dragon: { id: 'pet_baby_dragon', name: '幼龙', rarity: 'mythic', icon: '🐉', price: 3200000,
    skill: { kind: 'auto_attack', amount: 12 }, skills: [{ kind: 'auto_attack', amount: 12 }, { kind: 'atk_up', amount: 4 }],
    desc: '鳞片下仍有龙焰在烧,它还没学会怎么收起来。' },
  pet_phoenix: { id: 'pet_phoenix', name: '不死鸟', rarity: 'mythic', icon: '🔥', price: 4800000,
    skill: { kind: 'heal', amount: 15 }, skills: [{ kind: 'heal', amount: 15 }, { kind: 'atk_up', amount: 5 }],
    desc: '它已经死过很多次了,每次都从灰烬里睁眼。' },
};

/** 一只宠物的全部技能(神话有两条) */
export function petSkills(pet) {
  if (!pet) return [];
  return Array.isArray(pet.skills) ? pet.skills : (pet.skill ? [pet.skill] : []);
}

/** 按稀有度分组 */
export const PETS_BY_RARITY = {
  common: Object.values(PETS).filter((p) => p.rarity === 'common'),
  rare: Object.values(PETS).filter((p) => p.rarity === 'rare'),
  mythic: Object.values(PETS).filter((p) => p.rarity === 'mythic'),
};

/**
 * 本次市场刷新的宠物货架。
 * @param {() => number} flip 返回 0~1
 * @param {string} seed 本局种子(用于稳定:同一轮次同一盘货)
 * @returns {{common:string[], rare:string[], mythic:string[]}}
 */
export function rollPetStock(flip) {
  const common = PETS_BY_RARITY.common.filter(() => flip() < 0.55).map((p) => p.id);
  const rare = [];
  // 每次刷新:稀有 5%~15% 概率出现(每只独立)
  const rareChance = 0.05 + flip() * 0.10;
  for (const p of PETS_BY_RARITY.rare) if (flip() < rareChance) rare.push(p.id);
  const mythic = [];
  for (const p of PETS_BY_RARITY.mythic) if (flip() < PET_MYTHIC_CHANCE) mythic.push(p.id);
  return { common, rare, mythic, rareChance };
}
