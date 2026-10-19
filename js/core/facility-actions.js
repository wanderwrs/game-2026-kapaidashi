/**
 * facility-actions.js — 设施 / 商业 / 目的地服务(action 层)。
 *
 * 从 core/game.js 抽出的「地图上的设施」业务方法:
 *   · POI:餐厅、酒店(含服务生代存 / 跑腿委托 / 仓库 / 换装)、商市
 *   · 主城设施:酒店、酒馆、竞技场、神秘商店、银行、交易所、投资、仓库、典当
 *   · 目的地商人:武器 / 防具 / 药材 / 铁匠 / 宝石店 / 珠宝匠(镶嵌与拆卸)、图纸
 *
 * 这些方法只通过 `this` 访问 Game 实例(economy / ui / bus / rng / autosave 等),
 * 由 game.js 在类定义之后 `Object.assign(Game.prototype, facilityActions)` 挂载,
 * 因此对外 API 与原 class 方法完全一致。
 */
import { GameState } from './states.js?v=20261007t';
import { ITEMS, socketsOf } from '../data/items.js?v=20261007t';
import { ENEMIES, scaleEnemy } from '../data/data.js?v=20261007t';
import { FORGE_RECIPES } from '../data/forge.js?v=20261007t';
import { GEM_ITEMS, SOCKET_GOLD_PER_GEM, MYTH_GEM_IDS } from '../data/gems.js?v=20261007t';
import { ARMOR_MARKET_MAX } from '../data/armor.js?v=20261007t';
import {
  FACILITY_CN, BANK_TERMS, bankRate, exchangeTick, msToNextExchange,
  TOKEN_LIST, TOKEN_EX_FEE, tokenRate, INVEST_PROJECTS, investPrice, investPrevPrice,
  WAREHOUSE, warehouseFee, mysteryStock, mysteryPrice, rollMythGems, ARENA_TIERS,
  TAVERN_STOCK, TAVERN_FEE, TAVERN_MEAL_GOLD, TAVERN_MEAL_AP, BELLHOP, errandCatalog,
} from '../data/facilities.js?v=20261007t';
import { REGIONS } from '../data/regions.js?v=20261007t';
import { WORLD, regionTerrain } from '../data/world.js?v=20261007t';
import {
  generatePois, POI_COUNT, RESTAURANT_FOOD, HOTEL_ROOMS,
  MARKET_MERCHANTS, STALL_CN,
} from '../data/pois.js?v=20261007t';
import { MAJOR_CHAPTERS } from '../narrative/chapters/index.js?v=20261007t';
import { CHAPTER_RECAPS } from '../data/story.js?v=20261007t';

/** 用了「醒神香 / 长明香」后酒店休整耗时的倍率 */
const HOTEL_HASTE_MUL = 0.25;

