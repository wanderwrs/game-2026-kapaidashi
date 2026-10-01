/**
 * Battle — 单场战斗的回合控制器。
 * 流程:开始回合(抽5/补能/清甲) -> 玩家出牌 -> 结束回合 -> 敌人行动 -> 下一回合。
 * 通过 bus 广播 snapshot,UI 据此渲染,无需反向耦合。
 * 支持自动战斗模式:AI 自动选取最优卡牌并结束回合。
 */

import { Enemy } from './entity.js?v=20261001e';
import { cardMpCost } from '../data/data.js?v=20261001e';

const STATUS_CN = {
  vulnerable: '易伤',
  weak: '虚弱',
  frail: '脆弱',
  strength: '力量',
};

/** 自动战斗每步延迟(毫秒),让玩家能看清动作 */
const AUTO_STEP_DELAY = 650;

export class Battle {
  constructor({ player, deck, enemyDef, rng, bus, bonusStrength = 0, pet = null }) {
    this.player = player;
    this.deck = deck;
    this.enemy = new Enemy(enemyDef, rng);
    this.rng = rng;
    this.bus = bus;
    this.bonusStrength = bonusStrength;   // 装备战力 + 战力药剂
    this.pet = pet;                       // 出战宠物 { name, icon, skills:[{kind,amount}] }
    this.turn = 0;
    this.over = false;
    this.result = null;
    this._fxQueue = [];   // 伤害飘字等特效,待 DOM 刷新后再广播
    this.autoMode = false;        // 自动战斗开关
    this._autoTimer = null;       // 自动战斗定时器
    this._autoBusy = false;       // 防止自动逻辑重入
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
    if (this.pet) {
      for (const sk of this.pet.skills || []) {
        if (sk.kind === 'atk_up') this.player.applyStatus('strength', sk.amount);
      }
      this.bus.emit('battle:log', `【${this.pet.name}】随你出战`);
      this._petTurnStart();
      this._checkEnd();
    }
    this._refresh();
    this._flushFx();
  }

  /** 宠物每回合开始的效果:回血 / 回蓝 / 自动攻击 */
  _petTurnStart() {
    if (!this.pet || this.over) return;
    for (const sk of this.pet.skills || []) {
      if (sk.kind === 'heal') {
        const before = this.player.hp;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + sk.amount);
        if (this.player.hp > before) this._queueFx({ target: 'player', kind: 'heal', value: this.player.hp - before });
      } else if (sk.kind === 'mp_regen') {
        this.player.mp = Math.min(this.player.maxMp, this.player.mp + sk.amount);
      } else if (sk.kind === 'auto_attack') {
        const dealt = this.enemy.takeDamage(sk.amount);
        this._queueFx({ target: 'enemy', kind: 'damage', value: dealt });
        this.bus.emit('battle:log', `${this.pet.name} 扑上去,造成 ${dealt} 伤害`);
      }
    }
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

