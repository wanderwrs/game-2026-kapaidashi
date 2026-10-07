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

import { ITEMS, sellPrice, tokenPrice, socketsOf } from '../data/items.js?v=20261007f';
import { TRAVEL_BASE_COST } from '../data/regions.js?v=20261007f';
import { GEM_EFFECT } from '../data/gems.js?v=20261007f';
import { SHELF, shelfUpgradeCost } from '../data/trade.js?v=20261007f';
import { ARMOR_SLOTS, ARMOR_GEM_STEP, ARMOR_MAX_LEVEL, armorBand, makeArmor } from '../data/armor.js?v=20261007f';
import { CAREER_MAX_LEVEL, CAREER_FREE_MAX, rankIndexForLevel, expToNext, startsNewMajor, CAREER_RANKS } from '../data/careers_rank.js?v=20261007f';
import { DEFAULT_BODY, DEFAULT_SKIN, BODY_MAP, SKIN_MAP } from '../data/looks.js?v=20261007f';

/** 装备槽位:武器 + 7 个防具槽 + 服装 4 件 + 载具 */
const SLOTS = ['weapon', ...ARMOR_SLOTS, 'hat', 'top', 'bottom', 'shoes', 'vehicle'];
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
    this.equipped = { weapon: null, hat: null, top: null, bottom: null, shoes: null, vehicle: null };
    for (const s of ARMOR_SLOTS) this.equipped[s] = null;
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
    // ===== 角色(名字 / 形象 / 肤色)=====
    this.playerName = '无名少年';
    this.body = DEFAULT_BODY;        // 7 种形象
    this.skin = DEFAULT_SKIN;        // 5 种肤色
    this.lookChosen = false;         // 新玩家开局仅可免费定形一次
    this.nameChosen = false;         // 新玩家开局仅可免费改名一次
    // ===== 职业等级(1~150,13 个职介);各职业独立记档,互不相通 =====
    this.careerId = null;      // 当前职业 id(由 Game 随职业变动同步)
    this.careerLevels = {};    // careerId → 等级
    this.careerExps = {};      // careerId → 当前等级内的经验
    // ===== 宠物 =====
    this.pets = new Map();           // petId -> 拥有数量
    this.petActive = null;           // 出战宠物 id
    // ===== 衣橱 · 防具外观(纯装饰,不提供任何数值) =====
    // 「角色」弹窗的防具位只给数值、不影响外观;外观由这里的 cosmetic 槽决定。
    this.cosmetic = { head: null, body: null, hands: null, legs: null, feet: null, ring: null, earring: null };
    // ===== 酒店仓库(储存金币与道具)=====
    this.storageGold = 0;       // 仓库金币
    this.storage = new Map();   // 仓库物品:itemId -> qty
  }

  // ===== 角色名 / 形象 =====
  setName(name) {
    const n = String(name || '').trim().slice(0, 12);
    if (!n) return false;
    this.playerName = n;
    return true;
  }

  /** 更换形象(美梦药水 / 开局定形) */
  setLook(body, skin) {
    if (body) this.body = body;
    if (skin) this.skin = skin;
    return true;
  }

  // ===== 职业等级(各职业等级同步,切换时自动对齐)=====
  /** 设定当前职业(职业分配 / 切换 / 读档时由 Game 调用) */
  setCareer(careerId) {
    if (!careerId) return;
    // 旧存档迁移:此前职业等级是全局唯一的,直接归入当时的职业
    if (this._legacyLevel != null && this.careerLevels[careerId] == null) {
      this.careerLevels[careerId] = Math.max(1, Math.min(CAREER_MAX_LEVEL, this._legacyLevel));
      this.careerExps[careerId] = Math.max(0, this._legacyExp || 0);
    }
    this._legacyLevel = null;
    this._legacyExp = null;
    this.careerId = careerId;
    // 等级同步:切换到的职业若等级低于当前最高等级,则对齐到最高等级
    const curLevel = this.careerLevelOf(careerId);
    const maxLevel = Math.max(1, ...Object.values(this.careerLevels).map((v) => Number(v) || 1));
    if (curLevel < maxLevel) {
      this.careerLevels[careerId] = maxLevel;
      this.careerExps[careerId] = 0;
    }
  }

  /** 计入档位的键(缺省取当前职业) */
  _careerKey(careerId) { return careerId || this.careerId || ''; }

  /** 某职业的等级(缺省当前职业) */
  careerLevelOf(careerId) { return Math.max(1, this.careerLevels[this._careerKey(careerId)] || 1); }
  /** 某职业当前等级内的经验(缺省当前职业) */
  careerExpOf(careerId) { return Math.max(0, this.careerExps[this._careerKey(careerId)] || 0); }
  /** 当前职业等级(只读) */
  get careerLevel() { return this.careerLevelOf(this.careerId); }
  /** 当前职业经验(只读) */
  get careerExp() { return this.careerExpOf(this.careerId); }

  careerRankIndex(careerId) { return rankIndexForLevel(this.careerLevelOf(careerId)); }
  careerRank(careerId) { return CAREER_RANKS[this.careerRankIndex(careerId)]; }
  careerExpToNext(careerId) { return expToNext(this.careerLevelOf(careerId)); }

  /** 把某职业的等级 / 经验写回档位 */
  _saveCareer(key, level, exp) {
    this.careerLevels[key] = Math.max(1, Math.min(CAREER_MAX_LEVEL, level));
    this.careerExps[key] = Math.max(0, exp);
  }

  /**
   * 增加当前职业的经验,返回晋升信息 { level, promotions }
   * @param {number} amount
   * @param {number} [bonus=1] 经验倍率(职介越高越多)
   */
  gainCareerExp(amount, bonus = 1) {
    const key = this._careerKey();
    const gain = Math.max(0, Math.round(amount * bonus));
    let level = this.careerLevelOf(key);
    let exp = this.careerExpOf(key) + gain;
    const promotions = [];
    while (level < CAREER_MAX_LEVEL && exp >= expToNext(level)) {
      exp -= expToNext(level);
      level += 1;
      const idx = rankIndexForLevel(level);
      if (idx !== rankIndexForLevel(level - 1)) {
        promotions.push({ index: idx, rank: CAREER_RANKS[idx], newMajor: startsNewMajor(idx) });
      }
    }
    if (level >= CAREER_MAX_LEVEL) exp = 0;
    this._saveCareer(key, level, exp);
    this._syncCareerLevels(level, exp);
    return { level, promotions };
  }

  /**
   * 直接提升当前职业的等级(职业药水 / 星辉秘典),不经过经验条。
   * @param {number} [n=1] 提升级数
   * @param {boolean} [byCodex=false] 是否由「星辉秘典」驱动(唯一能突破 100 级的手段)
   * @returns {{ level:number, promotions:Array, blocked:boolean }}
   */
  gainCareerLevels(n = 1, byCodex = false) {
    const key = this._careerKey();
    let level = this.careerLevelOf(key);
    const promotions = [];
    let blocked = false;
    for (let k = 0; k < n && level < CAREER_MAX_LEVEL; k++) {
      if (level >= CAREER_FREE_MAX && !byCodex) { blocked = true; break; }
      const from = level;
      level += 1;
      const idx = rankIndexForLevel(level);
      if (idx !== rankIndexForLevel(from)) {
        promotions.push({ index: idx, rank: CAREER_RANKS[idx], newMajor: startsNewMajor(idx) });
      }
    }
    this._saveCareer(key, level, this.careerExpOf(key));
    this._syncCareerLevels(level, this.careerExpOf(key));
    return { level, promotions, blocked };
  }

  /** 把等级 / 经验同步到所有已记录的职业(保证各职业等级一致) */
  _syncCareerLevels(level, exp) {
    for (const k of Object.keys(this.careerLevels)) {
      this.careerLevels[k] = Math.max(1, Math.min(CAREER_MAX_LEVEL, level));
      this.careerExps[k] = Math.max(0, exp || 0);
    }
  }

  // ===== 宠物 =====
  hasPet(id) { return this.pets.has(id) && this.pets.get(id) > 0; }
  addPet(id, qty = 1) { this.pets.set(id, (this.pets.get(id) || 0) + qty); return true; }
  petCount(id) { return this.pets.get(id) || 0; }
  setActivePet(id) {
    if (id && !this.hasPet(id)) return false;
    this.petActive = id || null;
    return true;
  }
  petList() { return [...this.pets.entries()]; }
  /** 送走一只宠物(卖出);若卖掉的是出战宠物则同时收回出战 */
  removePet(id, qty = 1) {
    const n = this.pets.get(id) || 0;
    if (n < qty) return false;
    if (n === qty) this.pets.delete(id);
    else this.pets.set(id, n - qty);
    if (!this.pets.has(id) && this.petActive === id) this.petActive = null;
    return true;
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
    if (cur === qty) {
      this.bag.delete(id);
      // 物品已不在背包:清掉以其为外观的衣橱槽(纯装饰,无需补偿)
      for (const slot of ARMOR_SLOTS) {
        if (this.cosmetic[slot] === id) this.cosmetic[slot] = null;
      }
    }
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

  // ===== 酒店仓库(储存金币与道具)=====
  /** 存入金币 */
  storeGold(amount) {
    const n = Math.max(0, Math.floor(amount || 0));
    if (n <= 0 || this.gold < n) return 0;
    this.gold -= n;
    this.storageGold += n;
    return n;
  }

  /** 取出金币 */
  withdrawGold(amount) {
    const n = Math.max(0, Math.floor(amount || 0));
    if (n <= 0 || this.storageGold < n) return 0;
    this.storageGold -= n;
    this.gold += n;
    return n;
  }

  /** 存入道具 */
  storeItem(id, qty = 1) {
    const n = Math.max(1, Math.floor(qty || 1));
    if (!this.has(id, n)) return 0;
    this.removeItem(id, n);
    this.storage.set(id, (this.storage.get(id) || 0) + n);
    return n;
  }

  /** 取出道具 */
  withdrawItem(id, qty = 1) {
    const n = Math.max(1, Math.floor(qty || 1));
    const stored = this.storage.get(id) || 0;
    if (n > stored) return 0;
    // 取出时需检查背包是否还能装下(按种类计数)
    if (!this.bag.has(id) && this.bag.size >= this.bagCap) return 0;
    this.storage.set(id, stored - n);
    if (this.storage.get(id) <= 0) this.storage.delete(id);
    this.addItem(id, n);
    return n;
  }

  /** 仓库某物品数量 */
  storageCount(id) { return this.storage.get(id) || 0; }

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
    // 镶嵌后的武器可在市场流通:估价 = 基础武器价 + 已镶宝石价
    const gemsValue = gems.reduce((s, gid) => s + (ITEMS[gid]?.price || 0), 0);
    return {
      base: baseId,
      name: gems.length ? `${base.name}[${tag}]` : base.name,
      category: 'weapon',
      career: base.career,
      forged: !!base.forged,
      level: base.level || 1,
      sockets: Math.max(0, socketsOf(baseId) - gems.length),
      gems: [...gems],
      icon: base.icon || '🗡️',
      price: Math.max(1, Math.round((base.price || 0) + gemsValue)),
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
   * 给防具镶嵌宝石:每颗 +10 级(上限 150)。
   * 镶嵌过的防具可在市场流通;但 130 级以上的防具不得出售(见 data/grade.js)。
   * @returns {string|null} 新的防具 id
   */
  socketArmorGem(armorId, gemId) {
    const a = ITEMS[armorId];
    const gem = ITEMS[gemId];
    if (!a || a.category !== 'armor' || !gem || gem.category !== 'gem') return null;
    if (!this.has(armorId, 1) || !this.has(gemId, 1)) return null;
    if (socketsOf(armorId) <= 0) return null;
    const lv = Math.min(ARMOR_MAX_LEVEL, (a.level || 1) + ARMOR_GEM_STEP);
    const gems = [...(a.gems || []), gemId];
    const def = makeArmor(a.armorSlot || 'body', lv, null, gems);
    if (!def) return null;
    const created = this.registerCustom(def);
    this.removeItem(armorId, 1);
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

  /** 武器必须符合当前职业;防具 / 服饰 / 载具无职业限制 */
  canEquip(id, careerId) {
    const it = ITEMS[id];
    if (!it || !it.equipment) return false;
    if (it.category === 'weapon' && it.career && careerId && it.career !== careerId) return false;
    return true;
  }

  equip(id) {
    const it = ITEMS[id];
    if (!it || !it.equipment) return false;
    const slot = it.equipment.slot;
    if (!SLOTS.includes(slot)) return false;
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

  // ===== 衣橱 · 防具外观 =====
  /**
   * 指定某防具槽位的「外观」(纯装饰,不给数值;物品留在背包,可同时用于数值装配)。
   * @param {string} slot 防具槽位(head/body/hands/legs/feet/ring/earring)
   * @param {string|null} id 物品 id;null 表示卸下该部位外观
   */
  setCosmetic(slot, id) {
    if (!ARMOR_SLOTS.includes(slot)) return false;
    if (id == null) { this.cosmetic[slot] = null; return true; }
    const it = ITEMS[id];
    // 必须是已拥有、且槽位相符的防具
    if (!it || it.category !== 'armor' || !this.has(id)) return false;
    if (armorSlotOf(id) !== slot) return false;
    this.cosmetic[slot] = id;
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
      body: this.body,          // 7 种小男孩形象
      skin: this.skin,          // 5 种肤色
    };
    // 形象参数(发型 / 眼型 / 肤色)交由 scene.js 绘制
    const bodyDef = BODY_MAP[this.body] || BODY_MAP[DEFAULT_BODY];
    const skinDef = SKIN_MAP[this.skin] || SKIN_MAP[DEFAULT_SKIN];
    a.skinCol = skinDef.skin;
    a.skinShade = skinDef.shade;
    a.hair = bodyDef.hairColor;
    a.hairStyle = bodyDef.hairStyle;
    a.eyeStyle = bodyDef.eyeStyle;
    a.blush = bodyDef.blush;
    a.bodyAcc = bodyDef.accessory;
    // 身材参数(身高 / 体格 / 四肢粗细)同样由形象决定
    a.stature = bodyDef.stature || 0;
    a.girth = bodyDef.girth || 0;
    a.limb = bodyDef.limb || 0;
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
    // 防具外观由「衣橱」决定(cosmetic 槽,纯装饰);数值装配位(equipped)不再影响外观。
    // 防具按「等级档位」取色(见 data/armor.js 的 armorBand),
    // 与服饰配色互不覆盖,故同一个部位可以「里衣外甲」同时可见。
    a.armor = {};
    for (const slot of ARMOR_SLOTS) {
      const it = ITEMS[this.cosmetic[slot]];
      if (!it || it.category !== 'armor') continue;
      a.armor[slot] = armorBand(it.level || 1).tint;
    }
    const armorNames = ARMOR_SLOTS.map((s) => ITEMS[this.cosmetic[s]]?.name).filter(Boolean);
    const names = OUTFIT_SLOTS.map((s) => ITEMS[this.equipped[s]]?.name).filter(Boolean);
    const all = [...armorNames, ...names];
    a.label = all.length ? all.join(' · ') : null;
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
    let promotions = [];
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
      // ===== 改名 / 换形象(交由角色弹窗处理,此处不消耗) =====
      case 'rename': {
        return { ok: true, prompt: 'rename', msg: '' };
      }
      case 'dream': {
        return { ok: true, prompt: 'dream', msg: '' };
      }
      // ===== 记忆之书:跳过对应区间主线(交由 game 处理,此处不消耗) =====
      case 'skip_chapter': {
        return { ok: true, prompt: 'skip_chapter', from: it.effect.from, to: it.effect.to, next: it.effect.next, msg: '' };
      }
      // ===== 职业等级药水 / 星辉秘典 =====
      case 'career_exp': {
        if (this.careerLevel >= CAREER_MAX_LEVEL) return { ok: false, msg: '职业等级已达上限 150' };
        if (this.careerLevel >= CAREER_FREE_MAX) return { ok: false, msg: '职业等级已超过 100,需用「星辉秘典」才能继续提升' };
        const r = this.gainCareerLevels(1, false);
        promotions = r.promotions;
        msg = `职业等级 +1,现为 Lv.${r.level}`;
        break;
      }
      case 'career_levelup': {
        if (this.careerLevel >= CAREER_MAX_LEVEL) return { ok: false, msg: '职业等级已达上限 150' };
        const r = this.gainCareerLevels(1, true);
        promotions = r.promotions;
        msg = `星辉融汇,职业等级 +1,现为 Lv.${r.level}`;
        break;
      }
      default:
        return { ok: false, msg: '此物无法使用' };
    }
    this.removeItem(id, 1);
    return { ok: true, msg: `使用「${it.name}」,${msg}`, promotions };
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
      // 角色 / 职业 / 宠物
      playerName: this.playerName,
      body: this.body,
      skin: this.skin,
      lookChosen: this.lookChosen,
      nameChosen: this.nameChosen,
      careerId: this.careerId,
      careerLevels: { ...this.careerLevels },
      careerExps: { ...this.careerExps },
      pets: Object.fromEntries(this.pets),
      petActive: this.petActive,
      // 衣橱 · 防具外观(纯装饰)
      cosmetic: { ...this.cosmetic },
      // 酒店仓库
      storageGold: this.storageGold,
      storage: Object.fromEntries(this.storage),
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
    eco.equipped = { weapon: null, hat: null, top: null, bottom: null, shoes: null, vehicle: null };
    for (const s of ARMOR_SLOTS) eco.equipped[s] = null;
    if (data.equipped) {
      for (const slot of SLOTS) {
        const id = data.equipped[slot];
        if (!id || !ITEMS[id]) continue;
        // 旧存档迁移:物品的格位若已改判(如「皮甲」由服饰改作防具),按新格位归位
        const real = ITEMS[id].equipment?.slot;
        const target = (real && SLOTS.includes(real)) ? real : slot;
        if (!eco.equipped[target]) eco.equipped[target] = id;
        else eco.bag.set(id, (eco.bag.get(id) || 0) + 1);
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
    // 角色 / 职业 / 宠物
    eco.playerName = typeof data.playerName === 'string' && data.playerName ? data.playerName : eco.playerName;
    eco.body = data.body || eco.body;
    eco.skin = data.skin || eco.skin;
    eco.lookChosen = !!data.lookChosen;
    eco.nameChosen = !!data.nameChosen;
    eco.careerId = data.careerId || null;
    eco.careerLevels = {};
    eco.careerExps = {};
    if (data.careerLevels && typeof data.careerLevels === 'object') {
      for (const [cid, lv] of Object.entries(data.careerLevels)) {
        eco.careerLevels[cid] = Math.max(1, Math.min(CAREER_MAX_LEVEL, Number(lv) || 1));
      }
    }
    if (data.careerExps && typeof data.careerExps === 'object') {
      for (const [cid, ex] of Object.entries(data.careerExps)) {
        eco.careerExps[cid] = Math.max(0, Number(ex) || 0);
      }
    }
    // 旧存档:职业等级是全局唯一的,等 Game 告知当前职业后再归入该职业(setCareer)
    if (data.careerLevel != null) {
      eco._legacyLevel = Math.max(1, Math.min(CAREER_MAX_LEVEL, Number(data.careerLevel) || 1));
      eco._legacyExp = Math.max(0, Number(data.careerExp) || 0);
    }
    eco.pets = new Map();
    if (data.pets && typeof data.pets === 'object') {
      for (const [id, qty] of Object.entries(data.pets)) {
        if (Number(qty) > 0) eco.pets.set(id, Math.floor(Number(qty)));
      }
    }
    eco.petActive = eco.pets.has(data.petActive) ? data.petActive : null;
    // 衣橱 · 防具外观(纯装饰):仅接受背包里仍拥有的防具
    if (data.cosmetic && typeof data.cosmetic === 'object') {
      for (const slot of ARMOR_SLOTS) {
        const id = data.cosmetic[slot];
        if (id && eco.bag.has(id) && ITEMS[id]?.category === 'armor') eco.cosmetic[slot] = id;
      }
    }
    // 酒店仓库
    eco.storageGold = Number(data.storageGold ?? 0);
    eco.storage = new Map();
    if (data.storage && typeof data.storage === 'object') {
      for (const [id, qty] of Object.entries(data.storage)) {
        if (ITEMS[id] && Number(qty) > 0) eco.storage.set(id, Math.floor(Number(qty)));
      }
    }
    return eco;
  }
}
