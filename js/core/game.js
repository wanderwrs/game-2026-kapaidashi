/**
 * Game — 顶层游戏状态机与运行控制器。
 *
 * 流程:菜单 → (地区)地图 → 抵达地点/找到 NPC → 剧情(文字抉择) → 战斗 → 战利品 → …
 *       途中可在市场买卖、背包装备、打工赚钱、休息恢复行动力。
 *
 * 说明:
 *   · 初始职业(剑术)由第一章 n06 的 effects.assign_career 自动锁定;
 *     直接进入后续章节时预分配剑术职业。
 *   · 剧情按地区「地点」分段,引擎在锚点暂停,必须在地图上抵达该地点才能开启该段。
 *   · 战斗失败:退回地区起点,损失部分金币,并须重新抵达该地点再战。
 */

import { RNG, seedFromString } from './rng.js';
import { EventBus } from './eventbus.js';
import { AudioEngine } from './audio.js';
import { Player } from '../combat/entity.js';
import { Deck } from '../card/deck.js';
import { Battle } from '../combat/battle.js';
import { CARDS, ENEMIES, scaleEnemy } from '../data/data.js';
import { ITEMS, SHOP_STOCK, LOOT_MISC } from '../data/items.js';
import { REGIONS, JOBS, REST_AP_RECOVER } from '../data/regions.js';
import { Economy } from './economy.js';
import { NarrativeEngine, ENDINGS } from '../narrative/engine.js';
import { CHAPTERS, CHAPTER_ORDER } from '../narrative/chapters/index.js';
import { UI } from '../ui/ui.js';

const PROGRESS_KEY = 'longji.progress.v1';

/** 读取本机通关进度(记录哪些大章已通关) */
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch { return {}; }
}

/** 将某大章标记为已通关,返回更新后的进度 */
function markChapterCleared(id) {
  const p = loadProgress();
  p.cleared = p.cleared || {};
  p.cleared[id] = true;
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* 忽略存储异常 */ }
  return p;
}

export const GameState = Object.freeze({
  MENU: 'menu',
  CAREER: 'career',
  NARRATIVE: 'narrative',
  MAP: 'map',
  SHOP: 'shop',
  BAG: 'bag',
  JOB: 'job',
  BATTLE: 'battle',
  REWARD: 'reward',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
});

export class Game {
  constructor(rootEl) {
    this.bus = new EventBus();
    this.ui = new UI(rootEl, this.bus);
    this.state = GameState.MENU;
    this.rng = null;
    this.player = null;
    this.deck = null;
    this.career = null;
    this.engine = null;
    this.economy = null;
    this.currentBattle = null;
    this._currentRewards = null;
    this._runStartChapter = null;   // 本局起始大章(用于通关判定)
    this.regionId = null;           // 当前地区(=章节)
    this.stopIndex = 0;             // 当前所在地点索引
    this.segment = null;            // 当前剧情段落 { chapterId, nodeId, stopIndex }
    this.audio = new AudioEngine();
    this.audio.arm();
    this.progress = loadProgress();
    this._bindUI();
    // 主菜单:标识两大章 + 通关解锁状态
    this.ui.renderChapterSelect(this._chapterEntries());
    this.ui.setMusicState(this.audio.enabled);
    this.transition(GameState.MENU);
  }

  /**
   * 开始新一局。
   * @param {string|number} [seedInput] 指定种子
   * @param {string} [startChapter] 起始章节(默认第一大章 ch01)
   */
  startNewRun(seedInput, startChapter = 'ch01') {
    const seed = seedInput
      ? (typeof seedInput === 'number' ? seedInput >>> 0 : seedFromString(String(seedInput)))
      : (Date.now() & 0xffffffff) >>> 0;

    this.rng = new RNG(seed);
    this.player = new Player({ maxHp: 70 });
    this.deck = null;
    this.career = null;
    this.currentBattle = null;
    this._currentRewards = null;
    this.regionId = startChapter;
    this.stopIndex = 0;
    this.segment = null;

    // 经济:初始一点金币与补给
    this.economy = new Economy({ gold: 40, apMax: 10 });
    this.economy.addItem('hp_small', 2);
    this.economy.addItem('bread', 2);
    this.ui.economy = this.economy;

    this.engine = new NarrativeEngine({ rng: this.rng, bus: this.bus, chapters: CHAPTERS });
    this.engine.setGates(this._buildGates());
    this.engine.player = this.player;
    this.ui.bindEngine(this.engine);
    this.ui.updateSeed(this.rng.seed);
    this._runStartChapter = startChapter;
    // 直接进入非第一章时,预分配默认职业(剑术)并建立牌组
    if (startChapter !== 'ch01') this.engine.assignCareer('swordsman');
    this._syncPlayerStats();
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
    this._syncUi();

    // 进入章节:首个地点锚点会触发 narrative:gate → 切到地区地图
    this.engine.enterChapter(startChapter);
    // 兜底:若该章不在地区表内(不会发生),直接进入剧情
    if (this.state !== GameState.MAP) this.transition(GameState.NARRATIVE);
    this.audio.start();
  }

