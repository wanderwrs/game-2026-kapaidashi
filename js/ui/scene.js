/**
 * scene.js — 剧情视图的像素图侧栏。
 * 左:人物(状态 / 服饰 / 装扮)  右:所处位置与环境
 *
 * 全部为 canvas 逐像素程序绘制,不依赖任何外部图片资源。
 * 与 .narrative-box 完全独立,不改变剧情文字窗口的尺寸与位置。
 */

/* ============================================================
   调色板
   ============================================================ */
const SKIN = '#e0aa80';
const SKIN_SHADE = '#bd8760';
const HAIR = '#3b2a22';
const HAIR_HI = '#544034';
const EYE = '#241b16';
const MOUTH = '#a4553f';
const PANTS = '#2e3542';
const BOOT = '#241f1c';
const LEATHER = '#5a3f2a';
const METAL = '#b9c0c8';
const METAL_DARK = '#79818c';
const BANDAGE = '#d9d2c0';
const BLOOD = '#8e2119';

/** 轮廓描边色(近黑的暖褐) */
const OUTLINE = '#16110d';
/** 眼睛高光 / 白 */
const EYE_WHITE = '#efe9dc';
const HAIR_SHADE = '#2a1d17';
/** 腮红(小男孩的红润脸颊) */
const BLUSH = '#e6a184';

/** 颜色明暗调整:amt>0 变亮,amt<0 变暗;用于给平面色块加体积感 */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    const k = 1 + amt;
    r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k);
  }
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** 各职业的服饰配色 · 装扮名 · 随身配件 */
const OUTFITS = {
  swordsman:  { cloth: '#6d4a37', cloth2: '#8d6449', trim: '#c9a227', accessory: 'sword',  outfit: '灰麻剑袍 · 父亲旧剑' },
  mage:       { cloth: '#453a6b', cloth2: '#5b4d8c', trim: '#6fc0e8', accessory: 'staff',  outfit: '星图学徒长袍 · 肩挎星图' },
  cavalier:   { cloth: '#37553c', cloth2: '#4a7150', trim: '#27ae60', accessory: 'spear',  outfit: '骑团队服 · 皮质护肩' },
  aviator:    { cloth: '#355364', cloth2: '#486d81', trim: '#6fc0e8', accessory: 'wings',  outfit: '风翼皮甲 · 护目镜' },
  mariner:    { cloth: '#2c554f', cloth2: '#3b6d64', trim: '#16a085', accessory: 'anchor', outfit: '渔家短褂 · 盐渍斗篷' },
  theologian: { cloth: '#63552a', cloth2: '#857138', trim: '#f1c40f', accessory: 'censer', outfit: '修士袍 · 圣典残页' },
};
const OUTFIT_DEFAULT = { cloth: '#464b56', cloth2: '#5b616e', trim: '#c9a227', accessory: 'none', outfit: '粗布行装 · 旧布鞋' };

