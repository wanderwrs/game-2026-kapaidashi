/**
 * Entity — 战斗实体基类(玩家/敌人共用)。
 * 维护 HP / 护甲 / 状态,提供 takeDamage / applyStatus / 状态衰减。
 *
 * 状态(vulnerable/weak/frail)每回合自然衰减 1 层;
 * strength 为永久加成,不衰减。
 */

export class Entity {
  constructor({ maxHp = 50, hp } = {}) {
    this.maxHp = maxHp;
    this.hp = hp ?? maxHp;
    this.block = 0;
    this.statuses = {}; // name -> stacks
  }

  isAlive() {
    return this.hp > 0;
  }

  addBlock(n) {
    this.block += n;
  }

  clearBlock() {
    this.block = 0;
  }

  applyStatus(name, stacks) {
    this.statuses[name] = (this.statuses[name] || 0) + stacks;
  }

  getStatus(name) {
    return this.statuses[name] || 0;
  }

  /** 受伤:先经 vulnerable 修正,再由护甲吸收 */
  takeDamage(amount) {
    let dmg = amount;
    if (this.getStatus('vulnerable') > 0) {
      dmg = Math.floor(dmg * 1.5);
    }
    if (this.block > 0) {
      const absorbed = Math.min(this.block, dmg);
      this.block -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) {
      this.hp = Math.max(0, this.hp - dmg);
    }
    return dmg;
  }

  /** 回合结束时,衰减临时状态 */
  tickStatuses() {
    const decayable = ['vulnerable', 'weak', 'frail'];
    for (const name of decayable) {
      if (this.statuses[name]) {
        this.statuses[name] -= 1;
        if (this.statuses[name] <= 0) delete this.statuses[name];
      }
    }
  }
}

export class Player extends Entity {
  constructor(opts = {}) {
    super({ maxHp: opts.maxHp ?? 70 });
    this.energy = 0;
    this.energyMax = opts.energyMax ?? 3;
  }

  resetEnergy() {
    this.energy = this.energyMax;
  }
}

export class Enemy extends Entity {
  constructor(def, rng) {
    // 精英/ Boss 可调 HP 倍率
    const hp = typeof def.hp === 'function' ? def.hp(rng) : def.hp;
    super({ maxHp: hp });
    this.def = def;
    this.name = def.name;
    this.rng = rng;
    this.intent = null;
  }

  /** 根据 def.actions 随机滚动一个意图 */
  rollIntent() {
    const actions = this.def.actions || [];
    if (actions.length === 0) {
      this.intent = null;
      return;
    }
    this.intent = this.rng.pick(actions);
  }
}
