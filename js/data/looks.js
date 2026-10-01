/**
 * looks.js — 角色形象数据(7 种小男孩造型 × 5 种肤色)。
 *
 * 造型差异由「发型 / 眼型 / 腮红 / 头饰」组合体现,肤色独立可选。
 * scene.js 的像素绘制读取这里的参数。
 * 改名卡改名字,美梦药水换形象(造型 + 肤色)。
 */

/** 5 种肤色(由白到棕) */
export const SKIN_TONES = [
  { id: 'porcelain', name: '瓷白', skin: '#f7dcc6', shade: '#e3bda1' },
  { id: 'fair',      name: '白皙', skin: '#f0c9a6', shade: '#d7a880' },
  { id: 'wheat',     name: '小麦', skin: '#dda87a', shade: '#bd8a5c' },
  { id: 'tan',       name: '浅棕', skin: '#bb855a', shade: '#986740' },
  { id: 'brown',     name: '深棕', skin: '#8a5732', shade: '#6b4023' },
];

/**
 * 7 种小男孩形象。
 *
 * 除「发型 / 眼型 / 腮红 / 头饰」外,形象还决定身材:
 *   stature  身高:相对基准的像素数,正数 = 更矮(上身下移、腿变短),负数 = 更高
 *   girth    体格:躯干每侧加宽的像素(正数更敦实,负数更瘦削)
 *   limb     四肢粗细:手臂 / 腿的宽度增减
 * scene.js 的像素绘制读取这些参数,因此同一件衣服穿在不同形象上
 * 也是高矮胖瘦各不相同的剪影。
 */
export const BODY_STYLES = [
  // 高矮(自高而低):英气 62 → 顽皮 61 → 元气 60 → 文静 59 → 温柔 58 → 呆萌 57 → 可爱 56
  // 体格(自瘦而壮):文静 / 顽皮 22 → 元气 / 温柔 26 → 可爱 / 呆萌 28 → 英气 30
  { id: 'cute',    name: '可爱',   tag: '圆眼大瞳,脸颊带红',   hairColor: '#3b2a22', hairStyle: 'bob',   eyeStyle: 'round',  blush: true,  accessory: 'none', skin: 'fair',      stature: 5,  girth: 1,  limb: 0 },
  { id: 'dopey',   name: '呆萌',   tag: '半垂眼,慢半拍',       hairColor: '#4a3a2a', hairStyle: 'bob',   eyeStyle: 'droopy', blush: false, accessory: 'none', skin: 'porcelain', stature: 4,  girth: 1,  limb: 0 },
  { id: 'genki',   name: '元气',   tag: '上挑眼,总在笑',       hairColor: '#2f2018', hairStyle: 'spiky', eyeStyle: 'bright', blush: true,  accessory: 'band', skin: 'wheat',     stature: 3,  girth: 0,  limb: 0 },
  { id: 'quiet',   name: '文静',   tag: '垂眼低眉,说话轻',     hairColor: '#43301f', hairStyle: 'side',  eyeStyle: 'droopy', blush: false, accessory: 'none', skin: 'fair',      stature: 2,  girth: -1, limb: -1 },
  { id: 'roguish', name: '顽皮',   tag: '斜眼坏笑,闲不住',     hairColor: '#35241a', hairStyle: 'spiky', eyeStyle: 'sly',    blush: false, accessory: 'none', skin: 'tan',       stature: 2,  girth: -1, limb: -1 },
  { id: 'brave',   name: '英气',   tag: '剑眉挺鼻,站的笔直',   hairColor: '#2a1d17', hairStyle: 'side',  eyeStyle: 'sharp',  blush: false, accessory: 'none', skin: 'brown',     stature: -1, girth: 1,  limb: 1 },
  { id: 'gentle',  name: '温柔',   tag: '眼里有光,总在安慰人', hairColor: '#5a4030', hairStyle: 'bob',   eyeStyle: 'bright', blush: true,  accessory: 'leaf', skin: 'porcelain', stature: 3,  girth: 0,  limb: 0 },
];

/** 造型 id → 定义 */
export const BODY_MAP = Object.fromEntries(BODY_STYLES.map((b) => [b.id, b]));
/** 肤色 id → 定义 */
export const SKIN_MAP = Object.fromEntries(SKIN_TONES.map((s) => [s.id, s]));

export const DEFAULT_BODY = 'cute';
export const DEFAULT_SKIN = 'fair';

/** 形象描述(用于 UI 展示) */
export function lookLabel(bodyId, skinId) {
  const b = BODY_MAP[bodyId] || BODY_MAP[DEFAULT_BODY];
  const s = SKIN_MAP[skinId] || SKIN_MAP[DEFAULT_SKIN];
  return `${s.name}肤 · ${b.name}`;
}