/** 绘制帽子(由服饰决定);hideHat / 无帽子 / style:'none' 时不着帽 */
function drawHat(P, a) {
  const style = a && a.hatStyle;
  if (!style || style === 'none' || a.hideHat) return;
  const c = a.hat || '#5a3f2a';
  const hi = a.hatHi || shade(c, 0.22);
  const lo = shade(c, -0.3);
  switch (style) {
    case 'straw':   // 宽檐草帽
      P(4, 4, 16, 1, c); P(5, 4, 14, 1, hi); P(4, 5, 16, 1, lo);
      P(7, 0, 10, 4, c); P(7, 3, 10, 1, lo); P(8, 1, 5, 1, hi);
      break;
    case 'cap':     // 皮帽
      P(7, 1, 10, 4, c); P(7, 4, 10, 1, hi); P(7, 3, 10, 1, lo); P(8, 1, 4, 1, shade(c, 0.16));
      break;
    case 'feather': // 羽饰帽
      P(7, 1, 10, 4, c); P(7, 4, 10, 1, hi); P(7, 3, 10, 1, lo);
      P(17, 0, 1, 4, hi); P(17, 0, 1, 1, '#e8cd6e'); P(18, 1, 1, 2, shade(hi, -0.2));
      break;
    case 'hood':    // 学者兜帽(包住两鬓)
      P(6, 0, 12, 4, c); P(6, 4, 1, 8, c); P(17, 4, 1, 8, c);
      P(6, 4, 1, 8, lo); P(8, 1, 8, 1, hi);
      break;
    case 'helm':    // 铁盔
      P(7, 0, 10, 5, c); P(7, 5, 10, 1, lo);
      P(8, 1, 4, 1, '#e6ebf0'); P(11, 3, 2, 3, hi); P(13, 1, 3, 1, shade(c, -0.15));
      break;
    case 'crown':   // 王冠
      P(7, 4, 10, 2, c); P(7, 5, 10, 1, lo);
      P(7, 2, 1, 2, c); P(10, 2, 1, 2, c); P(13, 2, 1, 2, c); P(16, 2, 1, 2, c);
      P(10, 4, 1, 1, hi); P(13, 4, 1, 1, hi);
      break;
    default:
      P(7, 1, 10, 4, c); P(7, 4, 10, 1, hi); P(7, 3, 10, 1, lo);
  }
}

/* ============================================================
   人物像素图(24 × 32 逻辑像素)
   站立正面像 —— 一个小男孩:圆头大眼、窄肩短腿、圆润脸颊
   轮廓描边 + 左侧受光 / 右侧入影;保留全部服饰与配件挂点
   ============================================================ */
const CHAR_W = 24;
const CHAR_H = 32;

