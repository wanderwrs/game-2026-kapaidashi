/**
 * PLAN.md — 后续剧情填充计划(非执行文件,仅文档)
 *
 * 字数目标:100000 字 · 节点目标:300 · 结局:4
 *
 * 关键 flag(影响结局的 25% 抉择,75 个):
 *   began_quest          主线开启
 *   spared_cultist       救陌生孩子(慈悲线)
 *   abandoned_stranger   弃陌生孩子(理性线)
 *   sacrificed_self      以己换弟(悲线)
 *   direct_chase         直追弟(勇线)
 *   seek_aid             求王国(理线)
 *   seek_mother          寻母亲(悯线)
 *   saved_village         救村庄
 *   found_brother        找回弟弟
 *   killed_dragon        屠龙
 *   exposed_church       揭穿伪神
 *   spared_priest        饶过大祭司
 *   abandoned_quest      放弃任务
 *
 * 结局映射(resolveEnding):
 *   hero      英雄回归  : saved_village + found_brother + mercy>=2
 *   tragic    悲剧献身  : sacrificed_self
 *   recluse   隐世退避  : abandoned_quest
 *   odyssey   未尽征程  : 默认/其他组合
 *
 * 填充规则(每章):
 *   1. 文件命名 ch<NN>.js,结构仿 ch01.js
 *   2. 章首节点 id="n01",章末分叉 next 指向下一章 "ch<NN+1>:n01"
 *   3. 文字 ~6700 字,节点 ~20,关键 flag 抉择 ~5
 *   4. 至少含 1 场战斗,enemyPool 在 data.js ENEMIES 中预置
 *   5. 填完后在 index.js 的 import + CHAPTERS 中登记
 */
export const PLAN = 'see comment above';
