/**
 * UI — DOM 渲染层(视觉与交互)。
 * 订阅 battle:refresh / battle:fx / narrative:refresh 事件渲染快照,按钮事件转发给 bus。
 * 不持有战斗/剧情状态,仅做视图;逻辑集中在 Game/Battle/NarrativeEngine。
 *
 * 交互增强:
 *   · 剧情文本打字机呈现,点击可跳过,读毕再浮现选项
 *   · 键盘操作:数字键选选项 / 空格·回车推进 / 点击文本区域推进
 *   · 战斗:血条动画、伤害飘字、受击抖动、手牌类型描边
 *   · 章节进度条、职业解锁提示、结局面板
 */

import { GameState } from '../core/game.js';
import { NodeLabel } from '../map/map.js';
import { CAREERS, CAREER_MAP } from '../narrative/careers.js';
import { ENDINGS } from '../narrative/engine.js';
import { CHAPTER_ORDER } from '../narrative/chapters/index.js';

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

/** 打字机速度:每字毫秒(会按文本长度自适应压缩总时长) */
const TYPE_CHAR_MS = 14;
const TYPE_MAX_MS = 9000;
const TYPE_MIN_MS = 1400;

export class UI {
  constructor(rootEl, bus) {
    this.root = rootEl;
    this.bus = bus;
    this.battle = null;
    this.engine = null;
    this._typeTimer = null;      // 打字机计时器
    this._typing = false;        // 是否正在打字
    this._fullText = '';         // 当前节点全文
    this._revealed = 0;          // 已显示字符数
    this._choicesReady = false;  // 选项是否已浮现
    this._lastEnemyHp = null;    // 用于计算伤害飘字
    this._lastPlayerHp = null;
    this._cache();
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
      floor: $('floor-display'),
      chapterTitle: $('chapter-title'),
      progressFill: $('progress-fill'),
      views: {
        menu: $('view-menu'),
        career: $('view-career'),
        narrative: $('view-narrative'),
        map: $('view-map'),
        battle: $('view-battle'),
        reward: $('view-reward'),
        result: $('view-result'),
      },
      careerGrid: $('career-grid'),
      narrativeStats: $('narrative-stats'),
      narrativeVitals: $('narrative-vitals'),
      narrativeText: $('narrative-text'),
      narrativeChoices: $('narrative-choices'),
      narrativeHint: $('narrative-hint'),
      mapNodes: $('map-nodes'),
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

  _bindStaticButtons() {
    document.getElementById('btn-new-run').addEventListener('click', () => this.bus.emit('ui:new-run'));
    document.getElementById('btn-seed-run').addEventListener('click', () => this.bus.emit('ui:seed-run'));
    document.getElementById('btn-restart').addEventListener('click', () => this.bus.emit('ui:restart'));
    this.el.btnEndTurn.addEventListener('click', () => this.bus.emit('ui:end-turn'));
    this.el.btnSkipReward.addEventListener('click', () => this.bus.emit('ui:skip-reward'));
    // 点击剧情文本区域:正在打字则跳过,否则推进
    this.el.narrativeText.addEventListener('click', () => this._onTextAreaClick());
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

  updateFloor(floor) {
    this.el.floor.textContent = floor;
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
    const body = this.el.narrativeText.querySelector('.narrative-text-body');

    const fullText = node.text || '';
    this._fullText = fullText;
    this._startTyping(body, fullText);

    // 选项(先构建,打字完成后再浮现)
    this._buildChoices(node, snap);
    this.el.narrativeChoices.classList.add('is-waiting');
    this._choicesReady = false;

    // 底部提示
    this.el.narrativeHint.innerHTML = `<kbd>空格</kbd> 推进 · <kbd>1</kbd>~<kbd>9</kbd> 选择 · 点击文本可跳过`;
  }

  /** HP / 能量条 */
  _renderVitals() {
    const p = this.engine?.player;
    if (!p) { this.el.narrativeVitals.innerHTML = ''; return; }
    const hpPct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
    const enPct = p.energyMax ? 100 : 0;
    this.el.narrativeVitals.innerHTML = `
      <span class="vital">
        <span>HP</span>
        <span class="vital-bar hp"><i style="width:${hpPct}%"></i></span>
        <code>${p.hp}/${p.maxHp}</code>
      </span>
      <span class="vital">
        <span>能量</span>
        <span class="vital-bar energy-bar"><i style="width:${enPct}%"></i></span>
        <code>${p.energyMax}</code>
      </span>
    `;
  }

  /** 打字机 */
  _startTyping(body, text) {
    const total = text.length;
    if (total === 0) {
      this._finishTyping();
      return;
    }
    const duration = Math.min(TYPE_MAX_MS, Math.max(TYPE_MIN_MS, total * TYPE_CHAR_MS));
    const interval = 16;
    const perTick = Math.max(1, Math.ceil(total / Math.max(1, duration / interval)));

    this._typing = true;
    this._revealed = 0;
    this._renderTyped(body, '');
    const caret = document.createElement('span');
    caret.className = 'tw-caret';
    caret.textContent = '▍';
    body.appendChild(caret);

    this._typeTimer = setInterval(() => {
      this._revealed = Math.min(total, this._revealed + perTick);
      const shown = text.slice(0, this._revealed);
      body.textContent = shown;
      body.appendChild(caret);
      // 自动滚到底部,让新字可见
      this.el.narrativeText.scrollTop = this.el.narrativeText.scrollHeight;
      if (this._revealed >= total) {
        this._stopTyping();
        this._finishTyping();
      }
    }, interval);
  }

  _renderTyped(body, shown) {
    body.textContent = shown;
  }

  _skipTyping() {
    if (!this._typing) return;
    this._stopTyping();
    const body = this.el.narrativeText.querySelector('.narrative-text-body');
    if (body) body.textContent = this._fullText;
    this.el.narrativeText.scrollTop = 0;
    this._finishTyping();
  }

  _stopTyping() {
    if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
    this._typing = false;
  }

  /** 打字完成:移除光标,浮现选项 */
  _finishTyping() {
    const caret = this.el.narrativeText.querySelector('.tw-caret');
    if (caret) caret.remove();
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

  // ===== 地图视图 =====
  renderMap(map, currentNode) {
    this.el.mapNodes.innerHTML = '';
    const byFloor = new Map();
    for (const n of map.nodes) {
      if (!byFloor.has(n.floor)) byFloor.set(n.floor, []);
      byFloor.get(n.floor).push(n);
    }
    const floors = [...byFloor.keys()].sort((a, b) => a - b);
    for (const f of floors) {
      const row = document.createElement('div');
      row.className = 'map-row';
      for (const n of byFloor.get(f)) {
        const node = document.createElement('button');
        node.className = 'map-node';
        if (currentNode && n.id === currentNode.id) node.classList.add('is-current');
        if (n.visited) node.style.opacity = '0.4';
        node.textContent = `第${f}层 · ${NodeLabel[n.type] || n.type}`;
        node.addEventListener('click', () => this.bus.emit('ui:select-node', n.id));
        row.appendChild(node);
      }
      this.el.mapNodes.appendChild(row);
    }
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
    this.el.energy.textContent = `${snap.player.energy}/${snap.player.energyMax}`;
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

    this._lastEnemyHp = snap.enemy.hp;
    this._lastPlayerHp = snap.player.hp;
  }

  _playerName() {
    return this.engine?.career ? `${this.engine.career.name}` : '玩家';
  }

  _handCardEl(card, snap) {
    const el = document.createElement('div');
    el.className = `card type-${card.type || 'attack'}`;
    if (snap.player.energy < card.cost) el.classList.add('is-unplayable');
    el.innerHTML = `
      <div class="card-cost">${card.cost}</div>
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
  renderRewards(cards) {
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
    el.innerHTML = `
      <div class="card-cost">${card.cost}</div>
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

  /** 职业解锁提示 toast */
  _showCareerUnlockToast(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    const names = list.map((id) => CAREER_MAP[id]?.name || id).join('、');
    if (!names) return;
    const toast = document.createElement('div');
    toast.className = 'career-toast';
    toast.textContent = `✦ 已解锁职业:${names}(可在休息节点切换)`;
    this.root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 400);
    }, 3400);
  }
}
