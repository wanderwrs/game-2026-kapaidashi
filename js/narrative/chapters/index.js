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

import { CHAPTER_01 } from './ch01.js?v=20261006e';
import { CHAPTER_02 } from './ch02.js?v=20261006e';
import { CHAPTER_02B } from './ch02b.js?v=20261006e';
import { CHAPTER_03 } from './ch03.js?v=20261006e';
import { CHAPTER_04 } from './ch04.js?v=20261006e';
import { CHAPTER_04B } from './ch04b.js?v=20261006e';
import { CHAPTER_05 } from './ch05.js?v=20261006e';
import { CHAPTER_05B } from './ch05b.js?v=20261006e';
import { CHAPTER_06 } from './ch06.js?v=20261006e';
import { CHAPTER_07 } from './ch07.js?v=20261006e';
import { CHAPTER_08 } from './ch08.js?v=20261006e';
import { CHAPTER_09 } from './ch09.js?v=20261006e';
import { CHAPTER_10 } from './ch10.js?v=20261006e';
import { CHAPTER_11 } from './ch11.js?v=20261006e';
import { CHAPTER_12 } from './ch12.js?v=20261006e';
import { CHAPTER_13 } from './ch13.js?v=20261006e';
import { CHAPTER_14 } from './ch14.js?v=20261006e';
import { CHAPTER_15 } from './ch15.js?v=20261006e';
import { CHAPTER_16 } from './ch16.js?v=20261006e';
import { CHAPTER_17 } from './ch17.js?v=20261006e';
import { CHAPTER_18 } from './ch18.js?v=20261006e';
import { CHAPTER_19 } from './ch19.js?v=20261006e';
import { CHAPTER_20 } from './ch20.js?v=20261006e';
import { CHAPTER_21 } from './ch21.js?v=20261006e';
import { CHAPTER_22 } from './ch22.js?v=20261006e';
import { CHAPTER_23 } from './ch23.js?v=20261006e';
import { CHAPTER_24 } from './ch24.js?v=20261006e';
import { CHAPTER_25 } from './ch25.js?v=20261006e';
import { CHAPTER_26 } from './ch26.js?v=20261006e';
import { CHAPTER_27 } from './ch27.js?v=20261006e';
import { CHAPTER_FS1 } from './fs1.js?v=20261006e';
import { CHAPTER_FS2 } from './fs2.js?v=20261006e';
import { CHAPTER_FS3 } from './fs3.js?v=20261006e';
import { CHAPTER_FS4 } from './fs4.js?v=20261006e';
import { CHAPTER_FSA5 } from './fsa5.js?v=20261006e';
import { CHAPTER_FSA6 } from './fsa6.js?v=20261006e';
import { CHAPTER_FSA7 } from './fsa7.js?v=20261006e';
import { CHAPTER_FSA8 } from './fsa8.js?v=20261006e';
import { CHAPTER_FSB5 } from './fsb5.js?v=20261006e';
import { CHAPTER_FSB6 } from './fsb6.js?v=20261006e';
import { CHAPTER_FSB7 } from './fsb7.js?v=20261006e';
import { CHAPTER_FSB8 } from './fsb8.js?v=20261006e';

export const CHAPTERS = {
  ch01: CHAPTER_01, ch02: CHAPTER_02, ch02b: CHAPTER_02B, ch03: CHAPTER_03,
  ch04: CHAPTER_04, ch04b: CHAPTER_04B, ch05: CHAPTER_05, ch05b: CHAPTER_05B,
  ch06: CHAPTER_06, ch07: CHAPTER_07, ch08: CHAPTER_08, ch09: CHAPTER_09,
  ch10: CHAPTER_10, ch11: CHAPTER_11, ch12: CHAPTER_12, ch13: CHAPTER_13,
  ch14: CHAPTER_14, ch15: CHAPTER_15,
  ch16: CHAPTER_16, ch17: CHAPTER_17, ch18: CHAPTER_18, ch19: CHAPTER_19,
  ch20: CHAPTER_20, ch21: CHAPTER_21, ch22: CHAPTER_22, ch23: CHAPTER_23,
  ch24: CHAPTER_24, ch25: CHAPTER_25, ch26: CHAPTER_26, ch27: CHAPTER_27,
  fs1: CHAPTER_FS1, fs2: CHAPTER_FS2, fs3: CHAPTER_FS3, fs4: CHAPTER_FS4,
  fsa5: CHAPTER_FSA5, fsa6: CHAPTER_FSA6, fsa7: CHAPTER_FSA7, fsa8: CHAPTER_FSA8,
  fsb5: CHAPTER_FSB5, fsb6: CHAPTER_FSB6, fsb7: CHAPTER_FSB7, fsb8: CHAPTER_FSB8,
};

/** 全部主线小节(ch01~ch27),不含支线地区与法师支线 */
export const CHAPTER_ORDER = [
  'ch01','ch02','ch03','ch04','ch05','ch06','ch07','ch08','ch09','ch10',
  'ch11','ch12','ch13','ch14','ch15',
  'ch16','ch17','ch18','ch19','ch20','ch21','ch22','ch23','ch24','ch25','ch26','ch27',
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
];

/** 法师支线分组(独立于主线,由法师职业触发) */
export const MAGE_SIDE_CHAPTERS = {
  basic: ['fs1', 'fs2', 'fs3', 'fs4'],
  white: ['fsa5', 'fsa6', 'fsa7', 'fsa8'],
  black: ['fsb5', 'fsb6', 'fsb7', 'fsb8'],
};

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
