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

import { CAREER_MAP } from './careers.js?v=20260930h';
import { CHAPTER_IMAGES } from './images.js?v=20260930h';

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
    this.career = null;              // 当前职业
    this.unlockedCareers = new Set(); // 已解锁可切换的职业
    this._pendingBattle = null;     // 战斗结束后回到的节点
    // 地图剧情门控:每章的门控锚点节点(所有地点节点),抵达后才开启该段剧情
    this.gates = {};                // chapterId -> [nodeId, ...]
    this.gatePassed = new Set();    // 已通过的锚点( `${chapterId}:${nodeId}` )
    this._gateTarget = null;        // 当前待开启的锚点
    this._bypassGate = false;       // resumeGate 期间跳过门控
  }

  /** 设置所有章节的门控锚点 */
  setGates(gates) {
    this.gates = gates || {};
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
    // 门控:该节点是尚未抵达的地点锚点 → 暂停,交由地图决定何时开启
    if (this._shouldGate(chapterId, nodeId)) {
      this._gateTarget = { chapterId, nodeId };
      this.bus.emit('narrative:gate', { chapterId, nodeId });
      return;
    }
    this.currentChapterId = chapterId;
    this.currentNode = node;
    this._handleNode();
  }

  _shouldGate(chapterId, nodeId) {
    if (this._bypassGate) return false;
    const list = this.gates?.[chapterId];
    if (!list || !list.includes(nodeId)) return false;
    return !this.gatePassed.has(`${chapterId}:${nodeId}`);
  }

  /** 玩家已在地图上抵达该地点(找到 NPC)→ 开启这段剧情 */
  resumeGate() {
    const t = this._gateTarget;
    if (!t) return false;
    this._gateTarget = null;
    this.gatePassed.add(`${t.chapterId}:${t.nodeId}`);
    this._bypassGate = true;
    try {
      this.goto(`${t.chapterId}:${t.nodeId}`);
    } finally {
      this._bypassGate = false;
    }
    return true;
  }

  /** 当前待开启的锚点 */
  get pendingGate() { return this._gateTarget; }

  /** 重新武装某锚点(战败退回后须重新抵达该地点再战) */
  rearmGate(chapterId, nodeId) {
    this.gatePassed.delete(`${chapterId}:${nodeId}`);
    this._gateTarget = { chapterId, nodeId };
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

  /** 选择职业(在 career 节点触发;旧路径,初始职业已改由 assign_career 自动分配) */
  chooseCareer(careerId) {
    const c = CAREER_MAP[careerId];
    if (!c) return;
    this.career = c;
    this.unlockedCareers.add(careerId);
    if (this.player) {
      this.player.maxHp = c.maxHp;
      this.player.hp = c.maxHp;
      this.player.energyMax = c.energyMax;
    }
    this.bus.emit('narrative:career-chosen', { career: c, isSwitch: false });
  }

  _handleNode() {
    const node = this.currentNode;
    // career_branch:根据当前职业自动路由到不同 next(专属剧情)
    if (node.career_branch && this.career) {
      const target = node.career_branch[this.career.id] || node.career_branch.default;
      if (target) {
        this.goto(target);
        return;
      }
    }
    // 应用节点 effects(含 assign_career / unlock_career / flags / stats)
    if (node.effects) this._applyEffects(node.effects);
    switch (node.kind) {
      case 'narrative':
      case 'choice':
      case 'career':
      case 'switch_career':
      case 'ending':
        this._refresh();
        break;
      case 'battle':
        this._pendingBattle = node;
        this.bus.emit('narrative:battle', { poolKey: node.enemyPool, text: node.text });
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
    // 初始锁定职业(剧情推进中自动 assign,不经玩家选择)
    if (effects.assign_career && !this.career) {
      this.assignCareer(effects.assign_career);
    }
    // 解锁可切换职业(后续可在解锁点选择是否切换)
    if (effects.unlock_career) {
      const list = Array.isArray(effects.unlock_career) ? effects.unlock_career : [effects.unlock_career];
      const newly = [];
      for (const id of list) {
        if (!this.unlockedCareers.has(id)) {
          this.unlockedCareers.add(id);
          newly.push(id);
        }
      }
      if (newly.length) this.bus.emit('narrative:career-unlocked', newly);
    }
  }

  /** 初始锁定职业(剧情自动 assign,不经玩家选择) */
  assignCareer(careerId) {
    const c = CAREER_MAP[careerId];
    if (!c) return;
    this.career = c;
    this.unlockedCareers.add(careerId);
    if (this.player) {
      this.player.maxHp = c.maxHp;
      this.player.hp = c.maxHp;
      this.player.energyMax = c.energyMax;
    }
    this.bus.emit('narrative:career-chosen', { career: c, isSwitch: false });
  }

  /** 切换职业(需先解锁)。返回 true 表示切换成功 */
  switchCareer(careerId) {
    if (!this.unlockedCareers.has(careerId)) return false;
    const c = CAREER_MAP[careerId];
    if (!c || c.id === this.career?.id) return false;
    this.career = c;
    if (this.player) {
      this.player.maxHp = c.maxHp;
      this.player.hp = c.maxHp;
      this.player.energyMax = c.energyMax;
    }
    this.bus.emit('narrative:career-chosen', { career: c, isSwitch: true });
    return true;
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
      unlockedCareers: [...this.unlockedCareers],
    };
  }
}

export const ENDINGS = {
  hero: {
    id: 'hero', title: '英雄回归', color: '#e8cd6e',
    desc: '你守住了弟弟,也守住了父亲守了一辈子的约。王城的钟声为你而鸣,龙脊山脉在你身后沉入云雾。',
  },
  tragic: {
    id: 'tragic', title: '悲剧献身', color: '#e0553f',
    desc: '你替弟弟承受了龙化,血脉再也回不去了。但你守住了他——用你自己,换他做一个人。',
  },
  recluse: {
    id: 'recluse', title: '隐世退避', color: '#7f8c8d',
    desc: '你放下了剑,回到平静的日子。有些约,你没能守完——只能交给下一个人。',
  },
  odyssey: {
    id: 'odyssey', title: '未尽征程', color: '#6fc0e8',
    desc: '你做了你的决定。山海未尽,守约未竟。现在,轮到下一位少年,做他的决定。',
  },
};
