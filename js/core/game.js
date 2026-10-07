/**
 * Game — 顶层游戏状态机与运行控制器。
 *
 * 流程:菜单 → (地区)地图 → 抵达地点/找到 NPC → 剧情(文字抉择) → 战斗 → 战利品 → …
 *       途中可在商店买卖、背包装备、打工赚钱;行动力由剧情推进 / 食品 / 酒店休整恢复。
 *
 * 说明:
 *   · 初始职业(剑术)由第一章 n06 的 effects.assign_career 自动锁定;
 *     直接进入后续章节时预分配剑术职业。
 *   · 剧情按地区「地点」分段,引擎在锚点暂停,必须在地图上抵达该地点才能开启该段。
 *   · 战斗失败:退回地区起点,损失部分金币,并须重新抵达该地点再战。
 */

import { RNG, seedFromString } from './rng.js?v=20261007p';
import { EventBus } from './eventbus.js?v=20261007p';
import { AudioEngine } from './audio.js?v=20261007p';
import { Player } from '../combat/entity.js?v=20261007p';
import { Deck } from '../card/deck.js?v=20261007p';
import { Battle } from '../combat/battle.js?v=20261007p';
import { CARDS, ENEMIES, scaleEnemy } from '../data/data.js?v=20261007p';
import { ITEMS, SHOP_STOCK, LOOT_MISC, tokenForTheme, isTradeable, socketsOf, sellPrice, armorSlotOf, resetPriceGrowth } from '../data/items.js?v=20261007p';
import { marketStalls, MARKET_FEE, VENUE_CHANCE, venueFee, venueStock, tokenDrop } from '../data/market.js?v=20261007p';
import { BLUEPRINT_ITEMS, FORGE_RECIPES, rollMaterial } from '../data/forge.js?v=20261007p';
import { GEM_ITEMS, rollGem, SOCKET_GOLD_PER_GEM } from '../data/gems.js?v=20261007p';
import { PETS, petSkills, petSkillText, rollPetStock, rollShopPetStock, petSellPrice, canSellPet, PET_RARITY } from '../data/pets.js?v=20261007p';
import { rankExpBonus, rankReward, careerTitleOf, CAREER_MAX_LEVEL, CAREER_FREE_MAX } from '../data/careers_rank.js?v=20261007p';
import { majorSetIds } from '../data/extras.js?v=20261007p';
import { ARMOR_SLOTS, ARMOR_SHOP_LEVELS, ARMOR_MARKET_MAX, ARMOR_GEM_STEP, armorId, makeArmor } from '../data/armor.js?v=20261007p';
import { lookLabel } from '../data/looks.js?v=20261007p';
import { SELL_FLOOR, SHELF, FEES, priceMul, hash01, msToNextTick, pct } from '../data/trade.js?v=20261007p';
import {
  FACILITY_CN, FACILITY_ICON, BANK_TERMS, bankRate, exchangeTick, msToNextExchange,
  TOKEN_LIST, TOKEN_EX_FEE, tokenRate, INVEST_PROJECTS, investPrice, investPrevPrice,
  WAREHOUSE, warehouseFee, mysteryStock, mysteryPrice, ARENA_TIERS,
  TAVERN_STOCK, TAVERN_FEE, TAVERN_MEAL_GOLD, TAVERN_MEAL_AP, BELLHOP, errandCatalog,
} from '../data/facilities.js?v=20261007p';
import { TradeEngine } from './trade.js?v=20261007p';
import { MAILS, REDEEM_CODES } from '../data/mail.js?v=20261007p';
import { REGIONS } from '../data/regions.js?v=20261007p';
import { jobsFor } from '../data/jobs.js?v=20261007p';
import {
  WORLD, regionDistance, stopDistance, tripSeconds, stopTripSeconds, travelApCost, shuttleGold, levelLabel,
  regionTerrain, TERRAIN_CN, BASE_DISTANCE, DISTANCE_SCALE,
} from '../data/world.js?v=20261007p';
import { NPCS } from '../data/npcs.js?v=20261007p';
import { CHESTS, CHEST_MAP, chestAt } from '../data/chests.js?v=20261007p';
import { TALK_TOPICS, TALK_MAX_LINES } from '../data/talk.js?v=20261007p';
import { generatePois, POI_COUNT, POI_TYPE_CN, RESTAURANT_FOOD, HOTEL_ROOMS, MARKET_MERCHANTS, STALL_CN, rollRoamingStalls, stallsAtRegion } from '../data/pois.js?v=20261007p';
import { Economy } from './economy.js?v=20261007p';
import { Travel } from './travel.js?v=20261007p';
import { NarrativeEngine, ENDINGS } from '../narrative/engine.js?v=20261007p';
import { CHAPTERS, CHAPTER_ORDER, MAJOR_CHAPTERS, SIDE_QUEST_CHAPTERS, majorChapterOf, majorChapterNumber, chapterNumber } from '../narrative/chapters/index.js?v=20261007p';
import { CHAPTER_RECAPS, CHAPTER_CLEAR_REWARDS } from '../data/story.js?v=20261007p';
import { CAREERS } from '../narrative/careers.js?v=20261007p';
import { UI } from '../ui/ui.js?v=20261007p';

const PROGRESS_KEY = 'longji.progress.v1';
const TUTORIAL_KEY = 'longji.tutorial.v1';
const MAIL_KEY = 'longji.mail.v1';
/** 完整运行时存档:玩家数值 / 背包 / 剧情进度 / 地图状态 / RNG 种子 */
const SAVE_KEY = 'longji.fullstate.v1';
const SAVE_VERSION = 1;
/** 当地驻留的随机 NPC 数量区间 [最少, 最多]:普通地区 1~7 人 */
const NPC_COUNT_RANGE = [1, 7];
/** 主城人烟稠密:本地人物 12~19 人 */
const NPC_COUNT_RANGE_CITY = [12, 19];
/** 用了「醒神香 / 长明香」后酒店休整耗时的倍率 */
const HOTEL_HASTE_MUL = 0.25;
/** 用了「疾风饮」后旅途耗时的倍率 */
const TRAVEL_HASTE_MUL = 0.5;
/** 「皇帝的新衣」全套的风险:野外遭遇倍率 / 等级加成;主城罚款概率 / 比例 / 下限 */
const EMPEROR_WILD_ENCOUNTER_MUL = 3;
const EMPEROR_WILD_LEVEL_BONUS = 3;
const EMPEROR_FINE_CHANCE = 0.55;
const EMPEROR_FINE_RATE = 0.25;
const EMPEROR_FINE_MIN = 120;

/**
 * 「记忆之书」跳过各大章时发放的「全部奖励」表。
 * 含该章的关键属性 / 关键 flag / 职业分配或解锁,以及剧情简介。
 * next:跳过之后进入的下一大章起点。
 */
const CHAPTER_SKIP_REWARDS = {
  // 记忆之书·壹:跳过第 1~14 章(第一大章前十四节),直达第十五章
  ch01_ch14: {
    title: '守约之路 · 前十四章',
    summary: '龙脊山下的小村庄一夜之间被黑龙焚毁,弟弟被身披黑袍的教团掳走。你握起父亲留下的旧剑「守约」,循着断刃与线索一路北上——穿过焦土与密林,在废矿井下记下教团掳走的每一个孩子的名字;在王城躲过教团的追杀,带着揭穿伪神的证据南下渔港寻回母亲;在圣心坛的火柱旁见到弟弟的真身,做出屠龙或饶龙的抉择。你牵着时人时龙的弟弟,穿过迷心林,登上云端浮岛,漂过远洋,潜入大神殿取回古卷残页,又在弟弟独自回坛时循迹追去。第一卷的前半程,你守住了约。',
    stats: { courage: 38, reason: 36, mercy: 34, wild: 24 },
    flags: ['began_quest', 'met_mentor', 'spared_cultist', 'met_friend', 'exposed_church', 'mentor_dead', 'found_mother', 'mother_truth', 'brother_bond', 'aviator_ally', 'got_wings', 'mariner_ally', 'got_ship'],
    assign_career: 'swordsman',
    unlock_career: ['mage', 'aviator', 'mariner', 'theologian'],
  },
  // 记忆之书·贰:跳过第 15~26 章(第一大章末节 + 第二大章前半),直达最终决战第二十七章
  ch15_ch26: {
    title: '卡斯特罗之战 · 第十五至二十六章',
    summary: '你杀回圣心坛,直面大祭司,把这一场宿命了结在祭火里;残党的最后反扑在王城广场被击退,第一卷终章落幕。你辞别王城,踏入人迹罕至的北境荒原。教团残党在荒原上穿梭,寻找远古巨龙的埋骨之地,企图以黑曜铁锁住龙魂、复活他们的「龙国」。你在荒城断壁寻访守关老兵,穿过风蚀峡谷,在黑曜矿城与矿工头领交易,最终抵达龙骨荒原——直面被唤醒的远古龙魂,做出封印或安抚的抉择。可和平转瞬即逝:卡斯特罗城邦撕毁停战协议,大军压境。你为了和平与稳定,带着弟弟与新认识的朋友们踏上征途——潜入边境要塞救出守将,侦察卡斯特罗前哨获取部署图,说服中立城邦结盟,在联盟营地解锁治疗师职业,兵临卡斯特罗主城,决战平原击溃敌军主力,攻入内城。',
    stats: { courage: 42, reason: 40, mercy: 36, wild: 28 },
    flags: ['sacrificed_self', 'saved_village', 'found_brother', 'dragon_sealed', 'army_ready', 'healer_unlocked', 'city_broken'],
    assign_career: null,
    unlock_career: ['healer'],
  },
};


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

/** 读取邮箱 / 兑换码的持久状态(跨局保留:领过的信件、用过的兑换码) */
function loadMailState() {
  try { return JSON.parse(localStorage.getItem(MAIL_KEY)) || {}; } catch { return {}; }
}

/** 写回邮箱 / 兑换码状态 */
function saveMailState(state) {
  try { localStorage.setItem(MAIL_KEY, JSON.stringify(state)); } catch { /* 忽略存储异常 */ }
}

/** 是否存在完整运行时存档 */
function hasSavedGame() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

/** 读取完整运行时存档(JSON),失败返回 null */
function loadSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return null;
    return data;
  } catch { return null; }
}

/** 写入完整运行时存档;超出配额时静默失败 */
function saveGameToStorage(payload) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** 清除完整运行时存档(开启新一局 / 通关后调用) */
function clearSavedGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* 忽略存储异常 */ }
}