function drawCharacter(ctx, scale, careerId, hpRatio, flags, look) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, CHAR_W, CHAR_H);
  ctx.imageSmoothingEnabled = false;

  const base = OUTFITS[careerId] || OUTFIT_DEFAULT;
  const a = look || {};
  // 职业默认配色 → 被已装备服饰覆盖
  const o = {
    cloth: a.cloth || base.cloth,
    cloth2: a.cloth2 || base.cloth2,
    trim: a.trim || base.trim,
    accessory: base.accessory,
  };
  const bareTop = !!a.hideTop;
  const bareBottom = !!a.hideBottom;
  const bareFeet = !!a.hideShoes;
  const cloth = bareTop ? SKIN : o.cloth;
  const cloth2 = bareTop ? SKIN_SHADE : o.cloth2;
  const trim = bareTop ? SKIN : o.trim;
  const pantsCol = bareBottom ? SKIN : (a.pants || PANTS);
  const bootCol = bareFeet ? SKIN : (a.boot || BOOT);
  const acc = o.accessory;

  // 明暗派生:同一色相的亮部 / 暗部,让平面色块显出体积
  const clothHi = shade(cloth, 0.17), clothLo = shade(cloth, -0.3);
  const cloth2Hi = shade(cloth2, 0.17), cloth2Lo = shade(cloth2, -0.28);
  const trimHi = shade(trim, 0.22), trimLo = shade(trim, -0.3);
  const pantsHi = shade(pantsCol, 0.15), pantsLo = shade(pantsCol, -0.28);
  const bootHi = shade(bootCol, 0.18), bootLo = shade(bootCol, -0.35);
  const skinLo = shade(SKIN, -0.26);
  const skinHi = shade(SKIN, 0.12);

  const P = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  // ---- 轮廓底(小男孩:圆头 + 窄肩 + 短腿) ----
  P(6, 0, 12, 1, OUTLINE);       // 头顶
  P(5, 1, 14, 12, OUTLINE);      // 头(圆润,占全身近半)
  P(6, 13, 12, 1, OUTLINE);      // 下颌
  P(10, 13, 4, 2, OUTLINE);      // 颈
  P(7, 14, 10, 7, OUTLINE);      // 躯干(窄肩小身板)
  P(4, 15, 4, 8, OUTLINE);       // 左臂
  P(16, 15, 4, 8, OUTLINE);      // 右臂
  P(7, 20, 10, 3, OUTLINE);      // 胯
  P(7, 23, 5, 5, OUTLINE);       // 左腿
  P(12, 23, 5, 5, OUTLINE);      // 右腿
  P(6, 27, 6, 5, OUTLINE);       // 左靴
  P(12, 27, 6, 5, OUTLINE);      // 右靴

  // ---- 身后配件(先画,被身体遮挡一部分) ----
  if (acc === 'wings') {
    P(0, 11, 5, 8, '#8fb6c9'); P(1, 12, 3, 5, '#b9d7e6'); P(0, 17, 4, 2, '#6f96a8');
    P(19, 11, 5, 8, '#8fb6c9'); P(20, 12, 3, 5, '#b9d7e6'); P(20, 17, 4, 2, '#6f96a8');
  }
  if (acc === 'sword') {
    P(20, 8, 2, 14, METAL); P(20, 8, 1, 14, '#e6ebf0');    // 剑身
    P(19, 21, 4, 1, LEATHER);                              // 护手
    P(20, 22, 2, 4, LEATHER);                              // 握柄
    P(20, 26, 2, 1, trim);                                 // 剑首
  }
  if (acc === 'spear') {
    P(20, 4, 2, 23, LEATHER); P(20, 4, 1, 23, '#7d5b3c');
    P(20, 1, 2, 3, METAL); P(20, 1, 1, 3, '#e6ebf0');
  }
  if (acc === 'staff') {
    P(2, 10, 2, 17, '#6b4a30'); P(2, 10, 1, 17, '#835c3c');
    P(0, 7, 4, 3, trim); P(1, 6, 2, 1, trimHi); P(1, 7, 1, 1, '#fff0b8');
  }

  // ---- 脸(圆润饱满) ----
  P(7, 5, 10, 8, SKIN);                 // 脸(y5~12)
  P(8, 6, 5, 1, skinHi);                // 额头受光
  P(16, 5, 1, 7, skinLo);               // 右颊入影
  P(9, 12, 6, 1, SKIN_SHADE);           // 下颌阴影
  P(4, 8, 1, 3, SKIN_SHADE); P(19, 8, 1, 3, SKIN_SHADE);          // 耳
  P(8, 7, 2, 1, HAIR); P(14, 7, 2, 1, HAIR);                      // 眉
  P(8, 8, 2, 2, EYE); P(8, 8, 1, 1, EYE_WHITE);                   // 左眼(大眼 + 高光)
  P(14, 8, 2, 2, EYE); P(14, 8, 1, 1, EYE_WHITE);                 // 右眼
  P(11, 10, 2, 1, SKIN_SHADE);                                    // 鼻
  P(11, 11, 2, 1, MOUTH);                                         // 口
  P(7, 10, 2, 1, BLUSH); P(15, 10, 2, 1, BLUSH);                  // 腮红
  P(10, 13, 4, 2, SKIN); P(10, 13, 4, 1, SKIN_SHADE);             // 颈(y13~14)

  // ---- 头发(短发蓬松,压在脸上,留额前碎发) ----
  P(6, 1, 12, 4, HAIR);                 // 发顶(y1~4)
  P(8, 1, 4, 1, HAIR_HI);               // 顶部高光
  P(6, 5, 1, 6, HAIR);                  // 左鬓
  P(17, 5, 1, 6, HAIR_SHADE);           // 右鬓(入影)
  P(7, 5, 4, 1, HAIR); P(13, 5, 4, 1, HAIR);   // 额前碎发(中间留缝)

  // ---- 头部服饰(帽子;hideHat 时不着帽,露出头发) ----
  drawHat(P, a);

  // ---- 躯干(窄肩小身板) ----
  P(8, 14, 8, 6, cloth);               // 肩胸(y14~19)
  P(8, 14, 1, 6, clothHi); P(15, 14, 1, 6, clothLo);   // 左受光 / 右入影
  P(10, 16, 4, 4, cloth2);                              // 内襟(y16~19)
  P(10, 16, 1, 4, cloth2Hi); P(13, 16, 1, 4, cloth2Lo);
  P(8, 14, 8, 1, trim);                                // 领口滚边
  P(11, 15, 2, 1, cloth2); P(10, 14, 4, 1, trimHi);     // V 领

  // ---- 双臂(短而细) ----
  P(5, 15, 2, 6, cloth); P(5, 15, 1, 6, clothHi); P(6, 15, 1, 6, clothLo);
  P(17, 15, 2, 6, cloth); P(18, 15, 1, 6, clothLo); P(17, 15, 1, 6, shade(cloth, -0.12));
  P(5, 21, 2, 2, SKIN); P(5, 22, 2, 1, SKIN_SHADE);      // 左手
  P(17, 21, 2, 2, SKIN); P(17, 22, 2, 1, SKIN_SHADE);    // 右手

  // ---- 腰带 ----
  if (!bareTop) {
    P(8, 20, 8, 1, LEATHER);
    P(8, 20, 3, 1, shade(LEATHER, 0.2));
    P(11, 20, 2, 1, trim);
  }

  // ---- 下装(短腿小靴) ----
  P(8, 21, 8, 2, pantsCol);                            // 胯
  P(8, 22, 8, 1, pantsLo);
  P(8, 23, 3, 5, pantsCol); P(8, 23, 1, 5, pantsHi); P(10, 23, 1, 5, pantsLo);   // 左腿
  P(13, 23, 3, 5, pantsCol); P(15, 23, 1, 5, pantsLo);                          // 右腿
  P(7, 28, 4, 4, bootCol); P(7, 28, 4, 1, bootHi); P(7, 31, 4, 1, bootLo);      // 左靴
  P(13, 28, 4, 4, bootCol); P(13, 28, 4, 1, bootHi); P(13, 31, 4, 1, bootLo);   // 右靴

  // ---- 胸前配件 ----
  if (acc === 'anchor') { P(11, 16, 2, 1, METAL); P(11, 17, 2, 2, METAL_DARK); P(10, 19, 4, 1, METAL_DARK); }
  if (acc === 'censer') { P(17, 20, 4, 1, METAL_DARK); P(18, 21, 3, 3, trim); P(18, 24, 3, 1, METAL_DARK); }
  if (acc === 'none' && flags.has('got_horse')) { P(8, 17, 8, 1, LEATHER); }

  // ---- 伤势叠层 ----
  if (hpRatio < 0.5) {
    P(5, 16, 2, 3, BANDAGE);                       // 左臂绷带
    P(15, 7, 1, 1, BLOOD);                         // 脸颊擦伤
  }
  if (hpRatio < 0.25) {
    P(9, 17, 2, 2, BLOOD);                         // 袍上血渍
    P(14, 18, 2, 1, BLOOD);
    P(8, 25, 1, 1, BLOOD);
  }
}

