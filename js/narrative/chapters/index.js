/**
 * index.js — 章节注册中心。
 *
 * 「大章」(MAJOR_CHAPTERS)是剧情进度与通关结算的顶层单位:
 *   · 第一大章 = ch01 ~ ch15(家园破碎 → 回归王城)
 *   · 第二大章 = ch16 ~ ch27(卡斯特罗城邦战争,12 节)
 * 每个大章含若干「小节」(即原章节,每节对应一个地区)。
 * 通关结算按「大章」进行:走完某大章的最后一节即视为该大章通关。
 *
 * 法师独立支线(fs 系列):fs1~fs4 基础法师,fsa5~fsa8 白魔进阶,fsb5~fsb8 黑魔进阶。
 * 由法师职业在第二大章中触发,不占主线进度。
 */

import { CHAPTER_01 } from './ch01.js?v=20261007l';
import { CHAPTER_02 } from './ch02.js?v=20261007l';
import { CHAPTER_02B } from './ch02b.js?v=20261007l';
import { CHAPTER_03 } from './ch03.js?v=20261007l';
import { CHAPTER_04 } from './ch04.js?v=20261007l';
import { CHAPTER_04B } from './ch04b.js?v=20261007l';
import { CHAPTER_05 } from './ch05.js?v=20261007l';
import { CHAPTER_05B } from './ch05b.js?v=20261007l';
import { CHAPTER_06 } from './ch06.js?v=20261007l';
import { CHAPTER_07 } from './ch07.js?v=20261007l';
import { CHAPTER_08 } from './ch08.js?v=20261007l';
import { CHAPTER_09 } from './ch09.js?v=20261007l';
import { CHAPTER_10 } from './ch10.js?v=20261007l';
import { CHAPTER_11 } from './ch11.js?v=20261007l';
import { CHAPTER_12 } from './ch12.js?v=20261007l';
import { CHAPTER_13 } from './ch13.js?v=20261007l';
import { CHAPTER_14 } from './ch14.js?v=20261007l';
import { CHAPTER_15 } from './ch15.js?v=20261007l';
import { CHAPTER_16 } from './ch16.js?v=20261007l';
import { CHAPTER_17 } from './ch17.js?v=20261007l';
import { CHAPTER_18 } from './ch18.js?v=20261007l';
import { CHAPTER_19 } from './ch19.js?v=20261007l';
import { CHAPTER_20 } from './ch20.js?v=20261007l';
import { CHAPTER_21 } from './ch21.js?v=20261007l';
import { CHAPTER_22 } from './ch22.js?v=20261007l';
import { CHAPTER_23 } from './ch23.js?v=20261007l';
import { CHAPTER_24 } from './ch24.js?v=20261007l';
import { CHAPTER_25 } from './ch25.js?v=20261007l';
import { CHAPTER_26 } from './ch26.js?v=20261007l';
import { CHAPTER_27 } from './ch27.js?v=20261007l';
import { CHAPTER_28 } from './ch28.js?v=20261007l';
import { CHAPTER_29 } from './ch29.js?v=20261007l';
import { CHAPTER_30 } from './ch30.js?v=20261007l';
import { CHAPTER_31 } from './ch31.js?v=20261007l';
import { CHAPTER_32 } from './ch32.js?v=20261007l';
import { CHAPTER_33 } from './ch33.js?v=20261007l';
import { CHAPTER_34 } from './ch34.js?v=20261007l';
import { CHAPTER_35 } from './ch35.js?v=20261007l';
import { CHAPTER_36 } from './ch36.js?v=20261007l';
import { CHAPTER_37 } from './ch37.js?v=20261007l';
import { CHAPTER_38 } from './ch38.js?v=20261007l';
import { CHAPTER_39 } from './ch39.js?v=20261007l';
import { CHAPTER_40 } from './ch40.js?v=20261007l';
import { CHAPTER_41 } from './ch41.js?v=20261007l';
import { CHAPTER_42 } from './ch42.js?v=20261007l';
import { CHAPTER_43 } from './ch43.js?v=20261007l';
import { CHAPTER_44 } from './ch44.js?v=20261007l';
import { CHAPTER_45 } from './ch45.js?v=20261007l';
import { CHAPTER_46 } from './ch46.js?v=20261007l';
import { CHAPTER_47 } from './ch47.js?v=20261007l';
import { CHAPTER_JD1 } from './jd1.js?v=20261007l';
import { CHAPTER_JD2 } from './jd2.js?v=20261007l';
import { CHAPTER_JD3 } from './jd3.js?v=20261007l';
import { CHAPTER_JD4 } from './jd4.js?v=20261007l';
import { CHAPTER_JD5 } from './jd5.js?v=20261007l';
import { CHAPTER_JD6 } from './jd6.js?v=20261007l';
import { CHAPTER_JD7 } from './jd7.js?v=20261007l';
import { CHAPTER_JD8 } from './jd8.js?v=20261007l';
import { CHAPTER_JD9 } from './jd9.js?v=20261007l';
import { CHAPTER_FS1 } from './fs1.js?v=20261007l';
import { CHAPTER_FS2 } from './fs2.js?v=20261007l';
import { CHAPTER_FS3 } from './fs3.js?v=20261007l';
import { CHAPTER_FS4 } from './fs4.js?v=20261007l';
import { CHAPTER_FSA5 } from './fsa5.js?v=20261007l';
import { CHAPTER_FSA6 } from './fsa6.js?v=20261007l';
import { CHAPTER_FSA7 } from './fsa7.js?v=20261007l';
import { CHAPTER_FSA8 } from './fsa8.js?v=20261007l';
import { CHAPTER_FSB5 } from './fsb5.js?v=20261007l';
import { CHAPTER_FSB6 } from './fsb6.js?v=20261007l';
import { CHAPTER_FSB7 } from './fsb7.js?v=20261007l';
import { CHAPTER_FSB8 } from './fsb8.js?v=20261007l';
import { CHAPTER_SQ1 } from './sq1.js?v=20261007l';
import { CHAPTER_SQ2 } from './sq2.js?v=20261007l';
import { CHAPTER_SQ3 } from './sq3.js?v=20261007l';
import { CHAPTER_SQ4 } from './sq4.js?v=20261007l';
import { CHAPTER_SQ5 } from './sq5.js?v=20261007l';
import { CHAPTER_SQ6 } from './sq6.js?v=20261007l';

