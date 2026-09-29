/**
 * economy.js — 经济与物资系统:金币 / 背包 / 装备 / 行动力。
 *
 * 与战斗的边界:
 *   · 行动力(AP)用于地图旅行与打工,属于战斗外资源
 *   · 魔力(MP)、生命(HP)属于玩家实体(Player),由药品恢复
 *   · 战力(power)由武器/服饰加成,开战时折算为力量,并叠加战力药剂的临时加成
 *
 * 装备槽位(共 6 个):weapon 武器 / hat 帽子 / top 衣服 / bottom 裤子 / shoes 鞋子 / vehicle 载具
 * 服饰四件可自由混搭;其中「皇帝的新衣」系列 hide=true,穿上后对应部位在像素人物上不可见。
 */

import { ITEMS, sellPrice, tokenPrice } from '../data/items.js?v=20260929w';
import { TRAVEL_BASE_COST } from '../data/regions.js?v=20260929w';

const SLOTS = ['weapon', 'hat', 'top', 'bottom', 'shoes', 'vehicle'];
const OUTFIT_SLOTS = ['hat', 'top', 'bottom', 'shoes'];

export class Economy {
  constructor({ gold = 40, apMax = 10 } = {}) {
    this.gold = gold;
    this.apMax = apMax;
    this.ap = apMax;
    this.bag = new Map();            // itemId -> qty
    this.equipped = { weapon: null, hat: null, top: null, bottom: null, shoes: null, vehicle: null };
    this.pendingPower = 0;           // 战力药剂:下一场战斗生效
    this.hasteRest = 0;              // 剩余「缩短休息耗时」次数
    this.hasteTravel = 0;            // 剩余「缩短旅途耗时」次数
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

  /** 从商店购买一件(实际价格受服饰折扣影响) */
  buy(id) {
    const it = ITEMS[id];
    if (!it) return false;
    const price = this.itemPrice(id);
    if (this.gold < price) return false;
    this.gold -= price;
    this.addItem(id, 1);
    return true;
  }

  // ===== 市场 / 专属交易场所(买卖均额外收管理费) =====
  /** 市场买入价:原价 + 管理费 */
  marketBuyPrice(id, fee = 0) {
    const it = ITEMS[id];
    if (!it) return 0;
    return Math.max(1, Math.round((it.price || 0) * (1 + fee)));
  }

  /** 市场卖出净得:售价 − 管理费 */
  marketSellPrice(id, fee = 0) {
    return Math.max(1, Math.round(sellPrice(id) * (1 - fee)));
  }

  marketBuy(id, fee = 0) {
    if (!ITEMS[id]) return false;
    const price = this.marketBuyPrice(id, fee);
    if (this.gold < price) return false;
    this.gold -= price;
    return this.addItem(id, 1);
  }

  marketSell(id, fee = 0) {
    if (!this.removeItem(id, 1)) return false;
    this.gold += this.marketSellPrice(id, fee);
    return true;
  }

  /** 专属场所标价:以特殊币计价,再叠加该场所的管理费 */
  venuePrice(id, fee = 0) {
    const base = tokenPrice(id);
    if (!base) return 0;
    return Math.max(1, Math.round(base * (1 + fee)));
  }

  /** 用特殊币兑换;tokenId 为该场所认的币种 */
  venueBuy(id, tokenId, fee = 0) {
    if (!ITEMS[id] || !ITEMS[tokenId]) return false;
    const price = this.venuePrice(id, fee);
    if (this.count(tokenId) < price) return false;
    this.removeItem(tokenId, price);
    return this.addItem(id, 1);
  }

  /** 背包里各交易币的数量([{id,name,icon,qty}],只收 token 分类) */
  tokens() {
    const out = [];
    for (const [id, qty] of this.bag.entries()) {
      const it = ITEMS[id];
      if (it && it.category === 'token' && qty > 0) out.push({ id, name: it.name, icon: it.icon || '🪙', qty });
    }
    return out;
  }

  // ===== 加速恢复(药水):缩短之后若干次休息 / 旅途的真实耗时 =====
  /** 消耗一次「休息加速」,有则返回 true */
  consumeRestHaste() {
    if (this.hasteRest <= 0) return false;
    this.hasteRest -= 1;
    return true;
  }

  /** 消耗一次「旅途加速」,有则返回 true */
  consumeTravelHaste() {
    if (this.hasteTravel <= 0) return false;
    this.hasteTravel -= 1;
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
    const total = { atkPower: 0, maxHp: 0, maxMp: 0, apMax: 0, travelDiscount: 0, shopDiscount: 0, goldBonus: 0, restBonus: 0 };
    for (const slot of SLOTS) {
      const id = this.equipped[slot];
      const st = id && ITEMS[id]?.equipment?.stats;
      if (!st) continue;
      for (const k of Object.keys(total)) total[k] += st[k] || 0;
    }
    return total;
  }

  // ===== 服饰增益 =====
  /** 商店折扣比例(0~0.5) */
  shopDiscount() { return Math.min(0.5, this.equipStats().shopDiscount); }

  /** 金币收益倍率加成(0~1,叠加后封顶 100%) */
  goldBonus() { return Math.min(1, this.equipStats().goldBonus); }

  /** 休息时额外恢复的行动力 */
  restBonus() { return this.equipStats().restBonus; }

  /** 商店实际售价(应用折扣,至少 1) */
  itemPrice(id) {
    const it = ITEMS[id];
    if (!it) return 0;
    return Math.max(1, Math.round((it.price || 0) * (1 - this.shopDiscount())));
  }

  /**
   * 当前人物外观(供 ui/scene.js 绘制像素小人)。
   * 返回的字段优先于职业默认配色;hide* 为 true 表示该部位被「皇帝的新衣」隐藏。
   */
  appearance() {
    const a = {
      cloth: null, cloth2: null, trim: null, pants: null, boot: null,
      hat: null, hatHi: null, hatStyle: null,
      hideTop: false, hideBottom: false, hideShoes: false, hideHat: false,
      label: null,
    };
    const top = ITEMS[this.equipped.top];
    if (top) {
      if (top.hide) a.hideTop = true;
      else if (top.look) { a.cloth = top.look.cloth ?? null; a.cloth2 = top.look.cloth2 ?? null; a.trim = top.look.trim ?? null; }
    }
    const bottom = ITEMS[this.equipped.bottom];
    if (bottom) {
      if (bottom.hide) a.hideBottom = true;
      else if (bottom.look?.pants) a.pants = bottom.look.pants;
    }
    const shoes = ITEMS[this.equipped.shoes];
    if (shoes) {
      if (shoes.hide) a.hideShoes = true;
      else if (shoes.look?.boot) a.boot = shoes.look.boot;
    }
    const hat = ITEMS[this.equipped.hat];
    if (hat) {
      if (hat.hide) a.hideHat = true;
      else if (hat.look) { a.hat = hat.look.hat ?? null; a.hatHi = hat.look.hatHi ?? null; a.hatStyle = hat.look.style ?? null; }
    }
    const names = OUTFIT_SLOTS.map((s) => ITEMS[this.equipped[s]]?.name).filter(Boolean);
    a.label = names.length ? names.join(' · ') : null;
    return a;
  }

  /** 是否全身身着「皇帝的新衣」四件套(四个部位都是 hide 物品,穿上看不见) */
  emperorSet() {
    return OUTFIT_SLOTS.every((slot) => {
      const id = this.equipped[slot];
      return !!id && ITEMS[id]?.hide === true;
    });
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
      case 'full': {
        player.hp = player.maxHp;
        player.mp = player.maxMp;
        msg = '生命与魔力尽数回满';
        break;
      }
      case 'rest_haste': {
        this.hasteRest += amount;
        msg = `之后 ${amount} 次休息的耗时会大幅缩短`;
        break;
      }
      case 'travel_haste': {
        this.hasteTravel += amount;
        msg = `之后 ${amount} 段旅途的耗时会减半`;
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
      hasteRest: this.hasteRest,
      hasteTravel: this.hasteTravel,
    };
  }
}