/* ============================================================
   环境像素图(22 × 14 逻辑像素)
   ============================================================ */
const ENV_W = 22;
const ENV_H = 14;

const THEMES = {
  village:  { sky: ['#1b1520', '#3c2b28', '#6e4b2e'], far: '#241d24', mid: '#31282c', ground: '#2b2420', kind: 'village',  weather: 'none' },
  ruins:    { sky: ['#241220', '#4a2027', '#6d2d25'], far: '#1d151a', mid: '#2a1d1e', ground: '#1b1315', kind: 'ruins',    weather: 'ember' },
  meadow:   { sky: ['#0c1322', '#172a45', '#2b4a6d'], far: '#131c2b', mid: '#1e2a1e', ground: '#3b3a1d', kind: 'meadow',   weather: 'star' },
  forest:   { sky: ['#0b1513', '#132420', '#1c342c'], far: '#0e1b17', mid: '#163029', ground: '#14211b', kind: 'forest',   weather: 'mist' },
  border:   { sky: ['#15191f', '#222932', '#363f4a'], far: '#191f27', mid: '#232b35', ground: '#1c2229', kind: 'border',   weather: 'none' },
  road:     { sky: ['#0f1727', '#1a2942', '#2b4367'], far: '#141e2c', mid: '#1d2937', ground: '#33322b', kind: 'road',     weather: 'none' },
  cliff:    { sky: ['#0b0f17', '#141b27', '#202b3b'], far: '#111720', mid: '#19212c', ground: '#171c23', kind: 'cliff',    weather: 'rain' },
  mountain: { sky: ['#0f171f', '#1d2b39', '#32475b'], far: '#17212b', mid: '#1f2b37', ground: '#293038', kind: 'mountain', weather: 'cloud' },
  city:     { sky: ['#141926', '#22293a', '#3a4356'], far: '#1a2029', mid: '#252c38', ground: '#2b2f36', kind: 'city',     weather: 'none' },
  port:     { sky: ['#0d1722', '#17303f', '#2b5566'], far: '#122029', mid: '#1a2f38', ground: '#22323a', kind: 'port',     weather: 'none' },
  sky:      { sky: ['#1a2740', '#2f4a6e', '#5b7ea6'], far: '#3d5a7a', mid: '#587ba0', ground: '#6f92b5', kind: 'sky',      weather: 'cloud' },
};

