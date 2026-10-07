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
/** 音量偏好(0~1) */
const VOLUME_KEY = 'longji.volume.v1';
/** 播放时的总线目标增益(再乘以玩家音量) */
const MASTER_ON = 0.5;

/**
 * 地区主题音乐配置:
 *   scale  旋律音阶(Hz) — 不同调性营造不同氛围
 *   drone  低音持续音(Hz)
 *   step   旋律推进步长(秒) — 步长越大越舒缓
 *   tone   低通截止频率 — 越低越温暖/朦胧
 *   label  主题名(仅供调试)
 */
const THEME_MUSIC = {
  // 村庄:温暖、朴素,A 小调五声
  village: {
    scale: [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
    drone: [110.0, 164.81, 220.0],
    step: 1.75, tone: 2200, label: '村庄',
  },
  // 森林:幽静、神秘,D 小调
  forest: {
    scale: [146.83, 174.61, 196.0, 233.08, 261.63, 293.66, 349.23],
    drone: [73.42, 110.0, 146.83],
    step: 2.1, tone: 1800, label: '森林',
  },
  // 主城:恢弘、庄严,C 大调
  city: {
    scale: [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 523.25, 587.33],
    drone: [130.81, 196.0, 261.63],
    step: 1.4, tone: 2600, label: '主城',
  },
  // 港口:开阔、咸涩,G 大调
  port: {
    scale: [196.0, 220.0, 246.94, 261.63, 293.66, 329.66, 392.0, 440.0],
    drone: [98.0, 146.83, 196.0],
    step: 1.9, tone: 2400, label: '港口',
  },
  // 山地:苍凉、凛冽,E 小调
  mountain: {
    scale: [164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0],
    drone: [82.41, 123.47, 164.81],
    step: 2.3, tone: 2000, label: '山地',
  },
  // 废墟:压抑、不安,B 小调
  ruins: {
    scale: [123.47, 146.83, 155.56, 185.0, 196.0, 233.08, 246.94],
    drone: [61.74, 92.5, 123.47],
    step: 2.5, tone: 1600, label: '废墟',
  },
  // 浮空:空灵、奇幻,D 大调高八度
  sky: {
    scale: [293.66, 329.63, 369.99, 392.0, 440.0, 493.88, 587.33, 659.25],
    drone: [146.83, 220.0, 293.66],
    step: 1.6, tone: 3000, label: '浮空',
  },
  // 悬崖/险地:紧张、尖锐,F# 小调
  cliff: {
    scale: [185.0, 207.65, 233.08, 277.18, 311.13, 369.99, 415.30],
    drone: [92.5, 138.59, 185.0],
    step: 1.5, tone: 2800, label: '险地',
  },
  // 营地:篝火般的温暖,G 小调
  camp: {
    scale: [196.0, 233.08, 261.63, 293.66, 349.23, 392.0, 466.16],
    drone: [98.0, 146.83, 196.0],
    step: 2.0, tone: 2100, label: '营地',
  },
};

// 默认主题(村庄)
const DEFAULT_THEME = 'village';

// 旋律推进步长(秒) — 默认值,实际由主题决定
const STEP = 1.75;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = this._readPref(); // 玩家是否希望播放音乐
    this._volume = this._readVolume(); // 背景音乐音量(0~1)
    this._playing = false;
    this._timer = null;
    this._nextNote = 0;
    this._mi = 2;        // 旋律随机游走索引
    this._noteCount = 0;
    this._armed = false;
    this._theme = DEFAULT_THEME;
    this._droneOscs = []; // 当前的低音振荡器,换主题时需停掉重建
    this._droneGain = null;
  }

  get playing() { return this._playing; }

  /** 当前主题名 */
  get theme() { return this._theme; }

  /** 当前音量(0~1) */
  get volume() { return this._volume; }

  /**
   * 切换到指定地区主题的音乐。
   * 若正在播放,会平滑过渡(淡出 → 重建低音 → 淡入)。
   * @param {string} theme 地区主题(village/forest/city/port/mountain/ruins/sky/cliff/camp)
   */
  setTheme(theme) {
    const t = THEME_MUSIC[theme] || THEME_MUSIC[DEFAULT_THEME];
    if (this._theme === theme) return;
    this._theme = theme;
    // 未构建音频上下文时,仅记录主题,等 _build 时应用
    if (!this.ctx || !this._playing) return;
    // 重建低音铺底
    this._rebuildDrone(t);
  }

  _readPref() {
    try { return localStorage.getItem(PREFS_KEY) !== 'off'; } catch { return true; }
  }

  _writePref(on) {
    try { localStorage.setItem(PREFS_KEY, on ? 'on' : 'off'); } catch { /* 忽略存储异常 */ }
  }

  _readVolume() {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (raw === null) return 1;
      const v = parseFloat(raw);
      return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
    } catch { return 1; }
  }

  _writeVolume(v) {
    try { localStorage.setItem(VOLUME_KEY, String(v)); } catch { /* 忽略存储异常 */ }
  }

  /**
   * 设置背景音乐音量(0~1)。
   * 若此前音乐处于关闭状态且新音量大于 0,顺带开启播放(拖动滑块本身即用户手势)。
   */
  setVolume(v) {
    const vol = Math.max(0, Math.min(1, Number(v) || 0));
    this._volume = vol;
    this._writeVolume(vol);
    if (vol > 0 && !this._playing) { this.start(); return; }
    if (this._playing) this._fadeMaster(MASTER_ON * vol, 0.2);
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
      this._fadeMaster(MASTER_ON * this._volume, 2.5);
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
    const theme = THEME_MUSIC[this._theme] || THEME_MUSIC[DEFAULT_THEME];

    // 总音量(0 起,播放时淡入)
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // 整体低通:让音色温暖、不刺耳(按主题调整)
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = theme.tone;
    tone.Q.value = 0.4;
    tone.connect(master);
    this._toneFilter = tone;

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

    // 持续低音铺底(存储引用,换主题时可重建)
    const drone = ctx.createGain();
    drone.gain.value = 0.35;
    this._droneGain = drone;
    const droneLp = ctx.createBiquadFilter();
    droneLp.type = 'lowpass';
    droneLp.frequency.value = 480;
    drone.connect(droneLp);
    droneLp.connect(tone);
    this._droneOscs = [];
    theme.drone.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (i - 1) * 5;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.45 : 0.2;
      osc.connect(g);
      g.connect(drone);
      osc.start();
      this._droneOscs.push(osc);
    });

    // 旋律总线
    const melody = ctx.createGain();
    melody.gain.value = 1;
    melody.connect(tone);
    this._melody = melody;
  }

  /** 换主题时重建低音铺底与低通截止频率 */
  _rebuildDrone(theme) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    // 停掉旧的低音振荡器
    for (const osc of this._droneOscs) {
      try {
        osc.stop(now + 0.3);
      } catch { /* 已停止 */ }
    }
    this._droneOscs = [];
    // 调整低通频率
    if (this._toneFilter) {
      this._toneFilter.frequency.cancelScheduledValues(now);
      this._toneFilter.frequency.linearRampToValueAtTime(theme.tone, now + 1.5);
    }
    // 启动新的低音振荡器
    if (this._droneGain) {
      theme.drone.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = (i - 1) * 5;
        const g = ctx.createGain();
        g.gain.value = 0;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(i === 0 ? 0.45 : 0.2, now + 1.5);
        osc.connect(g);
        g.connect(this._droneGain);
        osc.start(now);
        this._droneOscs.push(osc);
      });
    }
  }

  _schedule() {
    if (!this._playing || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (this._nextNote < now) this._nextNote = now + 0.1;
    const step = THEME_MUSIC[this._theme]?.step || STEP;
    while (this._nextNote < now + 1.6) {
      this._note(this._nextNote);
      this._nextNote += step;
    }
    this._timer = setTimeout(() => this._schedule(), 400);
  }

  _note(when) {
    const ctx = this.ctx;
    const scale = THEME_MUSIC[this._theme]?.scale || THEME_MUSIC[DEFAULT_THEME].scale;
    // 随机游走,保证旋律连贯、不跳脱
    this._mi += Math.random() < 0.5 ? -1 : 1;
    if (this._mi < 0) this._mi = 1;
    if (this._mi > scale.length - 1) this._mi = scale.length - 2;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = scale[this._mi];
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
