/**
 * Battle — 单场战斗的回合控制器。
 * 流程:开始回合(抽5/补能/清甲) -> 玩家出牌 -> 结束回合 -> 敌人行动 -> 下一回合。
 * 通过 bus 广播 snapshot,UI 据此渲染,无需反向耦合。
 */

import { Enemy } from './entity.js?v=20260929h';
import { cardMpCost } from '../data/data.js?v=20260929h';

const STATUS_CN = {
  vulnerable: '易伤',
  weak: '虚弱',
  frail: '脆弱',
  strength: '力量',
};

export class Battle {
  constructor({ player, deck, enemyDef, rng, bus, bonusStrength = 0 }) {
    this.player = player;
    this.deck = deck;
    this.enemy = new Enemy(enemyDef, rng);
    this.rng = rng;
    this.bus = bus;
    this.bonusStrength = bonusStrength;   // 装备战力 + 战力药剂
    this.turn = 0;
    this.over = false;
    this.result = null;
    this._fxQueue = [];   // 伤害飘字等特效,待 DOM 刷新后再广播
  }

  start() {
    this.deck.reset();
    this.player.clearBlock();
    this.player.resetEnergy();
    this.player.resetMp();
    this.player.statuses = {};   // 状态为战斗内资源,开战清零
    if (this.bonusStrength > 0) this.player.applyStatus('strength', this.bonusStrength);
    this.enemy.clearBlock();
    this.enemy.rollIntent();
    this.deck.draw(5);
    this.turn = 1;
    this._refresh();
  }

  /** 玩家打出一张手牌 */
  playCard(card) {
    if (this.over) return false;
    if (!this.deck.hand.includes(card)) return false;
    const mpCost = cardMpCost(card);
    if (this.player.energy < card.cost) {
      this.bus.emit('battle:log', '能量不足,无法打出该牌');
      return false;
    }
    if (mpCost > 0 && this.player.mp < mpCost) {
      this.bus.emit('battle:log', '魔力不足,无法打出该牌');
      return false;
    }
    this.player.energy -= card.cost;
    if (mpCost > 0) this.player.mp -= mpCost;
    this._applyEffects(card.effects);
    this.deck.discard(card);
    this.bus.emit('battle:log', `打出 ${card.name}`);
    this._checkEnd();
    this._refresh();
    this._flushFx();
    return true;
  }

  /** 玩家结束回合 */
  endPlayerTurn() {
    if (this.over) return;
    this.deck.discardHand();
    this.player.clearBlock();
    this.player.tickStatuses();
    this._refresh();
    // 留一点延迟,让 UI 能呈现"敌人即将行动"
    setTimeout(() => this._enemyTurn(), 350);
  }

  _enemyTurn() {
    if (this.over) return;
    this.enemy.clearBlock();
    const intent = this.enemy.intent;
    if (intent) {
      if (intent.kind === 'attack') {
        let dmg = intent.value;
        if (this.enemy.getStatus('weak') > 0) dmg = Math.floor(dmg * 0.75);
        const dealt = this.player.takeDamage(dmg);
        this._queueFx({ target: 'player', kind: 'damage', value: dealt });
        this.bus.emit('battle:log', `${this.enemy.name} 攻击,造成 ${dealt} 伤害`);
      } else if (intent.kind === 'block') {
        this.enemy.addBlock(intent.value);
        this._queueFx({ target: 'enemy', kind: 'block', value: intent.value });
        this.bus.emit('battle:log', `${this.enemy.name} 获得 ${intent.value} 护甲`);
      } else if (intent.kind === 'buff') {
        this.enemy.applyStatus(intent.name, intent.stacks);
        this.bus.emit('battle:log', `${this.enemy.name} 强化「${STATUS_CN[intent.name] || intent.name}」`);
      }
    }
    this.enemy.tickStatuses();
    this.enemy.rollIntent();
    this._checkEnd();
    if (!this.over) {
      this.turn += 1;
      this.player.resetEnergy();
      this.player.clearBlock();
      this.deck.draw(5);
      this._refresh();
    }
    this._flushFx();
  }

  /** 解释卡牌 effects 并应用 */
  _applyEffects(effects) {
    const str = this.player.getStatus('strength');
    for (const e of effects) {
      switch (e.kind) {
        case 'damage': {
          const dealt = this.enemy.takeDamage(e.amount + str);
          this._queueFx({ target: 'enemy', kind: 'damage', value: dealt });
          break;
        }
        case 'block':
          this.player.addBlock(e.amount);
          this._queueFx({ target: 'player', kind: 'block', value: e.amount });
          break;
        case 'status_enemy':
          this.enemy.applyStatus(e.name, e.stacks);
          this.bus.emit('battle:log', `${this.enemy.name} 被施加「${STATUS_CN[e.name] || e.name}」×${e.stacks}`);
          break;
        case 'status_self':
          this.player.applyStatus(e.name, e.stacks);
          this.bus.emit('battle:log', `你获得「${STATUS_CN[e.name] || e.name}」×${e.stacks}`);
          break;
        case 'heal': {
          const before = this.player.hp;
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + e.amount);
          this._queueFx({ target: 'player', kind: 'heal', value: this.player.hp - before });
          break;
        }
        case 'draw':
          this.deck.draw(e.amount);
          break;
        default:
          this.bus.emit('battle:log', `未知效果: ${e.kind}`);
      }
    }
  }

  /** 入队一条战斗特效(待 DOM 刷新后再广播,避免被重建清掉) */
  _queueFx(fx) {
    if (fx && fx.value) this._fxQueue.push(fx);
  }

  /** 广播已入队的特效 */
  _flushFx() {
    if (this._fxQueue.length === 0) return;
    const queue = this._fxQueue;
    this._fxQueue = [];
    for (const fx of queue) this.bus.emit('battle:fx', fx);
  }

  _checkEnd() {
    if (!this.enemy.isAlive()) {
      this.over = true;
      this.result = 'victory';
      this.bus.emit('battle:end', 'victory');
    } else if (!this.player.isAlive()) {
      this.over = true;
      this.result = 'defeat';
      this.bus.emit('battle:end', 'defeat');
    }
  }

  _refresh() {
    this.bus.emit('battle:refresh', this.snapshot());
  }

  /** 供 UI 渲染的不可变快照 */
  snapshot() {
    return {
      turn: this.turn,
      over: this.over,
      result: this.result,
      player: {
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        block: this.player.block,
        energy: this.player.energy,
        energyMax: this.player.energyMax,
        mp: this.player.mp,
        maxMp: this.player.maxMp,
        statuses: { ...this.player.statuses },
      },
      enemy: {
        name: this.enemy.name,
        hp: this.enemy.hp,
        maxHp: this.enemy.maxHp,
        block: this.enemy.block,
        intent: this.enemy.intent ? { ...this.enemy.intent } : null,
        statuses: { ...this.enemy.statuses },
      },
      hand: this.deck.hand.slice(),
      drawCount: this.deck.drawPile.length,
      discardCount: this.deck.discardPile.length,
    };
  }
}
