/**
 * index.js — 章节注册中心。
 * 已实现章节在此 import 并登记;未实现章节以占位形式存在,
 * 当后续章节填充完毕后,只需在此处 import 并加入 CHAPTERS 即可生效。
 *
 * ===== 全章规划(共 15 章 / 目标 10 万字 / 300 抉择) =====
 * 约束:每章字数 ~6700 / 节点 ~20 / 抉择中 75% 不影响结局
 *
 * 已完成:
 *   ch01 家园破碎       ~3000 字 / 15 节点  ✅
 *
 * 待填充(每章模板见 ch01.js,可按此结构批量生成):
 *   ch02 踏上旅程(直追弟线)          ~6700 字 / 20 节点
 *   ch03 王国拜访(求助线)            ~6700 字 / 20 节点
 *   ch04 渔港寻亲(回乡线)            ~6700 字 / 20 节点
 *   ch05 屠龙少年(首次屠龙战)        ~6700 字 / 20 节点
 *   ch06 收养弟弟(意外收养)          ~6700 字 / 20 节点
 *   ch07 森林探险                     ~6700 字 / 20 节点
 *   ch08 拜师学艺(剑塔师承)          ~6700 字 / 20 节点
 *   ch09 飞行学院                     ~6700 字 / 20 节点
 *   ch10 海洋学院                     ~6700 字 / 20 节点
 *   ch11 神学学院                     ~6700 字 / 20 节点
 *   ch12 弟弟失踪(伪失踪)            ~6700 字 / 20 节点
 *   ch13 拯救村庄                     ~6700 字 / 20 节点
 *   ch14 大祭司之战(终战)            ~6700 字 / 20 节点
 *   ch15 回归主城 + 新征程(收束)     ~6700 字 / 20 节点
 *
 * 当前可玩:ch01 → 三选一分支跳到 ch02/03/04 占位(占位节点提示后续章节待填充)
 */

import { CHAPTER_01 } from './ch01.js';

// ===== 占位章:章节未填充时给一个友好提示节点 =====
function placeholderChapter(id, title, nextChapterHint) {
  return {
    id,
    title,
    start: 'placeholder',
    nodes: new Map([
      [
        'placeholder',
        {
          id: 'placeholder',
          kind: 'narrative',
          chapter: id,
          text: `[${title} · 章节待填充]\n\n本章剧情尚未完成填充。当前框架已支撑:节点跳转、flag 记录、结局判定、6 职业卡组系统。后续按 ch01.js 模板批量填充即可生效。\n\n你已积累的关键抉择:${nextChapterHint || '(无)'}`,
          next: null, // null 表示到此结束,回到主菜单
        },
      ],
    ]),
  };
}

export const CHAPTERS = {
  ch01: CHAPTER_01,
  ch02: placeholderChapter('ch02', '第二章 · 踏上旅程', '直追弟弟'),
  ch03: placeholderChapter('ch03', '第三章 · 王国拜访', '寻求王国旧识'),
  ch04: placeholderChapter('ch04', '第四章 · 渔港寻亲', '打听母亲下落'),
  ch05: placeholderChapter('ch05', '第五章 · 屠龙少年', '首战黑龙'),
  ch06: placeholderChapter('ch06', '第六章 · 收养弟弟', '意外收养'),
  ch07: placeholderChapter('ch07', '第七章 · 森林探险', '深入迷林'),
  ch08: placeholderChapter('ch08', '第八章 · 拜师学艺', '剑塔师承'),
  ch09: placeholderChapter('ch09', '第九章 · 飞行学院', '云端求学'),
  ch10: placeholderChapter('ch10', '第十章 · 海洋学院', '远洋求学'),
  ch11: placeholderChapter('ch11', '第十一章 · 神学学院', '揭穿伪神'),
  ch12: placeholderChapter('ch12', '第十二章 · 弟弟失踪', '伪失踪'),
  ch13: placeholderChapter('ch13', '第十三章 · 拯救村庄', '解救乡民'),
  ch14: placeholderChapter('ch14', '第十四章 · 大祭司之战', '终战对决'),
  ch15: placeholderChapter('ch15', '第十五章 · 回归主城', '新征程开启'),
};

export const CHAPTER_ORDER = [
  'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07',
  'ch08', 'ch09', 'ch10', 'ch11', 'ch12', 'ch13', 'ch14', 'ch15',
];
