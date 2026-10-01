/**
 * index.js — 章节注册中心。
 * 全 15 章已完成:家园破碎→新征程,覆盖用户指定全部剧情节拍。
 * 另有 2 个支线地区章节:ch04b 潮生镇(第四章支线)、ch05b 雪脊商驿(第五章支线),
 * 由主线抉择进入、走完回接主线,不占主线进度(见 chapterNumber / chapterProgressIndex)。
 *
 * 总字数 ~18000 · 节点 ~120 · 抉择 ~45(其中影响结局的关键 flag ~25)
 * 结局 4 种:英雄回归 / 悲剧献身 / 隐世退避 / 未尽征程
 *
 * 关键 flag(由 resolveEnding 综合):
 *   began_quest / sacrificed_self / spared_cultist / abandoned_stranger
 *   direct_chase / seek_aid / seek_mother / met_friend / shared_path
 *   met_mentor / mentor_dead / exposed_church / mother_truth / found_mother
 *   killed_dragon / spared_dragon / found_brother / adopted_brother / calmed_dragon
 *   mastered_sword / brother_control / aviator_ally / mariner_ally / got_wings / got_ship
 *   got_holy_page / brother_lost / brother_returned / saved_village / got_secret_map
 *   killed_grandpriest / spared_priest / direct_strike / abandoned_quest
 */

import { CHAPTER_01 } from './ch01.js?v=20261001n';
import { CHAPTER_02 } from './ch02.js?v=20261001n';
import { CHAPTER_02B } from './ch02b.js?v=20261001n';
import { CHAPTER_03 } from './ch03.js?v=20261001n';
import { CHAPTER_04 } from './ch04.js?v=20261001n';
import { CHAPTER_04B } from './ch04b.js?v=20261001n';
import { CHAPTER_05 } from './ch05.js?v=20261001n';
import { CHAPTER_05B } from './ch05b.js?v=20261001n';
import { CHAPTER_06 } from './ch06.js?v=20261001n';
import { CHAPTER_07 } from './ch07.js?v=20261001n';
import { CHAPTER_08 } from './ch08.js?v=20261001n';
import { CHAPTER_09 } from './ch09.js?v=20261001n';
import { CHAPTER_10 } from './ch10.js?v=20261001n';
import { CHAPTER_11 } from './ch11.js?v=20261001n';
import { CHAPTER_12 } from './ch12.js?v=20261001n';
import { CHAPTER_13 } from './ch13.js?v=20261001n';
import { CHAPTER_14 } from './ch14.js?v=20261001n';
import { CHAPTER_15 } from './ch15.js?v=20261001n';

export const CHAPTERS = {
  ch01: CHAPTER_01,
  ch02: CHAPTER_02,
  ch02b: CHAPTER_02B,
  ch03: CHAPTER_03,
  ch04: CHAPTER_04,
  ch04b: CHAPTER_04B,
  ch05: CHAPTER_05,
  ch05b: CHAPTER_05B,
  ch06: CHAPTER_06,
  ch07: CHAPTER_07,
  ch08: CHAPTER_08,
  ch09: CHAPTER_09,
  ch10: CHAPTER_10,
  ch11: CHAPTER_11,
  ch12: CHAPTER_12,
  ch13: CHAPTER_13,
  ch14: CHAPTER_14,
  ch15: CHAPTER_15,
};

export const CHAPTER_ORDER = [
  'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07',
  'ch08', 'ch09', 'ch10', 'ch11', 'ch12', 'ch13', 'ch14', 'ch15',
];

/**
 * 由章节 id 解析「大章序号」:ch04→4、ch04b→4、ch15→15。
 * 支线地区(ch04b / ch05b)与所属大章同号,不计入主线进度。
 */
export function chapterNumber(id) {
  const m = /^ch0*(\d+)/.exec(String(id || ''));
  return m ? Number(m[1]) : 0;
}

/**
 * 章节在主线 CHAPTER_ORDER 中的进度下标(ch04b 归入 ch04)。找不到返回 -1。
 */
export function chapterProgressIndex(id) {
  const direct = CHAPTER_ORDER.indexOf(id);
  if (direct >= 0) return direct;
  const n = chapterNumber(id);
  return n ? CHAPTER_ORDER.findIndex((cid) => chapterNumber(cid) === n) : -1;
}
