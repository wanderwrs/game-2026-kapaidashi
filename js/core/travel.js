/**
 * travel.js — 「旅途」实时计时控制器。
 *
 * 一次旅途(地区之间或地区内地点之间)会在真实时间里推进:
 *   · 总耗时由里程与载具倍率算出(见 data/world.js)
 *   · 期间按里程概率触发「途中遭遇」(怪物 / 路人 NPC)
 *   · 遭遇时暂停计时,交给上层处理,处理完调用 resume() 继续
 *
 * 事件:
 *   travel:start    { snapshot }
 *   travel:progress { snapshot }  每 TICK_MS 一次
 *   travel:event    { type:'encounter'|'npc', payload, snapshot }  遭遇(已自动暂停)
 *   travel:arrive   { snapshot }  抵达终点
 */

const TICK_MS = 250;
/** 每多少里「期望」出现一次遭遇 */
const ENCOUNTER_PER_LI = 60;
/** 途中遇到路人 NPC 的概率 */
const NPC_CHANCE = 0.55;

export class Travel {
  constructor({ bus, rng }) {
    this.bus = bus;
    this.rng = rng;
    this.active = false;
    this.paused = false;
    this.total = 0;
    this.elapsed = 0;
    this.info = null;
    this.log = [];
    this._timer = null;
    this._events = [];
    this._fired = new Set();
  }

  /**
   * 开始一段旅途。
   * @param {object} opts
   *   fromLabel/toLabel 起点与终点名称
   *   dist        里程(里)
   *   seconds     真实耗时(秒,已含载具倍率)
   *   level       怪物等级(= 地区章节序号)
   *   poolKey     随机遭遇所用敌人池
   *   npcPool     途中可遇到的路人 NPC 列表
   */
  start(opts) {
    this.stop();
    this.info = { ...opts };
    this.total = Math.max(1, Number(opts.seconds) || 1) * 1000;
    this.elapsed = 0;
    this.paused = false;
    this.active = true;
    this.log = [];
    this._fired = new Set();
    this._events = this._buildEvents(opts);
    this.bus.emit('travel:start', this.snapshot());
    this._emitProgress();
    this._timer = setInterval(() => this._tick(), TICK_MS);
  }

  /** 生成「遭遇」的时间点(以进度比例计) */
  _buildEvents(opts) {
    const dist = Number(opts.dist) || 0;
    if (dist <= 0) return [];
    const events = [];

    // 怪物遭遇:期望每 ENCOUNTER_PER_LI 里一次
    let count = Math.floor(dist / ENCOUNTER_PER_LI);
    if (this.rng.next() < (dist % ENCOUNTER_PER_LI) / ENCOUNTER_PER_LI) count += 1;
    for (let i = 0; i < count; i++) {
      const at = (i + 1) / (count + 1) * (0.55 + this.rng.next() * 0.7);
      events.push({ type: 'encounter', at: Math.min(0.92, Math.max(0.08, at)) });
    }

    // 路人 NPC:整段旅途至多一次
    if (opts.npcPool && opts.npcPool.length && this.rng.next() < NPC_CHANCE) {
      events.push({ type: 'npc', at: 0.25 + this.rng.next() * 0.5, npc: opts.npcPool[Math.floor(this.rng.next() * opts.npcPool.length)] });
    }

    return events.sort((a, b) => a.at - b.at);
  }

  _tick() {
    if (!this.active) return;
    if (this.paused) return;
    this.elapsed += TICK_MS;
    const pct = this.total > 0 ? this.elapsed / this.total : 1;

    // 触发遭遇
    for (let i = 0; i < this._events.length; i++) {
      if (this._fired.has(i)) continue;
      const ev = this._events[i];
      if (pct >= ev.at) {
        this._fired.add(i);
        this.paused = true;
        this._pushLog(ev.type === 'encounter' ? `前方有动静 —— ${this.info?.fromLabel ?? ''}到${this.info?.toLabel ?? ''}的路上,有人拦路。` : '路边有人朝你搭话。');
        this._emitProgress();
        this.bus.emit('travel:event', { type: ev.type, npc: ev.npc, snapshot: this.snapshot() });
        return;
      }
    }

    if (this.elapsed >= this.total) {
      this.elapsed = this.total;
      this._emitProgress();
      this.active = false;
      this._clearTimer();
      this._pushLog(`抵达「${this.info?.toLabel ?? '目的地'}」。`);
      this.bus.emit('travel:arrive', this.snapshot());
      return;
    }
    this._emitProgress();
  }

  /** 遭遇处理完毕,继续赶路 */
  resume() {
    if (!this.active) return;
    this.paused = false;
    this._emitProgress();
  }

  /** 直接抵达(用于调试 / 跳过) */
  skip() {
    if (!this.active) return;
    this.elapsed = this.total;
    this.paused = false;
    this._clearTimer();
    this.active = false;
    this._emitProgress();
    this.bus.emit('travel:arrive', this.snapshot());
  }

  /** 中止旅途(遇难等),返回起点 */
  cancel() {
    this.active = false;
    this.paused = false;
    this._clearTimer();
    this.bus.emit('travel:cancel', this.snapshot());
  }

  stop() {
    this._clearTimer();
    this.active = false;
    this.paused = false;
  }

  _clearTimer() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _pushLog(text) {
    if (!text) return;
    this.log.push(text);
    if (this.log.length > 6) this.log.shift();
  }

  _emitProgress() {
    this.bus.emit('travel:progress', this.snapshot());
  }

  /** 供 UI 渲染的快照 */
  snapshot() {
    const totalSec = Math.round(this.total / 1000);
    const remainSec = Math.max(0, Math.round((this.total - this.elapsed) / 1000));
    const pct = this.total > 0 ? Math.min(1, this.elapsed / this.total) : 1;
    return {
      active: this.active,
      paused: this.paused,
      fromLabel: this.info?.fromLabel ?? '',
      toLabel: this.info?.toLabel ?? '',
      dist: this.info?.dist ?? 0,
      totalSec,
      remainSec,
      pct,
      level: this.info?.level ?? 1,
      vehicle: this.info?.vehicle ?? null,
      log: [...this.log],
    };
  }
}
