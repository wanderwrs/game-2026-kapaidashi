/**
 * careers_rank.js — 职业等级与阶位体系(纯数据)。
 *
 * 规则:
 *   · 职业等级 1~150(战斗中累积经验升级)
 *   · 每 7 级晋升一个「职介」,共 13 个职介
 *   · 相隔的职介归入同一「大职介」(如 学徒 / 学徒II 同属「学徒系」)
 *   · 每次晋升发放奖励,职介越高奖励越大
 *   · 进入一个新的大职介,额外赠送一整套服饰
 *   · 100 级以上继续升级需要特殊道具「星辉秘典」;也可用「职业药水」直接提升
 */

/** 13 个职介 */
export const CAREER_RANKS = [
  { name: '学徒',     major: '学徒系' },
  { name: '学徒II',   major: '学徒系' },
  { name: '初级学士', major: '学士系' },
  { name: '中级学士', major: '学士系' },
  { name: '高级学士', major: '学士系' },
  { name: '小执事',   major: '执事系' },
  { name: '大执事',   major: '执事系' },
  { name: '教授',     major: '教授系' },
  { name: '高级教授', major: '教授系' },
  { name: '祭司',     major: '祭司系' },
  { name: '大祭司',   major: '祭司系' },
  { name: '和诗',     major: '和诗系' },
  { name: '主和诗',   major: '和诗系' },
];

/** 每晋升一个职介所需等级数 */
export const RANK_STEP = 7;

/** 职业等级上限 / 免费(非道具)升级上限 */
export const CAREER_MAX_LEVEL = 150;
export const CAREER_FREE_MAX = 100;

/** 升到某等级所需经验(随等级增长) */
export function expToNext(level) {
  const lv = Math.max(1, Math.round(level));
  return 60 + lv * 24 + Math.floor(lv * lv * 0.9);
}

/** 等级对应的职介下标(0~12) */
export function rankIndexForLevel(level) {
  const lv = Math.max(1, Math.round(level));
  return Math.min(CAREER_RANKS.length - 1, Math.floor((lv - 1) / RANK_STEP));
}

/** 等级对应的职介 */
export function rankForLevel(level) {
  return CAREER_RANKS[rankIndexForLevel(level)];
}

/** 某职介的起步等级 */
export function rankStartLevel(rankIndex) {
  return rankIndex * RANK_STEP + 1;
}

/** 晋升奖励(职介越高越大) */
export function rankReward(rankIndex) {
  const i = Math.max(0, Math.min(CAREER_RANKS.length - 1, rankIndex));
  return {
    gold: 120 * Math.pow(1.45, i),
    // 高阶额外给宝石 / 材料
    gem: i >= 6 ? 1 : 0,
    material: i >= 3 ? 2 : 1,
  };
}

/** 该职介是否开创了一个新的大职介(需要赠送整套服饰) */
export function startsNewMajor(rankIndex) {
  const i = Math.max(0, Math.min(CAREER_RANKS.length - 1, rankIndex));
  if (i === 0) return false;
  return CAREER_RANKS[i].major !== CAREER_RANKS[i - 1].major;
}

/** 职业经验加成:职介越高,战斗获得的职业经验越多 */
export function rankExpBonus(rankIndex) {
  return 1 + Math.max(0, rankIndex) * 0.15;
}

const clamp0 = (i) => Math.max(0, Math.min(CAREER_RANKS.length - 1, i));

/** 大职介 → 职衔后缀(与职业根名合成,如 魔法 + 教授 = 魔法教授) */
export const MAJOR_SUFFIX = {
  '学徒系': '学徒',
  '学士系': '学士',
  '执事系': '执事',
  '教授系': '教授',
  '祭司系': '祭司',
  '和诗系': '和诗',
};

/** 某职介对应的大职介职衔后缀 */
export function rankSuffix(rankIndex) {
  return MAJOR_SUFFIX[CAREER_RANKS[clamp0(rankIndex)].major] || '';
}

/**
 * 由职业根名与职业等级合成当前职业名(随职介晋升而改变)。
 * 例:('魔法', 62) → '魔法教授'(62 级 → 高级教授 / 教授系)
 * @param {string} root 职业根名(如 剑术 / 魔法)
 * @param {number} level 职业等级 1~150
 */
export function careerTitleOf(root, level) {
  return `${root || ''}${rankSuffix(rankIndexForLevel(level))}`;
}
