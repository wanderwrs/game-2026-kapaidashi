/**
 * economy.js — 经济与物资系统:金币 / 背包 / 装备 / 行动力。
 *
 * 与战斗的边界:
 *   · 行动力(AP)用于地图旅行与打工,属于战斗外资源
 *   · 魔力(MP)、生命(HP)属于玩家实体(Player),由药品恢复
 *   · 战力(power)由武器/服饰加成,开战时折算为力量,并叠加战力药剂的临时加成
 *
 * 装备槽位(共 7 个):weapon 武器 / armor 防具 / hat 帽子 / top 衣服 / bottom 裤子 / shoes 鞋子 / vehicle 载具
 * 防具(armor)与服装(outfit)独立:防具不影响外观,纯防御增益。
 * 服饰四件可自由混搭;其中「皇帝的新衣」系列 hide=true,穿上后对应部位在像素人物上不可见。
 */

import { ITEMS, sellPrice, tokenPrice, socketsOf } from '../data/items.js?v=20261001a';
import { TRAVEL_BASE_COST } from '../data/regions.js?v=20261001a';
import { GEM_EFFECT } from '../data/gems.js?v=20261001a';
import { SHELF, shelfUpgradeCost } from '../data/trade.js?v=20261001a';

const SLOTS = ['weapon', 'armor', 'hat', 'top', 'bottom', 'shoes', 'vehicle'];
const OUTFIT_SLOTS = ['hat', 'top', 'bottom', 'shoes'];

/** 背包初始格数 / 每次扩展格数 / 扩展基准价(每 70 格 ×1.25) */
export const BAG_BASE = 40;
export const BAG_STEP = 10;
export const BAG_BASE_COST = 100;
export const BAG_TIER_SLOTS = 70;
export const BAG_TIER_MUL = 1.25;

/** 背包扩容费用:已开格数决定档位 */
export function bagUpgradeCost(currentCap) {
  const opened = Math.max(0, currentCap - BAG_BASE);
  const tier = Math.floor(opened / BAG_TIER_SLOTS);
  return Math.round(BAG_BASE_COST * Math.pow(BAG_TIER_MUL, tier));
}

export class Economy {
  constructor({ gold = 40, apMax = 10 } = {}) {
    this.gold = gold;
    this.apMax = apMax;
    this.ap = apMax;
    this.bag = new Map();            // itemId -> qty
    this.equipped = { weapon: null, armor: null, hat: null, top: null, bottom: null, shoes: null, vehicle: null };
    this.pendingPower = 0;           // 战力药剂:下一场战斗生效
    this.hasteRest = 0;              // 剩余「缩短休息耗时」次数
    this.hasteTravel = 0;            // 剩余「缩短旅途耗时」次数
    this.goldLuckActive = false;     // 幸运币:下场战斗金币翻倍
    // ===== 背包格数 / 图纸 / 货架 =====
    this.bagCap = BAG_BASE;          // 背包格数(按物品种类计数,数量不限)
    this.blueprints = new Set();     // 已解锁的图纸 id
    this.custom = new Map();         // 动态物品:镶嵌武器等(id -> def)
    this._customSeq = 0;             // 动态物品 id 序号
    this.shelfCount = SHELF.start;   // 当前货架数
    this.shelfUpgrades = 0;          // 已扩容次数(用于算价)
    this.listings = [];              // 挂单:[{ id, itemId, price, at }]
    this._listingSeq = 0;
  }

  // ===== 背包格数 =====
  /** 当前占用的格数(每个物品种类一格;镶嵌武器等动态物品各占一格) */
  slotCount() { return this.bag.size; }

  /** 背包是否还能容纳该物品(已持有的种类恒可叠加) */
  canHold(id) {
    return this.bag.has(id) || this.bag.size < this.bagCap;
  }

