/**
 * economy.js — 经济与物资系统:金币 / 背包 / 装备 / 行动力。
 *
 * 与战斗的边界:
 *   · 行动力(AP)用于地图旅行与打工,属于战斗外资源
 *   · 魔力(MP)、生命(HP)属于玩家实体(Player),由药品恢复
 *   · 战力(power)由武器/服饰加成,开战时折算为力量,并叠加战力药剂的临时加成
 */

import { ITEMS, sellPrice } from '../data/items.js?v=20260929k';
import { TRAVEL_BASE_COST } from '../data/regions.js?v=20260929k';

const SLOTS = ['weapon', 'outfit', 'vehicle'];

export class Economy {
  constructor({ gold = 40, apMax = 10 } = {}) {
    this.gold = gold;
    this.apMax = apMax;
    this.ap = apMax;
    this.bag = new Map();            // itemId -> qty
    this.equipped = { weapon: null, outfit: null, vehicle: null };
    this.pendingPower = 0;           // 战力药剂:下一场战斗生效
  }

  // ===== 背包 =====
  count(id) { return this.bag.get(id) || 0; }
  has(id, qty = 1) { return this.count(id) >= qty; }

  addItem(id, qty = 1) {
    if (!ITEMS[id]) return false;
    this.bag.set(id, this.count(id) + qty);
    return true;
  }

  removeItem(id, qty = 1) {
    const cur = this.count(id);
    if (cur < qty) return false;
    if (cur === qty) this.bag.delete(id);
    else this.bag.set(id, cur - qty);
    return true;
  }

  /** 丢弃(直接销毁) */
  dropItem(id, qty = 1) { return this.removeItem(id, qty); }

  /** 出售一件,换回金币 */
  sell(id) {
    if (!this.removeItem(id, 1)) return false;
    this.gold += sellPrice(id);
    return true;
  }

  /** 从商店购买一件 */
  buy(id) {
    const it = ITEMS[id];
    if (!it) return false;
    if (this.gold < it.price) return false;
    this.gold -= it.price;
    this.addItem(id, 1);
    return true;
  }

  // ===== 装备 =====
  isEquipped(id) { return SLOTS.some((s) => this.equipped[s] === id); }

  equip(id) {
    const it = ITEMS[id];
    if (!it || !it.equipment) return false;
    const slot = it.equipment.slot;
    if (!this.removeItem(id, 1)) return false;      // 从背包取出
    const prev = this.equipped[slot];
    this.equipped[slot] = id;
    if (prev) this.addItem(prev, 1);                 // 旧装备回到背包
    return true;
  }

  unequip(slot) {
    const id = this.equipped[slot];
    if (!id) return false;
    this.equipped[slot] = null;
    this.addItem(id, 1);
    return true;
  }

  /** 汇总装备加成 */
  equipStats() {
    const total = { atkPower: 0, maxHp: 0, maxMp: 0, apMax: 0, travelDiscount: 0 };
    for (const slot of SLOTS) {
      const id = this.equipped[slot];
      const st = id && ITEMS[id]?.equipment?.stats;
      if (!st) continue;
      for (const k of Object.keys(total)) total[k] += st[k] || 0;
    }
    return total;
  }

  // ===== 行动力 =====
  apCap() { return this.apMax + this.equipStats().apMax; }

  addAp(n) {
    const cap = this.apCap();
    const before = this.ap;
    this.ap = Math.max(0, Math.min(cap, this.ap + n));
    return this.ap - before;
  }

  spendAp(n) {
    if (this.ap < n) return false;
    this.ap -= n;
    return true;
  }

  /** 两点之间的旅行消耗(受载具折扣影响,至少 1) */
  travelCost(i, j) {
    const base = Math.abs(i - j) * TRAVEL_BASE_COST;
    return Math.max(1, base - this.equipStats().travelDiscount);
  }

  /** 当前载具的旅途耗时倍率(越小越快;未装备载具 = 1) */
  travelSpeedMul() {
    const id = this.equipped.vehicle;
    const mul = id ? ITEMS[id]?.speedMul : 1;
    return typeof mul === 'number' && mul > 0 ? mul : 1;
  }

  /** 当前载具名称(未装备则返回 null) */
  vehicleName() {
    const id = this.equipped.vehicle;
    return id ? ITEMS[id]?.name || id : null;
  }

  /** 当前载具可通行的地形列表(未装备 -> null,表示徒步不受限) */
  vehicleTerrain() {
    const id = this.equipped.vehicle;
    const t = id ? ITEMS[id]?.terrain : null;
    return Array.isArray(t) ? t : null;
  }

  /** 当前载具能否抵达该地形的地区(徒步恒可) */
  vehicleCanReach(terrain) {
    const t = this.vehicleTerrain();
    return !t || t.includes(terrain);
  }

  // ===== 使用消耗品 =====
  /**
   * 使用物品。
   * @returns {{ok:boolean, msg:string}}
   */
  useItem(id, player) {
    const it = ITEMS[id];
    if (!it || !it.effect) return { ok: false, msg: '此物无法使用' };
    if (!this.has(id)) return { ok: false, msg: '背包里没有这件物品' };
    const { kind, amount } = it.effect;
    let msg = '';
    switch (kind) {
      case 'heal': {
        if (player.hp >= player.maxHp) return { ok: false, msg: '生命已满,无需用药' };
        const before = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + amount);
        msg = `恢复了 ${player.hp - before} 点生命`;
        break;
      }
      case 'mp': {
        if (player.mp >= player.maxMp) return { ok: false, msg: '魔力已满,无需用药' };
        const before = player.mp;
        player.mp = Math.min(player.maxMp, player.mp + amount);
        msg = `恢复了 ${player.mp - before} 点魔力`;
        break;
      }
      case 'ap': {
        if (this.ap >= this.apCap()) return { ok: false, msg: '行动力已满' };
        const got = this.addAp(amount);
        msg = `恢复了 ${got} 点行动力`;
        break;
      }
      case 'power': {
        this.pendingPower += amount;
        msg = `下场战斗战力 +${amount}`;
        break;
      }
      default:
        return { ok: false, msg: '此物无法使用' };
    }
    this.removeItem(id, 1);
    return { ok: true, msg: `使用「${it.name}」,${msg}` };
  }

  /** 开战时取出一次性战力加成(取后清零) */
  consumePendingPower() {
    const p = this.pendingPower;
    this.pendingPower = 0;
    return p;
  }

  // ===== 存档快照(用于调试 / 结算展示)=====
  snapshot() {
    return {
      gold: this.gold,
      ap: this.ap,
      apMax: this.apCap(),
      bag: [...this.bag.entries()].map(([id, qty]) => ({ id, qty })),
      equipped: { ...this.equipped },
    };
  }
}
