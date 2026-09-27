/**
 * images.js — 15 张主线剧情插图映射。
 * 图片为本地静态资源,存放于 assets/img/,随仓库一起部署。
 * key 格式:`${chapterId}:${nodeId}`
 * 路径使用相对路径 ./assets/img/...,浏览器基于 index.html 文档基址解析,
 * 兼容本地预览与 GitHub Pages 子路径部署。
 */

export const CHAPTER_IMAGES = {
  // ===== 第一章 家园破碎 =====
  'ch01:n01': './assets/img/ch01_n01.jpg',
  'ch01:n02': './assets/img/ch01_n02.jpg',
  'ch01:n05': './assets/img/ch01_n05.jpg',
  // ===== 第一章 赫尔墨引路(岔路与引路人,不展示具体职业)=====
  'ch01:n06': './assets/img/ch01_n06.jpg',
  // ===== 第二章 踏上旅程 =====
  'ch02:n01': './assets/img/ch02_n01.jpg',
  'ch02:n04': './assets/img/ch02_n04.jpg',
  // ===== 第三章 王国拜访 =====
  'ch03:n01': './assets/img/ch03_n01.jpg',
  'ch03:n06': './assets/img/ch03_n06.jpg',
  // ===== 第四章 渔港寻亲 =====
  'ch04:n01': './assets/img/ch04_n01.jpg',
  // ===== 第五章 屠龙少年 =====
  'ch05:n01': './assets/img/ch05_n01.jpg',
  // ===== 第八章 拜师学艺 =====
  'ch08:n01': './assets/img/ch08_n01.jpg',
  // ===== 第九章 飞行学院 =====
  'ch09:n01': './assets/img/ch09_n01.jpg',
  // ===== 第十章 海洋学院 =====
  'ch10:n01': './assets/img/ch10_n01.jpg',
  // ===== 第十四章 大祭司之战 =====
  'ch14:n01': './assets/img/ch14_n01.jpg',
  // ===== 第十五章 回归主城 =====
  'ch15:n03': './assets/img/ch15_n03.jpg',
};