  /** 扩容背包(一次 +10 格);返回花费,失败返回 -1 */
  expandBag() {
    const cost = bagUpgradeCost(this.bagCap);
    if (this.gold < cost) return -1;
    this.gold -= cost;
    this.bagCap += BAG_STEP;
    return cost;
  }

  bagUpgradeCost() { return bagUpgradeCost(this.bagCap); }

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

  // ===== 图纸(解锁锻造配方) =====
  hasBlueprint(id) { return this.blueprints.has(id); }

  /** 使用一张图纸,解锁对应配方 */
  unlockBlueprint(id) {
    if (!ITEMS[id] || ITEMS[id].category !== 'blueprint') return false;
    if (!this.removeItem(id, 1)) return false;
    this.blueprints.add(id);
    return true;
  }

  // ===== 动态物品(镶嵌武器) =====
  /** 注册一件动态物品,并入全局 ITEMS,便于各处按 id 查表 */
  registerCustom(def) {
    this._customSeq += 1;
    const id = `x_${def.base || 'item'}_${this._customSeq}`;
    const withId = { ...def, id };
    ITEMS[id] = withId;
    this.custom.set(id, withId);
    return withId;
  }

  isCustom(id) { return this.custom.has(id); }

  /** 某武器剩余可镶嵌槽数 */
  freeSockets(weaponId) { return socketsOf(weaponId); }

  /** 以基础武器 + 宝石列表,合成镶嵌武器的定义 */
  _composeSocketed(baseId, gems) {
    const base = ITEMS[baseId];
    if (!base) return null;
    const stats = { ...(base.equipment?.stats || {}) };
    for (const gid of gems) {
      const eff = GEM_EFFECT[ITEMS[gid]?.gem] || {};
      for (const [k, v] of Object.entries(eff)) stats[k] = (stats[k] || 0) + v;
    }
    const shortMap = { gem_strength: '力', gem_magic: '魔', gem_brave: '勇', gem_life: '生' };
    const tag = gems.map((g) => shortMap[g] || '石').join('');
    return {
      base: baseId,
      name: gems.length ? `${base.name}[${tag}]` : base.name,
      category: 'weapon',
      career: base.career,
      forged: !!base.forged,
      sockets: Math.max(0, socketsOf(baseId) - gems.length),
      gems: [...gems],
      icon: base.icon || '🗡️',
      price: 0,
      desc: `${base.desc || ''}${gems.length ? ` 镶嵌:${gems.map((g) => ITEMS[g]?.name || g).join('、')}。` : ''}`,
      equipment: { slot: 'weapon', stats },
    };
  }

  /**
   * 镶嵌:把 gemId 镶进背包中的 weaponId。成功返回新武器 id。
   */
  socketGem(weaponId, gemId) {
    const base = ITEMS[weaponId];
    const gem = ITEMS[gemId];
    if (!base || base.category !== 'weapon' || !gem || gem.category !== 'gem') return null;
    if (!this.has(weaponId, 1) || !this.has(gemId, 1)) return null;
    if (socketsOf(weaponId) <= 0) return null;
    const def = this._composeSocketed(base.base || base.id, [...(base.gems || []), gemId]);
    if (!def) return null;
    const created = this.registerCustom(def);
    this.removeItem(weaponId, 1);
    this.removeItem(gemId, 1);
    this.addItem(created.id, 1);
    return created.id;
  }

  /**
   * 取下最后一颗宝石(武器须在背包)。有几率把宝石打碎成碎片。
   * @returns {{ weaponId:string, gemId:string, shattered:boolean }|null}
   */
  unsocketGem(weaponId) {
    const w = ITEMS[weaponId];
    if (!w || !this.custom.has(weaponId) || !this.has(weaponId, 1)) return null;
    const gems = [...(w.gems || [])];
    if (!gems.length) return null;
    const gemId = gems.pop();
    const def = this._composeSocketed(w.base || w.id, gems);
    if (!def) return null;
    const created = this.registerCustom(def);
    this.removeItem(weaponId, 1);
    this.addItem(created.id, 1);
    const shattered = Math.random() < 0.6;
    if (shattered) this.addItem('mat_shard', 1);
    else this.addItem(gemId, 1);
    return { weaponId: created.id, gemId, shattered };
  }