const THEME_DESC = {
  village:  '炊烟与铁砧声尚在',
  ruins:    '焦土未冷,余烬未熄',
  meadow:   '焚后的麦田,北风穿过',
  forest:   '松脂气味浓得发苦',
  border:   '褪色的双头鹰旗垂着',
  road:     '北道漫长,里程碑越来越稀',
  cliff:    '雨敲着岩棚,火不敢冒烟',
  mountain: '云雾缠在山腰,峰顶不见',
  city:     '石墙与旗帜之间,钟声沉沉',
  port:     '咸风与帆影,桅杆如林',
  sky:      '云在脚下翻涌,风迎面而来',
};

/** 由章节与节点推导当前环境 */
const SCENE_RULES = {
  ch01: [
    [/^n0[1-4]/, { theme: 'ruins',    name: '家园废墟' }],
    [/^n0[5-7]|^n0[89]/, { theme: 'meadow', name: '焚后的麦田' }],
    [/^n09b|^n1[0-2]/, { theme: 'forest', name: '松林' }],
    [/^n1[3-4]/, { theme: 'border',   name: '王国边境哨站' }],
    [/^sq1_/, { theme: 'ruins',  name: '教堂废墟' }],
    [/^sq2_/, { theme: 'ruins',  name: '剑塔残址' }],
    [/^sq3_/, { theme: 'forest', name: '松林深处' }],
    [/^sq4_/, { theme: 'border', name: '边境哨站 · 夜' }],
  ],
  ch02: [
    [/^n0[1-3]/, { theme: 'road', name: '王国北道' }],
    [/^n04$|^n04sq1|^n0[56]/, { theme: 'cliff', name: '崖下岩棚 · 雨夜' }],
    [/^n0[78]|^n07sq1/, { theme: 'mountain', name: '龙脊山脚' }],
    [/^sq1_/, { theme: 'cliff', name: '崖下 · 雨夜' }],
    [/^sq2_/, { theme: 'mountain', name: '山脚哨站旁' }],
  ],
  ch03: [[/^./, { theme: 'city',     name: '王城 · 书记官宅邸' }]],
  ch04: [[/^./, { theme: 'port',     name: '南方渔港' }]],
  ch05: [[/^./, { theme: 'mountain', name: '圣心坛 · 雪岭' }]],
  ch06: [[/^./, { theme: 'village',  name: '山间村舍' }]],
  ch07: [[/^./, { theme: 'forest',   name: '幽深森林' }]],
  ch08: [[/^./, { theme: 'mountain', name: '剑塔 · 雪原' }]],
  ch09: [[/^./, { theme: 'sky',      name: '云端浮岛' }]],
  ch10: [[/^./, { theme: 'port',     name: '远洋学院' }]],
  ch11: [[/^./, { theme: 'city',     name: '大教堂' }]],
  ch12: [[/^./, { theme: 'forest',   name: '山道密林' }]],
  ch13: [[/^./, { theme: 'ruins',    name: '被洗劫的村庄' }]],
  ch14: [[/^./, { theme: 'mountain', name: '圣心坛 · 火柱' }]],
  ch15: [[/^./, { theme: 'city',     name: '王城广场' }]],
};
const CHAPTER_DEFAULT = {
  ch01: { theme: 'meadow', name: '家园 · 边境村落' },
  ch02: { theme: 'road',   name: '王国北道' },
};

