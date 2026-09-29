/**
 * minigame.js — 打工小游戏引擎(拾取 / 躲避 / 跑酷)。
 *
 * 一个实例 = 一次挑战:构造后 start(),达标或失败时回调 onEnd({ success, score })。
 * 由 UI 层创建与销毁;奖励结算(行动力 / 金币)在 core/game.js,本模块不接触存档。
 *
 * 操作:
 *   collect / dodge —— ← → / A D 左右移动,或鼠标·手指在画面内拖动
 *   parkour         —— 空格 / ↑ / W / 点击画面 起跳
 *   关闭            —— Esc(由 UI 层处理)
 */

const W = 720;          // 逻辑画布宽
const H = 405;          // 逻辑画布高
const GROUND = H - 58;  // 地面线
const GRAVITY = 2200;
const JUMP_V = 760;
const MOVE_V = 430;     // 键盘水平速度(px/s)
const PLAYER_W = 42;
const PLAYER_H = 46;

export class Minigame {
  constructor(canvas, spec, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.spec = spec;
    this.hooks = hooks;
    canvas.width = W;
    canvas.height = H;
    this._raf = 0;
    this._last = 0;
    this._hudAcc = 0;
    this._reset();

    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    this._onPointerDown = (e) => this._pointer(e, 'down');
    this._onPointerMove = (e) => this._pointer(e, 'move');
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);

