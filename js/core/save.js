/**
 * save.js — 本机存档 / 进度 / 邮箱的读写(纯工具,无游戏状态依赖)。
 *
 * 从 core/game.js 中抽出,行为与键名保持不变:
 *   · longji.fullstate.v1 —— 完整运行时存档(JSON,含 version)
 *   · longji.progress.v1  —— 各大章通关状态
 *   · longji.mail.v1      —— 邮箱领取记录与已用兑换码
 *   · longji.tutorial.v1  —— 新手引导是否已读
 *
 * 所有读写都包了 try/catch:隐私模式、配额不足或存储被禁用时静默降级。
 * SAVE_VERSION 变化时,loadSavedGame() 会返回 null(旧档不自动迁移);
 * 若将来需要兼容旧档,在 migrateSave() 内按 version 逐级升级即可。
 */

export const PROGRESS_KEY = 'longji.progress.v1';
export const TUTORIAL_KEY = 'longji.tutorial.v1';
export const MAIL_KEY = 'longji.mail.v1';
export const SAVE_KEY = 'longji.fullstate.v1';
export const SAVE_VERSION = 1;

/** 教程是否已看过 */
export function loadTutorialSeen() {
  try { return localStorage.getItem(TUTORIAL_KEY) === '1'; } catch { return false; }
}

/** 记录教程已看过 */
export function markTutorialSeen() {
  try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* 忽略存储异常 */ }
}

/** 读取本机通关进度(记录哪些大章已通关) */
export function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch { return {}; }
}

/** 将某大章标记为已通关,返回更新后的进度 */
export function markChapterCleared(id) {
  const p = loadProgress();
  p.cleared = p.cleared || {};
  p.cleared[id] = true;
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* 忽略存储异常 */ }
  return p;
}

/** 读取邮箱 / 兑换码的持久状态(跨局保留:领过的信件、用过的兑换码) */
export function loadMailState() {
  try { return JSON.parse(localStorage.getItem(MAIL_KEY)) || {}; } catch { return {}; }
}

/** 写回邮箱 / 兑换码状态 */
export function saveMailState(state) {
  try { localStorage.setItem(MAIL_KEY, JSON.stringify(state)); } catch { /* 忽略存储异常 */ }
}

/** 是否存在完整运行时存档 */
export function hasSavedGame() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

/**
 * 旧档迁移入口(当前仅做版本校验)。
 * 将来若升级 SAVE_VERSION,可在这里按 data.version 逐级补字段。
 */
export function migrateSave(data) {
  if (!data || data.version !== SAVE_VERSION) return null;
  return data;
}

/** 读取完整运行时存档(JSON),失败或版本不符返回 null */
export function loadSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrateSave(JSON.parse(raw));
  } catch { return null; }
}

/** 写入完整运行时存档;超出配额时静默失败 */
export function saveGameToStorage(payload) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** 清除完整运行时存档(开启新一局 / 通关后调用) */
export function clearSavedGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* 忽略存储异常 */ }
}

/** 清除本机全部进度与资料(设置里的「注销」) */
export function clearAllLocalData() {
  clearSavedGame();
  try {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(MAIL_KEY);
    localStorage.removeItem(TUTORIAL_KEY);
  } catch { /* 忽略存储异常 */ }
}