  /** 收集各章的门控锚点(每章所有地点节点) */
  _buildGates() {
    const g = {};
    for (const [id, region] of Object.entries(REGIONS)) g[id] = region.stops.map((s) => s.node);
    return g;
  }

  _chapterNum(chapterId = this.regionId) {
    const i = CHAPTER_ORDER.indexOf(chapterId);
    return i >= 0 ? i + 1 : 1;
  }

  /** 依据职业与装备同步玩家上限(生命 / 魔力 / 战力) */
  _syncPlayerStats() {
    if (!this.player) return;
    const st = this.economy ? this.economy.equipStats() : { maxHp: 0, maxMp: 0, atkPower: 0 };
    const c = this.engine?.career;
    this.player.maxHp = (c?.maxHp ?? 70) + st.maxHp;
    this.player.maxMp = (c?.mpMax ?? 3) + st.maxMp;
    this.player.energyMax = c?.energyMax ?? 3;
    this.player.power = st.atkPower;
    if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp;
    if (this.player.mp > this.player.maxMp) this.player.mp = this.player.maxMp;
  }

  _syncUi() {
    if (this.economy) this.ui.renderResources(this.economy);
  }

  // ===== 地图 / 地区 =====
  _mapState() {
    const region = REGIONS[this.regionId];
    const gate = this.engine?.pendingGate;
    const objectiveIndex = gate && gate.chapterId === this.regionId
      ? region.stops.findIndex((s) => s.node === gate.nodeId)
      : -1;
    return {
      regionId: this.regionId,
      region,
      chapterNum: this._chapterNum(),
      currentIndex: this.stopIndex,
      objectiveIndex,
      travelCost: region.stops.map((_, i) => this.economy.travelCost(this.stopIndex, i)),
      economy: this.economy,
    };
  }

  _renderMap() {
    this.ui.renderMap(this._mapState());
    this._syncUi();
  }

  /** 引擎暂停在门控锚点 → 记录段落并切到地图 */
  _onGate({ chapterId, nodeId }) {
    const region = REGIONS[chapterId];
    this.regionId = chapterId;
    if (!region) { this.transition(GameState.NARRATIVE); return; }
    const idx = region.stops.findIndex((s) => s.node === nodeId);
    this.stopIndex = idx >= 0 ? idx : 0;
    this.segment = { chapterId, nodeId, stopIndex: this.stopIndex };
    this._syncPlayerStats();
    this.transition(GameState.MAP);
    this._renderMap();
  }

  /** 前往地区内的另一地点(消耗行动力) */
  _travelTo(i) {
    const region = REGIONS[this.regionId];
    if (!region || i < 0 || i >= region.stops.length || i === this.stopIndex) return;
    const cost = this.economy.travelCost(this.stopIndex, i);
    if (!this.economy.spendAp(cost)) {
      this.ui.showToast('行动力不足 —— 休息一下,或吃点干粮');
      return;
    }
    this.stopIndex = i;
    this._renderMap();
    this.ui.showToast(`抵达「${region.stops[i].name}」,消耗 ${cost} 行动力`);
  }

  /** 在当前地点开启下一段剧情(必须在目标地点) */
  _beginStory() {
    const region = REGIONS[this.regionId];
    const state = this._mapState();
    if (!region || state.objectiveIndex < 0) { this.transition(GameState.NARRATIVE); return; }
    if (this.stopIndex !== state.objectiveIndex) {
      this.ui.showToast(`需先前往「${region.stops[state.objectiveIndex].name}」`);
      return;
    }
    if (this.engine.resumeGate()) this.transition(GameState.NARRATIVE);
  }

  _rest() {
    const got = this.economy.addAp(REST_AP_RECOVER);
    this.ui.showToast(got > 0 ? `休息片刻,恢复 ${got} 点行动力` : '行动力已满');
    this._renderMap();
  }

  _currentTheme() {
    const region = REGIONS[this.regionId];
    if (!region) return 'village';
    return region.stops[this.stopIndex]?.theme || region.theme || 'village';
  }

