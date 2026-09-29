/**
 * ch02.js — 第二章 · 踏上旅程(直追弟弟线)
 * 节拍:边境遭遇盗匪 → 雨夜孤驿 → 遇见同行少年 → 抉择是否结伴 → 山脚哨站 → 章末抉择
 * 战斗:1 场(边境盗匪)
 * 关键 flag:met_friend(偶遇朋友)、shared_path(砥砺前行)、got_horse(夺马)
 *
 * 节点结构:
 *   主线: n01→n02(choice)→n03_battle/n03_trick/n03_escape→n04→n04sq1(choice)
 *         →n05(choice)→n06_join/n06_solo→n06_switch→n07→n07sq1(choice)
 *         →n08(choice: ch05/ch03/ch04)
 *   支线1: sq1_n01→…→sq1_exit→n05   (雨夜追兵)
 *   支线2: sq2_n01→…→sq2_exit→n08   (山脚密道)
 */

import { mainNodes1 } from './ch02_main_1.js?v=20260930a';
import { mainNodes2 } from './ch02_main_2.js?v=20260930a';
import { sq1Nodes } from './ch02_sq1.js?v=20260930a';
import { sq2Nodes } from './ch02_sq2.js?v=20260930a';

const allNodes = [
  ...mainNodes1, ...mainNodes2,
  ...sq1Nodes, ...sq2Nodes,
];

export const CHAPTER_02 = {
  id: 'ch02',
  title: '第二章 · 踏上旅程',
  start: 'n01',
  nodes: new Map(allNodes.map((n) => [n.id, n])),
};
