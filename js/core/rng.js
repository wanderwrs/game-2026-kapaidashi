/**
 * 种子化伪随机数生成器
 * 基于 Mulberry32,保证同一种子产生相同序列,便于复现与调试。
 */

export class RNG {
  constructor(seed = Date.now()) {
    this._state = seed >>> 0;
    this.seed = seed >>> 0;
  }

  /** 返回 [0, 1) 浮点 */
  next() {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 整数 [min, max] 闭区间 */
  range(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** 从数组随机取一个元素 */
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Fisher-Yates 原地洗牌,返回原数组引用 */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** 概率 p 返回 true,p ∈ [0,1] */
  chance(p) {
    return this.next() < p;
  }

  /** 取前 n 个不重复随机元素 */
  sample(arr, n) {
    const copy = arr.slice();
    this.shuffle(copy);
    return copy.slice(0, n);
  }
}

/** 从字符串生成 32 位种子(用于自定义种子输入) */
export function seedFromString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
