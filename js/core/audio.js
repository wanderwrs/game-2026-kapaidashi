/**
 * audio.js — 背景音乐引擎(程序化合成,零外部素材)。
 *
 * 以 Web Audio 实时合成一段舒缓的中世纪奇幻氛围乐:
 *   · 低音持续音(drone)铺底,营造旷野与远行的辽阔感
 *   · 缓慢流动的五声音阶琶音,带一点东方/古谣的苍凉
 *   · 偶发高音风铃点缀,配合轻微回声制造空间感
 * 全部由振荡器现场合成,不加载任何第三方音频文件,不存在版权问题。
 *
 * 浏览器禁止在无用户交互时自动播放,因此 start() 必须在用户手势(点击)后调用;
 * arm() 会在首次交互时自动尝试开启,恢复玩家此前的开关偏好。
 */

const PREFS_KEY = 'longji.music.v1';

// 旋律音阶:A 小调五声音阶 + 高八度,音色柔和、略带苍凉
const SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
// 低音持续音:A2 / E3 / A3
const DRONE = [110.0, 164.81, 220.0];
// 旋律推进步长(秒)
const STEP = 1.75;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = this._readPref(); // 玩家是否希望播放音乐
    this._playing = false;
    this._timer = null;
    this._nextNote = 0;
    this._mi = 2;        // 旋律随机游走索引
    this._noteCount = 0;
    this._armed = false;
  }

  get playing() { return this._playing; }

  _readPref() {
    try { return localStorage.getItem(PREFS_KEY) !== 'off'; } catch { return true; }
  }

  _writePref(on) {
    try { localStorage.setItem(PREFS_KEY, on ? 'on' : 'off'); } catch { /* 忽略存储异常 */ }
  }

  /** 在首次用户交互时自动开启(若玩家未主动关闭) */
  arm() {
    if (this._armed) return;
    this._armed = true;
    const kick = () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
      if (this.enabled) this.start();
    };
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
  }

  /** 启动 / 继续播放(首次须在用户手势中调用) */
  start() {
    if (this._playing) return;
    this.enabled = true;
    this._writePref(true);
    try {
      if (!this.ctx) this._build();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this._playing = true;
      this._fadeMaster(0.5, 2.5);
      this._nextNote = this.ctx.currentTime + 0.6;
      this._schedule();
    } catch {
      this._playing = false;
    }
  }

  /** 暂停播放 */
  stop() {
    if (!this._playing) return;
    this._playing = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this._fadeMaster(0.0, 1.2);
  }

  /** 开关切换;返回切换后是否正在播放 */
  toggle() {
    if (this._playing) {
      this.enabled = false;
      this._writePref(false);
      this.stop();
      return false;
    }
    this.start();
    return this._playing;
  }

  _build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;

    // 总音量(0 起,播放时淡入)
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // 整体低通:让音色温暖、不刺耳
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    tone.Q.value = 0.4;
    tone.connect(master);

    // 回声:为旋律增添空间感
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    tone.connect(delay);

    this.master = master;

    // 持续低音铺底
    const drone = ctx.createGain();
    drone.gain.value = 0.35;
    const droneLp = ctx.createBiquadFilter();
    droneLp.type = 'lowpass';
    droneLp.frequency.value = 480;
    drone.connect(droneLp);
    droneLp.connect(tone);
    DRONE.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (i - 1) * 5;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.45 : 0.2;
      osc.connect(g);
      g.connect(drone);
      osc.start();
    });

    // 旋律总线
    const melody = ctx.createGain();
    melody.gain.value = 1;
    melody.connect(tone);
    this._melody = melody;
  }

  _schedule() {
    if (!this._playing || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (this._nextNote < now) this._nextNote = now + 0.1;
    while (this._nextNote < now + 1.6) {
      this._note(this._nextNote);
      this._nextNote += STEP;
    }
    this._timer = setTimeout(() => this._schedule(), 400);
  }

  _note(when) {
    const ctx = this.ctx;
    // 随机游走,保证旋律连贯、不跳脱
    this._mi += Math.random() < 0.5 ? -1 : 1;
    if (this._mi < 0) this._mi = 1;
    if (this._mi > SCALE.length - 1) this._mi = SCALE.length - 2;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = SCALE[this._mi];
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(this._melody);

    const peak = 0.05 + Math.random() * 0.035;
    const dur = 2.6;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.start(when);
    osc.stop(when + dur + 0.1);

    // 每隔几拍偶发一次高音风铃
    this._noteCount++;
    if (this._noteCount % 4 === 0 && Math.random() < 0.6) {
      this._bell(when + 1.1 + Math.random() * 0.5);
    }
  }

  _bell(when) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = Math.random() < 0.5 ? 880 : 1046.5;
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(this._melody);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.04, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 2.8);
    osc.start(when);
    osc.stop(when + 3.0);
  }

  _fadeMaster(target, sec) {
    if (!this.master || !this.ctx) return;
    const now = this.ctx.currentTime;
    const g = this.master.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(target, now + sec);
  }
}
