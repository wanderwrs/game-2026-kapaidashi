/**
 * Game — 顶层游戏状态机与运行控制器。
 * 负责视图切换、运行生命周期、跨模块协调。
 */

import { RNG, seedFromString } from './rng.js';
import { EventBus } from './eventbus.js';
import { Player } from '../combat/entity.js';
import { Deck } from '../card/deck.js';
import { Battle } from '../combat/battle.js';
import { generateMap } from '../map/map.js';
import { CARDS, STARTER_DECK, ENEMIES } from '../data/data.js';
import { UI } from '../ui/ui.js';

export const GameState = Object.freeze({
  MENU: 'menu',
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
    this.map = null;
    this.currentNode = null;
    this.currentBattle = null;
    this.floor = 0;
    this.maxFloor = 0;

    this._bindUI();
    this.transition(GameState.MENU);
  }

  /** 开始新一局,可选指定种子 */
  startNewRun(seedInput) {
    const seed = seedInput
      ? (typeof seedInput === 'number' ? seedInput >>> 0 : seedFromString(String(seedInput)))
      : (Date.now() & 0xffffffff) >>> 0;

    this.rng = new RNG(seed);
    this.floor = 0;
    this.maxFloor = 8; // 框架默认 8 层,可扩展
    this.player = new Player({ maxHp: 70 });
    this.deck = new Deck(STARTER_DECK.map((id) => CARDS[id]).filter(Boolean), this.rng);
    this.map = generateMap(this.rng, this.maxFloor);
    this.currentNode = null;

    this.ui.updateSeed(this.rng.seed);
    this.transition(GameState.MAP);
  }

  /** 状态切换 */
  transition(next) {
    this.state = next;
    this.ui.showView(next);
    this.bus.emit('state:change', next);
  }

  /** 从地图选择一个节点进入 */
  enterNode(nodeId) {
    const node = this.map.nodes.find((n) => n.id === nodeId);
    if (!node || node.visited) return;
    if (this.currentNode && !this._isReachable(node)) return;

    this.currentNode = node;
    node.visited = true;
    this.floor = node.floor;

    if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
      this._startBattle(node);
    } else {
      // 非战斗节点:框架占位,直接回到地图
      this.ui.updateFloor(this.floor);
      if (node.floor >= this.maxFloor) {
        this.transition(GameState.VICTORY);
      } else {
        this.transition(GameState.MAP);
        this.ui.renderMap(this.map, this.currentNode);
      }
    }
  }

  /** 判断节点是否从当前节点可达(同层或下一层相邻) */
  _isReachable(node) {
    return node.floor === this.currentNode.floor + 1;
  }

  /** 启动一场战斗 */
  _startBattle(node) {
    const pool = node.type === 'boss' ? ENEMIES.boss : node.type === 'elite' ? ENEMIES.elite : ENEMIES.normal;
    const enemyDef = this.rng.pick(pool);
    this.currentBattle = new Battle({
      player: this.player,
      deck: this.deck,
      enemyDef,
      rng: this.rng,
      bus: this.bus,
    });
    this.ui.bindBattle(this.currentBattle);
    this.ui.updateFloor(this.floor);
    this.transition(GameState.BATTLE);
    this.currentBattle.start();
  }

  /** 战斗结束回调 */
  onBattleEnd(result) {
    if (result === 'victory') {
      if (this.floor >= this.maxFloor) {
        this.transition(GameState.VICTORY);
      } else {
        this.transition(GameState.MAP);
        this.ui.renderMap(this.map, this.currentNode);
      }
    } else {
      this.transition(GameState.DEFEAT);
    }
  }

  _bindUI() {
    this.bus.on('ui:new-run', () => this.startNewRun());
    this.bus.on('ui:seed-run', () => {
      const input = window.prompt('输入种子(数字或字符串):', '');
      if (input !== null) this.startNewRun(input);
    });
    this.bus.on('ui:select-node', (id) => this.enterNode(id));
    this.bus.on('ui:end-turn', () => this.currentBattle?.endPlayerTurn());
    this.bus.on('ui:restart', () => {
      this.startNewRun();
    });
    this.bus.on('battle:end', (result) => this.onBattleEnd(result));
  }
}