  // ===== 市场 =====
  _openShop() {
    const theme = this._currentTheme();
    this.ui.renderShop({ theme, stock: SHOP_STOCK[theme] || SHOP_STOCK.village, economy: this.economy });
    this._syncUi();
    this.transition(GameState.SHOP);
  }

  _buy(id) {
    if (!ITEMS[id]) return;
    if (this.economy.buy(id)) this.ui.showToast(`购入「${ITEMS[id].name}」`);
    else this.ui.showToast('金币不足');
    this._openShopRefresh();
  }

  _sell(id) {
    if (!this.economy.has(id)) { this.ui.showToast('背包里没有这件物品'); return; }
    if (this.economy.isEquipped(id)) { this.ui.showToast('已装备的物品需先卸下'); return; }
    const before = this.economy.gold;
    if (this.economy.sell(id)) {
      this.ui.showToast(`卖出「${ITEMS[id].name}」,获得 ${this.economy.gold - before} 金币`);
    }
    this._openShopRefresh();
  }

  _openShopRefresh() {
    const theme = this._currentTheme();
    this.ui.renderShop({ theme, stock: SHOP_STOCK[theme] || SHOP_STOCK.village, economy: this.economy });
    this._syncUi();
  }

  // ===== 背包 =====
  _openBag() {
    this.ui.renderBag({ economy: this.economy, player: this.player });
    this._syncUi();
    this.transition(GameState.BAG);
  }

  _bagRefresh() {
    this.ui.renderBag({ economy: this.economy, player: this.player });
    this._syncUi();
  }

  _useItem(id) {
    const r = this.economy.useItem(id, this.player);
    this.ui.showToast(r.msg);
    this._bagRefresh();
    if (this.state === GameState.BATTLE && this.currentBattle) this.currentBattle._refresh();
  }

  _equipItem(id) {
    if (!this.economy.equip(id)) { this.ui.showToast('无法装备'); return; }
    this._syncPlayerStats();
    this.ui.showToast(`装备「${ITEMS[id].name}」`);
    this._bagRefresh();
  }

  _unequipItem(slot) {
    if (!this.economy.unequip(slot)) return;
    this._syncPlayerStats();
    this._bagRefresh();
  }

  _dropItem(id) {
    if (this.economy.isEquipped(id)) { this.ui.showToast('已装备的物品需先卸下'); return; }
    if (this.economy.dropItem(id, 1)) this.ui.showToast(`丢弃了「${ITEMS[id].name}」`);
    this._bagRefresh();
  }

  // ===== 打工 =====
  _openJobs() {
    const theme = this._currentTheme();
    this.ui.renderJobs({ theme, jobs: JOBS[theme] || JOBS.village, economy: this.economy });
    this._syncUi();
    this.transition(GameState.JOB);
  }

  _doJob(id) {
    const theme = this._currentTheme();
    const job = (JOBS[theme] || JOBS.village).find((j) => j.id === id);
    if (!job) return;
    if (!this.economy.spendAp(job.ap)) { this.ui.showToast('行动力不足,先休息一下'); return; }
    this.economy.gold += job.gold;
    this.ui.showToast(`「${job.name}」,赚得 ${job.gold} 金币`);
    this.ui.renderJobs({ theme, jobs: JOBS[theme] || JOBS.village, economy: this.economy });
    this._syncUi();
  }

  _backToMap() {
    if (this.regionId && REGIONS[this.regionId]) {
      this.transition(GameState.MAP);
      this._renderMap();
    } else {
      this.transition(GameState.NARRATIVE);
    }
  }

  // ===== 战斗 =====
  /** 剧情节点要求开战:按地区进度从敌人池中选取(小怪 → 首领),并叠加章节难度 */
  _startNarrativeBattle({ poolKey }) {
    if (!this.deck) {
      const base = ['strike', 'strike', 'strike', 'defend', 'defend', 'cleave', 'pommel', 'shield_bash'];
      this.deck = new Deck(base.map((id) => CARDS[id]).filter(Boolean), this.rng);
    }
    const pool = ENEMIES[poolKey] || ENEMIES.normal;
    const region = REGIONS[this.regionId];
    const ratio = region && region.stops.length > 1 ? this.stopIndex / (region.stops.length - 1) : 0;
    const idx = Math.min(pool.length - 1, Math.round(ratio * (pool.length - 1)));
    const def = scaleEnemy(pool[idx] || pool[0], this._chapterNum());

    // 战力 = 装备加成 + 战力药剂(一次性)
    this.player.power = this.economy.equipStats().atkPower;
    const bonusStrength = this.player.power + this.economy.consumePendingPower();

    this.currentBattle = new Battle({
      player: this.player,
      deck: this.deck,
      enemyDef: def,
      rng: this.rng,
      bus: this.bus,
      bonusStrength,
    });
    this.ui.bindBattle(this.currentBattle);
    this.transition(GameState.BATTLE);
    this.currentBattle.start();
  }

