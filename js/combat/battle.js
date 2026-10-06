/**
 * Battle — 单场战斗的回合控制器。
 * 流程:开始回合(抽5/补能/清甲) -> 玩家出牌 -> 结束回合 -> 敌人行动 -> 下一回合。
 * 通过 bus 广播 snapshot,UI 据此渲染,无需反向耦合。
 * 支持自动战斗模式:AI 自动选取最优卡牌并结束回合。
 *
 * 群体作战(ch19 之后开启):
 *   · 可同时出现多个敌人(enemies 数组)
 *   · 己方队友(allies)每回合自动攻击敌人
 *   · 玩家可选择攻击目标(selectEnemy)
 *   · 敌人会随机攻击玩家或队友
 */

import { Enemy } from './entity.js?v=20261006c';
import { cardMpCost } from '../data/data.js?v=20261006c';

const STATUS_CN = {
  vulnerable: '易伤',
  weak: '虚弱',
  frail: '脆弱',
  strength: '力量',
};

/** 自动战斗每步延迟(毫秒),让玩家能看清动作 */
const AUTO_STEP_DELAY = 650;

/** 队友模板:弟弟 / 守将 / 朋友 */
const ALLY_TEMPLATES = {
  brother: { name: '弟弟', icon: '🗡', maxHp: 40, atk: 5 },
  general: { name: '守将', icon: '🛡', maxHp: 55, atk: 8 },
  friend:  { name: '同伴', icon: '⚔', maxHp: 45, atk: 6 },
};

export class Battle {
  /**
   * @param {object} opts
   * @param {Player} opts.player
   * @param {Deck} opts.deck
   * @param {object|object[]} [opts.enemyDef] 单个敌人定义(向后兼容)
   * @param {object[]} [opts.enemyDefs] 多个敌人定义(群体作战)
   * @param {string[]} [opts.allyIds] 队友 id 列表(brother/general/friend)
   * @param {Rng} opts.rng
   * @param {EventBus} opts.bus
   * @param {number} [opts.bonusStrength]
   * @param {object} [opts.pet]
   */
  constructor({ player, deck, enemyDef, enemyDefs, allyIds, rng, bus, bonusStrength = 0, pet = null }) {
    this.player = player;
    this.deck = deck;
    this.rng = rng;
    this.bus = bus;
    this.bonusStrength = bonusStrength;
    this.pet = pet;
    this.turn = 0;
    this.over = false;
    this.result = null;
    this._fxQueue = [];
    this.autoMode = false;
    this._autoTimer = null;
    this._autoBusy = false;

    // 敌人:优先使用 enemyDefs(数组);否则用 enemyDef(单个,向后兼容)
    const defs = enemyDefs || (enemyDef ? [enemyDef] : []);
    this.enemies = defs.map((def) => new Enemy(def, rng));
    this.selectedEnemyIndex = 0;

    // 队友:根据 allyIds 创建
    this.allies = (allyIds || []).map((id) => {
      const tpl = ALLY_TEMPLATES[id] || ALLY_TEMPLATES.friend;
      return {
        id,
        name: tpl.name,
        icon: tpl.icon,
        maxHp: tpl.maxHp,
        hp: tpl.maxHp,
        atk: tpl.atk,
        block: 0,
        statuses: {},
      };
    });

    // 群体作战模式:多个敌人或有队友
    this.groupMode = this.enemies.length > 1 || this.allies.length > 0;
  }

  /** 当前选中的敌人(向后兼容) */
  get enemy() {
    return this.enemies[this.selectedEnemyIndex] || this.enemies[0];
  }

  /** 选择攻击目标 */
  selectEnemy(index) {
    if (index >= 0 && index < this.enemies.length && this.enemies[index].isAlive()) {
      this.selectedEnemyIndex = index;
      this._refresh();
    }
  }

  /** 获取存活的敌人列表 */
  _aliveEnemies() {
    return this.enemies.filter((e) => e.isAlive());
  }

  /** 获取存活的队友列表 */
  _aliveAllies() {
    return this.allies.filter((a) => a.hp > 0);
  }

  /** 选中的敌人若已死亡,自动切换到下一个存活敌人 */
  _ensureTarget() {
    if (!this.enemy || !this.enemy.isAlive()) {
      const alive = this._aliveEnemies();
      if (alive.length > 0) {
        this.selectedEnemyIndex = this.enemies.indexOf(alive[0]);
      }
    }
  }

