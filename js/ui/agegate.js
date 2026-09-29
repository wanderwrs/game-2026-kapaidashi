/**
 * agegate.js — 游戏前的「年龄限制 + 内容警告」门。
 *
 * 需求:每次打开页面都必须通过,且必须经过真人验证。
 * 判定条件(缺一不可):
 *   1) 勾选「我已年满 18 周岁」
 *   2) 勾选「我已阅读内容警告」
 *   3) 真人验证:按住按钮持续满 3 秒(中途松手即回退)
 * 三项齐备后「进入游戏」才可点击;确认后移除遮罩并把页面交还给游戏。
 *
 * 有意不做任何持久化 —— 刷新 / 重开页面都会再次弹出。
 * 遮罩存在期间 body 带 is-gated:锁住背景滚动、屏蔽 #app 指针事件,
 * 并让 ui.js 的键盘监听短路(见 _bindKeyboard)。
 */

/** 长按判定时长(毫秒) */
const HOLD_MS = 3000;

export class AgeGate {
  constructor() {
    this.root = document.getElementById('agegate');
    if (!this.root) return;
    this.ageBox = document.getElementById('agegate-age');
    this.consentBox = document.getElementById('agegate-consent');
    this.holdBtn = document.getElementById('agegate-hold');
    this.holdFill = document.getElementById('agegate-hold-fill');
    this.holdLabel = document.getElementById('agegate-hold-label');
    this.enterBtn = document.getElementById('agegate-enter');
    this.foot = document.getElementById('agegate-foot');

    this._verified = false; // 真人验证是否已完成
    this._holding = false;  // 当前是否按住
    this._startedAt = 0;
    this._raf = 0;
    this._done = false;     // 是否已放行

    document.body.classList.add('is-gated');
    this._bind();
    this._sync();
  }

  _bind() {
    if (this.holdBtn) {
      const start = (e) => { e.preventDefault(); this._beginHold(); };
      const stop = () => this._endHold();
      this.holdBtn.addEventListener('pointerdown', start);
      this.holdBtn.addEventListener('pointerup', stop);
      this.holdBtn.addEventListener('pointercancel', stop);
      this.holdBtn.addEventListener('pointerleave', stop);
      this.holdBtn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    for (const box of [this.ageBox, this.consentBox]) {
      if (box) box.addEventListener('change', () => this._sync());
    }
    if (this.enterBtn) this.enterBtn.addEventListener('click', () => this._enter());
  }

  /** 开始按住:用 rAF 推进进度条,满 3 秒即通过 */
  _beginHold() {
    if (this._verified || this._holding) return;
    this._holding = true;
    this._startedAt = performance.now();
    if (this.holdBtn) this.holdBtn.classList.add('is-holding');
    const tick = () => {
      if (!this._holding) return;
      const t = Math.min(1, (performance.now() - this._startedAt) / HOLD_MS);
      if (this.holdFill) this.holdFill.style.transform = `scaleX(${t})`;
      if (t >= 1) { this._finishHold(); return; }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  /** 松手:未通过则回退进度 */
  _endHold() {
    if (!this._holding) return;
    this._holding = false;
    cancelAnimationFrame(this._raf);
    if (this._verified) return;
    if (this.holdBtn) this.holdBtn.classList.remove('is-holding');
    if (this.holdFill) this.holdFill.style.transform = 'scaleX(0)';
  }

  /** 按满 3 秒:真人验证通过 */
  _finishHold() {
    this._holding = false;
    cancelAnimationFrame(this._raf);
    this._verified = true;
    if (this.holdFill) this.holdFill.style.transform = 'scaleX(1)';
    if (this.holdBtn) {
      this.holdBtn.classList.remove('is-holding');
      this.holdBtn.classList.add('is-verified');
    }
    if (this.holdLabel) this.holdLabel.textContent = '✓ 真人验证通过';
    this._sync();
  }

  /** 三项条件是否齐备 */
  _ready() {
    return !!(this.ageBox && this.ageBox.checked)
      && !!(this.consentBox && this.consentBox.checked)
      && this._verified;
  }

  /** 同步「进入游戏」按钮的可用态与提示文案 */
  _sync() {
    const ready = this._ready();
    if (this.enterBtn) this.enterBtn.disabled = !ready;
    if (!this.foot) return;
    if (ready) {
      this.foot.textContent = '验证通过 —— 可以进入游戏了。';
      this.foot.classList.add('is-ok');
      return;
    }
    const miss = [];
    if (!(this.ageBox && this.ageBox.checked)) miss.push('勾选「年满 18 周岁」');
    if (!(this.consentBox && this.consentBox.checked)) miss.push('勾选「已阅读内容警告」');
    if (!this._verified) miss.push('按住按钮 3 秒完成真人验证');
    this.foot.textContent = `还需:${miss.join('、')}`;
    this.foot.classList.remove('is-ok');
  }

  /** 放行:淡出遮罩并解除对游戏的封锁 */
  _enter() {
    if (this._done || !this._ready()) return;
    this._done = true;
    document.body.classList.remove('is-gated');
    this.root.classList.add('is-leaving');
    const hide = () => {
      this.root.hidden = true;
      this.root.classList.remove('is-leaving');
    };
    this.root.addEventListener('animationend', hide, { once: true });
    setTimeout(hide, 800); // 兜底:动画事件未触发时也能移除
  }
}
