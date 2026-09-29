/**
 * UI — DOM 渲染层(视觉与交互)。
 * 订阅 battle:refresh / battle:fx / narrative:refresh 事件渲染快照,按钮事件转发给 bus。
 * 不持有战斗/剧情状态,仅做视图;逻辑集中在 Game/Battle/NarrativeEngine。
 *
 * 交互增强:
 *   · 剧情文本逐段渐显,点击可跳过,读毕再浮现选项
 *   · 键盘操作:数字键选选项 / 空格·回车推进 / 点击文本区域推进
 *   · 战斗:血条动画、伤害飘字、受击抖动、手牌类型描边
 *   · 章节进度条、职业解锁提示、结局面板
 */

import { GameState } from '../core/game.js';
import { CAREERS, CAREER_MAP } from '../narrative/careers.js';
import { ITEMS, ITEM_CATEGORY_CN, sellPrice } from '../data/items.js';
import { cardMpCost } from '../data/data.js';
import { ENDINGS } from '../narrative/engine.js';
import { CHAPTER_ORDER } from '../narrative/chapters/index.js';
import { SceneView } from './scene.js';

const STATUS_LABELS = {
  vulnerable: '易伤',
  weak: '虚弱',
  frail: '脆弱',
  strength: '力量',
};

const STAT_LABELS = {
  courage: '勇气',
  mercy: '慈悲',
  reason: '理智',
  wild: '野性',
};

const TYPE_LABELS = {
  attack: '攻击',
  skill: '技能',
  power: '能力',
};

/** 逐段渐显节奏:段间基础间隔(ms) + 按段长加权 */
const PARA_BASE_MS = 380;
const PARA_PER_CHAR_MS = 18;
const PARA_MAX_MS = 1600;
const PARA_FADE_MS = 520;

export class UI {
  constructor(rootEl, bus) {
    this.root = rootEl;
    this.bus = bus;
    this.battle = null;
    this.engine = null;
    this.economy = null;          // 由 Game 注入,用于渲染金币/背包/战斗药品
    this._paraTimer = null;       // 逐段渐显计时器
    this._typing = false;         // 是否正在逐段呈现
    this._fullText = '';          // 当前节点全文
    this._paraEls = [];           // 段落 DOM 列表
    this._paraIndex = 0;          // 下一段待显示索引
    this._choicesReady = false;   // 选项是否已浮现
    this._howtoOpen = false;      // 游戏说明弹窗是否打开
    this._lastEnemyHp = null;    // 用于计算伤害飘字
    this._lastPlayerHp = null;
    this._cache();
    // 像素图侧栏(人物 / 环境),独立于剧情文字窗口
    this.scene = new SceneView({
      charCanvas: this.el.sceneCharCanvas,
      envCanvas: this.el.sceneEnvCanvas,
      charName: this.el.sceneCharName,
      charOutfit: this.el.sceneCharOutfit,
      charStatus: this.el.sceneCharStatus,
      envName: this.el.sceneEnvName,
      envDesc: this.el.sceneEnvDesc,
    });
    this._bindStaticButtons();
    this._bindBus();
    this._bindKeyboard();
    this._spawnEmbers();
  }

