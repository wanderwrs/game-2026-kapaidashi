/**
 * ch01.js — 第一章:家园破碎(扩充版)
 * 主题:黑龙焚村、弟弟失踪、剑塔倾颓、初遇教徒、踏上旅程
 * 主线 ~150000字 · 支线4条各 ~50000字
 * 关键 flag:began_quest / spared_cultist / sacrificed_self / met_mentor
 * 战斗:1 场(龙脊教徒)
 *
 * 节点结构:
 *   主线: n01→n01b→n01c→n02→n02b→n02c→n03(choice)→n04a/b/c→n04d→n04e→n05
 *         →n05b→n05sq1(choice)→n06→n06b→n06sq2(choice)→n07(choice)→n08a/b/c
 *         →n08d→n08e→n09→n09b→n09sq3(choice)→n10→n10b→n11(choice)→n12_battle/sneak
 *         →n12c→n13→n13b→n13sq4(choice)→n14(choice: ch02/ch03/ch04)
 *   支线1: sq1_n01→...→sq1_exit→n06
 *   支线2: sq2_n01→...→sq2_exit→n07
 *   支线3: sq3_n01→...→sq3_exit→n10
 *   支线4: sq4_n01→...→sq4_exit→n14
 */

import { mainNodes1 } from './ch01_main_1.js?v=20260929j';
import { mainNodes2 } from './ch01_main_2.js?v=20260929j';
import { mainNodes3 } from './ch01_main_3.js?v=20260929j';
import { sq1Nodes } from './ch01_sq1.js?v=20260929j';
import { sq2Nodes } from './ch01_sq2.js?v=20260929j';
import { sq3Nodes } from './ch01_sq3.js?v=20260929j';
import { sq4Nodes } from './ch01_sq4.js?v=20260929j';

const allNodes = [
  ...mainNodes1, ...mainNodes2, ...mainNodes3,
  ...sq1Nodes, ...sq2Nodes, ...sq3Nodes, ...sq4Nodes,
];

export const CHAPTER_01 = {
  id: 'ch01',
  title: '第一章 · 家园破碎',
  start: 'n01',
  nodes: new Map(allNodes.map((n) => [n.id, n])),
};
