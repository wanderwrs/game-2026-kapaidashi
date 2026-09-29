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

import { RNG, seedFromString } from './rng.js?v=20260929k';
import { EventBus } from './eventbus.js?v=20260929k';
import { AudioEngine } from './audio.js?v=20260929k';
import { Player } from '../combat/entity.js?v=20260929k';
import { Deck } from '../card/deck.js?v=20260929k';
import { Battle } from '../combat/battle.js?v=20260929k';
import { CARDS, ENEMIES, scaleEnemy } from '../data/data.js?v=20260929k';
import { ITEMS, SHOP_STOCK, LOOT_MISC } from '../data/items.js?v=20260929k';
import { REGIONS, REST_AP_RECOVER } from '../data/regions.js?v=20260929k';
import { jobsFor } from '../data/jobs.js?v=20260929k';
import {
  WORLD, regionDistance, stopDistance, tripSeconds, travelApCost, shuttleGold, levelLabel,
  regionTerrain, TERRAIN_CN,
} from '../data/world.js?v=20260929k';
import { NPCS } from '../data/npcs.js?v=20260929k';
import { CHESTS, CHEST_MAP, chestAt } from '../data/chests.js?v=20260929k';
import { TALK_TOPICS, TALK_MAX_LINES } from '../data/talk.js?v=20260929k';
import { Economy } from './economy.js?v=20260929k';
import { Travel } from './travel.js?v=20260929k';
import { NarrativeEngine, ENDINGS } from '../narrative/engine.js?v=20260929k';
import { CHAPTERS, CHAPTER_ORDER } from '../narrative/chapters/index.js?v=20260929k';
import { UI } from '../ui/ui.js?v=20260929k';

const PROGRESS_KEY = 'longji.progress.v1';
const TUTORIAL_KEY = 'longji.tutorial.v1';
/** 途中遭遇可用的随机 NPC 上限(每次最多出现的候选数) */
const MAX_STOP_NPCS = 3;

/** 教程是否已看过 */
function loadTutorialSeen() {
  try { return localStorage.getItem(TUTORIAL_KEY) === '1'; } catch { return false; }
}

