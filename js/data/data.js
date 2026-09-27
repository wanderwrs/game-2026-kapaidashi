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
};

// 起始牌组(10 张,以 id 引用 CARDS)
export const STARTER_DECK = [
  'strike', 'strike', 'strike', 'strike', 'strike',
  'defend', 'defend', 'defend', 'defend',
  'cleave',
];

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
};

// ===== 遗物(框架占位,待接入效果系统) =====
export const RELICS = [
  { id: 'burning_blood', name: '燃血',   description: '战斗胜利后回复 6 HP。',   trigger: 'on_battle_victory' },
  { id: 'anchor',        name: '锚',     description: '每回合开始获得 3 护甲。',  trigger: 'on_turn_start' },
  { id: 'vajra',         name: '金刚杵', description: '战斗开始获得 1 力量。',    trigger: 'on_battle_start' },
];
