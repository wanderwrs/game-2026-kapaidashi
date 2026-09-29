/**
 * Game — 顶层游戏状态机与运行控制器。
 * 流程:菜单 → 剧情(文字抉择) → 战斗 → 战利品 → 剧情 … → 结局。
 *
 * 初始职业(剑术)由第一章 n06 的 effects.assign_career 自动锁定;
 * 后续职业在剧情解锁点通过 switch_career 节点切换。
 */

import { RNG, seedFromString } from './rng.js';
import { EventBus } from './eventbus.js';
import { AudioEngine } from './audio.js';
import { Player } from '../combat/entity.js';
import { Deck } from '../card/deck.js';
import { Battle } from '../combat/battle.js';
import { CARDS } from '../data/data.js';
import { NarrativeEngine, ENDINGS } from '../narrative/engine.js';
import { CHAPTERS } from '../narrative/chapters/index.js';
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
    this.currentBattle = null;
    this._currentRewards = null;
    this._runStartChapter = null;   // 本局起始大章(用于通关判定)
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
    this.engine = new NarrativeEngine({ rng: this.rng, bus: this.bus, chapters: CHAPTERS });
    this.engine.player = this.player;
    this.ui.bindEngine(this.engine);
    this.ui.updateSeed(this.rng.seed);
    this._runStartChapter = startChapter;
    // 直接进入非第一章时,预分配默认职业(剑术)并建立牌组;
    // 进入第一章时,初始职业由剧情推进到 n06(赫尔墨引路)自动锁定。
    if (startChapter !== 'ch01') this.engine.assignCareer('swordsman');
    this.engine.enterChapter(startChapter);
    this.audio.start();
    this.transition(GameState.NARRATIVE);
  }

  /** 主菜单两大章条目(含通关 / 解锁状态) */
  _chapterEntries() {
    const cleared = this.progress?.cleared || {};
    return [
      {
        id: 'ch01',
        badge: '第一大章',
        title: '家园破碎',
        sub: '第一章 · 主线 + 4 条支线 · 约 35 万字',
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

  /** 剧情节点要求开战 */
  _startNarrativeBattle(enemyDef) {
    // 兜底:若因某种原因尚未建牌组,用剑术基础牌组
    if (!this.deck) {
      const base = ['strike', 'strike', 'strike', 'defend', 'defend', 'cleave', 'pommel', 'shield_bash'];
      this.deck = new Deck(base.map((id) => CARDS[id]).filter(Boolean), this.rng);
    }
    this.currentBattle = new Battle({
      player: this.player,
      deck: this.deck,
      enemyDef,
      rng: this.rng,
      bus: this.bus,
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
      const cards = this._rollRewards(3);
      if (cards.length === 0) { this._resolveAfterBattle('victory'); return; }
      this._currentRewards = cards;
      this.ui.renderRewards(cards);
      this.transition(GameState.REWARD);
    } else {
      this._resolveAfterBattle('defeat');
    }
  }

  /** 战斗结果交回剧情引擎,并跳到对应视图(结局节点直接进结算) */
  _resolveAfterBattle(result) {
    this._currentRewards = null;
    this.engine.onBattleResult(result);
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
    this.bus.on('battle:end', (result) => this.onBattleEnd(result));
    this.bus.on('narrative:battle', ({ enemyDef }) => this._startNarrativeBattle(enemyDef));

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
      if (this.player) {
        this.player.maxHp = c.maxHp;
        this.player.hp = c.maxHp;
        this.player.energyMax = c.energyMax;
      }
      this.deck = new Deck(c.starterDeck.map((id) => CARDS[id]).filter(Boolean), this.rng);
    });
  }
}

// ENDINGS 通过 engine 暴露给 UI;此处保留引用以便调试
export { ENDINGS };
