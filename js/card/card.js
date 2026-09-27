/**
 * Card — 卡牌定义的运行时实例。
 * 数据驱动:效果用结构化 effects 数组表达,Battle 负责解释执行。
 * 新增卡牌只需在 data.js 补一条定义,无需改逻辑。
 *
 * effect 形态(可扩展):
 *   { kind: 'damage',     amount: 6 }
 *   { kind: 'block',      amount: 5 }
 *   { kind: 'status_enemy', name: 'vulnerable', stacks: 2 }
 *   { kind: 'status_self',  name: 'strength',   stacks: 1 }
 *   { kind: 'heal',       amount: 8 }
 *   { kind: 'draw',       amount: 1 }
 */

export class Card {
  constructor(def) {
    this.id = def.id;
    this.name = def.name;
    this.cost = def.cost ?? 0;
    this.type = def.type ?? 'attack'; // attack | skill | power
    this.description = def.description ?? '';
    this.effects = def.effects ?? [];
    this.rarity = def.rarity ?? 'common';
    this.uid = `${def.id}-${Math.random().toString(36).slice(2, 8)}`;
  }

  static create(def) {
    return new Card(def);
  }
}
