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
  ],
};

// ===== 遗物(框架占位,待接入效果系统) =====
export const RELICS = [
  { id: 'burning_blood', name: '燃血',   description: '战斗胜利后回复 6 HP。',   trigger: 'on_battle_victory' },
  { id: 'anchor',        name: '锚',     description: '每回合开始获得 3 护甲。',  trigger: 'on_turn_start' },
  { id: 'vajra',         name: '金刚杵', description: '战斗开始获得 1 力量。',    trigger: 'on_battle_start' },
];
