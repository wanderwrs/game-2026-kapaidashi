/**
 * UI — DOM 渲染层。
 * 订阅 battle:refresh / narrative:refresh 事件渲染快照,按钮事件转发给 bus。
 * 不持有战斗/剧情状态,仅做视图;逻辑集中在 Game/Battle/NarrativeEngine。
 */

import { GameState } from '../core/game.js';
import { NodeLabel } from '../map/map.js';
import { CAREERS } from '../narrative/careers.js';
import { ENDINGS } from '../narrative/engine.js';

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

export class UI {
  constructor(rootEl, bus) {
    this.root = rootEl;
    this.bus = bus;
    this.battle = null;
    this.engine = null;
    this._cache();
    this._bindStaticButtons();
    this._bindBus();
  }

  _cache() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      seed: $('seed-display'),
      turn: $('turn-display'),
      floor: $('floor-display'),
      views: {
        menu: $('view-menu'),
        career: $('view-career'),
        narrative: $('view-narrative'),
        map: $('view-map'),
        battle: $('view-battle'),
        result: $('view-result'),
      },
      careerGrid: $('career-grid'),
      narrativeStats: $('narrative-stats'),
      narrativeText: $('narrative-text'),
      narrativeChoices: $('narrative-choices'),
      mapNodes: $('map-nodes'),
      enemyZone: $('enemy-zone'),
      playerZone: $('player-zone'),
      hand: $('hand'),
      drawCount: $('draw-count'),
      discardCount: $('discard-count'),
      energy: $('energy-display'),
      btnEndTurn: $('btn-end-turn'),
      resultTitle: $('result-title'),
      resultDesc: $('result-desc'),
    };
  }

  _bindStaticButtons() {
    document.getElementById('btn-new-run').addEventListener('click', () => this.bus.emit('ui:new-run'));
    document.getElementById('btn-seed-run').addEventListener('click', () => this.bus.emit('ui:seed-run'));
    document.getElementById('btn-restart').addEventListener('click', () => this.bus.emit('ui:restart'));
    this.el.btnEndTurn.addEventListener('click', () => this.bus.emit('ui:end-turn'));
  }

  _bindBus() {
    this.bus.on('battle:refresh', (snap) => this._renderBattle(snap));
    this.bus.on('narrative:refresh', (snap) => this._renderNarrative(snap));
    this.bus.on('battle:log', (msg) => console.log('[battle]', msg));
  }

  showView(state) {
    Object.values(this.el.views).forEach((v) => v.classList.remove('is-active'));
    let target = this.el.views.battle;
    if (state === GameState.MENU) target = this.el.views.menu;
    else if (state === GameState.CAREER) target = this.el.views.career;
    else if (state === GameState.NARRATIVE) target = this.el.views.narrative;
    else if (state === GameState.MAP) target = this.el.views.map;
    else if (state === GameState.BATTLE) target = this.el.views.battle;
    else if (state === GameState.VICTORY || state === GameState.DEFEAT) target = this.el.views.result;
    target.classList.add('is-active');

    if (state === GameState.VICTORY) {
      const ending = this.engine ? ENDINGS[this.engine.resolveEnding()] : ENDINGS.odyssey;
      this.el.resultTitle.textContent = ending.title;
      this.el.resultTitle.style.color = ending.color;
      this.el.resultDesc.textContent = this.engine
        ? `关键抉择:${[...this.engine.flags].join(', ') || '(无)'}`
        : '你抵达了尽头。';
    } else if (state === GameState.DEFEAT) {
      this.el.resultTitle.textContent = '失败';
      this.el.resultTitle.style.color = '';
      this.el.resultDesc.textContent = '你倒下了。再来一局吧。';
    }
  }

  updateSeed(seed) {
    this.el.seed.textContent = `#${(seed >>> 0).toString(16)}`;
  }

  updateFloor(floor) {
    this.el.floor.textContent = floor;
  }

  // ===== 职业选择视图 =====
  renderCareers() {
    this.el.careerGrid.innerHTML = '';
    for (const c of CAREERS) {
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
        <div class="career-story">${c.backstory}</div>
        <div class="career-meta">
          <span>HP <code>${c.maxHp}</code></span>
          <span>能量 <code>${c.energyMax}</code></span>
          <span>特色卡 <code>${c.signatureCards.length}</code></span>
        </div>
      `;
      card.addEventListener('click', () => this.bus.emit('ui:choose-career', c.id));
      this.el.careerGrid.appendChild(card);
    }
  }

  // ===== 剧情视图 =====
  _renderNarrative(snap) {
    const node = snap.node;
    if (!node) return;

    // 状态条
    const stats = Object.entries(snap.stats)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => `<span class="stat-chip">${STAT_LABELS[k] || k} ${v > 0 ? '+' : ''}${v}</span>`)
      .join('');
    const careerChip = snap.career
      ? `<span class="stat-chip" style="background:${snap.career.color};color:#fff">${snap.career.icon} ${snap.career.name}</span>`
      : '';
    this.el.narrativeStats.innerHTML = careerChip + stats;

    // 文本
    this.el.narrativeText.textContent = node.text || '';

    // 选项
    this.el.narrativeChoices.innerHTML = '';
    this.el.narrativeChoices.classList.remove('career-grid');
    if (node.kind === 'career') {
      // 职业选择:在剧情节点内渲染 6 张职业卡
      this.el.narrativeChoices.classList.add('career-grid');
      for (const c of CAREERS) {
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
          <div class="career-story">${c.backstory}</div>
          <div class="career-meta">
            <span>HP <code>${c.maxHp}</code></span>
            <span>能量 <code>${c.energyMax}</code></span>
            <span>特色卡 <code>${c.signatureCards.length}</code></span>
          </div>
        `;
        card.addEventListener('click', () => this.bus.emit('ui:choose-career', c.id));
        this.el.narrativeChoices.appendChild(card);
      }
    } else if (node.kind === 'choice' && node.choices) {
      node.choices.forEach((choice, i) => {
        const btn = document.createElement('button');
        btn.className = 'narrative-choice-btn';
        btn.textContent = choice.text;
        btn.addEventListener('click', () => this.bus.emit('ui:narrative-choose', i));
        this.el.narrativeChoices.appendChild(btn);
      });
    } else if (node.kind === 'ending') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = '查看结局';
      btn.addEventListener('click', () => this.bus.emit('ui:restart'));
      this.el.narrativeChoices.appendChild(btn);
    } else if (node.next) {
      const cont = document.createElement('div');
      cont.className = 'narrative-continue';
      cont.textContent = '▼ 继续点击推进';
      cont.addEventListener('click', () => this.bus.emit('ui:narrative-next'));
      this.el.narrativeChoices.appendChild(cont);
    } else {
      // next 为 null:章节占位结束,回主菜单
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost';
      btn.textContent = '返回主菜单';
      btn.addEventListener('click', () => this.bus.emit('ui:restart'));
      this.el.narrativeChoices.appendChild(btn);
    }
  }

  bindEngine(engine) {
    this.engine = engine;
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
  }

  // ===== 战斗视图(保持不变) =====
  _renderBattle(snap) {
    this.el.turn.textContent = snap.turn;
    this.el.drawCount.textContent = snap.drawCount;
    this.el.discardCount.textContent = snap.discardCount;
    this.el.energy.textContent = `${snap.player.energy}/${snap.player.energyMax}`;
    this.el.btnEndTurn.disabled = snap.over;

    this.el.enemyZone.innerHTML = '';
    this.el.enemyZone.appendChild(this._entityCard(snap.enemy, true));

    this.el.playerZone.innerHTML = '';
    this.el.playerZone.appendChild(this._entityCard({ ...snap.player, name: '玩家' }, false));

    this.el.hand.innerHTML = '';
    for (const card of snap.hand) {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      if (snap.player.energy < card.cost) cardEl.classList.add('is-unplayable');
      cardEl.innerHTML = `
        <div class="card-cost">${card.cost}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-desc">${card.description}</div>
      `;
      cardEl.addEventListener('click', () => this.battle && this.battle.playCard(card));
      this.el.hand.appendChild(cardEl);
    }
  }

  _entityCard(data, isEnemy) {
    const card = document.createElement('div');
    card.className = 'entity-card';
    const sub = isEnemy
      ? this._intentText(data.intent)
      : this._statusText(data.statuses);
    card.innerHTML = `
      <div class="entity-name">${data.name}</div>
      <div class="entity-hp">HP ${data.hp}/${data.maxHp} · 护甲 ${data.block}</div>
      <div class="entity-intent">${sub}</div>
    `;
    return card;
  }

  _intentText(intent) {
    if (!intent) return '意图:蓄势';
    if (intent.kind === 'attack') return `意图:攻击 ${intent.value}`;
    if (intent.kind === 'block') return `意图:防御 ${intent.value}`;
    if (intent.kind === 'buff') return `意图:强化 ${STATUS_LABELS[intent.name] || intent.name}`;
    return `意图:${intent.kind}`;
  }

  _statusText(statuses) {
    const keys = Object.keys(statuses);
    if (keys.length === 0) return '';
    return '状态: ' + keys.map((k) => `${STATUS_LABELS[k] || k} ${statuses[k]}`).join(', ');
  }
}