export const CHAPTERS = {
  ch01: CHAPTER_01, ch02: CHAPTER_02, ch02b: CHAPTER_02B, ch03: CHAPTER_03,
  ch04: CHAPTER_04, ch04b: CHAPTER_04B, ch05: CHAPTER_05, ch05b: CHAPTER_05B,
  ch06: CHAPTER_06, ch07: CHAPTER_07, ch08: CHAPTER_08, ch09: CHAPTER_09,
  ch10: CHAPTER_10, ch11: CHAPTER_11, ch12: CHAPTER_12, ch13: CHAPTER_13,
  ch14: CHAPTER_14, ch15: CHAPTER_15,
  ch16: CHAPTER_16, ch17: CHAPTER_17, ch18: CHAPTER_18, ch19: CHAPTER_19,
  ch20: CHAPTER_20, ch21: CHAPTER_21, ch22: CHAPTER_22, ch23: CHAPTER_23,
  ch24: CHAPTER_24, ch25: CHAPTER_25, ch26: CHAPTER_26, ch27: CHAPTER_27,
  ch28: CHAPTER_28, ch29: CHAPTER_29, ch30: CHAPTER_30, ch31: CHAPTER_31,
  ch32: CHAPTER_32, ch33: CHAPTER_33, ch34: CHAPTER_34, ch35: CHAPTER_35,
  ch36: CHAPTER_36, ch37: CHAPTER_37, ch38: CHAPTER_38, ch39: CHAPTER_39,
  ch40: CHAPTER_40, ch41: CHAPTER_41, ch42: CHAPTER_42, ch43: CHAPTER_43,
  ch44: CHAPTER_44, ch45: CHAPTER_45, ch46: CHAPTER_46, ch47: CHAPTER_47,
  jd1: CHAPTER_JD1, jd2: CHAPTER_JD2, jd3: CHAPTER_JD3, jd4: CHAPTER_JD4,
  jd5: CHAPTER_JD5, jd6: CHAPTER_JD6, jd7: CHAPTER_JD7, jd8: CHAPTER_JD8,
  jd9: CHAPTER_JD9,
  fs1: CHAPTER_FS1, fs2: CHAPTER_FS2, fs3: CHAPTER_FS3, fs4: CHAPTER_FS4,
  fsa5: CHAPTER_FSA5, fsa6: CHAPTER_FSA6, fsa7: CHAPTER_FSA7, fsa8: CHAPTER_FSA8,
  fsb5: CHAPTER_FSB5, fsb6: CHAPTER_FSB6, fsb7: CHAPTER_FSB7, fsb8: CHAPTER_FSB8,
  sq1: CHAPTER_SQ1, sq2: CHAPTER_SQ2, sq3: CHAPTER_SQ3, sq4: CHAPTER_SQ4,
  sq5: CHAPTER_SQ5, sq6: CHAPTER_SQ6,
};