function resolveScene(chapterId, nodeId) {
  const rules = SCENE_RULES[chapterId];
  if (rules) for (const [re, spec] of rules) if (re.test(nodeId)) return spec;
  return CHAPTER_DEFAULT[chapterId] || { theme: 'road', name: '未知之地' };
}

/** 稳定随机:同一节点每次渲染一致 */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
function rng(seed) {
  let s = seed || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function drawEnv(ctx, scale, themeKey, nodeId) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, ENV_W, ENV_H);
  ctx.imageSmoothingEnabled = false;

  const t = THEMES[themeKey] || THEMES.road;
  const P = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const r = rng(hash(nodeId + themeKey));

  // 天空分层
  P(0, 0, ENV_W, 5, t.sky[0]);
  P(0, 5, ENV_W, 2, t.sky[1]);
  P(0, 7, ENV_W, 3, t.sky[2]);

  // 星 / 云
  if (t.weather === 'star') {
    for (let i = 0; i < 22; i++) {
      const x = Math.floor(r() * ENV_W), y = Math.floor(r() * 6);
      P(x, y, 1, 1, r() > 0.7 ? '#e8cd6e' : '#9fb4c9');
    }
  }
  if (t.weather === 'cloud') {
    P(2, 2, 8, 1, '#4a5a6b'); P(11, 3, 9, 1, '#3d4b5b'); P(5, 5, 10, 1, '#33404e');
  }

  // 远景山脊
  for (let x = 0; x < ENV_W; x++) {
    const h = 2 + Math.round(2 * Math.abs(Math.sin((x + themeKey.length) * 0.7)));
    P(x, 9 - h, 1, h + 2, t.far);
  }

  // 中景主体
  const k = t.kind;
  if (k === 'village') {
    for (const bx of [3, 9, 15]) {
      P(bx, 7, 4, 4, t.mid); P(bx + 1, 5, 2, 2, t.mid);
      P(bx + 1, 8, 1, 1, '#e8a54a'); // 窗
    }
    P(6, 4, 1, 1, '#6b5a4a'); P(12, 3, 1, 1, '#6b5a4a'); // 炊烟
  } else if (k === 'ruins') {
    P(3, 6, 3, 5, t.mid); P(4, 6, 1, 2, t.mid);
    P(10, 7, 4, 4, t.mid); P(12, 5, 1, 3, t.mid);
    P(17, 8, 3, 3, t.mid);
    P(7, 8, 2, 1, '#3a2020'); // 断梁
  } else if (k === 'meadow') {
    for (let x = 0; x < ENV_W; x += 2) P(x, 9, 1, 2 + (x % 3), '#5c5a24');
    P(19, 5, 1, 6, '#2a2318'); P(18, 4, 3, 2, '#2f3a25');
  } else if (k === 'forest') {
    for (const tx of [2, 6, 10, 14, 18]) {
      P(tx, 4, 1, 7, '#3a2a20');
      P(tx - 1, 5, 3, 1, t.mid); P(tx - 2, 6, 5, 1, t.mid);
      P(tx - 1, 7, 3, 1, t.mid); P(tx - 2, 8, 5, 1, t.mid);
    }
  } else if (k === 'border') {
    for (let x = 1; x < ENV_W; x += 2) P(x, 6, 1, 5, t.mid);
    P(0, 7, ENV_W, 1, t.mid);
    P(16, 2, 1, 6, '#5a4a34'); P(15, 2, 4, 3, '#7a2a22'); // 旗
  } else if (k === 'road') {
    P(0, 10, ENV_W, 3, t.ground);
    for (let x = 2; x < ENV_W; x++) { P(x, 11, 1, 1, '#4a4634'); }
    P(4, 9, 1, 2, '#6b5a4a'); P(17, 9, 1, 2, '#6b5a4a'); // 里程碑
  } else if (k === 'cliff') {
    P(0, 0, ENV_W, 4, t.mid);          // 岩顶
    P(0, 4, 3, 8, t.mid); P(19, 4, 3, 8, t.mid); // 岩壁
    P(5, 12, 12, 1, '#2a2118');        // 地面
  } else if (k === 'mountain') {
    for (let x = 0; x < ENV_W; x++) {
      const h = 5 + Math.round(3 * Math.sin(x * 0.42) + 2 * Math.sin(x * 0.11));
      P(x, 11 - h, 1, h + 1, t.mid);
      if (11 - h < 4) P(x, 11 - h, 1, 2, '#aeb9c2'); // 雪线
    }
  } else if (k === 'city') {
    for (const bx of [1, 6, 11, 16]) {
      const bh = 4 + (bx % 5);
      P(bx, 11 - bh, 4, bh, t.mid);
      P(bx + 1, 12 - bh, 1, 1, '#e8cd6e');       // 窗
      P(bx, 11 - bh, 4, 1, t.far);               // 檐
    }
    P(9, 1, 1, 6, '#5a4a34'); P(8, 1, 3, 2, '#7a2a22'); // 旗
  } else if (k === 'port') {
    P(0, 9, ENV_W, 5, '#1d3a44');                // 海
    for (let x = 0; x < ENV_W; x += 3) P(x, 9 + (x % 2), 2, 1, '#2b5666');
    P(3, 6, 1, 4, '#5a4a34'); P(4, 6, 3, 3, '#d9d2c0');   // 帆 1
    P(15, 7, 1, 3, '#5a4a34'); P(13, 7, 3, 2, '#c9bda5'); // 帆 2
    P(0, 11, 6, 2, '#3a2f24');                   // 码头
  } else if (k === 'sky') {
    P(0, 7, 9, 1, '#7d9cc0'); P(8, 9, 14, 1, '#6b8cb2'); P(3, 11, 12, 1, '#5c7ba1');
    P(4, 3, 7, 2, '#4a6a8c'); P(4, 5, 7, 1, '#3f5c7c');   // 浮岛
    P(6, 2, 1, 1, '#2f4a66'); P(9, 2, 1, 1, '#2f4a66');   // 塔尖
  }

  // 地面
  if (k !== 'cliff' && k !== 'port' && k !== 'sky') P(0, 11, ENV_W, 3, t.ground);

  // 天气叠层
  if (t.weather === 'rain') {
    for (let i = 0; i < 34; i++) {
      const x = Math.floor(r() * ENV_W), y = Math.floor(r() * 12);
      P(x, y, 1, 2, 'rgba(160,190,215,0.5)');
    }
  } else if (t.weather === 'ember') {
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(r() * ENV_W), y = 3 + Math.floor(r() * 9);
      P(x, y, 1, 1, r() > 0.5 ? '#e07038' : '#e8cd6e');
    }
  } else if (t.weather === 'mist') {
    P(0, 7, ENV_W, 1, 'rgba(190,205,200,0.10)');
    P(0, 10, ENV_W, 1, 'rgba(190,205,200,0.08)');
  }
}