  start() {
    this.deck.reset();
    this.player.clearBlock();
    this.player.resetEnergy();
    this.player.resetMp();
    this.player.statuses = {};
    if (this.bonusStrength > 0) this.player.applyStatus('strength', this.bonusStrength);
    for (const e of this.enemies) {
      e.clearBlock();
      e.rollIntent();
    }
    for (const a of this.allies) {
      a.block = 0;
      a.statuses = {};
    }
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
    // 群体作战:首回合队友先行动
    if (this.groupMode) this._allyTurn();
    this._refresh();
    this._flushFx();
  }

  /** 宠物每回合开始的效果 */
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
        const target = this._aliveEnemies()[0];
        if (target) {
          const dealt = target.takeDamage(sk.amount);
          this._queueFx({ target: 'enemy', kind: 'damage', value: dealt, enemyIndex: this.enemies.indexOf(target) });
          this.bus.emit('battle:log', `${this.pet.name} 扑上去,造成 ${dealt} 伤害`);
        }
      }
    }
  }

  /** 队友回合:每个存活队友自动攻击一个随机存活敌人 */
  _allyTurn() {
    if (!this.groupMode) return;
    for (const ally of this._aliveAllies()) {
      if (this.over) break;
      const targets = this._aliveEnemies();
      if (targets.length === 0) break;
      const target = targets[Math.floor(this.rng.next() * targets.length)];
      const dealt = target.takeDamage(ally.atk);
      this._queueFx({ target: 'enemy', kind: 'damage', value: dealt, enemyIndex: this.enemies.indexOf(target) });
      this.bus.emit('battle:log', `${ally.name} 攻击 ${target.name},造成 ${dealt} 伤害`);
      this._checkEnd();
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
    this._ensureTarget();
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
    for (const a of this.allies) { a.block = 0; }
    this._refresh();
    setTimeout(() => this._enemyTurn(), 350);
  }

  /** 逃离战斗 */
  _escape() {
    if (this.over) return false;
    this.over = true;
    this.result = 'escape';
    this.bus.emit('battle:end', 'escape');
    this._refresh();
    return true;
  }

  /** 敌人回合:所有存活敌人依次行动 */
  _enemyTurn() {
    if (this.over) return;
    for (const enemy of this._aliveEnemies()) {
      if (this.over) break;
      enemy.clearBlock();
      const intent = enemy.intent;
      if (intent) {
        if (intent.kind === 'attack') {
          let dmg = intent.value;
          if (enemy.getStatus('weak') > 0) dmg = Math.floor(dmg * 0.75);
          // 群体模式:敌人有概率攻击队友,否则攻击玩家
          const targets = [{ kind: 'player', obj: this.player }];
          for (const a of this._aliveAllies()) targets.push({ kind: 'ally', obj: a });
          // 30% 概率攻击队友(如果有队友)
          const t = (this.groupMode && this.rng.next() < 0.3 && targets.length > 1)
            ? targets[1 + Math.floor(this.rng.next() * (targets.length - 1))]
            : targets[0];
          const dealt = t.obj.takeDamage(dmg);
          this._queueFx({ target: t.kind, kind: 'damage', value: dealt, allyId: t.kind === 'ally' ? t.obj.id : undefined });
          this.bus.emit('battle:log', `${enemy.name} 攻击 ${t.kind === 'player' ? '你' : t.obj.name},造成 ${dealt} 伤害`);
        } else if (intent.kind === 'block') {
          enemy.addBlock(intent.value);
          this._queueFx({ target: 'enemy', kind: 'block', value: intent.value, enemyIndex: this.enemies.indexOf(enemy) });
          this.bus.emit('battle:log', `${enemy.name} 获得 ${intent.value} 护甲`);
        } else if (intent.kind === 'buff') {
          enemy.applyStatus(intent.name, intent.stacks);
          this.bus.emit('battle:log', `${enemy.name} 强化「${STATUS_CN[intent.name] || intent.name}」`);
        }
      }
      enemy.tickStatuses();
      enemy.rollIntent();
      this._checkEnd();
    }
    if (!this.over) {
      this.turn += 1;
      this.player.resetEnergy();
      this.player.clearBlock();
      this.deck.draw(5);
      this._petTurnStart();
      if (this.groupMode) this._allyTurn();
      this._checkEnd();
      this._refresh();
      if (this.autoMode) this._scheduleAutoStep();
    }
    this._flushFx();
  }

  /** 解释卡牌 effects 并应用(伤害效果作用于当前选中的敌人) */
  _applyEffects(effects) {
    const str = this.player.getStatus('strength');
    const target = this.enemy;
    for (const e of effects) {
      switch (e.kind) {
        case 'damage': {
          if (target) {
            const dealt = target.takeDamage(e.amount + str);
            this._queueFx({ target: 'enemy', kind: 'damage', value: dealt, enemyIndex: this.selectedEnemyIndex });
          }
          break;
        }
        case 'block':
          this.player.addBlock(e.amount);
          this._queueFx({ target: 'player', kind: 'block', value: e.amount });
          break;
        case 'status_enemy':
          if (target) {
            target.applyStatus(e.name, e.stacks);
            this.bus.emit('battle:log', `${target.name} 被施加「${STATUS_CN[e.name] || e.name}」×${e.stacks}`);
          }
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

  _queueFx(fx) {
    if (fx && fx.value) this._fxQueue.push(fx);
  }

  _flushFx() {
    if (this._fxQueue.length === 0) return;
    const queue = this._fxQueue;
    this._fxQueue = [];
    for (const fx of queue) this.bus.emit('battle:fx', fx);
  }

  _checkEnd() {
    if (this._aliveEnemies().length === 0) {
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

  _autoStep() {
    if (!this.autoMode || this.over) return;
    this._autoBusy = true;
    try {
      const card = this._pickAutoCard();
      if (card) {
        // 自动战斗:优先攻击血量最低的敌人
        this._autoSelectWeakestEnemy();
        this.playCard(card);
        this._scheduleAutoStep();
      } else {
        this.endPlayerTurn();
      }
    } finally {
      this._autoBusy = false;
    }
  }

  /** 自动战斗:选中血量最低的存活敌人 */
  _autoSelectWeakestEnemy() {
    const alive = this._aliveEnemies();
    if (alive.length === 0) return;
    let weakest = alive[0];
    for (const e of alive) {
      if (e.hp < weakest.hp) weakest = e;
    }
    this.selectedEnemyIndex = this.enemies.indexOf(weakest);
  }

  _pickAutoCard() {
    const hand = this.deck.hand;
    if (!hand.length) return null;
    const energy = this.player.energy;
    const mp = this.player.mp;

    const playable = hand.filter((c) => {
      const mpCost = cardMpCost(c);
      return c.cost <= energy && mpCost <= mp;
    });
    if (!playable.length) return null;

    const hpRatio = this.player.hp / this.player.maxHp;
    const enemy = this.enemy;
    const enemyVuln = enemy ? enemy.getStatus('vulnerable') > 0 : false;
    const intent = enemy?.intent;
    const incomingDmg = intent?.kind === 'attack' ? intent.value : 0;
    const effectiveIncoming = incomingDmg - this.player.block;

    if (hpRatio < 0.35) {
      const heal = this._bestByEffect(playable, 'heal');
      if (heal) return heal;
    }

    if (effectiveIncoming > this.player.maxHp * 0.25) {
      const block = this._bestByEffect(playable, 'block');
      if (block) return block;
    }

    if (enemyVuln) {
      const atk = this._bestAttack(playable);
      if (atk) return atk;
    }

    const atk = this._bestAttack(playable);
    if (atk) return atk;
    const block = this._bestByEffect(playable, 'block');
    if (block) return block;
    return playable[0];
  }

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

  snapshot() {
    return {
      turn: this.turn,
      over: this.over,
      result: this.result,
      groupMode: this.groupMode,
      selectedEnemyIndex: this.selectedEnemyIndex,
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
      enemies: this.enemies.map((e, i) => ({
        index: i,
        name: e.name,
        hp: e.hp,
        maxHp: e.maxHp,
        block: e.block,
        intent: e.intent ? { ...e.intent } : null,
        statuses: { ...e.statuses },
        alive: e.isAlive(),
      })),
      // 向后兼容:单敌人快照
      enemy: this.enemy ? {
        name: this.enemy.name,
        hp: this.enemy.hp,
        maxHp: this.enemy.maxHp,
        block: this.enemy.block,
        intent: this.enemy.intent ? { ...this.enemy.intent } : null,
        statuses: { ...this.enemy.statuses },
      } : null,
      allies: this.allies.map((a) => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        hp: a.hp,
        maxHp: a.maxHp,
        block: a.block,
        atk: a.atk,
        alive: a.hp > 0,
      })),
      pet: this.pet ? { name: this.pet.name, icon: this.pet.icon, skills: (this.pet.skills || []).slice() } : null,
      hand: this.deck.hand.slice(),
      drawCount: this.deck.drawPile.length,
      discardCount: this.deck.discardPile.length,
    };
  }
}