export const GameState = Object.freeze({
  MENU: 'menu',
  CAREER: 'career',
  NARRATIVE: 'narrative',
  MAP: 'map',
  WORLD: 'world',
  TRAVEL: 'travel',
  SHOP: 'shop',
  MARKET: 'market',
  BAG: 'bag',
  JOB: 'job',
  BATTLE: 'battle',
  REWARD: 'reward',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
  CREDITS: 'credits',
  RESTAURANT: 'restaurant',
  HOTEL: 'hotel',
  MARKET_POI: 'market_poi',
  MERCHANT: 'merchant',
  BLACKSMITH: 'blacksmith',
  GEMSHOP: 'gemshop',
  JEWELER: 'jeweler',
  FACILITY: 'facility',
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
    this._storyChapter = null;      // 剧情当前所处的大章(跨章时结算上一章通关)
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
    this._clues = new Map();        // 交谈中获得的剧情线索 flagId → { id, text, from }
    this._openedChests = new Set(); // 本局已开启的宝箱 id
    this._visited = new Set();      // 本局已到过的地区
    this._pois = [];                // 通关第一章后在世界地图随机出现的兴趣点
    this._atPoi = null;             // 当前所在 POI(或 null)
    this._hotelRoom = null;         // 酒店入住中正在休息的房型
    this._loggedOut = false;        // 已注销:阻止卸载时把已清除的进度重新写回存档
    this._currentMerchant = null;   // 当前打开的商人类型(weapon/armor/medicine)
    this.trade = null;              // 交易引擎(浮动定价 / 手续费 / 节日)
    this._roaming = null;           // 流动摊位缓存(每次世界地图刷新重抽)
    this._stallGuard = false;       // 摊位视图防重入
    this.tutorialSeen = loadTutorialSeen();
    this.audio = new AudioEngine();
    this.audio.arm();
    this.progress = loadProgress();
    this.mailState = loadMailState();
    this._bindUI();
    this.ui.setMusicState(this.audio.enabled);
    this._refreshMailBadge();
    this.transition(GameState.MENU);

    // 合并所有章节为一个连续整体:不再让玩家选章节。
    //   · 有存档 → 显示「继续旅程」按钮
    //   · 无存档 → 年龄门通过后(首次用户交互)直接从第一大章开始
    const saveInfo = this._saveInfo();
    if (saveInfo.hasSave) {
      this.ui.renderChapterSelect([], saveInfo);
    } else {
      this.ui.renderChapterSelect([], { hasSave: false });
      const startOnce = () => {
        window.removeEventListener('pointerdown', startOnce);
        window.removeEventListener('keydown', startOnce);
        if (!this.rng) this.startNewRun(undefined, 'ch01');
      };
      window.addEventListener('pointerdown', startOnce);
      window.addEventListener('keydown', startOnce);
    }

    // 关闭/刷新页面时尽力存档(运行中状态保留在本地)
    window.addEventListener('pagehide', () => this._autosave());
    window.addEventListener('beforeunload', () => this._autosave());
  }

  /** 读取存档摘要信息(供主菜单展示「继续旅程」按钮) */
  _saveInfo() {
    const data = loadSavedGame();
    if (!data) return { hasSave: false };
    const regionName = REGIONS[data.map?.regionId]?.name || data.map?.regionId || '';
    const chapter = data.engine?.currentChapterId || '';
    const summary = [chapter, regionName].filter(Boolean).join(' · ');
    return { hasSave: true, saveSummary: summary || '未完成的旅程' };
  }

  /**
   * 开始新一局。
   * @param {string|number} [seedInput] 指定种子
   * @param {string} [startChapter] 起始章节(默认第一大章 ch01)
   */
  startNewRun(seedInput, startChapter = 'ch01') {
    // 开启新一局:清除上一局的运行时存档(避免旧存档残留)
    clearSavedGame();
    // 「越买越贵」物品(龙髓灵药)复位基准价
    resetPriceGrowth();

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
    this._clues = new Map();
    this._openedChests = new Set();
    this._visited = new Set([startChapter]);
    this._pois = [];
    this._atPoi = null;
    this._hotelRoom = null;
    this._currentMerchant = null;
    this.trade = new TradeEngine({ seed: this.rng.seed });
    this._roaming = null;
    this._venueCache = new Map();     // regionId -> 专属交易场所(可能为 null)
    this._marketMode = 'market';      // 市场视图当前展示:'market' | 'venue'
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
    this._storyChapter = startChapter;   // 剧情通关结算用:记录当前所处大章
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
    this._applyAudioTheme();
    this.audio.start();
  }

  // ===== 完整运行时存档 =====
  /**
   * 将当前整局状态序列化到 localStorage。
   * 仅在非战斗态调用(战斗中不存档,避免半局状态不一致)。
   */
  saveGameState() {
    if (this._loggedOut) return false; // 已注销:不再写回任何进度
    if (!this.rng || !this.player || !this.economy || !this.engine) return false;
    // 战斗中跳过存档(战斗是可重试的短流程)
    if (this.state === GameState.BATTLE || this.currentBattle) return false;
    // 牌组:汇总所有牌堆的卡牌 id(主牌组)
    const deckIds = [];
    if (this.deck) {
      for (const c of this.deck.drawPile) if (c?.id) deckIds.push(c.id);
      for (const c of this.deck.discardPile) if (c?.id) deckIds.push(c.id);
      for (const c of this.deck.exhaustPile) if (c?.id) deckIds.push(c.id);
      for (const c of this.deck.hand) if (c?.id) deckIds.push(c.id);
    }
    // 专属交易场所缓存:仅保存可序列化字段
    const venues = {};
    if (this._venueCache) {
      for (const [rid, v] of this._venueCache.entries()) {
        venues[rid] = v ? {
          regionId: v.regionId,
          theme: v.theme,
          token: v.token,
          tokenName: v.tokenName,
          tokenIcon: v.tokenIcon,
          stopIndex: v.stopIndex,
          fee: v.fee,
          stock: Array.isArray(v.stock) ? [...v.stock] : [],
        } : null;
      }
    }
    const payload = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      rng: { seed: this.rng.seed, state: this.rng._state },
      player: {
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        mp: this.player.mp,
        maxMp: this.player.maxMp,
        energy: this.player.energy,
        energyMax: this.player.energyMax,
        power: this.player.power,
        block: this.player.block,
        statuses: { ...this.player.statuses },
      },
      deck: deckIds,
      economy: this.economy.serialize(),
      engine: this.engine.serialize(),
      map: {
        regionId: this.regionId,
        storyRegionId: this.storyRegionId,
        stopIndex: this.stopIndex,
        segment: this.segment,
        openedChests: [...this._openedChests],
        visited: [...this._visited],
        intel: Object.fromEntries(this._intel),
        clues: Object.fromEntries(this._clues),
      },
      run: {
        runStartChapter: this._runStartChapter,
        storyChapter: this._storyChapter,
        marketMode: this._marketMode,
        venues,
      },
      // 记录存档时的界面状态,用于恢复后回到对应视图
      state: this.state,
    };
    return saveGameToStorage(payload);
  }

  /** 自动存档(供各事件点调用;内部会跳过战斗中与无局状态) */
  _autosave() {
    try { this.saveGameState(); } catch { /* 存档失败不影响游戏进行 */ }
  }

  /**
   * 从 localStorage 恢复上一局。
   * @returns {boolean} 是否成功恢复
   */
  loadGameState() {
    const data = loadSavedGame();
    if (!data) return false;
    try {
      // RNG
      const rngSeed = data.rng?.seed ?? (Date.now() & 0xffffffff);
      this.rng = new RNG(rngSeed);
      if (typeof data.rng?.state === 'number') this.rng._state = data.rng.state >>> 0;

      // 玩家
      this.player = new Player({ maxHp: data.player?.maxHp ?? 70 });
      this.player.hp = Number(data.player?.hp ?? this.player.maxHp);
      this.player.maxMp = Number(data.player?.maxMp ?? 3);
      this.player.mp = Number(data.player?.mp ?? this.player.maxMp);
      this.player.energy = Number(data.player?.energy ?? 0);
      this.player.energyMax = Number(data.player?.energyMax ?? 3);
      this.player.power = Number(data.player?.power ?? 0);
      this.player.block = Number(data.player?.block ?? 0);
      this.player.statuses = { ...(data.player?.statuses || {}) };

      // 经济
      this.economy = Economy.deserialize(data.economy);
      this.ui.economy = this.economy;

      // 剧情引擎
      this.engine = new NarrativeEngine({ rng: this.rng, bus: this.bus, chapters: CHAPTERS });
      this.engine.setGates(this._buildGates());
      this.engine.player = this.player;
      this.engine.restore(data.engine);
      this.ui.bindEngine(this.engine);
      this.career = this.engine.career;
      // 职业等级各记各的:告知存档当前是哪个职业(旧存档会在此归入该职业)
      this.economy.setCareer(this.career?.id);

      // 牌组:按存档的卡牌 id 重建
      const cardIds = Array.isArray(data.deck) ? data.deck : [];
      const cards = cardIds.map((id) => CARDS[id]).filter(Boolean);
      this.deck = cards.length ? new Deck(cards, this.rng) : null;

      // 地图 / 运行状态
      this.regionId = data.map?.regionId ?? 'ch01';
      this.storyRegionId = data.map?.storyRegionId ?? this.regionId;
      this.stopIndex = Number(data.map?.stopIndex ?? 0);
      this.segment = data.map?.segment ?? null;
      this._openedChests = new Set(data.map?.openedChests || []);
      this._visited = new Set(data.map?.visited || [this.regionId]);
      this._intel = new Map(Object.entries(data.map?.intel || {}));
      this._clues = new Map(Object.entries(data.map?.clues || {}));
      this._runStartChapter = data.run?.runStartChapter ?? this.regionId;
      this._storyChapter = data.run?.storyChapter ?? this._runStartChapter;
      this._marketMode = data.run?.marketMode || 'market';
      this._venueCache = new Map();
      if (data.run?.venues) {
        for (const [rid, v] of Object.entries(data.run.venues)) {
          this._venueCache.set(rid, v ? { ...v } : null);
        }
      } else {
        this._venueCache = new Map();
      }
      this._npcCache = new Map();
      this._themeNpcCache = new Map();
      this._npcTalk = null;
      this._trip = null;
      this._wildBattle = false;
      this.currentBattle = null;
      this._currentRewards = null;
      this.trade = new TradeEngine({ seed: this.rng.seed });
      this._roaming = null;
      this.travel = new Travel({ bus: this.bus, rng: this.rng });

      this.ui.updateSeed(this.rng.seed);
      this._syncPlayerStats();
      this._syncUi();
      this._applyAudioTheme();

      // 回到存档时所在的视图
      const st = data.state;
      // 仅当引擎确有当前节点且无待门控时,才回到剧情视图;
      // 否则统一回地区地图,避免空白剧情页。
      // (历史遗留存档:结局字幕后衔接下一章时,门控已触发(_gateTarget 已置、
      //   currentNode 为空)但视图被错误切回剧情,导致 state=NARRATIVE 而
      //   currentNode=null —— 此时 _renderNarrative 会因 !node 早退,呈现空白页)
      const canResumeNarrative = st === GameState.NARRATIVE
        && !!this.engine.currentNode
        && !this.engine.pendingGate;
      // 字幕播放中关闭游戏(state=CREDITS, 当前节点仍为 ending):
      // 重新触发 ui:show-ending,让字幕继续播放 + 自动衔接下一章。
      // 否则会回地区地图但 regionId 仍是上一章,玩家看不到字幕也进不了下一章。
      const canResumeCredits = st === GameState.CREDITS
        && !!this.engine.currentNode
        && this.engine.currentNode.kind === 'ending'
        && !this.engine.pendingGate;
      if (canResumeNarrative) {
        this.engine._refresh();
        this.transition(GameState.NARRATIVE);
      } else if (canResumeCredits) {
        this.bus.emit('ui:show-ending');
      } else {
        // 其余状态(含 MAP / WORLD / SHOP / 等子视图,以及 NARRATIVE 但无当前节点 / 待门控)
        // 统一回地区地图,避免子界面状态不全或空白剧情页
        this.transition(GameState.MAP);
        this._renderMap();
      }
      this.audio.start();
      return true;
    } catch (e) {
      console.warn('[存档] 恢复失败,已回退到主菜单:', e);
      this.transition(GameState.MENU);
      this.ui.renderChapterSelect(this._chapterEntries(), this._saveInfo());
      return false;
    }
  }

  /** 收集各章的门控锚点(每章所有地点节点) */
  _buildGates() {
    const g = {};
    for (const [id, region] of Object.entries(REGIONS)) g[id] = region.stops.map((s) => s.node);
    return g;
  }

  /** 大章序号:支线地区(ch04b/ch05b)与所属大章同号 */
  _chapterNum(chapterId = this.regionId) {
    return chapterNumber(chapterId) || 1;
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
      travelSeconds: region.stops.map((_, i) => stopTripSeconds(stopDistance(this.stopIndex, i), this.economy.travelSpeedMul())),
      npcs: this._npcsAt(this.regionId, this.stopIndex),
      chest: chest ? { id: chest.id, name: chest.name, opened: this._openedChests.has(chest.id), known: this._intel.has(chest.id) } : null,
      stopChests: region.stops.map((_, i) => {
        const c = chestAt(this.regionId, i);
        return c ? { opened: this._openedChests.has(c.id), known: this._intel.has(c.id) } : null;
      }),
      intelCount: this._intel.size,
      marketFee: MARKET_FEE,
      venue: (() => {
        const v = this._venueFor(this.regionId);
        if (!v) return null;
        return {
          here: v.stopIndex === this.stopIndex,
          stopIndex: v.stopIndex,
          stopName: region.stops[v.stopIndex]?.name || '',
          fee: v.fee,
          token: v.token,
          tokenName: v.tokenName,
          tokenIcon: v.tokenIcon,
          tokenOwned: this.economy.count(v.token),
        };
      })(),
      tokens: this.economy.tokens(),
      stalls: this._stallsHere(),
      tasks: this._mapTasks({ region, isStoryRegion, objectiveIndex, chest }),
      economy: this.economy,
    };
  }

  /**
   * 主页面任务窗格:复用现有进度汇总,至多三项。
   * @returns {Array<{title:string, detail:string, tag?:string}>}
   */
  _mapTasks({ region, isStoryRegion, objectiveIndex, chest }) {
    const out = [];
    const storyRegion = REGIONS[this.storyRegionId];
    // 1) 主线
    if (isStoryRegion && objectiveIndex >= 0) {
      const s = region.stops[objectiveIndex];
      out.push({
        title: `主线 · 第${this._chapterNum()}章`,
        detail: `前往「${s.name}」${s.npc ? `找到「${s.npc}」` : '开启剧情'}`,
        tag: '剧情',
      });
    } else if (storyRegion && this.storyRegionId !== this.regionId) {
      out.push({ title: '主线 · 赶赴剧情地', detail: `前往「${storyRegion.name}」`, tag: '世界地图' });
    } else if (this.engine?.pendingGate) {
      out.push({ title: '主线 · 待启剧情', detail: '在此地开启剧情', tag: '开始剧情' });
    }
    // 2) 职业成长
    const eco = this.economy;
    const rank = eco.careerRank();
    if (eco.careerLevel >= CAREER_MAX_LEVEL) {
      out.push({ title: `职业 · ${rank.name}`, detail: '已至职业之巅(150 级)', tag: rank.major });
    } else {
      const nextStart = Math.min(CAREER_MAX_LEVEL, (eco.careerRankIndex() + 1) * 7 + 1);
      out.push({
        title: `职业 · ${rank.name} Lv.${eco.careerLevel}`,
        detail: eco.careerLevel >= CAREER_FREE_MAX
          ? '逾百级需「星辉秘典」方能提升'
          : `再升 ${Math.max(0, nextStart - eco.careerLevel)} 级晋升下一职介`,
        tag: rank.major,
      });
    }
    // 3) 宝箱 / 宠物
    if (chest && !chest.opened) {
      out.push({ title: '宝箱 · 未开启', detail: chest.known ? '已得密码,可去开箱' : '向本地人打听密码', tag: '探索' });
    } else if (eco.pets.size > 0 && !eco.petActive) {
      out.push({ title: '宠物 · 未出战', detail: '在角色弹窗指定出战宠物', tag: '养成' });
    }
    return out.slice(0, 3);
  }

  _renderMap() {
    this.ui.renderMap(this._mapState());
    this._syncUi();
    // 新玩家初次落图:弹出角色弹窗,免费定形 / 改名一次(仅一次)
    if ((!this.economy.lookChosen || !this.economy.nameChosen) && !this._lookPrompted) {
      this._lookPrompted = true;
      this._openCharacterSheet('look');
    }
  }

  /** 根据当前地区主题切换背景音乐(不同主城/地形有不同音乐) */
  _applyAudioTheme() {
    const region = REGIONS[this.regionId];
    const theme = region?.theme || 'village';
    try { this.audio.setTheme(theme); } catch { /* 音频切换失败不影响游戏 */ }
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
    this._autosave();
    // 剧情推进一步:有机会获得当地主题的特殊交易币
    const token = this._grantToken(this._currentTheme());
    if (token) {
      this._renderMap();
      this.ui.showToast(`剧情推进,有人塞来 ${token.name} ×${token.amount}`);
    }
    // 剧情推进:可能获得锻造材料,偶有图纸解锁配方
    if (this.rng.next() < 0.5) {
      const mid = rollMaterial(() => this.rng.next());
      const qty = 1 + Math.floor(this.rng.next() * 2);
      this.economy.addItem(mid, qty);
      this.ui.showToast(`途中拾得锻造材料:${ITEMS[mid]?.name || mid} ×${qty}`);
    }
    const bp = this._rollBlueprintDrop();
    if (bp) this.ui.showToast(`📜 获得图纸「${bp.name}」,锻造配方已解锁`);
    // 剧情告一段落:行动力小幅恢复(剧情推进是行动力的恢复途径之一)
    // 治疗师职业被动「龙魂活力」:每次剧情推进额外恢复 2 点行动力
    const baseAp = 3;
    const healBonus = this.career?.passive?.id === 'dragon_vitality' ? 2 : 0;
    const apGot = this.economy.addAp(baseAp + healBonus);
    if (apGot) this.ui.showToast(`剧情告一段落,行动力 +${apGot}${healBonus > 0 ? '(龙魂活力 +2)' : ''}`);
  }

  /** 剧情 / NPC 处获得图纸(解锁锻造配方) */
  _rollBlueprintDrop() {
    if (this.rng.next() >= 0.12) return null;
    const pool = Object.values(BLUEPRINT_ITEMS).filter((b) => !this.economy.hasBlueprint(b.id));
    if (!pool.length) return null;
    const bp = pool[Math.floor(this.rng.next() * pool.length)];
    return this._grantBlueprint(bp.id);
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
    // 剧情引导:主线此刻在哪、到那儿后「去哪个地点、找谁」
    const storyRegion = this.storyRegionId
      ? regions.find((r) => r.id === this.storyRegionId) || null
      : null;
    const gate = this.engine?.pendingGate;
    let storyStop = null;
    if (gate && gate.chapterId === this.storyRegionId) {
      const st = REGIONS[this.storyRegionId]?.stops?.find((s) => s.node === gate.nodeId);
      if (st) storyStop = { name: st.name, npc: st.npc || null };
    }
    return {
      regions,
      story: storyRegion,
      storyStop,
      storyChapterNum: storyRegion ? this._chapterNum(storyRegion.id) : 0,
      pois: this._pois.map((p) => {
        // POI 与当前地区的距离(按世界坐标估算)
        const curW = WORLD[cur];
        const dist = curW ? Math.round(BASE_DISTANCE + Math.hypot(curW.x - p.x, curW.y - p.y) * DISTANCE_SCALE) : 50;
        return {
          ...p,
          typeCn: POI_TYPE_CN[p.type],
          dist,
          seconds: tripSeconds(dist, speedMul),
          ap: travelApCost(dist, discount),
          current: this._atPoi?.id === p.id,
        };
      }),
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
    // 每次刷新世界地图 → 重抽流动摊位(铁匠 / 宝石商 / 精益师)
    this._rollRoaming();
    this.ui.renderWorld(this._worldState());
    this._syncUi();
    this.transition(GameState.WORLD);
    this._maybeShowTutorial();
  }

  /** 主城地区 id 列表 */
  _cityRegions() {
    return Object.keys(WORLD).filter((id) => WORLD[id]?.city);
  }

  /** 重抽流动摊位(每次打开世界地图时调用) */
  _rollRoaming() {
    const all = Object.keys(WORLD);
    this._roaming = rollRoamingStalls(() => this.rng.next(), all, this._cityRegions());
    return this._roaming;
  }

  /** 当前地区拥有的摊位类型(铁匠 / 宝石商 / 精益师) */
  _stallsHere() {
    if (!this._roaming) this._rollRoaming();
    const isCity = !!WORLD[this.regionId]?.city;
    return stallsAtRegion(this.regionId, isCity, this._roaming);
  }

  /** 打开某类摊位(铁匠铺 / 宝石商 / 精益师) */
  _openStall(type) {
    if (type === 'blacksmith') this._openBlacksmith();
    else if (type === 'gemshop') this._openGemshop();
    else if (type === 'jeweler') this._openJeweler();
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
      this.ui.showToast('行动力不足 —— 吃点干粮、推进剧情,或去酒店休整');
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

  /** 启程前往某个 POI(餐厅 / 酒店 / 商市) */
  _poiDepart(poiId) {
    const poi = this._pois.find((p) => p.id === poiId);
    if (!poi) return;
    if (this._atPoi?.id === poiId) { this.ui.showToast('你已经在这里了'); return; }
    const curW = WORLD[this.regionId];
    const dist = curW ? Math.round(BASE_DISTANCE + Math.hypot(curW.x - poi.x, curW.y - poi.y) * DISTANCE_SCALE) : 50;
    const discount = this.economy.equipStats().travelDiscount;
    const ap = travelApCost(dist, discount);
    if (!this.economy.spendAp(ap)) {
      this.ui.showToast('行动力不足 —— 吃点干粮、推进剧情,或去酒店休整');
      return;
    }
    this._syncUi();
    this._depart({
      kind: 'poi',
      poiId,
      fromLabel: REGIONS[this.regionId]?.name || '此地',
      toLabel: `${POI_TYPE_CN[poi.type]}·${poi.name}`,
      dist,
      level: Math.max(1, WORLD[this.regionId]?.level || 1),
      poolKey: 'poi',
      theme: 'village',
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
    this._applyAudioTheme();
    this._syncUi();
    this.transition(GameState.MAP);
    this._renderMap();
    const name = REGIONS[regionId]?.name;
    const fine = this._maybeFine();
    this.ui.showToast(fine ? `穿梭至「${name}」,花费 ${gold} 金币 —— ${fine}` : `穿梭至「${name}」,花费 ${gold} 金币`);
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
      this.ui.showToast('行动力不足 —— 吃点干粮、推进剧情,或去酒店休整');
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
    this._trip = { kind: trip.kind, regionId: trip.regionId, stopIndex: trip.stopIndex, poiId: trip.poiId };
    // 疾风饮:把这一段旅途的耗时减半
    const haste = this.economy.consumeTravelHaste();
    // 地区内地点间的移动走「短途」节奏(远快于地区间旅行)
    const baseSec = trip.kind === 'stop'
      ? stopTripSeconds(trip.dist, this.economy.travelSpeedMul())
      : tripSeconds(trip.dist, this.economy.travelSpeedMul());
    // 「皇帝的新衣」全套:野路上会被高阶怪物盯上(城内踱步不算野外)
    const wild = this._emperorSet() && (trip.kind === 'region' || trip.kind === 'poi' || !this._isCity(this.regionId));
    this.travel.start({
      fromLabel: trip.fromLabel,
      toLabel: trip.toLabel,
      dist: trip.dist,
      seconds: Math.max(1, Math.round(baseSec * (haste ? TRAVEL_HASTE_MUL : 1))),
      level: trip.level + (wild ? EMPEROR_WILD_LEVEL_BONUS : 0),
      poolKey: trip.poolKey,
      encounterMul: wild ? EMPEROR_WILD_ENCOUNTER_MUL : 1,
      vehicle: this.economy.vehicleName(),
      terrain: trip.regionId ? regionTerrain(trip.regionId) : 'land',
      npcPool: this._npcsForTheme(trip.theme),
    });
    if (haste) this.travel.pushLog('疾风饮下肚,脚下的路缩了一半。');
    if (wild) this.travel.pushLog('你衣不蔽体地走在旷野上 —— 远处的高阶怪物似乎嗅到了你。');
    this.transition(GameState.TRAVEL);
  }

  /** 旅途结束:落到目的地点(酒店休整则结算恢复效果并回到酒店界面) */
  _onTravelArrive() {
    // 酒店入住:用房型的恢复效果结算(服饰「休息多回行动力」在此生效),并回到酒店界面
    if (this._hotelRoom) {
      const room = this._hotelRoom;
      this._hotelRoom = null;
      const bonus = this.economy.restBonus ? this.economy.restBonus() : 0;
      const apGot = this.economy.addAp(room.apRecover + bonus);
      let healTxt = '';
      if (room.heal > 0) {
        const heal = Math.floor(this.player.maxHp * room.heal);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        healTxt = ` 与 ${heal} 点生命`;
      }
      this._syncPlayerStats();
      this._syncUi();
      this.transition(GameState.HOTEL);
      if (this._atPoi) this._openHotel(this._atPoi);
      else this._openFacility('hotel');
      this.ui.showToast(`「${room.name}」休整完毕,恢复 ${apGot} 点行动力${healTxt}${bonus > 0 && apGot > 0 ? `(服饰加成 +${bonus})` : ''}`);
      this._autosave();
      return;
    }
    const trip = this._trip;
    this._trip = null;
    if (!trip) {
      // 防御性兜底:既非酒店也无行程的抵达(正常流程不会发生)
      this.transition(GameState.MAP);
      this._renderMap();
      return;
    }
    if (trip.kind === 'region') {
      this.regionId = trip.regionId;
      this.stopIndex = 0;
      this._visited.add(trip.regionId);
      this._applyAudioTheme();
      this._atPoi = null;
    } else if (trip.kind === 'poi') {
      this._atPoi = this._pois.find((p) => p.id === trip.poiId) || null;
    } else {
      this.stopIndex = trip.stopIndex;
    }
    this._npcCache.delete(`${this.regionId}:${this.stopIndex}`);
    if (trip.kind === 'poi' && this._atPoi) {
      // 抵达 POI:直接打开其服务界面
      this._openPoi();
      this.ui.showToast(`抵达「${this._atPoi.name}」`);
    } else {
      this.transition(GameState.MAP);
      this._renderMap();
      const region = REGIONS[this.regionId];
      const place = region?.stops[this.stopIndex]?.name || region?.name;
      // 主城落地时,「皇帝的新衣」全套可能被巡卫逮住罚款
      const fine = this._maybeFine();
      this.ui.showToast(fine ? `抵达「${place}」 —— ${fine}` : `抵达「${place}」`);
    }
    this._autosave();
  }

  /** 途中事件(怪物 / 路人 NPC) */
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

  // ===== 「皇帝的新衣」全套的风险(主城罚款 / 野外招怪) =====
  /** 某地区是否为主城(有巡卫、可穿梭) */
  _isCity(regionId) {
    return !!WORLD[regionId]?.city;
  }

  /** 是否全身身着「皇帝的新衣」四件套 */
  _emperorSet() {
    return !!this.economy && this.economy.emperorSet();
  }

  /**
   * 主城当场罚款:返回提示文本(未触发或被罚 0 则返回 null);不负责弹提示。
   * 罚款 = 当前金币 × EMPEROR_FINE_RATE,不低于 EMPEROR_FINE_MIN,且不超过身上金币。
   */
  _maybeFine() {
    if (!this._emperorSet() || !this._isCity(this.regionId)) return null;
    if (this.rng.next() >= EMPEROR_FINE_CHANCE) return null;
    const gold = this.economy.gold;
    const fine = Math.min(gold, Math.max(EMPEROR_FINE_MIN, Math.round(gold * EMPEROR_FINE_RATE)));
    if (fine <= 0) return null;
    this.economy.gold -= fine;
    this._syncUi();
    return `巡卫当街拦下衣衫不整的你,罚银 ${fine} 金币`;
  }

  // ===== 随机 NPC(玩家可选话题的交谈) =====
  /** 某地驻留的随机 NPC(每局固定,缓存);主城人多,别处人少 */
  _npcsAt(regionId, stopIndex) {
    const key = `${regionId}:${stopIndex}`;
    if (this._npcCache.has(key)) return this._npcCache.get(key);
    const stop = REGIONS[regionId]?.stops?.[stopIndex];
    const theme = stop?.theme || REGIONS[regionId]?.theme || 'village';
    // 主城最热闹:无论身处城中何种地界,都并入「城」里的人,才够 12~19 人
    const pool = this._isCity(regionId) ? this._npcsForThemes(['city', theme]) : this._npcsForTheme(theme);
    const [lo, hi] = this._isCity(regionId) ? NPC_COUNT_RANGE_CITY : NPC_COUNT_RANGE;
    const want = Math.min(pool.length, lo + Math.floor(this.rng.next() * (hi - lo + 1)));
    const picked = [];
    const used = new Set();
    // 支线触发 NPC:绑定到指定地区(region),未完成时在该地区各地点必定出现,
    // 供玩家跑图时通过对话领取支线任务(不影响主线进度)
    for (const n of NPCS) {
      if (n.quest && Array.isArray(n.region) && n.region.includes(regionId)
        && (!n.quest.doneFlag || !this.engine?.flags?.has(n.quest.doneFlag))) {
        if (!used.has(n.id)) { used.add(n.id); picked.push(n); }
      }
    }
    let guard = 0;
    while (picked.length < want && used.size < pool.length && guard++ < 600) {
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
    // 支线触发 NPC(带 quest)不进入随机主题池,改由 _npcsAt 按地区强制投放
    const pool = NPCS.filter((n) => Array.isArray(n.where) && n.where.includes(theme) && !n.quest);
    this._themeNpcCache.set(theme, pool);
    return pool;
  }

  /** 合并若干主题的 NPC 池(去重) */
  _npcsForThemes(themes) {
    const seen = new Set();
    const out = [];
    for (const t of new Set(themes)) {
      for (const n of this._npcsForTheme(t)) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        out.push(n);
      }
    }
    return out;
  }

  /**
   * 剧情进度(取「到过的最远章节」,只增不减)。
   * NPC 的 evolve 以此为门槛:剧情推进后,问法与回答都会变。
   */
  _storyStage() {
    let max = this._chapterNum();
    for (const id of this._visited) {
      const n = chapterNumber(id);
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
      eventDone: false, // 该 NPC 的交谈事件是否已触发(每次交谈重算)
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
    // NPC 任务(支线触发):有 quest 字段且满足前置 reqFlag 时显示任务按钮;
    // 持有 doneFlag 时标记为已完成(按钮变灰),禁止重复触发。
    const qd = st.npc.quest;
    const reqMet = !qd || qd.reqFlag == null || this.engine.flags.has(qd.reqFlag);
    const quest = qd && reqMet ? {
      text: qd.text,
      accept: qd.accept,
      decline: qd.decline,
      sideChapter: qd.sideChapter,
      doneFlag: qd.doneFlag,
      done: qd.doneFlag ? this.engine.flags.has(qd.doneFlag) : false,
    } : null;
    this.ui.showNpcDialog(st.npc, {
      title: st.source === 'road' ? '路上遇见' : '交谈',
      transcript: st.transcript,
      topics,
      hint: st.npcLineCount >= TALK_MAX_LINES ? '他看上去有些倦了,不便再多问。' : '',
      quest,
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

    // 交谈事件:部分 NPC 在特定话题后可能赠物 / 翻脸开战 / 透露线索
    if (this._maybeNpcEvent(st, topicId)) return; // 已转入战斗,不再渲染对话框
    this._renderNpcTalk();
  }

  // ===== 交谈事件(物资赠予 / 冲突开战 / 剧情线索)=====
  /** 当前地区的遭遇等级(NPC 翻脸时按此缩放敌人强度) */
  _regionLevel() {
    return WORLD[this.regionId]?.level ?? this._chapterNum();
  }

  /**
   * 与 NPC 交谈时可能触发的一次事件(由 NPC 定义的 event 字段决定)。
   * @returns {boolean} true 表示已转入战斗,调用方须立即返回
   */
  _maybeNpcEvent(st, topicId) {
    const ev = st?.npc?.event;
    if (!ev || st.eventDone) return false;
    if ((ev.topic || 'rumor') !== topicId) return false;
    if (this.rng.next() >= (ev.chance ?? 0.35)) return false;
    if (ev.once !== false) st.eventDone = true;

    if (ev.kind === 'battle') {
      // 翻脸:先收起对话,再直接进入一场遭遇战
      this._npcTalk = null;
      this.ui.closeNpcDialog();
      this.ui.showToast(ev.text ? `${st.npc.name}:${ev.text}` : `${st.npc.name}翻了脸,拦住你的去路`);
      this._startWildBattle(this._regionLevel());
      return true;
    }

    if (ev.kind === 'gift') {
      const id = ev.item && ITEMS[ev.item] ? ev.item : LOOT_MISC[Math.floor(this.rng.next() * LOOT_MISC.length)];
      const qty = Math.max(1, Math.round(ev.qty || 1));
      this.economy.addItem(id, qty);
      const name = ITEMS[id]?.name || id;
      st.transcript.push({ who: 'npc', text: ev.text || `这些你拿着 —— ${name}×${qty},路上用得上。` });
      st.npcLineCount++;
      this.ui.showToast(`获赠 ${name}×${qty}`);
      this._bagRefresh();
      this._syncUi();
      this._autosave();
      return false;
    }

    if (ev.kind === 'clue') {
      this._learnClue({ id: ev.flag || `${st.npc.id}_clue`, text: ev.text, from: st.npc.name });
      st.transcript.push({ who: 'npc', text: ev.text });
      st.npcLineCount++;
      return false;
    }

    if (ev.kind === 'ap') {
      // NPC 赠予行动力(休息下线后,行动力的恢复途径之一)
      const amount = Math.max(1, Math.round(ev.amount || 3));
      const got = this.economy.addAp(amount);
      st.transcript.push({ who: 'npc', text: ev.text || `路上辛苦了 —— 这点心意你收下,恢复 ${got} 点行动力。` });
      st.npcLineCount++;
      if (got > 0) this.ui.showToast(`${st.npc.name} 赠予行动力 +${got}`);
      this._syncUi();
      this._autosave();
      return false;
    }
    return false;
  }

  /** 记下一条剧情线索(可在「情报」面板的线索栏查看) */
  _learnClue({ id, text, from }) {
    if (!id || !text) return;
    const isNew = !this._clues.has(id);
    this._clues.set(id, { id, text, from: from || '' });
    this._syncUi();
    this._autosave();
    this.ui.showToast(isNew ? '记下一条剧情线索(可在「情报」查看)' : '这条线索你先前已听过了');
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
    const gold = this._grantGold(chest.loot?.gold || 0);
    const got = [];
    for (const [id, qty] of Object.entries(chest.loot?.items || {})) {
      if (this.economy.addItem(id, qty)) got.push(`${ITEMS[id]?.name || id}×${qty}`);
    }
    // 宝箱里也可能藏着当地主题的特殊交易币
    const token = this._grantToken(this._currentTheme());
    if (token) got.push(`${token.name}×${token.amount}`);
    this._syncUi();
    this.ui.closeChest();
    this._renderMap();
    this.ui.showToast(`宝箱开启!获得 ${gold} 金币${got.length ? ` 与 ${got.join('、')}` : ''}`);
    this._autosave();
  }

  /** 打开情报面板:列出已知的宝箱密码与位置,以及交谈得来的剧情线索 */
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
    this.ui.showIntel(list, CHESTS.length, [...this._clues.values()]);
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
    // 先把视图切到叙事页,再开启门控段落。
    // 顺序不可颠倒:若门控锚点恰为战斗节点(全游戏仅 ch15 的 n02_battle 如此),
    // resumeGate() 内部会同步 goto → 发出 narrative:battle → _startNarrativeBattle
    // 已将视图切到战斗页;若此处再 transition(NARRATIVE) 会把战斗页盖回叙事页,
    // 战斗在后台卡死(等不到指令)、屏幕上残留上一节点旧文本,且无法推进。
    if (this.engine.pendingGate) {
      this.transition(GameState.NARRATIVE);
      this.engine.resumeGate();
    }
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

  _currentTheme() {
    const region = REGIONS[this.regionId];
    if (!region) return 'village';
    return region.stops[this.stopIndex]?.theme || region.theme || 'village';
  }

  // ===== 商店 =====
  _openShop() {
    const theme = this._currentTheme();
    this._shopMul = this._isCity(this.regionId) ? 0.85 : 1;
    this._shopStockCache = this._rollShopStock(theme);
    this._shopPetsCache = this._rollShopPets();
    this._renderShop();
    this.transition(GameState.SHOP);
  }

  /** 宠物 → 视图数据(市场宠物摊与商店宠物栏共用) */
  _petView(id) {
    const p = PETS[id];
    return {
      id, name: p.name, icon: p.icon,
      price: p.price, sell: petSellPrice(id),
      rarity: PET_RARITY[p.rarity] || p.rarity,
      skill: petSkills(p).map(petSkillText).join('、'),
      desc: p.desc,
      owned: this.economy ? this.economy.petCount(id) : 0,
    };
  }

  /** 可出售的宠物(仅常规宠物,带持有数量) */
  _sellablePets() {
    if (!this.economy) return [];
    return this.economy.petList()
      .filter(([id, n]) => n > 0 && canSellPet(id))
      .map(([id, n]) => ({ ...this._petView(id), count: n }));
  }

  /** 本店随机上架的普通宠物(每次进店重掷;主城再掷一次,更容易遇到) */
  _rollShopPets() {
    const flip = () => this.rng.next();
    let ids = rollShopPetStock(flip);
    if (this._isCity(this.regionId) && !ids.length) ids = rollShopPetStock(flip);
    return ids.map((id) => this._petView(id));
  }

  /** 按地区刷新货架(主城货全价低;非主城随机不同,极低概率出绝世) */
  _rollShopStock(theme) {
    const isCity = this._isCity(this.regionId);
    const base = [...(SHOP_STOCK[theme] || SHOP_STOCK.village)];
    if (!isCity) {
      // 不同地图:随机剔除约 1/4 的常备货,营造「各店不同」
      for (let i = base.length - 1; i >= 0; i--) {
        if (this.rng.next() < 0.25) base.splice(i, 1);
      }
    }
    const levels = isCity ? ARMOR_SHOP_LEVELS : ARMOR_SHOP_LEVELS.filter((_, i) => i % 2 === 0);
    for (const slot of ARMOR_SLOTS) {
      for (const lv of levels) {
        if (!isCity && this.rng.next() < 0.4) continue; // 非主城:各类防具随机不全
        base.push(armorId(slot, lv));
      }
    }
    // 非主城:0.001% 出现一件「绝世」商品(仅此处可售)
    if (!isCity && this.rng.next() < 0.00001) {
      const pool = ['starfall_blade', 'dragon_fang', 'void_scepter', 'scripture', 'leviathan_hook', 'falcon_blade', 'dragon_piercer']
        .filter((id) => ITEMS[id]);
      if (pool.length) base.push(pool[Math.floor(this.rng.next() * pool.length)]);
    }
    return base;
  }

  _renderShop() {
    const theme = this._currentTheme();
    this.ui.renderShop({
      theme,
      stock: this._shopStockCache || this._rollShopStock(theme),
      pets: this._shopPetsCache || this._rollShopPets(),
      sellPets: this._sellablePets(),
      economy: this.economy,
      fee: FEES.shop,
      priceMul: this._shopMul || 1,
      isCity: this._isCity(this.regionId),
    });
    this._syncUi();
  }

  _buy(id) {
    const it = ITEMS[id];
    if (!it) return;
    if (!isTradeable(id)) { this.ui.showToast('此物不出售'); return; }
    const base = this.economy.itemPrice(id);
    const price = Math.max(1, Math.round(base * (this._shopMul || 1) * (1 + FEES.shop)));
    if (this.economy.gold < price) { this.ui.showToast('金币不足'); return; }
    if (!this.economy.canHold(id)) { this.ui.showToast('背包已满,请先扩容或清理'); return; }
    this.economy.gold -= price;
    this.economy.addItem(id, 1);
    this.economy.notePurchase(id);
    this.ui.showToast(`购入「${it.name}」(含 ${pct(FEES.shop)} 手续费,共 ${price} 金币)`);
    this._openShopRefresh();
    this._autosave();
  }

  /** 发放金币(自动叠加服饰「金币收益」加成),返回实际到手数 */
  _grantGold(base) {
    const bonus = this.economy.goldBonus ? this.economy.goldBonus() : 0;
    const gain = Math.round((base || 0) * (1 + bonus));
    this.economy.gold += gain;
    return gain;
  }

  _sell(id) {
    if (!this.economy.has(id)) { this.ui.showToast('背包里没有这件物品'); return; }
    if (this.economy.isEquipped(id)) { this.ui.showToast('已装备的物品需先卸下'); return; }
    if (!isTradeable(id)) { this.ui.showToast('此物无法买卖'); return; }
    if (ITEMS[id]?.category === 'blueprint') { this.ui.showToast('图纸用于解锁配方,不能出售'); return; }
    if (ITEMS[id]?.gems?.length) { this.ui.showToast('镶嵌过的装备请到市场交易'); return; }
    const gross = sellPrice(id);
    const net = Math.max(1, Math.round(gross * (1 - FEES.shop)));
    this.economy.removeItem(id, 1);
    this.economy.gold += net;
    this.ui.showToast(`卖出「${ITEMS[id].name}」,扣 ${pct(FEES.shop)} 手续费后得 ${net} 金币`);
    this._openShopRefresh();
    this._autosave();
  }

  /** 在本店领养一只宠物(常规宠物随机上架) */
  _shopBuyPet(id) {
    const p = PETS[id];
    if (!p) return;
    const price = Math.max(1, Math.round(p.price * (this._shopMul || 1) * (1 + FEES.shop)));
    if (this.economy.gold < price) { this.ui.showToast(`金币不足(需 ${price})`); return; }
    this.economy.gold -= price;
    this.economy.addPet(id, 1);
    const first = !this.economy.petActive;
    if (first) this.economy.setActivePet(id);
    this.ui.showToast(`🐾 在本店领回「${p.name}」${first ? '(已随行)' : ''}`);
    this._openShopRefresh();
    this._syncUi();
    this._autosave();
  }

  /** 把一只常规宠物卖给本店 */
  _shopSellPet(id) {
    if (!canSellPet(id)) { this.ui.showToast('这只宠物不可出售(仅常规宠物可卖)'); return; }
    if (!this.economy.hasPet(id)) { this.ui.showToast('你没有这只宠物'); return; }
    const net = Math.max(1, Math.round(petSellPrice(id) * (1 - FEES.shop)));
    this.economy.removePet(id, 1);
    this.economy.gold += net;
    this.ui.showToast(`送走了「${PETS[id].name}」,扣手续费后得 ${net} 金币`);
    this._openShopRefresh();
    this._syncUi();
    this._autosave();
  }

  _openShopRefresh() {
    this._renderShop();
  }

  // ===== 市场(玩家集市:浮动定价 + 手续费 + 玩家货架) =====
  /** 市场数据(含多个商家、宝石摊与镶嵌武器摊、玩家货架) */
  _marketData() {
    this.trade?.refresh();
    const { fee, festival } = this.trade ? this.trade.feeFor('market') : { fee: MARKET_FEE, festival: false };
    return {
      stalls: marketStalls(),
      wares: this._marketWares(),
      gems: Object.values(GEM_ITEMS).map((g) => ({
        ...g,
        price: this.trade ? this.trade.marketAvg(g.id) : g.price,
        trend: this.trade ? this.trade.priceTrend(g.id) : 1,
      })),
      pets: this._marketPets(),
      sellPets: this._sellablePets(),
      listings: this.economy.listings,
      economy: this.economy,
      fee,
      festival,
      trade: this.trade,
      shelfCount: this.economy.shelfCount,
      shelfMax: SHELF.max,
      shelfCost: this.economy.shelfUpgradeCost(),
      tick: this.trade ? this.trade.tick : 0,
      nextTickMs: msToNextTick(),
      sellFloor: SELL_FLOOR,
    };
  }

  /** 市场里出售的「已镶嵌武器」(价格随强度递增) */
  _marketWares() {
    if (!this.trade) return [];
    const tick = this.trade.tick;
    const seed = this.rng.seed;
    const weaponPool = Object.values(ITEMS).filter((it) => it.category === 'weapon' && !it.forged && !(it.gems && it.gems.length));
    const gemPool = Object.values(GEM_ITEMS);
    if (!weaponPool.length || !gemPool.length) return [];
    const wares = [];
    const N = 3;
    for (let i = 0; i < N; i++) {
      const wi = Math.floor(priceMul(`ware${i}`, seed, tick) * weaponPool.length) % weaponPool.length;
      const gi1 = Math.floor(priceMul(`wareg${i}a`, seed, tick) * gemPool.length) % gemPool.length;
      const gemIds = [gemPool[gi1].id];
      // 第二颗宝石概率出现,使强档更贵
      if (priceMul(`wareg${i}b`, seed, tick) > 0.5) {
        const gi2 = Math.floor(priceMul(`wareg${i}c`, seed, tick) * gemPool.length) % gemPool.length;
        if (gemPool[gi2].id !== gemIds[0]) gemIds.push(gemPool[gi2].id);
      }
      const base = weaponPool[wi];
      const def = this.economy._composeSocketed(base.id, gemIds);
      if (!def) continue;
      const gemsValue = gemIds.reduce((s, g) => s + (ITEMS[g]?.price || 0), 0);
      const trend = this.trade.priceTrend(base.id);
      const price = Math.max(1, Math.round(((base.price || 60) + gemsValue) * 0.9 * trend * (1 + this.trade.feeFor('market').fee)));
      wares.push({ key: `ware_${i}`, def, price });
    }
    // 镶嵌防具摊:同样可在市场买到(等级保持在出售上限之内)
    const armorPool = Object.values(ITEMS)
      .filter((it) => it.category === 'armor' && !(it.gems && it.gems.length) && (it.level || 1) <= 80);
    const AN = 2;
    for (let i = 0; i < AN && armorPool.length; i++) {
      const ai = Math.floor(priceMul(`wareA${i}`, seed, tick) * armorPool.length) % armorPool.length;
      const gi1 = Math.floor(priceMul(`wareAg${i}a`, seed, tick) * gemPool.length) % gemPool.length;
      const gemIds = [gemPool[gi1].id];
      if (priceMul(`wareAg${i}b`, seed, tick) > 0.55) {
        const gi2 = Math.floor(priceMul(`wareAg${i}c`, seed, tick) * gemPool.length) % gemPool.length;
        if (gemPool[gi2].id !== gemIds[0]) gemIds.push(gemPool[gi2].id);
      }
      const baseA = armorPool[ai];
      const lv = Math.min(120, (baseA.level || 1) + ARMOR_GEM_STEP * gemIds.length);
      const def = makeArmor(baseA.armorSlot || baseA.equipment?.slot || 'body', lv, null, gemIds);
      if (!def) continue;
      const gemsValue = gemIds.reduce((s, g) => s + (ITEMS[g]?.price || 0), 0);
      const trend = this.trade.priceTrend(baseA.id);
      const price = Math.max(1, Math.round(((baseA.price || 60) + gemsValue * 0.8) * 0.9 * trend * (1 + this.trade.feeFor('market').fee)));
      wares.push({ key: `wareA_${i}`, def, price });
    }
    return wares;
  }

  /** 市场宠物摊:本次刷新上架的宠物(常规常驻,稀有/神话概率出现) */
  _marketPets() {
    if (!this.trade) return [];
    const tick = this.trade.tick;
    const seed = this.rng.seed;
    let i = 0;
    const flip = () => hash01(`pet:${seed}:${tick}:${i++}`); // 稳定 0~1(同一轮次同一盘货)
    const stock = rollPetStock(flip);
    const ids = [...stock.common, ...stock.rare, ...stock.mythic];
    return ids.map((id) => this._petView(id));
  }

  /** 买入宠物(价格随稀有度;到手即可在角色弹窗指定出战) */
  _marketPetBuy(id) {
    const p = PETS[id];
    if (!p) return;
    const fee = this.trade ? this.trade.feeFor('market').fee : MARKET_FEE;
    const price = Math.max(1, Math.round(p.price * (1 + fee)));
    if (this.economy.gold < price) { this.ui.showToast(`金币不足(需 ${price})`); return; }
    this.economy.gold -= price;
    this.economy.addPet(id, 1);
    const first = !this.economy.petActive;
    if (first) this.economy.setActivePet(id);
    this.ui.showToast(`🐾 领回了「${p.name}」${first ? '(已随行)' : ''}`);
    this._openMarketRefreshOnly();
    this._syncUi();
    this._autosave();
  }

  _openMarket() {
    this._marketMode = 'market';
    this._settleListings();
    this.ui.renderMarket(this._marketData());
    this._syncUi();
    this.transition(GameState.MARKET);
  }

  _marketRefresh() {
    if (this._marketMode === 'venue') this._openVenueRefresh();
    else this._openMarketRefreshOnly();
  }

  _openMarketRefreshOnly() {
    this.ui.renderMarket(this._marketData());
    this._syncUi();
  }

  _marketBuy(id) {
    const it = ITEMS[id];
    if (!it) return;
    const price = this.trade ? this.trade.marketBuyPrice(id, this.trade.feeFor('market').fee) : it.price;
    if (this.economy.gold < price) { this.ui.showToast('金币不足'); return; }
    if (!this.economy.canHold(id)) { this.ui.showToast('背包已满,请先扩容或清理'); return; }
    this.economy.gold -= price;
    this.economy.addItem(id, 1);
    this.economy.notePurchase(id);
    this.ui.showToast(`购入「${it.name}」,含管理费共 ${price} 金币`);
    this._marketRefresh();
    this._autosave();
  }

  _marketSell(id) {
    if (!this.economy.has(id)) { this.ui.showToast('背包里没有这件物品'); return; }
    if (this.economy.isEquipped(id)) { this.ui.showToast('已装备的物品需先卸下'); return; }
    if (!isTradeable(id)) { this.ui.showToast('此物无法买卖'); return; }
    const fee = this.trade ? this.trade.feeFor('market').fee : MARKET_FEE;
    const net = this.trade ? this.trade.marketSellNet(id, fee) : this.economy.marketSellPrice(id, fee);
    this.economy.removeItem(id, 1);
    this.economy.gold += net;
    this.ui.showToast(`卖出「${ITEMS[id]?.name || id}」,扣 ${pct(fee)} 管理费后得 ${net} 金币`);
    this._marketRefresh();
    this._autosave();
  }

  /** 把一只常规宠物卖给市场 */
  _marketSellPet(id) {
    if (!canSellPet(id)) { this.ui.showToast('这只宠物不可出售(仅常规宠物可卖)'); return; }
    if (!this.economy.hasPet(id)) { this.ui.showToast('你没有这只宠物'); return; }
    const fee = this.trade ? this.trade.feeFor('market').fee : MARKET_FEE;
    const net = Math.max(1, Math.round(petSellPrice(id) * (1 - fee)));
    this.economy.removePet(id, 1);
    this.economy.gold += net;
    this.ui.showToast(`送走了「${PETS[id].name}」,扣管理费后得 ${net} 金币`);
    this._marketRefresh();
    this._syncUi();
    this._autosave();
  }

  /** 市场购买宝石(含市场管理费) */
  _marketBuyGem(id) {
    const g = ITEMS[id];
    if (!g) return;
    const fee = this.trade ? this.trade.feeFor('market').fee : MARKET_FEE;
    const price = this.trade ? this.trade.marketBuyPrice(id, fee) : g.price;
    if (this.economy.gold < price) { this.ui.showToast('金币不足'); return; }
    if (!this.economy.canHold(id)) { this.ui.showToast('背包已满,请先扩容或清理'); return; }
    this.economy.gold -= price;
    this.economy.addItem(id, 1);
    this.ui.showToast(`购入「${g.name}」(含管理费共 ${price} 金币)`);
    this._marketRefresh();
    this._syncUi();
    this._autosave();
  }

  /** 购买市场的镶嵌武器(动态注册为背包中的唯一物品) */
  _marketBuyWare(key) {
    const ware = this._marketWares().find((w) => w.key === key);
    if (!ware) return;
    if (this.economy.gold < ware.price) { this.ui.showToast('金币不足'); return; }
    if (!this.economy.canHold('ware')) { this.ui.showToast('背包已满,请先扩容或清理'); return; }
    this.economy.gold -= ware.price;
    const created = this.economy.registerCustom(ware.def);
    this.economy.addItem(created.id, 1);
    this.ui.showToast(`购入「${created.name}」(花费 ${ware.price} 金币)`);
    this._marketRefresh();
    this._syncUi();
    this._autosave();
  }

  /** 上架一件物品到玩家货架(低于均价约 45% 会被秒卖) */
  _listItem(itemId, price) {
    if (!this.economy.has(itemId)) { this.ui.showToast('背包里没有这件物品'); return; }
    if (this.economy.isEquipped(itemId)) { this.ui.showToast('已装备的物品需先卸下'); return; }
    if (!isTradeable(itemId)) { this.ui.showToast('此物无法买卖'); return; }
    if (!this.economy.shelfFree()) { this.ui.showToast('货架已满,请先扩容或撤单'); return; }
    const fee = this.trade ? this.trade.feeFor('market').fee : MARKET_FEE;
    const res = this.trade ? this.trade.trySellListing(itemId, price, fee) : { sold: false };
    if (res.sold) {
      this.economy.removeItem(itemId, 1);
      this.economy.gold += res.gain;
      this.ui.showToast(`⚡ 秒卖成功:「${ITEMS[itemId]?.name}」售出,得 ${res.gain} 金币`);
    } else {
      const l = this.economy.listItem(itemId, price);
      this.ui.showToast(l ? `已上架「${ITEMS[itemId]?.name}」,售价 ${l.price}(等待买家)` : '上架失败');
    }
    this._openMarket();
    this._autosave();
  }

  _cancelListing(listingId) {
    if (this.economy.cancelListing(listingId)) this.ui.showToast('已撤下货架上的物品');
    this._openMarket();
    this._autosave();
  }

  _expandShelf() {
    const cost = this.economy.expandShelf();
    if (cost < 0) { this.ui.showToast('金币不足或货架已达上限'); return; }
    this.ui.showToast(`已开通货架,当前 ${this.economy.shelfCount} 个(花费 ${cost} 金币)`);
    this._openMarket();
    this._autosave();
  }

  /** 结算挂单:达到成交线的自动售出 */
  _settleListings() {
    if (!this.trade || !this.economy.listings.length) return [];
    const fee = this.trade.feeFor('market').fee;
    const sold = [];
    this.economy.listings = this.economy.listings.filter((l) => {
      const r = this.trade.trySellListing(l.itemId, l.price, fee);
      if (r.sold) { this.economy.gold += r.gain; sold.push({ ...l, gain: r.gain }); return false; }
      return true;
    });
    return sold;
  }

  // ===== 专属交易场所(随机出现,只收当地主题的特殊交易币) =====
  /** 该地区本局是否存在专属交易场所(整局固定) */
  _venueFor(regionId) {
    if (!this._venueCache) this._venueCache = new Map();
    if (this._venueCache.has(regionId)) return this._venueCache.get(regionId);
    const region = REGIONS[regionId];
    let venue = null;
    if (region && this.rng.next() < VENUE_CHANCE) {
      const theme = region.theme || 'village';
      const token = tokenForTheme(theme);
      venue = {
        regionId,
        theme,
        token,
        tokenName: ITEMS[token]?.name || '特殊交易币',
        tokenIcon: ITEMS[token]?.icon || '🪙',
        stopIndex: Math.floor(this.rng.next() * region.stops.length),
        fee: venueFee(this.rng),
        stock: venueStock(SHOP_STOCK[theme] || SHOP_STOCK.village, () => this.rng.next()),
      };
    }
    this._venueCache.set(regionId, venue);
    return venue;
  }

  /** 当前地点的专属交易场所(不在该地点则为 null) */
  _venueHere() {
    const v = this._venueFor(this.regionId);
    return v && v.stopIndex === this.stopIndex ? v : null;
  }

  _openVenue() {
    const venue = this._venueHere();
    if (!venue) { this.ui.showToast('这里没有隐秘集市'); return; }
    this._marketMode = 'venue';
    this.ui.renderVenue({ venue, economy: this.economy });
    this._syncUi();
    this.transition(GameState.MARKET);
  }

  _openVenueRefresh() {
    const venue = this._venueHere();
    if (!venue) { this._backToMap(); return; }
    this.ui.renderVenue({ venue, economy: this.economy });
    this._syncUi();
  }

  _venueBuy(id) {
    const venue = this._venueHere();
    if (!venue) return;
    const it = ITEMS[id];
    if (!it) return;
    const price = this.economy.venuePrice(id, venue.fee);
    if (this.economy.venueBuy(id, venue.token, venue.fee)) {
      this.ui.showToast(`以 ${price} 枚${venue.tokenName}换得「${it.name}」`);
    } else {
      this.ui.showToast(`${venue.tokenName}不足(需 ${price} 枚)`);
    }
    this._openVenueRefresh();
    this._autosave();
  }

  /** 特殊交易币的发放:宝箱 / 剧情推进 / 打工 共用(概率 30%~90%) */
  _grantToken(theme) {
    const amount = tokenDrop(() => this.rng.next());
    if (amount <= 0) return null;
    const id = tokenForTheme(theme);
    this.economy.addItem(id, amount);
    return { id, name: ITEMS[id]?.name || '特殊交易币', amount };
  }

  // ===== 邮箱 / 兑换码(跨局保留) =====
  /** 把奖励描述成可读文本(空奖励返回空串) */
  _rewardText(reward) {
    if (!reward) return '';
    const parts = [];
    if (reward.gold) parts.push(`${reward.gold} 金币`);
    if (reward.allItems) parts.push(`全部道具 ×${reward.allItems}(共 ${Object.keys(ITEMS).length} 种)`);
    for (const [id, qty] of Object.entries(reward.items || {})) {
      parts.push(`${ITEMS[id]?.name || id}×${qty}`);
    }
    if (reward.allCareers) parts.push(`全部职业(共 ${CAREERS.length} 个)`);
    return parts.join(' · ');
  }

  /** 解锁全部可切换职业,返回本次新解锁的数量 */
  _unlockAllCareers() {
    if (!this.engine || !this.engine.unlockedCareers) return 0;
    const newly = [];
    for (const c of CAREERS) {
      if (!this.engine.unlockedCareers.has(c.id)) { this.engine.unlockedCareers.add(c.id); newly.push(c.id); }
    }
    if (newly.length) this.bus.emit('narrative:career-unlocked', newly);
    return newly.length;
  }

  /** 发放奖励,返回实际到手的文本数组;无进行中的旅程时返回 null(不发放) */
  _applyReward(reward) {
    if (!reward || !this.economy) return null;
    const got = [];
    if (reward.gold) { this.economy.gold += reward.gold; got.push(`${reward.gold} 金币`); }
    if (reward.allItems) {
      let n = 0;
      for (const id of Object.keys(ITEMS)) {
        if (this.economy.addItem(id, reward.allItems)) n += 1;
      }
      got.push(`全部道具 ×${reward.allItems}(共 ${n} 种)`);
    }
    for (const [id, qty] of Object.entries(reward.items || {})) {
      if (this.economy.addItem(id, qty)) got.push(`${ITEMS[id]?.name || id}×${qty}`);
    }
    if (reward.allCareers) {
      const n = this._unlockAllCareers();
      got.push(`全部职业(共 ${CAREERS.length} 个)${n ? '' : '(已全数解锁)'}`);
    }
    this._syncUi();
    return got;
  }

  /** 邮箱当前的展示状态(信件列表 + 可领取数量;含兑换码寄来的信) */
  _mailState() {
    if (!this.mailState) this.mailState = loadMailState();
    const claimed = this.mailState.claimed || {};
    const granted = Object.values(this.mailState.granted || {});
    const all = [...granted, ...MAILS];   // 兑换码寄来的信置顶
    const mails = all.map((m) => ({
      id: m.id,
      no: m.no || '',
      from: m.from || '',
      title: m.title || '',
      body: m.body || '',
      rewardText: this._rewardText(m.reward),
      hasReward: !!m.reward,
      claimed: !!claimed[m.id],
    }));
    return { mails, claimable: mails.filter((m) => m.hasReward && !m.claimed).length };
  }

  /** 刷新右下角邮箱红点(带奖励且未领取的信件数) */
  _refreshMailBadge() {
    const { claimable } = this._mailState();
    this.ui.setMailBadge(claimable);
  }

  _openMailbox() {
    this.ui.renderMailbox(this._mailState());
  }

  _claimMail(id) {
    const granted = (this.mailState && this.mailState.granted) || {};
    const mail = granted[id] || MAILS.find((m) => m.id === id);
    if (!mail) return;
    if (!this.mailState) this.mailState = loadMailState();
    this.mailState.claimed = this.mailState.claimed || {};
    if (this.mailState.claimed[id]) { this.ui.showToast('这封信的奖励已经领过了'); this._openMailbox(); return; }
    if (mail.reward && !this.economy) { this.ui.showToast('先开始一局旅程,再来领奖励'); return; }
    const got = mail.reward ? this._applyReward(mail.reward) : [];
    this.mailState.claimed[id] = true;
    saveMailState(this.mailState);
    this._refreshMailBadge();
    this.ui.showToast(got && got.length ? `领取成功:${got.join('、')}` : '已阅');
    this._openMailbox();
    this._autosave();
  }

  _openRedeem() {
    if (!this.mailState) this.mailState = loadMailState();
    const used = Object.keys(this.mailState.used || {}).length;
    this.ui.renderRedeem({ msg: used ? `本机已兑换 ${used} 个礼包码` : '', kind: '', reset: true });
  }

  _redeemCode(raw) {
    if (!this.mailState) this.mailState = loadMailState();
    this.mailState.used = this.mailState.used || {};
    const code = String(raw || '').trim().toUpperCase();
    if (!code) { this.ui.renderRedeem({ msg: '请输入兑换码', kind: 'bad' }); return; }
    const hit = REDEEM_CODES.find((c) => String(c.code || '').toUpperCase() === code);
    if (!hit || hit.invalid) { this.ui.renderRedeem({ msg: '兑换码无效,请核对后重试', kind: 'bad' }); return; }
    if (!hit.unlimited && this.mailState.used[code]) { this.ui.renderRedeem({ msg: '这个兑换码已经兑换过了', kind: 'bad' }); return; }
    const label = hit.label ? `「${hit.label}」` : '';

    // 速通:兑换当即把指定大章标记为已通关(解锁后续大章),与奖励如何投递无关
    let skipNote = '';
    if (hit.skipChapter) {
      const isNew = this._markChapterCleared(hit.skipChapter);
      const name = hit.skipChapter === 'ch01' ? '第一大章「家园破碎」' : '目标大章';
      skipNote = isNew ? `${name}已速通并解锁,` : `${name}此前已通关,`;
    }

    // 寄到邮箱:兑换当即生效,奖励需去「邮箱」点领取才入袋
    if (hit.deliver === 'mail') {
      const id = `grant_${code}`;
      this.mailState.granted = this.mailState.granted || {};
      this.mailState.granted[id] = {
        id,
        no: hit.no || '',
        from: (hit.mail && hit.mail.from) || '守约 · 系统',
        title: (hit.mail && hit.mail.title) || hit.label || '礼包',
        body: (hit.mail && hit.mail.body) || '兑换成功,点「领取」入袋。',
        reward: hit.reward || null,
      };
      // 持久码重复兑换:重新唤起同一封信,允许再次领取
      if (hit.unlimited) { this.mailState.claimed = this.mailState.claimed || {}; delete this.mailState.claimed[id]; }
      if (!hit.unlimited) this.mailState.used[code] = true;
      saveMailState(this.mailState);
      this._refreshMailBadge();
      this.ui.renderRedeem({ msg: `兑换成功${label}:${skipNote}已寄达「邮箱」,请在邮箱点「领取」`, kind: 'ok' });
      return;
    }

    if (!this.economy) { this.ui.renderRedeem({ msg: `${skipNote}先开始一局旅程,再来领奖励`, kind: skipNote ? 'ok' : 'bad' }); return; }
    const got = this._applyReward(hit.reward) || [];
    if (!hit.unlimited) this.mailState.used[code] = true;
    saveMailState(this.mailState);
    this.ui.renderRedeem({ msg: `兑换成功${label}:${skipNote}${got.length ? got.join('、') : '（无奖励）'}`, kind: 'ok' });
  }

  // ===== 回忆(剧情回顾) / 衣橱(更换时装) =====
  /** 回忆弹窗数据:全部大章的通关状态与回顾(未通关大章显示「未解锁」) */
  _memorialData() {
    const cleared = this.progress?.cleared || {};
    const curChapter = this.engine?.currentChapterId || this._storyChapter || this.regionId;
    const curMajor = majorChapterOf(curChapter);
    let clearedCount = 0;
    const chapters = MAJOR_CHAPTERS.map((mc) => {
      const isCleared = !!cleared[mc.id];
      if (isCleared) clearedCount++;
      const isCurrent = curMajor && curMajor.id === mc.id;
      const status = isCleared ? 'cleared' : (isCurrent ? 'current' : 'locked');
      return {
        id: mc.id,
        no: mc.no,
        title: mc.title,
        recap: CHAPTER_RECAPS[mc.id] || '',
        status,
      };
    });
    return { chapters, clearedCount, total: chapters.length };
  }

  _openMemorial() {
    this.ui.renderMemorial(this._memorialData());
  }

  /** 衣橱弹窗数据:七个防具外观槽 + 背包中各槽可选防具 + 当前形象预览 */
  _wardrobeData() {
    const eco = this.economy;
    const slots = {};
    for (const slot of ARMOR_SLOTS) {
      const options = this._bagOf((id) => armorSlotOf(id) === slot).map((o) => ({
        id: o.id, name: o.name, icon: o.icon, level: o.level,
        tint: ITEMS[o.id]?.tint || null,
      }));
      const curId = eco.cosmetic[slot];
      const curDef = curId ? ITEMS[curId] : null;
      const current = (curDef && options.some((o) => o.id === curId))
        ? { id: curId, name: curDef.name, icon: curDef.icon || '❔', level: curDef.level || 0, tint: curDef.tint || null }
        : null;
      slots[slot] = { current, options };
    }
    return {
      appearance: eco.appearance(),
      careerId: this.engine?.career?.id || this.career?.id || null,
      lookLabel: lookLabel(eco.body, eco.skin),
      slots,
    };
  }

  _openWardrobe() {
    if (!this.economy) { this.ui.showToast('先开始一局旅程,再来整理衣橱'); return; }
    this.ui.renderWardrobe(this._wardrobeData());
  }

  /** 更换防具外观(纯装饰,不给数值;物品留在背包) */
  _setCosmetic(slot, id) {
    if (!this.economy) return;
    if (!this.economy.setCosmetic(slot, id)) { this.ui.showToast('无法以此件作为外观'); return; }
    this._autosave();
    // 重开衣橱以刷新预览与选中态;若正处地图,同步重绘左下角人物形象
    this.ui.renderWardrobe(this._wardrobeData());
    if (this.state === GameState.MAP) this._renderMap();
  }

  /**
   * 注销:清除本机上的全部游戏进度与资料(运行时存档 / 章节进度 / 邮箱与兑换记录 / 新手引导),
   * 随后刷新页面回到初始界面。音量等设备偏好保留。
   */
  _logout() {
    // 阻止 pagehide / beforeunload 时的自动存档把刚清除的数据又写回来
    this._loggedOut = true;
    clearSavedGame();
    try {
      localStorage.removeItem(PROGRESS_KEY);
      localStorage.removeItem(MAIL_KEY);
      localStorage.removeItem(TUTORIAL_KEY);
    } catch { /* 忽略存储异常 */ }
    this.ui.closeSettings();
    this.ui.showToast('已注销 · 正在返回初始界面……');
    window.setTimeout(() => window.location.reload(), 700);
  }

  // ===== 背包 =====
  _openBag() {
    this._syncUi();
    this.ui.renderBag(this._bagData());
    this.transition(GameState.BAG);
  }

  _bagRefresh() {
    this._syncUi();
    this.ui.renderBag(this._bagData());
  }

  /** 背包数据(含格数与扩容费用) */
  _bagData() {
    return {
      economy: this.economy,
      player: this.player,
      bagCap: this.economy.bagCap,
      bagUsed: this.economy.slotCount(),
      expandCost: this.economy.bagUpgradeCost(),
    };
  }

  /** 背包扩容(一次 +10 格) */
  _expandBag() {
    const cost = this.economy.expandBag();
    if (cost < 0) { this.ui.showToast('金币不足,无法扩容'); return; }
    this.ui.showToast(`背包已扩至 ${this.economy.bagCap} 格(花费 ${cost} 金币)`);
    this._bagRefresh();
    this._autosave();
  }

  _useItem(id) {
    const r = this.economy.useItem(id, this.player, this.currentBattle);
    // 改名卡 / 美梦药水:交由角色弹窗处理(此处不消耗)
    if (r.ok && r.prompt === 'skip_chapter') { this._skipChapter(id, r.from, r.to, r.next); return; }
    if (r.ok && r.prompt) { this._openCharacterSheet(r.prompt); return; }
    this.ui.showToast(r.msg);
    if (r.promotions?.length) this._applyCareerPromotions(r.promotions);
    this._bagRefresh();
    if (this.state === GameState.BATTLE && this.currentBattle) this.currentBattle._refresh();
    this._autosave();
  }

  /** 批量使用消耗品(药品 / 食品) */
  _useItemAll(id) {
    const r = this.economy.useItemBatch(id, this.player);
    this.ui.showToast(r.msg);
    this._bagRefresh();
    if (this.state === GameState.BATTLE && this.currentBattle) this.currentBattle._refresh();
    this._autosave();
  }

  /**
   * 使用「记忆之书」跳过对应区间的主线剧情。
   * · 仅可在玩家身处该区间(regionId 章节序号在 [from, to] 内)时使用
   * · 发放该区间全部奖励(属性 / 关键 flag / 职业),消耗书本
   * · 标记区间内所有章节已到访,跳转到 next 章节,并弹出剧情简介
   */
  _skipChapter(bookId, from, to, next) {
    if (this.state === GameState.BATTLE) { this.ui.showToast('战斗中无法使用记忆之书'); return; }
    if (!from || !to || !next) { this.ui.showToast('此记忆之书已失效'); return; }
    const fromN = chapterNumber(from);
    const toN = chapterNumber(to);
    const curN = chapterNumber(this.regionId);
    if (curN < fromN || curN > toN) {
      this.ui.showToast(`记忆之书仅可在第 ${fromN}~${toN} 章境内使用`);
      return;
    }
    const key = `${from}_${to}`;
    const rw = CHAPTER_SKIP_REWARDS[key];
    if (!rw) { this.ui.showToast('此记忆之书已失效'); return; }

    // 1) 发放属性
    if (rw.stats) {
      for (const [k, v] of Object.entries(rw.stats)) {
        this.engine.stats[k] = (this.engine.stats[k] || 0) + v;
      }
    }
    // 2) 发放关键 flag
    if (rw.flags) {
      for (const f of rw.flags) this.engine.flags.add(f);
    }
    // 3) 职业:分配 / 解锁
    if (rw.assign_career && !this.engine.career) {
      this.engine.assignCareer(rw.assign_career);
    }
    if (rw.unlock_career) {
      const list = Array.isArray(rw.unlock_career) ? rw.unlock_career : [rw.unlock_career];
      for (const c of list) this.engine.unlockedCareers.add(c);
    }
    // 4) 消耗书本
    this.economy.removeItem(bookId, 1);
    // 5) 标记区间内所有章节已到访(地图可见 / 章节选择解锁)
    for (let n = fromN; n <= toN; n++) {
      const cid = n < 10 ? `ch0${n}` : `ch${n}`;
      this._visited.add(cid);
    }
    this._syncPlayerStats();

    // 6) 弹出剧情简介,确认后跳转目标章节
    this.ui.showStorySummary({
      chapter: `${fromN}~${toN}`,
      title: rw.title,
      summary: rw.summary,
      rewards: rw.stats,
      onConfirm: () => {
        this.engine.enterChapter(next);
        this._bagRefresh();
        this._autosave();
      },
    });
  }

  // ===== 角色弹窗(防具 / 服饰 / 形象 / 职业) =====
  /** 背包物品 → 视图条目 */
  _csItem(id) {
    const it = ITEMS[id];
    if (!it) return null;
    return { id, name: it.name, icon: it.icon || '❔', level: it.level || 0 };
  }

  /** 背包里满足条件的物品(按等级降序) */
  _bagOf(pred) {
    const out = [];
    for (const [id, qty] of this.economy.bag.entries()) {
      if (!pred(id)) continue;
      const it = this._csItem(id);
      if (it) { it.qty = qty; out.push(it); }
    }
    out.sort((a, b) => (b.level || 0) - (a.level || 0));
    return out;
  }

  /** 组装角色弹窗数据 */
  _characterSheetData() {
    const eco = this.economy;
    const career = this.engine?.career || this.career || { id: null, name: '无名少年' };
    const rank = eco.careerRank();
    const armor = {}; const armorOptions = {};
    for (const slot of ARMOR_SLOTS) {
      armor[slot] = eco.equipped[slot] ? this._csItem(eco.equipped[slot]) : null;
      armorOptions[slot] = this._bagOf((id) => armorSlotOf(id) === slot);
    }
    const outfits = {}; const outfitOptions = {};
    for (const slot of ['hat', 'top', 'bottom', 'shoes']) {
      outfits[slot] = eco.equipped[slot] ? this._csItem(eco.equipped[slot]) : null;
      outfitOptions[slot] = this._bagOf((id) => ITEMS[id]?.equipment?.slot === slot);
    }
    const unlocked = this.engine?.unlockedCareers || new Set();
    // 各职业等级同步(切换/升级时自动对齐),列表里标出各自的等级
    const careers = CAREERS.map((c) => ({
      id: c.id, name: c.name,
      level: eco.careerLevelOf(c.id),
      unlocked: unlocked.has(c.id) || (career && career.id === c.id),
      active: career && career.id === c.id,
    }));
    return {
      name: eco.playerName,
      body: eco.body,
      skin: eco.skin,
      lookLabel: lookLabel(eco.body, eco.skin),
      appearance: eco.appearance(),
      armor, armorOptions, outfits, outfitOptions,
      career: {
        id: career?.id || null,
        name: career?.name || '无名少年',
        // 随职介晋升合成的当前职业名(如 魔法学徒 → 魔法教授)
        title: career?.root ? careerTitleOf(career.root, eco.careerLevel) : (career?.name || '无名少年'),
        level: eco.careerLevel,
        max: CAREER_MAX_LEVEL,
        freeMax: CAREER_FREE_MAX,
        rankName: rank?.name || '',
        major: rank?.major || '',
        exp: eco.careerExp,
        expMax: eco.careerExpToNext(),
      },
      careers,
      pets: eco.petList().map(([id, count]) => {
        const p = PETS[id];
        return {
          id,
          name: p?.name || id,
          icon: p?.icon || '🐾',
          rarity: p ? (PET_RARITY[p.rarity] || p.rarity) : '',
          skill: p ? petSkills(p).map(petSkillText).join('、') : '',
          count,
          active: eco.petActive === id,
        };
      }),
      hasRename: eco.has('rename_card'),
      hasDream: eco.has('dream_potion'),
      lookChosen: eco.lookChosen,
      nameChosen: eco.nameChosen,
    };
  }

  /** 打开角色弹窗(prompt: 'look' | 'rename' | null) */
  _openCharacterSheet(prompt = null) {
    this.ui.renderCharacterSheet(this._characterSheetData(), prompt);
  }

  /** 换装(防具 / 服饰;武器受职业限制) */
  _charEquip(id) {
    if (!this.economy.canEquip(id, this.engine?.career?.id)) {
      this.ui.showToast('此武器与你的职业不符,无法使用');
      return;
    }
    if (!this.economy.equip(id)) { this.ui.showToast('无法装备'); return; }
    this._syncPlayerStats?.();
    this._syncUi();
    this._autosave();
    this._openCharacterSheet();
  }

  _charUnequip(slot) {
    if (!this.economy.unequip(slot)) return;
    this._syncPlayerStats?.();
    this._syncUi();
    this._autosave();
    this._openCharacterSheet();
  }

  /** 在角色弹窗内切换职业(须已解锁) */
  _charSwitchCareer(id) {
    if (!this.engine?.switchCareer) return;
    if (!this.engine.switchCareer(id)) { this.ui.showToast('该职业尚未解锁'); return; }
    this._syncUi();
    this._autosave();
    this._openCharacterSheet();
  }

  /** 改名(初次免费;此后消耗改名卡) */
  _charRename(name) {
    const eco = this.economy;
    const free = !eco.nameChosen;
    if (!free && !eco.has('rename_card')) { this.ui.showToast('需要「改名卡」'); return; }
    const n = String(name || '').trim();
    if (!n) { this.ui.showToast('名字不能为空'); return; }
    if (!eco.setName(n)) { this.ui.showToast('这个名字用不得'); return; }
    if (free) eco.nameChosen = true;
    else eco.removeItem('rename_card', 1);
    this.ui.showToast(`你自此名为「${eco.playerName}」`);
    this._bagRefresh?.();
    this._autosave();
    this._openCharacterSheet();
  }

  /** 指定 / 取消出战宠物(null 表示收回) */
  _charPet(id) {
    if (!this.economy.setActivePet(id)) { this.ui.showToast('尚未拥有这只宠物'); return; }
    this.ui.showToast(id ? `带上「${PETS[id]?.name || id}」同行` : '宠物已收回');
    this._autosave();
    this._openCharacterSheet();
  }

  /** 换形象(初次免费;此后消耗美梦药水) */
  _charLook({ body, skin } = {}) {
    const eco = this.economy;
    const free = !eco.lookChosen;
    if (!free && !eco.has('dream_potion')) { this.ui.showToast('需要「美梦药水」'); return; }
    eco.setLook(body, skin);
    if (free) eco.lookChosen = true;
    else eco.removeItem('dream_potion', 1);
    this.ui.showToast(`一梦醒来,你成了${lookLabel(eco.body, eco.skin)}的模样`);
    this._bagRefresh?.();
    this._autosave();
    this._openCharacterSheet();
  }

  _equipItem(id) {
    const wasSet = this._emperorSet();
    if (!this.economy.equip(id)) { this.ui.showToast('无法装备'); return; }
    this._syncPlayerStats();
    this._bagRefresh();
    // 刚凑齐「皇帝的新衣」全套:当场给出风险反馈
    if (!wasSet && this._emperorSet()) {
      if (this._isCity(this.regionId)) {
        const fine = this._maybeFine();
        this.ui.showToast(fine ? `穿戴齐「皇帝的新衣」 —— ${fine}` : '穿戴齐「皇帝的新衣」 —— 主城的巡卫盯着你,这次侥幸没被逮住');
      } else {
        this.ui.showToast('穿戴齐「皇帝的新衣」 —— 荒野里的高阶怪物会循味找来');
      }
      this._autosave();
      return;
    }
    this.ui.showToast(`装备「${ITEMS[id].name}」`);
    this._autosave();
  }

  _unequipItem(slot) {
    if (!this.economy.unequip(slot)) return;
    this._syncPlayerStats();
    this._bagRefresh();
    this._autosave();
  }

  _dropItem(id) {
    if (this.economy.isEquipped(id)) { this.ui.showToast('已装备的物品需先卸下'); return; }
    if (this.economy.dropItem(id, 1)) this.ui.showToast(`丢弃了「${ITEMS[id].name}」`);
    this._bagRefresh();
    this._autosave();
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
    if (this.economy.ap < tier.ap) { this.ui.showToast('行动力不足 —— 吃点干粮或推进剧情再回来'); return; }
    this.ui.openMinigame(job, tier, tierIndex);
  }

  /** 小游戏结束:达标才消耗行动力并发放金币(未达标不扣,可重来) */
  _finishJob({ jobId, tierIndex, success }) {
    const job = this._jobsHere().find((j) => j.id === jobId);
    const tier = job?.tiers?.[tierIndex];
    if (!job || !tier) return;
    if (success) {
      if (!this.economy.spendAp(tier.ap)) { this.ui.showToast('行动力不足,奖励未发放'); return; }
      const gold = this._grantGold(tier.gold);
      // 打工收工:有机会结到当地主题的特殊交易币
      const token = this._grantToken(this._currentTheme());
      this.ui.showToast(`「${job.name}」达标,赚得 ${gold} 金币${token ? ` 与 ${token.name}×${token.amount}` : ''}`);
    } else {
      this.ui.showToast(`「${job.name}」未达标,再试一次`);
    }
    this.ui.renderJobs({ theme: this._currentTheme(), jobs: this._jobsHere(), economy: this.economy });
    this._syncUi();
    this._autosave();
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
  /** 切换自动战斗模式 */
  _toggleAutoBattle() {
    if (!this.currentBattle) return;
    this.currentBattle.setAutoMode(!this.currentBattle.autoMode);
  }

  /** 剧情节点要求开战:按地区进度从敌人池中选取(小怪 → 首领),并叠加章节难度。
   *  ch20 起开启群体作战:多敌人 + 队友参战;玩家可自选攻击目标。 */
  _startNarrativeBattle({ poolKey }) {
    if (!this.deck) {
      const base = ['strike', 'strike', 'strike', 'defend', 'defend', 'cleave', 'pommel', 'shield_bash'];
      this.deck = new Deck(base.map((id) => CARDS[id]).filter(Boolean), this.rng);
    }
    const pool = ENEMIES[poolKey] || ENEMIES.normal;
    const region = REGIONS[this.regionId];
    const ratio = region && region.stops.length > 1 ? this.stopIndex / (region.stops.length - 1) : 0;
    const idx = Math.min(pool.length - 1, Math.round(ratio * (pool.length - 1)));
    const chNum = this._chapterNum();

    // ===== 群体作战(ch20 起)=====
    // 多敌人:ch25 决战平原、ch26 内城之战固定多敌人;其他章节若池中有多个敌人则出 2 个
    const groupMode = chNum >= 20;
    let enemyDefs;
    if (groupMode) {
      if (poolKey === 'ch25') {
        // 决战平原:3 个敌人(步兵+弓手+队长)
        enemyDefs = pool.slice(0, 3).map((d) => scaleEnemy(d, chNum));
      } else if (poolKey === 'ch26') {
        // 内城之战:2 个敌人(卫兵+将军)
        enemyDefs = pool.slice(0, 2).map((d) => scaleEnemy(d, chNum));
      } else if (pool.length >= 2) {
        // 其他章节:出 2 个敌人
        enemyDefs = [pool[idx], pool[(idx + 1) % pool.length]].map((d) => scaleEnemy(d, chNum));
      } else {
        enemyDefs = [scaleEnemy(pool[idx] || pool[0], chNum)];
      }
    } else {
      enemyDefs = [scaleEnemy(pool[idx] || pool[0], chNum)];
    }

    // 队友:ch23 起(联军营地)解锁队友参战
    let allyIds = null;
    if (groupMode && chNum >= 23) {
      allyIds = ['brother'];
      if (chNum >= 24) allyIds.push('general');
      if (chNum >= 25) allyIds.push('friend');
    }

    // 战力 = 装备加成 + 战力药剂(一次性)
    this.player.power = this.economy.equipStats().atkPower;
    const bonusStrength = this.player.power + this.economy.consumePendingPower();

    this.currentBattle = new Battle({
      player: this.player,
      deck: this.deck,
      enemyDefs,
      allyIds,
      rng: this.rng,
      bus: this.bus,
      bonusStrength,
      pet: this._activePet(),
    });
    this.ui.bindBattle(this.currentBattle);
    this.transition(GameState.BATTLE);
    this.currentBattle.start();
    this._applyBattleStartBlock();
  }

  /** 出战宠物(供战斗使用) */
  _activePet() {
    const id = this.economy?.petActive;
    const p = id ? PETS[id] : null;
    if (!p) return null;
    return { id: p.id, name: p.name, icon: p.icon, skills: petSkills(p) };
  }

  /** 战斗开始时的装备增益(勇敢宝石 → 初始护甲) */
  _applyBattleStartBlock() {
    const blk = this.economy?.equipStats?.().startBlock || 0;
    if (blk > 0 && this.player?.addBlock) this.player.addBlock(blk);
  }

  onBattleEnd(result) {
    // 角斗场:不入战利品流程,结算奖金后退回酒馆
    if (this._arenaBattle) { this._onArenaEnd(result); return; }
    // 途中遭遇战:不入战利品流程,胜利后继续赶路
    if (this._wildBattle) { this._onWildBattleEnd(result); return; }
    // 逃跑:直接回到地图
    if (result === 'escape') {
      this.currentBattle = null;
      // 剧情战斗逃跑:重置门控,允许重试
      if (this.engine?._pendingBattle) {
        this.engine._pendingBattle = null;
        const seg = this.segment;
        if (seg) this.engine.rearmGate(seg.chapterId, seg.nodeId);
      }
      this.ui.showToast('烟雾弥漫,你趁机脱离了战斗');
      this._backToMap();
      return;
    }
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
      pet: this._activePet(),
    });
    this.ui.bindBattle(this.currentBattle);
    this.transition(GameState.BATTLE);
    this.currentBattle.start();
    this._applyBattleStartBlock();
  }

  /** 途中遭遇战结束:胜则继续赶路,败则中止旅途退回起点 */
  _onWildBattleEnd(result) {
    this._wildBattle = false;
    this.currentBattle = null;
    if (result === 'escape') {
      this.ui.showToast('烟雾弥漫,你趁机脱离了战斗');
      if (this.travel?.active) {
        this.transition(GameState.TRAVEL);
        this.travel.resume();
      } else {
        this.transition(GameState.MAP);
        this._renderMap();
        this._autosave();
      }
      return;
    }
    if (result === 'victory') {
      const ch = this._chapterNum();
      let baseGold = 5 + Math.floor(this.rng.next() * 5) + ch;
      if (this.economy.goldLuckActive) {
        baseGold *= 2;
        this.economy.goldLuckActive = false;
      }
      const gold = this._grantGold(baseGold);
      let loot = null;
      if (this.rng.next() < 0.35) {
        loot = LOOT_MISC[Math.floor(this.rng.next() * LOOT_MISC.length)];
        this.economy.addItem(loot, 1);
      }
      const drops = this._rollBattleDrops();
      const dropTxt = [
        drops.material ? `${ITEMS[drops.material.id]?.name}×${drops.material.qty}` : '',
        drops.gem ? `${ITEMS[drops.gem.id]?.name}×${drops.gem.qty}` : '',
      ].filter(Boolean).join('、');
      this._gainCareerFromBattle(6 + ch * 3);
      this._syncUi();
      this.ui.showToast(`击退拦路者,拾得 ${gold} 金币${loot ? `与「${ITEMS[loot]?.name || loot}」` : ''}${dropTxt ? `,另得 ${dropTxt}` : ''}`);
      if (this.travel?.active) {
        this.transition(GameState.TRAVEL);
        this.travel.resume();
      } else {
        this.transition(GameState.MAP);
        this._renderMap();
        this._autosave();
      }
      return;
    }

    // 战败:中止当前流程(旅途退回出发地;酒店休整则醒来留在原地)
    const resting = this.travel?.info?.mode === 'rest';
    const place = this.travel?.info?.fromLabel || REGIONS[this.regionId]?.stops[this.stopIndex]?.name || '此地';
    const penalty = Math.max(10, Math.floor(this.economy.gold * 0.15));
    this.economy.gold = Math.max(0, this.economy.gold - penalty);
    this.travel?.cancel();
    this._trip = null;
    if (!resting) this.stopIndex = 0;
    this._syncPlayerStats();
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
    this._syncUi();
    this.transition(GameState.MAP);
    this._renderMap();
    this.ui.showToast(resting
      ? `歇脚时被撂倒……你在「${place}」醒来,损失 ${penalty} 金币`
      : `你倒在了路上……退回「${REGIONS[this.regionId]?.stops[0]?.name || '出发地'}」,损失 ${penalty} 金币`);
    this._autosave();
  }

  // ===== 职业等级 / 晋升 =====
  /** 战斗胜利累积职业经验(随职介提高倍率);返回本次结果 */
  _gainCareerFromBattle(base) {
    const bonus = rankExpBonus(this.economy.careerRankIndex());
    const r = this.economy.gainCareerExp(base, bonus);
    if (r.promotions?.length) this._applyCareerPromotions(r.promotions);
    return r;
  }

  /**
   * 结算晋升:发放金币 / 材料 / 宝石奖励;进入新的大职介时整套赠送服饰。
   * @param {Array<{index:number, rank:{name:string, major:string}, newMajor:boolean}>} promotions
   */
  _applyCareerPromotions(promotions) {
    if (!promotions || !promotions.length) return;
    const gemPool = ['gem_strength', 'gem_magic', 'gem_brave', 'gem_life'];
    const matLow = ['mat_iron', 'mat_wood', 'mat_leather'];
    const matHigh = ['mat_crystal', 'mat_scale', 'mat_meteor'];
    for (const p of promotions) {
      const rw = rankReward(p.index);
      const gold = Math.round(rw.gold);
      this.economy.gold += gold;
      const parts = [`${gold} 金币`];
      if (rw.material) {
        const pool = p.index >= 6 ? matHigh : matLow;
        const mid = pool[Math.floor(this.rng.next() * pool.length)];
        this.economy.addItem(mid, rw.material);
        parts.push(`${ITEMS[mid]?.name || mid}×${rw.material}`);
      }
      if (rw.gem) {
        const gid = gemPool[Math.floor(this.rng.next() * gemPool.length)];
        this.economy.addItem(gid, rw.gem);
        parts.push(`${ITEMS[gid]?.name || gid}×${rw.gem}`);
      }
      if (p.newMajor) {
        const ids = majorSetIds(p.rank.major);
        for (const sid of ids) if (ITEMS[sid]) this.economy.addItem(sid, 1);
        parts.push(`一整套「${p.rank.major}」服饰`);
      }
      this.ui.showToast(`✦ 晋升「${p.rank.name}」!获赐 ${parts.join('、')}`);
    }
    this._syncPlayerStats?.();
    this._bagRefresh?.();
  }

  /** 胜利奖励:金币 + 概率掉落杂物 + 材料 / 宝石 */
  _grantBattleRewards() {
    const ch = this._chapterNum();
    let baseGold = 8 + Math.floor(this.rng.next() * 6) + ch * 2;
    if (this.economy.goldLuckActive) {
      baseGold *= 2;
      this.economy.goldLuckActive = false;
    }
    const gold = this._grantGold(baseGold);
    let loot = null;
    if (this.rng.next() < 0.5) {
      loot = LOOT_MISC[Math.floor(this.rng.next() * LOOT_MISC.length)];
      this.economy.addItem(loot, 1);
    }
    const drops = this._rollBattleDrops();
    this._lastBattleReward = { gold, loot, drops };
    // 职业经验:随章节提升
    this._lastBattleReward.career = this._gainCareerFromBattle(12 + ch * 5);
    this._syncUi();
  }

  /**
   * 战斗掉落:锻造材料(常见)与宝石(稀有,自然获取难度较大)。
   * 铁匠锻造的原料主要来源之一。
   */
  _rollBattleDrops() {
    const out = { material: null, gem: null };
    if (this.rng.next() < 0.7) {
      const id = rollMaterial(() => this.rng.next());
      const qty = id === 'mat_meteor' || id === 'mat_scale' ? 1 : 1 + Math.floor(this.rng.next() * 2);
      this.economy.addItem(id, qty);
      out.material = { id, qty };
    }
    if (this.rng.next() < 0.08) {
      const id = rollGem(() => this.rng.next());
      this.economy.addItem(id, 1);
      out.gem = { id, qty: 1 };
    }
    return out;
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
    this._autosave();
  }

  /** 战斗结果交回剧情引擎,并跳到对应视图(结局节点先展示结局散文,由「查看结局」进入结算) */
  _resolveAfterBattle(result) {
    this._currentRewards = null;
    this.engine.onBattleResult(result);
    // 战后的下一节点若是门控锚点,引擎已切到地区地图,勿再覆盖
    if (this.state === GameState.MAP) { this._autosave(); return; }
    // 无论下一节点是 narrative 还是 ending,都进入叙事视图展示文本;
    // ending 节点的结算画面由玩家点击「查看结局」(ui:show-ending)触发。
    this.transition(GameState.NARRATIVE);
    this._autosave();
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

  /** 主菜单大章条目(含通关 / 解锁状态) */
  _chapterEntries() {
    const cleared = this.progress?.cleared || {};
    return MAJOR_CHAPTERS.map((mc, idx) => {
      const prev = idx > 0 ? MAJOR_CHAPTERS[idx - 1] : null;
      return {
        id: mc.id,
        badge: mc.no,
        title: mc.title,
        sub: `${mc.chapters.length} 节 · 主线剧情`,
        locked: prev ? !cleared[prev.id] : false,
        cleared: !!cleared[mc.id],
      };
    });
  }

  /** 速通:把指定大章标记为已通关(写入进度,解锁后续大章);返回是否为新标记 */
  _markChapterCleared(majorId) {
    if (this.progress?.cleared?.[majorId]) return false;
    this.progress = markChapterCleared(majorId);
    this.ui.renderChapterSelect(this._chapterEntries(), this._saveInfo());
    return true;
  }

  /**
   * 剧情快照推进时检测「跨大章」:玩家离开某大章的最后一节(进入下一大章或结局)
   * 即视为该大章通关 —— 记录通关进度、行动力回满、寄出「通关谢仪」到邮箱。
   * 支线地区(ch02b / ch04b / ch05b)与非末尾小节的切换不触发通关。
   */
  _checkChapterClear(snap) {
    const cur = snap?.chapter;
    const prev = this._storyChapter;
    if (!cur || !prev || cur === prev) return;
    this._storyChapter = cur;
    // 只在离开「某大章最后一节」时结算该大章
    const prevMajor = majorChapterOf(prev);
    if (!prevMajor || prevMajor.lastChapter !== prev) return;
    if (this.progress?.cleared?.[prevMajor.id]) return;
    this.progress = markChapterCleared(prevMajor.id);
    this.ui.renderChapterSelect(this._chapterEntries(), this._saveInfo());
    const title = `${prevMajor.no} · ${prevMajor.title}`;
    const apGot = this.economy ? this.economy.addAp(this.economy.apCap()) : 0;
    // 通关谢仪:寄到「邮箱」,点「领取」才入袋
    this._sendChapterMail(prevMajor.id);
    this.ui.showToast(`✦ ${title} 已通关${apGot ? ' · 行动力已回满' : ''} · 驿站寄来通关谢仪`);
    // 通关第一大章:在世界地图上随机出现餐厅 / 酒店 / 商市
    if (prevMajor.id === 'mc1') this._generatePois();
  }

  /** 大章通关:把「通关谢仪」信(含奖励与剧情回顾)寄到邮箱;已寄过则不重发 */
  _sendChapterMail(majorId) {
    const reward = CHAPTER_CLEAR_REWARDS[majorId];
    const recap = CHAPTER_RECAPS[majorId];
    if (!reward && !recap) return;
    if (!this.mailState) this.mailState = loadMailState();
    this.mailState.granted = this.mailState.granted || {};
    const id = `clear_${majorId}`;
    if (this.mailState.granted[id]) return;
    const n = majorId === 'mc1' ? 1 : majorId === 'mc2' ? 2 : 0;
    const mc = MAJOR_CHAPTERS.find((m) => m.id === majorId);
    const title = mc ? `${mc.no} · ${mc.title}` : majorId;
    this.mailState.granted[id] = {
      id,
      no: `M${String(n).padStart(2, '0')}`,
      from: '守约 · 驿站',
      title: `${title} · 通关谢仪`,
      body: `${recap}\n大章既已走完,驿站随信附上这一程的谢仪。点「领取」收入行囊,再启新程。`,
      reward: reward || null,
    };
    saveMailState(this.mailState);
    this._refreshMailBadge();
  }

  /** 通关第一章后,在世界地图随机生成 POI_COUNT 个兴趣点 */
  _generatePois() {
    if (this._pois.length > 0) return; // 已生成过则不重复
    this._pois = generatePois(this.rng);
    this.ui.showToast(`✦ 世界地图上出现了 ${POI_COUNT} 处新的驻足之地(餐厅 / 酒店 / 商市)`);
  }

  /** 打开当前所在 POI 的服务界面 */
  _openPoi() {
    if (!this._atPoi) return;
    const poi = this._atPoi;
    if (poi.type === 'restaurant') this._openRestaurant(poi);
    else if (poi.type === 'hotel') this._openHotel(poi);
    else if (poi.type === 'market') this._openMarketPoi(poi);
  }

  // ===== 餐厅 =====
  _openRestaurant(poi) {
    const foods = RESTAURANT_FOOD.map((id) => ITEMS[id]).filter(Boolean);
    this.ui.renderRestaurant({
      name: poi.name,
      foods,
      economy: this.economy,
    });
    this.transition(GameState.RESTAURANT);
  }

  _restaurantBuy(id) {
    const it = ITEMS[id];
    if (!it) return;
    if (this.economy.buy(id)) this.ui.showToast(`在餐厅购入「${it.name}」`);
    else this.ui.showToast('金币不足');
    this._openRestaurant(this._atPoi);
    this._autosave();
  }

  /** 餐厅用餐:消耗金币恢复行动力 */
  _restaurantDine() {
    const cost = 15;
    if (this.economy.gold < cost) { this.ui.showToast(`金币不足(用餐需 ${cost})`); return; }
    this.economy.gold -= cost;
    const got = this.economy.addAp(5);
    this._syncUi();
    this.ui.showToast(got > 0 ? `饱餐一顿,恢复 ${got} 点行动力` : '行动力已满');
    this._autosave();
  }

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
  }

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
  }

  /** 酒店仓库:存入金币 */
  _hotelStoreGold(amount) {
    const got = this.economy.storeGold(amount);
    this.ui.showToast(got > 0 ? `存入 ${got} 金币` : '金币不足或金额无效');
    this._syncUi();
    this._openHotel(this._atPoi);
    this._autosave();
  }

  /** 酒店仓库:取出金币 */
  _hotelWithdrawGold(amount) {
    const got = this.economy.withdrawGold(amount);
    this.ui.showToast(got > 0 ? `取出 ${got} 金币` : '仓库金币不足或金额无效');
    this._syncUi();
    this._openHotel(this._atPoi);
    this._autosave();
  }

  /** 酒店仓库:存入道具 */
  _hotelStoreItem(id, qty) {
    const it = ITEMS[id];
    if (!it) return;
    const got = this.economy.storeItem(id, qty);
    this.ui.showToast(got > 0 ? `存入「${it.name}」×${got}` : '背包中没有该物品或数量不足');
    this._syncUi();
    this._openHotel(this._atPoi);
    this._autosave();
  }

  /** 酒店仓库:取出道具 */
  _hotelWithdrawItem(id, qty) {
    const it = ITEMS[id];
    if (!it) return;
    const got = this.economy.withdrawItem(id, qty);
    this.ui.showToast(got > 0 ? `取出「${it.name}」×${got}` : '仓库中没有该物品或背包已满');
    this._syncUi();
    this._openHotel(this._atPoi);
    this._autosave();
  }

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
  }

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
  }

  // ===== 主城设施(酒店 / 酒馆 / 神秘商店 / 银行 / 交易所 / 仓库) =====
  /** 当前所在地点的设施类型(非设施地点返回 null) */
  _facilityAt(index = this.stopIndex) {
    const s = REGIONS[this.regionId]?.stops[index];
    if (!s?.services) return null;
    for (const k of ['hotel', 'tavern', 'mystery', 'bank', 'exchange', 'warehouse']) {
      if (s.services[k]) return k;
    }
    return null;
  }

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
  }

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
      const stock = mysteryStock(seed, tick).map((id) => ({ id, price: mysteryPrice(id, seed, tick) }));
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
  }

  /** 重绘当前设施并自动存档 */
  _facilityRefresh() {
    this._openFacility(this._facilityKind || 'tavern');
    this._autosave();
  }

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
  }

  _tavernMeal() {
    if (this.economy.gold < TAVERN_MEAL_GOLD) { this.ui.showToast(`金币不足(需 ${TAVERN_MEAL_GOLD})`); return; }
    this.economy.gold -= TAVERN_MEAL_GOLD;
    const got = this.economy.addAp(TAVERN_MEAL_AP);
    this.ui.showToast(got > 0 ? `酒足饭饱,恢复 ${got} 点行动力` : '行动力已满,这顿算是白请了');
    this._facilityRefresh();
  }

  _arenaFight(tierId) {
    const tier = ARENA_TIERS.find((t) => t.id === tierId);
    if (!tier) return;
    if (!this.deck) { this.ui.showToast('尚无卡组,先推进剧情'); return; }
    if (this.economy.gold < tier.entry) { this.ui.showToast(`报名费不足(需 ${tier.entry})`); return; }
    this.economy.gold -= tier.entry;
    this._syncUi();
    this._startArenaBattle(Math.max(1, this._chapterNum() + tier.enemyLv), tier);
  }

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
  }

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
  }

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
  }

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
  }

  _bankWithdraw(depositId) {
    const r = this.economy.bankWithdraw(depositId);
    if (!r) { this.ui.showToast('没有这笔存款'); return; }
    this.ui.showToast(r.matured
      ? `取回本息 ${r.principal + r.interest} 金币(利息 ${r.interest})`
      : `未到期,仅取回本金 ${r.principal} 金币(无利息)`);
    this._facilityRefresh();
  }

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
  }

  // ----- 交易所:投资标的 -----
  _investBuy(projectId, units) {
    const seed = this.rng?.seed ?? 1;
    const price = investPrice(projectId, seed, exchangeTick(Date.now()));
    const n = Math.max(1, Math.floor(Number(units) || 0));
    const got = this.economy.investBuy(projectId, n, price);
    if (!got) { this.ui.showToast(`金币不足(需 ${n * price})`); return; }
    this.ui.showToast(`买入 ${got} 份,成本 ${got * price} 金币(单价 ${price})`);
    this._facilityRefresh();
  }

  _investSell(projectId, units) {
    const seed = this.rng?.seed ?? 1;
    const price = investPrice(projectId, seed, exchangeTick(Date.now()));
    const r = this.economy.investSell(projectId, units, price);
    if (!r) { this.ui.showToast('没有可卖出的份额'); return; }
    this.ui.showToast(`卖出 ${r.units} 份,得 ${r.gain} 金币(${r.profit >= 0 ? '盈利' : '亏损'} ${Math.abs(r.profit)})`);
    this._facilityRefresh();
  }

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
  }

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
  }

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
  }

  _escrowWithdrawGold(amount) {
    const got = this.economy.escrowWithdrawGold(Math.floor(Number(amount) || 0));
    this.ui.showToast(got > 0 ? `取回代管金币 ${got}` : '代管金币不足或金额无效');
    this._facilityRefresh();
  }

  _escrowStoreItem(id) {
    if (!ITEMS[id]) return;
    const got = this.economy.escrowStoreItem(id, 1, BELLHOP.escrowKinds);
    this.ui.showToast(got > 0
      ? `服务生代管一「${ITEMS[id].name}」`
      : `背包没有该物品,或代管已达 ${BELLHOP.escrowKinds} 种上限`);
    this._facilityRefresh();
  }

  _escrowWithdrawItem(id) {
    if (!ITEMS[id]) return;
    const got = this.economy.escrowWithdrawItem(id, 1);
    this.ui.showToast(got > 0 ? `取回「${ITEMS[id].name}」` : '代管中没有该物品或背包已满');
    this._facilityRefresh();
  }

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
  }

  _errandClaim(errandId) {
    const e = this.economy.errandClaim(errandId);
    if (!e) { this.ui.showToast('还没送到,再等等'); return; }
    this.ui.showToast(`服务生送回「${ITEMS[e.itemId]?.name || e.itemId}」×${e.qty}`);
    this._facilityRefresh();
  }

  // ===== 商市 =====
  _openMarketPoi(poi) {
    this.ui.renderMarketPoi({
      name: poi.name,
      merchants: MARKET_MERCHANTS,
      economy: this.economy,
    });
    this.transition(GameState.MARKET_POI);
  }

  /** 商市选择某个商人 */
  _marketPoiSelectMerchant(merchantId) {
    if (merchantId === 'weapon') this._openWeaponMerchant();
    else if (merchantId === 'armor') this._openArmorMerchant();
    else if (merchantId === 'medicine') this._openMedicineMerchant();
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  // ===== 宝石商:售卖宝石(随市场浮动定价) =====
  _openGemshop() {
    this.trade?.refresh();
    const gems = Object.values(GEM_ITEMS).map((g) => {
      const price = this.trade ? this.trade.marketAvg(g.id) : g.price;
      return { ...g, price, trend: this.trade ? this.trade.priceTrend(g.id) : 1 };
    });
    this.ui.renderGemshop({ gems, economy: this.economy, name: STALL_CN.gemshop });
    this.transition(GameState.GEMSHOP);
  }

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
  }

  // ===== 精益师:把宝石镶嵌进武器 =====
  _openJeweler() {
    const weapons = [];
    for (const [id, qty] of this.economy.bag.entries()) {
      const def = ITEMS[id];
      if (!def || def.category !== 'weapon') continue;
      weapons.push({ id, qty, def, free: socketsOf(id), gems: def.gems || [] });
    }
    const gems = [];
    for (const [id, qty] of this.economy.bag.entries()) {
      const def = ITEMS[id];
      if (!def || def.category !== 'gem') continue;
      gems.push({ id, qty, def });
    }
    this.ui.renderJeweler({
      weapons, gems, economy: this.economy, cost: SOCKET_GOLD_PER_GEM, name: STALL_CN.jeweler,
    });
    this.transition(GameState.JEWELER);
  }

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
  }

  /** 取下武器最后一颗宝石(可能碎成碎片) */
  _unsocket(weaponId) {
    const r = this.economy.unsocketGem(weaponId);
    if (!r) { this.ui.showToast('该武器没有可取下的宝石'); return; }
    this.ui.showToast(r.shattered ? '宝石取下时碎裂了,只余下一点碎片' : '宝石完好取下,已放回背包');
    this._openJeweler();
    this._syncPlayerStats();
    this._syncUi();
    this._autosave();
  }

  /** 发放一张图纸并直接解锁配方 */
  _grantBlueprint(bpId) {
    if (!bpId || !ITEMS[bpId]) return null;
    if (this.economy.hasBlueprint(bpId)) return null;
    this.economy.blueprints.add(bpId);
    return ITEMS[bpId];
  }

  /** 使用背包中的图纸(解锁配方) */
  _useBlueprint(id) {
    if (!this.economy.unlockBlueprint(id)) { this.ui.showToast('无法使用该图纸'); return; }
    this.ui.showToast(`📜 已解锁配方:${ITEMS[id]?.name || id}`);
    this._syncUi();
    this._autosave();
    if (this.state === GameState.BAG) this._openBag();
  }

  transition(next) {
    this.state = next;
    this.ui.showView(next);
    this.bus.emit('state:change', next);
  }

  _bindUI() {
    this.bus.on('ui:start-chapter', (id) => {
      // id 可能是大章 id(mc1/mc2)或小节 id(chXX);统一解析为起始小节
      const mc = MAJOR_CHAPTERS.find((m) => m.id === id);
      const startId = mc ? mc.chapters[0] : id;
      this.startNewRun(undefined, startId);
    });
    this.bus.on('ui:continue-save', () => {
      const ok = this.loadGameState();
      if (!ok) this.ui.showToast('没有可继续的存档,或存档已损坏');
    });
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
    this.bus.on('ui:auto-battle', () => this._toggleAutoBattle());
    this.bus.on('ui:restart', () => this.startNewRun());
    // 结局节点:玩家阅读完结局散文后,点击「查看结局」播放片尾字幕,结束后自动衔接下一章(不删档)
    this.bus.on('ui:show-ending', () => {
      const node = this.engine?.currentNode;
      const chId = this.engine?.currentChapterId;
      if (node?.kind !== 'ending' || !chId) {
        this.transition(GameState.MAP);
        this._renderMap();
        return;
      }
      // 支线任务结束:不结算大章、不衔接下一章,直接回地图(不影响主线进度)
      // 主线返回点由 engine 的 _gateTarget 保留,玩家回地图后点「剧情」即可继续主线
      if (SIDE_QUEST_CHAPTERS.includes(chId)) {
        this.transition(GameState.MAP);
        this._renderMap();
        this.ui.showToast('✦ 支线任务完成 · 奖励已到手');
        this._autosave();
        return;
      }
      const mc = majorChapterOf(chId);
      const isMajorEnd = !!(mc && mc.lastChapter === chId);
      // 大章末:标记通关 + 发谢仪
      if (isMajorEnd && mc && !this.progress?.cleared?.[mc.id]) {
        this.progress = markChapterCleared(mc.id);
        this.ui.renderChapterSelect(this._chapterEntries(), this._saveInfo());
        const apGot = this.economy ? this.economy.addAp(this.economy.apCap()) : 0;
        this._sendChapterMail(mc.id);
        this.ui.showToast(`✦ ${mc.no} · ${mc.title} 已通关${apGot ? ' · 行动力已回满' : ''} · 驿站寄来通关谢仪`);
        if (mc.id === 'mc1') this._generatePois();
      }
      // 计算下一章 id(CHAPTER_ORDER 中的下一项)
      const idx = CHAPTER_ORDER.indexOf(chId);
      const nextChId = idx >= 0 && idx < CHAPTER_ORDER.length - 1 ? CHAPTER_ORDER[idx + 1] : null;
      // 字幕模式:大章末用 full(完整回顾),小节末用 short(本章回顾)
      const mode = isMajorEnd ? 'full' : 'short';
      const recapKey = isMajorEnd && mc ? mc.id : chId;
      this.transition(GameState.CREDITS);
      // 传入已通关大章集合,使完整字幕只回看已通关部分(避免剧透未通关的后续大章)
      const clearedSnapshot = this.progress?.cleared || {};
      this.ui.showCredits(CHAPTER_RECAPS, mode, recapKey, () => {
        if (nextChId) {
          // 自动衔接下一章:下一章起始节点通常是地点锚点(门控),
          // enterChapter 会触发 narrative:gate 自动切到地区地图;
          // 此时不可再强行切回剧情视图(否则会停留在上一章的结局页,无法继续)
          this.engine.enterChapter(nextChId);
          if (this.state !== GameState.MAP) this.transition(GameState.NARRATIVE);
          this._autosave();
        } else {
          // 已是最后一章:回地图
          this.transition(GameState.MAP);
          this._renderMap();
          this._autosave();
        }
      }, clearedSnapshot);
    });

    // 地区地图
    this.bus.on('ui:map-travel', (i) => this._travelTo(i));
    this.bus.on('ui:map-story', () => this._beginStory());
    // 「休息」操作已下线:行动力改由 剧情推进 / NPC赠予 / 食品 / 酒店休整 恢复
    this.bus.on('ui:map-shop', () => this._openShop());
    this.bus.on('ui:map-job', () => this._openJobs());
    // 主城设施(酒店 / 酒馆 / 神秘商店 / 银行 / 交易所 / 仓库)
    this.bus.on('ui:map-facility', (kind) => this._openFacility(kind));
    this.bus.on('ui:map-bag', () => this._openBag());
    this.bus.on('ui:map-world', () => this._openWorld());
    this.bus.on('ui:back-map', () => this._backToMap());

    // 世界地图 / 旅途 / NPC / 教程
    this.bus.on('ui:world-depart', (id) => this._worldDepart(id));
    this.bus.on('ui:world-shuttle', (id) => this._worldShuttle(id));
    this.bus.on('ui:poi-depart', (id) => this._poiDepart(id));
    this.bus.on('ui:poi-open', () => this._openPoi());
    // POI 服务:餐厅 / 酒店 / 商市
    this.bus.on('ui:restaurant-buy', (id) => this._restaurantBuy(id));
    this.bus.on('ui:restaurant-dine', () => this._restaurantDine());
    this.bus.on('ui:hotel-checkin', (roomId) => this._hotelCheckIn(roomId));
    this.bus.on('ui:hotel-outfit', (outfitId) => this._hotelChangeOutfit(outfitId));
    this.bus.on('ui:hotel-store-gold', (amount) => this._hotelStoreGold(amount));
    this.bus.on('ui:hotel-withdraw-gold', (amount) => this._hotelWithdrawGold(amount));
    this.bus.on('ui:hotel-store-item', (id, qty) => this._hotelStoreItem(id, qty));
    this.bus.on('ui:hotel-withdraw-item', (id, qty) => this._hotelWithdrawItem(id, qty));
    // 酒店服务生:代存与跑腿
    this.bus.on('ui:escrow-store-gold', (amount) => this._escrowStoreGold(amount));
    this.bus.on('ui:escrow-withdraw-gold', (amount) => this._escrowWithdrawGold(amount));
    this.bus.on('ui:escrow-store-item', (id) => this._escrowStoreItem(id));
    this.bus.on('ui:escrow-withdraw-item', (id) => this._escrowWithdrawItem(id));
    this.bus.on('ui:errand-place', (id) => this._errandPlace(id));
    this.bus.on('ui:errand-claim', (id) => this._errandClaim(id));
    // 酒馆 / 神秘商店 / 银行 / 交易所 / 仓库
    this.bus.on('ui:tavern-buy', (id) => this._tavernBuy(id));
    this.bus.on('ui:tavern-meal', () => this._tavernMeal());
    this.bus.on('ui:arena-fight', (tierId) => this._arenaFight(tierId));
    this.bus.on('ui:mystery-buy', (id) => this._mysteryBuy(id));
    this.bus.on('ui:bank-deposit', (p) => this._bankDeposit(p.termId, p.amount));
    this.bus.on('ui:bank-withdraw', (id) => this._bankWithdraw(id));
    this.bus.on('ui:bank-exchange', (p) => this._bankExchange(p.dir, p.tokenId, p.qty));
    this.bus.on('ui:invest-buy', (p) => this._investBuy(p.projectId, p.units));
    this.bus.on('ui:invest-sell', (p) => this._investSell(p.projectId, p.units));
    this.bus.on('ui:warehouse-store', (p) => this._warehouseStore(p.id, p.qty));
    this.bus.on('ui:warehouse-withdraw', (p) => this._warehouseWithdraw(p.id, p.qty));
    this.bus.on('ui:market-poi-merchant', (merchantId) => this._marketPoiSelectMerchant(merchantId));
    this.bus.on('ui:merchant-buy', (id) => this._merchantBuy(id));
    this.bus.on('ui:npc-talk', (id) => this._talkNpc(id));
    this.bus.on('ui:npc-topic', (id) => this._npcChooseTopic(id));
    this.bus.on('ui:npc-quest', ({ sideChapter, doneFlag }) => {
      if (!sideChapter) return;
      // 关闭 NPC 对话,进入支线章节;支线不影响主线进度
      // (不调 markChapterCleared、不发谢仪),完成后由支线 effects.flags
      // 设置 doneFlag,使下次再与该 NPC 对话时任务按钮变灰。
      this._npcTalk = null;
      this.ui.closeNpcDialog();
      this.engine.enterChapter(sideChapter);
      this.transition(GameState.NARRATIVE);
      this._autosave();
    });
    this.bus.on('ui:npc-close', () => this._closeNpcDialog());
    this.bus.on('ui:map-chest', () => this._openChest());
    this.bus.on('ui:chest-submit', ({ id, code }) => this._submitChestCode(id, code));
    this.bus.on('ui:chest-close', () => this.ui.closeChest());
    this.bus.on('ui:map-intel', () => this._openIntel());
    this.bus.on('ui:intel-close', () => this._closeIntel());
    this.bus.on('ui:tutorial-close', () => this._closeTutorial());
    // 邮箱 / 兑换码(右下角圆形图标入口)
    this.bus.on('ui:open-mailbox', () => this._openMailbox());
    this.bus.on('ui:mail-claim', (id) => this._claimMail(id));
    this.bus.on('ui:mail-close', () => this.ui.closeMailbox());
    this.bus.on('ui:open-redeem', () => this._openRedeem());
    this.bus.on('ui:redeem-submit', (code) => this._redeemCode(code));
    this.bus.on('ui:redeem-close', () => this.ui.closeRedeem());
    // 回忆(剧情回顾) / 衣橱(更换时装)(左下角圆形按钮入口)
    this.bus.on('ui:open-memorial', () => this._openMemorial());
    this.bus.on('ui:open-wardrobe', () => this._openWardrobe());
    this.bus.on('ui:cosmetic-set', ({ slot, id }) => this._setCosmetic(slot, id));
    // 设置(音量 / 注销)(左下角圆形按钮入口)
    this.bus.on('ui:open-settings', () => this.ui.openSettings(this.audio.volume));
    this.bus.on('ui:set-volume', (v) => {
      this.audio.setVolume(v);
      this.ui.setMusicState(this.audio.playing);
    });
    this.bus.on('ui:logout-confirm', () => this._logout());
    this.bus.on('travel:progress', (snap) => this.ui.renderTravel(snap));
    this.bus.on('travel:start', (snap) => { this.ui.resetTravelTips(); this.ui.renderTravel(snap); });
    this.bus.on('travel:event', (payload) => this._onTravelEvent(payload));
    this.bus.on('travel:arrive', () => this._onTravelArrive());

    // 商店 / 市场 / 背包 / 打工
    this.bus.on('ui:shop-buy', (id) => this._buy(id));
    this.bus.on('ui:shop-sell', (id) => this._sell(id));
    this.bus.on('ui:shop-buy-pet', (id) => this._shopBuyPet(id));
    this.bus.on('ui:shop-sell-pet', (id) => this._shopSellPet(id));
    this.bus.on('ui:map-market', () => this._openMarket());
    this.bus.on('ui:map-venue', () => this._openVenue());
    this.bus.on('ui:market-buy', (id) => this._marketBuy(id));
    this.bus.on('ui:market-sell', (id) => this._marketSell(id));
    this.bus.on('ui:venue-buy', (id) => this._venueBuy(id));
    this.bus.on('ui:bag-use', (id) => this._useItem(id));
    this.bus.on('ui:bag-use-all', (id) => this._useItemAll(id));
    // 角色弹窗
    this.bus.on('ui:open-character', () => this._openCharacterSheet());
    this.bus.on('ui:char-close', () => this.ui.closeCharacterSheet());
    this.bus.on('ui:char-equip', (id) => this._charEquip(id));
    this.bus.on('ui:char-unequip', (slot) => this._charUnequip(slot));
    this.bus.on('ui:char-career', (id) => this._charSwitchCareer(id));
    this.bus.on('ui:char-rename', (name) => this._charRename(name));
    this.bus.on('ui:char-look', (p) => this._charLook(p));
    this.bus.on('ui:char-pet', (id) => this._charPet(id));
    this.bus.on('ui:market-buy-pet', (id) => this._marketPetBuy(id));
    this.bus.on('ui:market-sell-pet', (id) => this._marketSellPet(id));
    this.bus.on('ui:bag-equip', (id) => this._equipItem(id));
    this.bus.on('ui:bag-unequip', (slot) => this._unequipItem(slot));
    this.bus.on('ui:bag-drop', (id) => this._dropItem(id));
    this.bus.on('ui:job-challenge', (p) => this._challengeJob(p.jobId, p.tierIndex));
    this.bus.on('ui:job-finish', (r) => this._finishJob(r));
    this.bus.on('ui:minigame-close', () => this._closeMinigame());

    // 铁匠 / 宝石商 / 精益师 / 玩家货架 / 背包扩容
    this.bus.on('ui:map-blacksmith', () => this._openBlacksmith());
    this.bus.on('ui:map-gemshop', () => this._openGemshop());
    this.bus.on('ui:map-jeweler', () => this._openJeweler());
    this.bus.on('ui:forge', (id) => this._forge(id));
    this.bus.on('ui:gemshop-buy', (id) => this._gemshopBuy(id));
    this.bus.on('ui:socket', (p) => this._socket(p.weaponId, p.gemId));
    this.bus.on('ui:unsocket', (id) => this._unsocket(id));
    this.bus.on('ui:market-buy-gem', (id) => this._marketBuyGem(id));
    this.bus.on('ui:market-buy-ware', (k) => this._marketBuyWare(k));
    this.bus.on('ui:market-list', (p) => this._listItem(p.itemId, p.price));
    this.bus.on('ui:market-cancel', (id) => this._cancelListing(id));
    this.bus.on('ui:market-expand-shelf', () => this._expandShelf());
    this.bus.on('ui:bag-expand', () => this._expandBag());
    this.bus.on('ui:bag-use-blueprint', (id) => this._useBlueprint(id));

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
      // 注:ending 节点不再自动跳转 VICTORY,而是先在叙事视图完整展示结局散文,
      //     由「查看结局」按钮(ui:show-ending)触发结局结算画面。
      // 剧情推进后自动存档
      this._autosave();
    });

    // 职业初始分配/切换后:重建牌组、同步玩家数值
    this.bus.on('narrative:career-chosen', () => {
      const c = this.engine?.career;
      if (!c) return;
      this.career = c;
      this.economy?.setCareer(c.id); // 职业等级互不相通:换职业即换档
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