  // ===== 玩家货架(市场挂售) =====
  shelfFree() { return this.listings.length < this.shelfCount; }

  /** 货架扩容:开一个货架的费用 = 上一货架 × 1.3 */
  expandShelf() {
    if (this.shelfCount >= SHELF.max) return -1;
    const cost = shelfUpgradeCost(this.shelfUpgrades);
    if (this.gold < cost) return -1;
    this.gold -= cost;
    this.shelfCount = Math.min(SHELF.max, this.shelfCount + 1);
    this.shelfUpgrades += 1;
    return cost;
  }

  shelfUpgradeCost() {
    return this.shelfCount >= SHELF.max ? -1 : shelfUpgradeCost(this.shelfUpgrades);
  }

  /** 上架一件物品(占用一格货架) */
  listItem(itemId, price) {
    if (!this.has(itemId, 1)) return null;
    if (!this.shelfFree()) return null;
    this._listingSeq += 1;
    const listing = { id: `L${this._listingSeq}`, itemId, price: Math.max(1, Math.round(price)), at: Date.now() };
    this.listings.push(listing);
    this.removeItem(itemId, 1);
    return listing;
  }

  /** 撤下挂单,物品回到背包 */
  cancelListing(listingId) {
    const i = this.listings.findIndex((l) => l.id === listingId);
    if (i < 0) return false;
    const l = this.listings[i];
    this.listings.splice(i, 1);
    this.addItem(l.itemId, 1);
    return true;
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
    const total = { atkPower: 0, maxHp: 0, maxMp: 0, apMax: 0, travelDiscount: 0, shopDiscount: 0, goldBonus: 0, restBonus: 0, startBlock: 0 };
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
   * @param {string} id 物品ID
   * @param {object} player 玩家实体
   * @param {object} [battle] 当前战斗(战斗专用药剂需要)
   * @returns {{ok:boolean, msg:string}}
   */
  useItem(id, player, battle) {
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
      // ===== 战斗专用药剂 =====
      case 'cleanse': {
        if (!battle) return { ok: false, msg: '仅能在战斗中使用' };
        for (const s of ['vulnerable', 'weak', 'frail']) {
          if (player.statuses[s]) delete player.statuses[s];
        }
        msg = '清除了所有负面状态';
        break;
      }
      case 'rage': {
        if (!battle) return { ok: false, msg: '仅能在战斗中使用' };
        player.applyStatus('strength', amount);
        msg = `本场战斗获得 ${amount} 点力量`;
        break;
      }
      case 'block_potion': {
        if (!battle) return { ok: false, msg: '仅能在战斗中使用' };
        player.addBlock(amount);
        msg = `获得 ${amount} 点护甲`;
        break;
      }
      case 'energy': {
        if (!battle) return { ok: false, msg: '仅能在战斗中使用' };
        player.energy = Math.min(player.energyMax, player.energy + amount);
        msg = `恢复 ${amount} 点能量`;
        break;
      }
      case 'escape': {
        if (!battle || !battle._escape) return { ok: false, msg: '仅能在战斗中使用' };
        battle._escape();
        msg = '烟雾弥漫,你趁机脱离了战斗';
        break;
      }
      case 'gold_luck': {
        this.goldLuckActive = true;
        msg = '下场战斗胜利时金币收益翻倍';
        break;
      }
      default:
        return { ok: false, msg: '此物无法使用' };
    }
    this.removeItem(id, 1);
    return { ok: true, msg: `使用「${it.name}」,${msg}` };
  }

