/**
 * Game — 顶层游戏状态机与运行控制器。
 * 流程:菜单 → 剧情(文字抉择) → 战斗 → 战利品 → 剧情 … → 结局。
 *
 * 初始职业(剑术)由第一章 n06 的 effects.assign_career 自动锁定;
 * 后续职业在剧情解锁点通过 switch_career 节点切换。
 */

import { RNG, seedFromString } from './rng.js';
import { EventBus } from './eventbus.js';
import { Player } from '../combat/entity.js';
import { Deck } from '../card/deck.js';
import { Battle } from '../combat/battle.js';
import { CARDS } from '../data/data.js';
import { NarrativeEngine, ENDINGS } from '../narrative/engine.js';
import { CHAPTERS } from '../narrative/chapters/index.js';
import { UI } from '../ui/ui.js';

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
    this._bindUI();
    this.transition(GameState.MENU);
  }

  /** 开始新一局:生成种子 → 直接进入第一章剧情(初始职业剑术在 n06 自动 assign) */
  startNewRun(seedInput) {
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
    // 直接进入第一章;初始职业(剑术)在剧情推进到 n06(赫尔墨引路)时自动锁定
    this.engine.enterChapter('ch01');
    this.transition(GameState.NARRATIVE);
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
    this.bus.on('ui:new-run', () => this.startNewRun());
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
