/**
 * UI — DOM 渲染层(视觉与交互)。
 * 订阅 battle:refresh / battle:fx / narrative:refresh 事件渲染快照,按钮事件转发给 bus。
 * 不持有战斗/剧情状态,仅做视图;逻辑集中在 Game/Battle/NarrativeEngine。
 *
 * 交互增强:
 *   · 剧情文本逐段渐显,点击可跳过,读毕再浮现选项
 *   · 键盘操作:数字键选选项 / 空格·回车推进 / 点击文本区域推进
 *   · 战斗:血条动画、伤害飘字、受击抖动、手牌类型描边
 *   · 章节进度条、职业解锁提示、结局面板
 */

import { GameState } from '../core/game.js?v=20261007g';
import { CAREERS, CAREER_MAP } from '../narrative/careers.js?v=20261007g';
import { ITEMS, ITEM_CATEGORY_CN, sellPrice, isTradeable, isSellLocked, socketsOf } from '../data/items.js?v=20261007g';
import { gradeOf } from '../data/grade.js?v=20261007g';
import { careerTitleOf } from '../data/careers_rank.js?v=20261007g';
import { GEM_EFFECT, GEM_STAT_CN } from '../data/gems.js?v=20261007g';
import { ABOUT_DOCS, ABOUT_UPDATED } from '../data/about.js?v=20261007g';
import { cardMpCost } from '../data/data.js?v=20261007g';
import { ENDINGS } from '../narrative/engine.js?v=20261007g';
import { CHAPTER_ORDER, chapterProgressIndex } from '../narrative/chapters/index.js?v=20261007g';
import { SceneView, paintCharacter } from './scene.js?v=20261007g';
import { ARMOR_SLOTS, ARMOR_SLOT_CN } from '../data/armor.js?v=20261007g';
import { BODY_STYLES, SKIN_TONES, BODY_MAP, SKIN_MAP, lookLabel } from '../data/looks.js?v=20261007g';
import { Minigame } from '../minigame/minigame.js?v=20261007g';
import { MODE_LABELS } from '../data/jobs.js?v=20261007g';
import { TERRAIN_CN } from '../data/world.js?v=20261007g';
import { TRAVEL_TIPS, TIP_INTERVAL_SEC } from '../data/tips.js?v=20261007g';

const STATUS_LABELS = {
  vulnerable: '易伤',
  weak: '虚弱',
  frail: '脆弱',
  strength: '力量',
};

const STAT_LABELS = {
  courage: '勇气',
  mercy: '慈悲',
  reason: '理智',
  wild: '野性',
};

const TYPE_LABELS = {
  attack: '攻击',
  skill: '技能',
  power: '能力',
};

/** 服饰四部位的显示名 */
const OUTFIT_CN = { hat: '帽子', top: '上衣', bottom: '裤子', shoes: '鞋子' };
/** 背包分类栏(武器 / 防具 / 服饰 各自独立) */
const BAG_TABS = [
  { key: 'all',      label: '全部', match: () => true },
  { key: 'weapon',   label: '武器', match: (it) => it.category === 'weapon' },
  { key: 'armor',    label: '防具', match: (it) => it.category === 'armor' },
  { key: 'outfit',   label: '服饰', match: (it) => it.category === 'outfit' },
  { key: 'vehicle',  label: '载具', match: (it) => it.category === 'vehicle' },
  { key: 'potion',   label: '药品', match: (it) => it.category === 'potion' || it.category === 'food' },
  { key: 'material', label: '材料', match: (it) => it.category === 'material' || it.category === 'gem' || it.category === 'blueprint' },
  { key: 'misc',     label: '杂物', match: (it) => it.category === 'misc' || it.category === 'token' || it.category === 'relic' },
];
/** 7 种形象的表情符号(仅用于选择面板) */
const BODY_EMOJI = { cute: '🧒', dopey: '😴', genki: '😆', quiet: '😌', roguish: '😜', brave: '😤', gentle: '🥰' };

/** 逐段渐显节奏:段间基础间隔(ms) + 按段长加权 */
const PARA_BASE_MS = 380;
const PARA_PER_CHAR_MS = 18;
const PARA_MAX_MS = 1600;
const PARA_FADE_MS = 520;

export class UI {
  constructor(rootEl, bus) {
    this.root = rootEl;
    this.bus = bus;
    this.battle = null;
    this.engine = null;
    this.economy = null;          // 由 Game 注入,用于渲染金币/背包/战斗药品
    this._paraTimer = null;       // 逐段渐显计时器
    this._typing = false;         // 是否正在逐段呈现
    this._fullText = '';          // 当前节点全文
    this._paraEls = [];           // 段落 DOM 列表
    this._paraIndex = 0;          // 下一段待显示索引
    this._choicesReady = false;   // 选项是否已浮现
    this._howtoOpen = false;      // 游戏说明弹窗是否打开
    this._npcOpen = false;        // NPC 对话弹窗是否打开
    this._tutorialOpen = false;   // 新手引导是否打开
    this._chestOpen = false;      // 宝箱弹窗是否打开
    this._intelOpen = false;      // 情报面板是否打开
    this._mailOpen = false;       // 邮箱弹窗是否打开
    this._redeemOpen = false;     // 兑换码弹窗是否打开
    this._memorialOpen = false;   // 回忆(剧情回顾)弹窗是否打开
    this._wardrobeOpen = false;   // 衣橱(更换时装)弹窗是否打开
    this._wardrobeData = null;    // 衣橱弹窗数据(含外观与各槽可选列表)
    this._aboutOpen = false;      // 关于 · 条款弹窗是否打开
    this._aboutId = null;         // 当前阅读的文档 id
    this._chestId = null;         // 当前宝箱 id
    this._mgOpen = false;         // 打工小游戏是否打开
    this._mg = null;              // 当前小游戏实例
    this._mgJob = null;           // 当前打工项
    this._mgTier = null;          // 当前难度档
    this._mgTierIndex = -1;       // 当前难度档下标
    this._charOpen = false;       // 角色弹窗是否打开
    this._csData = null;          // 角色弹窗数据
    this._csMode = null;          // 'look' | 'rename' | null
    this._csPick = null;          // 当前选取的部位 { kind, slot }
    this._csSelBody = null;       // 形象选择暂存
    this._csSelSkin = null;       // 肤色选择暂存
    this._csCtx = null;           // 角色弹窗画布上下文
    this._worldSelected = null;   // 世界地图上选中的地区 id
    this._worldPoiSelected = null; // 世界地图上选中的 POI id
    this._worldState = null;      // 最近一次世界地图数据
    this._worldZoom = 1;          // 世界地图缩放倍率(0.6~3)
    this._lastEnemyHp = null;    // 用于计算伤害飘字
    this._lastPlayerHp = null;
    this._cache();
    // 像素图侧栏(人物 / 环境),独立于剧情文字窗口
    this.scene = new SceneView({
      charCanvas: this.el.sceneCharCanvas,
      envCanvas: this.el.sceneEnvCanvas,
      charName: this.el.sceneCharName,
      charOutfit: this.el.sceneCharOutfit,
      charStatus: this.el.sceneCharStatus,
      envName: this.el.sceneEnvName,
      envDesc: this.el.sceneEnvDesc,
      mapCanvas: this.el.mapCharCanvas,
      mapCharName: this.el.mapCharName,
    });
    if (this.el.csCanvas) this._csCtx = this.el.csCanvas.getContext('2d');
    this._bindStaticButtons();
    this._bindBus();
    this._bindKeyboard();
    this._spawnEmbers();
  }