  /**
   * 批量使用消耗品(直到满或用完)。
   * 仅对 heal / mp / ap 类有效。
   * @returns {{ok:boolean, msg:string, used:number}}
   */
  useItemBatch(id, player) {
    const it = ITEMS[id];
    if (!it || !it.effect) return { ok: false, msg: '此物无法批量使用', used: 0 };
    const kind = it.effect.kind;
    if (!['heal', 'mp', 'ap'].includes(kind)) {
      return { ok: false, msg: '仅药品 / 食品可批量使用', used: 0 };
    }
    let used = 0;
    while (this.has(id)) {
      const r = this.useItem(id, player);
      if (!r.ok) break;
      used++;
    }
    if (used === 0) return { ok: false, msg: '无需使用', used: 0 };
    return { ok: true, msg: `使用「${it.name}」×${used}`, used };
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

  // ===== 完整存档序列化 / 反序列化 =====
  /** 序列化为可 JSON 化的纯对象 */
  serialize() {
    return {
      gold: this.gold,
      apMax: this.apMax,
      ap: this.ap,
      bag: Object.fromEntries(this.bag),
      equipped: { ...this.equipped },
      pendingPower: this.pendingPower,
      hasteRest: this.hasteRest,
      hasteTravel: this.hasteTravel,
      goldLuckActive: this.goldLuckActive,
      // 新增:背包格数 / 图纸 / 动态物品 / 货架
      bagCap: this.bagCap,
      blueprints: [...this.blueprints],
      custom: [...this.custom.entries()].map(([id, def]) => ({ id, def })),
      customSeq: this._customSeq,
      shelfCount: this.shelfCount,
      shelfUpgrades: this.shelfUpgrades,
      listings: this.listings.map((l) => ({ ...l })),
      listingSeq: this._listingSeq,
    };
  }

  /** 从存档数据恢复;返回新的 Economy 实例 */
  static deserialize(data) {
    if (!data) return new Economy();
    const eco = new Economy({ gold: data.gold ?? 40, apMax: data.apMax ?? 10 });
    eco.ap = Number(data.ap ?? eco.apMax);
    // 动态物品:必须先注册回全局 ITEMS,否则背包里的镶嵌武器无法解析
    eco.custom = new Map();
    eco._customSeq = Number(data.customSeq ?? 0);
    if (Array.isArray(data.custom)) {
      for (const entry of data.custom) {
        if (!entry || !entry.id || !entry.def) continue;
        ITEMS[entry.id] = { ...entry.def, id: entry.id };
        eco.custom.set(entry.id, ITEMS[entry.id]);
      }
    }
    // 背包:Map
    eco.bag = new Map();
    if (data.bag) {
      for (const [id, qty] of Object.entries(data.bag)) {
        if (ITEMS[id] && qty > 0) eco.bag.set(id, Math.floor(qty));
      }
    }
    // 装备
    eco.equipped = { weapon: null, armor: null, hat: null, top: null, bottom: null, shoes: null, vehicle: null };
    if (data.equipped) {
      for (const slot of SLOTS) {
        const id = data.equipped[slot];
        if (id && ITEMS[id]) eco.equipped[slot] = id;
      }
    }
    eco.pendingPower = Number(data.pendingPower ?? 0);
    eco.hasteRest = Number(data.hasteRest ?? 0);
    eco.hasteTravel = Number(data.hasteTravel ?? 0);
    eco.goldLuckActive = !!data.goldLuckActive;
    // 新增字段
    eco.bagCap = Number(data.bagCap ?? BAG_BASE);
    eco.blueprints = new Set(Array.isArray(data.blueprints) ? data.blueprints : []);
    eco.shelfCount = Number(data.shelfCount ?? SHELF.start);
    eco.shelfUpgrades = Number(data.shelfUpgrades ?? 0);
    eco._listingSeq = Number(data.listingSeq ?? 0);
    eco.listings = Array.isArray(data.listings)
      ? data.listings.filter((l) => l && l.itemId && ITEMS[l.itemId]).map((l) => ({ ...l }))
      : [];
    return eco;
  }
}