/** 记录教程已看过 */
function markTutorialSeen() {
  try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* 忽略存储异常 */ }
}

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
  WORLD: 'world',
  TRAVEL: 'travel',
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
    this.regionId = null;           // 玩家当前所在地区(=章节)
    this.storyRegionId = null;      // 剧情门控所在地区(此刻该去哪儿开剧情)
    this.stopIndex = 0;             // 当前所在地点索引
    this.segment = null;            // 当前剧情段落 { chapterId, nodeId, stopIndex }
    this.travel = null;             // 旅途控制器(实时计时)
    this._trip = null;              // 本次旅途的目的地 { kind, regionId, stopIndex }
    this._wildBattle = false;       // 当前战斗是否为途中遭遇(而非剧情战斗)
    this._npcCache = new Map();     // `${regionId}:${stopIndex}` → 驻留 NPC 列表
    this._themeNpcCache = new Map(); // theme → 该主题的 NPC 池
    this._npcTalk = null;           // 当前交谈状态(话题 / 对话记录)
    this._intel = new Map();        // 已知宝箱情报 chestId → { chestId, text }
    this._openedChests = new Set(); // 本局已开启的宝箱 id
    this._visited = new Set();      // 本局已到过的地区
    this.tutorialSeen = loadTutorialSeen();
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
    this.storyRegionId = startChapter;
    this.stopIndex = 0;
    this.segment = null;
    this._trip = null;
    this._wildBattle = false;
    this._npcCache = new Map();
    this._themeNpcCache = new Map();
    this._npcTalk = null;
    this._intel = new Map();
    this._openedChests = new Set();
    this._visited = new Set([startChapter]);
    this.travel = new Travel({ bus: this.bus, rng: this.rng });

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
    const isStoryRegion = !!gate && gate.chapterId === this.regionId;
    const objectiveIndex = isStoryRegion
      ? region.stops.findIndex((s) => s.node === gate.nodeId)
      : -1;
    const chest = chestAt(this.regionId, this.stopIndex);
    return {
      regionId: this.regionId,
      region,
      chapterNum: this._chapterNum(),
      currentIndex: this.stopIndex,
      objectiveIndex,
      isStoryRegion,
      storyRegionId: this.storyRegionId,
      travelCost: region.stops.map((_, i) => this.economy.travelCost(this.stopIndex, i)),
      travelSeconds: region.stops.map((_, i) => tripSeconds(stopDistance(this.stopIndex, i), this.economy.travelSpeedMul())),
      npcs: this._npcsAt(this.regionId, this.stopIndex),
      chest: chest ? { id: chest.id, name: chest.name, opened: this._openedChests.has(chest.id), known: this._intel.has(chest.id) } : null,
      stopChests: region.stops.map((_, i) => {
        const c = chestAt(this.regionId, i);
        return c ? { opened: this._openedChests.has(c.id), known: this._intel.has(c.id) } : null;
      }),
      intelCount: this._intel.size,
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
    this.storyRegionId = chapterId;
    if (!region) { this.transition(GameState.NARRATIVE); return; }
    const idx = region.stops.findIndex((s) => s.node === nodeId);
    // 门控开启:玩家须依剧情提示自行前往目标地点(回到地区起点,消耗行动力抵达)
    this.stopIndex = 0;
    this.segment = { chapterId, nodeId, stopIndex: idx >= 0 ? idx : 0 };
    this._syncPlayerStats();
    this.transition(GameState.MAP);
    this._renderMap();
  }

  // ===== 世界地图 / 旅途 =====
  /** 世界地图状态:全部地区 + 里程 / 耗时 / 穿梭费用 */
  _worldState() {
    const cur = this.regionId;
    const curTerrain = regionTerrain(cur);
    const speedMul = this.economy.travelSpeedMul();
    const discount = this.economy.equipStats().travelDiscount;
    // 载具的起止地形都要能通行,才算「可达」(徒步恒可)
    const canUseHere = this.economy.vehicleCanReach(curTerrain);
    const regions = Object.keys(WORLD).map((id) => {
      const dist = regionDistance(cur, id);
      const terrain = regionTerrain(id);
      return {
        id,
        name: REGIONS[id]?.name || id,
        theme: REGIONS[id]?.theme || 'village',
        x: WORLD[id].x,
        y: WORLD[id].y,
        level: WORLD[id].level,
        levelLabel: levelLabel(WORLD[id].level),
        city: !!WORLD[id].city,
        terrain,
        terrainLabel: TERRAIN_CN[terrain] || '',
        current: id === cur,
        story: id === this.storyRegionId,
        visited: this._visited.has(id),
        dist,
        seconds: tripSeconds(dist, speedMul),
        ap: travelApCost(dist, discount),
        shuttleGold: shuttleGold(dist),
        reachable: canUseHere && this.economy.vehicleCanReach(terrain),
      };
    });
    return {
      regions,
      currentId: cur,
      currentTerrain: TERRAIN_CN[curTerrain] || '',
      canUseVehicleHere: canUseHere,
      storyRegionId: this.storyRegionId,
      vehicle: this.economy.vehicleName(),
      vehicleTerrain: (this.economy.vehicleTerrain() || []).map((t) => TERRAIN_CN[t] || t),
      speedMul,
      cities: Object.keys(WORLD).filter((id) => WORLD[id].city),
      tutorialSeen: this.tutorialSeen,
      economy: this.economy,
    };
  }

  /** 打开世界地图(全部地区总览) */
  _openWorld() {
    this._visited.add(this.regionId);
    this.ui.renderWorld(this._worldState());
    this._syncUi();
    this.transition(GameState.WORLD);
    this._maybeShowTutorial();
  }

  /** 从世界地图「启程」前往某地区:花行动力 + 真实旅途时间 */
  _worldDepart(regionId) {
    if (!WORLD[regionId] || regionId === this.regionId) {
      this.ui.showToast('你已经在这里了');
      return;
    }
    const toTerrain = regionTerrain(regionId);
    if (!this.economy.vehicleCanReach(regionTerrain(this.regionId))
      || !this.economy.vehicleCanReach(toTerrain)) {
      this.ui.showToast(`「${this.economy.vehicleName()}」去不了${TERRAIN_CN[toTerrain]} —— 先在背包卸下载具(徒步不限地形)`);
      return;
    }
    const dist = regionDistance(this.regionId, regionId);
    const discount = this.economy.equipStats().travelDiscount;
    const ap = travelApCost(dist, discount);
    if (!this.economy.spendAp(ap)) {
      this.ui.showToast('行动力不足 —— 休息一下,或吃点干粮');
      return;
    }
    this._syncUi();
    this._depart({
      kind: 'region',
      regionId,
      stopIndex: 0,
      fromLabel: REGIONS[this.regionId]?.name || '此地',
      toLabel: REGIONS[regionId]?.name || regionId,
      dist,
      level: WORLD[regionId].level,
      poolKey: regionId,
      theme: REGIONS[regionId]?.theme || 'village',
      ap,
    });
  }

  /** 主城之间「穿梭」:花金币,瞬间抵达 */
  _worldShuttle(regionId) {
    const fromCity = !!WORLD[this.regionId]?.city;
    const toCity = !!WORLD[regionId]?.city;
    if (!fromCity || !toCity) {
      this.ui.showToast('「穿梭」只往返于主城之间');
      return;
    }
    if (regionId === this.regionId) { this.ui.showToast('你已经在这里了'); return; }
    const dist = regionDistance(this.regionId, regionId);
    const gold = shuttleGold(dist);
    if (this.economy.gold < gold) { this.ui.showToast(`金币不足(需 ${gold})`); return; }
    this.economy.gold -= gold;
    this.regionId = regionId;
    this.stopIndex = 0;
    this._visited.add(regionId);
    this._syncUi();
    this.transition(GameState.MAP);
    this._renderMap();
    this.ui.showToast(`穿梭至「${REGIONS[regionId]?.name}」,花费 ${gold} 金币`);
  }

  /** 地区内短途移动:同样按真实时间行进 */
  _travelTo(i) {
    const region = REGIONS[this.regionId];
    if (!region || i < 0 || i >= region.stops.length || i === this.stopIndex) return;
    const terrain = regionTerrain(this.regionId);
    if (!this.economy.vehicleCanReach(terrain)) {
      this.ui.showToast(`「${this.economy.vehicleName()}」走不了${TERRAIN_CN[terrain]} —— 先在背包卸下载具(徒步不限地形)`);
      return;
    }
    const dist = stopDistance(this.stopIndex, i);
    const discount = this.economy.equipStats().travelDiscount;
    const ap = travelApCost(dist, discount);
    if (!this.economy.spendAp(ap)) {
      this.ui.showToast('行动力不足 —— 休息一下,或吃点干粮');
      return;
    }
    this._syncUi();
    this._depart({
      kind: 'stop',
      regionId: this.regionId,
      stopIndex: i,
      fromLabel: region.stops[this.stopIndex].name,
      toLabel: region.stops[i].name,
      dist,
      level: WORLD[this.regionId]?.level ?? this._chapterNum(),
      poolKey: this.regionId,
      theme: region.stops[i].theme || region.theme || 'village',
      ap,
    });
  }

  /** 真正开启一段实时旅途 */
  _depart(trip) {
    this._trip = { kind: trip.kind, regionId: trip.regionId, stopIndex: trip.stopIndex };
    this.travel.start({
      fromLabel: trip.fromLabel,
      toLabel: trip.toLabel,
      dist: trip.dist,
      seconds: tripSeconds(trip.dist, this.economy.travelSpeedMul()),
      level: trip.level,
      poolKey: trip.poolKey,
      vehicle: this.economy.vehicleName(),
      terrain: regionTerrain(trip.regionId),
      npcPool: this._npcsForTheme(trip.theme),
    });
    this.transition(GameState.TRAVEL);
  }

  /** 旅途结束:落到目的地点 */
  _onTravelArrive() {
    const trip = this._trip;
    if (!trip) return;
    this._trip = null;
    if (trip.kind === 'region') {
      this.regionId = trip.regionId;
      this.stopIndex = 0;
      this._visited.add(trip.regionId);
    } else {
      this.stopIndex = trip.stopIndex;
    }
    this._npcCache.delete(`${this.regionId}:${this.stopIndex}`);
    this.transition(GameState.MAP);
    this._renderMap();
    const region = REGIONS[this.regionId];
    this.ui.showToast(`抵达「${region?.stops[this.stopIndex]?.name || region?.name}」`);
  }

  /** 途中遭遇(怪物 / 路人 NPC) */
  _onTravelEvent({ type, npc }) {
    if (type === 'encounter') {
      const level = WORLD[this.regionId]?.level ?? this._chapterNum();
      this._startWildBattle(level);
      return;
    }
    if (type === 'npc' && npc) {
      this._startNpcTalk(npc, 'road');
    }
  }

  // ===== 随机 NPC(玩家可选话题的交谈) =====
  /** 某地驻留的随机 NPC(每局固定,缓存) */
  _npcsAt(regionId, stopIndex) {
    const key = `${regionId}:${stopIndex}`;
    if (this._npcCache.has(key)) return this._npcCache.get(key);
    const stop = REGIONS[regionId]?.stops?.[stopIndex];
    const theme = stop?.theme || REGIONS[regionId]?.theme || 'village';
    const pool = this._npcsForTheme(theme);
    const picked = [];
    const used = new Set();
    let guard = 0;
    while (picked.length < MAX_STOP_NPCS && used.size < pool.length && guard++ < 200) {
      const n = pool[Math.floor(this.rng.next() * pool.length)];
      if (!n || used.has(n.id)) continue;
      used.add(n.id);
      picked.push(n);
    }
    this._npcCache.set(key, picked);
    return picked;
  }

  /** 按地区主题筛选 NPC 池 */
  _npcsForTheme(theme) {
    if (this._themeNpcCache.has(theme)) return this._themeNpcCache.get(theme);
    const pool = NPCS.filter((n) => Array.isArray(n.where) && n.where.includes(theme));
    this._themeNpcCache.set(theme, pool);
    return pool;
  }

  /**
   * 剧情进度(取「到过的最远章节」,只增不减)。
   * NPC 的 evolve 以此为门槛:剧情推进后,问法与回答都会变。
   */
  _storyStage() {
    let max = this._chapterNum();
    for (const id of this._visited) {
      const n = CHAPTER_ORDER.indexOf(id) + 1;
      if (n > max) max = n;
    }
    return max;
  }

  /** 该 NPC 此刻已生效的「变化」列表(按 from 依次累积) */
  _npcStages(npc) {
    const stage = this._storyStage();
    return (npc?.evolve || []).filter((s) => (s.from ?? 1) <= stage);
  }

  /** 该 NPC 此刻可选的话题(剧情推进后可改写 label 与 ask) */
  _npcTopics(npc) {
    const topics = TALK_TOPICS.map((t) => ({ ...t }));
    for (const s of this._npcStages(npc)) {
      if (!s.topics) continue;
      for (const [id, patch] of Object.entries(s.topics)) {
        const t = topics.find((x) => x.id === id);
        if (t) Object.assign(t, patch);
      }
    }
    return topics;
  }

  /**
   * 该 NPC 此刻某话题的回答池。
   * 「打听此地」优先取与当前场景类型匹配的 localTheme 专属台词,
   * 再被剧情推进后的 evolve 覆盖;其余话题直接用 replies / evolve。
   */
  _npcReplyPool(npc, topicId) {
    let pool = npc?.replies?.[topicId];
    if (topicId === 'local') {
      const theme = this._currentTheme();
      const themed = npc?.localTheme?.[theme];
      if (Array.isArray(themed) && themed.length) pool = themed;
      for (const s of this._npcStages(npc)) {
        const t2 = s.localTheme?.[theme];
        if (Array.isArray(t2) && t2.length) pool = t2;
      }
    }
    for (const s of this._npcStages(npc)) {
      if (Array.isArray(s.replies?.[topicId])) pool = s.replies[topicId];
    }
    return pool;
  }

  /** 从该话题的回答池里取一句尚未说过的(整个话题池用尽则允许重说) */
  _npcAnswer(npc, topicId, state) {
    const pool = this._npcReplyPool(npc, topicId);
    if (!Array.isArray(pool) || !pool.length) return null;
    const fresh = pool.filter((l) => !state.usedLines.has(l));
    const src = fresh.length ? fresh : pool;
    const pick = src[Math.floor(this.rng.next() * src.length)];
    if (pick) state.usedLines.add(pick);
    return pick;
  }

  /** 开启一段交谈:玩家先选话题,再由 NPC 以此话题作答 */
  _startNpcTalk(npc, source = 'local') {
    this._npcTalk = {
      npc,
      source,
      transcript: [],   // [{ who: 'player'|'npc', text }]
      usedTopics: new Set(),
      usedLines: new Set(),
      npcLineCount: 0,
      hintGiven: false, // 宝箱情报是否已透露(每段交谈一次)
    };
    this._renderNpcTalk();
  }

  /** 渲染对话框:对话记录 + 尚可选的话题 */
  _renderNpcTalk() {
    const st = this._npcTalk;
    if (!st) return;
    const topics = this._npcTopics(st.npc)
      .filter((t) => !st.usedTopics.has(t.id) && st.npcLineCount < TALK_MAX_LINES)
      .map((t) => ({ id: t.id, label: t.label }));
    this.ui.showNpcDialog(st.npc, {
      title: st.source === 'road' ? '路上遇见' : '交谈',
      transcript: st.transcript,
      topics,
      hint: st.npcLineCount >= TALK_MAX_LINES ? '他看上去有些倦了,不便再多问。' : '',
    });
  }

  /** 玩家选择了一个话题,NPC 以此作答;问传闻时可能透露宝箱情报 */
  _npcChooseTopic(topicId) {
    const st = this._npcTalk;
    if (!st) return;
    const topic = this._npcTopics(st.npc).find((t) => t.id === topicId);
    if (!topic || st.usedTopics.has(topicId)) return;
    st.usedTopics.add(topicId);
    st.transcript.push({ who: 'player', text: topic.ask });

    const answer = this._npcAnswer(st.npc, topicId, st);
    if (answer && st.npcLineCount < TALK_MAX_LINES) {
      st.transcript.push({ who: 'npc', text: answer });
      st.npcLineCount++;
    }

    // 「问问传闻」时,掌握宝箱情报的 NPC 会额外说出一段(每段交谈一次)
    if (topicId === 'rumor' && st.npc.hint && !st.hintGiven && st.npcLineCount < TALK_MAX_LINES) {
      st.hintGiven = true;
      st.transcript.push({ who: 'npc', text: st.npc.hint.text });
      st.npcLineCount++;
      this._learnIntel(st.npc.hint);
    }
    this._renderNpcTalk();
  }

  /** 记下一条宝箱情报(密码 / 位置);重复获得只提示一次 */
  _learnIntel(hint) {
    const chest = CHEST_MAP[hint?.chest];
    if (!chest) return;
    const isNew = !this._intel.has(chest.id);
    this._intel.set(chest.id, { chestId: chest.id, text: hint.text });
    this._syncUi();
    this.ui.showToast(isNew
      ? `记下情报:${chest.name} —— 密码 ${chest.password}(可在「情报」查看)`
      : '这条情报你先前已记下了');
  }

  /** 点击本地人物:开启可选话题的交谈 */
  _talkNpc(npcId) {
    const npc = NPCS.find((n) => n.id === npcId);
    if (!npc) return;
    this._startNpcTalk(npc, 'local');
  }

  /** 关闭 NPC 对话;若是旅途中的路人,则继续赶路 */
  _closeNpcDialog() {
    this._npcTalk = null;
    this.ui.closeNpcDialog();
    if (this.travel?.active && this.travel.paused) this.travel.resume();
  }

  // ===== 宝箱(密码开箱) =====
  /** 当前地点上的宝箱(没有则 null) */
  _chestHere() {
    return chestAt(this.regionId, this.stopIndex);
  }

  /** 打开宝箱弹窗 */
  _openChest() {
    const chest = this._chestHere();
    if (!chest) { this.ui.showToast('此地没有宝箱'); return; }
    const known = this._intel.get(chest.id);
    this.ui.showChest(chest, {
      opened: this._openedChests.has(chest.id),
      hintText: known ? known.text : '',
    });
  }

  /** 提交密码:正确则开箱发放奖励 */
  _submitChestCode(chestId, code) {
    const chest = CHEST_MAP[chestId];
    if (!chest) return;
    if (this._openedChests.has(chest.id)) { this.ui.showToast('这只箱子已经开过了'); return; }
    if (String(code ?? '').trim() !== chest.password) {
      this.ui.showToast('密码不对,锁纹丝不动');
      return;
    }
    this._openedChests.add(chest.id);
    const gold = chest.loot?.gold || 0;
    this.economy.gold += gold;
    const got = [];
    for (const [id, qty] of Object.entries(chest.loot?.items || {})) {
      if (this.economy.addItem(id, qty)) got.push(`${ITEMS[id]?.name || id}×${qty}`);
    }
    this._syncUi();
    this.ui.closeChest();
    this._renderMap();
    this.ui.showToast(`宝箱开启!获得 ${gold} 金币${got.length ? ` 与 ${got.join('、')}` : ''}`);
  }

  /** 打开情报面板:列出已知的宝箱密码与位置 */
  _openIntel() {
    const list = CHESTS
      .filter((c) => this._intel.has(c.id) || this._openedChests.has(c.id))
      .map((c) => ({
        name: c.name,
        chapter: Number(c.chapter.slice(2)),
        place: c.place,
        password: c.password,
        opened: this._openedChests.has(c.id),
      }));
    this.ui.showIntel(list, CHESTS.length);
  }

  _closeIntel() {
    this.ui.closeIntel();
  }

  /** 在当前地点开启下一段剧情(必须身处剧情地区、且站在目标地点) */
  _beginStory() {
    const region = REGIONS[this.regionId];
    const state = this._mapState();
    // 不在剧情地区:引导回世界地图,前往剧情所在地区
    if (!state.isStoryRegion) {
      this.ui.showToast(`剧情在「${REGIONS[this.storyRegionId]?.name || '别处'}」—— 先去世界地图启程`);
      this._openWorld();
      return;
    }
    if (!region || state.objectiveIndex < 0) { this.transition(GameState.NARRATIVE); return; }
    if (this.stopIndex !== state.objectiveIndex) {
      this.ui.showToast(`需先前往「${region.stops[state.objectiveIndex].name}」`);
      return;
    }
    if (this.engine.resumeGate()) this.transition(GameState.NARRATIVE);
  }

  // ===== 教程引导 =====
  /** 首次进入世界地图时弹出引导 */
  _maybeShowTutorial() {
    if (this.tutorialSeen) return;
    this.ui.openTutorial();
  }

  _closeTutorial() {
    this.tutorialSeen = true;
    markTutorialSeen();
    this.ui.closeTutorial();
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
    this._syncUi();
    this.ui.renderBag({ economy: this.economy, player: this.player });
    this.transition(GameState.BAG);
  }

  _bagRefresh() {
    this._syncUi();
    this.ui.renderBag({ economy: this.economy, player: this.player });
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

  // ===== 打工(小游戏) =====
  /** 该地点的打工列表 */
  _jobsHere() {
    return jobsFor(this._currentTheme());
  }

  _openJobs() {
    this.ui.renderJobs({ theme: this._currentTheme(), jobs: this._jobsHere(), economy: this.economy });
    this._syncUi();
    this.transition(GameState.JOB);
  }

  /** 选好难度,进入小游戏 */
  _challengeJob(jobId, tierIndex) {
    const job = this._jobsHere().find((j) => j.id === jobId);
    const tier = job?.tiers?.[tierIndex];
    if (!job || !tier) return;
    if (this.economy.ap < tier.ap) { this.ui.showToast('行动力不足,先休息一下'); return; }
    this.ui.openMinigame(job, tier, tierIndex);
  }

  /** 小游戏结束:达标才消耗行动力并发放金币(未达标不扣,可重来) */
  _finishJob({ jobId, tierIndex, success }) {
    const job = this._jobsHere().find((j) => j.id === jobId);
    const tier = job?.tiers?.[tierIndex];
    if (!job || !tier) return;
    if (success) {
      if (!this.economy.spendAp(tier.ap)) { this.ui.showToast('行动力不足,奖励未发放'); return; }
      this.economy.gold += tier.gold;
      this.ui.showToast(`「${job.name}」达标,赚得 ${tier.gold} 金币`);
    } else {
      this.ui.showToast(`「${job.name}」未达标,再试一次`);
    }
    this.ui.renderJobs({ theme: this._currentTheme(), jobs: this._jobsHere(), economy: this.economy });
    this._syncUi();
  }

  /** 关闭小游戏弹窗,刷新列表 */
  _closeMinigame() {
    this.ui.closeMinigame();
    this.ui.renderJobs({ theme: this._currentTheme(), jobs: this._jobsHere(), economy: this.economy });
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
    // 途中遭遇战:不入战利品流程,胜利后继续赶路
    if (this._wildBattle) { this._onWildBattleEnd(result); return; }
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

  // ===== 途中遭遇战 =====
  /** 旅途中随机遭遇:从该地区敌人池随机取一个,按地区等级缩放 */
  _startWildBattle(level) {
    if (!this.deck) {
      const base = ['strike', 'strike', 'strike', 'defend', 'defend', 'cleave', 'pommel', 'shield_bash'];
      this.deck = new Deck(base.map((id) => CARDS[id]).filter(Boolean), this.rng);
    }
    const poolKey = this.regionId;
    const pool = ENEMIES[poolKey] || ENEMIES.normal;
    const raw = pool[Math.floor(this.rng.next() * pool.length)] || pool[0];
    const def = scaleEnemy(raw, level);

    this.player.power = this.economy.equipStats().atkPower;
    const bonusStrength = this.player.power + this.economy.consumePendingPower();

    this._wildBattle = true;
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

  /** 途中遭遇战结束:胜则继续赶路,败则中止旅途退回起点 */
  _onWildBattleEnd(result) {
    this._wildBattle = false;
    this.currentBattle = null;
    if (result === 'victory') {
      const ch = this._chapterNum();
      const gold = 5 + Math.floor(this.rng.next() * 5) + ch;
      this.economy.gold += gold;
      let loot = null;
      if (this.rng.next() < 0.35) {
        loot = LOOT_MISC[Math.floor(this.rng.next() * LOOT_MISC.length)];
        this.economy.addItem(loot, 1);
      }
      this._syncUi();
      this.ui.showToast(`击退拦路者,拾得 ${gold} 金币${loot ? `与「${ITEMS[loot]?.name || loot}」` : ''}`);
      if (this.travel?.active) {
        this.transition(GameState.TRAVEL);
        this.travel.resume();
      } else {
        this.transition(GameState.MAP);
        this._renderMap();
      }
      return;
    }

    // 战败:中止旅途,退回出发地
    const fromId = this.regionId;
    const penalty = Math.max(10, Math.floor(this.economy.gold * 0.15));
    this.economy.gold = Math.max(0, this.economy.gold - penalty);
    this.travel?.cancel();
    this._trip = null;
    this.stopIndex = 0;
    this._syncPlayerStats();
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
    this._syncUi();
    this.transition(GameState.MAP);
    this._renderMap();
    this.ui.showToast(`你倒在了路上……退回「${REGIONS[fromId]?.stops[0]?.name || '出发地'}」,损失 ${penalty} 金币`);
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
    this.bus.on('ui:map-world', () => this._openWorld());
    this.bus.on('ui:back-map', () => this._backToMap());

    // 世界地图 / 旅途 / NPC / 教程
    this.bus.on('ui:world-depart', (id) => this._worldDepart(id));
    this.bus.on('ui:world-shuttle', (id) => this._worldShuttle(id));
    this.bus.on('ui:npc-talk', (id) => this._talkNpc(id));
    this.bus.on('ui:npc-topic', (id) => this._npcChooseTopic(id));
    this.bus.on('ui:npc-close', () => this._closeNpcDialog());
    this.bus.on('ui:map-chest', () => this._openChest());
    this.bus.on('ui:chest-submit', ({ id, code }) => this._submitChestCode(id, code));
    this.bus.on('ui:chest-close', () => this.ui.closeChest());
    this.bus.on('ui:map-intel', () => this._openIntel());
    this.bus.on('ui:intel-close', () => this._closeIntel());
    this.bus.on('ui:tutorial-close', () => this._closeTutorial());
    this.bus.on('travel:progress', (snap) => this.ui.renderTravel(snap));
    this.bus.on('travel:start', (snap) => { this.ui.resetTravelTips(); this.ui.renderTravel(snap); });
    this.bus.on('travel:event', (payload) => this._onTravelEvent(payload));
    this.bus.on('travel:arrive', () => this._onTravelArrive());

    // 市场 / 背包 / 打工
    this.bus.on('ui:shop-buy', (id) => this._buy(id));
    this.bus.on('ui:shop-sell', (id) => this._sell(id));
    this.bus.on('ui:bag-use', (id) => this._useItem(id));
    this.bus.on('ui:bag-equip', (id) => this._equipItem(id));
    this.bus.on('ui:bag-unequip', (slot) => this._unequipItem(slot));
    this.bus.on('ui:bag-drop', (id) => this._dropItem(id));
    this.bus.on('ui:job-challenge', (p) => this._challengeJob(p.jobId, p.tierIndex));
    this.bus.on('ui:job-finish', (r) => this._finishJob(r));
    this.bus.on('ui:minigame-close', () => this._closeMinigame());

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
