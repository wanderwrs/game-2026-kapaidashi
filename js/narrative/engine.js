/**
 * engine.js — 剧情引擎。
 * 职责:
 *   1. 加载章节,按节点 id 跳转
 *   2. 维护全局 flag(关键抉择标记,决定结局)
 *   3. 维护临时 stats(勇气/慈悲/理智/野性),微调结局细节
 *   4. 节点类型:narrative / choice / battle / career / ending
 *   5. 通过 bus 广播 narrative:refresh,UI 据此渲染
 *
 * 节点数据形态:
 *   { id, kind:'narrative', text, next }
 *   { id, kind:'choice', text, choices: [{ text, next, effects?:{stats?,flags?} }] }
 *   { id, kind:'battle', text, enemyId, victory_next, defeat_next }
 *   { id, kind:'career', text }                       // 职业选择,选择后存入 player.career
 *   { id, kind:'ending', text, ending_id }            // 触发结局
 */

import { ENEMIES } from '../data/data.js';
import { CAREER_MAP } from './careers.js';
import { CHAPTER_IMAGES } from './images.js';

export class NarrativeEngine {
  constructor({ rng, bus, chapters }) {
    this.rng = rng;
    this.bus = bus;
    this.chapters = chapters; // { ch01: { start, nodes:Map }, ... }
    this.currentChapterId = null;
    this.currentNode = null;
    this.flags = new Set();          // 关键抉择标记,持久
    this.stats = { courage: 0, mercy: 0, reason: 0, wild: 0 }; // 临时,微调结局
    this.player = null;              // 由 Game 注入
    this.career = null;
    this._pendingBattle = null;     // 战斗结束后回到的节点
  }

  /** 从指定章节的 start 节点开始 */
  enterChapter(chapterId) {
    const chapter = this.chapters[chapterId];
    if (!chapter) throw new Error(`未知章节:${chapterId}`);
    this.currentChapterId = chapterId;
    this.goto(chapter.start);
  }

  /** 跳转到节点(支持跨章节,next 形如 "ch02:n12") */
  goto(nodeRef) {
    const [chapterId, nodeId] = nodeRef.includes(':') ? nodeRef.split(':') : [this.currentChapterId, nodeRef];
    const chapter = this.chapters[chapterId];
    if (!chapter) throw new Error(`章节不存在:${chapterId}`);
    const node = chapter.nodes.get(nodeId);
    if (!node) throw new Error(`节点不存在:${chapterId}:${nodeId}`);
    this.currentChapterId = chapterId;
    this.currentNode = node;
    this._handleNode();
  }

  /** 玩家在 choice 节点选了某选项 */
  choose(index) {
    if (!this.currentNode || this.currentNode.kind !== 'choice') return;
    const choice = this.currentNode.choices[index];
    if (!choice) return;
    if (choice.effects) this._applyEffects(choice.effects);
    this.goto(choice.next);
  }

  /** 战斗结束回调 */
  onBattleResult(result) {
    if (!this._pendingBattle) return;
    const { victory_next, defeat_next } = this._pendingBattle;
    this._pendingBattle = null;
    if (result === 'victory') {
      this.goto(victory_next);
    } else {
      // 失败:框架版给一次复活机会,后续可改死亡分支
      this.goto(defeat_next || victory_next);
    }
  }

  /** 选择职业(在 career 节点触发) */
  chooseCareer(careerId) {
    this.career = CAREER_MAP[careerId];
    if (this.career && this.player) {
      this.player.maxHp = this.career.maxHp;
      this.player.hp = this.career.maxHp;
      this.player.energyMax = this.career.energyMax;
    }
    // 选完职业自动跳到下一节点(由 UI 决定)
    this.bus.emit('narrative:career-chosen', this.career);
  }

  _handleNode() {
    const node = this.currentNode;
    // 修复:narrative/choice/battle 节点本身的 effects 也要应用
    // (此前仅 choice 的 choices[i].effects 在 choose() 中应用,
    //  导致 narrative 节点上的 effects 如 began_quest / found_brother 等关键 flag 丢失)
    if (node.effects) this._applyEffects(node.effects);
    switch (node.kind) {
      case 'narrative':
      case 'choice':
      case 'career':
      case 'ending':
        this._refresh();
        break;
      case 'battle':
        this._pendingBattle = node;
        this.bus.emit('narrative:battle', {
          enemyDef: ENEMIES[node.enemyPool]?.[0] || ENEMIES.normal[0],
          text: node.text,
        });
        break;
      default:
        this._refresh();
    }
  }

  _applyEffects(effects) {
    if (effects.flags) {
      for (const f of effects.flags) this.flags.add(f);
    }
    if (effects.stats) {
      for (const [k, v] of Object.entries(effects.stats)) {
        this.stats[k] = (this.stats[k] || 0) + v;
      }
    }
  }

  _refresh() {
    this.bus.emit('narrative:refresh', this.snapshot());
  }

  /** 计算最终结局(由全局 flag 与 stats 综合) */
  resolveEnding() {
    // 4 结局:英雄回归 / 悲剧献身 / 隐世退避 / 未尽征程
    const has = (f) => this.flags.has(f);

    if (has('sacrificed_self')) return 'tragic';
    if (has('saved_village') && has('found_brother')) {
      return this.stats.mercy >= 2 ? 'hero' : 'odyssey';
    }
    if (has('abandoned_quest')) return 'recluse';
    return 'odyssey';
  }

  snapshot() {
    const key = this.currentChapterId && this.currentNode
      ? `${this.currentChapterId}:${this.currentNode.id}`
      : null;
    return {
      chapter: this.currentChapterId,
      node: this.currentNode,
      image: key ? CHAPTER_IMAGES[key] : null,
      stats: { ...this.stats },
      flags: [...this.flags],
      career: this.career,
    };
  }
}

export const ENDINGS = {
  hero: { id: 'hero', title: '英雄回归', color: '#f1c40f' },
  tragic: { id: 'tragic', title: '悲剧献身', color: '#c0392b' },
  recluse: { id: 'recluse', title: '隐世退避', color: '#7f8c8d' },
  odyssey: { id: 'odyssey', title: '未尽征程', color: '#3498db' },
};