/** 全部主线小节(ch01~ch47),不含支线地区与法师支线 */
export const CHAPTER_ORDER = [
  'ch01','ch02','ch03','ch04','ch05','ch06','ch07','ch08','ch09','ch10',
  'ch11','ch12','ch13','ch14','ch15',
  'ch16','ch17','ch18','ch19','ch20','ch21','ch22','ch23','ch24','ch25','ch26','ch27',
  'ch28','ch29','ch30','ch31','ch32','ch33','ch34','ch35','ch36','ch37',
  'ch38','ch39','ch40','ch41','ch42','ch43','ch44','ch45','ch46','ch47',
];

/**
 * 大章分组:剧情进度与通关结算的顶层单位。
 */
export const MAJOR_CHAPTERS = [
  {
    id: 'mc1',
    no: '第一大章',
    title: '守约之路',
    chapters: ['ch01','ch02','ch03','ch04','ch05','ch06','ch07','ch08','ch09','ch10','ch11','ch12','ch13','ch14','ch15'],
    lastChapter: 'ch15',
  },
  {
    id: 'mc2',
    no: '第二大章',
    title: '卡斯特罗之战',
    chapters: ['ch16','ch17','ch18','ch19','ch20','ch21','ch22','ch23','ch24','ch25','ch26','ch27'],
    lastChapter: 'ch27',
  },
  {
    id: 'mc3',
    no: '第三大章',
    title: '龙族突起',
    chapters: ['ch28','ch29','ch30','ch31','ch32','ch33','ch34','ch35','ch36','ch37','ch38','ch39','ch40','ch41','ch42','ch43','ch44','ch45','ch46','ch47'],
    lastChapter: 'ch47',
  },
];

/** 法师支线分组(独立于主线,由法师职业触发) */
export const MAGE_SIDE_CHAPTERS = {
  basic: ['fs1', 'fs2', 'fs3', 'fs4'],
  white: ['fsa5', 'fsa6', 'fsa7', 'fsa8'],
  black: ['fsb5', 'fsb6', 'fsb7', 'fsb8'],
};

/** 经典师职业支线分组(由 ch35 解锁,独立于主线) */
export const CLASSIC_SIDE_CHAPTERS = ['jd1', 'jd2', 'jd3', 'jd4', 'jd5', 'jd6', 'jd7', 'jd8', 'jd9'];

/** 第三章支线任务分组(由 NPC 对话触发,独立于主线,不影响主线进度) */
export const SIDE_QUEST_CHAPTERS = ['sq1', 'sq2', 'sq3', 'sq4', 'sq5', 'sq6'];

/** 由小节 id 反查所属大章;找不到返回 null */
export function majorChapterOf(chapterId) {
  for (const mc of MAJOR_CHAPTERS) {
    if (mc.chapters.includes(chapterId)) return mc;
  }
  return null;
}

/** 大章序号(1 起算);非主线小节返回 0 */
export function majorChapterNumber(chapterId) {
  const idx = MAJOR_CHAPTERS.findIndex((mc) => mc.chapters.includes(chapterId));
  return idx >= 0 ? idx + 1 : 0;
}

/** 由章节 id 解析「小节序号」(1~27);支线同号 */
export function chapterNumber(id) {
  const m = /^ch0*(\d+)/.exec(String(id || ''));
  return m ? Number(m[1]) : 0;
}

/** 章节在主线 CHAPTER_ORDER 中的进度下标 */
export function chapterProgressIndex(id) {
  const direct = CHAPTER_ORDER.indexOf(id);
  if (direct >= 0) return direct;
  const n = chapterNumber(id);
  return n ? CHAPTER_ORDER.findIndex((cid) => chapterNumber(cid) === n) : -1;
}