/* ============================================================
   状态标记 → 面板芯片
   ============================================================ */
const FLAG_CHIPS = {
  met_mentor:        { label: '剑塔师承', cls: 'is-arcane' },
  met_friend:        { label: '结伴',    cls: 'is-good' },
  shared_path:       { label: '同行',    cls: 'is-good' },
  got_horse:         { label: '夺马',    cls: 'is-good' },
  spared_cultist:    { label: '慈悲',    cls: 'is-good' },
  sacrificed_self:   { label: '舍身',    cls: 'is-warn' },
  abandoned_stranger:{ label: '未救',    cls: 'is-warn' },
  met_bandits:       { label: '遇匪',    cls: 'is-warn' },
  got_secret_path:   { label: '密道',    cls: 'is-arcane' },
  got_cult_intel:    { label: '教团情报', cls: 'is-arcane' },
  learnt_father_past:{ label: '父辈往事', cls: 'is-arcane' },
  began_quest:       { label: '寻弟之誓', cls: 'is-good' },
};

/* ============================================================
   视图对象
   ============================================================ */
export class SceneView {
  constructor(els) {
    this.els = els; // { charCanvas, envCanvas, charName, charOutfit, charStatus, envName, envDesc, mapCanvas, mapCharName }
    this._charCtx = els.charCanvas ? els.charCanvas.getContext('2d') : null;
    this._envCtx = els.envCanvas ? els.envCanvas.getContext('2d') : null;
    this._mapCtx = els.mapCanvas ? els.mapCanvas.getContext('2d') : null;
    if (this._charCtx) this._charCtx.imageSmoothingEnabled = false;
    if (this._envCtx) this._envCtx.imageSmoothingEnabled = false;
    if (this._mapCtx) this._mapCtx.imageSmoothingEnabled = false;
  }

