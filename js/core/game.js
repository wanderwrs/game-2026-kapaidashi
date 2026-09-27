/**
 * Game — 顶层游戏状态机与运行控制器。
 * 流程:菜单 → 职业选择 → 剧情(文字抉择+战斗) → 结局。
 */

import { RNG, seedFromString } from './rng.js';
import { EventBus } from './eventbus.js';
import { Player } from '../combat/entity.js';
import { Deck } from '../card/deck.js';
import { Battle } from '../combat/battle.js';
import { CARDS } from '../data/data.js';
import { CAREER_MAP } from '../narrative/careers.js';
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
    this.engine = new NarrativeEngine({ rng: this.rng, bus: this.bus, chapters: CHAPTERS });
    this.engine.player = this.player;
    this.ui.bindEngine(this.engine);
    this.ui.updateSeed(this.rng.seed);
    // 直接进入第一章;初始职业(剑术)在剧情推进到 n06(赫尔墨引路)时由 effects.assign_career 自动锁定
    this.engine.enterChapter('ch01');
    this.transition(GameState.NARRATIVE);
  }

  /**
   * 选择/切换职业(由 ui:choose-career 触发,旧 career 节点路径)。
   * 实际切换逻辑在 engine.switchCareer + narrative:career-chosen 监听器中统一处理。
   */
  chooseCareer(careerId) {
    this._switchCareer(careerId);
  }

  transition(next) {
    this.state = next;
    this.ui.showView(next);
    this.bus.emit('state:change', next);
  }

  /** 剧情节点要求开战 */
  _startNarrativeBattle(enemyDef) {
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
    // 战斗结束,回到剧情引擎
    if (this.engine) {
      this.engine.onBattleResult(result);
      this.transition(GameState.NARRATIVE);
    } else {
      this.transition(result === 'victory' ? GameState.VICTORY : GameState.DEFEAT);
    }
  }

  _bindUI() {
    this.bus.on('ui:new-run', () => this.startNewRun());
    this.bus.on('ui:seed-run', () => {
      const input = window.prompt('输入种子(数字或字符串):', '');
      if (input !== null) this.startNewRun(input);
    });
    this.bus.on('ui:choose-career', (id) => this.chooseCareer(id));
    // 职业切换(仅在已解锁的 switch_career 节点使用)
    this.bus.on('ui:switch-career', (id) => this._switchCareer(id));
    this.bus.on('ui:narrative-choose', (i) => this.engine?.choose(i));
    this.bus.on('ui:narrative-next', () => {
      if (this.engine?.currentNode?.next) this.engine.goto(this.engine.currentNode.next);
    });
    this.bus.on('ui:end-turn', () => this.currentBattle?.endPlayerTurn());
    this.bus.on('ui:restart', () => this.startNewRun());
    this.bus.on('battle:end', (result) => this.onBattleEnd(result));
    this.bus.on('narrative:battle', ({ enemyDef }) => this._startNarrativeBattle(enemyDef));
    this.bus.on('narrative:refresh', (snap) => {
      // 若节点是 ending,直接转 VICTORY 触发结局展示
      if (snap.node?.kind === 'ending') {
        this.transition(GameState.VICTORY);
      }
    });
    // 职业初始分配/切换后:重建牌组(初始局 game.deck 仍为 null,会在首次战斗前由 battle 构造兜底)
    this.bus.on('narrative:career-chosen', ({ isSwitch }) => {
      const c = this.engine?.career;
      if (!c) return;
      this.career = c;
      if (this.player) {
        this.player.maxHp = c.maxHp;
        this.player.hp = c.maxHp;
        this.player.energyMax = c.energyMax;
      }
      // 切换或首次分配后,重建牌组(从 ID 解析为 Card 实例)
      this.deck = new Deck(c.starterDeck.map((id) => CARDS[id]).filter(Boolean), this.rng);
      // 仅切换时打印日志(初始分配由剧情自然推进)
      if (isSwitch) {
        // 切换后停留在 switch_career 节点,等待玩家点"继续"
      }
    });
  }

  /** switch_career 节点:玩家选择切换到某个已解锁职业 */
  _switchCareer(careerId) {
    if (!this.engine) return;
    const ok = this.engine.switchCareer(careerId);
    if (!ok) return;
    // narrative:career-chosen 监听器会重建牌组并刷新 UI
    // 切换后保持在当前 switch_career 节点,玩家可继续点击"保持 X 继续旅程"
  }
}

// ENDINGS 通过 engine 暴露给 UI;此处保留引用以便 main.js 调试
export { ENDINGS };