  onBattleEnd(result) {
    // 非剧情战斗(框架战斗):直接进结算
    if (!this.engine || !this.engine._pendingBattle) {
      this.transition(result === 'victory' ? GameState.VICTORY : GameState.DEFEAT);
      return;
    }
    if (result === 'victory') {
      this._grantBattleRewards();
      const cards = this._rollRewards(3);
      if (cards.length === 0) { this._resolveAfterBattle('victory'); return; }
      this._currentRewards = cards;
      this.ui.renderRewards(cards, this._lastBattleReward);
      this.transition(GameState.REWARD);
    } else {
      this._onDefeat();
    }
  }

  /** 胜利奖励:金币 + 概率掉落杂物 */
  _grantBattleRewards() {
    const ch = this._chapterNum();
    const gold = 8 + Math.floor(this.rng.next() * 6) + ch * 2;
    this.economy.gold += gold;
    let loot = null;
    if (this.rng.next() < 0.5) {
      loot = LOOT_MISC[Math.floor(this.rng.next() * LOOT_MISC.length)];
      this.economy.addItem(loot, 1);
    }
    this._lastBattleReward = { gold, loot };
    this._syncUi();
  }

  /** 战败:退回地区起点、损失金币,并须重新抵达该地点再战 */
  _onDefeat() {
    this.engine._pendingBattle = null;
    const region = REGIONS[this.regionId];
    const penalty = Math.max(10, Math.floor(this.economy.gold * 0.15));
    this.economy.gold = Math.max(0, this.economy.gold - penalty);
    this.stopIndex = 0;
    this._syncPlayerStats();
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;

    const seg = this.segment;
    if (seg) this.engine.rearmGate(seg.chapterId, seg.nodeId);

    this._syncUi();
    this.transition(GameState.MAP);
    this._renderMap();
    const back = seg && region ? region.stops[seg.stopIndex]?.name : '';
    this.ui.showToast(`你倒下了……退回「${region?.stops[0]?.name || '起点'}」,损失 ${penalty} 金币${back ? `。回到「${back}」重新挑战` : ''}`);
  }

  /** 战斗结果交回剧情引擎,并跳到对应视图(结局节点直接进结算) */
  _resolveAfterBattle(result) {
    this._currentRewards = null;
    this.engine.onBattleResult(result);
    // 战后的下一节点若是门控锚点,引擎已切到地区地图,勿再覆盖
    if (this.state === GameState.MAP) return;
    const node = this.engine.currentNode;
    if (node && node.kind === 'ending') this.transition(GameState.VICTORY);
    else this.transition(GameState.NARRATIVE);
  }

  /** 随机抽取 n 张非基础卡作为战利品 */
  _rollRewards(n) {
    const pool = Object.values(CARDS).filter((c) => c.rarity && c.rarity !== 'basic');
    const picked = [];
    const used = new Set();
    let guard = 0;
    while (picked.length < n && used.size < pool.length && guard++ < 300) {
      const c = pool[Math.floor(this.rng.next() * pool.length)];
      if (!c || used.has(c.id)) continue;
      used.add(c.id);
      picked.push(c);
    }
    return picked;
  }

  /**
   * 选择/切换职业(由 ui:choose-career 触发)。
   * 实际切换逻辑在 engine.switchCareer + narrative:career-chosen 监听器中统一处理。
   */
  chooseCareer(careerId) {
    this._switchCareer(careerId);
  }

  /** switch_career 节点:玩家选择切换到某个已解锁职业 */
  _switchCareer(careerId) {
    if (!this.engine) return;
    this.engine.switchCareer(careerId);
    // narrative:career-chosen 监听器会重建牌组并刷新 UI
  }

  /** 主菜单两大章条目(含通关 / 解锁状态) */
  _chapterEntries() {
    const cleared = this.progress?.cleared || {};
    return [
      {
        id: 'ch01',
        badge: '第一大章',
        title: '家园破碎',
        sub: '第一章 · 主线 + 4 条支线 · 约 5 万字',
        locked: false,
        cleared: !!cleared.ch01,
      },
      {
        id: 'ch02',
        badge: '第二大章',
        title: '踏上旅程',
        sub: '第二章 · 主线 + 2 条支线 · 约 11 万字',
        locked: !cleared.ch01,
        cleared: !!cleared.ch02,
      },
    ];
  }

