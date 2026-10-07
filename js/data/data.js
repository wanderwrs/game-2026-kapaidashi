/**
 * data.js — 游戏内容数据。
 * 卡牌 / 起始牌组 / 敌人 / 遗物 全部数据驱动,新增内容无需改逻辑。
 * effect 结构参见 card.js 顶部说明。
 */

// ===== 卡牌定义 =====
export const CARDS = {
  strike:     { id: 'strike',     name: '打击',     cost: 1, type: 'attack', description: '造成 6 点伤害。',               effects: [{ kind: 'damage', amount: 6 }],                                            rarity: 'basic' },
  defend:     { id: 'defend',     name: '防御',     cost: 1, type: 'skill',  description: '获得 5 点护甲。',               effects: [{ kind: 'block',  amount: 5 }],                                            rarity: 'basic' },
  cleave:     { id: 'cleave',     name: '劈砍',     cost: 2, type: 'attack', description: '造成 11 点伤害。',            effects: [{ kind: 'damage', amount: 11 }],                                           rarity: 'common' },
  pommel:     { id: 'pommel',     name: '重击',     cost: 1, type: 'attack', description: '造成 4 点伤害,施加 1 易伤。',  effects: [{ kind: 'damage', amount: 4 }, { kind: 'status_enemy', name: 'vulnerable', stacks: 1 }], rarity: 'common' },
  shield_bash:{ id: 'shield_bash',name: '盾击',     cost: 1, type: 'attack', description: '获得 4 护甲,造成 5 伤害。',     effects: [{ kind: 'block',  amount: 4 }, { kind: 'damage', amount: 5 }],                rarity: 'common' },
  flex:       { id: 'flex',       name: '蓄势',     cost: 0, type: 'skill',  description: '获得 1 力量。',                 effects: [{ kind: 'status_self', name: 'strength', stacks: 1 }],                            rarity: 'common' },
  insight:    { id: 'insight',    name: '洞察',     cost: 0, type: 'skill',  description: '抽 1 张牌。',                  effects: [{ kind: 'draw',   amount: 1 }],                                            rarity: 'common' },
  recover:    { id: 'recover',    name: '调息',     cost: 1, type: 'skill',  description: '恢复 5 HP。',                  effects: [{ kind: 'heal',   amount: 5 }],                                            rarity: 'common' },

  // ===== 职业特色卡(由 careers.js 引用) =====
  riposte:     { id: 'riposte',     name: '反击',     cost: 1, type: 'skill',  description: '获得 6 护甲,下回合首张攻击+3。', effects: [{ kind: 'block', amount: 6 }],                                                                       rarity: 'uncommon', career: 'swordsman' },
  iron_will:   { id: 'iron_will',   name: '钢铁意志', cost: 1, type: 'power',  description: '每回合开始获得 2 护甲。',       effects: [],                                                                                          rarity: 'rare',     career: 'swordsman' },
  arcane_bolt: { id: 'arcane_bolt', name: '奥术箭',   cost: 1, type: 'attack', description: '造成 7 伤害,抽 1 张牌。',       effects: [{ kind: 'damage', amount: 7 }, { kind: 'draw', amount: 1 }],                          rarity: 'common',   career: 'mage' },
  starfall:    { id: 'starfall',    name: '星陨',     cost: 2, type: 'attack', description: '造成 12 伤害,1 易伤。',         effects: [{ kind: 'damage', amount: 12 }, { kind: 'status_enemy', name: 'vulnerable', stacks: 1 }], rarity: 'rare',     career: 'mage' },
  charge:      { id: 'charge',      name: '冲锋',     cost: 1, type: 'attack', description: '造成 8 伤害,本回合弃 1 牌。',   effects: [{ kind: 'damage', amount: 8 }],                                                                       rarity: 'common',   career: 'cavalier' },
  trample:     { id: 'trample',     name: '践踏',     cost: 2, type: 'attack', description: '造成 14 伤害,2 虚弱。',         effects: [{ kind: 'damage', amount: 14 }, { kind: 'status_enemy', name: 'weak', stacks: 2 }],       rarity: 'rare',     career: 'cavalier' },
  dive:        { id: 'dive',        name: '俯冲',     cost: 1, type: 'attack', description: '造成 5 伤害,获得 3 护甲。',    effects: [{ kind: 'damage', amount: 5 }, { kind: 'block', amount: 3 }],                            rarity: 'common',   career: 'aviator' },
  gust:        { id: 'gust',        name: '疾风',     cost: 0, type: 'skill',  description: '获得 4 护甲,抽 1 牌。',         effects: [{ kind: 'block', amount: 4 }, { kind: 'draw', amount: 1 }],                            rarity: 'common',   career: 'aviator' },
  tide:        { id: 'tide',        name: '潮汐',     cost: 1, type: 'attack', description: '造成 6 伤害,恢复 2 HP。',      effects: [{ kind: 'damage', amount: 6 }, { kind: 'heal', amount: 2 }],                            rarity: 'common',   career: 'mariner' },
  tsunami:     { id: 'tsunami',     name: '海啸',     cost: 2, type: 'attack', description: '造成 13 伤害,1 虚弱。',        effects: [{ kind: 'damage', amount: 13 }, { kind: 'status_enemy', name: 'weak', stacks: 1 }],       rarity: 'rare',     career: 'mariner' },
  bless:       { id: 'bless',      name: '祈福',     cost: 1, type: 'skill',  description: '恢复 4 HP,获得 3 护甲。',      effects: [{ kind: 'heal', amount: 4 }, { kind: 'block', amount: 3 }],                              rarity: 'common',   career: 'theologian' },
  judgement:   { id: 'judgement',   name: '审判',     cost: 2, type: 'attack', description: '造成 10 伤害,2 易伤。',         effects: [{ kind: 'damage', amount: 10 }, { kind: 'status_enemy', name: 'vulnerable', stacks: 2 }], rarity: 'rare',     career: 'theologian' },

  // ===== 中立通用卡(任何职业可用) =====
  heavy_strike:{ id: 'heavy_strike',name: '重劈',     cost: 2, type: 'attack', description: '造成 14 伤害。',               effects: [{ kind: 'damage', amount: 14 }],                                           rarity: 'common' },
  iron_skin:   { id: 'iron_skin',   name: '铁皮',     cost: 1, type: 'skill',  description: '获得 8 护甲。',               effects: [{ kind: 'block', amount: 8 }],                                            rarity: 'common' },
  meditate:    { id: 'meditate',    name: '冥想',     cost: 0, type: 'skill',  description: '抽 2 张牌。',                  effects: [{ kind: 'draw', amount: 2 }],                                            rarity: 'uncommon' },
  fortify:     { id: 'fortify',     name: '加固',     cost: 1, type: 'power',  description: '本局每回合开始获得 2 护甲。',  effects: [],                                                                                          rarity: 'rare' },
  execute:     { id: 'execute',     name: '处决',     cost: 2, type: 'attack', description: '造成 9 伤害,目标 HP<30 时双倍。', effects: [{ kind: 'damage', amount: 9 }],                                                            rarity: 'uncommon' },
  crippling:   { id: 'crippling',   name: '致残',     cost: 1, type: 'attack', description: '造成 5 伤害,2 虚弱。',         effects: [{ kind: 'damage', amount: 5 }, { kind: 'status_enemy', name: 'weak', stacks: 2 }],       rarity: 'common' },
  second_wind: { id: 'second_wind', name: '重整',     cost: 1, type: 'skill',  description: '恢复 8 HP。',                 effects: [{ kind: 'heal', amount: 8 }],                                            rarity: 'uncommon' },
  twin_strike: { id: 'twin_strike', name: '双击',     cost: 1, type: 'attack', description: '造成 4 伤害两次。',           effects: [{ kind: 'damage', amount: 4 }, { kind: 'damage', amount: 4 }],                          rarity: 'common' },
  battle_cry:  { id: 'battle_cry',  name: '战吼',     cost: 0, type: 'skill',  description: '获得 1 力量,抽 1 牌。',         effects: [{ kind: 'status_self', name: 'strength', stacks: 1 }, { kind: 'draw', amount: 1 }],  rarity: 'uncommon' },
  perfect_def: { id: 'perfect_def', name: '完美格挡', cost: 2, type: 'skill',  description: '获得 12 护甲。',               effects: [{ kind: 'block', amount: 12 }],                                           rarity: 'rare' },

  // ===== 职业稀有特色卡(每职业 +1) =====
  blade_storm: { id: 'blade_storm', name: '剑刃风暴', cost: 3, type: 'attack', description: '造成 18 伤害。',              effects: [{ kind: 'damage', amount: 18 }],                                            rarity: 'rare', career: 'swordsman' },
  meteor:      { id: 'meteor',      name: '陨星',     cost: 3, type: 'attack', description: '造成 16 伤害,2 易伤。',        effects: [{ kind: 'damage', amount: 16 }, { kind: 'status_enemy', name: 'vulnerable', stacks: 2 }], rarity: 'rare', career: 'mage' },
  lance_thrust:{ id: 'lance_thrust',name: '骑枪冲锋', cost: 2, type: 'attack', description: '造成 12 伤害,本回合获得 4 护甲。', effects: [{ kind: 'damage', amount: 12 }, { kind: 'block', amount: 4 }],                          rarity: 'rare', career: 'cavalier' },
  sky_dance:   { id: 'sky_dance',   name: '云舞',     cost: 2, type: 'attack', description: '造成 10 伤害,抽 2 张牌。',     effects: [{ kind: 'damage', amount: 10 }, { kind: 'draw', amount: 2 }],                          rarity: 'rare', career: 'aviator' },
  maelstrom:   { id: 'maelstrom',   name: '涡旋',     cost: 3, type: 'attack', description: '造成 17 伤害,1 虚弱。',        effects: [{ kind: 'damage', amount: 17 }, { kind: 'status_enemy', name: 'weak', stacks: 1 }],       rarity: 'rare', career: 'mariner' },
  holy_fire:   { id: 'holy_fire',   name: '净火',     cost: 3, type: 'attack', description: '造成 15 伤害,恢复 5 HP。',     effects: [{ kind: 'damage', amount: 15 }, { kind: 'heal', amount: 5 }],                            rarity: 'rare', career: 'theologian' },

  // ===== 治疗师职业卡 =====
  heal_touch:  { id: 'heal_touch',  name: '治愈之手', cost: 1, type: 'skill',  description: '恢复 8 HP。',                  effects: [{ kind: 'heal', amount: 8 }],                                               rarity: 'common', career: 'healer' },
  sanctuary:   { id: 'sanctuary',   name: '庇护结界', cost: 1, type: 'skill',  description: '获得 8 护甲,恢复 3 HP。',      effects: [{ kind: 'block', amount: 8 }, { kind: 'heal', amount: 3 }],                      rarity: 'common', career: 'healer' },
  bless_aura:  { id: 'bless_aura',  name: '祝福光环', cost: 1, type: 'skill',  description: '获得 1 力量,恢复 4 HP。',      effects: [{ kind: 'status_self', name: 'strength', stacks: 1 }, { kind: 'heal', amount: 4 }], rarity: 'uncommon', career: 'healer' },
  group_heal:  { id: 'group_heal',  name: '群体治愈', cost: 2, type: 'skill',  description: '恢复 15 HP,获得 4 护甲。',     effects: [{ kind: 'heal', amount: 15 }, { kind: 'block', amount: 4 }],                     rarity: 'rare', career: 'healer' },
  life_force:  { id: 'life_force',  name: '生命之力', cost: 2, type: 'power',  description: '每回合开始恢复 4 HP。',        effects: [],                                                                            rarity: 'rare', career: 'healer' },

  // ===== 白魔法师职业卡 =====
  holy_light:  { id: 'holy_light',  name: '圣光术',   cost: 1, type: 'skill',  description: '恢复 10 HP,获得 3 护甲。',     effects: [{ kind: 'heal', amount: 10 }, { kind: 'block', amount: 3 }],                     rarity: 'common', career: 'white_mage' },
  divine_shield:{ id: 'divine_shield',name: '神圣护盾',cost: 1, type: 'skill', description: '获得 12 护甲。',               effects: [{ kind: 'block', amount: 12 }],                                              rarity: 'common', career: 'white_mage' },
  holy_smite:  { id: 'holy_smite',  name: '圣光打击', cost: 1, type: 'attack', description: '造成 8 伤害,恢复 4 HP。',     effects: [{ kind: 'damage', amount: 8 }, { kind: 'heal', amount: 4 }],                      rarity: 'uncommon', career: 'white_mage' },
  holy_storm:  { id: 'holy_storm',  name: '圣光风暴', cost: 3, type: 'attack', description: '造成 18 伤害,施加 2 易伤。', effects: [{ kind: 'damage', amount: 18 }, { kind: 'status_enemy', name: 'vulnerable', stacks: 2 }], rarity: 'rare', career: 'white_mage' },
  divine_grace:{ id: 'divine_grace',name: '神圣恩典', cost: 2, type: 'power',  description: '每回合开始恢复 6 HP,获得 1 力量。', effects: [],                                                              rarity: 'rare', career: 'white_mage' },

  // ===== 黑魔法师职业卡 =====
  shadow_bolt: { id: 'shadow_bolt', name: '暗影箭',   cost: 1, type: 'attack', description: '造成 10 伤害。',              effects: [{ kind: 'damage', amount: 10 }],                                             rarity: 'common', career: 'black_mage' },
  curse:       { id: 'curse',       name: '虚弱诅咒', cost: 1, type: 'skill',  description: '施加 2 虚弱,造成 3 伤害。',   effects: [{ kind: 'status_enemy', name: 'weak', stacks: 2 }, { kind: 'damage', amount: 3 }], rarity: 'common', career: 'black_mage' },
  hellfire:    { id: 'hellfire',    name: '地狱火',   cost: 2, type: 'attack', description: '造成 14 伤害,施加 1 易伤。', effects: [{ kind: 'damage', amount: 14 }, { kind: 'status_enemy', name: 'vulnerable', stacks: 1 }], rarity: 'uncommon', career: 'black_mage' },
  void_rift:   { id: 'void_rift',   name: '毁灭黑洞', cost: 3, type: 'attack', description: '造成 20 伤害,施加 2 虚弱。', effects: [{ kind: 'damage', amount: 20 }, { kind: 'status_enemy', name: 'weak', stacks: 2 }],       rarity: 'rare', career: 'black_mage' },
  dark_pact:   { id: 'dark_pact',   name: '黑暗契约', cost: 1, type: 'power',  description: '获得 2 力量,损失 3 HP。',     effects: [{ kind: 'status_self', name: 'strength', stacks: 2 }],                          rarity: 'rare', career: 'black_mage' },

  // ===== 剧情奖励卡(战斗胜利后可选) =====
  dragon_slash: { id: 'dragon_slash', name: '屠龙斩',  cost: 2, type: 'attack', description: '造成 13 伤害。屠龙者印记。',    effects: [{ kind: 'damage', amount: 13 }],                                            rarity: 'rare' },
  faith_shield: { id: 'faith_shield', name: '信仰之盾', cost: 1, type: 'skill',  description: '获得 6 护甲,恢复 3 HP。',     effects: [{ kind: 'block', amount: 6 }, { kind: 'heal', amount: 3 }],                            rarity: 'uncommon' },
  brother_bond:{ id: 'brother_bond', name: '手足之情', cost: 0, type: 'skill',  description: '抽 1 张牌,获得 4 护甲。',     effects: [{ kind: 'draw', amount: 1 }, { kind: 'block', amount: 4 }],                            rarity: 'uncommon' },
  oath_keeper: { id: 'oath_keeper',  name: '守约者',   cost: 2, type: 'power',  description: '获得 1 力量,1 护甲。',         effects: [{ kind: 'status_self', name: 'strength', stacks: 1 }, { kind: 'block', amount: 1 }],  rarity: 'rare' },
  storm_call:  { id: 'storm_call',   name: '唤雷',     cost: 1, type: 'attack', description: '造成 6 伤害,抽 1 张牌。',       effects: [{ kind: 'damage', amount: 6 }, { kind: 'draw', amount: 1 }],                            rarity: 'uncommon' },
};