  _cache() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      seed: $('seed-display'),
      turn: $('turn-display'),
      gold: $('gold-display'),
      ap: $('ap-display'),
      chapterTitle: $('chapter-title'),
      progressFill: $('progress-fill'),
      views: {
        menu: $('view-menu'),
        career: $('view-career'),
        narrative: $('view-narrative'),
        map: $('view-map'),
        shop: $('view-shop'),
        bag: $('view-bag'),
        job: $('view-job'),
        battle: $('view-battle'),
        reward: $('view-reward'),
        result: $('view-result'),
      },
      careerGrid: $('career-grid'),
      chapterSelect: $('chapter-select'),
      btnMusic: $('btn-music'),
      howto: $('howto'),
      narrativeStats: $('narrative-stats'),
      narrativeVitals: $('narrative-vitals'),
      narrativeText: $('narrative-text'),
      narrativeChoices: $('narrative-choices'),
      narrativeHint: $('narrative-hint'),
      sceneCharCanvas: $('scene-char-canvas'),
      sceneEnvCanvas: $('scene-env-canvas'),
      sceneCharName: $('scene-char-name'),
      sceneCharOutfit: $('scene-char-outfit'),
      sceneCharStatus: $('scene-char-status'),
      sceneEnvName: $('scene-env-name'),
      sceneEnvDesc: $('scene-env-desc'),
      // 地区地图 / 市场 / 背包 / 打工
      mapRegionName: $('map-region-name'),
      mapRes: $('map-res'),
      mapHint: $('map-hint'),
      mapStops: $('map-stops'),
      mapServices: $('map-services'),
      btnMapStory: $('btn-map-story'),
      shopRes: $('shop-res'),
      shopList: $('shop-list'),
      btnShopBack: $('btn-shop-back'),
      bagRes: $('bag-res'),
      bagEquipped: $('bag-equipped'),
      bagList: $('bag-list'),
      btnBagBack: $('btn-bag-back'),
      jobRes: $('job-res'),
      jobList: $('job-list'),
      btnJobBack: $('btn-job-back'),
      battleItems: $('battle-items'),
      rewardSub: $('reward-sub'),
      enemyZone: $('enemy-zone'),
      playerZone: $('player-zone'),
      battleLog: $('battle-log'),
      hand: $('hand'),
      drawCount: $('draw-count'),
      discardCount: $('discard-count'),
      energy: $('energy-display'),
      btnEndTurn: $('btn-end-turn'),
      rewardGrid: $('reward-grid'),
      btnSkipReward: $('btn-skip-reward'),
      resultEyebrow: $('result-eyebrow'),
      resultTitle: $('result-title'),
      resultDesc: $('result-desc'),
      resultStats: $('result-stats'),
    };
  }

  /**
   * 绑定静态按钮。
   * 所有查询均做空值保护:任一元素缺失也不会中断绑定流程,
   * 避免因单个节点缺失导致整个应用初始化失败、所有按钮失效。
   */
  _bindStaticButtons() {
    const on = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    };
    on('btn-seed-run', 'click', () => this.bus.emit('ui:seed-run'));
    on('btn-restart', 'click', () => this.bus.emit('ui:restart'));
    on('btn-music', 'click', () => this.bus.emit('ui:toggle-music'));
    // 游戏说明:任意 [data-howto] 按钮打开,[data-howto-close] 关闭
    document.querySelectorAll('[data-howto]').forEach((b) => {
      b.addEventListener('click', () => this.openHowto());
    });
    document.querySelectorAll('[data-howto-close]').forEach((b) => {
      b.addEventListener('click', () => this.closeHowto());
    });
    if (this.el.btnEndTurn) this.el.btnEndTurn.addEventListener('click', () => this.bus.emit('ui:end-turn'));
    if (this.el.btnSkipReward) this.el.btnSkipReward.addEventListener('click', () => this.bus.emit('ui:skip-reward'));
    // 地图 / 市场 / 背包 / 打工
    if (this.el.btnMapStory) this.el.btnMapStory.addEventListener('click', () => this.bus.emit('ui:map-story'));
    if (this.el.btnShopBack) this.el.btnShopBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    if (this.el.btnBagBack) this.el.btnBagBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    if (this.el.btnJobBack) this.el.btnJobBack.addEventListener('click', () => this.bus.emit('ui:back-map'));
    // 点击剧情文本区域:正在打字则跳过,否则推进
    if (this.el.narrativeText) this.el.narrativeText.addEventListener('click', () => this._onTextAreaClick());
  }

  _bindBus() {
    this.bus.on('battle:refresh', (snap) => this._renderBattle(snap));
    this.bus.on('battle:log', (msg) => this._renderBattleLog(msg));
    this.bus.on('battle:fx', (fx) => this._playBattleFx(fx));
    this.bus.on('narrative:refresh', (snap) => this._renderNarrative(snap));
    this.bus.on('narrative:career-unlocked', (ids) => this._showCareerUnlockToast(ids));
    this.bus.on('narrative:career-chosen', () => {
      if (this.engine) this._renderNarrative(this.engine.snapshot());
    });
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // 忽略输入框内按键
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // 游戏说明弹窗打开时,仅响应 Esc 关闭,屏蔽其余游戏操作
      if (this._howtoOpen) {
        if (e.key === 'Escape') { e.preventDefault(); this.closeHowto(); }
        return;
      }

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this._primaryAction();
        return;
      }
      const n = parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 9) {
        this._selectChoiceByIndex(n - 1);
      }
    });
  }

  /** 空格/回车:跳过打字 → 推进剧情 → 战斗结束回合 */
  _primaryAction() {
    if (this.state === GameState.BATTLE) {
      this.bus.emit('ui:end-turn');
      return;
    }
    if (this.state !== GameState.NARRATIVE) return;
    if (this._typing) { this._skipTyping(); return; }
    const node = this.engine?.currentNode;
    if (!node) return;
    if (node.kind === 'choice') return; // 选项必须显式选择
    if (node.kind === 'switch_career') return;
    if (node.next) this.bus.emit('ui:narrative-next');
  }

  _onTextAreaClick() {
    if (this.state !== GameState.NARRATIVE) return;
    if (this._typing) { this._skipTyping(); return; }
    const node = this.engine?.currentNode;
    if (node && (node.kind === 'narrative' || node.kind === 'ending') && node.next) {
      this.bus.emit('ui:narrative-next');
    }
  }

  _selectChoiceByIndex(i) {
    if (this.state !== GameState.NARRATIVE) return;
    if (this._typing) return;
    const nodes = this.el.narrativeChoices.querySelectorAll('.narrative-choice-btn, .career-card, .switch-keep-btn');
    const el = nodes[i];
    if (el) el.click();
  }

  /** 主菜单余烬 */
  _spawnEmbers() {
    const box = document.getElementById('menu-embers');
    if (!box) return;
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span');
      s.style.left = `${Math.random() * 100}%`;
      s.style.animationDuration = `${6 + Math.random() * 7}s`;
      s.style.animationDelay = `${-Math.random() * 8}s`;
      s.style.setProperty('--drift', `${(Math.random() - 0.5) * 80}px`);
      const scale = 0.6 + Math.random() * 0.9;
      s.style.width = `${3 * scale}px`;
      s.style.height = `${3 * scale}px`;
      box.appendChild(s);
    }
  }

  // ===== 视图 =====
  showView(state) {
    this.state = state;
    Object.values(this.el.views).forEach((v) => v && v.classList.remove('is-active'));
    let target = this.el.views.battle;
    if (state === GameState.MENU) target = this.el.views.menu;
    else if (state === GameState.CAREER) target = this.el.views.career;
    else if (state === GameState.NARRATIVE) target = this.el.views.narrative;
    else if (state === GameState.MAP) target = this.el.views.map;
    else if (state === GameState.SHOP) target = this.el.views.shop;
    else if (state === GameState.BAG) target = this.el.views.bag;
    else if (state === GameState.JOB) target = this.el.views.job;
    else if (state === GameState.BATTLE) target = this.el.views.battle;
    else if (state === GameState.REWARD) target = this.el.views.reward;
    else if (state === GameState.VICTORY || state === GameState.DEFEAT) target = this.el.views.result;
    if (target) target.classList.add('is-active');

    if (state === GameState.VICTORY) this._renderResult(true);
    else if (state === GameState.DEFEAT) this._renderResult(false);
  }

  updateSeed(seed) {
    this.el.seed.textContent = `#${(seed >>> 0).toString(16)}`;
  }

  /** 顶栏与各面板的资源显示(金币 / 行动力) */
  renderResources(economy) {
    if (!economy) return;
    const goldTxt = `${economy.gold}`;
    const apTxt = `${economy.ap}/${economy.apCap()}`;
    if (this.el.gold) this.el.gold.textContent = goldTxt;
    if (this.el.ap) this.el.ap.textContent = apTxt;
    const chips = `<span class="res-chip">🪙 ${goldTxt}</span><span class="res-chip">⚡ ${apTxt}</span>`;
    for (const el of [this.el.mapRes, this.el.shopRes, this.el.bagRes, this.el.jobRes]) {
      if (el) el.innerHTML = chips;
    }
  }

  /** 章节进度 */
  _renderChapterMeta() {
    const engine = this.engine;
    if (!engine) return;
    const id = engine.currentChapterId;
    const chapter = engine.chapters?.[id];
    const idx = CHAPTER_ORDER.indexOf(id);
    const total = CHAPTER_ORDER.length;
    this.el.chapterTitle.textContent = chapter?.title || '—';
    const pct = idx >= 0 ? Math.round(((idx + 1) / total) * 100) : 0;
    this.el.progressFill.style.width = `${pct}%`;
  }

  // ===== 主菜单:两大章入口 =====
  /** 渲染主菜单的大章卡片(含通关 / 锁定状态);锁定卡片点击给出提示 */
  renderChapterSelect(entries) {
    const box = this.el.chapterSelect;
    if (!box) return;
    box.innerHTML = '';
    (entries || []).forEach((e) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `chapter-entry${e.locked ? ' is-locked' : ''}${e.cleared ? ' is-cleared' : ''}`;
      const state = e.locked ? '🔒 未解锁' : (e.cleared ? '✓ 已通关' : '▶ 可挑战');
      card.innerHTML = `
        <div class="chapter-entry-head">
          <span class="chapter-entry-badge">${e.badge}</span>
          <span class="chapter-entry-state">${state}</span>
        </div>
        <div class="chapter-entry-title">${this._escapeHtml(e.title)}</div>
        <div class="chapter-entry-sub">${this._escapeHtml(e.sub)}</div>
        ${e.locked ? '<div class="chapter-entry-lock">通关「第一大章 · 家园破碎」后解锁</div>' : ''}
      `;
      card.addEventListener('click', () => {
        if (e.locked) {
          card.classList.remove('shake');
          void card.offsetWidth;
          card.classList.add('shake');
          this.showToast('先通关「第一大章 · 家园破碎」,才能踏上新的旅程');
          return;
        }
        this.bus.emit('ui:start-chapter', e.id);
      });
      box.appendChild(card);
    });
  }

  /** 背景音乐按钮状态 */
  setMusicState(on) {
    const btn = this.el.btnMusic;
    if (!btn) return;
    btn.classList.toggle('is-on', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = on ? '背景音乐:开' : '背景音乐:关';
  }

  // ===== 游戏说明(操作指南) =====
  openHowto() {
    if (!this.el.howto) return;
    this.el.howto.hidden = false;
    this._howtoOpen = true;
  }

  closeHowto() {
    if (!this.el.howto) return;
    this.el.howto.hidden = true;
    this._howtoOpen = false;
  }

  // ===== 职业选择视图(扩展用) =====
  renderCareers() {
    this.el.careerGrid.innerHTML = '';
    for (const c of CAREERS) {
      this.el.careerGrid.appendChild(this._careerCardEl(c, () => this.bus.emit('ui:choose-career', c.id)));
    }
  }

  _careerCardEl(c, onClick, compact = false) {
    const card = document.createElement('div');
    card.className = 'career-card';
    card.innerHTML = `
      <div class="career-icon-row">
        <div class="career-icon" style="background:${c.color}">${c.icon}</div>
        <div>
          <div class="career-title">${c.name}</div>
          <div class="career-class">${c.title}</div>
        </div>
      </div>
      ${compact ? '' : `<div class="career-story">${this._escapeHtml(c.backstory)}</div>`}
      <div class="career-meta">
        <span>HP <code>${c.maxHp}</code></span>
        <span>能量 <code>${c.energyMax}</code></span>
        <span>特色卡 <code>${c.signatureCards.length}</code></span>
      </div>
    `;
    card.addEventListener('click', onClick);
    return card;
  }

  // ===== 剧情视图 =====
  _renderNarrative(snap) {
    const node = snap.node;
    if (!node) return;
    this._stopTyping();
    this._renderChapterMeta();

    // 状态条:职业 + 四维
    const stats = Object.entries(snap.stats)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => `<span class="stat-chip">${STAT_LABELS[k] || k} ${v > 0 ? '+' : ''}${v}</span>`)
      .join('');
    const careerChip = snap.career
      ? `<span class="stat-chip is-career" style="background:${snap.career.color};color:#fff">${snap.career.icon} ${snap.career.name}</span>`
      : '';
    this.el.narrativeStats.innerHTML = careerChip + stats;

    // 生命 / 能量
    this._renderVitals();

    // 文本 + 插图
    const imgHtml = snap.image
      ? `<img class="narrative-image" src="${snap.image}" alt="剧情插图" loading="lazy" />`
      : '';
    this.el.narrativeText.innerHTML = imgHtml + '<div class="narrative-text-body"></div>';
    this.el.narrativeText.scrollTop = 0;
    const body = this.el.narrativeText.querySelector('.narrative-text-body');

    const fullText = node.text || '';
    this._fullText = fullText;
    this._startParagraphReveal(body, fullText);

    // 选项(先构建,打字完成后再浮现)
    this._buildChoices(node, snap);
    this.el.narrativeChoices.classList.add('is-waiting');
    this._choicesReady = false;

    // 底部提示
    this.el.narrativeHint.innerHTML = `<kbd>空格</kbd> 推进 · <kbd>1</kbd>~<kbd>9</kbd> 选择 · 点击文本可跳过`;

    // 像素图侧栏:人物状态 / 服饰 + 所处环境
    this._renderScene(node, snap);
  }

  /** 刷新像素图侧栏(不影响剧情文字窗口) */
  _renderScene(node, snap) {
    if (!this.scene) return;
    this.scene.render({
      chapterId: snap.chapter,
      nodeId: node.id,
      career: snap.career,
      player: this.engine?.player,
      flags: snap.flags,
    });
  }

  /** HP / 能量条 */
  _renderVitals() {
    const p = this.engine?.player;
    if (!p) { this.el.narrativeVitals.innerHTML = ''; return; }
    const hpPct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
    const mpPct = p.maxMp ? Math.max(0, Math.round((p.mp / p.maxMp) * 100)) : 0;
    this.el.narrativeVitals.innerHTML = `
      <span class="vital">
        <span>HP</span>
        <span class="vital-bar hp"><i style="width:${hpPct}%"></i></span>
        <code>${p.hp}/${p.maxHp}</code>
      </span>
      <span class="vital">
        <span>魔力</span>
        <span class="vital-bar mp-bar"><i style="width:${mpPct}%"></i></span>
        <code>${p.mp}/${p.maxMp}</code>
      </span>
      <span class="vital"><span>战力</span><code>${p.power || 0}</code></span>
    `;
  }

  /** 逐段渐显 */
  _startParagraphReveal(body, text) {
    // 按空行分段,保留段内换行
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    this._paraEls = [];
    this._paraIndex = 0;

    if (paragraphs.length === 0) {
      this._finishTyping();
      return;
    }

    this._typing = true;
    body.innerHTML = '';

    // 预创建所有段落(初始不可见)
    paragraphs.forEach((p) => {
      const el = document.createElement('p');
      el.textContent = p;
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.transition = `opacity ${PARA_FADE_MS}ms var(--ease), transform ${PARA_FADE_MS}ms var(--ease)`;
      body.appendChild(el);
      this._paraEls.push(el);
    });

    // 立即显示第一段
    this._revealNextParagraph();

    // 按节奏逐段浮现
    this._scheduleNext();
  }

  _scheduleNext() {
    if (this._paraIndex >= this._paraEls.length) {
      this._stopTyping();
      this._finishTyping();
      return;
    }
    const current = this._paraEls[this._paraIndex - 1];
    const len = current ? current.textContent.length : 0;
    const delay = Math.min(PARA_MAX_MS, PARA_BASE_MS + len * PARA_PER_CHAR_MS);
    this._paraTimer = setTimeout(() => {
      this._revealNextParagraph();
      this._scheduleNext();
    }, delay);
  }

  _revealNextParagraph() {
    if (this._paraIndex >= this._paraEls.length) return;
    const el = this._paraEls[this._paraIndex];
    el.style.opacity = '1';
    el.style.transform = 'none';
    this._paraIndex++;
    // 不自动滚动,保持用户当前阅读位置
  }

  _skipTyping() {
    if (!this._typing) return;
    this._stopTyping();
    // 一次性浮现全部剩余段落
    for (let i = this._paraIndex; i < this._paraEls.length; i++) {
      const el = this._paraEls[i];
      el.style.opacity = '1';
      el.style.transform = 'none';
    }
    this._paraIndex = this._paraEls.length;
    // 不强制滚动,保持用户当前阅读位置
    this._finishTyping();
  }

  _stopTyping() {
    if (this._paraTimer) { clearTimeout(this._paraTimer); this._paraTimer = null; }
    this._typing = false;
  }

  /** 呈现完成:浮现选项 */
  _finishTyping() {
    this.el.narrativeChoices.classList.remove('is-waiting');
    this._choicesReady = true;
  }

  _buildChoices(node, snap) {
    const box = this.el.narrativeChoices;
    box.innerHTML = '';
    box.classList.remove('career-grid');

    if (node.kind === 'career') {
      box.classList.add('career-grid');
      for (const c of CAREERS) {
        box.appendChild(this._careerCardEl(c, () => this.bus.emit('ui:choose-career', c.id)));
      }
    } else if (node.kind === 'switch_career') {
      this._buildCareerSwitch(node);
    } else if (node.kind === 'choice' && node.choices) {
      node.choices.forEach((choice, i) => {
        const btn = document.createElement('button');
        btn.className = 'narrative-choice-btn';
        btn.style.animationDelay = `${i * 0.08}s`;
        const key = document.createElement('span');
        key.className = 'choice-key';
        key.textContent = String(i + 1);
        const txt = document.createElement('span');
        txt.className = 'choice-text';
        txt.textContent = choice.text;
        btn.appendChild(key);
        btn.appendChild(txt);
        btn.addEventListener('click', () => {
          if (this._typing) this._skipTyping();
          this.bus.emit('ui:narrative-choose', i);
        });
        box.appendChild(btn);
      });
    } else if (node.kind === 'ending') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = '查看结局';
      btn.addEventListener('click', () => this.bus.emit('ui:restart'));
      box.appendChild(btn);
    } else if (node.next) {
      const cont = document.createElement('div');
      cont.className = 'narrative-continue';
      cont.textContent = '▼ 继续';
      cont.addEventListener('click', () => {
        if (this._typing) { this._skipTyping(); return; }
        this.bus.emit('ui:narrative-next');
      });
      box.appendChild(cont);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost';
      btn.textContent = '返回主菜单';
      btn.addEventListener('click', () => this.bus.emit('ui:restart'));
      box.appendChild(btn);
    }
  }

  /** 职业切换节点渲染 */
  _buildCareerSwitch(node) {
    const box = this.el.narrativeChoices;
    const currentCareer = this.engine?.career;
    const unlocked = [...(this.engine?.unlockedCareers || [])];

    const hint = document.createElement('div');
    hint.className = 'switch-hint';
    hint.innerHTML = currentCareer
      ? `<span>当前职业</span><span class="stat-chip is-career" style="background:${currentCareer.color};color:#fff">${currentCareer.icon} ${currentCareer.name}</span>`
      : '尚未选择职业';
    box.appendChild(hint);

    const switchable = unlocked
      .map((id) => CAREER_MAP[id])
      .filter((c) => c && (!currentCareer || c.id !== currentCareer.id));

    if (switchable.length === 0) {
      const noOpt = document.createElement('p');
      noOpt.className = 'switch-none';
      noOpt.textContent = '(暂无可切换的其他已解锁职业)';
      box.appendChild(noOpt);
    } else {
      const grid = document.createElement('div');
      grid.className = 'career-grid career-grid-compact';
      switchable.forEach((c, i) => {
        const card = this._careerCardEl(c, () => this.bus.emit('ui:switch-career', c.id), true);
        card.style.animationDelay = `${i * 0.06}s`;
        grid.appendChild(card);
      });
      box.appendChild(grid);
    }

    const keepBtn = document.createElement('button');
    keepBtn.className = 'btn btn-ghost switch-keep-btn';
    keepBtn.textContent = currentCareer ? `保持「${currentCareer.name}」继续旅程` : '继续旅程';
    keepBtn.addEventListener('click', () => {
      if (this._typing) { this._skipTyping(); return; }
      this.bus.emit('ui:narrative-next');
    });
    box.appendChild(keepBtn);
  }

  bindEngine(engine) {
    this.engine = engine;
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ===== 地区地图 =====
  /** 渲染地区地图:地点、目标提示、旅行消耗与本地服务 */
  renderMap(state) {
    const { region, chapterNum, currentIndex, objectiveIndex, travelCost, economy } = state;
    if (!region) return;
    if (this.el.mapRegionName) this.el.mapRegionName.textContent = `第${chapterNum}章 · ${region.name}`;

    const obj = objectiveIndex >= 0 ? region.stops[objectiveIndex] : null;
    if (this.el.mapHint) {
      this.el.mapHint.textContent = obj
        ? `剧情提示:${obj.hint}${obj.npc ? `(找到「${obj.npc}」)` : ''}`
        : '当前没有待开启的剧情,可自由探索。';
    }

    // 地点卡片
    const box = this.el.mapStops;
    if (box) {
      box.innerHTML = '';
      region.stops.forEach((s, i) => {
        const here = i === currentIndex;
        const isObj = i === objectiveIndex;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `stop-card${here ? ' is-here' : ''}${isObj ? ' is-objective' : ''}`;
        card.innerHTML = `
          <div class="stop-head">
            <span class="stop-name">${this._escapeHtml(s.name)}</span>
            <span class="stop-tag">${here ? '所在' : (isObj ? '目标' : `⚡${travelCost[i]}`)}</span>
          </div>
          <div class="stop-meta">${s.npc ? `人物 · ${this._escapeHtml(s.npc)}` : '无人驻留'}</div>
          <div class="stop-services">${this._serviceTags(s.services)}</div>
        `;
        card.disabled = here;
        if (!here) card.addEventListener('click', () => this.bus.emit('ui:map-travel', i));
        box.appendChild(card);
      });
    }

    // 当前地点的服务按钮
    const cur = region.stops[currentIndex];
    if (this.el.mapServices) {
      const svc = cur?.services || {};
      this.el.mapServices.innerHTML = '';
      const mk = (label, ev, ok) => {
        const b = document.createElement('button');
        b.className = 'btn btn-ghost';
        b.textContent = label;
        b.disabled = !ok;
        if (ok) b.addEventListener('click', () => this.bus.emit(ev));
        return b;
      };
      this.el.mapServices.appendChild(mk('市 场', 'ui:map-shop', !!svc.shop));
      this.el.mapServices.appendChild(mk('打 工', 'ui:map-job', !!svc.job));
      this.el.mapServices.appendChild(mk('休 息', 'ui:map-rest', !!svc.rest));
    }

    if (this.el.btnMapStory) {
      const can = objectiveIndex >= 0 && currentIndex === objectiveIndex;
      this.el.btnMapStory.disabled = !can;
      this.el.btnMapStory.textContent = can ? '开 始 剧 情' : (obj ? `前往「${obj.name}」` : '暂无剧情');
    }
    this.renderResources(economy);
  }

  _serviceTags(services = {}) {
    const tags = [];
    if (services.shop) tags.push('<span class="svc">市场</span>');
    if (services.job) tags.push('<span class="svc">打工</span>');
    if (services.rest) tags.push('<span class="svc">休息</span>');
    return tags.join('') || '<span class="svc is-off">无</span>';
  }

  // ===== 市场 =====
  renderShop({ stock, economy }) {
    const box = this.el.shopList;
    if (!box) return;
    box.innerHTML = '';
    (stock || []).forEach((id) => {
      const it = ITEMS[id];
      if (!it) return;
      const afford = economy.gold >= it.price;
      box.appendChild(this._shopRow(it, afford, `🪙 ${it.price}`, '买入', 'data-buy', () => this.bus.emit('ui:shop-buy', id)));
    });

    const sellables = [...economy.bag.entries()].filter(([id]) => !economy.isEquipped(id));
    if (sellables.length) {
      const title = document.createElement('div');
      title.className = 'shop-section-title';
      title.textContent = '出售(背包)';
      box.appendChild(title);
      sellables.forEach(([id, qty]) => {
        const it = ITEMS[id];
        if (!it) return;
        const row = this._shopRow(it, true, `🪙 ${sellPrice(id)}`, '卖出', 'data-sell', () => this.bus.emit('ui:shop-sell', id), qty);
        box.appendChild(row);
      });
    } else {
      const empty = document.createElement('p');
      empty.className = 'bag-empty';
      empty.textContent = '背包里没有可出售的物品。';
      box.appendChild(empty);
    }
    this.renderResources(economy);
  }

  _shopRow(it, enabled, priceTxt, btnTxt, attr, onClick, qty = 0) {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div class="item-icon">${it.icon || '📦'}</div>
      <div class="item-body">
        <div class="item-name">${this._escapeHtml(it.name)}${qty > 1 ? ` <span class="item-qty">×${qty}</span>` : ''}<span class="item-cat">${ITEM_CATEGORY_CN[it.category] || ''}</span></div>
        <div class="item-desc">${this._escapeHtml(it.desc || '')}</div>
      </div>
      <div class="item-actions">
        <span class="item-price${enabled ? '' : ' is-poor'}">${priceTxt}</span>
        <button class="btn btn-primary btn-sm" ${attr} ${enabled ? '' : 'disabled'}>${btnTxt}</button>
      </div>
    `;
    const btn = row.querySelector(`[${attr}]`);
    if (btn && enabled) btn.addEventListener('click', onClick);
    return row;
  }

  // ===== 背包 =====
  renderBag({ economy, player }) {
    const SLOT_CN = { weapon: '武器', outfit: '服饰', vehicle: '载具' };
    if (this.el.bagEquipped) {
      this.el.bagEquipped.innerHTML = Object.entries(SLOT_CN).map(([slot, label]) => {
        const id = economy.equipped[slot];
        const it = id ? ITEMS[id] : null;
        return `<div class="equip-slot">
          <span class="equip-label">${label}</span>
          <span class="equip-value">${it ? `${it.icon || ''} ${this._escapeHtml(it.name)}` : '——'}</span>
          ${it ? `<button class="btn btn-ghost btn-sm" data-unequip="${slot}">卸下</button>` : ''}
        </div>`;
      }).join('');
      this.el.bagEquipped.querySelectorAll('[data-unequip]').forEach((b) => {
        b.addEventListener('click', () => this.bus.emit('ui:bag-unequip', b.dataset.unequip));
      });
    }

    const box = this.el.bagList;
    if (box) {
      box.innerHTML = '';
      const entries = [...economy.bag.entries()];
      if (!entries.length) {
        box.innerHTML = '<p class="bag-empty">背包空空如也。</p>';
      }
      entries.forEach(([id, qty]) => {
        const it = ITEMS[id];
        if (!it) return;
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
          <div class="item-icon">${it.icon || '📦'}</div>
          <div class="item-body">
            <div class="item-name">${this._escapeHtml(it.name)} <span class="item-qty">×${qty}</span><span class="item-cat">${ITEM_CATEGORY_CN[it.category] || ''}</span></div>
            <div class="item-desc">${this._escapeHtml(it.desc || '')}</div>
          </div>
          <div class="item-actions">
            ${it.effect ? `<button class="btn btn-primary btn-sm" data-use="${id}">使用</button>` : ''}
            ${it.equipment ? `<button class="btn btn-ghost btn-sm" data-equip="${id}">装备</button>` : ''}
            <button class="btn btn-ghost btn-sm" data-drop="${id}">丢弃</button>
          </div>
        `;
        row.querySelector('[data-use]')?.addEventListener('click', () => this.bus.emit('ui:bag-use', id));
        row.querySelector('[data-equip]')?.addEventListener('click', () => this.bus.emit('ui:bag-equip', id));
        row.querySelector('[data-drop]')?.addEventListener('click', () => this.bus.emit('ui:bag-drop', id));
        box.appendChild(row);
      });
    }

    // 底部数值概览
    if (this.el.bagRes && player) {
      const chips = `<span class="res-chip">❤ ${player.hp}/${player.maxHp}</span><span class="res-chip">✦ ${player.mp}/${player.maxMp}</span><span class="res-chip">⚔ 战力 ${player.power || 0}</span><span class="res-chip">🪙 ${economy.gold}</span><span class="res-chip">⚡ ${economy.ap}/${economy.apCap()}</span>`;
      this.el.bagRes.innerHTML = chips;
    } else {
      this.renderResources(economy);
    }
  }

  // ===== 打工 =====
  renderJobs({ jobs, economy }) {
    const box = this.el.jobList;
    if (!box) return;
    box.innerHTML = '';
    (jobs || []).forEach((j) => {
      const ok = economy.ap >= j.ap;
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="item-icon">🛠️</div>
        <div class="item-body">
          <div class="item-name">${this._escapeHtml(j.name)}</div>
          <div class="item-desc">${this._escapeHtml(j.desc || '')}</div>
        </div>
        <div class="item-actions">
          <span class="item-price${ok ? '' : ' is-poor'}">⚡ ${j.ap} → 🪙 ${j.gold}</span>
          <button class="btn btn-primary btn-sm" data-work="${j.id}" ${ok ? '' : 'disabled'}>开工</button>
        </div>
      `;
      const btn = row.querySelector('[data-work]');
      if (btn && ok) btn.addEventListener('click', () => this.bus.emit('ui:job-work', j.id));
      box.appendChild(row);
    });
    this.renderResources(economy);
  }

  bindBattle(battle) {
    this.battle = battle;
    this._lastEnemyHp = null;
    this._lastPlayerHp = null;
  }

  // ===== 战斗视图 =====
  _renderBattle(snap) {
    this.el.turn.textContent = snap.turn;
    this.el.drawCount.textContent = snap.drawCount;
    this.el.discardCount.textContent = snap.discardCount;
    this.el.energy.textContent = `${snap.player.energy}/${snap.player.energyMax} · ✦${snap.player.mp}`;
    this.el.btnEndTurn.disabled = snap.over;

    // 能量脉动:能量回升时提示
    this.el.energy.classList.remove('pulse');
    void this.el.energy.offsetWidth;
    this.el.energy.classList.add('pulse');

    this.el.enemyZone.innerHTML = '';
    this.el.enemyZone.appendChild(this._entityCard(snap.enemy, true));
    this.el.playerZone.innerHTML = '';
    this.el.playerZone.appendChild(this._entityCard({ ...snap.player, name: this._playerName() }, false));

    this.el.hand.innerHTML = '';
    for (const card of snap.hand) {
      this.el.hand.appendChild(this._handCardEl(card, snap));
    }

    this._renderBattleItems();
    this._lastEnemyHp = snap.enemy.hp;
    this._lastPlayerHp = snap.player.hp;
  }

  /** 战斗中可用的药品(恢复生命 / 魔力),点击即用 */
  _renderBattleItems() {
    const box = this.el.battleItems;
    if (!box) return;
    const eco = this.economy;
    if (!eco) { box.innerHTML = ''; return; }
    const usable = [...eco.bag.entries()].filter(([id]) => {
      const it = ITEMS[id];
      return it?.effect && (it.effect.kind === 'heal' || it.effect.kind === 'mp');
    });
    if (!usable.length) { box.innerHTML = '<span class="battle-items-empty">无可用药品</span>'; return; }
    box.innerHTML = '';
    usable.forEach(([id, qty]) => {
      const it = ITEMS[id];
      const b = document.createElement('button');
      b.className = 'item-chip';
      b.textContent = `${it.icon || '🧪'} ${it.name} ×${qty}`;
      b.addEventListener('click', () => this.bus.emit('ui:bag-use', id));
      box.appendChild(b);
    });
  }

  _playerName() {
    return this.engine?.career ? `${this.engine.career.name}` : '玩家';
  }

  _handCardEl(card, snap) {
    const el = document.createElement('div');
    el.className = `card type-${card.type || 'attack'}`;
    const mp = cardMpCost(card);
    if (snap.player.energy < card.cost || (mp > 0 && snap.player.mp < mp)) el.classList.add('is-unplayable');
    el.innerHTML = `
      <div class="card-cost">${card.cost}</div>
      ${mp > 0 ? `<div class="card-mp">✦${mp}</div>` : ''}
      <div class="card-name">${this._escapeHtml(card.name)}</div>
      <div class="card-type-tag">${TYPE_LABELS[card.type] || ''}</div>
      <div class="card-desc">${this._escapeHtml(card.description || '')}</div>
    `;
    el.addEventListener('click', () => {
      if (el.classList.contains('is-unplayable')) return;
      el.classList.add('is-playing');
      setTimeout(() => el.classList.remove('is-playing'), 380);
      this.battle && this.battle.playCard(card);
    });
    return el;
  }

  _entityCard(data, isEnemy) {
    const card = document.createElement('div');
    const cls = isEnemy ? 'is-enemy' : 'is-player';
    card.className = `entity-card ${cls}`;
    if (isEnemy && data.hp <= 0) card.classList.add('is-dead');

    // 受击抖动
    const prevHp = isEnemy ? this._lastEnemyHp : this._lastPlayerHp;
    if (prevHp !== null && data.hp < prevHp) {
      card.classList.add('is-hit');
      setTimeout(() => card.classList.remove('is-hit'), 420);
    }

    const hpPct = Math.max(0, Math.round((data.hp / data.maxHp) * 100));
    const avatar = isEnemy ? '👹' : (this.engine?.career?.icon || '⚔');
    const blockHtml = data.block > 0
      ? `<span class="entity-block is-on">🛡 ${data.block}</span>`
      : '<span class="entity-block">🛡 0</span>';

    card.innerHTML = `
      <div class="entity-top">
        <div class="entity-avatar">${avatar}</div>
        <div class="entity-name">${this._escapeHtml(data.name)}</div>
        ${blockHtml}
      </div>
      <div class="hpbar"><i style="width:${hpPct}%"></i><span>${data.hp}/${data.maxHp}</span></div>
      <div class="entity-intent ${this._intentClass(data.intent)}">
        <span class="intent-icon">${this._intentIcon(data.intent)}</span>
        <span>${this._intentText(data.intent)}</span>
      </div>
      <div class="entity-statuses">${this._statusPills(data.statuses)}</div>
    `;
    return card;
  }

  _intentClass(intent) {
    if (!intent) return '';
    return `is-${intent.kind}`;
  }

  _intentIcon(intent) {
    if (!intent) return '…';
    if (intent.kind === 'attack') return '⚔';
    if (intent.kind === 'block') return '🛡';
    if (intent.kind === 'buff') return '✦';
    return '•';
  }

  _intentText(intent) {
    if (!intent) return '蓄势待发';
    if (intent.kind === 'attack') return `意图攻击 ${intent.value}`;
    if (intent.kind === 'block') return `意图防御 ${intent.value}`;
    if (intent.kind === 'buff') return `意图强化 ${STATUS_LABELS[intent.name] || intent.name}`;
    return `意图:${intent.kind}`;
  }

  _statusPills(statuses) {
    const neg = ['vulnerable', 'weak', 'frail'];
    return Object.entries(statuses || {})
      .filter(([, v]) => v)
      .map(([k, v]) => `<span class="status-pill ${neg.includes(k) ? 'neg' : 'pos'}">${STATUS_LABELS[k] || k} ${v}</span>`)
      .join('');
  }

  _renderBattleLog(msg) {
    this.el.battleLog.textContent = msg;
    this.el.battleLog.classList.remove('is-flash');
    void this.el.battleLog.offsetWidth;
    this.el.battleLog.classList.add('is-flash');
  }

  /** 伤害 / 护甲 / 治疗飘字 */
  _playBattleFx(fx) {
    const zone = fx.target === 'enemy' ? this.el.enemyZone : this.el.playerZone;
    const card = zone.querySelector('.entity-card');
    if (!card) return;
    const span = document.createElement('div');
    span.className = `dmg-float ${fx.kind}`;
    const prefix = fx.kind === 'damage' ? '-' : (fx.kind === 'heal' ? '+' : '');
    span.textContent = `${prefix}${fx.value}`;
    card.appendChild(span);
    setTimeout(() => span.remove(), 1000);
  }

  // ===== 战利品 =====
  renderRewards(cards, extra) {
    if (this.el.rewardSub) {
      let t = '从战场上拾起一张卡牌,加入你的牌组';
      if (extra) {
        const loot = extra.loot ? `,拾得「${ITEMS[extra.loot]?.name || extra.loot}」` : '';
        t = `获得 🪙 ${extra.gold} 金币${loot} · 再选一张卡牌加入牌组`;
      }
      this.el.rewardSub.textContent = t;
    }
    this.el.rewardGrid.innerHTML = '';
    cards.forEach((card, i) => {
      const el = this._rewardCardEl(card);
      el.style.animationDelay = `${i * 0.1}s`;
      el.addEventListener('click', () => this.bus.emit('ui:pick-reward', card.id));
      this.el.rewardGrid.appendChild(el);
    });
  }

  _rewardCardEl(card) {
    const el = document.createElement('div');
    el.className = `card type-${card.type || 'attack'}`;
    const mp = cardMpCost(card);
    el.innerHTML = `
      <div class="card-cost">${card.cost}</div>
      ${mp > 0 ? `<div class="card-mp">✦${mp}</div>` : ''}
      <div class="card-name">${this._escapeHtml(card.name)}</div>
      <div class="card-type-tag">${TYPE_LABELS[card.type] || ''} · ${this._rarityLabel(card.rarity)}</div>
      <div class="card-desc">${this._escapeHtml(card.description || '')}</div>
    `;
    return el;
  }

  _rarityLabel(r) {
    return { basic: '基础', common: '普通', uncommon: '精良', rare: '稀有' }[r] || '';
  }

  // ===== 结局 =====
  _renderResult(victory) {
    if (victory) {
      const endingId = this.engine ? this.engine.resolveEnding() : 'odyssey';
      const ending = ENDINGS[endingId] || ENDINGS.odyssey;
      this.el.resultEyebrow.textContent = '结 局';
      this.el.resultTitle.textContent = ending.title;
      this.el.resultTitle.style.color = ending.color;
      this.el.resultDesc.textContent = ending.desc || this._defaultEndingDesc(endingId);
      this._renderResultStats();
    } else {
      this.el.resultEyebrow.textContent = '征 程 中 断';
      this.el.resultTitle.textContent = '倒 下';
      this.el.resultTitle.style.color = 'var(--ember-bright)';
      this.el.resultDesc.textContent = '剑未出鞘,人已力竭。但「守约」的故事,还等着被重新书写。';
      this.el.resultStats.innerHTML = '';
    }
  }

  _defaultEndingDesc(id) {
    return {
      hero: '你守住了弟弟,也守住了父亲守了一辈子的约。',
      tragic: '你替弟弟承受了龙化,回不去了——但你守住了他。',
      recluse: '你放下了剑,回到平静的日子。有些约,只能交给下一个人。',
      odyssey: '你做了你的决定。现在,轮到下一位少年,做他的决定。',
    }[id] || '';
  }

  _renderResultStats() {
    if (!this.engine) { this.el.resultStats.innerHTML = ''; return; }
    const stats = Object.entries(this.engine.stats)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => `<span class="stat-chip">${STAT_LABELS[k] || k} ${v > 0 ? '+' : ''}${v}</span>`)
      .join('');
    const flags = [...this.engine.flags].slice(0, 10)
      .map((f) => `<span class="stat-chip">${f}</span>`)
      .join('');
    this.el.resultStats.innerHTML = stats + flags;
  }

  /** 顶部提示 toast(2 秒后淡出) */
  showToast(text) {
    if (!text) return;
    const toast = document.createElement('div');
    toast.className = 'career-toast';
    toast.textContent = text;
    this.root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 400);
    }, 3400);
  }

  /** 职业解锁提示 toast */
  _showCareerUnlockToast(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    const names = list.map((id) => CAREER_MAP[id]?.name || id).join('、');
    if (!names) return;
    this.showToast(`✦ 已解锁职业:${names}(可在休息节点切换)`);
  }
}