export const facilityActions = {
  _generatePois() {
    if (this._pois.length > 0) return; // 已生成过则不重复
    this._pois = generatePois(this.rng);
    this.ui.showToast(`✦ 世界地图上出现了 ${POI_COUNT} 处新的驻足之地(餐厅 / 酒店 / 商市)`);
  },

  /** 打开当前所在 POI 的服务界面 */
  _openPoi() {
    if (!this._atPoi) return;
    const poi = this._atPoi;
    if (poi.type === 'restaurant') this._openRestaurant(poi);
    else if (poi.type === 'hotel') this._openHotel(poi);
    else if (poi.type === 'market') this._openMarketPoi(poi);
  },

  // ===== 餐厅 =====
  _openRestaurant(poi) {
    const foods = RESTAURANT_FOOD.map((id) => ITEMS[id]).filter(Boolean);
    this.ui.renderRestaurant({
      name: poi.name,
      foods,
      economy: this.economy,
    });
    this.transition(GameState.RESTAURANT);
  },

  _restaurantBuy(id) {
    const it = ITEMS[id];
    if (!it) return;
    if (this.economy.buy(id)) this.ui.showToast(`在餐厅购入「${it.name}」`);
    else this.ui.showToast('金币不足');
    this._openRestaurant(this._atPoi);
    this._autosave();
  },

  /** 餐厅用餐:消耗金币恢复行动力 */
  _restaurantDine() {
    const cost = 15;
    if (this.economy.gold < cost) { this.ui.showToast(`金币不足(用餐需 ${cost})`); return; }
    this.economy.gold -= cost;
    const got = this.economy.addAp(5);
    this._syncUi();
    this.ui.showToast(got > 0 ? `饱餐一顿,恢复 ${got} 点行动力` : '行动力已满');
    this._autosave();
  },

  // ===== 酒店 =====
  _openHotel(poi) {
    // POI 酒店传入 poi;主城设施酒店(旅店)传入 null,名字取自当前地点
    const hotelName = poi?.name || REGIONS[this.regionId]?.stops[this.stopIndex]?.name || '旅店';
    const outfits = Object.values(ITEMS).filter((it) => it.category === 'outfit');
    // 回忆剧情:已通关的大章回顾
    const cleared = this.progress?.cleared || {};
    const recaps = MAJOR_CHAPTERS.map((mc) => ({
      id: mc.id, no: mc.no, title: mc.title,
      recap: CHAPTER_RECAPS[mc.id] || '',
      cleared: !!cleared[mc.id],
    }));
    this.ui.renderHotel({
      name: hotelName,
      rooms: HOTEL_ROOMS,
      outfits,
      equipped: this.economy.equipped,
      economy: this.economy,
      recaps,
      bellhop: this._bellhopData(),
    });
    this.transition(GameState.HOTEL);
  },

  /** 酒店服务生数据:代存与跑腿委托 */
  _bellhopData() {
    const now = Date.now();
    const priceOf = (id) => (this.economy.itemPrice ? this.economy.itemPrice(id) : (ITEMS[id]?.price || 0));
    return {
      kinds: BELLHOP.escrowKinds,
      goldFeeRate: BELLHOP.goldFeeRate,
      errandFee: BELLHOP.errandFee,
      errandSeconds: BELLHOP.errandSeconds,
      catalog: errandCatalog().map((id) => {
        const base = priceOf(id);
        const fee = Math.max(1, Math.round(base * BELLHOP.errandFee));
        return { id, price: base, fee, total: base + fee };
      }),
      errands: this.economy.errands.map((e) => ({
        ...e, ready: now >= e.readyAt, remainMs: Math.max(0, e.readyAt - now),
      })),
    };
  },

  /** 酒店仓库:存入金币 */
  _hotelStoreGold(amount) {
    const got = this.economy.storeGold(amount);
    this.ui.showToast(got > 0 ? `存入 ${got} 金币` : '金币不足或金额无效');
    this._syncUi();
    this._openHotel(this._atPoi);
    this._autosave();
  },

  /** 酒店仓库:取出金币 */
  _hotelWithdrawGold(amount) {
    const got = this.economy.withdrawGold(amount);
    this.ui.showToast(got > 0 ? `取出 ${got} 金币` : '仓库金币不足或金额无效');
    this._syncUi();
    this._openHotel(this._atPoi);
    this._autosave();
  },

  /** 酒店仓库:存入道具 */
  _hotelStoreItem(id, qty) {
    const it = ITEMS[id];
    if (!it) return;
    const got = this.economy.storeItem(id, qty);
    this.ui.showToast(got > 0 ? `存入「${it.name}」×${got}` : '背包中没有该物品或数量不足');
    this._syncUi();
    this._openHotel(this._atPoi);
    this._autosave();
  },

  /** 酒店仓库:取出道具 */
  _hotelWithdrawItem(id, qty) {
    const it = ITEMS[id];
    if (!it) return;
    const got = this.economy.withdrawItem(id, qty);
    this.ui.showToast(got > 0 ? `取出「${it.name}」×${got}` : '仓库中没有该物品或背包已满');
    this._syncUi();
    this._openHotel(this._atPoi);
    this._autosave();
  },

  /** 酒店入住:选择房型休息(恢复行动力 + 血量,耗时不同)—— 真实等待 */
  _hotelCheckIn(roomId) {
    const room = HOTEL_ROOMS.find((r) => r.id === roomId);
    if (!room) return;
    if (this.travel?.active) { this.ui.showToast('正在休整中,请稍候'); return; }
    if (this.economy.gold < room.gold) { this.ui.showToast(`金币不足(需 ${room.gold})`); return; }
    this.economy.gold -= room.gold;
    this._syncUi();
    // 记录本次入住的房型,供旅途结束时结算恢复效果
    this._hotelRoom = room;
    const place = this._atPoi?.name || '酒店';
    // 醒神香 / 长明香:把这一次酒店休整的耗时缩到四分之一
    const haste = this.economy.consumeRestHaste();
    const seconds = haste ? Math.max(1, Math.round(room.seconds * HOTEL_HASTE_MUL)) : room.seconds;
    this.travel.start({
      mode: 'rest',
      fromLabel: place,
      toLabel: room.name,
      dist: 0,
      seconds: Math.max(1, seconds),
      level: WORLD[this.regionId]?.level ?? this._chapterNum(),
      poolKey: this.regionId,
      terrain: regionTerrain(this.regionId),
      events: [], // 酒店入住不触发随机事件
    });
    this.travel.pushLog(`你付了 ${room.gold} 金币,住进「${room.name}」。预计 ${seconds} 秒后恢复 ${room.apRecover} 点行动力${room.heal > 0 ? `与 ${Math.round(room.heal * 100)}% 生命` : ''}。`);
    if (haste) this.travel.pushLog('香起了效,这一觉短了许多。');
    this.transition(GameState.TRAVEL);
  },

  /** 酒店换装:仅在酒店可更换服饰 */
  _hotelChangeOutfit(outfitId) {
    if (outfitId) {
      if (!this.economy.has(outfitId)) {
        // 未拥有则购买
        const it = ITEMS[outfitId];
        if (!it) return;
        if (this.economy.gold < it.price) { this.ui.showToast(`金币不足(需 ${it.price})`); return; }
        this.economy.gold -= it.price;
        this.economy.addItem(outfitId, 1);
      }
      this.economy.equip(outfitId);
      this._syncPlayerStats();
      this.ui.showToast(`换装为「${ITEMS[outfitId].name}」`);
    } else {
      // 卸下当前服饰
      this.economy.unequip('top');
      this._syncPlayerStats();
      this.ui.showToast('已卸下服饰');
    }
    this._syncUi();
    this._openHotel(this._atPoi);
    this._autosave();
  },

  // ===== 主城设施(酒店 / 酒馆 / 神秘商店 / 银行 / 交易所 / 仓库) =====
  /** 当前所在地点的设施类型(非设施地点返回 null) */
  _facilityAt(index = this.stopIndex) {
    const s = REGIONS[this.regionId]?.stops[index];
    if (!s?.services) return null;
    for (const k of ['hotel', 'tavern', 'mystery', 'bank', 'exchange', 'warehouse']) {
      if (s.services[k]) return k;
    }
    return null;
  },

  /** 打开某设施(酒店复用既有酒店界面,其余走通用设施面板) */
  _openFacility(kind) {
    this._facilityKind = kind;
    if (kind === 'hotel') {
      const name = REGIONS[this.regionId]?.stops[this.stopIndex]?.name || '旅店';
      this._openHotel({ name, fromFacility: true });
      return;
    }
    this.ui.renderFacility(kind, this._facilityData(kind));
    this._syncUi();
    this.transition(GameState.FACILITY);
  },

  /** 设施面板数据(汇率 / 利率 / 行情按真实时间 1 小时轮换) */
  _facilityData(kind) {
    const now = Date.now();
    const seed = this.rng?.seed ?? 1;
    const tick = exchangeTick(now);
    const eco = this.economy;
    if (kind === 'tavern') {
      return {
        economy: eco, stock: TAVERN_STOCK, fee: TAVERN_FEE, level: this._chapterNum(),
        arena: ARENA_TIERS, mealGold: TAVERN_MEAL_GOLD, mealAp: TAVERN_MEAL_AP,
      };
    }
    if (kind === 'mystery') {
      // 常规珍品 + 本轮极小概率现身的神话宝石(每颗独立 0.03%)
      const ids = [...mysteryStock(seed, tick), ...rollMythGems(seed, tick)];
      const stock = ids.map((id) => ({
        id, price: mysteryPrice(id, seed, tick), myth: MYTH_GEM_IDS.includes(id),
      }));
      return { economy: eco, stock, nextMs: msToNextExchange(now) };
    }
    if (kind === 'bank') {
      return {
        economy: eco,
        terms: BANK_TERMS.map((t) => ({ ...t, rate: bankRate(t.id, seed, tick) })),
        deposits: eco.bankDeposits.map((d) => ({
          ...d,
          matured: now >= d.maturesAt,
          interest: Math.round(d.principal * d.rate),
          remainMs: Math.max(0, d.maturesAt - now),
        })),
        tokens: TOKEN_LIST.filter((id) => ITEMS[id]).map((id) => ({
          id, name: ITEMS[id].name, icon: ITEMS[id].icon,
          rate: tokenRate(id, seed, tick), owned: eco.count(id),
        })),
        fee: TOKEN_EX_FEE, nextMs: msToNextExchange(now),
      };
    }
    if (kind === 'exchange') {
      return {
        economy: eco,
        projects: INVEST_PROJECTS.map((p) => {
          const hold = eco.invest[p.id] || { units: 0, cost: 0 };
          return {
            ...p,
            price: investPrice(p.id, seed, tick),
            prev: investPrevPrice(p.id, seed, tick),
            units: hold.units,
            cost: hold.cost,
          };
        }),
        nextMs: msToNextExchange(now),
      };
    }
    if (kind === 'warehouse') {
      return {
        economy: eco, feeRate: WAREHOUSE.feeRate, minFee: WAREHOUSE.minFee,
        items: [...eco.bag.entries()].filter(([id]) => ITEMS[id]).map(([id, qty]) => ({
          id, qty, fee: warehouseFee(id, 1), feeAll: warehouseFee(id, qty),
        })),
        stored: [...eco.warehouse.entries()].filter(([id]) => ITEMS[id]).map(([id, qty]) => ({
          id, qty, fee: warehouseFee(id, 1), feeAll: warehouseFee(id, qty),
        })),
      };
    }
    return { economy: eco };
  },

  /** 重绘当前设施并自动存档 */
  _facilityRefresh() {
    this._openFacility(this._facilityKind || 'tavern');
    this._autosave();
  },

  // ----- 酒馆:购物 / 请客 / 角斗 -----
  _tavernBuy(id) {
    const it = ITEMS[id];
    if (!it) return;
    const base = this.economy.itemPrice ? this.economy.itemPrice(id) : it.price;
    const price = Math.max(1, Math.round(base * (1 + TAVERN_FEE)));
    if (this.economy.gold < price) { this.ui.showToast('金币不足'); return; }
    if (!this.economy.canHold(id)) { this.ui.showToast('背包已满,请先扩容或清理'); return; }
    this.economy.gold -= price;
    this.economy.addItem(id, 1);
    this.economy.notePurchase(id);
    this.ui.showToast(`在酒馆购入「${it.name}」(${price} 金币)`);
    this._facilityRefresh();
  },

  _tavernMeal() {
    if (this.economy.gold < TAVERN_MEAL_GOLD) { this.ui.showToast(`金币不足(需 ${TAVERN_MEAL_GOLD})`); return; }
    this.economy.gold -= TAVERN_MEAL_GOLD;
    const got = this.economy.addAp(TAVERN_MEAL_AP);
    this.ui.showToast(got > 0 ? `酒足饭饱,恢复 ${got} 点行动力` : '行动力已满,这顿算是白请了');
    this._facilityRefresh();
  },

  _arenaFight(tierId) {
    const tier = ARENA_TIERS.find((t) => t.id === tierId);
    if (!tier) return;
    if (!this.deck) { this.ui.showToast('尚无卡组,先推进剧情'); return; }
    if (this.economy.gold < tier.entry) { this.ui.showToast(`报名费不足(需 ${tier.entry})`); return; }
    this.economy.gold -= tier.entry;
    this._syncUi();
    this._startArenaBattle(Math.max(1, this._chapterNum() + tier.enemyLv), tier);
  },

  _startArenaBattle(level, tier) {
    const pool = ENEMIES[this.regionId] || ENEMIES.normal;
    const raw = pool[Math.floor(this.rng.next() * pool.length)] || pool[0];
    const def = scaleEnemy(raw, level);
    this.player.power = this.economy.equipStats().atkPower;
    const bonusStrength = this.player.power + this.economy.consumePendingPower();
    this._arenaBattle = tier;
    this.currentBattle = new Battle({
      player: this.player, deck: this.deck, enemyDef: def, rng: this.rng, bus: this.bus,
      bonusStrength, pet: this._activePet(),
    });
    this.ui.bindBattle(this.currentBattle);
    this.transition(GameState.BATTLE);
    this.currentBattle.start();
    this._applyBattleStartBlock();
  },

  _onArenaEnd(result) {
    const tier = this._arenaBattle;
    this._arenaBattle = null;
    this.currentBattle = null;
    if (result === 'victory' && tier) {
      const prize = Math.round(tier.entry * tier.mul);
      this.economy.gold += prize;
      this.ui.showToast(`角斗获胜!赢得 ${prize} 金币(净赚 ${prize - tier.entry})`);
    } else {
      this.ui.showToast(tier ? '角斗落败,报名费打了水漂' : '角斗中止');
    }
    this._openFacility('tavern');
    this._autosave();
  },

  // ----- 神秘商店 -----
  _mysteryBuy(id) {
    const it = ITEMS[id];
    if (!it) return;
    const seed = this.rng?.seed ?? 1;
    const price = mysteryPrice(id, seed, exchangeTick(Date.now()));
    if (this.economy.gold < price) { this.ui.showToast(`金币不足(需 ${price})`); return; }
    if (!this.economy.canHold(id)) { this.ui.showToast('背包已满,请先扩容或清理'); return; }
    this.economy.gold -= price;
    this.economy.addItem(id, 1);
    this.economy.notePurchase(id);
    this.ui.showToast(`购得珍品「${it.name}」(${price} 金币)`);
    this._facilityRefresh();
  },

  // ----- 银行:定期存款 / 兑换交易币 -----
  _bankDeposit(termId, amount) {
    const seed = this.rng?.seed ?? 1;
    const term = BANK_TERMS.find((t) => t.id === termId);
    if (!term) return;
    const rate = bankRate(termId, seed, exchangeTick(Date.now()));
    const n = Math.floor(Number(amount) || 0);
    const dep = this.economy.bankDeposit(n, term, rate);
    if (!dep) { this.ui.showToast('金额无效或金币不足'); return; }
    this.ui.showToast(`存入 ${n} 金币,${term.name}后可得利息 ${Math.round(n * rate)}`);
    this._facilityRefresh();
  },

  _bankWithdraw(depositId) {
    const r = this.economy.bankWithdraw(depositId);
    if (!r) { this.ui.showToast('没有这笔存款'); return; }
    this.ui.showToast(r.matured
      ? `取回本息 ${r.principal + r.interest} 金币(利息 ${r.interest})`
      : `未到期,仅取回本金 ${r.principal} 金币(无利息)`);
    this._facilityRefresh();
  },

  _bankExchange(dir, tokenId, qty) {
    const it = ITEMS[tokenId];
    if (!it) return;
    const seed = this.rng?.seed ?? 1;
    const rate = tokenRate(tokenId, seed, exchangeTick(Date.now()));
    const n = Math.max(1, Math.floor(Number(qty) || 0));
    if (dir === 'buy') {
      const cost = Math.round(rate * n * (1 + TOKEN_EX_FEE));
      if (this.economy.gold < cost) { this.ui.showToast(`金币不足(需 ${cost})`); return; }
      if (!this.economy.canHold(tokenId)) { this.ui.showToast('背包已满,请先扩容或清理'); return; }
      this.economy.gold -= cost;
      this.economy.addItem(tokenId, n);
      this.ui.showToast(`以 ${cost} 金币兑得 ${n} 枚${it.name}(现价 ${rate}/枚)`);
    } else {
      if (this.economy.count(tokenId) < n) { this.ui.showToast(`${it.name}不足`); return; }
      this.economy.removeItem(tokenId, n);
      const gain = Math.round(rate * n * (1 - TOKEN_EX_FEE));
      this.economy.gold += gain;
      this.ui.showToast(`${n} 枚${it.name}兑得 ${gain} 金币(现价 ${rate}/枚)`);
    }
    this._facilityRefresh();
  },

  // ----- 交易所:投资标的 -----
  _investBuy(projectId, units) {
    const seed = this.rng?.seed ?? 1;
    const price = investPrice(projectId, seed, exchangeTick(Date.now()));
    const n = Math.max(1, Math.floor(Number(units) || 0));
    const got = this.economy.investBuy(projectId, n, price);
    if (!got) { this.ui.showToast(`金币不足(需 ${n * price})`); return; }
    this.ui.showToast(`买入 ${got} 份,成本 ${got * price} 金币(单价 ${price})`);
    this._facilityRefresh();
  },

  _investSell(projectId, units) {
    const seed = this.rng?.seed ?? 1;
    const price = investPrice(projectId, seed, exchangeTick(Date.now()));
    const r = this.economy.investSell(projectId, units, price);
    if (!r) { this.ui.showToast('没有可卖出的份额'); return; }
    this.ui.showToast(`卖出 ${r.units} 份,得 ${r.gain} 金币(${r.profit >= 0 ? '盈利' : '亏损'} ${Math.abs(r.profit)})`);
    this._facilityRefresh();
  },

  // ----- 仓库:收费寄存 -----
  _warehouseStore(id, qty) {
    const it = ITEMS[id];
    if (!it) return;
    const n = Math.max(1, Math.floor(Number(qty) || 1));
    const fee = warehouseFee(id, n);
    if (this.economy.gold < fee) { this.ui.showToast(`管理费不足(需 ${fee})`); return; }
    const got = this.economy.warehouseStore(id, n);
    if (!got) { this.ui.showToast('背包中没有该物品'); return; }
    this.economy.gold -= fee;
    this.ui.showToast(`存入「${it.name}」×${got}(管理费 ${fee})`);
    this._facilityRefresh();
  },

  _warehouseWithdraw(id, qty) {
    const it = ITEMS[id];
    if (!it) return;
    const n = Math.max(1, Math.floor(Number(qty) || 1));
    const fee = warehouseFee(id, n);
    if (this.economy.gold < fee) { this.ui.showToast(`管理费不足(需 ${fee})`); return; }
    const got = this.economy.warehouseWithdraw(id, n);
    if (!got) { this.ui.showToast('仓库中没有该物品或背包已满'); return; }
    this.economy.gold -= fee;
    this.ui.showToast(`取出「${it.name}」×${got}(管理费 ${fee})`);
    this._facilityRefresh();
  },

  // ----- 酒店服务生:代存与跑腿 -----
  _escrowStoreGold(amount) {
    const n = Math.floor(Number(amount) || 0);
    const fee = Math.max(1, Math.round(n * BELLHOP.goldFeeRate));
    if (n <= 0 || this.economy.gold < n + fee) { this.ui.showToast(`金币不足(含保管费 ${fee})`); return; }
    const got = this.economy.escrowStoreGold(n);
    if (!got) { this.ui.showToast('金额无效'); return; }
    this.economy.gold -= fee;
    this.ui.showToast(`服务生代管 ${got} 金币(保管费 ${fee})`);
    this._facilityRefresh();
  },

  _escrowWithdrawGold(amount) {
    const got = this.economy.escrowWithdrawGold(Math.floor(Number(amount) || 0));
    this.ui.showToast(got > 0 ? `取回代管金币 ${got}` : '代管金币不足或金额无效');
    this._facilityRefresh();
  },

  _escrowStoreItem(id) {
    if (!ITEMS[id]) return;
    const got = this.economy.escrowStoreItem(id, 1, BELLHOP.escrowKinds);
    this.ui.showToast(got > 0
      ? `服务生代管一「${ITEMS[id].name}」`
      : `背包没有该物品,或代管已达 ${BELLHOP.escrowKinds} 种上限`);
    this._facilityRefresh();
  },

  _escrowWithdrawItem(id) {
    if (!ITEMS[id]) return;
    const got = this.economy.escrowWithdrawItem(id, 1);
    this.ui.showToast(got > 0 ? `取回「${ITEMS[id].name}」` : '代管中没有该物品或背包已满');
    this._facilityRefresh();
  },

  /** 跑腿代购:付费后按真实时间送达(与玩家自己跑一趟相当) */
  _errandPlace(itemId) {
    const it = ITEMS[itemId];
    if (!it) return;
    const base = this.economy.itemPrice ? this.economy.itemPrice(itemId) : it.price;
    const fee = Math.max(1, Math.round(base * BELLHOP.errandFee));
    const cost = base + fee;
    if (this.economy.gold < cost) { this.ui.showToast(`金币不足(需 ${cost})`); return; }
    if (!this.economy.canHold(itemId)) { this.ui.showToast('背包已满,请先扩容或清理'); return; }
    this.economy.gold -= cost;
    this.economy.errandAdd(itemId, 1, Date.now() + BELLHOP.errandSeconds * 1000);
    this.ui.showToast(`已托服务生代购「${it.name}」,约 ${BELLHOP.errandSeconds} 秒后送达`);
    this._facilityRefresh();
  },

  _errandClaim(errandId) {
    const e = this.economy.errandClaim(errandId);
    if (!e) { this.ui.showToast('还没送到,再等等'); return; }
    this.ui.showToast(`服务生送回「${ITEMS[e.itemId]?.name || e.itemId}」×${e.qty}`);
    this._facilityRefresh();
  },

  // ===== 商市 =====
  _openMarketPoi(poi) {
    this.ui.renderMarketPoi({
      name: poi.name,
      merchants: MARKET_MERCHANTS,
      economy: this.economy,
    });
    this.transition(GameState.MARKET_POI);
  },

  /** 商市选择某个商人 */
  _marketPoiSelectMerchant(merchantId) {
    if (merchantId === 'weapon') this._openWeaponMerchant();
    else if (merchantId === 'armor') this._openArmorMerchant();
    else if (merchantId === 'medicine') this._openMedicineMerchant();
  },

  _openWeaponMerchant() {
    this._currentMerchant = 'weapon';
    // 只卖常规武器:排除锻造武器与已镶嵌武器(不可买卖)
    const weapons = Object.values(ITEMS).filter((it) => it.category === 'weapon' && !it.forged && !it.noTrade && !(it.gems && it.gems.length));
    const career = this.engine?.career?.id;
    this.ui.renderMerchant({
      title: '武器商',
      icon: '⚔️',
      desc: '按职业出售各式武器,不同武器效果各异',
      items: weapons,
      economy: this.economy,
      career,
    });
  },

  _openArmorMerchant() {
    this._currentMerchant = 'armor';
    // 防具与服饰是两个独立品类:防具商只卖 category === 'armor' 的护甲,绝不混入服饰
    let armors = Object.values(ITEMS).filter((it) => it.category === 'armor');
    // 市场档位以上(>100 级)的防具只能靠镶嵌升阶,不在普通商人处出售
    armors = armors.filter((it) => (it.level || 1) <= ARMOR_MARKET_MAX);
    this.ui.renderMerchant({
      title: '防具商',
      icon: '🛡️',
      desc: '出售护甲与护具(独立于服饰系统,可穿戴在人物身上)',
      items: armors,
      economy: this.economy,
    });
  },

  _openMedicineMerchant() {
    this._currentMerchant = 'medicine';
    const meds = Object.values(ITEMS).filter((it) => it.category === 'potion');
    this.ui.renderMerchant({
      title: '药商',
      icon: '🧪',
      desc: '出售各类药品与解毒剂',
      items: meds,
      economy: this.economy,
    });
  },

  _merchantBuy(id) {
    const it = ITEMS[id];
    if (!it) return;
    if (this.economy.buy(id)) this.ui.showToast(`购入「${it.name}」`);
    else this.ui.showToast('金币不足');
    this._syncUi();
    // 刷新当前商人界面(更新金币与可购买状态)
    if (this._currentMerchant === 'weapon') this._openWeaponMerchant();
    else if (this._currentMerchant === 'armor') this._openArmorMerchant();
    else if (this._currentMerchant === 'medicine') this._openMedicineMerchant();
    this._autosave();
  },

  // ===== 铁匠铺:锻造(材料 + 金币 + 图纸 → 特殊武器) =====
  _openBlacksmith() {
    const recipes = FORGE_RECIPES.map((r) => {
      const result = ITEMS[r.result];
      const unlocked = this.economy.hasBlueprint(r.blueprint);
      const mats = Object.entries(r.materials).map(([mid, q]) => ({
        id: mid, name: ITEMS[mid]?.name || mid, icon: ITEMS[mid]?.icon || '📦',
        need: q, have: this.economy.count(mid),
      }));
      const canMats = mats.every((m) => m.have >= m.need);
      const canGold = this.economy.gold >= r.gold;
      return { ...r, result, unlocked, mats, canMats, canGold, canForge: unlocked && canMats && canGold };
    });
    this.ui.renderBlacksmith({
      recipes,
      economy: this.economy,
      name: STALL_CN.blacksmith,
    });
    this.transition(GameState.BLACKSMITH);
  },

  /** 锻造:消耗材料 + 金币,产出特殊武器(不可买卖) */
  _forge(recipeId) {
    const r = FORGE_RECIPES.find((x) => x.id === recipeId);
    if (!r) return;
    if (!this.economy.hasBlueprint(r.blueprint)) { this.ui.showToast('尚未解锁该配方(需要对应图纸)'); return; }
    for (const [mid, q] of Object.entries(r.materials)) {
      if (this.economy.count(mid) < q) { this.ui.showToast(`材料不足:${ITEMS[mid]?.name || mid} ×${q}`); return; }
    }
    if (this.economy.gold < r.gold) { this.ui.showToast(`金币不足(需 ${r.gold})`); return; }
    if (!this.economy.canHold(r.result)) { this.ui.showToast('背包已满,请先扩容或清理'); return; }
    for (const [mid, q] of Object.entries(r.materials)) this.economy.removeItem(mid, q);
    this.economy.gold -= r.gold;
    this.economy.addItem(r.result, 1);
    this.ui.showToast(`🔨 锻造成功:获得「${ITEMS[r.result].name}」`);
    this._openBlacksmith();
    this._syncPlayerStats();
    this._syncUi();
    this._autosave();
  },

  // ===== 宝石商:售卖宝石(随市场浮动定价) =====
  _openGemshop() {
    this.trade?.refresh();
    const gems = Object.values(GEM_ITEMS).filter((g) => !g.myth).map((g) => {
      const price = this.trade ? this.trade.marketAvg(g.id) : g.price;
      return { ...g, price, trend: this.trade ? this.trade.priceTrend(g.id) : 1 };
    });
    this.ui.renderGemshop({ gems, economy: this.economy, name: STALL_CN.gemshop });
    this.transition(GameState.GEMSHOP);
  },

  _gemshopBuy(id) {
    const g = ITEMS[id];
    if (!g) return;
    const price = this.trade ? this.trade.marketAvg(id) : g.price;
    if (this.economy.gold < price) { this.ui.showToast(`金币不足(需 ${price})`); return; }
    if (!this.economy.canHold(id)) { this.ui.showToast('背包已满,请先扩容或清理'); return; }
    this.economy.gold -= price;
    this.economy.addItem(id, 1);
    this.ui.showToast(`购入「${g.name}」(花费 ${price} 金币)`);
    this._openGemshop();
    this._syncUi();
    this._autosave();
  },

  // ===== 精益师:把宝石镶嵌进武器 / 防具 =====
  _openJeweler() {
    const weapons = [];
    const armors = [];
    const gems = [];
    for (const [id, qty] of this.economy.bag.entries()) {
      const def = ITEMS[id];
      if (!def) continue;
      if (def.category === 'weapon') weapons.push({ id, qty, def, free: socketsOf(id), gems: def.gems || [] });
      else if (def.category === 'armor') armors.push({ id, qty, def, free: socketsOf(id), gems: def.gems || [] });
      else if (def.category === 'gem') gems.push({ id, qty, def });
    }
    this.ui.renderJeweler({
      weapons, armors, gems, economy: this.economy, cost: SOCKET_GOLD_PER_GEM, name: STALL_CN.jeweler,
    });
    this.transition(GameState.JEWELER);
  },

  /** 镶嵌:消耗金币,把宝石镶进武器的空槽 */
  _socket(weaponId, gemId) {
    const w = ITEMS[weaponId];
    const g = ITEMS[gemId];
    if (!w || !g) return;
    if (socketsOf(weaponId) <= 0) { this.ui.showToast('该武器已无空余宝石槽'); return; }
    if (!this.economy.has(weaponId) || !this.economy.has(gemId)) { this.ui.showToast('物品不在背包中'); return; }
    if (this.economy.gold < SOCKET_GOLD_PER_GEM) { this.ui.showToast(`金币不足(镶嵌需 ${SOCKET_GOLD_PER_GEM})`); return; }
    this.economy.gold -= SOCKET_GOLD_PER_GEM;
    const created = this.economy.socketGem(weaponId, gemId);
    if (!created) { this.economy.gold += SOCKET_GOLD_PER_GEM; this.ui.showToast('镶嵌失败'); return; }
    this.ui.showToast(`🔧 镶嵌成功:${ITEMS[created].name}`);
    this._openJeweler();
    this._syncPlayerStats();
    this._syncUi();
    this._autosave();
  },

  /** 镶嵌:把宝石镶进防具(每颗 +10 级,上限 150) */
  _socketArmor(armorId, gemId) {
    const a = ITEMS[armorId];
    const g = ITEMS[gemId];
    if (!a || !g) return;
    if (socketsOf(armorId) <= 0) { this.ui.showToast('该防具已无空余宝石槽'); return; }
    if (!this.economy.has(armorId) || !this.economy.has(gemId)) { this.ui.showToast('物品不在背包中'); return; }
    if (this.economy.gold < SOCKET_GOLD_PER_GEM) { this.ui.showToast(`金币不足(镶嵌需 ${SOCKET_GOLD_PER_GEM})`); return; }
    this.economy.gold -= SOCKET_GOLD_PER_GEM;
    const created = this.economy.socketArmorGem(armorId, gemId);
    if (!created) { this.economy.gold += SOCKET_GOLD_PER_GEM; this.ui.showToast('镶嵌失败'); return; }
    this.ui.showToast(`🔧 镶嵌成功:${ITEMS[created].name}`);
    this._openJeweler();
    this._syncPlayerStats();
    this._syncUi();
    this._autosave();
  },

  /** 取下武器最后一颗宝石(可能碎成碎片) */
  _unsocket(weaponId) {
    const r = this.economy.unsocketGem(weaponId);
    if (!r) { this.ui.showToast('该武器没有可取下的宝石'); return; }
    this.ui.showToast(r.shattered ? '宝石取下时碎裂了,只余下一点碎片' : '宝石完好取下,已放回背包');
    this._openJeweler();
    this._syncPlayerStats();
    this._syncUi();
    this._autosave();
  },

  /** 取下防具最后一颗宝石(可能碎成碎片) */
  _unsocketArmor(armorId) {
    const r = this.economy.unsocketArmorGem(armorId);
    if (!r) { this.ui.showToast('该防具没有可取下的宝石'); return; }
    this.ui.showToast(r.shattered ? '宝石取下时碎裂了,只余下一点碎片' : '宝石完好取下,已放回背包');
    this._openJeweler();
    this._syncPlayerStats();
    this._syncUi();
    this._autosave();
  },

  /** 发放一张图纸并直接解锁配方 */
  _grantBlueprint(bpId) {
    if (!bpId || !ITEMS[bpId]) return null;
    if (this.economy.hasBlueprint(bpId)) return null;
    this.economy.blueprints.add(bpId);
    return ITEMS[bpId];
  },

  /** 使用背包中的图纸(解锁配方) */
  _useBlueprint(id) {
    if (!this.economy.unlockBlueprint(id)) { this.ui.showToast('无法使用该图纸'); return; }
    this.ui.showToast(`📜 已解锁配方:${ITEMS[id]?.name || id}`);
    this._syncUi();
    this._autosave();
    if (this.state === GameState.BAG) this._openBag();
  },

};