// ===== 敌人定义 =====
// actions: 意图池,每回合随机抽一个
export const ENEMIES = {
  normal: [
    { name: '哨兵',     hp: 24, actions: [{ kind: 'attack', value: 6 }, { kind: 'attack', value: 6 }, { kind: 'block', value: 4 }] },
    { name: '盗匪',     hp: 30, actions: [{ kind: 'attack', value: 7 }, { kind: 'attack', value: 10 }, { kind: 'block', value: 3 }] },
    { name: '蜂群',     hp: 18, actions: [{ kind: 'attack', value: 4 }, { kind: 'attack', value: 4 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
  ],
  elite: [
    { name: '重装卫士', hp: 50, actions: [{ kind: 'attack', value: 12 }, { kind: 'block', value: 8 }] },
  ],
  boss: [
    { name: '堕落领主', hp: 80, actions: [{ kind: 'attack', value: 14 }, { kind: 'attack', value: 14 }, { kind: 'buff', name: 'strength', stacks: 2 }] },
  ],
  // ===== 剧情专用敌人池(由 narrative 节点 enemyPool 引用) =====
  ch01: [
    { name: '龙脊教徒', hp: 28, actions: [{ kind: 'attack', value: 7 }, { kind: 'attack', value: 5 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
    { name: '焚村黑龙(幼)', hp: 45, actions: [{ kind: 'attack', value: 9 }, { kind: 'attack', value: 6 }, { kind: 'block', value: 5 }] },
  ],
  ch02: [
    { name: '边境盗匪', hp: 32, actions: [{ kind: 'attack', value: 8 }, { kind: 'attack', value: 11 }] },
    { name: '教团斥候', hp: 28, actions: [{ kind: 'attack', value: 7 }, { kind: 'block', value: 5 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
  ],
  ch02b: [
    { name: '矿镇野狗', hp: 24, actions: [{ kind: 'attack', value: 6 }, { kind: 'attack', value: 7 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
    { name: '矿道掘虫', hp: 30, actions: [{ kind: 'attack', value: 8 }, { kind: 'block', value: 5 }] },
    { name: '井下巨钳', hp: 36, actions: [{ kind: 'attack', value: 9 }, { kind: 'attack', value: 7 }, { kind: 'block', value: 6 }] },
  ],
  ch03: [
    { name: '王城刺客', hp: 40, actions: [{ kind: 'attack', value: 10 }, { kind: 'attack', value: 6 }, { kind: 'attack', value: 12 }] },
  ],
  ch04: [
    { name: '码头恶棍', hp: 36, actions: [{ kind: 'attack', value: 9 }, { kind: 'block', value: 6 }] },
    { name: '继父爪牙', hp: 30, actions: [{ kind: 'attack', value: 8 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
  ],
  ch04b: [
    { name: '私盐帮众', hp: 32, actions: [{ kind: 'attack', value: 8 }, { kind: 'block', value: 5 }] },
    { name: '滩涂蟹妖', hp: 34, actions: [{ kind: 'attack', value: 9 }, { kind: 'attack', value: 6 }, { kind: 'block', value: 4 }] },
  ],
  ch05: [
    { name: '幼年黑龙', hp: 55, actions: [{ kind: 'attack', value: 11 }, { kind: 'attack', value: 8 }, { kind: 'block', value: 6 }] },
  ],
  ch05b: [
    { name: '雪岭劫商', hp: 36, actions: [{ kind: 'attack', value: 10 }, { kind: 'attack', value: 7 }] },
    { name: '垭口雪魈', hp: 40, actions: [{ kind: 'attack', value: 9 }, { kind: 'block', value: 7 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
  ],
  ch06: [
    { name: '野林狼', hp: 22, actions: [{ kind: 'attack', value: 5 }, { kind: 'attack', value: 5 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
  ],
  ch07: [
    { name: '迷林妖精', hp: 26, actions: [{ kind: 'attack', value: 6 }, { kind: 'attack', value: 4 }, { kind: 'block', value: 4 }] },
    { name: '林中熊', hp: 42, actions: [{ kind: 'attack', value: 10 }, { kind: 'attack', value: 7 }] },
  ],
  ch08: [
    { name: '剑塔叛徒', hp: 38, actions: [{ kind: 'attack', value: 9 }, { kind: 'attack', value: 9 }, { kind: 'block', value: 5 }] },
  ],
  ch09: [
    { name: '风翼海盗', hp: 34, actions: [{ kind: 'attack', value: 8 }, { kind: 'attack', value: 6 }, { kind: 'block', value: 4 }] },
  ],
  ch10: [
    { name: '深海鱼人', hp: 36, actions: [{ kind: 'attack', value: 9 }, { kind: 'attack', value: 7 }] },
  ],
  ch11: [
    { name: '教团纠察', hp: 44, actions: [{ kind: 'attack', value: 11 }, { kind: 'buff', name: 'strength', stacks: 1 }, { kind: 'block', value: 6 }] },
  ],
  ch12: [
    { name: '教团守卫', hp: 40, actions: [{ kind: 'attack', value: 10 }, { kind: 'block', value: 7 }] },
  ],
  ch13: [
    { name: '教团长老', hp: 48, actions: [{ kind: 'attack', value: 12 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
  ],
  ch14: [
    { name: '大祭司', hp: 90, actions: [{ kind: 'attack', value: 15 }, { kind: 'attack', value: 12 }, { kind: 'buff', name: 'strength', stacks: 2 }, { kind: 'block', value: 8 }] },
    { name: '圣坛傀儡', hp: 60, actions: [{ kind: 'attack', value: 10 }, { kind: 'block', value: 8 }] },
  ],
  ch15: [
    { name: '残党余孽', hp: 35, actions: [{ kind: 'attack', value: 9 }, { kind: 'attack', value: 6 }] },
  ],
  // ===== 第二大章敌人池 =====
  ch16: [
    { name: '荒原游骑', hp: 38, actions: [{ kind: 'attack', value: 10 }, { kind: 'attack', value: 7 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
    { name: '教团斥候', hp: 32, actions: [{ kind: 'attack', value: 8 }, { kind: 'block', value: 6 }] },
  ],
  ch17: [
    { name: '峡谷伏击者', hp: 36, actions: [{ kind: 'attack', value: 9 }, { kind: 'attack', value: 7 }] },
  ],
  ch18: [
    { name: '黑曜守卫', hp: 50, actions: [{ kind: 'attack', value: 12 }, { kind: 'block', value: 8 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
  ],
  ch19: [
    { name: '教团祭司', hp: 55, actions: [{ kind: 'attack', value: 13 }, { kind: 'buff', name: 'strength', stacks: 2 }, { kind: 'block', value: 7 }] },
    { name: '龙骨守卫', hp: 70, actions: [{ kind: 'attack', value: 15 }, { kind: 'attack', value: 10 }, { kind: 'block', value: 8 }] },
  ],
  // ===== 第二大章·卡斯特罗战争敌人池(ch20~ch27) =====
  ch20: [
    { name: '卡斯特罗守军', hp: 42, actions: [{ kind: 'attack', value: 11 }, { kind: 'attack', value: 8 }, { kind: 'block', value: 6 }] },
    { name: '黑鹰巡逻队', hp: 50, actions: [{ kind: 'attack', value: 12 }, { kind: 'block', value: 7 }] },
  ],
  ch21: [
    { name: '前哨哨兵', hp: 38, actions: [{ kind: 'attack', value: 10 }, { kind: 'attack', value: 7 }] },
    { name: '黑甲将军', hp: 65, actions: [{ kind: 'attack', value: 14 }, { kind: 'attack', value: 10 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
  ],
  ch22: [
    { name: '城邦刺客', hp: 40, actions: [{ kind: 'attack', value: 12 }, { kind: 'attack', value: 9 }] },
    { name: '黑鹰杀手', hp: 55, actions: [{ kind: 'attack', value: 13 }, { kind: 'buff', name: 'strength', stacks: 1 }, { kind: 'block', value: 6 }] },
  ],
  ch23: [
    { name: '联军教官', hp: 48, actions: [{ kind: 'attack', value: 11 }, { kind: 'block', value: 8 }] },
    { name: '训练场假人', hp: 60, actions: [{ kind: 'attack', value: 10 }, { kind: 'block', value: 10 }] },
  ],
  ch24: [
    { name: '城主护卫', hp: 52, actions: [{ kind: 'attack', value: 12 }, { kind: 'attack', value: 9 }, { kind: 'block', value: 6 }] },
    { name: '卡斯特罗城主', hp: 85, actions: [{ kind: 'attack', value: 16 }, { kind: 'attack', value: 12 }, { kind: 'buff', name: 'strength', stacks: 2 }, { kind: 'block', value: 8 }] },
  ],
  ch25: [
    { name: '卡斯特罗步兵', hp: 36, actions: [{ kind: 'attack', value: 9 }, { kind: 'attack', value: 7 }] },
    { name: '卡斯特罗弓手', hp: 32, actions: [{ kind: 'attack', value: 11 }, { kind: 'attack', value: 8 }] },
    { name: '弓箭队长', hp: 58, actions: [{ kind: 'attack', value: 14 }, { kind: 'buff', name: 'strength', stacks: 1 }, { kind: 'block', value: 6 }] },
  ],
  ch26: [
    { name: '精锐卫兵', hp: 48, actions: [{ kind: 'attack', value: 12 }, { kind: 'block', value: 7 }] },
    { name: '亲卫将军', hp: 72, actions: [{ kind: 'attack', value: 15 }, { kind: 'attack', value: 11 }, { kind: 'buff', name: 'strength', stacks: 2 }] },
  ],
  ch27: [
    { name: '残余守军', hp: 44, actions: [{ kind: 'attack', value: 10 }, { kind: 'attack', value: 8 }] },
  ],
  // ===== 第三章·龙族突起敌人池 (ch28~ch47) =====
  ch30: [
    { name: '龙息变异兽', hp: 58, actions: [{ kind: 'attack', value: 13 }, { kind: 'attack', value: 9 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
  ],
  ch31: [
    { name: '龙族教徒', hp: 52, actions: [{ kind: 'attack', value: 12 }, { kind: 'block', value: 7 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
    { name: '龙骨召唤师', hp: 48, actions: [{ kind: 'attack', value: 11 }, { kind: 'attack', value: 8 }] },
  ],
  ch33: [
    { name: '洞穴变异体', hp: 62, actions: [{ kind: 'attack', value: 14 }, { kind: 'attack', value: 10 }, { kind: 'block', value: 8 }] },
  ],
  ch37: [
    { name: '古代守卫石像', hp: 80, actions: [{ kind: 'attack', value: 16 }, { kind: 'block', value: 12 }, { kind: 'buff', name: 'strength', stacks: 2 }] },
  ],
  ch39: [
    { name: '龙魂构造体', hp: 75, actions: [{ kind: 'attack', value: 15 }, { kind: 'attack', value: 11 }, { kind: 'block', value: 10 }] },
  ],
  ch41: [
    { name: '龙魂残影', hp: 90, actions: [{ kind: 'attack', value: 18 }, { kind: 'attack', value: 14 }, { kind: 'buff', name: 'strength', stacks: 2 }, { kind: 'block', value: 10 }] },
  ],
  ch43: [
    { name: '龙族石像兵', hp: 85, actions: [{ kind: 'attack', value: 17 }, { kind: 'attack', value: 13 }, { kind: 'block', value: 12 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
  ],
  ch46: [
    { name: '太初近卫', hp: 130, actions: [{ kind: 'attack', value: 22 }, { kind: 'attack', value: 18 }, { kind: 'buff', name: 'strength', stacks: 3 }, { kind: 'block', value: 15 }] },
  ],
  // ===== 经典师职业剧情敌人池 =====
  jd: [
    { name: '训练幻影', hp: 55, actions: [{ kind: 'attack', value: 12 }, { kind: 'attack', value: 9 }, { kind: 'block', value: 7 }] },
  ],
  jd_boss: [
    { name: '古代经典师幻影', hp: 110, actions: [{ kind: 'attack', value: 18 }, { kind: 'attack', value: 14 }, { kind: 'buff', name: 'strength', stacks: 2 }, { kind: 'block', value: 10 }] },
  ],
  // ===== 法师支线敌人池 =====
  fs: [
    { name: '魔力傀儡', hp: 50, actions: [{ kind: 'attack', value: 11 }, { kind: 'attack', value: 8 }, { kind: 'block', value: 6 }] },
  ],
  fsa: [
    { name: '暗影化身', hp: 70, actions: [{ kind: 'attack', value: 14 }, { kind: 'attack', value: 10 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
  ],
  fsb: [
    { name: '光明化身', hp: 70, actions: [{ kind: 'attack', value: 14 }, { kind: 'block', value: 10 }, { kind: 'buff', name: 'strength', stacks: 1 }] },
  ],
};

// ===== 遗物(框架占位,待接入效果系统) =====
export const RELICS = [
  { id: 'burning_blood', name: '燃血',   description: '战斗胜利后回复 6 HP。',   trigger: 'on_battle_victory' },
  { id: 'anchor',        name: '锚',     description: '每回合开始获得 3 护甲。',  trigger: 'on_turn_start' },
  { id: 'vajra',         name: '雷杵',   description: '战斗开始获得 1 力量。',    trigger: 'on_battle_start' },
];

/** 卡牌魔力消耗:稀有牌统一消耗 1 点魔力,可用 mpCost 覆盖 */
export function cardMpCost(card) {
  if (!card) return 0;
  return card.mpCost ?? (card.rarity === 'rare' ? 1 : 0);
}

/**
 * 动态难度:随章节推进逐渐变强,强敌(高 HP)额外增幅。
 * 小怪 → 首领的爬升由调用方按地区进度选择敌人池中的不同条目完成。
 * @param {object} def 敌人定义
 * @param {number} chapterNum 章节序号(1 起)
 */
export function scaleEnemy(def, chapterNum = 1) {
  const chMul = 1 + 0.10 * Math.max(0, chapterNum - 1);
  const eliteMul = def.hp >= 60 ? 1.15 : 1;
  const mul = chMul * eliteMul;
  if (mul === 1) return def;
  return {
    ...def,
    hp: Math.round(def.hp * mul),
    actions: (def.actions || []).map((a) =>
      a.kind === 'attack' ? { ...a, value: Math.round(a.value * mul) } : { ...a }),
  };
}