  _cache() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      seed: $('seed-display'),
      turn: $('turn-display'),
      gold: $('gold-display'),
      ap: $('ap-display'),
      chapterTitle: $('chapter-title'),
      progressFill: $('progress-fill'),
      views: {
        menu: $('view-menu'),
        career: $('view-career'),
        narrative: $('view-narrative'),
        map: $('view-map'),
        world: $('view-world'),
        travel: $('view-travel'),
        shop: $('view-shop'),
        market: $('view-market'),
        bag: $('view-bag'),
        job: $('view-job'),
        battle: $('view-battle'),
        reward: $('view-reward'),
        result: $('view-result'),
        credits: $('view-credits'),
        restaurant: $('view-restaurant'),
        hotel: $('view-hotel'),
        market_poi: $('view-market-poi'),
        merchant: $('view-merchant'),
        blacksmith: $('view-blacksmith'),
        gemshop: $('view-gemshop'),
        jeweler: $('view-jeweler'),
      },
      careerGrid: $('career-grid'),
      chapterSelect: $('chapter-select'),
      btnMusic: $('btn-music'),
      howto: $('howto'),
      narrativeStats: $('narrative-stats'),
      narrativeVitals: $('narrative-vitals'),
      narrativeText: $('narrative-text'),
      narrativeChoices: $('narrative-choices'),
      narrativeHint: $('narrative-hint'),
      sceneCharCanvas: $('scene-char-canvas'),
      sceneEnvCanvas: $('scene-env-canvas'),
      sceneCharName: $('scene-char-name'),
      sceneCharOutfit: $('scene-char-outfit'),
      sceneCharStatus: $('scene-char-status'),
      sceneEnvName: $('scene-env-name'),
      sceneEnvDesc: $('scene-env-desc'),
      // 地区地图 / 商店 / 背包 / 打工
      mapRegionName: $('map-region-name'),
      mapRes: $('map-res'),
      mapHint: $('map-hint'),
      mapStops: $('map-stops'),
      mapServices: $('map-services'),
      btnMapStory: $('btn-map-story'),
      btnMapBag: $('btn-map-bag'),
      btnMapWorld: $('btn-map-world'),
      mapNpcs: $('map-npcs'),
      mapNpcsTitle: $('map-npcs-title'),
      mapCharCanvas: $('map-char-canvas'),
      mapCharName: $('map-char-name'),
      // 世界地图
      worldMap: $('world-map'),
      worldCanvas: $('world-canvas'),
      worldPanel: $('world-panel'),
      worldList: $('world-list'),
      worldNote: $('world-note'),
      worldStoryBanner: $('world-story-banner'),
      btnWorldBack: $('btn-world-back'),
      // 旅途
      travelCard: $('travel-card'),
      travelEyebrow: $('travel-eyebrow'),
      travelFrom: $('travel-from'),
      travelTo: $('travel-to'),
      travelBar: $('travel-bar'),
      travelRemain: $('travel-remain'),
      travelNote: $('travel-note'),
      travelTip: $('travel-tip'),
      travelLog: $('travel-log'),
      // NPC 对话 / 教程
      npcDialog: $('npc-dialog'),
      npcName: $('npc-name'),
      npcTag: $('npc-tag'),
      npcTitle: $('npc-title'),
      npcLines: $('npc-lines'),
      npcTopics: $('npc-topics'),
      npcHint: $('npc-hint'),
      btnNpcClose: $('btn-npc-close'),
      tutorial: $('tutorial'),
      btnTutorialClose: $('btn-tutorial-close'),
      // 宝箱 / 情报
      chestDialog: $('chest-dialog'),
      chestTitle: $('chest-title'),
      chestName: $('chest-name'),
      chestHint: $('chest-hint'),
      chestInput: $('chest-input'),
      btnChestOpen: $('btn-chest-open'),
      storySummary: $('story-summary'),
      summaryChapter: $('summary-chapter'),
      summaryText: $('summary-text'),
      summaryRewards: $('summary-rewards'),
      btnSummaryConfirm: $('btn-summary-confirm'),
      intel: $('intel'),
      intelList: $('intel-list'),
      intelNote: $('intel-note'),
      btnMapIntel: $('btn-map-intel'),
      // 右下角功能坞:邮箱 / 兑换码
      dockMailBadge: $('dock-mail-badge'),
      mailbox: $('mailbox'),
      mailNote: $('mail-note'),
      mailList: $('mail-list'),
      // 左下角功能坞:回忆(剧情回顾) / 衣橱(更换时装) / 设置(音量与注销)
      memorial: $('memorial'),
      memorialNote: $('memorial-note'),
      memorialList: $('memorial-list'),
      wardrobe: $('wardrobe'),
      wardrobeCanvas: $('wardrobe-canvas'),
      wardrobeLook: $('wardrobe-look'),
      wardrobeSlots: $('wardrobe-slots'),
      settings: $('settings'),
      settingsVolume: $('settings-volume'),
      settingsVolumeVal: $('settings-volume-val'),
      settingsConfirm: $('settings-confirm'),
      settingsLogoutActions: $('settings-logout-actions'),
      redeem: $('redeem'),
      redeemInput: $('redeem-input'),
      redeemMsg: $('redeem-msg'),
      btnRedeemConfirm: $('btn-redeem-confirm'),
      about: $('about'),
      aboutNav: $('about-nav'),
      aboutDoc: $('about-doc'),
      aboutDocTitle: $('about-doc-title'),
      aboutUpdated: $('about-updated'),
      // 打工小游戏
      minigame: $('minigame'),
      mgTitle: $('mg-title'),
      mgSub: $('mg-sub'),
      mgGoal: $('mg-goal'),
      mgTime: $('mg-time'),
      mgLives: $('mg-lives'),
      mgCanvas: $('mg-canvas'),
      mgOverlay: $('mg-overlay'),
      btnMgStart: $('btn-mg-start'),
      btnMgRetry: $('btn-mg-retry'),
      shopRes: $('shop-res'),
      shopList: $('shop-list'),
      shopCats: $('shop-cats'),
      shopNote: $('shop-note'),
      shopSearch: $('shop-search'),
      btnShopBack: $('btn-shop-back'),
      marketTitle: $('market-title'),
      marketNote: $('market-note'),
      marketRes: $('market-res'),
      marketList: $('market-list'),
      marketCats: $('market-cats'),
      marketSearch: $('market-search'),
      btnMarketBack: $('btn-market-back'),
      bagRes: $('bag-res'),
      bagCap: $('bag-cap'),
      bagEquipped: $('bag-equipped'),
      bagList: $('bag-list'),
      bagSearch: $('bag-search'),
      bagFilters: $('bag-filters'),
      btnBagBack: $('btn-bag-back'),
      btnBagExpand: $('btn-bag-expand'),
      jobRes: $('job-res'),
      jobList: $('job-list'),
      btnJobBack: $('btn-job-back'),
      // POI:餐厅 / 酒店 / 商市 / 商人
      restaurantTitle: $('restaurant-title'),
      restaurantRes: $('restaurant-res'),
      restaurantNote: $('restaurant-note'),
      restaurantList: $('restaurant-list'),
      btnRestaurantDine: $('btn-restaurant-dine'),
      btnRestaurantBack: $('btn-restaurant-back'),
      hotelTitle: $('hotel-title'),
      hotelRes: $('hotel-res'),
      hotelNote: $('hotel-note'),
      hotelRooms: $('hotel-rooms'),
      hotelOutfits: $('hotel-outfits'),
      hotelRecaps: $('hotel-recaps'),
      hotelStorage: $('hotel-storage'),
      btnHotelBack: $('btn-hotel-back'),
      marketpoiTitle: $('marketpoi-title'),
      marketpoiRes: $('marketpoi-res'),
      marketpoiNote: $('marketpoi-note'),
      marketpoiList: $('marketpoi-list'),
      btnMarketpoiBack: $('btn-marketpoi-back'),
      merchantTitle: $('merchant-title'),
      merchantRes: $('merchant-res'),
      merchantNote: $('merchant-note'),
      merchantList: $('merchant-list'),
      merchantSearch: $('merchant-search'),
      btnMerchantBack: $('btn-merchant-back'),
      // 铁匠铺 / 宝石商 / 精益师
      blacksmithTitle: $('blacksmith-title'),
      blacksmithRes: $('blacksmith-res'),
      blacksmithNote: $('blacksmith-note'),
      blacksmithList: $('blacksmith-list'),
      btnBlacksmithBack: $('btn-blacksmith-back'),
      gemshopTitle: $('gemshop-title'),
      gemshopRes: $('gemshop-res'),
      gemshopNote: $('gemshop-note'),
      gemshopList: $('gemshop-list'),
      btnGemshopBack: $('btn-gemshop-back'),
      jewelerTitle: $('jeweler-title'),
      jewelerRes: $('jeweler-res'),
      jewelerNote: $('jeweler-note'),
      jewelerWeapons: $('jeweler-weapons'),
      jewelerGems: $('jeweler-gems'),
      btnJewelerBack: $('btn-jeweler-back'),
      battleItems: $('battle-items'),
      rewardSub: $('reward-sub'),
      enemyZone: $('enemy-zone'),
      playerZone: $('player-zone'),
      battleLog: $('battle-log'),
      hand: $('hand'),
      drawCount: $('draw-count'),
      discardCount: $('discard-count'),
      energy: $('energy-display'),
      btnEndTurn: $('btn-end-turn'),
      btnAutoBattle: $('btn-auto-battle'),
      rewardGrid: $('reward-grid'),
      btnSkipReward: $('btn-skip-reward'),
      resultEyebrow: $('result-eyebrow'),
      resultTitle: $('result-title'),
      resultDesc: $('result-desc'),
      resultStats: $('result-stats'),
      // 任务窗格 / 角色弹窗
      mapTasks: $('map-tasks'),
      charsheet: $('character-sheet'),
      csCanvas: $('cs-canvas'),
      csName: $('cs-name'),
      csLook: $('cs-look'),
      csCareer: $('cs-career'),
      csOutfits: $('cs-outfits'),
      csLookpanel: $('cs-lookpanel'),
      csPets: $('cs-pets'),
      csPicker: $('cs-picker'),
      csSlots: {
        head: document.querySelector('.cs-area-head'),
        body: document.querySelector('.cs-area-body'),
        hands: document.querySelector('.cs-area-hands'),
        legs: document.querySelector('.cs-area-legs'),
        feet: document.querySelector('.cs-area-feet'),
        ring: document.querySelector('.cs-area-ring'),
        earring: document.querySelector('.cs-area-earring'),
      },
    };
  }

  /**
   * 绑定静态按钮。
   * 所有查询均做空值保护:任一元素缺失也不会中断绑定流程,
   * 避免因单个节点缺失导致整个应用初始化失败、所有按钮失效。
   */
  _bindStaticButtons() {
    const on = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    };
    on('btn-seed-run', 'click', () => this.bus.emit('ui:seed-run'));
    on('btn-restart', 'click', () => this.bus.emit('ui:restart'));
    on('btn-music', 'click', () => this.bus.emit('ui:toggle-music'));
    // 游戏说明:任意 [data-howto] 按钮打开,[data-howto-close] 关闭
    document.querySelectorAll('[data-howto]').forEach((b) => {
      b.addEventListener('click', () => this.openHowto());
    });
    document.querySelectorAll('[data-howto-close]').forEach((b) => {
      b.addEventListener('click', () => this.closeHowto());
    });
    // NPC 对话 / 新手引导:关闭按钮与遮罩
    document.querySelectorAll('[data-npc-close]').forEach((b) => {
      b.addEventListener('click', () => this.bus.emit('ui:npc-close'));
    });
    document.querySelectorAll('[data-tutorial-close]').forEach((b) => {
      b.addEventListener('click', () => this.bus.emit('ui:tutorial-close'));
    });
    document.querySelectorAll('[data-chest-close]').forEach((b) => {
      b.addEventListener('click', () => this.bus.emit('ui:chest-close'));
    });
    document.querySelectorAll('[data-intel-close]').forEach((b) => {
      b.addEventListener('click', () => this.bus.emit('ui:intel-close'));
    });
    // 右下角功能坞:邮箱 / 兑换码 / 关于
    on('btn-mailbox', 'click', () => this.bus.emit('ui:open-mailbox'));
    on('btn-redeem', 'click', () => this.bus.emit('ui:open-redeem'));
    on('btn-about', 'click', () => this.openAbout());
    // 左下角功能坞:回忆(剧情回顾) / 衣橱(更换时装) / 设置(音量与注销)
    on('btn-memorial', 'click', () => this.bus.emit('ui:open-memorial'));
    on('btn-wardrobe', 'click', () => this.bus.emit('ui:open-wardrobe'));
    on('btn-settings', 'click', () => this.bus.emit('ui:open-settings'));
    document.querySelectorAll('[data-memorial-close]').forEach((b) => {
      b.addEventListener('click', () => this.closeMemorial());
    });
    document.querySelectorAll('[data-wardrobe-close]').forEach((b) => {
      b.addEventListener('click', () => this.closeWardrobe());
    });
    // 设置:音量滑块 / 注销二次确认
    document.querySelectorAll('[data-settings-close]').forEach((b) => {
      b.addEventListener('click', () => this.closeSettings());
    });
    if (this.el.settingsVolume) {
      this.el.settingsVolume.addEventListener('input', () => {
        const pct = Number(this.el.settingsVolume.value) || 0;
        this._setVolumeLabel(pct);
        this.bus.emit('ui:set-volume', pct / 100);
      });
    }
    on('btn-logout', 'click', () => this._showLogoutConfirm(true));
    on('btn-logout-cancel', 'click', () => this._showLogoutConfirm(false));
    on('btn-logout-confirm', 'click', () => this.bus.emit('ui:logout-confirm'));
    on('btn-redeem-confirm', 'click', () => this._submitRedeem());
    // 允许外部(如年龄门)请求打开指定文档
    document.addEventListener('about:open', (e) => this.openAbout(e.detail && e.detail.id));
    document.querySelectorAll('[data-about-open]').forEach((b) => {
      b.addEventListener('click', () => this.openAbout());
    });
    document.querySelectorAll('[data-about-close]').forEach((b) => {
      b.addEventListener('click', () => this.closeAbout());
    });
    document.querySelectorAll('[data-mail-close]').forEach((b) => {
      b.addEventListener('click', () => this.bus.emit('ui:mail-close'));
    });
    document.querySelectorAll('[data-redeem-close]').forEach((b) => {
      b.addEventListener('click', () => this.bus.emit('ui:redeem-close'));
    });
    if (this.el.redeemInput) {
      this.el.redeemInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); this._submitRedeem(); }
        else if (e.key === 'Escape') { e.preventDefault(); this.bus.emit('ui:redeem-close'); }
      });
    }
    if (this.el.btnChestOpen) this.el.btnChestOpen.addEventListener('click', () => this._submitChest());
    // 记忆之书 · 剧情简介弹窗
    document.querySelectorAll('[data-summary-close]').forEach((b) => {
      b.addEventListener('click', () => this._closeStorySummary());
    });
    if (this.el.btnSummaryConfirm) this.el.btnSummaryConfirm.addEventListener('click', () => this._confirmStorySummary());
    if (this.el.chestInput) {
      this.el.chestInput.addEventListener('input', () => {
        this.el.chestInput.value = this.el.chestInput.value.replace(/\D/g, '').slice(0, 3);
      });
      this.el.chestInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); this._submitChest(); }
        else if (e.key === 'Escape') { e.preventDefault(); this.bus.emit('ui:chest-close'); }
      });
    }
    if (this.el.btnMapIntel) this.el.btnMapIntel.addEventListener('click', () => this.bus.emit('ui:map-intel'));
    // 打工小游戏:开始 / 重来 / 退出
    document.querySelectorAll('[data-mg-close]').forEach((b) => {
      b.addEventListener('click', () => this.bus.emit('ui:minigame-close'));
    });
    if (this.el.btnMgStart) this.el.btnMgStart.addEventListener('click', () => this._startMinigame());
    if (this.el.btnMgRetry) this.el.btnMgRetry.addEventListener('click', () => this._startMinigame());
    if (this.el.btnEndTurn) this.el.btnEndTurn.addEventListener('click', () => this.bus.emit('ui:end-turn'));
    if (this.el.btnAutoBattle) this.el.btnAutoBattle.addEventListener('click', () => this.bus.emit('ui:auto-battle'));
    if (this.el.btnSkipReward) this.el.btnSkipReward.addEventListener('click', () => this.bus.emit('ui:skip-reward'));
    // 地图 / 商店 / 背包 / 打工
    if (this.el.btnMapStory) this.el.btnMapStory.addEventListener('click', () => this.bus.emit('ui:map-story'));
    if (this.el.btnMapBag) this.el.btnMapBag.addEventListener('click', () => this.bus.emit('ui:map-bag'));
    if (this.el.btnMapWorld) this.el.btnMapWorld.addEventListener('click', () => this.bus.emit('ui:map-world'));
    if (this.el.btnWorldBack) this.el.btnWorldBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    // 世界地图缩放:按钮 + Ctrl/⌘ + 滚轮(不劫持普通滚动)
    const zoomBy = (mul) => this._setWorldZoom(this._worldZoom * mul);
    document.getElementById('wm-zoom-in')?.addEventListener('click', () => zoomBy(1.25));
    document.getElementById('wm-zoom-out')?.addEventListener('click', () => zoomBy(1 / 1.25));
    document.getElementById('wm-zoom-reset')?.addEventListener('click', () => this._setWorldZoom(1));
    if (this.el.worldMap) {
      this.el.worldMap.addEventListener('wheel', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
      }, { passive: false });
    }
    if (this.el.btnNpcClose) this.el.btnNpcClose.addEventListener('click', () => this.bus.emit('ui:npc-close'));
    if (this.el.btnTutorialClose) this.el.btnTutorialClose.addEventListener('click', () => this.bus.emit('ui:tutorial-close'));
    if (this.el.btnShopBack) this.el.btnShopBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    if (this.el.btnMarketBack) this.el.btnMarketBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    if (this.el.btnBagBack) this.el.btnBagBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    if (this.el.btnJobBack) this.el.btnJobBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    // POI:餐厅 / 酒店 / 商市 / 商人
    if (this.el.btnRestaurantDine) this.el.btnRestaurantDine.addEventListener('click', () => this.bus.emit('ui:restaurant-dine'));
    if (this.el.btnRestaurantBack) this.el.btnRestaurantBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    if (this.el.btnHotelBack) this.el.btnHotelBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    if (this.el.btnMarketpoiBack) this.el.btnMarketpoiBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    if (this.el.btnMerchantBack) this.el.btnMerchantBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    // 铁匠铺 / 宝石商 / 精益师
    if (this.el.btnBlacksmithBack) this.el.btnBlacksmithBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    if (this.el.btnGemshopBack) this.el.btnGemshopBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    if (this.el.btnJewelerBack) this.el.btnJewelerBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    if (this.el.btnBagExpand) this.el.btnBagExpand.addEventListener('click', () => this.bus.emit('ui:bag-expand'));
    // 搜索框:输入即按当前数据重绘(商店 / 市场 / 商人 / 背包)
    const bindSearch = (el, field, redraw) => {
      if (!el) return;
      el.addEventListener('input', () => { this[field] = el.value || ''; redraw(); });
    };
    bindSearch(this.el.shopSearch, '_shopQuery', () => { if (this._shopData) this.renderShop(this._shopData); });
    bindSearch(this.el.marketSearch, '_marketQuery', () => { if (this._marketData) this.renderMarket(this._marketData); });
    bindSearch(this.el.merchantSearch, '_merchantQuery', () => { if (this._merchantData) this.renderMerchant(this._merchantData); });
    bindSearch(this.el.bagSearch, '_bagQuery', () => { if (this._bagData) this.renderBag(this._bagData); });
    // 角色弹窗:点击角色形象打开,[data-char-close] 关闭
    document.querySelectorAll('[data-char-open]').forEach((b) => {
      b.addEventListener('click', () => this.bus.emit('ui:open-character'));
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.bus.emit('ui:open-character'); }
      });
    });
    document.querySelectorAll('[data-char-close]').forEach((b) => {
      b.addEventListener('click', () => this.bus.emit('ui:char-close'));
    });
    // 点击剧情文本区域:正在打字则跳过,否则推进
    if (this.el.narrativeText) this.el.narrativeText.addEventListener('click', () => this._onTextAreaClick());
  }

  _bindBus() {
    this.bus.on('battle:refresh', (snap) => this._renderBattle(snap));
    this.bus.on('battle:log', (msg) => this._renderBattleLog(msg));
    this.bus.on('battle:fx', (fx) => this._playBattleFx(fx));
    this.bus.on('narrative:refresh', (snap) => this._renderNarrative(snap));
    this.bus.on('narrative:career-unlocked', (ids) => this._showCareerUnlockToast(ids));
    this.bus.on('narrative:career-chosen', () => {
      if (this.engine) this._renderNarrative(this.engine.snapshot());
    });
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // 关于弹窗可先于年龄门打开,因此它的 Esc 处理放在门禁检查之前
      if (this._aboutOpen) {
        if (e.key === 'Escape') { e.preventDefault(); this.closeAbout(); }
        return;
      }
      // 年龄 / 内容警告门未通过时,游戏不响应任何按键
      if (document.body.classList.contains('is-gated')) return;
      // 忽略输入框内按键
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // 弹窗打开时,仅响应 Esc 关闭,屏蔽其余游戏操作
      if (this._howtoOpen) {
        if (e.key === 'Escape') { e.preventDefault(); this.closeHowto(); }
        return;
      }
      if (this._tutorialOpen) {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.bus.emit('ui:tutorial-close'); }
        return;
      }
      if (this._npcOpen) {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.bus.emit('ui:npc-close'); }
        return;
      }
      if (this._chestOpen || this._intelOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.bus.emit(this._chestOpen ? 'ui:chest-close' : 'ui:intel-close');
        }
        return;
      }
      if (this._mailOpen) {
        if (e.key === 'Escape') { e.preventDefault(); this.bus.emit('ui:mail-close'); }
        return;
      }
      if (this._redeemOpen) {
        if (e.key === 'Escape') { e.preventDefault(); this.bus.emit('ui:redeem-close'); }
        return;
      }
      if (this._memorialOpen) {
        if (e.key === 'Escape') { e.preventDefault(); this.closeMemorial(); }
        return;
      }
      if (this._wardrobeOpen) {
        if (e.key === 'Escape') { e.preventDefault(); this.closeWardrobe(); }
        return;
      }
      if (this._settingsOpen) {
        if (e.key === 'Escape') { e.preventDefault(); this.closeSettings(); }
        return;
      }
      // 小游戏自行处理方向键 / 跳跃键,这里仅响应 Esc 退出
      if (this._mgOpen) {
        if (e.key === 'Escape') { e.preventDefault(); this.bus.emit('ui:minigame-close'); }
        return;
      }
      if (this._charOpen) {
        if (e.key === 'Escape') { e.preventDefault(); this.bus.emit('ui:char-close'); }
        return;
      }

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this._primaryAction();
        return;
      }
      const n = parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 9) {
        this._selectChoiceByIndex(n - 1);
      }
    });
  }

  /** 空格/回车:跳过打字 → 推进剧情 → 战斗结束回合 */
  _primaryAction() {
    if (this.state === GameState.BATTLE) {
      this.bus.emit('ui:end-turn');
      return;
    }
    if (this.state !== GameState.NARRATIVE) return;
    if (this._typing) { this._skipTyping(); return; }
    const node = this.engine?.currentNode;
    if (!node) return;
    if (node.kind === 'choice') return; // 选项必须显式选择
    if (node.kind === 'switch_career') return;
    if (node.kind === 'ending') { this.bus.emit('ui:show-ending'); return; }
    if (node.next) this.bus.emit('ui:narrative-next');
  }

  _onTextAreaClick() {
    if (this.state !== GameState.NARRATIVE) return;
    if (this._typing) { this._skipTyping(); return; }
    const node = this.engine?.currentNode;
    if (!node) return;
    if (node.kind === 'ending') { this.bus.emit('ui:show-ending'); return; }
    if (node.kind === 'narrative' && node.next) {
      this.bus.emit('ui:narrative-next');
    }
  }

  _selectChoiceByIndex(i) {
    if (this.state !== GameState.NARRATIVE) return;
    if (this._typing) return;
    const nodes = this.el.narrativeChoices.querySelectorAll('.narrative-choice-btn, .career-card, .switch-keep-btn');
    const el = nodes[i];
    if (el) el.click();
  }

  /** 主菜单余烬 */
  _spawnEmbers() {
    const box = document.getElementById('menu-embers');
    if (!box) return;
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span');
      s.style.left = `${Math.random() * 100}%`;
      s.style.animationDuration = `${6 + Math.random() * 7}s`;
      s.style.animationDelay = `${-Math.random() * 8}s`;
      s.style.setProperty('--drift', `${(Math.random() - 0.5) * 80}px`);
      const scale = 0.6 + Math.random() * 0.9;
      s.style.width = `${3 * scale}px`;
      s.style.height = `${3 * scale}px`;
      box.appendChild(s);
    }
  }

  // ===== 视图 =====
  showView(state) {
    this.state = state;
    Object.values(this.el.views).forEach((v) => v && v.classList.remove('is-active'));
    let target = this.el.views.battle;
    if (state === GameState.MENU) target = this.el.views.menu;
    else if (state === GameState.CAREER) target = this.el.views.career;
    else if (state === GameState.NARRATIVE) target = this.el.views.narrative;
    else if (state === GameState.MAP) target = this.el.views.map;
    else if (state === GameState.WORLD) target = this.el.views.world;
    else if (state === GameState.TRAVEL) target = this.el.views.travel;
    else if (state === GameState.SHOP) target = this.el.views.shop;
    else if (state === GameState.MARKET) target = this.el.views.market;
    else if (state === GameState.BAG) target = this.el.views.bag;
    else if (state === GameState.JOB) target = this.el.views.job;
    else if (state === GameState.BATTLE) target = this.el.views.battle;
    else if (state === GameState.REWARD) target = this.el.views.reward;
    else if (state === GameState.VICTORY || state === GameState.DEFEAT) target = this.el.views.result;
    else if (state === GameState.CREDITS) target = this.el.views.credits;
    else if (state === GameState.RESTAURANT) target = this.el.views.restaurant;
    else if (state === GameState.HOTEL) target = this.el.views.hotel;
    else if (state === GameState.MARKET_POI) target = this.el.views.market_poi;
    else if (state === GameState.MERCHANT) target = this.el.views.merchant;
    else if (state === GameState.BLACKSMITH) target = this.el.views.blacksmith;
    else if (state === GameState.GEMSHOP) target = this.el.views.gemshop;
    else if (state === GameState.JEWELER) target = this.el.views.jeweler;
    if (target) target.classList.add('is-active');

    if (state === GameState.VICTORY) this._renderResult(true);
    else if (state === GameState.DEFEAT) this._renderResult(false);
  }

  updateSeed(seed) {
    this.el.seed.textContent = `#${(seed >>> 0).toString(16)}`;
  }

  /** 顶栏与各面板的资源显示(金币 / 行动力) */
  renderResources(economy) {
    if (!economy) return;
    const goldTxt = `${economy.gold}`;
    const apTxt = `${economy.ap}/${economy.apCap()}`;
    if (this.el.gold) this.el.gold.textContent = goldTxt;
    if (this.el.ap) this.el.ap.textContent = apTxt;
    let chips = `<span class="res-chip">🪙 ${goldTxt}</span><span class="res-chip">⚡ ${apTxt}</span>`;
    // 拥有的特殊交易币(专属集市用)
    if (typeof economy.tokens === 'function') {
      for (const t of economy.tokens()) {
        chips += `<span class="res-chip is-token" title="${this._escapeHtml(t.name)}">${t.icon} ${t.qty}</span>`;
      }
    }
    for (const el of [this.el.mapRes, this.el.shopRes, this.el.marketRes, this.el.bagRes, this.el.jobRes,
      this.el.restaurantRes, this.el.hotelRes, this.el.marketpoiRes, this.el.merchantRes]) {
      if (el) el.innerHTML = chips;
    }
  }

  /** 章节进度 */
  _renderChapterMeta() {
    const engine = this.engine;
    if (!engine) return;
    const id = engine.currentChapterId;
    const chapter = engine.chapters?.[id];
    const idx = chapterProgressIndex(id);
    const total = CHAPTER_ORDER.length;
    this.el.chapterTitle.textContent = chapter?.title || '—';
    const pct = idx >= 0 ? Math.round(((idx + 1) / total) * 100) : 0;
    this.el.progressFill.style.width = `${pct}%`;
  }

  // ===== 主菜单:两大章入口 =====
  /** 渲染主菜单的大章卡片(含通关 / 锁定状态);锁定卡片点击给出提示 */
  renderChapterSelect(entries, opts = {}) {
    const box = this.el.chapterSelect;
    if (!box) return;
    box.innerHTML = '';
    // 继续上一局(存在运行时存档时显示)
    if (opts.hasSave) {
      const cont = document.createElement('button');
      cont.type = 'button';
      cont.className = 'chapter-entry is-continue';
      cont.innerHTML = `
        <div class="chapter-entry-head">
          <span class="chapter-entry-badge">继续旅程</span>
          <span class="chapter-entry-state">${opts.saveSummary ? this._escapeHtml(opts.saveSummary) : '未完成的旅程'}</span>
        </div>
        <div class="chapter-entry-title">接续上一局进度</div>
        <div class="chapter-entry-sub">从上次离开的地方继续,角色、背包、剧情进度均已保留</div>
      `;
      cont.addEventListener('click', () => this.bus.emit('ui:continue-save'));
      box.appendChild(cont);
    }
    (entries || []).forEach((e) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `chapter-entry${e.locked ? ' is-locked' : ''}${e.cleared ? ' is-cleared' : ''}`;
      const state = e.locked ? '🔒 未解锁' : (e.cleared ? '✓ 已通关' : '▶ 可挑战');
      card.innerHTML = `
        <div class="chapter-entry-head">
          <span class="chapter-entry-badge">${e.badge}</span>
          <span class="chapter-entry-state">${state}</span>
        </div>
        <div class="chapter-entry-title">${this._escapeHtml(e.title)}</div>
        <div class="chapter-entry-sub">${this._escapeHtml(e.sub)}</div>
        ${e.locked ? '<div class="chapter-entry-lock">通关「第一大章 · 家园破碎」后解锁</div>' : ''}
      `;
      card.addEventListener('click', () => {
        if (e.locked) {
          card.classList.remove('shake');
          void card.offsetWidth;
          card.classList.add('shake');
          this.showToast('先通关「第一大章 · 家园破碎」,才能踏上新的旅程');
          return;
        }
        this.bus.emit('ui:start-chapter', e.id);
      });
      box.appendChild(card);
    });
  }

  /** 背景音乐按钮状态 */
  setMusicState(on) {
    const btn = this.el.btnMusic;
    if (!btn) return;
    btn.classList.toggle('is-on', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = on ? '背景音乐:开' : '背景音乐:关';
  }

  // ===== 游戏说明(操作指南) =====
  openHowto() {
    if (!this.el.howto) return;
    this.el.howto.hidden = false;
    this._howtoOpen = true;
  }

  closeHowto() {
    if (!this.el.howto) return;
    this.el.howto.hidden = true;
    this._howtoOpen = false;
  }

  // ===== 右下角:邮箱 / 兑换码 =====
  /** 更新邮箱红点(待领取信件数;≤0 时隐藏) */
  setMailBadge(n) {
    const el = this.el.dockMailBadge;
    if (!el) return;
    const count = Number(n) || 0;
    el.textContent = count > 99 ? '99+' : String(count);
    el.hidden = count <= 0;
  }

  /** 提交兑换码输入框中的内容 */
  _submitRedeem() {
    const code = this.el.redeemInput ? this.el.redeemInput.value : '';
    this.bus.emit('ui:redeem-submit', code);
  }

  /** 渲染并打开邮箱。state: { mails:[{id,no,from,title,body,rewardText,hasReward,claimed}], claimable } */
  renderMailbox({ mails, claimable = 0 } = {}) {
    const list = this.el.mailList;
    if (this.el.mailNote) {
      this.el.mailNote.textContent = (mails && mails.length)
        ? (claimable > 0 ? `有 ${claimable} 封信的奖励待领取。` : '信件都已阅。')
        : '邮箱还是空的。';
    }
    if (list) {
      list.innerHTML = '';
      if (!mails || !mails.length) {
        const empty = document.createElement('p');
        empty.className = 'mail-empty';
        empty.textContent = '暂时没有新的信件。';
        list.appendChild(empty);
      } else {
        mails.forEach((m) => list.appendChild(this._mailCardEl(m)));
      }
    }
    this.openMailbox();
  }

  /** 单封邮件卡片 */
  _mailCardEl(m) {
    const card = document.createElement('div');
    card.className = `mail-card${m.claimed ? ' is-claimed' : ''}`;
    const reward = m.hasReward
      ? `<span class="mail-reward">🎁 ${this._escapeHtml(m.rewardText)}</span>`
      : '<span></span>';
    const action = m.hasReward
      ? (m.claimed
        ? '<span class="mail-state">已领取</span>'
        : '<button class="btn btn-primary btn-sm" type="button" data-mail-claim>领 取</button>')
      : '<span class="mail-state">公告</span>';
    card.innerHTML = `
      <div class="mail-head">
        <span class="mail-from">${this._escapeHtml(m.from)}</span>
        ${m.no ? `<span class="mail-no">#${this._escapeHtml(m.no)}</span>` : ''}
      </div>
      <div class="mail-title">${this._escapeHtml(m.title)}</div>
      <div class="mail-body">${this._escapeHtml(m.body)}</div>
      <div class="mail-foot">${reward}${action}</div>
    `;
    const btn = card.querySelector('[data-mail-claim]');
    if (btn) btn.addEventListener('click', () => this.bus.emit('ui:mail-claim', m.id));
    return card;
  }

  openMailbox() {
    const box = this.el.mailbox;
    if (!box) return;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    this._mailOpen = true;
  }

  closeMailbox() {
    const box = this.el.mailbox;
    this._mailOpen = false;
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!this._mailOpen) box.hidden = true; }, 200);
  }

  // ===== 左下角:回忆(剧情回顾) / 衣橱(更换时装) =====
  /**
   * 渲染并打开「回忆」弹窗。
   * data: { chapters:[{ id,no,title,recap,status:'cleared'|'current'|'locked' }], clearedCount,total }
   */
  renderMemorial(data = {}) {
    const list = this.el.memorialList;
    if (this.el.memorialNote) {
      const { clearedCount = 0, total = 0 } = data;
      this.el.memorialNote.textContent = total
        ? `已通关 ${clearedCount} / ${total} 个大章。走过的每一步,都记在这里。`
        : '走过的每一个大章,都记在这里。';
    }
    if (!list) return;
    list.innerHTML = '';
    const chapters = data.chapters || [];
    if (!chapters.length) {
      const empty = document.createElement('p');
      empty.className = 'memorial-empty';
      empty.textContent = '旅程尚未启程。';
      list.appendChild(empty);
    } else {
      chapters.forEach((c) => list.appendChild(this._memorialCardEl(c)));
    }
    this.openMemorial();
  }

  /** 单章回顾卡片 */
  _memorialCardEl(c) {
    const card = document.createElement('div');
    card.className = `memorial-card is-${c.status}`;
    if (c.status === 'cleared') {
      card.innerHTML = `
        <div class="memorial-head">
          <span class="memorial-no">${this._escapeHtml(c.no)}</span>
          <span class="memorial-title">${this._escapeHtml(c.title)}</span>
          <span class="memorial-state">已通关</span>
        </div>
        <div class="memorial-body">${this._escapeHtml(c.recap || '')}</div>
      `;
    } else if (c.status === 'current') {
      card.innerHTML = `
        <div class="memorial-head">
          <span class="memorial-no">${this._escapeHtml(c.no)}</span>
          <span class="memorial-title">${this._escapeHtml(c.title)}</span>
          <span class="memorial-state is-current">进行中</span>
        </div>
        <div class="memorial-body">这一章尚未走完,通关后在此回看全章回顾。</div>
      `;
    } else {
      card.innerHTML = `
        <div class="memorial-head">
          <span class="memorial-no">${this._escapeHtml(c.no)}</span>
          <span class="memorial-title">${this._escapeHtml(c.title)}</span>
          <span class="memorial-state is-locked">未解锁</span>
        </div>
        <div class="memorial-body">前路尚未展开……</div>
      `;
    }
    return card;
  }

  openMemorial() {
    const box = this.el.memorial;
    if (!box) return;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    this._memorialOpen = true;
  }

  closeMemorial() {
    const box = this.el.memorial;
    this._memorialOpen = false;
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!this._memorialOpen) box.hidden = true; }, 200);
  }

  /**
   * 渲染并打开「衣橱」弹窗。
   * data: { appearance, careerId, lookLabel,
   *         slots: { [slot]: { current:{id,name,icon,level,tint}|null, options:[{id,name,icon,level,tint}] } } }
   */
  renderWardrobe(data = {}) {
    this._wardrobeData = data;
    this._paintWardrobe();
    this._renderWardrobeSlots();
    this.openWardrobe();
  }

  /** 衣橱预览:按当前外观绘制像素小人 */
  _paintWardrobe() {
    const d = this._wardrobeData;
    if (!d) return;
    const canvas = this.el.wardrobeCanvas;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      paintCharacter(ctx, 2, d.careerId, d.appearance);
    }
    if (this.el.wardrobeLook) this.el.wardrobeLook.textContent = d.lookLabel || '';
  }

  /** 七个防具外观槽 */
  _renderWardrobeSlots() {
    const d = this._wardrobeData;
    const box = this.el.wardrobeSlots;
    if (!box || !d) return;
    box.innerHTML = '';
    for (const slot of ARMOR_SLOTS) {
      const info = (d.slots && d.slots[slot]) || { current: null, options: [] };
      const cur = info.current;
      const opts = info.options || [];
      const section = document.createElement('div');
      section.className = 'wardrobe-slot';
      section.innerHTML = `
        <div class="wardrobe-slot-head">
          <span class="wardrobe-slot-name">${ARMOR_SLOT_CN[slot]}</span>
          <span class="wardrobe-slot-cur">${cur ? `${this._escapeHtml(cur.icon)} ${this._escapeHtml(cur.name)}` : '不显示'}</span>
        </div>
        <div class="wardrobe-opts">
          <button class="wardrobe-opt${cur ? '' : ' is-active'}" type="button" data-slot="${slot}" data-id="">
            <span class="wardrobe-opt-icon">🚫</span>
            <span class="wardrobe-opt-text">不显示</span>
          </button>
          ${opts.map((o) => `
            <button class="wardrobe-opt${cur && cur.id === o.id ? ' is-active' : ''}" type="button" data-slot="${slot}" data-id="${o.id}" title="${this._escapeHtml(o.name)}">
              <span class="wardrobe-opt-icon" ${o.tint ? `style="color:${o.tint}"` : ''}>${o.icon}</span>
              <span class="wardrobe-opt-text">${this._escapeHtml(o.name)}</span>
            </button>`).join('')}
        </div>
      `;
      box.appendChild(section);
    }
    box.querySelectorAll('[data-slot]').forEach((b) => {
      b.addEventListener('click', () => this.bus.emit('ui:cosmetic-set', { slot: b.dataset.slot, id: b.dataset.id || null }));
    });
  }

  openWardrobe() {
    const box = this.el.wardrobe;
    if (!box) return;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    this._wardrobeOpen = true;
  }

  closeWardrobe() {
    const box = this.el.wardrobe;
    this._wardrobeOpen = false;
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!this._wardrobeOpen) box.hidden = true; }, 200);
  }

  // ===== 左下角:设置(音量 / 注销) =====
  /** 打开「设置」弹窗;volume 为当前音量(0~1) */
  openSettings(volume = 1) {
    const box = this.el.settings;
    if (!box) return;
    if (this.el.settingsVolume) {
      const pct = Math.round(Math.max(0, Math.min(1, Number(volume) || 0)) * 100);
      this.el.settingsVolume.value = String(pct);
      this._setVolumeLabel(pct);
    }
    this._showLogoutConfirm(false);
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    this._settingsOpen = true;
  }

  closeSettings() {
    const box = this.el.settings;
    this._settingsOpen = false;
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!this._settingsOpen) box.hidden = true; }, 200);
  }

  _setVolumeLabel(pct) {
    if (this.el.settingsVolumeVal) this.el.settingsVolumeVal.textContent = `${pct}%`;
  }

  /** 显示 / 隐藏注销的二次确认 */
  _showLogoutConfirm(show) {
    if (this.el.settingsConfirm) this.el.settingsConfirm.hidden = !show;
    if (this.el.settingsLogoutActions) this.el.settingsLogoutActions.hidden = !!show;
  }

  /** 渲染并打开兑换码面板。msg 为提示文案,kind ∈ '' | 'ok' | 'bad' */
  renderRedeem({ msg = '', kind = '', reset = false } = {}) {
    if (this.el.redeemMsg) {
      this.el.redeemMsg.textContent = msg || '';
      this.el.redeemMsg.classList.remove('is-ok', 'is-bad');
      if (kind === 'ok') this.el.redeemMsg.classList.add('is-ok');
      else if (kind === 'bad') this.el.redeemMsg.classList.add('is-bad');
    }
    if (reset && this.el.redeemInput) this.el.redeemInput.value = '';
    this.openRedeem();
  }

  openRedeem() {
    const box = this.el.redeem;
    if (!box) return;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    this._redeemOpen = true;
    if (this.el.redeemInput) setTimeout(() => this.el.redeemInput.focus(), 120);
  }

  closeRedeem() {
    const box = this.el.redeem;
    this._redeemOpen = false;
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!this._redeemOpen) box.hidden = true; }, 200);
  }

  // ===== 右下角:关于 · 条款与声明(数据源 data/about.js) =====
  /** 打开「关于」弹窗;activeId 指定要展示的文档,缺省沿用上次/第一篇 */
  openAbout(activeId) {
    const box = this.el.about;
    if (!box) return;
    this._renderAboutNav();
    this._renderAboutDoc(activeId || this._aboutId || (ABOUT_DOCS[0] && ABOUT_DOCS[0].id));
    if (this.el.aboutUpdated) this.el.aboutUpdated.textContent = `条款最后更新:${ABOUT_UPDATED}`;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    this._aboutOpen = true;
  }

  closeAbout() {
    const box = this.el.about;
    this._aboutOpen = false;
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!this._aboutOpen) box.hidden = true; }, 200);
  }

  /** 目录:每篇文档一个按钮 */
  _renderAboutNav() {
    const nav = this.el.aboutNav;
    if (!nav) return;
    nav.innerHTML = '';
    for (const doc of ABOUT_DOCS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'about-nav-btn';
      b.dataset.aboutId = doc.id;
      b.innerHTML = `<span class="about-nav-no">${this._escapeHtml(doc.no || '')}</span>`
        + `<span class="about-nav-title">${this._escapeHtml(doc.title)}</span>`;
      b.addEventListener('click', () => this._renderAboutDoc(doc.id));
      nav.appendChild(b);
    }
  }

  /** 渲染单篇文档(极简标记:## 小标题 / - 列表 / 空行分段) */
  _renderAboutDoc(id) {
    const doc = ABOUT_DOCS.find((d) => d.id === id) || ABOUT_DOCS[0];
    if (!doc) return;
    this._aboutId = doc.id;
    if (this.el.aboutDocTitle) {
      this.el.aboutDocTitle.textContent = `${doc.no ? `${doc.no} · ` : ''}${doc.title}`;
    }
    const host = this.el.aboutDoc;
    if (host) {
      host.innerHTML = '';
      let ul = null;
      for (const raw of String(doc.body || '').split('\n')) {
        const t = raw.trim();
        if (!t) { ul = null; continue; }
        if (t.startsWith('## ')) {
          ul = null;
          const h = document.createElement('h4');
          h.className = 'about-sub';
          h.textContent = t.slice(3).trim();
          host.appendChild(h);
        } else if (t.startsWith('- ')) {
          if (!ul) { ul = document.createElement('ul'); ul.className = 'about-list'; host.appendChild(ul); }
          const li = document.createElement('li');
          li.textContent = t.slice(2).trim();
          ul.appendChild(li);
        } else {
          ul = null;
          const p = document.createElement('p');
          p.className = 'about-p';
          p.textContent = t;
          host.appendChild(p);
        }
      }
      const scroller = host.parentElement;
      if (scroller) scroller.scrollTop = 0;
    }
    if (this.el.aboutNav) {
      this.el.aboutNav.querySelectorAll('[data-about-id]').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.aboutId === doc.id);
      });
    }
    // 广播「本篇已被查看」,供年龄门统计必读进度
    document.dispatchEvent(new CustomEvent('about:read', { detail: { id: doc.id } }));
  }

  // ===== 职业选择视图(扩展用) =====
  renderCareers() {
    this.el.careerGrid.innerHTML = '';
    for (const c of CAREERS) {
      this.el.careerGrid.appendChild(this._careerCardEl(c, () => this.bus.emit('ui:choose-career', c.id)));
    }
  }

  _careerCardEl(c, onClick, compact = false) {
    const card = document.createElement('div');
    card.className = 'career-card';
    card.innerHTML = `
      <div class="career-icon-row">
        <div class="career-icon" style="background:${c.color}">${c.icon}</div>
        <div>
          <div class="career-title">${c.name}</div>
          <div class="career-class">${c.title}</div>
        </div>
      </div>
      ${compact ? '' : `<div class="career-story">${this._escapeHtml(c.backstory)}</div>`}
      <div class="career-meta">
        <span>HP <code>${c.maxHp}</code></span>
        <span>能量 <code>${c.energyMax}</code></span>
        <span>特色卡 <code>${c.signatureCards.length}</code></span>
      </div>
    `;
    card.addEventListener('click', onClick);
    return card;
  }

  // ===== 剧情视图 =====
  _renderNarrative(snap) {
    const node = snap.node;
    if (!node) return;
    this._stopTyping();
    this._renderChapterMeta();

    // 状态条:职业 + 四维
    const stats = Object.entries(snap.stats)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => `<span class="stat-chip">${STAT_LABELS[k] || k} ${v > 0 ? '+' : ''}${v}</span>`)
      .join('');
    const cv = this._careerView(snap.career);
    const careerChip = cv
      ? `<span class="stat-chip is-career" style="background:${cv.color};color:#fff">${cv.icon} ${cv.title}</span>`
      : '';
    this.el.narrativeStats.innerHTML = careerChip + stats;

    // 生命 / 能量
    this._renderVitals();

    // 文本 + 插图
    const imgHtml = snap.image
      ? `<img class="narrative-image" src="${snap.image}" alt="剧情插图" loading="lazy" />`
      : '';
    this.el.narrativeText.innerHTML = imgHtml + '<div class="narrative-text-body"></div>';
    this.el.narrativeText.scrollTop = 0;
    const body = this.el.narrativeText.querySelector('.narrative-text-body');

    const fullText = node.text || '';
    this._fullText = fullText;
    this._startParagraphReveal(body, fullText);

    // 选项(先构建,打字完成后再浮现)
    this._buildChoices(node, snap);
    this.el.narrativeChoices.classList.add('is-waiting');
    this._choicesReady = false;

    // 底部提示
    this.el.narrativeHint.innerHTML = `<kbd>空格</kbd> 推进 · <kbd>1</kbd>~<kbd>9</kbd> 选择 · 点击文本可跳过`;

    // 像素图侧栏:人物状态 / 服饰 + 所处环境
    this._renderScene(node, snap);
  }

  /** 刷新像素图侧栏(不影响剧情文字窗口) */
  _renderScene(node, snap) {
    if (!this.scene) return;
    this.scene.render({
      chapterId: snap.chapter,
      nodeId: node.id,
      career: this._careerView(snap.career),
      player: this.engine?.player,
      flags: snap.flags,
      appearance: this.economy ? this.economy.appearance() : null,
    });
  }

  /** HP / 能量条 */
  _renderVitals() {
    const p = this.engine?.player;
    if (!p) { this.el.narrativeVitals.innerHTML = ''; return; }
    const hpPct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
    const mpPct = p.maxMp ? Math.max(0, Math.round((p.mp / p.maxMp) * 100)) : 0;
    this.el.narrativeVitals.innerHTML = `
      <span class="vital">
        <span>HP</span>
        <span class="vital-bar hp"><i style="width:${hpPct}%"></i></span>
        <code>${p.hp}/${p.maxHp}</code>
      </span>
      <span class="vital">
        <span>魔力</span>
        <span class="vital-bar mp-bar"><i style="width:${mpPct}%"></i></span>
        <code>${p.mp}/${p.maxMp}</code>
      </span>
      <span class="vital"><span>战力</span><code>${p.power || 0}</code></span>
    `;
  }

  /** 逐段渐显 */
  _startParagraphReveal(body, text) {
    // 按空行分段,保留段内换行
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    this._paraEls = [];
    this._paraIndex = 0;

    if (paragraphs.length === 0) {
      this._finishTyping();
      return;
    }

    this._typing = true;
    body.innerHTML = '';

    // 预创建所有段落(初始不可见)
    paragraphs.forEach((p) => {
      const el = document.createElement('p');
      el.textContent = p;
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.transition = `opacity ${PARA_FADE_MS}ms var(--ease), transform ${PARA_FADE_MS}ms var(--ease)`;
      body.appendChild(el);
      this._paraEls.push(el);
    });

    // 立即显示第一段
    this._revealNextParagraph();

    // 按节奏逐段浮现
    this._scheduleNext();
  }

  _scheduleNext() {
    if (this._paraIndex >= this._paraEls.length) {
      this._stopTyping();
      this._finishTyping();
      return;
    }
    const current = this._paraEls[this._paraIndex - 1];
    const len = current ? current.textContent.length : 0;
    const delay = Math.min(PARA_MAX_MS, PARA_BASE_MS + len * PARA_PER_CHAR_MS);
    this._paraTimer = setTimeout(() => {
      this._revealNextParagraph();
      this._scheduleNext();
    }, delay);
  }

  _revealNextParagraph() {
    if (this._paraIndex >= this._paraEls.length) return;
    const el = this._paraEls[this._paraIndex];
    el.style.opacity = '1';
    el.style.transform = 'none';
    this._paraIndex++;
    // 不自动滚动,保持用户当前阅读位置
  }

  _skipTyping() {
    if (!this._typing) return;
    this._stopTyping();
    // 一次性浮现全部剩余段落
    for (let i = this._paraIndex; i < this._paraEls.length; i++) {
      const el = this._paraEls[i];
      el.style.opacity = '1';
      el.style.transform = 'none';
    }
    this._paraIndex = this._paraEls.length;
    // 不强制滚动,保持用户当前阅读位置
    this._finishTyping();
  }

  _stopTyping() {
    if (this._paraTimer) { clearTimeout(this._paraTimer); this._paraTimer = null; }
    this._typing = false;
  }

  /** 呈现完成:浮现选项 */
  _finishTyping() {
    this.el.narrativeChoices.classList.remove('is-waiting');
    this._choicesReady = true;
  }

  _buildChoices(node, snap) {
    const box = this.el.narrativeChoices;
    box.innerHTML = '';
    box.classList.remove('career-grid');

    if (node.kind === 'career') {
      box.classList.add('career-grid');
      for (const c of CAREERS) {
        box.appendChild(this._careerCardEl(c, () => this.bus.emit('ui:choose-career', c.id)));
      }
    } else if (node.kind === 'switch_career') {
      this._buildCareerSwitch(node);
    } else if (node.kind === 'choice' && node.choices) {
      node.choices.forEach((choice, i) => {
        const btn = document.createElement('button');
        btn.className = 'narrative-choice-btn';
        btn.style.animationDelay = `${i * 0.08}s`;
        const key = document.createElement('span');
        key.className = 'choice-key';
        key.textContent = String(i + 1);
        const txt = document.createElement('span');
        txt.className = 'choice-text';
        txt.textContent = choice.text;
        btn.appendChild(key);
        btn.appendChild(txt);
        btn.addEventListener('click', () => {
          if (this._typing) this._skipTyping();
          this.bus.emit('ui:narrative-choose', i);
        });
        box.appendChild(btn);
      });
    } else if (node.kind === 'ending') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = '查看结局';
      btn.addEventListener('click', () => this.bus.emit('ui:show-ending'));
      box.appendChild(btn);
    } else if (node.next) {
      const cont = document.createElement('div');
      cont.className = 'narrative-continue';
      cont.textContent = '▼ 继续';
      cont.addEventListener('click', () => {
        if (this._typing) { this._skipTyping(); return; }
        this.bus.emit('ui:narrative-next');
      });
      box.appendChild(cont);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost';
      btn.textContent = '返回主菜单';
      btn.addEventListener('click', () => this.bus.emit('ui:restart'));
      box.appendChild(btn);
    }
  }

  /** 职业切换节点渲染 */
  _buildCareerSwitch(node) {
    const box = this.el.narrativeChoices;
    const currentCareer = this.engine?.career;
    const unlocked = [...(this.engine?.unlockedCareers || [])];

    const hint = document.createElement('div');
    hint.className = 'switch-hint';
    hint.innerHTML = currentCareer
      ? `<span>当前职业</span><span class="stat-chip is-career" style="background:${currentCareer.color};color:#fff">${currentCareer.icon} ${currentCareer.name}</span>`
      : '尚未选择职业';
    box.appendChild(hint);

    const switchable = unlocked
      .map((id) => CAREER_MAP[id])
      .filter((c) => c && (!currentCareer || c.id !== currentCareer.id));

    if (switchable.length === 0) {
      const noOpt = document.createElement('p');
      noOpt.className = 'switch-none';
      noOpt.textContent = '(暂无可切换的其他已解锁职业)';
      box.appendChild(noOpt);
    } else {
      const grid = document.createElement('div');
      grid.className = 'career-grid career-grid-compact';
      switchable.forEach((c, i) => {
        const card = this._careerCardEl(c, () => this.bus.emit('ui:switch-career', c.id), true);
        card.style.animationDelay = `${i * 0.06}s`;
        grid.appendChild(card);
      });
      box.appendChild(grid);
    }

    const keepBtn = document.createElement('button');
    keepBtn.className = 'btn btn-ghost switch-keep-btn';
    keepBtn.textContent = currentCareer ? `保持「${currentCareer.name}」继续旅程` : '继续旅程';
    keepBtn.addEventListener('click', () => {
      if (this._typing) { this._skipTyping(); return; }
      this.bus.emit('ui:narrative-next');
    });
    box.appendChild(keepBtn);
  }

  bindEngine(engine) {
    this.engine = engine;
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ===== 地区地图 =====
  /** 渲染地区地图:地点、目标提示、旅行消耗与本地服务 */
  renderMap(state) {
    const {
      region, chapterNum, currentIndex, objectiveIndex, travelCost, travelSeconds,
      isStoryRegion, npcs, chest, stopChests, intelCount, economy, venue, stalls,
    } = state;
    if (!region) return;
    if (this.el.mapRegionName) this.el.mapRegionName.textContent = region.name;

    const obj = objectiveIndex >= 0 ? region.stops[objectiveIndex] : null;
    if (this.el.mapHint) {
      if (!isStoryRegion) {
        this.el.mapHint.textContent = '此地暂无剧情。可在世界地图上启程,前往剧情所在地区。';
      } else {
        this.el.mapHint.textContent = obj
          ? `剧情提示:${obj.hint}${obj.npc ? `(找到「${obj.npc}」)` : ''}`
          : '当前没有待开启的剧情,可自由探索。';
      }
      if (venue && venue.here) {
        this.el.mapHint.textContent += ` · 此处有隐秘集市(只收 ${venue.tokenIcon}${venue.tokenName},管理费 ${Math.round(venue.fee * 100)}%)`;
      }
    }

    // 地点卡片
    const box = this.el.mapStops;
    if (box) {
      box.innerHTML = '';
      region.stops.forEach((s, i) => {
        const here = i === currentIndex;
        const isObj = i === objectiveIndex;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `stop-card${here ? ' is-here' : ''}${isObj ? ' is-objective' : ''}`;
        const tag = here ? '所在' : (isObj ? '目标' : `⚡${travelCost[i]}`);
        const eta = here ? '' : `<span class="stop-eta">约 ${this._fmtDuration(travelSeconds[i])}</span>`;
        const sc = stopChests ? stopChests[i] : null;
        const chestMark = sc ? `<span class="stop-chest${sc.opened ? ' is-opened' : ''}">${sc.opened ? '📭' : '🔒'}</span>` : '';
        card.innerHTML = `
          <div class="stop-head">
            <span class="stop-name">${this._escapeHtml(s.name)}${chestMark}</span>
            <span class="stop-tag">${tag}</span>
          </div>
          <div class="stop-meta">${s.npc ? `人物 · ${this._escapeHtml(s.npc)}` : '无人驻留'}</div>
          <div class="stop-services">${this._serviceTags(s.services)}</div>
          ${eta}
        `;
        card.disabled = here;
        if (!here) card.addEventListener('click', () => this.bus.emit('ui:map-travel', i));
        box.appendChild(card);
      });
    }

    // 当前地点的服务按钮
    const cur = region.stops[currentIndex];
    if (this.el.mapServices) {
      const svc = cur?.services || {};
      this.el.mapServices.innerHTML = '';
      const mk = (label, ev, ok) => {
        const b = document.createElement('button');
        b.className = 'btn btn-ghost';
        b.textContent = label;
        b.disabled = !ok;
        if (ok) b.addEventListener('click', () => this.bus.emit(ev));
        return b;
      };
      this.el.mapServices.appendChild(mk('商 店', 'ui:map-shop', !!svc.shop));
      // 市场:全品类的玩家集市,处处可去(另收管理费)
      this.el.mapServices.appendChild(mk('市 场', 'ui:map-market', true));
      this.el.mapServices.appendChild(mk('打 工', 'ui:map-job', !!svc.job));
      // 「休息」操作已下线:行动力由 剧情推进 / NPC赠予 / 食品 / 酒店休整 恢复
      // 铁匠铺 / 宝石商 / 精益师(主城全有;其他地区固定 + 流动摊位)
      (stalls || []).forEach((type) => {
        if (type === 'blacksmith') this.el.mapServices.appendChild(mk('🔨 铁匠铺', 'ui:map-blacksmith', true));
        else if (type === 'gemshop') this.el.mapServices.appendChild(mk('💎 宝石商', 'ui:map-gemshop', true));
        else if (type === 'jeweler') this.el.mapServices.appendChild(mk('🔧 精益师', 'ui:map-jeweler', true));
      });
      if (venue && venue.here) {
        const b = document.createElement('button');
        b.className = 'btn btn-primary';
        b.textContent = `密 市 ${venue.tokenIcon}${venue.tokenOwned}`;
        b.addEventListener('click', () => this.bus.emit('ui:map-venue'));
        this.el.mapServices.appendChild(b);
      }
      if (chest) {
        const b = document.createElement('button');
        b.className = `btn ${chest.opened ? 'btn-ghost' : 'btn-primary'}`;
        b.textContent = chest.opened ? '宝 箱(已 开)' : '宝 箱 🔒';
        b.disabled = chest.opened;
        if (!chest.opened) b.addEventListener('click', () => this.bus.emit('ui:map-chest'));
        this.el.mapServices.appendChild(b);
      }
    }

    if (this.el.btnMapIntel) {
      this.el.btnMapIntel.textContent = intelCount ? `情 报 ${intelCount}` : '情 报';
    }

    // 本地随机 NPC:点击即交谈
    this._renderMapNpcs(npcs);

    // 任务窗格(至多三项)
    this._renderMapTasks(state.tasks);

    if (this.el.btnMapStory) {
      const can = objectiveIndex >= 0 && currentIndex === objectiveIndex;
      if (!isStoryRegion) {
        // 不在剧情地区:隐藏主按钮,避免与旁边的「世界地图」按钮重复
        this.el.btnMapStory.hidden = true;
      } else {
        this.el.btnMapStory.hidden = false;
        this.el.btnMapStory.disabled = !can;
        this.el.btnMapStory.textContent = can ? '开 始 剧 情' : (obj ? `前往「${obj.name}」` : '暂无剧情');
      }
    }
    this.renderResources(economy);
    this._renderMapPortrait();
  }

  /**
   * 任务窗格:最多显示三项正在执行的任务。
   * @param {Array<{title:string, detail:string, tag?:string}>} tasks
   */
  _renderMapTasks(tasks) {
    const box = this.el.mapTasks;
    if (!box) return;
    const list = Array.isArray(tasks) ? tasks.slice(0, 3) : [];
    if (!list.length) {
      box.innerHTML = '<div class="map-task is-empty">暂无任务</div>';
      return;
    }
    box.innerHTML = list.map((t) => `
      <div class="map-task">
        <span class="map-task-dot" aria-hidden="true"></span>
        <span class="map-task-body">
          <b>${this._escapeHtml(t.title || '')}</b>
          <i>${this._escapeHtml(t.detail || '')}</i>
        </span>
        ${t.tag ? `<span class="map-task-tag">${this._escapeHtml(t.tag)}</span>` : ''}
      </div>`).join('');
  }

  /** 地图左下角的人物形象(随换装变化) */
  _renderMapPortrait() {
    if (!this.scene) return;
    const snap = this.engine?.snapshot?.() || {};
    this.scene.renderMapPortrait({
      career: this._careerView(this.engine?.career || snap.career),
      player: this.engine?.player,
      flags: snap.flags,
      appearance: this.economy ? this.economy.appearance() : null,
    });
  }

  /** 当地驻留的随机 NPC 列表 */
  _renderMapNpcs(npcs) {
    const box = this.el.mapNpcs;
    if (!box) return;
    const list = Array.isArray(npcs) ? npcs : [];
    if (this.el.mapNpcsTitle) {
      this.el.mapNpcsTitle.textContent = list.length
        ? `本地人物 · ${list.length} 人(点击交谈)`
        : '本地人物(点击交谈)';
    }
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<span class="npc-empty">此地没有可交谈的人。</span>';
      return;
    }
    list.forEach((npc) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'npc-chip';
      b.innerHTML = `<span class="npc-chip-name">${this._escapeHtml(npc.name)}</span><span class="npc-chip-tag">${this._escapeHtml(npc.tag || '')}</span>`;
      b.addEventListener('click', () => this.bus.emit('ui:npc-talk', npc.id));
      box.appendChild(b);
    });
  }

  /** 秒 →「x 分 y 秒」 */
  _fmtDuration(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    if (s < 60) return `${s} 秒`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m} 分 ${r} 秒` : `${m} 分`;
  }

  _serviceTags(services = {}) {
    const tags = [];
    if (services.shop) tags.push('<span class="svc">商店</span>');
    if (services.job) tags.push('<span class="svc">打工</span>');
    return tags.join('') || '<span class="svc is-off">无</span>';
  }

  // ===== 世界地图(全部地区总览) =====
  /** 设置世界地图缩放倍率(0.6~3 倍,围绕中心缩放) */
  _setWorldZoom(z) {
    this._worldZoom = Math.max(0.6, Math.min(3, z));
    const c = this.el.worldCanvas;
    if (c) c.style.transform = `scale(${this._worldZoom.toFixed(3)})`;
  }

  renderWorld(state) {
    if (!state?.regions) return;
    this._worldState = state;
    const { regions, currentId, economy } = state;
    const cur = regions.find((r) => r.id === currentId) || null;
    const pois = state.pois || [];

    // 地图上的地区标记(位置即世界坐标)
    const map = this.el.worldCanvas;
    if (map) {
      map.innerHTML = '';
      regions.forEach((r) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = [
          'wm-marker',
          `theme-${r.theme}`,
          r.current ? 'is-current' : '',
          r.story ? 'is-story' : '',
          r.city ? 'is-city' : '',
          r.visited ? 'is-visited' : '',
          !r.current && r.reachable === false ? 'is-unreachable' : '',
          this._worldSelected === r.id ? 'is-selected' : '',
        ].filter(Boolean).join(' ');
        b.style.left = `${r.x}%`;
        b.style.top = `${r.y}%`;
        b.title = `${r.name} · ${r.terrainLabel} · ${r.dist} 里`;
        b.innerHTML = `
          ${r.story ? '<span class="wm-flag">剧情</span>' : ''}
          <span class="wm-dot"></span>
          <span class="wm-label">${this._escapeHtml(r.name)}</span>
        `;
        b.addEventListener('click', () => {
          this._worldSelected = r.id;
          this._worldPoiSelected = null;
          this.renderWorld(this._worldState);
          this.renderResources(economy);
        });
        map.appendChild(b);
      });

      // POI 标记(餐厅 / 酒店 / 商市)
      pois.forEach((p) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = [
          'wm-marker', 'wm-poi',
          `poi-${p.type}`,
          p.current ? 'is-current' : '',
          this._worldPoiSelected === p.id ? 'is-selected' : '',
        ].filter(Boolean).join(' ');
        b.style.left = `${p.x}%`;
        b.style.top = `${p.y}%`;
        b.title = `${p.icon} ${p.name} · ${p.typeCn}`;
        b.innerHTML = `
          <span class="wm-dot wm-poi-dot">${p.icon}</span>
          <span class="wm-label">${this._escapeHtml(p.name)}</span>
        `;
        b.addEventListener('click', () => {
          this._worldPoiSelected = p.id;
          this._worldSelected = null;
          this.renderWorld(this._worldState);
          this.renderResources(economy);
        });
        map.appendChild(b);
      });
    }

    // 右侧详情:选中的地区或 POI
    const selPoi = pois.find((p) => p.id === this._worldPoiSelected);
    const sel = regions.find((r) => r.id === this._worldSelected) || cur;
    if (selPoi) this._renderWorldPoiPanel(selPoi, state);
    else this._renderWorldPanel(sel, cur, state);

    // 全部地点清单(含里程 / 耗时 / 穿梭费用)
    const list = this.el.worldList;
    if (list) {
      list.innerHTML = '';
      [...regions].sort((a, b) => a.dist - b.dist).forEach((r) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `world-row${r.current ? ' is-current' : ''}${r.story ? ' is-story' : ''}${!r.current && r.reachable === false ? ' is-unreachable' : ''}`;
        row.innerHTML = `
          <span class="wr-name">${this._escapeHtml(r.name)}</span>
          <span class="wr-meta">${r.city ? '<b class="wr-city">主城</b>' : ''}<span class="wr-terrain">${this._escapeHtml(r.terrainLabel)}</span><span class="wr-lv">Lv.${r.level} · ${r.levelLabel}</span></span>
          <span class="wr-dist">${r.current ? '所在地' : `${r.dist} 里 · 约 ${this._fmtDuration(r.seconds)}`}</span>
        `;
        row.addEventListener('click', () => {
          this._worldSelected = r.id;
          this._worldPoiSelected = null;
          this.renderWorld(this._worldState);
          this.renderResources(economy);
        });
        list.appendChild(row);
      });
      // POI 清单
      pois.forEach((p) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `world-row is-poi poi-${p.type}${p.current ? ' is-current' : ''}`;
        row.innerHTML = `
          <span class="wr-name">${p.icon} ${this._escapeHtml(p.name)}</span>
          <span class="wr-meta"><span class="wr-terrain">${p.typeCn}</span></span>
          <span class="wr-dist">${p.current ? '所在地' : `${p.dist} 里 · 约 ${this._fmtDuration(p.seconds)}`}</span>
        `;
        row.addEventListener('click', () => {
          this._worldPoiSelected = p.id;
          this._worldSelected = null;
          this.renderWorld(this._worldState);
          this.renderResources(economy);
        });
        list.appendChild(row);
      });
    }

    if (this.el.worldNote) {
      const veh = state.vehicle
        ? `当前载具:${state.vehicle}(×${state.speedMul},限 ${(state.vehicleTerrain || []).join('、') || '—'})`
        : '当前徒步:不限地形,可在商店购买载具提速';
      this.el.worldNote.textContent = `${veh} · 全部 ${regions.length} 处地区已标注`;
    }
    this._renderWorldStoryBanner(state);
    this.renderResources(economy);
  }

  /**
   * 世界地图顶部的「剧情引导」横幅:报出主线所在的地区与里程 / 耗时 / 行动力,
   * 并给出一键「启程前往 / 穿梭」;若已身处该地区,则指引打开地区地图。
   */
  _renderWorldStoryBanner(state) {
    const box = this.el.worldStoryBanner;
    if (!box) return;
    const s = state.story;
    if (!s) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    const here = !!s.current;
    const stop = state.storyStop;
    const stopTxt = stop
      ? `前往「${this._escapeHtml(stop.name)}」${stop.npc ? `找到「${this._escapeHtml(stop.npc)}」` : '开启剧情'}`
      : '打开地区地图继续推进';
    const text = here
      ? `剧情在此 · 第${state.storyChapterNum}章「${this._escapeHtml(s.name)}」—— ${stopTxt}`
      : `第${state.storyChapterNum}章主线在「${this._escapeHtml(s.name)}」—— ${s.dist} 里 · 约 ${this._fmtDuration(s.seconds)} · ⚡${s.ap}`
        + (stop ? ` · 到那儿后${stopTxt}` : '');
    const curCity = !!state.regions.find((r) => r.id === state.currentId)?.city;
    const canShuttle = !here && !!s.city && curCity;
    const actions = here
      ? '<button class="btn btn-primary" data-act="story-map">打 开 地 区 地 图</button>'
      : `<button class="btn btn-primary" data-act="story-depart" ${s.reachable ? '' : 'disabled'}>启 程 前 往</button>`
        + (canShuttle ? `<button class="btn btn-ghost" data-act="story-shuttle">穿 梭 🪙${s.shuttleGold}</button>` : '');
    box.innerHTML = `
      <span class="story-banner-icon">📜</span>
      <span class="story-banner-text">${text}</span>
      <span class="story-banner-actions">${actions}</span>
    `;
    box.querySelector('[data-act="story-map"]')?.addEventListener('click', () => this.bus.emit('ui:back-map'));
    box.querySelector('[data-act="story-depart"]')?.addEventListener('click', () => this.bus.emit('ui:world-depart', s.id));
    box.querySelector('[data-act="story-shuttle"]')?.addEventListener('click', () => this.bus.emit('ui:world-shuttle', s.id));
  }

  _renderWorldPanel(sel, cur, state) {
    const box = this.el.worldPanel;
    if (!box || !sel) return;
    const here = sel.id === state.currentId;
    const canShuttle = !!sel.city && !!cur?.city && !here;
    box.innerHTML = `
      <div class="wp-head">
        <h3 class="wp-name">${this._escapeHtml(sel.name)}</h3>
        <div class="wp-tags">
          ${sel.city ? '<span class="wp-tag wp-tag-city">主城</span>' : ''}
          ${sel.story ? '<span class="wp-tag wp-tag-story">剧情在此</span>' : ''}
          ${sel.current ? '<span class="wp-tag wp-tag-here">所在地</span>' : ''}
          <span class="wp-tag">Lv.${sel.level} · ${sel.levelLabel}</span>
        </div>
      </div>
      <dl class="wp-stats">
        <div><dt>地形</dt><dd>${this._escapeHtml(sel.terrainLabel)}</dd></div>
        <div><dt>里程</dt><dd>${here ? '—' : `${sel.dist} 里`}</dd></div>
        <div><dt>预计耗时</dt><dd>${here ? '—' : this._fmtDuration(sel.seconds)}</dd></div>
        <div><dt>行动力</dt><dd>${here ? '—' : `⚡ ${sel.ap}`}</dd></div>
      </dl>
      <p class="wp-note">
        ${!state.canUseVehicleHere
          ? `当前载具「${this._escapeHtml(state.vehicle || '')}」在${this._escapeHtml(state.currentTerrain)}无法使用 —— 请在背包卸下载具,徒步不限地形。`
          : (here ? '你正在此地。可前往「地区地图」查看本地 3 个地点。'
            : (!sel.reachable
              ? `当前载具「${this._escapeHtml(state.vehicle || '')}」到不了${this._escapeHtml(sel.terrainLabel)} —— 先卸下载具${canShuttle ? `,或花 🪙 ${sel.shuttleGold} 穿梭` : ',或换一辆适用的'}。`
              : (canShuttle ? `主城之间可「穿梭」:花费 🪙 ${sel.shuttleGold} 立即抵达。`
                : (sel.city && !cur?.city ? '你所在处不是主城,无法穿梭 —— 先步行抵达任意主城。'
                  : '此地不是主城,只能步行前往(或购买载具提速)。'))))}
      </p>
      <div class="wp-actions">
        <button class="btn btn-primary" data-act="depart" ${here || (state.canUseVehicleHere && !sel.reachable) ? 'disabled' : ''}>启 程 前 往</button>
        <button class="btn btn-ghost" data-act="shuttle" ${canShuttle ? '' : 'disabled'}>穿 梭 🪙${sel.shuttleGold}</button>
        <button class="btn btn-ghost" data-act="local" ${here ? '' : 'disabled'}>地 区 地 图</button>
      </div>
    `;
    box.querySelector('[data-act="depart"]')?.addEventListener('click', () => this.bus.emit('ui:world-depart', sel.id));
    box.querySelector('[data-act="shuttle"]')?.addEventListener('click', () => this.bus.emit('ui:world-shuttle', sel.id));
    box.querySelector('[data-act="local"]')?.addEventListener('click', () => this.bus.emit('ui:back-map'));
  }

  /** 世界地图右侧:选中 POI 的详情面板 */
  _renderWorldPoiPanel(poi, state) {
    const box = this.el.worldPanel;
    if (!box) return;
    const here = poi.current;
    box.innerHTML = `
      <div class="wp-head">
        <h3 class="wp-name">${poi.icon} ${this._escapeHtml(poi.name)}</h3>
        <div class="wp-tags">
          <span class="wp-tag wp-tag-poi">${poi.typeCn}</span>
          ${here ? '<span class="wp-tag wp-tag-here">所在地</span>' : ''}
        </div>
      </div>
      <dl class="wp-stats">
        <div><dt>类型</dt><dd>${poi.typeCn}</dd></div>
        <div><dt>里程</dt><dd>${here ? '—' : `${poi.dist} 里`}</dd></div>
        <div><dt>预计耗时</dt><dd>${here ? '—' : this._fmtDuration(poi.seconds)}</dd></div>
        <div><dt>行动力</dt><dd>${here ? '—' : `⚡ ${poi.ap}`}</dd></div>
      </dl>
      <p class="wp-note">${this._poiDesc(poi.type)}</p>
      <div class="wp-actions">
        <button class="btn btn-primary" data-act="poi-depart" ${here ? 'disabled' : ''}>${here ? '已在此地' : '启 程 前 往'}</button>
        <button class="btn btn-ghost" data-act="poi-enter" ${here ? '' : 'disabled'}>进 入 ${poi.typeCn}</button>
      </div>
    `;
    box.querySelector('[data-act="poi-depart"]')?.addEventListener('click', () => this.bus.emit('ui:poi-depart', poi.id));
    box.querySelector('[data-act="poi-enter"]')?.addEventListener('click', () => this.bus.emit('ui:poi-open'));
  }

  _poiDesc(type) {
    if (type === 'restaurant') return '餐厅:可花金币用餐恢复行动力,也可购买干粮随身携带。';
    if (type === 'hotel') return '酒店:提供多种房型休息(恢复效果与耗时各异),并可在此更换服饰。';
    if (type === 'market') return '商市:汇集武器商、防具商与药商,按职业提供各式装备。';
    return '';
  }

  // ===== 旅途(实时行进) =====
  /** 每段旅途开始时叫一次:把提示洗牌,从头轮换 */
  resetTravelTips() {
    this._tips = [...TRAVEL_TIPS];
    for (let i = this._tips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._tips[i], this._tips[j]] = [this._tips[j], this._tips[i]];
    }
    this._tipIndex = -1;
  }

  /** 按已行进的时间轮换提示(每 TIP_INTERVAL_SEC 秒一条) */
  _renderTravelTip(snap) {
    if (!this.el.travelTip) return;
    if (!this._tips || !this._tips.length) { this.el.travelTip.textContent = ''; return; }
    const elapsed = Math.max(0, (snap.totalSec || 0) - (snap.remainSec || 0));
    const idx = Math.floor(elapsed / TIP_INTERVAL_SEC);
    if (idx !== this._tipIndex) {
      this._tipIndex = idx;
      this.el.travelTip.textContent = this._tips[idx % this._tips.length];
      this.el.travelTip.classList.remove('is-fresh');
      void this.el.travelTip.offsetWidth;
      this.el.travelTip.classList.add('is-fresh');
    }
  }

  renderTravel(snap) {
    if (!snap) return;
    const isRest = snap.mode === 'rest';
    if (this.el.travelCard) this.el.travelCard.classList.toggle('is-rest', isRest);
    if (this.el.travelEyebrow) this.el.travelEyebrow.textContent = isRest ? '休 息 中' : '旅 途 中';
    if (this.el.travelFrom) this.el.travelFrom.textContent = snap.fromLabel || '—';
    if (this.el.travelTo) this.el.travelTo.textContent = snap.toLabel || '—';
    if (this.el.travelBar) this.el.travelBar.style.width = `${Math.round((snap.pct || 0) * 100)}%`;
    if (this.el.travelRemain) {
      this.el.travelRemain.textContent = snap.paused
        ? `${isRest ? '被惊扰!' : '遭遇!'}已暂停 —— 还剩约 ${this._fmtDuration(snap.remainSec)}`
        : `还剩约 ${this._fmtDuration(snap.remainSec)}`;
    }
    if (this.el.travelNote) {
      if (isRest) {
        this.el.travelNote.textContent = `在「${snap.fromLabel}」歇脚 · 共 ${this._fmtDuration(snap.totalSec)} · 期间无法行动,或有怪物与意外之喜`;
      } else {
        const veh = snap.vehicle ? `载具:${snap.vehicle}` : '徒步';
        const terrain = TERRAIN_CN[snap.terrain] ? `${TERRAIN_CN[snap.terrain]} · ` : '';
        this.el.travelNote.textContent = `全程 ${snap.dist} 里 · 预计 ${this._fmtDuration(snap.totalSec)} · ${veh} · 途经 ${terrain}Lv.${snap.level} 地带`;
      }
    }
    this._renderTravelTip(snap);
    if (this.el.travelLog) {
      this.el.travelLog.innerHTML = (snap.log || []).map((t) => `<div class="tl-line">${this._escapeHtml(t)}</div>`).join('');
    }
  }

  // ===== NPC 对话 =====
  /** 渲染交谈框:对话记录(玩家/NPC 交替) + 玩家可选话题 */
  showNpcDialog(npc, opts = {}) {
    const box = this.el.npcDialog;
    if (!box || !npc) return;
    if (this.el.npcTitle) this.el.npcTitle.textContent = opts.title || '交 谈';
    if (this.el.npcName) this.el.npcName.textContent = npc.name || '路人';
    if (this.el.npcTag) this.el.npcTag.textContent = npc.tag || '';
    if (this.el.npcLines) {
      const transcript = opts.transcript || [];
      this.el.npcLines.innerHTML = transcript.length
        ? transcript.map((t) => (t.who === 'player'
          ? `<p class="npc-said-player">「${this._escapeHtml(t.text)}」</p>`
          : `<p class="npc-line">「${this._escapeHtml(t.text)}」</p>`)).join('')
        : '<p class="npc-hint">你想说点什么?</p>';
      this.el.npcLines.scrollTop = this.el.npcLines.scrollHeight;
    }
    if (this.el.npcTopics) {
      this.el.npcTopics.innerHTML = '';
      (opts.topics || []).forEach((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'npc-topic';
        b.textContent = t.label;
        b.addEventListener('click', () => this.bus.emit('ui:npc-topic', t.id));
        this.el.npcTopics.appendChild(b);
      });
      // NPC 任务按钮(支线触发):有 quest 且未完成时显示接受按钮;
      // 已完成(doneFlag)则显示「任务已完成」灰字,不可点击。
      const q = opts.quest;
      if (q) {
        if (q.done) {
          const span = document.createElement('p');
          span.className = 'npc-quest-done';
          span.textContent = '任务已完成';
          this.el.npcTopics.appendChild(span);
        } else {
          if (q.text) {
            const lead = document.createElement('p');
            lead.className = 'npc-quest-text';
            lead.textContent = q.text;
            this.el.npcTopics.appendChild(lead);
          }
          const qb = document.createElement('button');
          qb.type = 'button';
          qb.className = 'npc-topic npc-quest-btn';
          qb.textContent = q.accept || '接受任务';
          qb.addEventListener('click', () => this.bus.emit('ui:npc-quest', {
            sideChapter: q.sideChapter,
            doneFlag: q.doneFlag,
          }));
          this.el.npcTopics.appendChild(qb);
        }
      }
    }
    if (this.el.npcHint) this.el.npcHint.textContent = opts.hint || '';
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    this._npcOpen = true;
  }

  closeNpcDialog() {
    const box = this.el.npcDialog;
    this._npcOpen = false;
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!this._npcOpen) box.hidden = true; }, 200);
  }

  // ===== 新手引导 =====
  openTutorial() {
    const box = this.el.tutorial;
    if (!box) return;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    this._tutorialOpen = true;
  }

  closeTutorial() {
    const box = this.el.tutorial;
    this._tutorialOpen = false;
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!this._tutorialOpen) box.hidden = true; }, 200);
  }

  // ===== 宝箱(密码开箱) =====
  /** 打开宝箱弹窗。info: { opened, hintText } */
  showChest(chest, info = {}) {
    const box = this.el.chestDialog;
    if (!box || !chest) return;
    this._chestId = chest.id;
    if (this.el.chestTitle) this.el.chestTitle.textContent = info.opened ? '宝 箱 · 已 开 启' : '上 锁 的 宝 箱';
    if (this.el.chestName) this.el.chestName.textContent = chest.name;
    if (this.el.chestHint) {
      this.el.chestHint.textContent = info.opened
        ? '箱盖敞着,里面已经空了。'
        : (info.hintText
          ? `你记得的线索:${info.hintText}`
          : '锁面上刻着三个数字的凹槽。你还不知道密码 —— 找本地人「问问传闻」试试。');
    }
    if (this.el.chestInput) {
      this.el.chestInput.value = '';
      this.el.chestInput.disabled = !!info.opened;
    }
    if (this.el.btnChestOpen) this.el.btnChestOpen.disabled = !!info.opened;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    this._chestOpen = true;
    if (!info.opened && this.el.chestInput) setTimeout(() => this.el.chestInput.focus(), 120);
  }

  closeChest() {
    const box = this.el.chestDialog;
    this._chestOpen = false;
    this._chestId = null;
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!this._chestOpen) box.hidden = true; }, 200);
  }

  /** 提交输入框中的密码 */
  _submitChest() {
    const code = this.el.chestInput ? this.el.chestInput.value : '';
    this.bus.emit('ui:chest-submit', { id: this._chestId, code });
  }

  // ===== 记忆之书 · 剧情简介弹窗 =====
  /**
   * 展示跳过某大章后的剧情简介与所得奖励。
   * @param {{chapter:number,title:string,summary:string,rewards:object,onConfirm:function}} info
   */
  showStorySummary(info) {
    const box = this.el.storySummary;
    if (!box) { if (info.onConfirm) info.onConfirm(); return; }
    this._summaryOnConfirm = info.onConfirm || null;
    if (this.el.summaryChapter) this.el.summaryChapter.textContent = `第 ${info.chapter} 章 · ${info.title || ''}`;
    if (this.el.summaryText) this.el.summaryText.textContent = info.summary || '';
    if (this.el.summaryRewards && info.rewards) {
      const labels = { courage: '勇气', reason: '理性', mercy: '悲悯', wild: '野性' };
      const parts = Object.entries(info.rewards)
        .filter(([, v]) => v)
        .map(([k, v]) => `${labels[k] || k} +${v}`);
      this.el.summaryRewards.innerHTML = parts.length
        ? `<span class="summary-rewards-label">本章奖励:</span> ${parts.join('　')}`
        : '';
    }
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    this._summaryOpen = true;
  }

  _closeStorySummary() {
    const box = this.el.storySummary;
    this._summaryOpen = false;
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!this._summaryOpen) box.hidden = true; }, 200);
  }

  _confirmStorySummary() {
    const cb = this._summaryOnConfirm;
    this._summaryOnConfirm = null;
    this._closeStorySummary();
    if (cb) cb();
  }

  // ===== 情报(已知的宝箱密码与位置) =====
  /** list: [{ name, chapter, place, password, opened }], total: 全部宝箱数 */
  showIntel(list, total = 0, clues = []) {
    const box = this.el.intel;
    if (!box) return;
    if (this.el.intelNote) {
      this.el.intelNote.textContent = (list.length || clues.length)
        ? `已记下宝箱情报 ${list.length} / ${total} 条、剧情线索 ${clues.length} 条。`
        : '你还没有任何情报。遇见本地人时选「问问传闻」,或许有人知道些什么。';
    }
    if (this.el.intelList) {
      this.el.intelList.innerHTML = '';
      clues.forEach((c) => {
        const row = document.createElement('div');
        row.className = 'intel-row is-clue';
        row.innerHTML = `
          <div class="intel-head">
            <span class="intel-name">剧情线索</span>
            <span class="intel-chapter">${this._escapeHtml(c.from || '')}</span>
            <span class="intel-state">已记下</span>
          </div>
          <div class="intel-place">${this._escapeHtml(c.text || '')}</div>
        `;
        this.el.intelList.appendChild(row);
      });
      list.forEach((it) => {
        const row = document.createElement('div');
        row.className = `intel-row${it.opened ? ' is-opened' : ''}`;
        row.innerHTML = `
          <div class="intel-head">
            <span class="intel-name">${this._escapeHtml(it.name)}</span>
            <span class="intel-chapter">第${it.chapter}章</span>
            <span class="intel-state">${it.opened ? '已开启' : '未开启'}</span>
          </div>
          <div class="intel-place">位置:${this._escapeHtml(it.place)}</div>
          <div class="intel-code">密码:<b>${this._escapeHtml(it.password)}</b></div>
        `;
        this.el.intelList.appendChild(row);
      });
    }
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    this._intelOpen = true;
  }

  closeIntel() {
    const box = this.el.intel;
    this._intelOpen = false;
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!this._intelOpen) box.hidden = true; }, 200);
  }

  // ===== 交易分类导航(左:分类 / 右:货物)=====
  /** 渲染左侧分类导航 */
  _renderTradeNav(navEl, cats, activeKey, onPick) {
    if (!navEl) return;
    navEl.innerHTML = '';
    cats.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `trade-cat${c.key === activeKey ? ' is-active' : ''}`;
      b.innerHTML = `<span class="trade-cat-label">${c.icon ? `${c.icon} ` : ''}${this._escapeHtml(c.label)}</span><span class="trade-cat-count">${c.count}</span>`;
      b.addEventListener('click', () => onPick(c.key));
      navEl.appendChild(b);
    });
  }

  /** 涨跌标记 */
  _trendTag(trend) {
    if (!Number.isFinite(trend)) return '';
    if (trend > 1.05) return '<span class="trend is-up">▲涨</span>';
    if (trend < 0.95) return '<span class="trend is-down">▼跌</span>';
    return '<span class="trend is-flat">—平</span>';
  }

  // ===== 商店 =====
  renderShop({ stock, pets = [], sellPets = [], economy, fee = 0.03, priceMul = 1, isCity = false }) {
    const box = this.el.shopList;
    if (!box) return;
    const nav = this.el.shopCats;
    if (this.el.shopNote) {
      const cityNote = isCity ? ' · 主城货全价低' : '';
      this.el.shopNote.textContent = `买入所需,卖出冗余(手续费 ${Math.round(fee * 100)}%)${cityNote}`;
    }
    const disc = economy.shopDiscount ? economy.shopDiscount() : 0;

    const byCat = new Map();
    (stock || []).forEach((id) => {
      const it = ITEMS[id];
      if (!it) return;
      const k = it.category || 'misc';
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k).push(id);
    });
    // 镶嵌过宝石的武器 / 防具只在市场流通,不在普通商店回收
    const sellables = [...economy.bag.entries()]
      .filter(([id]) => !economy.isEquipped(id) && isTradeable(id) && !(ITEMS[id]?.gems?.length));

    const cats = [...byCat.entries()].map(([key, ids]) => ({
      key, label: ITEM_CATEGORY_CN[key] || key, count: ids.length,
    }));
    if (sellables.length || sellPets.length) cats.push({ key: '__sell', label: '出售(背包)', icon: '🪙', count: sellables.length + sellPets.length });

    if (!cats.length) {
      if (nav) nav.innerHTML = '';
      box.innerHTML = '<p class="bag-empty">此店暂无货品。</p>';
      this.renderResources(economy);
      return;
    }
    if (!cats.some((c) => c.key === this._shopCat)) this._shopCat = cats[0].key;

    const q = (this._shopQuery || '').trim().toLowerCase();
    const buyRow = (id) => {
      const it = ITEMS[id];
      if (!it) return null;
      const price = Math.max(1, Math.round((economy.itemPrice ? economy.itemPrice(id) : it.price) * priceMul));
      const afford = economy.gold >= price;
      const priceTxt = (disc > 0 || priceMul !== 1) && price < it.price
        ? `🪙 ${price} <s class="item-was">${it.price}</s>`
        : `🪙 ${price}`;
      const tag = `${it.rare ? '<span class="item-tag-rare">★绝世</span>' : ''}${this._gradeTag(it)}`;
      return this._shopRow(it, afford, priceTxt, '买入', 'data-buy', () => this.bus.emit('ui:shop-buy', id), 0, tag);
    };

    const draw = () => {
      this._renderTradeNav(nav, cats, this._shopCat, (k) => { this._shopCat = k; draw(); });
      box.innerHTML = '';
      if (disc > 0) {
        const note = document.createElement('div');
        note.className = 'shop-section-title';
        note.textContent = `服饰折扣生效:全场 ${Math.round(disc * 100)}% off`;
        box.appendChild(note);
      }
      // 输入关键词时跨分类检索全店
      if (q) {
        const hits = (stock || []).filter((id) => this._matchItem(id, q));
        const title = document.createElement('div');
        title.className = 'shop-section-title';
        title.textContent = `搜索「${this._shopQuery.trim()}」:${hits.length} 条`;
        box.appendChild(title);
        if (!hits.length) box.insertAdjacentHTML('beforeend', '<p class="bag-empty">没有找到相符的货物。</p>');
        hits.forEach((id) => { const r = buyRow(id); if (r) box.appendChild(r); });
        return;
      }
      if (this._shopCat === '__sell') {
        sellables.forEach(([id, qty]) => {
          const it = ITEMS[id];
          if (!it) return;
          box.appendChild(this._shopRow(it, true, `🪙 ${sellPrice(id)}`, '卖出', 'data-sell', () => this.bus.emit('ui:shop-sell', id), qty, this._gradeTag(it)));
        });
        // 宠物也能卖回给商店(仅常规宠物)
        if (sellPets.length) {
          const t = document.createElement('div');
          t.className = 'shop-section-title';
          t.textContent = '送走宠物(仅常规宠物可卖)';
          box.appendChild(t);
          sellPets.forEach((p) => box.appendChild(this._petRow(p, `🪙 ${Math.max(1, Math.round(p.sell * (1 - fee)))}`, '送走', 'data-sell', 'ui:shop-sell-pet', p.count)));
        }
        if (!sellables.length && !sellPets.length) box.innerHTML = '<p class="bag-empty">背包里没有可出售的物品。</p>';
      } else {
        (byCat.get(this._shopCat) || []).forEach((id) => { const r = buyRow(id); if (r) box.appendChild(r); });
        // 本店随机上架的宠物(常规)
        if (pets.length) {
          const t = document.createElement('div');
          t.className = 'shop-section-title';
          t.textContent = '宠物(本店随机上架 · 常规)';
          box.appendChild(t);
          pets.forEach((p) => {
            const price = Math.max(1, Math.round(p.price * priceMul * (1 + fee)));
            box.appendChild(this._petRow(p, `🪙 ${price}`, '领养', 'data-buy', 'ui:shop-buy-pet', 0, economy.gold >= price));
          });
        }
      }
    };
    this._shopData = { stock, pets, sellPets, economy, fee, priceMul, isCity };
    draw();
    this.renderResources(economy);
  }

  /** 物品分类标签(防具额外标出部位) */
  _catLabel(it) {
    const c = ITEM_CATEGORY_CN[it.category] || '';
    if (it.category === 'armor' && it.armorSlot) return `${c}·${ARMOR_SLOT_CN[it.armorSlot] || ''}`;
    return c;
  }

  /** 品级标签(仅武器 / 防具) */
  _gradeTag(it) {
    const g = gradeOf(it);
    if (!g) return '';
    return `<span class="item-grade" style="--grade:${g.color}">${g.name}</span>`;
  }

  /** 搜索匹配:名称 / 分类(含防具部位) / 品级 / 等级 / 描述 */
  _matchItem(id, q) {
    if (!q) return true;
    const it = ITEMS[id];
    if (!it) return false;
    const g = gradeOf(it);
    const hay = [
      it.name,
      ITEM_CATEGORY_CN[it.category] || '',
      this._catLabel(it),
      g ? g.name : '',
      it.level ? `lv.${it.level} ${it.level}级` : '',
      it.desc || '',
    ].join(' ').toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  /** 背包分类栏(带各类数量,点选即筛选) */
  _renderBagFilters(all, q) {
    const nav = this.el.bagFilters;
    if (!nav) return;
    const cur = this._bagTab || 'all';
    nav.innerHTML = '';
    for (const t of BAG_TABS) {
      const n = all.filter(([id]) => t.match(ITEMS[id]) && (!q || this._matchItem(id, q))).length;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `bag-filter${t.key === cur ? ' is-active' : ''}`;
      b.innerHTML = `${t.label}<i>${n}</i>`;
      b.addEventListener('click', () => { this._bagTab = t.key; if (this._bagData) this.renderBag(this._bagData); });
      nav.appendChild(b);
    }
  }

  /** 宠物行(宠物不在 ITEMS 中,单独渲染;带技能说明) */
  _petRow(p, priceTxt, btnTxt, attr, evt, qty = 0, enabled = true) {
    return this._shopRow(
      { ...p, desc: `${p.desc || ''}${p.skill ? ` 技能:${p.skill}。` : ''}` },
      enabled, priceTxt, btnTxt, attr, () => this.bus.emit(evt, p.id), qty,
      `<span class="item-cat">宠物 · ${this._escapeHtml(p.rarity || '')}</span>`,
    );
  }

  _shopRow(it, enabled, priceTxt, btnTxt, attr, onClick, qty = 0, tag = '') {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div class="item-icon">${it.icon || '📦'}</div>
      <div class="item-body">
        <div class="item-name">${this._escapeHtml(it.name)}${qty > 1 ? ` <span class="item-qty">×${qty}</span>` : ''}<span class="item-cat">${this._catLabel(it)}</span>${tag}</div>
        <div class="item-desc">${this._escapeHtml(it.desc || '')}</div>
      </div>
      <div class="item-actions">
        <span class="item-price${enabled ? '' : ' is-poor'}">${priceTxt}</span>
        <button class="btn btn-primary btn-sm" ${attr} ${enabled ? '' : 'disabled'}>${btnTxt}</button>
      </div>
    `;
    const btn = row.querySelector(`[${attr}]`);
    if (btn && enabled) btn.addEventListener('click', onClick);
    return row;
  }

  // ===== 市场(玩家集市:多商家 + 宝石 + 镶嵌武器 + 玩家货架) =====
  renderMarket(data = {}) {
    const {
      stalls, wares = [], gems = [], pets = [], sellPets = [], listings = [], economy,
      fee = 0, festival = false, trade = null,
      shelfCount = 0, shelfMax = 0, shelfCost = -1, nextTickMs = 0, sellFloor = 0.45,
    } = data;
    const box = this.el.marketList;
    if (!box) return;
    const nav = this.el.marketCats;
    if (this.el.marketTitle) this.el.marketTitle.textContent = '市 场';
    if (this.el.marketNote) {
      const mins = Math.max(0, Math.round(nextTickMs / 60000));
      const festNote = festival ? ' · 节日手续费全免' : '';
      this.el.marketNote.textContent = `全品类玩家集市 · 每笔交易管理费 ${Math.round(fee * 100)}%${festNote} · 价格每 5 小时浮动(约 ${mins} 分钟后刷新)`;
    }

    // 汇总各商家的货物(带摊主信息)
    const byCat = new Map();
    (stalls || []).forEach((s) => {
      (s.items || []).forEach((id) => {
        const it = ITEMS[id];
        if (!it) return;
        const k = it.category || 'misc';
        if (!byCat.has(k)) byCat.set(k, []);
        byCat.get(k).push({ id, seller: s });
      });
    });
    const sellables = [...economy.bag.entries()].filter(([id]) => !economy.isEquipped(id) && isTradeable(id));

    const cats = [...byCat.entries()].map(([key, arr]) => ({ key, label: ITEM_CATEGORY_CN[key] || key, count: arr.length }));
    if (gems.length) cats.push({ key: '__gem', label: '宝石', icon: '💎', count: gems.length });
    if (wares.length) cats.push({ key: '__ware', label: '镶嵌装备', icon: '🛠️', count: wares.length });
    if (pets.length) cats.push({ key: '__pet', label: '宠物摊', icon: '🐾', count: pets.length });
    cats.push({ key: '__shelf', label: '我的货架', icon: '🧺', count: listings.length });
    if (sellables.length || sellPets.length) cats.push({ key: '__sell', label: '出售(背包)', icon: '🪙', count: sellables.length + sellPets.length });

    if (!cats.some((c) => c.key === this._marketCat)) this._marketCat = cats[0].key;

    const q = (this._marketQuery || '').trim().toLowerCase();
    const draw = () => {
      this._renderTradeNav(nav, cats, this._marketCat, (k) => { this._marketCat = k; draw(); });
      box.innerHTML = '';
      // 输入关键词时跨分类检索全场货物
      if (q) {
        const hits = [];
        byCat.forEach((arr) => arr.forEach((e) => { if (this._matchItem(e.id, q)) hits.push(e); }));
        const title = document.createElement('div');
        title.className = 'shop-section-title';
        title.textContent = `搜索「${this._marketQuery.trim()}」:${hits.length} 条`;
        box.appendChild(title);
        if (!hits.length) box.insertAdjacentHTML('beforeend', '<p class="bag-empty">没有找到相符的货物。</p>');
        hits.forEach(({ id, seller }) => {
          const it = ITEMS[id];
          if (!it) return;
          const price = trade ? trade.marketBuyPrice(id, fee) : it.price;
          const trend = trade ? trade.priceTrend(id) : 1;
          const afford = economy.gold >= price;
          const tag = `<span class="item-cat">${this._escapeHtml(seller?.name || '')}</span>${this._gradeTag(it)}`;
          box.appendChild(this._shopRow(it, afford, `🪙 ${price}${this._trendTag(trend)}<s class="item-was">${it.price}</s>`, '买入', 'data-buy', () => this.bus.emit('ui:market-buy', id), 0, tag));
        });
        return;
      }
      const key = this._marketCat;
      if (key === '__gem') this._renderMarketGems(box, gems, economy, fee);
      else if (key === '__ware') this._renderMarketWares(box, wares, economy);
      else if (key === '__pet') this._renderMarketPets(box, pets, economy, fee);
      else if (key === '__shelf') this._renderMarketShelf(box, { economy, trade, fee, listings, shelfCount, shelfMax, shelfCost, sellFloor });
      else if (key === '__sell') this._renderMarketSell(box, economy, fee, 'ui:market-sell', trade, sellPets);
      else {
        (byCat.get(key) || []).forEach(({ id, seller }) => {
          const it = ITEMS[id];
          if (!it) return;
          const price = trade ? trade.marketBuyPrice(id, fee) : it.price;
          const trend = trade ? trade.priceTrend(id) : 1;
          const afford = economy.gold >= price;
          const tag = `<span class="item-cat">${this._escapeHtml(seller?.name || '')}</span>${this._gradeTag(it)}`;
          box.appendChild(this._shopRow(it, afford, `🪙 ${price}${this._trendTag(trend)}<s class="item-was">${it.price}</s>`, '买入', 'data-buy', () => this.bus.emit('ui:market-buy', id), 0, tag));
        });
      }
    };
    this._marketData = data;
    draw();
    this.renderResources(economy);
  }

  /** 市场:宝石摊(可自由买卖,随市场浮动定价) */
  _renderMarketGems(box, gems, economy, fee) {
    const head = document.createElement('div');
    head.className = 'market-stall-head';
    head.innerHTML = '<span class="stall-icon">💎</span><span class="stall-name">「琅嬛」</span><span class="stall-title">宝石商人</span>';
    box.appendChild(head);
    gems.forEach((g) => {
      const it = ITEMS[g.id] || g;
      const avg = Number.isFinite(g.price) ? g.price : (it.price || 0);
      const price = Math.max(1, Math.round(avg * (1 + fee)));
      const afford = economy.gold >= price;
      const eff = GEM_EFFECT[it.gem] || {};
      const effTxt = Object.entries(eff).map(([k, v]) => `${GEM_STAT_CN[k] || k} +${v}`).join(' · ');
      const tag = `<span class="item-cat">${this._escapeHtml(effTxt)}</span>`;
      box.appendChild(this._shopRow(it, afford, `🪙 ${price}${this._trendTag(g.trend)}<s class="item-was">均价 ${avg}</s>`, '买入', 'data-buy', () => this.bus.emit('ui:market-buy-gem', g.id), 0, tag));
    });
  }

  /** 市场:镶嵌武器摊(能力越强价格越高) */
  _renderMarketWares(box, wares, economy) {
    const head = document.createElement('div');
    head.className = 'market-stall-head';
    head.innerHTML = '<span class="stall-icon">🛠️</span><span class="stall-name">「霜刃」</span><span class="stall-title">镶嵌铺(武器 · 防具)</span>';
    box.appendChild(head);
    wares.forEach((w) => {
      const def = w.def;
      const afford = economy.gold >= w.price;
      const gems = (def.gems || []).map((gid) => ITEMS[gid]?.name || gid).join('、');
      const kind = def.category === 'armor' ? `镶嵌防具·${ARMOR_SLOT_CN[def.armorSlot] || ''}` : '镶嵌武器';
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="item-icon">${def.icon || '🗡️'}</div>
        <div class="item-body">
          <div class="item-name">${this._escapeHtml(def.name)}<span class="item-cat">${kind}</span>${this._gradeTag(def)}</div>
          <div class="item-desc">${this._escapeHtml(def.desc || '')}</div>
          <div class="item-sub">镶嵌:${this._escapeHtml(gems || '无')}</div>
        </div>
        <div class="item-actions">
          <span class="item-price${afford ? '' : ' is-poor'}">🪙 ${w.price}</span>
          <button class="btn btn-primary btn-sm" data-buy ${afford ? '' : 'disabled'}>买入</button>
        </div>`;
      if (afford) row.querySelector('[data-buy]')?.addEventListener('click', () => this.bus.emit('ui:market-buy-ware', w.key));
      box.appendChild(row);
    });
  }

  /** 市场:宠物摊(常规常驻;稀有/神话概率出现) */
  _renderMarketPets(box, pets, economy, fee) {
    const head = document.createElement('div');
    head.className = 'market-stall-head';
    head.innerHTML = '<span class="stall-icon">🐾</span><span class="stall-name">「阿禾」</span><span class="stall-title">驯兽人 · 宠物摊</span>';
    box.appendChild(head);
    pets.forEach((p) => {
      const price = Math.max(1, Math.round(p.price * (1 + fee)));
      const afford = economy.gold >= price;
      const tag = `<span class="item-cat">${this._escapeHtml(p.rarity)}</span>`;
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="item-icon">${p.icon}</div>
        <div class="item-body">
          <div class="item-name">${this._escapeHtml(p.name)}${tag}</div>
          <div class="item-desc">${this._escapeHtml(p.desc || '')}</div>
          <div class="item-sub">技能:${this._escapeHtml(p.skill || '无')}</div>
        </div>
        <div class="item-actions">
          <span class="item-price${afford ? '' : ' is-poor'}">🪙 ${price}</span>
          <button class="btn btn-primary btn-sm" data-buy ${afford ? '' : 'disabled'}>买入</button>
        </div>`;
      if (afford) row.querySelector('[data-buy]')?.addEventListener('click', () => this.bus.emit('ui:market-buy-pet', p.id));
      box.appendChild(row);
    });
  }

  /** 市场:玩家货架(自定义挂售价,低于均价约 45% 会被秒卖) */
  _renderMarketShelf(box, { economy, trade, fee, listings, shelfCount, shelfMax, shelfCost, sellFloor }) {
    const head = document.createElement('div');
    head.className = 'shelf-head';
    const full = shelfCount >= shelfMax;
    const affordExpand = shelfCost >= 0 && economy.gold >= shelfCost;
    head.innerHTML = `<span class="shelf-count">货架 ${listings.length} / ${shelfCount}(上限 ${shelfMax})</span>
      <span class="shelf-hint">挂售价 ≤ 当前均价 × 约 ${Math.round(sellFloor * 100)}% 即被秒卖</span>
      <button class="btn btn-ghost btn-sm" data-expand ${full || !affordExpand ? 'disabled' : ''}>开通货架 ×1${shelfCost >= 0 ? `(🪙 ${shelfCost})` : ''}</button>`;
    head.querySelector('[data-expand]')?.addEventListener('click', () => this.bus.emit('ui:market-expand-shelf'));
    box.appendChild(head);

    // 现有挂单
    if (listings.length) {
      const title = document.createElement('div');
      title.className = 'shop-section-title';
      title.textContent = '已上架';
      box.appendChild(title);
      listings.forEach((l) => {
        const it = ITEMS[l.itemId];
        if (!it) return;
        const avg = trade ? trade.marketAvg(l.itemId) : (it.price || 0);
        const thr = trade ? trade.trySellListing(l.itemId, l.price, fee).threshold : Math.round(avg * sellFloor);
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
          <div class="item-icon">${it.icon || '📦'}</div>
          <div class="item-body">
            <div class="item-name">${this._escapeHtml(it.name)}<span class="item-cat">在售</span></div>
            <div class="item-desc">挂售价 🪙 ${l.price} · 均价 🪙 ${avg} · 秒卖线 🪙 ${thr}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-ghost btn-sm" data-cancel>撤下</button>
          </div>`;
        row.querySelector('[data-cancel]')?.addEventListener('click', () => this.bus.emit('ui:market-cancel', l.id));
        box.appendChild(row);
      });
    }

    // 上架表单
    const title = document.createElement('div');
    title.className = 'shop-section-title';
    title.textContent = '上架物品(自定义价格)';
    box.appendChild(title);
    const sellables = [...economy.bag.entries()].filter(([id]) => !economy.isEquipped(id) && isTradeable(id));
    if (!sellables.length) {
      box.innerHTML += '<p class="bag-empty">背包里没有可上架的物品。</p>';
      return;
    }
    sellables.forEach(([id, qty]) => {
      const it = ITEMS[id];
      if (!it) return;
      const avg = trade ? trade.marketAvg(id) : (it.price || 0);
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="item-icon">${it.icon || '📦'}</div>
        <div class="item-body">
          <div class="item-name">${this._escapeHtml(it.name)}${qty > 1 ? ` <span class="item-qty">×${qty}</span>` : ''}<span class="item-cat">${this._catLabel(it)}</span>${this._gradeTag(it)}</div>
          <div class="item-desc">当前均价 🪙 ${avg}</div>
        </div>
        <div class="item-actions">
          <input class="shelf-price-input" type="number" min="1" value="${avg}" aria-label="挂售价格" />
          <button class="btn btn-primary btn-sm" data-list>上架</button>
        </div>`;
      const input = row.querySelector('.shelf-price-input');
      row.querySelector('[data-list]')?.addEventListener('click', () => {
        const price = Math.max(1, Math.round(Number(input.value) || avg));
        this.bus.emit('ui:market-list', { itemId: id, price });
      });
      box.appendChild(row);
    });
  }

  /** 市场 / 密市共用的「出售(背包)」区块(即时成交) */
  _renderMarketSell(box, economy, fee, evt, trade = null, sellPets = []) {
    const sellables = [...economy.bag.entries()]
      .filter(([id]) => !economy.isEquipped(id) && isTradeable(id));
    const title = document.createElement('div');
    title.className = 'shop-section-title';
    title.textContent = '即时出售(按均价 50% 收购,扣管理费)';
    box.appendChild(title);
    if (!sellables.length && !sellPets.length) {
      const empty = document.createElement('p');
      empty.className = 'bag-empty';
      empty.textContent = '背包里没有可出售的物品。';
      box.appendChild(empty);
      return;
    }
    sellables.forEach(([id, qty]) => {
      const it = ITEMS[id];
      if (!it) return;
      const avg = trade ? trade.marketAvg(id) : sellPrice(id) * 2;
      const net = trade ? trade.marketSellNet(id, fee) : sellPrice(id);
      box.appendChild(this._shopRow(it, true, `🪙 ${net}<s class="item-was">均价 ${avg}</s>`, '卖出', 'data-sell', () => this.bus.emit(evt, id), qty, this._gradeTag(it)));
    });
    // 宠物(仅常规宠物可在市场卖掉)
    if (sellPets.length) {
      const t = document.createElement('div');
      t.className = 'shop-section-title';
      t.textContent = '送走宠物(仅常规宠物可卖)';
      box.appendChild(t);
      sellPets.forEach((p) => box.appendChild(this._petRow(
        p, `🪙 ${Math.max(1, Math.round(p.sell * (1 - fee)))}<s class="item-was">原价 ${p.price}</s>`,
        '送走', 'data-sell', 'ui:market-sell-pet', p.count,
      )));
    }
  }

  // ===== 专属交易场所(只收当地主题的特殊交易币) =====
  renderVenue({ venue, economy }) {
    const box = this.el.marketList;
    if (!box || !venue) return;
    box.innerHTML = '';
    if (this.el.marketCats) this.el.marketCats.innerHTML = '';
    const feePct = Math.round(venue.fee * 100);
    if (this.el.marketTitle) this.el.marketTitle.textContent = '密 市';
    if (this.el.marketNote) {
      this.el.marketNote.textContent = `${venue.tokenIcon} 只收「${venue.tokenName}」(现有 ${economy.count(venue.token)} 枚) · 管理费 ${feePct}%`;
    }

    const note = document.createElement('div');
    note.className = 'market-venue-note';
    note.textContent = `隐秘集市不认金币,交易一律用 ${venue.tokenIcon}${venue.tokenName};这里的货架还会偶尔摆出绝世稀有之物。`;
    box.appendChild(note);

    (venue.stock || []).forEach((id) => {
      const it = ITEMS[id];
      if (!it) return;
      const price = economy.venuePrice(id, venue.fee);
      const afford = economy.count(venue.token) >= price;
      const tag = it.rare ? '<span class="item-rare">绝世稀有</span>' : '';
      const row = this._shopRow(it, afford, `${venue.tokenIcon} ${price}`, '兑换', 'data-buy', () => this.bus.emit('ui:venue-buy', id), 0, tag);
      if (it.rare) row.classList.add('is-rare');
      box.appendChild(row);
    });

    this.renderResources(economy);
  }

  // ===== POI:餐厅 =====
  renderRestaurant({ name, foods, economy }) {
    if (this.el.restaurantTitle) this.el.restaurantTitle.textContent = `🍲 ${name || '餐厅'}`;
    if (this.el.restaurantNote) this.el.restaurantNote.textContent = '用餐恢复行动力,也可购买干粮随身携带';
    const box = this.el.restaurantList;
    if (!box) return;
    box.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'shop-section-title';
    title.textContent = '购买食品';
    box.appendChild(title);
    (foods || []).forEach((it) => {
      const price = economy.itemPrice ? economy.itemPrice(it.id) : it.price;
      const afford = economy.gold >= price;
      box.appendChild(this._shopRow(it, afford, `🪙 ${price}`, '买入', 'data-buy', () => this.bus.emit('ui:restaurant-buy', it.id)));
    });
    this.renderResources(economy);
  }

  // ===== POI:酒店 =====
  renderHotel({ name, rooms, outfits, equipped, economy, recaps: recapsParam }) {
    if (this.el.hotelTitle) this.el.hotelTitle.textContent = `🏨 ${name || '酒店'}`;
    if (this.el.hotelNote) this.el.hotelNote.textContent = '选择房型休息恢复行动力,亦可在此更换服饰、回忆剧情、存放金币与道具';
    // 房型列表
    const box = this.el.hotelRooms;
    if (box) {
      box.innerHTML = '';
      const title = document.createElement('div');
      title.className = 'shop-section-title';
      title.textContent = '房型 · 休息';
      box.appendChild(title);
      (rooms || []).forEach((room) => {
        const afford = economy.gold >= room.gold;
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
          <div class="item-icon">🛏️</div>
          <div class="item-body">
            <div class="item-name">${this._escapeHtml(room.name)}<span class="item-cat">房型</span></div>
            <div class="item-desc">恢复 ${room.apRecover} 行动力${room.heal > 0 ? ` · 恢复 ${Math.round(room.heal * 100)}% 生命` : ''} · 耗时 ${room.seconds} 秒</div>
          </div>
          <div class="item-actions">
            <span class="item-price${afford ? '' : ' is-poor'}">🪙 ${room.gold}</span>
            <button class="btn btn-primary btn-sm" data-checkin ${afford ? '' : 'disabled'}>入住</button>
          </div>
        `;
        const btn = row.querySelector('[data-checkin]');
        if (btn && afford) btn.addEventListener('click', () => this.bus.emit('ui:hotel-checkin', room.id));
        box.appendChild(row);
      });
    }
    // 换装列表
    const obox = this.el.hotelOutfits;
    if (obox) {
      obox.innerHTML = '';
      const otitle = document.createElement('div');
      otitle.className = 'shop-section-title';
      otitle.textContent = '换装(仅限酒店)';
      obox.appendChild(otitle);
      const currentOutfit = equipped?.top;
      // 「卸下服饰」选项
      if (currentOutfit) {
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
          <div class="item-icon">👤</div>
          <div class="item-body">
            <div class="item-name">卸下当前服饰<span class="item-cat">换装</span></div>
            <div class="item-desc">恢复为朴素穿着</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-ghost btn-sm" data-unequip>卸下</button>
          </div>
        `;
        row.querySelector('[data-unequip]')?.addEventListener('click', () => this.bus.emit('ui:hotel-outfit', null));
        obox.appendChild(row);
      }
      (outfits || []).forEach((it) => {
        if (it.hide) return;
        const owned = economy.has(it.id);
        const isEquipped = currentOutfit === it.id;
        const afford = owned || economy.gold >= (it.price || 0);
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
          <div class="item-icon">${it.icon || '👕'}</div>
          <div class="item-body">
            <div class="item-name">${this._escapeHtml(it.name)}${isEquipped ? '<span class="item-cat">已穿</span>' : ''}${owned && !isEquipped ? '<span class="item-cat">已拥有</span>' : ''}</div>
            <div class="item-desc">${this._escapeHtml(it.desc || '')}</div>
          </div>
          <div class="item-actions">
            <span class="item-price${afford ? '' : ' is-poor'}">${owned ? '已有' : `🪙 ${it.price || 0}`}</span>
            <button class="btn btn-primary btn-sm" data-outfit ${afford && !isEquipped ? '' : 'disabled'}>${isEquipped ? '已穿' : '换装'}</button>
          </div>
        `;
        const btn = row.querySelector('[data-outfit]');
        if (btn && afford && !isEquipped) btn.addEventListener('click', () => this.bus.emit('ui:hotel-outfit', it.id));
        obox.appendChild(row);
      });
    }
    // ===== 回忆剧情 =====
    const rbox = this.el.hotelRecaps;
    if (rbox) {
      rbox.innerHTML = '';
      const recaps = (recapsParam || []).filter((r) => r.cleared);
      if (!recaps.length) {
        const empty = document.createElement('div');
        empty.className = 'item-row';
        empty.innerHTML = '<div class="item-desc" style="opacity:.6">尚无已通关的大章可回忆</div>';
        rbox.appendChild(empty);
      } else {
        recaps.forEach((r) => {
          const row = document.createElement('div');
          row.className = 'item-row';
          row.innerHTML = `
            <div class="item-icon">📖</div>
            <div class="item-body">
              <div class="item-name">${this._escapeHtml(r.no)} · ${this._escapeHtml(r.title)}</div>
              <div class="item-desc">${this._escapeHtml(r.recap)}</div>
            </div>
          `;
          rbox.appendChild(row);
        });
      }
    }
    // ===== 仓库(存放金币与道具)=====
    const sbox = this.el.hotelStorage;
    if (sbox) {
      sbox.innerHTML = '';
      // 金币存取
      const goldRow = document.createElement('div');
      goldRow.className = 'item-row';
      goldRow.innerHTML = `
        <div class="item-icon">🪙</div>
        <div class="item-body">
          <div class="item-name">金币<span class="item-cat">仓 ${economy.storageGold || 0}</span></div>
          <div class="item-desc">持有 ${economy.gold} · 仓 ${economy.storageGold || 0}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-ghost btn-sm" data-store-gold>存全部</button>
          <button class="btn btn-ghost btn-sm" data-withdraw-gold>取全部</button>
        </div>
      `;
      goldRow.querySelector('[data-store-gold]')?.addEventListener('click', () => this.bus.emit('ui:hotel-store-gold', economy.gold));
      goldRow.querySelector('[data-withdraw-gold]')?.addEventListener('click', () => this.bus.emit('ui:hotel-withdraw-gold', economy.storageGold || 0));
      sbox.appendChild(goldRow);
      // 背包物品 → 存入
      const bagEntries = [...economy.bag.entries()].filter(([id]) => ITEMS[id]);
      bagEntries.forEach(([id, qty]) => {
        const it = ITEMS[id];
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
          <div class="item-icon">${it.icon || '📦'}</div>
          <div class="item-body">
            <div class="item-name">${this._escapeHtml(it.name)}<span class="item-cat">×${qty}</span></div>
            <div class="item-desc">${this._escapeHtml(it.desc || it.category || '')}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-ghost btn-sm" data-store>存 1</button>
            <button class="btn btn-ghost btn-sm" data-store-all>全存</button>
          </div>
        `;
        row.querySelector('[data-store]')?.addEventListener('click', () => this.bus.emit('ui:hotel-store-item', id, 1));
        row.querySelector('[data-store-all]')?.addEventListener('click', () => this.bus.emit('ui:hotel-store-item', id, qty));
        sbox.appendChild(row);
      });
      // 仓库物品 → 取出
      const storageEntries = [...economy.storage.entries()].filter(([id]) => ITEMS[id]);
      storageEntries.forEach(([id, qty]) => {
        const it = ITEMS[id];
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
          <div class="item-icon">${it.icon || '📦'}</div>
          <div class="item-body">
            <div class="item-name">${this._escapeHtml(it.name)}<span class="item-cat">仓×${qty}</span></div>
            <div class="item-desc">${this._escapeHtml(it.desc || it.category || '')}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-ghost btn-sm" data-withdraw>取 1</button>
            <button class="btn btn-ghost btn-sm" data-withdraw-all>全取</button>
          </div>
        `;
        row.querySelector('[data-withdraw]')?.addEventListener('click', () => this.bus.emit('ui:hotel-withdraw-item', id, 1));
        row.querySelector('[data-withdraw-all]')?.addEventListener('click', () => this.bus.emit('ui:hotel-withdraw-item', id, qty));
        sbox.appendChild(row);
      });
    }
    this.renderResources(economy);
  }

  // ===== POI:商市 =====
  renderMarketPoi({ name, merchants, economy }) {
    if (this.el.marketpoiTitle) this.el.marketpoiTitle.textContent = `🏪 ${name || '商市'}`;
    if (this.el.marketpoiNote) this.el.marketpoiNote.textContent = '汇集武器商、防具商与药商,按职业提供各式装备';
    const box = this.el.marketpoiList;
    if (!box) return;
    box.innerHTML = '';
    (merchants || []).forEach((m) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="item-icon">${m.icon || '🏪'}</div>
        <div class="item-body">
          <div class="item-name">${this._escapeHtml(m.name)}<span class="item-cat">商人</span></div>
          <div class="item-desc">${this._escapeHtml(m.desc || '')}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-primary btn-sm" data-merchant>进 入</button>
        </div>
      `;
      row.querySelector('[data-merchant]')?.addEventListener('click', () => this.bus.emit('ui:market-poi-merchant', m.id));
      box.appendChild(row);
    });
    this.renderResources(economy);
  }

  // ===== POI:商人(武器 / 防具 / 药) =====
  renderMerchant({ title, icon, desc, items, economy, career }) {
    if (this.el.merchantTitle) this.el.merchantTitle.textContent = `${icon || '🏪'} ${title || '商人'}`;
    if (this.el.merchantNote) {
      const careerTxt = career ? ` · 当前职业:${career}` : '';
      this.el.merchantNote.textContent = (desc || '') + careerTxt;
    }
    const box = this.el.merchantList;
    if (!box) return;
    this._merchantData = { title, icon, desc, items, economy, career };
    const q = (this._merchantQuery || '').trim().toLowerCase();
    box.innerHTML = '';
    const list = (items || []).filter((it) => {
      // 按职业过滤:若物品有 career 限制,仅显示匹配职业的
      if (it.career && career && it.career !== career) return false;
      if (q && !this._matchItem(it.id, q)) return false;
      return true;
    });
    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'bag-empty';
      empty.textContent = q
        ? `没有找到相符的${title || '商品'}。`
        : (career ? `当前职业「${CAREER_MAP[career]?.name || career}」暂无适配的${title}。` : '暂无商品。');
      box.appendChild(empty);
    }
    list.forEach((it) => {
      const price = economy.itemPrice ? economy.itemPrice(it.id) : it.price;
      const afford = economy.gold >= price;
      const tag = `${it.career ? `<span class="item-cat">${CAREER_MAP[it.career]?.name || it.career}</span>` : ''}${this._gradeTag(it)}`;
      box.appendChild(this._shopRow(it, afford, `🪙 ${price}`, '买入', 'data-buy', () => this.bus.emit('ui:merchant-buy', it.id), 0, tag));
    });
    this.renderResources(economy);
  }

  // ===== 铁匠铺:锻造 =====
  renderBlacksmith({ recipes, economy, name }) {
    if (this.el.blacksmithTitle) this.el.blacksmithTitle.textContent = `🔨 ${name || '铁匠铺'}`;
    if (this.el.blacksmithNote) this.el.blacksmithNote.textContent = '收集材料与图纸,锻造带特殊性能、无法买卖的武器';
    const box = this.el.blacksmithList;
    if (!box) return;
    box.innerHTML = '';
    (recipes || []).forEach((r) => {
      const it = r.result || ITEMS[r.result];
      if (!it) return;
      const card = document.createElement('div');
      card.className = `forge-card${r.canForge ? '' : ' is-locked'}`;
      const matHtml = (r.mats || []).map((m) => `<span class="forge-mat${m.have >= m.need ? ' is-ok' : ' is-lack'}">${m.icon} ${this._escapeHtml(m.name)} ${m.have}/${m.need}</span>`).join('');
      card.innerHTML = `
        <div class="forge-head">
          <span class="forge-icon">${it.icon || '⚔️'}</span>
          <div class="forge-title">
            <div class="forge-name">${this._escapeHtml(it.name)}${r.unlocked ? '' : '<span class="forge-lock">未解锁</span>'}</div>
            <div class="forge-desc">${this._escapeHtml(it.desc || '')}</div>
          </div>
        </div>
        <div class="forge-mats">${matHtml}<span class="forge-mat forge-gold${r.canGold ? ' is-ok' : ' is-lack'}">🪙 ${r.gold}</span></div>
        <div class="forge-foot">
          <span class="forge-req">需图纸:${this._escapeHtml(ITEMS[r.blueprint]?.name || r.blueprint)}${r.unlocked ? '(已解锁)' : '(未获得)'}</span>
          <button class="btn btn-primary btn-sm" data-forge ${r.canForge ? '' : 'disabled'}>锻 造</button>
        </div>`;
      if (r.canForge) card.querySelector('[data-forge]')?.addEventListener('click', () => this.bus.emit('ui:forge', r.id));
      box.appendChild(card);
    });
    if (!(recipes || []).length) box.innerHTML = '<p class="bag-empty">铁匠暂无可用配方。</p>';
    this.renderResources(economy);
  }

  // ===== 宝石商 =====
  renderGemshop({ gems, economy, name }) {
    if (this.el.gemshopTitle) this.el.gemshopTitle.textContent = `💎 ${name || '宝石商'}`;
    if (this.el.gemshopNote) this.el.gemshopNote.textContent = '力量 / 魔力 / 勇敢 / 生命 —— 找精益师镶嵌进武器方能生效(随市场浮动定价)';
    const box = this.el.gemshopList;
    if (!box) return;
    box.innerHTML = '';
    (gems || []).forEach((g) => {
      const it = ITEMS[g.id] || g;
      const price = Number.isFinite(g.price) ? g.price : (it.price || 0);
      const afford = economy.gold >= price;
      const eff = GEM_EFFECT[it.gem] || {};
      const effTxt = Object.entries(eff).map(([k, v]) => `${GEM_STAT_CN[k] || k} +${v}`).join(' · ');
      const tag = `<span class="item-cat">${this._escapeHtml(effTxt)}</span>`;
      box.appendChild(this._shopRow(it, afford, `🪙 ${price}${this._trendTag(g.trend)}`, '买入', 'data-buy', () => this.bus.emit('ui:gemshop-buy', g.id), 0, tag));
    });
    if (!(gems || []).length) box.innerHTML = '<p class="bag-empty">宝石商今日无货。</p>';
    this.renderResources(economy);
  }

  // ===== 精益师:镶嵌 =====
  renderJeweler({ weapons, gems, economy, cost, name }) {
    if (this.el.jewelerTitle) this.el.jewelerTitle.textContent = `🔧 ${name || '精益师'}`;
    if (this.el.jewelerNote) this.el.jewelerNote.textContent = `选择一件武器与一颗宝石,镶嵌提升能力(每次 ${cost} 金币)`;

    const wList = weapons || [];
    if (!wList.some((w) => w.id === this._jewelerSel)) this._jewelerSel = null;

    const wBox = this.el.jewelerWeapons;
    if (wBox) {
      wBox.innerHTML = '';
      if (!wList.length) wBox.innerHTML = '<p class="bag-empty">背包里没有可镶嵌的武器。</p>';
      wList.forEach((w) => {
        const free = w.free;
        const gemTxt = (w.gems || []).map((gid) => ITEMS[gid]?.name || gid).join('、');
        const row = document.createElement('div');
        row.className = `item-row jeweler-weapon${w.id === this._jewelerSel ? ' is-selected' : ''}`;
        row.innerHTML = `
          <div class="item-icon">${w.def.icon || '🗡️'}</div>
          <div class="item-body">
            <div class="item-name">${this._escapeHtml(w.def.name)}${w.qty > 1 ? ` <span class="item-qty">×${w.qty}</span>` : ''}<span class="item-cat">空槽 ${free}</span></div>
            <div class="item-desc">${this._escapeHtml(w.def.desc || '')}</div>
            ${gemTxt ? `<div class="item-sub">已镶:${this._escapeHtml(gemTxt)}</div>` : ''}
          </div>
          <div class="item-actions">
            <button class="btn ${w.id === this._jewelerSel ? 'btn-primary' : 'btn-ghost'} btn-sm" data-pick>${w.id === this._jewelerSel ? '已选择' : '选择'}</button>
            ${(w.gems && w.gems.length) ? '<button class="btn btn-ghost btn-sm" data-unsocket>取下宝石</button>' : ''}
          </div>`;
        row.querySelector('[data-pick]')?.addEventListener('click', () => {
          this._jewelerSel = (this._jewelerSel === w.id) ? null : w.id;
          this.renderJeweler({ weapons, gems, economy, cost, name });
        });
        row.querySelector('[data-unsocket]')?.addEventListener('click', () => this.bus.emit('ui:unsocket', w.id));
        wBox.appendChild(row);
      });
    }

    const gBox = this.el.jewelerGems;
    if (gBox) {
      gBox.innerHTML = '';
      if (!gems.length) gBox.innerHTML = '<p class="bag-empty">背包里没有宝石。</p>';
      const sel = wList.find((w) => w.id === this._jewelerSel);
      gems.forEach((g) => {
        const can = !!sel && sel.free > 0 && economy.gold >= cost;
        const eff = GEM_EFFECT[g.def.gem] || {};
        const effTxt = Object.entries(eff).map(([k, v]) => `${GEM_STAT_CN[k] || k} +${v}`).join(' · ');
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
          <div class="item-icon">${g.def.icon || '💎'}</div>
          <div class="item-body">
            <div class="item-name">${this._escapeHtml(g.def.name)}${g.qty > 1 ? ` <span class="item-qty">×${g.qty}</span>` : ''}<span class="item-cat">${this._escapeHtml(effTxt)}</span></div>
            <div class="item-desc">${this._escapeHtml(g.def.desc || '')}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-primary btn-sm" data-socket ${can ? '' : 'disabled'}>镶 嵌</button>
          </div>`;
        if (can) row.querySelector('[data-socket]')?.addEventListener('click', () => this.bus.emit('ui:socket', { weaponId: sel.id, gemId: g.id }));
        gBox.appendChild(row);
      });
      if (gems.length && !sel) {
        const hint = document.createElement('p');
        hint.className = 'bag-empty';
        hint.textContent = '请先在上方选择一件武器。';
        gBox.appendChild(hint);
      }
    }
    this.renderResources(economy);
  }

  // ===== 背包 =====
  renderBag({ economy, player, bagCap = 40, bagUsed = 0, expandCost = 0 }) {
    this._bagData = { economy, player, bagCap, bagUsed, expandCost };
    // 武器 / 七个防具格 / 服饰四件 / 载具
    const SLOT_CN = { weapon: '武器' };
    for (const s of ARMOR_SLOTS) SLOT_CN[s] = ARMOR_SLOT_CN[s] || s;
    Object.assign(SLOT_CN, { hat: '帽子', top: '衣服', bottom: '裤子', shoes: '鞋子', vehicle: '载具' });
    if (this.el.bagEquipped) {
      this.el.bagEquipped.innerHTML = Object.entries(SLOT_CN).map(([slot, label]) => {
        const id = economy.equipped[slot];
        const it = id ? ITEMS[id] : null;
        return `<div class="equip-slot">
          <span class="equip-label">${label}</span>
          <span class="equip-value">${it ? `${it.icon || ''} ${this._escapeHtml(it.name)}` : '——'}</span>
          ${it ? `<button class="btn btn-ghost btn-sm" data-unequip="${slot}">卸下</button>` : ''}
        </div>`;
      }).join('');
      this.el.bagEquipped.querySelectorAll('[data-unequip]').forEach((b) => {
        b.addEventListener('click', () => this.bus.emit('ui:bag-unequip', b.dataset.unequip));
      });
    }

    // 容量显示 + 扩容按钮
    if (this.el.bagCap) {
      const costTxt = expandCost >= 0 ? `🪙 ${expandCost} / +10 格` : '已达上限';
      this.el.bagCap.innerHTML = `<span class="bag-cap-text">格位 <b>${bagUsed}</b> / ${bagCap}</span><span class="bag-cap-hint">扩容:${costTxt}(每 70 格价格 ×1.25)</span>`;
    }
    if (this.el.btnBagExpand) {
      const maxed = expandCost < 0;
      this.el.btnBagExpand.textContent = maxed ? '扩 容 +10 格(已达上限)' : `扩 容 +10 格(🪙 ${expandCost})`;
      this.el.btnBagExpand.disabled = maxed || economy.gold < expandCost;
    }

    const box = this.el.bagList;
    if (box) {
      const q = (this._bagQuery || '').trim().toLowerCase();
      const tab = this._bagTab || 'all';
      const def = BAG_TABS.find((t) => t.key === tab) || BAG_TABS[0];
      const all = [...economy.bag.entries()].filter(([id]) => ITEMS[id]);
      const entries = all.filter(([id]) => def.match(ITEMS[id]) && (!q || this._matchItem(id, q)));
      this._renderBagFilters(all, q);
      box.innerHTML = '';
      entries.forEach(([id, qty]) => {
        const it = ITEMS[id];
        const canBatch = it.effect && ['heal', 'mp', 'ap'].includes(it.effect.kind) && qty > 1;
        const isBp = it.category === 'blueprint';
        const tile = document.createElement('div');
        tile.className = 'bag-tile';
        tile.title = it.desc || it.name;
        tile.innerHTML = `
          <div class="bag-tile-icon">${it.icon || '📦'}</div>
          ${qty > 1 ? `<div class="bag-tile-qty">×${qty}</div>` : ''}
          <div class="bag-tile-name">${this._escapeHtml(it.name)}</div>
          <div class="bag-tile-cat">${this._catLabel(it)}${this._gradeTag(it)}${isSellLocked(id) ? '<span class="item-locked">超 130 级 · 不可售</span>' : ''}</div>
          <div class="bag-tile-actions">
            ${it.effect ? '<button class="btn btn-primary btn-sm" data-use>使用</button>' : ''}
            ${canBatch ? '<button class="btn btn-ghost btn-sm" data-useall>全部</button>' : ''}
            ${isBp ? '<button class="btn btn-primary btn-sm" data-useblueprint>使用</button>' : ''}
            ${it.equipment ? '<button class="btn btn-ghost btn-sm" data-equip>装备</button>' : ''}
            <button class="btn btn-ghost btn-sm" data-drop>丢弃</button>
          </div>`;
        tile.querySelector('[data-use]')?.addEventListener('click', () => this.bus.emit('ui:bag-use', id));
        tile.querySelector('[data-useall]')?.addEventListener('click', () => this.bus.emit('ui:bag-use-all', id));
        tile.querySelector('[data-useblueprint]')?.addEventListener('click', () => this.bus.emit('ui:bag-use-blueprint', id));
        tile.querySelector('[data-equip]')?.addEventListener('click', () => this.bus.emit('ui:bag-equip', id));
        tile.querySelector('[data-drop]')?.addEventListener('click', () => this.bus.emit('ui:bag-drop', id));
        box.appendChild(tile);
      });
      // 空位仅在「全部 + 无搜索」时展示,筛选/搜索时把位置留给结果
      const showEmpty = tab === 'all' && !q;
      const emptyCount = showEmpty ? Math.max(0, bagCap - entries.length) : 0;
      for (let i = 0; i < emptyCount; i++) {
        const t = document.createElement('div');
        t.className = 'bag-tile is-empty';
        t.innerHTML = '<span class="bag-tile-empty">空</span>';
        box.appendChild(t);
      }
      if (!entries.length) {
        box.innerHTML = `<p class="bag-empty">${q || tab !== 'all' ? '没有符合条件的物品。' : '背包空空如也。'}</p>`;
      }
    }

    // 底部数值概览
    if (this.el.bagRes && player) {
      const chips = `<span class="res-chip">❤ ${player.hp}/${player.maxHp}</span><span class="res-chip">✦ ${player.mp}/${player.maxMp}</span><span class="res-chip">⚔ 战力 ${player.power || 0}</span><span class="res-chip">🪙 ${economy.gold}</span><span class="res-chip">⚡ ${economy.ap}/${economy.apCap()}</span>`;
      this.el.bagRes.innerHTML = chips;
    } else {
      this.renderResources(economy);
    }
  }

  // ===== 打工(小游戏) =====
  /** 列出该地的活儿与三档难度;选一档进入小游戏 */
  renderJobs({ jobs, economy }) {
    const box = this.el.jobList;
    if (!box) return;
    box.innerHTML = '';
    (jobs || []).forEach((j) => {
      const card = document.createElement('div');
      card.className = 'job-card';
      card.innerHTML = `
        <div class="job-head">
          <span class="job-icon">${this._escapeHtml(j.hero || '🛠️')}</span>
          <div class="job-title">
            <div class="job-name">${this._escapeHtml(j.name)}</div>
            <div class="job-desc">${this._escapeHtml(j.desc || '')}</div>
          </div>
          <span class="job-mode">${MODE_LABELS[j.game] || ''}</span>
        </div>
        <div class="job-tiers"></div>
      `;
      const tiers = card.querySelector('.job-tiers');
      (j.tiers || []).forEach((t, i) => {
        const ok = economy.ap >= t.ap;
        const row = document.createElement('div');
        row.className = 'job-tier';
        row.innerHTML = `
          <span class="job-tier-label">${this._escapeHtml(t.label)}</span>
          <span class="job-tier-goal">${this._escapeHtml(t.goalText || '')}</span>
          <span class="job-tier-pay${ok ? '' : ' is-poor'}">⚡ ${t.ap} → 🪙 ${t.gold}</span>
        `;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-primary btn-sm';
        btn.textContent = '挑战';
        btn.disabled = !ok;
        if (ok) btn.addEventListener('click', () => this.bus.emit('ui:job-challenge', { jobId: j.id, tierIndex: i }));
        row.appendChild(btn);
        tiers.appendChild(row);
      });
      box.appendChild(card);
    });
    this.renderResources(economy);
  }

  // ===== 打工小游戏弹窗 =====
  /** 打开小游戏(先显示准备画面,点「开始」再跑) */
  openMinigame(job, tier, tierIndex) {
    const box = this.el.minigame;
    if (!box) return;
    this._mgJob = job;
    this._mgTier = tier;
    this._mgTierIndex = tierIndex;
    this._mgOpen = true;
    if (this.el.mgTitle) this.el.mgTitle.textContent = job.name;
    if (this.el.mgSub) {
      this.el.mgSub.textContent = `${MODE_LABELS[job.game] || ''} · ${tier.label} —— 达标得 🪙${tier.gold}(耗 ⚡${tier.ap})`;
    }
    this._renderMgHud({ goalText: tier.goalText || '', timeText: '', lives: tier.lives ?? 3 });
    this._setMgOverlay('ready');
    this._showMgActions('ready');
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
  }

  closeMinigame() {
    if (this._mg) { this._mg.destroy(); this._mg = null; }
    this._mgOpen = false;
    this._mgJob = null;
    this._mgTier = null;
    this._mgTierIndex = -1;
    const box = this.el.minigame;
    if (!box) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!this._mgOpen) box.hidden = true; }, 200);
  }

  /** 开始 / 重来:重置并启动一次挑战 */
  _startMinigame() {
    if (!this._mgJob || !this.el.mgCanvas) return;
    if (this._mg) { this._mg.destroy(); this._mg = null; }
    const spec = {
      ...this._mgTier,
      mode: this._mgJob.game,
      hero: this._mgJob.hero,
      good: this._mgJob.good,
      bad: this._mgJob.bad,
    };
    this._mg = new Minigame(this.el.mgCanvas, spec, {
      onHud: (hud) => this._renderMgHud(hud),
      onEnd: (res) => this._onMgEnd(res),
    });
    this._setMgOverlay('playing');
    this._showMgActions('playing');
    this._mg.start();
  }

  _renderMgHud({ goalText, timeText, lives }) {
    if (this.el.mgGoal) this.el.mgGoal.textContent = goalText || '';
    if (this.el.mgTime) this.el.mgTime.textContent = timeText || '';
    if (this.el.mgLives) this.el.mgLives.textContent = '❤'.repeat(Math.max(0, lives)) || '—';
  }

  _onMgEnd(res) {
    this._setMgOverlay(res.success ? 'win' : 'lose');
    this._showMgActions('over');
    this.bus.emit('ui:job-finish', {
      jobId: this._mgJob?.id, tierIndex: this._mgTierIndex, success: res.success, score: res.score,
    });
  }

  _showMgActions(phase) {
    const start = this.el.btnMgStart;
    const retry = this.el.btnMgRetry;
    if (start) start.hidden = phase !== 'ready';
    if (retry) retry.hidden = phase !== 'over';
  }

  /** 准备 / 进行 / 结果 的覆盖提示 */
  _setMgOverlay(phase) {
    const box = this.el.mgOverlay;
    if (!box) return;
    if (phase === 'playing') { box.hidden = true; return; }
    box.hidden = false;
    const tier = this._mgTier || {};
    const job = this._mgJob || {};
    if (phase === 'ready') {
      const tip = job.game === 'parkour'
        ? '空格 / ↑ / 点击画面 起跳'
        : '← → 或 A D 左右移动,也可用鼠标·手指拖动';
      box.innerHTML = `<b>准备开始</b><span>${this._escapeHtml(tip)}</span><span>${this._escapeHtml(tier.goalText || '')}</span>`;
    } else if (phase === 'win') {
      box.innerHTML = `<b class="is-win">达标!</b><span>获得 🪙 ${tier.gold || 0} 金币</span>`;
    } else {
      box.innerHTML = '<b class="is-lose">未达标</b><span>再来一次试试</span>';
    }
  }

  bindBattle(battle) {
    this.battle = battle;
    this._lastEnemyHp = null;
    this._lastPlayerHp = null;
  }

  // ===== 战斗视图 =====
  _renderBattle(snap) {
    this.el.turn.textContent = snap.turn;
    this.el.drawCount.textContent = snap.drawCount;
    this.el.discardCount.textContent = snap.discardCount;
    this.el.energy.textContent = `${snap.player.energy}/${snap.player.energyMax} · ✦${snap.player.mp}`;
    this.el.btnEndTurn.disabled = snap.over;
    if (this.el.btnAutoBattle) {
      this.el.btnAutoBattle.textContent = this.battle?.autoMode ? '自动战斗 ▣' : '自动战斗';
      this.el.btnAutoBattle.classList.toggle('is-active', !!this.battle?.autoMode);
      this.el.btnAutoBattle.disabled = snap.over;
    }

    // 能量脉动:能量回升时提示
    this.el.energy.classList.remove('pulse');
    void this.el.energy.offsetWidth;
    this.el.energy.classList.add('pulse');

    // 敌人区域:渲染所有敌人(群体作战时可点击选择目标)
    this.el.enemyZone.innerHTML = '';
    const enemies = snap.enemies && snap.enemies.length ? snap.enemies : (snap.enemy ? [snap.enemy] : []);
    enemies.forEach((e, i) => {
      if (!e.alive && e.alive !== undefined) return; // 跳过死亡敌人(若有 alive 字段)
      const card = this._entityCard(e, true);
      if (snap.groupMode) {
        card.classList.toggle('is-selected', i === snap.selectedEnemyIndex);
        card.style.cursor = 'pointer';
        card.title = '点击选择攻击目标';
        card.addEventListener('click', () => {
          if (this.battle) this.battle.selectEnemy(i);
        });
      }
      this.el.enemyZone.appendChild(card);
    });

    // 玩家区域:玩家 + 队友
    this.el.playerZone.innerHTML = '';
    this.el.playerZone.appendChild(this._entityCard({ ...snap.player, name: this._playerName() }, false));
    // 渲染队友
    if (snap.allies && snap.allies.length) {
      for (const a of snap.allies) {
        if (!a.alive) continue;
        const allyCard = this._allyCard(a);
        this.el.playerZone.appendChild(allyCard);
      }
    }

    this.el.hand.innerHTML = '';
    for (const card of snap.hand) {
      this.el.hand.appendChild(this._handCardEl(card, snap));
    }

    this._renderBattleItems();
    // 记录所有敌人 HP 用于受击动画
    this._lastEnemyHpMap = {};
    enemies.forEach((e, i) => { this._lastEnemyHpMap[i] = e.hp; });
    this._lastPlayerHp = snap.player.hp;
  }

  /** 队友卡片(简化版:头像 + 血条) */
  _allyCard(ally) {
    const card = document.createElement('div');
    card.className = 'entity-card is-ally';
    const hpPct = Math.max(0, Math.round((ally.hp / ally.maxHp) * 100));
    card.innerHTML = `
      <div class="entity-top">
        <div class="entity-avatar">${ally.icon || '⚔'}</div>
        <div class="entity-name">${this._escapeHtml(ally.name)}</div>
      </div>
      <div class="hpbar"><i style="width:${hpPct}%"></i><span>${ally.hp}/${ally.maxHp}</span></div>
      <div class="entity-intent"><span class="intent-icon">⚔</span><span>攻击 ${ally.atk}</span></div>
    `;
    return card;
  }

  /** 战斗中可用的药品(恢复生命 / 魔力 / 战斗专用药剂),点击即用 */
  _renderBattleItems() {
    const box = this.el.battleItems;
    if (!box) return;
    const eco = this.economy;
    if (!eco) { box.innerHTML = ''; return; }
    const usable = [...eco.bag.entries()].filter(([id]) => {
      const it = ITEMS[id];
      if (!it?.effect) return false;
      return ['heal', 'mp', 'cleanse', 'rage', 'block_potion', 'energy', 'escape'].includes(it.effect.kind);
    });
    if (!usable.length) { box.innerHTML = '<span class="battle-items-empty">无可用药品</span>'; return; }
    box.innerHTML = '';
    usable.forEach(([id, qty]) => {
      const it = ITEMS[id];
      const b = document.createElement('button');
      b.className = 'item-chip';
      b.title = it.desc || '';
      b.textContent = `${it.icon || '🧪'} ${it.name} ×${qty}`;
      b.addEventListener('click', () => this.bus.emit('ui:bag-use', id));
      box.appendChild(b);
    });
  }

  /**
   * 职业的展示信息:title 为随职介晋升合成的职业名
   * (魔法学徒 → 魔法学士 → 魔法执事 → 魔法教授 → 魔法祭司 → 魔法和诗)。
   * @param {object} [career] 缺省取当前职业
   */
  _careerView(career = this.engine?.career) {
    if (!career) return null;
    const lv = this.economy ? this.economy.careerLevelOf(career.id) : 1;
    return { ...career, level: lv, title: career.root ? careerTitleOf(career.root, lv) : career.name };
  }

  _playerName() {
    const cv = this._careerView();
    return cv ? cv.title : '玩家';
  }

  _handCardEl(card, snap) {
    const el = document.createElement('div');
    el.className = `card type-${card.type || 'attack'}`;
    const mp = cardMpCost(card);
    if (snap.player.energy < card.cost || (mp > 0 && snap.player.mp < mp)) el.classList.add('is-unplayable');
    el.innerHTML = `
      <div class="card-cost">${card.cost}</div>
      ${mp > 0 ? `<div class="card-mp">✦${mp}</div>` : ''}
      <div class="card-name">${this._escapeHtml(card.name)}</div>
      <div class="card-type-tag">${TYPE_LABELS[card.type] || ''}</div>
      <div class="card-desc">${this._escapeHtml(card.description || '')}</div>
    `;
    el.addEventListener('click', () => {
      if (el.classList.contains('is-unplayable')) return;
      el.classList.add('is-playing');
      setTimeout(() => el.classList.remove('is-playing'), 380);
      this.battle && this.battle.playCard(card);
    });
    return el;
  }

  _entityCard(data, isEnemy) {
    const card = document.createElement('div');
    const cls = isEnemy ? 'is-enemy' : 'is-player';
    card.className = `entity-card ${cls}`;
    if (isEnemy && data.hp <= 0) card.classList.add('is-dead');

    // 受击抖动
    const prevHp = isEnemy ? this._lastEnemyHp : this._lastPlayerHp;
    if (prevHp !== null && data.hp < prevHp) {
      card.classList.add('is-hit');
      setTimeout(() => card.classList.remove('is-hit'), 420);
    }

    const hpPct = Math.max(0, Math.round((data.hp / data.maxHp) * 100));
    const avatar = isEnemy ? '👹' : (this.engine?.career?.icon || '⚔');
    const blockHtml = data.block > 0
      ? `<span class="entity-block is-on">🛡 ${data.block}</span>`
      : '<span class="entity-block">🛡 0</span>';

    card.innerHTML = `
      <div class="entity-top">
        <div class="entity-avatar">${avatar}</div>
        <div class="entity-name">${this._escapeHtml(data.name)}</div>
        ${blockHtml}
      </div>
      <div class="hpbar"><i style="width:${hpPct}%"></i><span>${data.hp}/${data.maxHp}</span></div>
      <div class="entity-intent ${this._intentClass(data.intent)}">
        <span class="intent-icon">${this._intentIcon(data.intent)}</span>
        <span>${this._intentText(data.intent)}</span>
      </div>
      <div class="entity-statuses">${this._statusPills(data.statuses)}</div>
    `;
    return card;
  }

  _intentClass(intent) {
    if (!intent) return '';
    return `is-${intent.kind}`;
  }

  _intentIcon(intent) {
    if (!intent) return '…';
    if (intent.kind === 'attack') return '⚔';
    if (intent.kind === 'block') return '🛡';
    if (intent.kind === 'buff') return '✦';
    return '•';
  }

  _intentText(intent) {
    if (!intent) return '蓄势待发';
    if (intent.kind === 'attack') return `意图攻击 ${intent.value}`;
    if (intent.kind === 'block') return `意图防御 ${intent.value}`;
    if (intent.kind === 'buff') return `意图强化 ${STATUS_LABELS[intent.name] || intent.name}`;
    return `意图:${intent.kind}`;
  }

  _statusPills(statuses) {
    const neg = ['vulnerable', 'weak', 'frail'];
    return Object.entries(statuses || {})
      .filter(([, v]) => v)
      .map(([k, v]) => `<span class="status-pill ${neg.includes(k) ? 'neg' : 'pos'}">${STATUS_LABELS[k] || k} ${v}</span>`)
      .join('');
  }

  _renderBattleLog(msg) {
    this.el.battleLog.textContent = msg;
    this.el.battleLog.classList.remove('is-flash');
    void this.el.battleLog.offsetWidth;
    this.el.battleLog.classList.add('is-flash');
  }

  /** 伤害 / 护甲 / 治疗飘字 */
  _playBattleFx(fx) {
    let card;
    if (fx.target === 'enemy') {
      const cards = this.el.enemyZone.querySelectorAll('.entity-card');
      // 群体作战:根据 enemyIndex 定位;否则取第一个
      if (fx.enemyIndex !== undefined && cards[fx.enemyIndex]) {
        card = cards[fx.enemyIndex];
      } else {
        card = cards[0];
      }
    } else if (fx.target === 'ally') {
      const cards = this.el.playerZone.querySelectorAll('.entity-card.is-ally');
      // 根据 allyId 定位队友卡片
      for (const c of cards) {
        const nameEl = c.querySelector('.entity-name');
        if (nameEl && nameEl.textContent.includes(fx.allyId ? '' : '')) { card = c; break; }
      }
      if (!card) card = cards[0];
    } else {
      // player
      card = this.el.playerZone.querySelector('.entity-card.is-player');
    }
    if (!card) return;
    const span = document.createElement('div');
    span.className = `dmg-float ${fx.kind}`;
    const prefix = fx.kind === 'damage' ? '-' : (fx.kind === 'heal' ? '+' : '');
    span.textContent = `${prefix}${fx.value}`;
    card.appendChild(span);
    setTimeout(() => span.remove(), 1000);
  }

  // ===== 战利品 =====
  renderRewards(cards, extra) {
    if (this.el.rewardSub) {
      let t = '从战场上拾起一张卡牌,加入你的牌组';
      if (extra) {
        const loot = extra.loot ? `,拾得「${ITEMS[extra.loot]?.name || extra.loot}」` : '';
        t = `获得 🪙 ${extra.gold} 金币${loot} · 再选一张卡牌加入牌组`;
      }
      this.el.rewardSub.textContent = t;
    }
    this.el.rewardGrid.innerHTML = '';
    cards.forEach((card, i) => {
      const el = this._rewardCardEl(card);
      el.style.animationDelay = `${i * 0.1}s`;
      el.addEventListener('click', () => this.bus.emit('ui:pick-reward', card.id));
      this.el.rewardGrid.appendChild(el);
    });
  }

  _rewardCardEl(card) {
    const el = document.createElement('div');
    el.className = `card type-${card.type || 'attack'}`;
    const mp = cardMpCost(card);
    el.innerHTML = `
      <div class="card-cost">${card.cost}</div>
      ${mp > 0 ? `<div class="card-mp">✦${mp}</div>` : ''}
      <div class="card-name">${this._escapeHtml(card.name)}</div>
      <div class="card-type-tag">${TYPE_LABELS[card.type] || ''} · ${this._rarityLabel(card.rarity)}</div>
      <div class="card-desc">${this._escapeHtml(card.description || '')}</div>
    `;
    return el;
  }

  _rarityLabel(r) {
    return { basic: '基础', common: '普通', uncommon: '精良', rare: '稀有' }[r] || '';
  }

  // ===== 结局 =====
  _renderResult(victory) {
    if (victory) {
      const endingId = this.engine ? this.engine.resolveEnding() : 'odyssey';
      const ending = ENDINGS[endingId] || ENDINGS.odyssey;
      this.el.resultEyebrow.textContent = '结 局';
      this.el.resultTitle.textContent = ending.title;
      this.el.resultTitle.style.color = ending.color;
      this.el.resultDesc.textContent = ending.desc || this._defaultEndingDesc(endingId);
      this._renderResultStats();
    } else {
      this.el.resultEyebrow.textContent = '征 程 中 断';
      this.el.resultTitle.textContent = '倒 下';
      this.el.resultTitle.style.color = 'var(--ember-bright)';
      this.el.resultDesc.textContent = '剑未出鞘,人已力竭。但「守约」的故事,还等着被重新书写。';
      this.el.resultStats.innerHTML = '';
    }
  }

  _defaultEndingDesc(id) {
    return {
      hero: '你守住了弟弟,也守住了父亲守了一辈子的约。',
      tragic: '你替弟弟承受了龙化,回不去了——但你守住了他。',
      recluse: '你放下了剑,回到平静的日子。有些约,只能交给下一个人。',
      odyssey: '你做了你的决定。现在,轮到下一位少年,做他的决定。',
    }[id] || '';
  }

  _renderResultStats() {
    if (!this.engine) { this.el.resultStats.innerHTML = ''; return; }
    const stats = Object.entries(this.engine.stats)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => `<span class="stat-chip">${STAT_LABELS[k] || k} ${v > 0 ? '+' : ''}${v}</span>`)
      .join('');
    const flags = [...this.engine.flags].slice(0, 10)
      .map((f) => `<span class="stat-chip">${f}</span>`)
      .join('');
    this.el.resultStats.innerHTML = stats + flags;
  }

  // ===== 片尾字幕 =====
  // mode: 'full' = 大章末完整回顾(多段); 'short' = 小节末本章回顾(单段)
  // recapKey: full 时为大章 id(mc1/mc2/mc3); short 时为小节 id(ch28...)
  // cleared: full 模式下已通关的大章 id 集合({mc1:true,...});未传则默认全部显示(向后兼容)
  showCredits(recaps, mode = 'full', recapKey = 'mc1', onComplete, cleared = null) {
    const inner = document.getElementById('credits-inner');
    const embers = document.getElementById('credits-embers');
    if (!inner || !embers) { if (onComplete) onComplete(); return; }

    // 生成红色余烬动画(短字幕余烬减半)
    embers.innerHTML = '';
    const emberCount = mode === 'short' ? 12 : 24;
    for (let i = 0; i < emberCount; i++) {
      const s = document.createElement('span');
      s.style.left = `${Math.random() * 100}%`;
      s.style.animationDuration = `${6 + Math.random() * 8}s`;
      s.style.animationDelay = `${-Math.random() * 10}s`;
      s.style.setProperty('--drift', `${(Math.random() - 0.5) * 100}px`);
      const scale = 0.6 + Math.random() * 1.0;
      s.style.width = `${3 * scale}px`;
      s.style.height = `${3 * scale}px`;
      embers.appendChild(s);
    }

    // 组装字幕内容
    let html = '';
    if (mode === 'short') {
      // 短字幕:仅本章标题 + 本章 recap + 转场提示
      const chTitle = this._chapterTitleForRecap(recapKey);
      const chRecap = recaps?.[recapKey] || '';
      html = `
        <h2 class="credits-short-title">${chTitle}</h2>
        <div class="credits-divider"></div>
        <p class="credits-short-recap">${chRecap}</p>
        <div class="credits-divider"></div>
        <p class="credits-end">— 下 一 章 · 续 —</p>
      `;
    } else {
      // 完整字幕:大章回顾(仅展示已通关的大章,避免剧透后续未通关章节)
      // 当前刚通关的大章(recapKey)必然在 cleared 集合中(ui:show-ending 已先行 markChapterCleared)
      const mc1Txt = recaps?.mc1 || '';
      const mc2Txt = recaps?.mc2 || '';
      const mc3Txt = recaps?.mc3 || '';
      // 兼容旧调用:无 cleared 视为全部已通关(只在最终大章末 mc3 通关时才会出现)
      const isCleared = (id) => !cleared || !!cleared[id] || id === recapKey;
      const sections = [];
      if (isCleared('mc1') && mc1Txt) {
        sections.push(`<h2>第一大章 · 家园之殇</h2><p>${mc1Txt}</p>`);
      }
      if (isCleared('mc2') && mc2Txt) {
        sections.push(`<h2>第二大章 · 卡斯特罗之战</h2><p>${mc2Txt}</p>`);
      }
      if (isCleared('mc3') && mc3Txt) {
        sections.push(`<h2>第三大章 · 龙族突起</h2><p>${mc3Txt}</p>`);
      }
      // 末尾提示:刚通关的是最后一个大章 → 全剧终;否则提示继续下一大章
      const mcList = ['mc1', 'mc2', 'mc3'];
      const isLastCleared = recapKey === mcList[mcList.length - 1];
      const endLine = isLastCleared
        ? `<p class="credits-end">— 全 剧 终 —</p>`
        : `<p class="credits-end">期 待 下 次 冒 险 之 旅</p>`;
      html = `
        <h1>龙 脊 少 年 · 守 约</h1>
        <div class="credits-divider"></div>
        ${sections.map((s) => `<div class="credits-divider"></div>${s}`).join('')}
        <div class="credits-divider"></div>
        ${endLine}
      `;
    }
    inner.innerHTML = html;

    // 监听字幕动画结束或点击跳过
    const finish = () => {
      if (this._creditsFinished) return;
      this._creditsFinished = true;
      inner.removeEventListener('animationend', onAnimEnd);
      document.removeEventListener('click', onSkip);
      if (onComplete) onComplete();
    };
    const onAnimEnd = (e) => { if (e.target === inner) finish(); };
    const onSkip = () => finish();
    this._creditsFinished = false;
    inner.addEventListener('animationend', onAnimEnd);
    // 延迟绑定点击,避免从叙事视图点击「查看结局」的事件冒泡触发跳过
    setTimeout(() => document.addEventListener('click', onSkip), 600);
  }

  /** 由小节 id(如 ch28)反查小节标题,用于短字幕头部 */
  _chapterTitleForRecap(chId) {
    const map = this._chapterTitleMap || (this._chapterTitleMap = {});
    if (map[chId]) return map[chId];
    const ch = (this.engine?.chapters || {})[chId];
    if (ch?.title) { map[chId] = ch.title; return ch.title; }
    return chId;
  }

  // ===== 角色弹窗:形象居中 · 七格防具环绕 · 服饰 / 职业 / 形象 =====
  openCharacterSheet() {
    this._charOpen = true;
    if (this.el.charsheet) { this.el.charsheet.hidden = false; this.el.charsheet.classList.add('is-open'); }
  }

  closeCharacterSheet() {
    this._charOpen = false;
    this._csPick = null;
    if (this.el.charsheet) { this.el.charsheet.hidden = true; this.el.charsheet.classList.remove('is-open'); }
  }

  /**
   * 渲染角色弹窗。
   * @param {object} data 由 Game 组装的视图数据
   * @param {'look'|'rename'|null} [mode] 特殊入口(为 null 时正常展示)
   */
  renderCharacterSheet(data, mode = null) {
    if (!this.el.charsheet || !data) return;
    this._csData = data;
    this._csMode = mode;
    this._csPick = null;
    this._csSelBody = data.body;
    this._csSelSkin = data.skin;
    if (this.el.csName) this.el.csName.textContent = data.name;
    this._paintCs();
    this._renderCsSlots();
    this._renderCsCareer();
    this._renderCsOutfits();
    this._renderCsLook();
    this._renderCsPets();
    this._renderCsPicker();
    this.openCharacterSheet();
  }

  /** 绘制形象预览(采用当前暂选的形象 / 肤色) */
  _paintCs() {
    const d = this._csData;
    if (!this._csCtx || !d) return;
    const body = BODY_MAP[this._csSelBody] || BODY_MAP[d.body];
    const skin = SKIN_MAP[this._csSelSkin] || SKIN_MAP[d.skin];
    const look = Object.assign({}, d.appearance, {
      skinCol: skin.skin, skinShade: skin.shade,
      hair: body.hairColor, hairStyle: body.hairStyle, eyeStyle: body.eyeStyle,
      blush: body.blush, bodyAcc: body.accessory,
      stature: body.stature, girth: body.girth, limb: body.limb,
    });
    paintCharacter(this._csCtx, 5, d.career && d.career.id, look);
    if (this.el.csLook) this.el.csLook.textContent = lookLabel(this._csSelBody, this._csSelSkin);
  }

  /** 七格防具 */
  _renderCsSlots() {
    const d = this._csData; if (!d) return;
    for (const slot of ARMOR_SLOTS) {
      const box = this.el.csSlots[slot];
      if (!box) continue;
      const it = d.armor[slot];
      const cnt = (d.armorOptions[slot] || []).length;
      box.classList.toggle('is-empty', !it);
      box.innerHTML = `
        <div class="cs-slot-label">${ARMOR_SLOT_CN[slot]}</div>
        <div class="cs-slot-body">
          <span class="cs-slot-icon">${it ? it.icon : '＋'}</span>
          <span class="cs-slot-text">
            <b>${it ? this._escapeHtml(it.name) : '未装备'}</b>
            <i>${it ? `Lv.${it.level}` : (cnt ? `可换 ${cnt} 件` : '背包无货')}</i>
          </span>
        </div>`;
      box.onclick = () => { this._csPick = { kind: 'armor', slot }; this._renderCsPicker(); };
    }
  }

  /** 服饰四件 */
  _renderCsOutfits() {
    const d = this._csData; const box = this.el.csOutfits;
    if (!box || !d) return;
    box.innerHTML = '';
    for (const slot of ['hat', 'top', 'bottom', 'shoes']) {
      const it = d.outfits[slot];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `cs-outfit${it ? '' : ' is-empty'}`;
      b.innerHTML = `<span class="cs-outfit-icon">${it ? it.icon : '＋'}</span>
        <span class="cs-outfit-text"><i>${OUTFIT_CN[slot]}</i><b>${it ? this._escapeHtml(it.name) : '未装备'}</b></span>`;
      b.addEventListener('click', () => { this._csPick = { kind: 'outfit', slot }; this._renderCsPicker(); });
      box.appendChild(b);
    }
  }

  /** 职业面板 */
  _renderCsCareer() {
    const d = this._csData; const box = this.el.csCareer;
    if (!box || !d) return;
    const c = d.career;
    const pct = c.expMax > 0 ? Math.min(100, Math.round((c.exp / c.expMax) * 100)) : 100;
    const note = c.level >= c.max ? '已臻化境' : (c.level >= c.freeMax ? '逾百级需「星辉秘典」' : '');
    const switches = (d.careers || []).filter((x) => x.unlocked).map((x) =>
      `<button class="cs-career-btn${x.active ? ' is-active' : ''}" type="button" data-career="${x.id}" ${x.active ? 'disabled' : ''}>${this._escapeHtml(x.name)}<i>Lv.${x.level}</i></button>`
    ).join('');
    box.innerHTML = `
      <div class="cs-career-head">
        <span class="cs-career-job">${this._escapeHtml(c.title || c.name)}</span>
        <span class="cs-career-lv">Lv.${c.level}<i>/${c.max}</i></span>
      </div>
      <div class="cs-career-rank">${this._escapeHtml(c.rankName)} · ${this._escapeHtml(c.major)}</div>
      <div class="cs-progress"><i style="width:${pct}%"></i></div>
      <div class="cs-career-exp">职业经验 ${c.exp} / ${c.expMax}${note ? ` · ${note}` : ''}</div>
      ${switches ? `<div class="cs-sub-label">已解锁职业</div><div class="cs-career-switch">${switches}</div>` : ''}
    `;
    box.querySelectorAll('[data-career]').forEach((b) => {
      b.addEventListener('click', () => this.bus.emit('ui:char-career', b.dataset.career));
    });
  }

  /** 形象 / 肤色 / 改名 */
  _renderCsLook() {
    const d = this._csData; const box = this.el.csLookpanel;
    if (!box || !d) return;
    const lookFree = !d.lookChosen;
    const nameFree = !d.nameChosen;
    const canLook = lookFree || d.hasDream;
    const canName = nameFree || d.hasRename;
    const bodyBtns = BODY_STYLES.map((b) => `
      <button class="cs-look-btn${b.id === this._csSelBody ? ' is-active' : ''}" type="button" data-body="${b.id}" ${canLook ? '' : 'disabled'} title="${this._escapeHtml(b.tag)}">
        <span class="cs-look-emoji">${BODY_EMOJI[b.id] || '🧒'}</span>
        <span class="cs-look-name">${b.name}</span>
      </button>`).join('');
    const skinBtns = SKIN_TONES.map((s) => `
      <button class="cs-skin-btn${s.id === this._csSelSkin ? ' is-active' : ''}" type="button" data-skin="${s.id}" ${canLook ? '' : 'disabled'} title="${s.name}" style="--sw:${s.skin}"></button>`).join('');
    box.innerHTML = `
      <div class="cs-sub-label">形象(7 种)${lookFree ? ' · 初次可免费定形' : (d.hasDream ? ' · 有美梦药水' : ' · 需美梦药水')}</div>
      <div class="cs-body-grid">${bodyBtns}</div>
      <div class="cs-sub-label">肤色(5 种)</div>
      <div class="cs-skin-row">${skinBtns}</div>
      <div class="cs-look-actions">
        <button class="btn btn-primary cs-apply" type="button" ${canLook ? '' : 'disabled'}>${lookFree ? '确认形象' : '用美梦药水换形象'}</button>
      </div>
      <div class="cs-sub-label">改名${nameFree ? ' · 初次可免费改名' : (d.hasRename ? ' · 有改名卡' : ' · 需改名卡')}</div>
      <div class="cs-rename-row">
        <input class="cs-rename-input" type="text" maxlength="12" value="${this._escapeHtml(d.name)}" ${canName ? '' : 'disabled'} placeholder="新名字" />
        <button class="btn ${nameFree ? 'btn-primary' : 'btn-ghost'} cs-rename-btn" type="button" ${canName ? '' : 'disabled'}>${nameFree ? '确认改名' : '用改名卡'}</button>
      </div>
    `;
    box.querySelectorAll('[data-body]').forEach((b) => b.addEventListener('click', () => { this._csSelBody = b.dataset.body; this._renderCsSelection(); }));
    box.querySelectorAll('[data-skin]').forEach((b) => b.addEventListener('click', () => { this._csSelSkin = b.dataset.skin; this._renderCsSelection(); }));
    box.querySelector('.cs-apply')?.addEventListener('click', () => this.bus.emit('ui:char-look', { body: this._csSelBody, skin: this._csSelSkin }));
    box.querySelector('.cs-rename-btn')?.addEventListener('click', () => {
      const input = box.querySelector('.cs-rename-input');
      this.bus.emit('ui:char-rename', input ? input.value : '');
    });
  }

  /** 宠物:展示已拥有宠物并指定出战 */
  _renderCsPets() {
    const d = this._csData; const box = this.el.csPets;
    if (!box || !d) return;
    const list = d.pets || [];
    if (!list.length) {
      box.innerHTML = '<div class="cs-picker-empty">还没有宠物,可在市场购买,或由剧情赠送</div>';
      return;
    }
    box.innerHTML = `<div class="cs-pet-grid">${list.map((p) => `
      <button class="cs-pet${p.active ? ' is-active' : ''}" type="button" ${p.active ? 'disabled' : `data-pet="${p.id}"`}>
        <span class="cs-pet-icon">${p.icon}</span>
        <span class="cs-pet-text"><b>${this._escapeHtml(p.name)}</b><i>${this._escapeHtml(p.rarity)}${p.count > 1 ? ` ×${p.count}` : ''}</i></span>
        <span class="cs-pet-skill">${this._escapeHtml(p.skill || '')}</span>
      </button>`).join('')}</div>
      ${list.some((p) => p.active) ? '<button class="btn btn-ghost cs-pet-rest" type="button">取 消 出 战</button>' : ''}`;
    box.querySelectorAll('[data-pet]').forEach((b) => {
      if (!b.dataset.pet) return;
      b.addEventListener('click', () => this.bus.emit('ui:char-pet', b.dataset.pet));
    });
    box.querySelector('.cs-pet-rest')?.addEventListener('click', () => this.bus.emit('ui:char-pet', null));
  }

  /** 仅更新形象 / 肤色选中态并重绘预览(保留输入框内容) */
  _renderCsSelection() {
    const box = this.el.csLookpanel; if (!box) return;
    box.querySelectorAll('[data-body]').forEach((b) => b.classList.toggle('is-active', b.dataset.body === this._csSelBody));
    box.querySelectorAll('[data-skin]').forEach((b) => b.classList.toggle('is-active', b.dataset.skin === this._csSelSkin));
    this._paintCs();
  }

  /** 部位更换浮层 */
  _renderCsPicker() {
    const box = this.el.csPicker; if (!box) return;
    const d = this._csData;
    if (!d || !this._csPick) { box.hidden = true; box.innerHTML = ''; return; }
    const { kind, slot } = this._csPick;
    const isArmor = kind === 'armor';
    const opts = (isArmor ? d.armorOptions : d.outfitOptions)[slot] || [];
    const cur = isArmor ? d.armor[slot] : d.outfits[slot];
    const label = isArmor ? ARMOR_SLOT_CN[slot] : OUTFIT_CN[slot];
    box.hidden = false;
    box.innerHTML = `
      <div class="cs-picker-head">
        <span>更换「${label}」</span>
        <button class="cs-picker-close" type="button" aria-label="关闭">✕</button>
      </div>
      <div class="cs-picker-list">
        ${opts.length ? opts.map((o) => `
          <button class="cs-picker-item${cur && cur.id === o.id ? ' is-active' : ''}" type="button" data-id="${o.id}">
            <span class="cs-picker-icon">${o.icon}</span>
            <span class="cs-picker-name">${this._escapeHtml(o.name)}</span>
            <span class="cs-picker-meta">${o.level ? `Lv.${o.level}` : ''}</span>
          </button>`).join('') : '<div class="cs-picker-empty">背包里没有可更换的物件</div>'}
      </div>
      ${cur ? '<button class="btn btn-ghost cs-picker-unequip" type="button">卸 下</button>' : ''}
    `;
    box.querySelector('.cs-picker-close')?.addEventListener('click', () => { this._csPick = null; this._renderCsPicker(); });
    box.querySelectorAll('.cs-picker-item').forEach((b) => b.addEventListener('click', () => this.bus.emit('ui:char-equip', b.dataset.id)));
    box.querySelector('.cs-picker-unequip')?.addEventListener('click', () => this.bus.emit('ui:char-unequip', slot));
  }

  /** 顶部提示 toast(2 秒后淡出) */
  showToast(text) {
    if (!text) return;
    const toast = document.createElement('div');
    toast.className = 'career-toast';
    toast.textContent = text;
    this.root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 400);
    }, 3400);
  }

  /** 职业解锁提示 toast */
  _showCareerUnlockToast(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    const names = list.map((id) => CAREER_MAP[id]?.name || id).join('、');
    if (!names) return;
    this.showToast(`✦ 已解锁职业:${names}(可在休息节点切换)`);
  }
}