  /** 逃离战斗(仅遭遇战有效;由烟雾弹触发) */
  _escape() {
    if (this.over) return false;
    this.over = true;
    this.result = 'escape';
    this.bus.emit('battle:end', 'escape');
    this._refresh();
    return true;
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
      this._petTurnStart();
      this._checkEnd();
      this._refresh();
      // 自动战斗:新回合开始后继续
      if (this.autoMode) this._scheduleAutoStep();
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
      this._clearAutoTimer();
      this.bus.emit('battle:end', 'victory');
    } else if (!this.player.isAlive()) {
      this.over = true;
      this.result = 'defeat';
      this._clearAutoTimer();
      this.bus.emit('battle:end', 'defeat');
    }
  }

  // ===== 自动战斗 =====
  /** 开启 / 关闭自动战斗 */
  setAutoMode(on) {
    this.autoMode = !!on;
    if (this.autoMode) {
      this.bus.emit('battle:log', '自动战斗已开启');
      this._scheduleAutoStep();
    } else {
      this.bus.emit('battle:log', '自动战斗已关闭');
      this._clearAutoTimer();
    }
  }

  _clearAutoTimer() {
    if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
  }

  _scheduleAutoStep() {
    if (!this.autoMode || this.over || this._autoBusy) return;
    this._clearAutoTimer();
    this._autoTimer = setTimeout(() => this._autoStep(), AUTO_STEP_DELAY);
  }

  /** 自动战斗单步:选出最优牌打出,无牌可出则结束回合 */
  _autoStep() {
    if (!this.autoMode || this.over) return;
    this._autoBusy = true;
    try {
      const card = this._pickAutoCard();
      if (card) {
        this.playCard(card);
        this._scheduleAutoStep();
      } else {
        // 没有可出的牌 → 结束回合
        this.endPlayerTurn();
        // 结束回合后 _enemyTurn 会触发下一回合;在 _refresh 后再调度
      }
    } finally {
      this._autoBusy = false;
    }
  }

  /**
   * AI 选牌策略:
   * 1. 生命危险(<35%)且有治疗牌 → 优先治疗
   * 2. 敌人意图高伤攻击 且 自身护甲不足 → 优先防御
   * 3. 敌人有易伤 → 优先高伤攻击
   * 4. 否则按「伤害/费用比」选攻击牌,其次防御牌
   */
  _pickAutoCard() {
    const hand = this.deck.hand;
    if (!hand.length) return null;
    const energy = this.player.energy;
    const mp = this.player.mp;

    // 可出的牌(能量 + 魔力足够)
    const playable = hand.filter((c) => {
      const mpCost = cardMpCost(c);
      return c.cost <= energy && mpCost <= mp;
    });
    if (!playable.length) return null;

    const hpRatio = this.player.hp / this.player.maxHp;
    const intent = this.enemy.intent;
    const enemyVuln = this.enemy.getStatus('vulnerable') > 0;
    const incomingDmg = intent?.kind === 'attack' ? intent.value : 0;
    const effectiveIncoming = incomingDmg - this.player.block;

    // 1) 危险时优先治疗
    if (hpRatio < 0.35) {
      const heal = this._bestByEffect(playable, 'heal');
      if (heal) return heal;
    }

    // 2) 高伤来袭且护甲不足 → 优先防御
    if (effectiveIncoming > this.player.maxHp * 0.25) {
      const block = this._bestByEffect(playable, 'block');
      if (block) return block;
    }

    // 3) 敌人易伤 → 优先高伤攻击
    if (enemyVuln) {
      const atk = this._bestAttack(playable);
      if (atk) return atk;
    }

    // 4) 默认:选最高伤害攻击牌;没有则选防御;再没有则随便出
    const atk = this._bestAttack(playable);
    if (atk) return atk;
    const block = this._bestByEffect(playable, 'block');
    if (block) return block;
    // 兜底:出第一张能出的牌
    return playable[0];
  }

  /** 在可出的牌中找某类效果数值最高的牌 */
  _bestByEffect(cards, kind) {
    let best = null, bestVal = -1;
    for (const c of cards) {
      const eff = (c.effects || []).find((e) => e.kind === kind);
      if (!eff) continue;
      const val = eff.amount || 0;
      if (val > bestVal) { bestVal = val; best = c; }
    }
    return best;
  }

  /** 在可出的牌中找总伤害最高的攻击牌 */
  _bestAttack(cards) {
    let best = null, bestDmg = -1;
    for (const c of cards) {
      const dmg = (c.effects || [])
        .filter((e) => e.kind === 'damage')
        .reduce((s, e) => s + (e.amount || 0), 0);
      if (dmg > bestDmg) { bestDmg = dmg; best = c; }
    }
    return best;
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
      pet: this.pet ? { name: this.pet.name, icon: this.pet.icon, skills: (this.pet.skills || []).slice() } : null,
      hand: this.deck.hand.slice(),
      drawCount: this.deck.drawPile.length,
      discardCount: this.deck.discardPile.length,
    };
  }
}