  /** 检测本局是否离开了起始大章;若是,则记录该大章通关 */
  _checkChapterClear(snap) {
    const start = this._runStartChapter;
    if (!snap?.chapter || !start) return;
    if (snap.chapter === start) return;
    if (this.progress?.cleared?.[start]) return;
    this.progress = markChapterCleared(start);
    this.ui.renderChapterSelect(this._chapterEntries());
    const name = start === 'ch01' ? '第一大章「家园破碎」' : '第二大章「踏上旅程」';
    this.ui.showToast(`✦ ${name} 已通关 —— 新的旅程已解锁`);
  }

  transition(next) {
    this.state = next;
    this.ui.showView(next);
    this.bus.emit('state:change', next);
  }

  _bindUI() {
    this.bus.on('ui:start-chapter', (id) => this.startNewRun(undefined, id));
    this.bus.on('ui:toggle-music', () => {
      const on = this.audio.toggle();
      this.ui.setMusicState(on);
    });
    this.bus.on('ui:seed-run', () => {
      const input = window.prompt('输入种子(数字或字符串):', '');
      if (input !== null) this.startNewRun(input);
    });
    this.bus.on('ui:choose-career', (id) => this.chooseCareer(id));
    this.bus.on('ui:switch-career', (id) => this._switchCareer(id));
    this.bus.on('ui:narrative-choose', (i) => this.engine?.choose(i));
    this.bus.on('ui:narrative-next', () => {
      if (this.engine?.currentNode?.next) this.engine.goto(this.engine.currentNode.next);
    });
    this.bus.on('ui:end-turn', () => this.currentBattle?.endPlayerTurn());
    this.bus.on('ui:restart', () => this.startNewRun());

    // 地区地图
    this.bus.on('ui:map-travel', (i) => this._travelTo(i));
    this.bus.on('ui:map-story', () => this._beginStory());
    this.bus.on('ui:map-rest', () => this._rest());
    this.bus.on('ui:map-shop', () => this._openShop());
    this.bus.on('ui:map-job', () => this._openJobs());
    this.bus.on('ui:map-bag', () => this._openBag());
    this.bus.on('ui:back-map', () => this._backToMap());

    // 市场 / 背包 / 打工
    this.bus.on('ui:shop-buy', (id) => this._buy(id));
    this.bus.on('ui:shop-sell', (id) => this._sell(id));
    this.bus.on('ui:bag-use', (id) => this._useItem(id));
    this.bus.on('ui:bag-equip', (id) => this._equipItem(id));
    this.bus.on('ui:bag-unequip', (slot) => this._unequipItem(slot));
    this.bus.on('ui:bag-drop', (id) => this._dropItem(id));
    this.bus.on('ui:job-work', (id) => this._doJob(id));

    this.bus.on('battle:end', (result) => this.onBattleEnd(result));
    this.bus.on('narrative:battle', (payload) => this._startNarrativeBattle(payload));
    this.bus.on('narrative:gate', (g) => this._onGate(g));

    // 战利品:选中加入牌组 / 放弃
    this.bus.on('ui:pick-reward', (id) => {
      const card = CARDS[id];
      if (card && this.deck) this.deck.addToMaster(card);
      this._resolveAfterBattle('victory');
    });
    this.bus.on('ui:skip-reward', () => this._resolveAfterBattle('victory'));

    this.bus.on('narrative:refresh', (snap) => {
      // 离开起始大章 → 记录通关,解锁下一大章
      this._checkChapterClear(snap);
      // 若节点是 ending,直接转 VICTORY 触发结局展示
      if (snap.node?.kind === 'ending' && this.state === GameState.NARRATIVE) {
        this.transition(GameState.VICTORY);
      }
    });

    // 职业初始分配/切换后:重建牌组、同步玩家数值
    this.bus.on('narrative:career-chosen', () => {
      const c = this.engine?.career;
      if (!c) return;
      this.career = c;
      this.deck = new Deck(c.starterDeck.map((id) => CARDS[id]).filter(Boolean), this.rng);
      this._syncPlayerStats();
      this.player.hp = this.player.maxHp;
      this.player.mp = this.player.maxMp;
      if (this.state === GameState.NARRATIVE) this.ui.renderResources(this.economy);
    });
  }
}

// ENDINGS 通过 engine 暴露给 UI;此处保留引用以便调试
export { ENDINGS };
