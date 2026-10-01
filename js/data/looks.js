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

/** 7 种小男孩形象 */
export const BODY_STYLES = [
  { id: 'cute',    name: '可爱',   tag: '圆眼大瞳,脸颊带红', hairColor: '#3b2a22', hairStyle: 'bob',   eyeStyle: 'round',  blush: true,  accessory: 'none',   skin: 'fair' },
  { id: 'dopey',   name: '呆萌',   tag: '半垂眼,慢半拍',     hairColor: '#4a3a2a', hairStyle: 'bob',   eyeStyle: 'droopy', blush: false, accessory: 'none',   skin: 'porcelain' },
  { id: 'genki',   name: '元气',   tag: '上挑眼,总在笑',     hairColor: '#2f2018', hairStyle: 'spiky', eyeStyle: 'bright', blush: true,  accessory: 'band',   skin: 'wheat' },
  { id: 'quiet',   name: '文静',   tag: '垂眼低眉,说话轻',   hairColor: '#43301f', hairStyle: 'side',  eyeStyle: 'droopy', blush: false, accessory: 'none',   skin: 'fair' },
  { id: 'roguish', name: '顽皮',   tag: '斜眼坏笑,闲不住',   hairColor: '#35241a', hairStyle: 'spiky', eyeStyle: 'sly',    blush: false, accessory: 'none',   skin: 'tan' },
  { id: 'brave',   name: '英气',   tag: '剑眉挺鼻,站的笔直', hairColor: '#2a1d17', hairStyle: 'side',  eyeStyle: 'sharp',  blush: false, accessory: 'none',   skin: 'brown' },
  { id: 'gentle',  name: '温柔',   tag: '眼里有光,总在安慰人', hairColor: '#5a4030', hairStyle: 'bob',   eyeStyle: 'bright', blush: true,  accessory: 'leaf',   skin: 'porcelain' },
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