    this._draw();
    this._emitHud();
  }

  // ===== 生命周期 =====
  start() {
    if (this.running) return;
    this._reset();
    this.running = true;
    this._last = performance.now();
    this._hudAcc = 1;
    if (this.hooks.onStart) this.hooks.onStart();
    this._raf = requestAnimationFrame((t) => this._frame(t));
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  destroy() {
    this.stop();
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
  }

  // ===== 初始化 =====
  _reset() {
    this.running = false;
    this.over = false;
    this.success = false;
    this.t = 0;
    this.lives = this.spec.lives ?? 3;
    this.score = 0;
    this.distance = 0;
    this.scroll = 0;
    this.invuln = 0;
    this.entities = [];
    this.spawnT = 0.6;
    this.keys = new Set();
    this.pointerX = null;
    this.jumpQueued = false;
    const startX = this.spec.mode === 'parkour' ? 110 : W / 2 - PLAYER_W / 2;
    this.player = { x: startX, y: GROUND - PLAYER_H, w: PLAYER_W, h: PLAYER_H, vy: 0, onGround: true };
  }

  // ===== 主循环 =====
  _frame(ts) {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0, (ts - this._last) / 1000));
    this._last = ts;
    this.t += dt;
    if (!this.over) this._update(dt);
    this._draw();
    this._hudAcc += dt;
    if (this._hudAcc >= 0.06) { this._hudAcc = 0; this._emitHud(); }
    if (this.over) {
      this.running = false;
      this._emitHud();
      if (this.hooks.onEnd) this.hooks.onEnd({ success: this.success, score: this._scoreValue(), mode: this.spec.mode });
      return;
    }
    this._raf = requestAnimationFrame((t) => this._frame(t));
  }

  _update(dt) {
    const mode = this.spec.mode;
    if (mode === 'collect') this._updateCollect(dt);
    else if (mode === 'parkour') this._updateParkour(dt);
    else this._updateDodge(dt);
  }

  _end(success) {
    this.over = true;
    this.success = success;
  }

  _scoreValue() {
    const mode = this.spec.mode;
    if (mode === 'collect') return this.score;
    if (mode === 'parkour') return Math.floor(this.distance);
    return Math.floor(this.t);
  }

  /** 键盘水平移动 / 指针跟随 */
  _movePlayerX(dt, followMul = 1.3) {
    const p = this.player;
    let dir = 0;
    if (this.keys.has('left')) dir -= 1;
    if (this.keys.has('right')) dir += 1;
    if (dir !== 0) {
      this.pointerX = null;
      p.x += dir * MOVE_V * dt;
    } else if (this.pointerX != null) {
      const target = this.pointerX - PLAYER_W / 2;
      const step = MOVE_V * followMul * dt;
      p.x += Math.max(-step, Math.min(step, target - p.x));
    }
    p.x = Math.max(6, Math.min(W - p.w - 6, p.x));
  }

  // ===== 拾取 =====
  _updateCollect(dt) {
    const s = this.spec;
    this._movePlayerX(dt);
    const fall = 170 * (s.speed || 1);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = Math.max(0.24, 0.7 / (s.speed || 1));
      const bad = Math.random() < (s.hazard ?? 0.25);
      this.entities.push({
        kind: bad ? 'bad' : 'good',
        x: 30 + Math.random() * (W - 84),
        y: -28,
        vy: fall * (bad ? 1.18 : 1),
        r: 17,
      });
    }
    if (this.invuln > 0) this.invuln -= dt;
    const px = this.player.x + this.player.w / 2;
    const py = this.player.y + this.player.h / 2;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.y += e.vy * dt;
      if (e.y > H + 40) { this.entities.splice(i, 1); continue; }
      if (Math.hypot(e.x - px, e.y - py) < e.r + 22) {
        this.entities.splice(i, 1);
        if (e.kind === 'good') this.score += 1;
        else if (this.invuln <= 0) { this.lives -= 1; this.invuln = 1.1; }
      }
    }
    if (this.score >= s.goal) return this._end(true);
    if (this.t >= (s.time || 30)) return this._end(false);
    if (this.lives <= 0) return this._end(false);
  }

  // ===== 躲避 =====
  _updateDodge(dt) {
    const s = this.spec;
    this._movePlayerX(dt);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = Math.max(0.3, (s.spawn ?? 0.9) * (0.78 + Math.random() * 0.5));
      const n = Math.random() < 0.16 * (s.speed || 1) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        this.entities.push({
          x: 30 + Math.random() * (W - 84),
          y: -28 - k * 52,
          vy: 215 * (s.speed || 1),
          r: 16,
        });
      }
    }
    if (this.invuln > 0) this.invuln -= dt;
    const px = this.player.x + this.player.w / 2;
    const py = this.player.y + this.player.h / 2;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.y += e.vy * dt;
      if (e.y > H + 40) { this.entities.splice(i, 1); continue; }
      if (this.invuln <= 0 && Math.hypot(e.x - px, e.y - py) < e.r + 20) {
        this.lives -= 1;
        this.invuln = 1.1;
      }
    }
    if (this.lives <= 0) return this._end(false);
    if (this.t >= (s.time || 20)) return this._end(true);
  }

  // ===== 跑酷 =====
  _updateParkour(dt) {
    const s = this.spec;
    const p = this.player;
    const spd = 255 * (s.speed || 1);
    this.scroll += spd * dt;
    this.distance = this.scroll / 10;   // 里程(米)

    if (this.jumpQueued && p.onGround) { p.vy = -JUMP_V; p.onGround = false; }
    this.jumpQueued = false;
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y + p.h >= GROUND) { p.y = GROUND - p.h; p.vy = 0; p.onGround = true; }

    for (const o of this.entities) o.x -= spd * dt;
    this.entities = this.entities.filter((o) => o.x + o.w > -24);

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = Math.max(0.52, (1.2 - 0.16 * (s.speed || 1)) * (0.85 + Math.random() * 0.5));
      const w = 26 + Math.random() * 34;
      const h = 26 + Math.random() * 30;
      this.entities.push({ x: W + 24, w, h });
    }

    if (this.invuln > 0) this.invuln -= dt;
    for (const o of this.entities) {
      const oy = GROUND - o.h;
      if (this._hit(p.x, p.y, p.w, p.h, o.x, oy, o.w, o.h) && this.invuln <= 0) {
        this.lives -= 1;
        this.invuln = 1.2;
      }
    }

    if (this.distance >= (s.goal || 300)) return this._end(true);
    if (this.lives <= 0) return this._end(false);
  }

  _hit(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ===== 输入 =====
  _key(e, down) {
    const k = e.key;
    let handled = false;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { this._setKey('left', down); handled = true; }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { this._setKey('right', down); handled = true; }
    else if (k === ' ' || k === 'Spacebar' || k === 'ArrowUp' || k === 'w' || k === 'W') {
      if (down) this.jumpQueued = true;
      handled = true;
    }
    if (handled) e.preventDefault();
  }

  _setKey(name, down) {
    if (down) this.keys.add(name);
    else this.keys.delete(name);
    if (down) this.pointerX = null;
  }

  _pointer(e, type) {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const x = ((e.clientX - r.left) / r.width) * W;
    if (this.spec.mode === 'parkour') {
      if (type === 'down') { this.jumpQueued = true; if (this.running) e.preventDefault(); }
      return;
    }
    this.pointerX = Math.max(0, Math.min(W, x));
  }

  // ===== 渲染 =====
  _draw() {
    const c = this.ctx;
    const s = this.spec;
    const bg = {
      collect: ['#0d1420', '#1c2634'],
      dodge: ['#1a1016', '#2c1620'],
      parkour: ['#0b1520', '#172a3d'],
    }[s.mode] || ['#0d1420', '#1c2634'];
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, bg[0]);
    g.addColorStop(1, bg[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    // 地面
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.fillRect(0, GROUND, W, H - GROUND);
    c.strokeStyle = 'rgba(201,162,39,0.4)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, GROUND + 0.5);
    c.lineTo(W, GROUND + 0.5);
    c.stroke();

    // 顶部进度条
    const prog = this._progress();
    c.fillStyle = 'rgba(255,255,255,0.1)';
    c.fillRect(0, 0, W, 6);
    c.fillStyle = '#c9a227';
    c.fillRect(0, 0, W * prog, 6);

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '30px serif';

    if (s.mode === 'parkour') {
      for (const o of this.entities) {
        c.fillStyle = 'rgba(208,64,43,0.92)';
        this._roundRect(o.x, GROUND - o.h, o.w, o.h, 6);
        c.fill();
      }
    } else {
      for (const e of this.entities) {
        c.fillText(e.kind === 'good' ? (s.good || '⭐') : (s.bad || '💥'), e.x, e.y);
      }
    }

    // 玩家
    c.font = '34px serif';
    if (this.invuln > 0 && Math.floor(this.t * 14) % 2 === 0) c.globalAlpha = 0.3;
    c.fillText(s.hero || '🧍', this.player.x + this.player.w / 2, this.player.y + this.player.h / 2);
    c.globalAlpha = 1;
  }

  _roundRect(x, y, w, h, r) {
    const c = this.ctx;
    const rad = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rad, y);
    c.arcTo(x + w, y, x + w, y + h, rad);
    c.arcTo(x + w, y + h, x, y + h, rad);
    c.arcTo(x, y + h, x, y, rad);
    c.arcTo(x, y, x + w, y, rad);
    c.closePath();
  }

  _progress() {
    const s = this.spec;
    if (s.mode === 'collect') return Math.max(0, Math.min(1, this.score / s.goal));
    if (s.mode === 'parkour') return Math.max(0, Math.min(1, this.distance / s.goal));
    return Math.max(0, Math.min(1, this.t / s.time));
  }

  _emitHud() {
    const s = this.spec;
    let goalText = '';
    let timeText = '';
    if (s.mode === 'collect') {
      goalText = `${s.goalText}:${this.score} / ${s.goal}`;
      timeText = `剩余 ${Math.max(0, Math.ceil(s.time - this.t))}s`;
    } else if (s.mode === 'parkour') {
      goalText = `${s.goalText}:${Math.floor(this.distance)} / ${s.goal}`;
    } else {
      goalText = `${s.goalText}:${Math.floor(this.t)} / ${s.time}s`;
    }
    if (this.hooks.onHud) {
      this.hooks.onHud({ goalText, timeText, lives: Math.max(0, this.lives) });
    }
  }
}