  /** 地区地图左下角的人物形象(与剧情界面同一套像素画法) */
  renderMapPortrait({ career, player, flags, appearance }) {
    if (!this._mapCtx) return;
    const flagSet = new Set(flags || []);
    const hpRatio = player && player.maxHp ? Math.max(0, Math.min(1, player.hp / player.maxHp)) : 1;
    drawCharacter(this._mapCtx, 4, career && career.id, hpRatio, flagSet, appearance);
    if (this.els.mapCharName) this.els.mapCharName.textContent = career ? career.name : '无名少年';
  }

  render({ chapterId, nodeId, career, player, flags, appearance }) {
    if (!this._charCtx || !this._envCtx) return;
    const flagSet = new Set(flags || []);
    const hpRatio = player && player.maxHp ? Math.max(0, Math.min(1, player.hp / player.maxHp)) : 1;

    // ---- 人物 ----
    drawCharacter(this._charCtx, 6, career && career.id, hpRatio, flagSet, appearance);
    const o = OUTFITS[career && career.id] || OUTFIT_DEFAULT;
    if (this.els.charName) this.els.charName.textContent = career ? career.name : '无名少年';
    if (this.els.charOutfit) this.els.charOutfit.textContent = (appearance && appearance.label) || o.outfit;

    if (this.els.charStatus) {
      const chips = [];
      if (hpRatio < 0.3) chips.push({ label: '濒危', cls: 'is-warn' });
      else if (hpRatio < 0.55) chips.push({ label: '重伤', cls: 'is-warn' });
      else if (hpRatio < 0.85) chips.push({ label: '轻伤', cls: 'is-warn' });
      else chips.push({ label: '无恙', cls: 'is-good' });
      for (const f of Object.keys(FLAG_CHIPS)) {
        if (!flagSet.has(f)) continue;
        const c = FLAG_CHIPS[f];
        if (chips.length >= 4) break;
        chips.push(c);
      }
      this.els.charStatus.innerHTML = chips
        .map((c) => `<span class="scene-chip ${c.cls || ''}">${c.label}</span>`)
        .join('');
    }

    // ---- 环境 ----
    const spec = resolveScene(chapterId, nodeId);
    drawEnv(this._envCtx, 8, spec.theme, `${chapterId}:${nodeId}`);
    if (this.els.envName) this.els.envName.textContent = spec.name;
    if (this.els.envDesc) this.els.envDesc.textContent = THEME_DESC[spec.theme] || '';
  }
}
