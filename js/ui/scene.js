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
const BASE_SKIN = '#e0aa80';
const BASE_SKIN_SHADE = '#bd8760';
const BASE_HAIR = '#3b2a22';
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
const BASE_HAIR_SHADE = '#2a1d17';
/** 腮红(小男孩的红润脸颊) */
const BASE_BLUSH = '#e6a184';

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
  theologian: { cloth: '#63552a', cloth2: '#857138', trim: '#f1c40f', accessory: 'censer', outfit: '典士袍 · 古卷残页' },
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
   人物像素图(48 × 64 逻辑像素)
   精细像素风:多像素组合构建完整人体结构
   站立正面像 —— 小男孩:大头大眼、窄肩短腿、圆润脸颊
   左侧受光 / 右侧入影;支持呼吸 / 眨眼 / 微晃 / 发丝飘动
   ============================================================ */
const CHAR_W = 48;
const CHAR_H = 64;

/** 动画周期(毫秒) */
const BREATH_PERIOD = 3200;
const BLINK_PERIOD = 4200;
const BLINK_DURATION = 140;
const SHEEN_PERIOD = 2600;
const SWAY_PERIOD = 5200;
const GLANCE_PERIOD = 6500;
const GLANCE_HOLD = 900;
const FLUTTER_PERIOD = 3800;

function drawCharacter(ctx, scale, careerId, hpRatio, flags, look, time = 0) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, CHAR_W, CHAR_H);
  ctx.imageSmoothingEnabled = false;

  // ---- 动画参数 ----
  const breath = Math.sin((time % BREATH_PERIOD) / BREATH_PERIOD * Math.PI * 2);
  const breathY = Math.round(breath * 0.5);
  const sway = Math.sin((time % SWAY_PERIOD) / SWAY_PERIOD * Math.PI * 2);
  const swayX = Math.round(sway * 0.5);
  const armSwing = Math.round(-sway * 0.8);
  const leftArmX = Math.round(armSwing * 0.5);
  const rightArmX = -leftArmX;
  const blinkPhase = (time % BLINK_PERIOD) / BLINK_PERIOD;
  const blinking = blinkPhase > (1 - BLINK_DURATION / BLINK_PERIOD);
  const glancePhase = (time % GLANCE_PERIOD) / GLANCE_PERIOD;
  const glanceWindow = GLANCE_HOLD / GLANCE_PERIOD;
  let eyeShift = 0;
  if (glancePhase > 0.5 && glancePhase < 0.5 + glanceWindow) eyeShift = 1;
  else if (glancePhase > 0.75 && glancePhase < 0.75 + glanceWindow) eyeShift = -1;
  const sheen = (Math.sin((time % SHEEN_PERIOD) / SHEEN_PERIOD * Math.PI * 2) + 1) / 2;
  const flutter = Math.sin((time % FLUTTER_PERIOD) / FLUTTER_PERIOD * Math.PI * 2);
  const hairFlutter = Math.round(flutter * 0.4);
  const clothFlutter = Math.round(flutter * 0.4);

  const base = OUTFITS[careerId] || OUTFIT_DEFAULT;
  const a = look || {};
  // ---- 形象参数(肤色 / 发色 / 发型 / 眼型 / 腮红),由角色弹窗与美梦药水决定 ----
  const SKIN = a.skinCol || BASE_SKIN;
  const SKIN_SHADE = a.skinShade || BASE_SKIN_SHADE;
  const HAIR = a.hair || BASE_HAIR;
  const HAIR_HI = shade(HAIR, 0.24);
  const HAIR_SHADE = shade(HAIR, -0.3);
  const BLUSH = a.blush === false ? null : BASE_BLUSH;
  const eyeStyle = a.eyeStyle || 'round';
  const hairStyle = a.hairStyle || 'bob';
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

  const clothHi = shade(cloth, 0.2), clothLo = shade(cloth, -0.3), clothMid = shade(cloth, -0.12);
  const cloth2Hi = shade(cloth2, 0.2), cloth2Lo = shade(cloth2, -0.28);
  const trimHi = shade(trim, 0.22), trimLo = shade(trim, -0.3);
  const pantsHi = shade(pantsCol, 0.15), pantsLo = shade(pantsCol, -0.28), pantsMid = shade(pantsCol, -0.1);
  const bootHi = shade(bootCol, 0.18), bootLo = shade(bootCol, -0.35);
  const skinLo = shade(SKIN, -0.26), skinHi = shade(SKIN, 0.12), skinMid = shade(SKIN, -0.1);

  // ---- 身材参数(身高 / 体格 / 四肢粗细),由形象决定 ----
  const stature = Math.round(a.stature || 0);  // 正数 = 更矮(上身下移、腿变短)
  const girth = Math.round(a.girth || 0);      // 躯干每侧加宽像素
  const limb = Math.round(a.limb || 0);        // 手臂 / 腿的粗细增减
  const uy = stature;                          // 上身整体纵向位移
  const legLen = 12 - uy;                      // 腿长(脚掌固定于地面)
  const tx = 15 - girth;                       // 躯干左缘
  const tw = 18 + 2 * girth;                   // 躯干宽度
  const armLx = 11 - girth - limb;             // 左臂左缘
  const armRx = 33 + girth;                    // 右臂左缘
  const armW = 4 + limb;                       // 手臂粗细
  const legLx = 18 - limb;                     // 左腿左缘
  const legRx = 24;                            // 右腿左缘
  const legW = 6 + limb;                       // 腿粗细

  // 身高体现在「上身整体平移 + 腿随之伸缩」:y<55 的部分随身材位移,
  // 脚掌与靴子(y≥55)与地面阴影保持不动。
  const Y = (y) => (y < 55 ? y + uy : y);
  const ox = swayX;
  const oy = breathY;
  const P = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + ox, Y(y) + oy, w, h); };
  const PaL = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + ox + leftArmX, Y(y) + oy, w, h); };
  const PaR = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + ox + rightArmX, Y(y) + oy, w, h); };
  const Ph = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + ox + hairFlutter, Y(y) + oy, w, h); };
  const Pc = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + ox + clothFlutter, Y(y) + oy, w, h); };

  // ============================================================
  // 1. 地面阴影
  // ============================================================
  P(14, 62, 20, 2, 'rgba(0,0,0,0.25)');
  P(16, 63, 16, 1, 'rgba(0,0,0,0.15)');

  // ============================================================
  // 2. 身后配件
  // ============================================================
  if (acc === 'sword') {
    P(39, 8, 2, 28, METAL);
    P(39, 8, 1, 28, '#e6ebf0');
    if (sheen > 0.4) P(39, 8 + Math.floor(sheen * 24), 1, 3, '#ffffff');
    P(37, 35, 6, 1, LEATHER);
    P(39, 36, 2, 6, LEATHER);
    P(39, 36, 1, 6, shade(LEATHER, 0.15));
    P(39, 42, 2, 1, trim);
  }
  if (acc === 'staff') {
    // 杖杆随身高伸缩,杖尾始终保持在同一高度
    P(6, 18, 2, 34 - uy, '#6b4a30');
    P(6, 18, 1, 34 - uy, '#835c3c');
    P(5, 14, 4, 4, trim);
    P(6, 15, 2, 2, trimHi);
    if (sheen > 0.5) P(6, 15, 1, 1, '#ffffff');
  }
  if (acc === 'spear') {
    P(39, 2, 2, 50 - uy, LEATHER);
    P(39, 2, 1, 50 - uy, '#7d5b3c');
    P(38, 0, 4, 3, METAL);
    P(39, 0, 2, 2, '#e6ebf0');
  }
  if (acc === 'wings') {
    P(1, 26, 8, 4, '#8fb6c9'); P(2, 27, 6, 2, '#b9d7e6');
    P(39, 26, 8, 4, '#8fb6c9'); P(40, 27, 6, 2, '#b9d7e6');
    if (sheen > 0.6) { P(3, 27, 1, 1, '#fff'); P(44, 27, 1, 1, '#fff'); }
  }

  // ============================================================
  // 3. 腿部 + 靴子(先画,被躯干遮挡)
  // ============================================================
  // 左腿(上端随身高升降,下端固定,故腿长 = legLen)
  P(legLx, 44, legW, legLen, pantsCol);
  P(legLx, 44, 1, legLen, pantsHi);
  P(legLx + legW - 1, 44, 1, legLen, pantsLo);
  P(legLx + 1, 48, 1, Math.max(2, legLen - 6), pantsMid);
  // 右腿
  P(legRx, 44, legW, legLen, pantsCol);
  P(legRx, 44, 1, legLen, pantsHi);
  P(legRx + legW - 1, 44, 1, legLen, pantsLo);
  P(legRx + 3, 48, 1, Math.max(2, legLen - 6), pantsMid);
  // 左靴
  Pc(17, 55, 8, 7, bootCol);
  Pc(17, 55, 8, 1, bootHi);
  Pc(17, 61, 8, 1, bootLo);
  Pc(18, 56, 1, 5, bootHi);
  // 右靴
  Pc(23, 55, 8, 7, bootCol);
  Pc(23, 55, 8, 1, bootHi);
  Pc(23, 61, 8, 1, bootLo);
  Pc(24, 56, 1, 5, bootHi);

  // ============================================================
  // 4. 躯干(肩 → 腰)
  // ============================================================
  // 肩胸主体(宽度随体格变化:左缘 tx,宽 tw)
  P(tx, 23, tw, 20, cloth);
  P(tx, 23, 2, 20, clothHi);            // 左受光
  P(tx + tw - 2, 23, 2, 20, clothLo);   // 右入影
  // 肩部圆润过渡
  P(tx + 1, 23, tw - 2, 1, clothHi);
  P(tx + tw - 2, 24, 2, 1, clothLo);
  // 内襟(居中,不随体格加宽)
  P(21, 25, 6, 16, cloth2);
  P(21, 25, 1, 16, cloth2Hi);
  P(26, 25, 1, 16, cloth2Lo);
  P(23, 27, 2, 12, shade(cloth2, -0.1));
  // V 领
  P(tx, 23, tw, 1, trim);
  P(20, 24, 8, 1, trim);
  P(21, 25, 6, 1, cloth2);
  P(23, 24, 2, 2, cloth2Hi);
  // 胸前褶皱(贴着两肋)
  P(tx + 2, 28, 1, 3, clothMid);
  P(tx + tw - 3, 28, 1, 3, clothLo);
  P(tx + 2, 34, 1, 3, clothMid);
  P(tx + tw - 3, 34, 1, 3, clothLo);

  // 腰带
  if (!bareTop) {
    P(tx, 41, tw, 3, LEATHER);
    P(tx, 41, tw, 1, shade(LEATHER, 0.2));
    P(tx, 43, tw, 1, shade(LEATHER, -0.3));
    P(22, 41, 4, 3, trim);
    P(22, 41, 4, 1, trimHi);
  }

  // 胸前配件
  if (acc === 'anchor') {
    P(23, 28, 2, 1, METAL);
    P(22, 29, 4, 2, METAL);
    P(23, 31, 2, 3, METAL_DARK);
    P(21, 33, 6, 1, METAL_DARK);
  }
  if (acc === 'censer') {
    P(tx + tw - 4, 30, 4, 1, METAL_DARK);
    P(tx + tw - 3, 31, 2, 3, trim);
    P(tx + tw - 3, 34, 2, 1, METAL_DARK);
  }

  // ============================================================
  // 5. 双臂(随重心摆动)
  // ============================================================
  // 左臂(粗细随四肢,外缘随体格外扩)
  PaL(armLx, 24, armW, 16, cloth);
  PaL(armLx, 24, 1, 16, clothHi);
  PaL(armLx + armW - 1, 24, 1, 16, clothLo);
  PaL(armLx, 24, armW, 1, clothHi);
  // 左手
  PaL(armLx, 40, armW, 3, SKIN);
  PaL(armLx, 42, armW, 1, skinLo);
  PaL(armLx + 1, 40, 1, 2, skinHi);
  // 右臂
  PaR(armRx, 24, armW, 16, cloth);
  PaR(armRx, 24, 1, 16, clothMid);
  PaR(armRx + armW - 1, 24, 1, 16, clothLo);
  PaR(armRx, 24, armW, 1, clothHi);
  // 右手
  PaR(armRx, 40, armW, 3, SKIN);
  PaR(armRx, 42, armW, 1, skinLo);
  PaR(armRx + 1, 40, 1, 2, skinHi);

  // ============================================================
  // 6. 颈部
  // ============================================================
  P(21, 20, 6, 4, SKIN);
  P(21, 20, 1, 4, skinMid);
  P(26, 20, 1, 4, skinLo);
  P(21, 23, 6, 1, skinLo);
  // 锁骨阴影
  P(20, 24, 2, 1, 'rgba(0,0,0,0.1)');
  P(26, 24, 2, 1, 'rgba(0,0,0,0.1)');

  // ============================================================
  // 7. 头部(脸 + 五官) — 精细像素结构
  // ============================================================
  // 脸部主体(圆润)
  P(17, 5, 14, 15, SKIN);
  // 头顶圆弧
  P(18, 4, 12, 1, SKIN);
  P(19, 3, 10, 1, SKIN);
  P(20, 2, 8, 1, SKIN);
  // 下颌圆弧
  P(18, 20, 12, 1, SKIN);
  P(19, 21, 10, 1, SKIN);
  P(21, 22, 6, 1, SKIN);
  // 左颊受光
  P(17, 6, 1, 12, skinHi);
  P(18, 5, 1, 14, skinHi);
  // 右颊入影
  P(30, 6, 1, 12, skinLo);
  P(29, 5, 1, 14, skinMid);
  // 额头高光
  P(20, 5, 5, 2, skinHi);
  // 下颌阴影
  P(20, 19, 8, 1, SKIN_SHADE);
  P(19, 20, 10, 1, shade(SKIN, -0.08));

  // 耳朵
  P(16, 10, 1, 4, SKIN);
  P(16, 11, 1, 2, SKIN_SHADE);
  P(31, 10, 1, 4, SKIN);
  P(31, 11, 1, 2, skinLo);

  // 眉毛
  P(19, 8, 4, 1, HAIR);
  P(20, 8, 3, 1, HAIR_SHADE);
  P(25, 8, 4, 1, HAIR);
  P(26, 8, 3, 1, HAIR_SHADE);

  // 眼睛(眨眼 / 扫视 · 眼型随形象变化)
  const drawEye = (x, y) => {
    if (blinking) { P(x, y + 1, 4, 1, EYE); P(x + 1, y, 1, 1, skinMid); return; }
    const px = x + eyeShift;
    if (eyeStyle === 'droopy') {            // 呆萌 / 文静:半垂眼
      P(x, y + 1, 4, 2, EYE_WHITE);
      P(x, y + 1, 4, 1, skinMid);
      P(px + 1, y + 2, 2, 1, '#5a3a28');
    } else if (eyeStyle === 'sharp') {      // 英气:细长上挑
      P(x, y + 1, 4, 2, EYE_WHITE);
      P(x, y + 1, 4, 1, skinLo);
      P(px + 1, y + 1, 2, 2, '#3a2a20');
    } else if (eyeStyle === 'sly') {        // 顽皮:斜眼
      P(x, y + 1, 4, 2, EYE_WHITE);
      P(x, y + 1, 4, 1, skinMid);
      P(px + 2, y + 1, 2, 2, '#3a2a20');
    } else if (eyeStyle === 'bright') {     // 元气 / 温柔:圆亮
      P(x, y, 4, 3, EYE_WHITE);
      P(px + 1, y + 1, 2, 2, '#5a3a28');
      P(px, y, 1, 1, '#fff');
      P(x, y + 3, 4, 1, skinMid);
    } else {                                // 可爱:圆眼大瞳
      P(x, y, 4, 3, EYE_WHITE);
      P(px + 1, y + 1, 2, 2, '#5a3a28');
      P(px + 1, y + 1, 1, 1, EYE);
      P(px, y, 1, 1, '#fff');
      P(x, y + 3, 4, 1, skinMid);
    }
  };
  drawEye(19, 10);
  drawEye(25, 10);

  // 鼻子
  P(23, 13, 1, 2, skinMid);
  P(24, 14, 1, 1, skinMid);
  P(22, 14, 1, 1, skinHi);

  // 嘴
  P(22, 16, 1, 1, shade(MOUTH, -0.15));
  P(23, 16, 2, 1, MOUTH);
  P(25, 16, 1, 1, shade(MOUTH, 0.15));
  P(23, 15, 2, 1, shade(MOUTH, 0.2));

  // 腮红(部分形象无)
  if (BLUSH) {
    P(18, 14, 2, 1, BLUSH);
    P(28, 14, 2, 1, BLUSH);
  }

  // ============================================================
  // 8. 头发(精细像素层次)
  // ============================================================
  // 后发底层
  P(16, 2, 16, 3, HAIR_SHADE);
  P(15, 4, 18, 2, HAIR_SHADE);
  // 主发层
  Ph(17, 2, 14, 3, HAIR);
  P(18, 1, 12, 1, HAIR);
  Ph(16, 4, 16, 2, HAIR);
  // 顶部高光
  P(19, 2, 5, 1, HAIR_HI);
  P(20, 3, 4, 1, HAIR_HI);
  // 左鬓
  P(16, 5, 1, 8, HAIR);
  P(16, 5, 1, 4, HAIR_HI);
  // 右鬓(入影)
  P(31, 5, 1, 8, HAIR_SHADE);
  // 额前碎发(中间留缝)
  Ph(17, 5, 5, 1, HAIR);
  Ph(18, 6, 4, 1, HAIR);
  Ph(26, 5, 5, 1, HAIR);
  Ph(26, 6, 4, 1, HAIR);
  Ph(22, 5, 4, 1, HAIR_HI);
  // 发梢细节
  P(17, 12, 1, 2, HAIR);
  P(30, 12, 1, 2, HAIR_SHADE);

  // ---- 发型差异 ----
  if (hairStyle === 'spiky') {           // 元气 / 顽皮:炸毛
    Ph(17, 0, 2, 2, HAIR); Ph(20, -1, 2, 2, HAIR); Ph(24, -1, 2, 2, HAIR); Ph(27, 0, 2, 2, HAIR);
    P(20, 0, 1, 1, HAIR_HI);
  } else if (hairStyle === 'side') {     // 文静 / 英气:偏分
    Ph(17, 5, 8, 2, HAIR);
    P(26, 5, 1, 1, skinHi);
    P(30, 5, 1, 4, HAIR_SHADE);
  }
  // ---- 形象头饰 ----
  if (a.bodyAcc === 'band') { P(16, 4, 16, 1, '#c0392b'); P(16, 4, 16, 1, shade('#c0392b', 0.15)); }
  else if (a.bodyAcc === 'leaf') { P(29, 2, 3, 2, '#4f7a3a'); P(30, 1, 1, 1, '#7fb05e'); }

  // ---- 帽子 ----
  drawHatPixel(P, a);

  // ============================================================
  // 8.5 防具(与服饰各画各的:里衣外甲,同一部位可同时可见)
  //     头盔 / 胸甲 / 护手 / 护腿 / 战靴 / 戒指 / 耳饰
  // ============================================================
  const AR = a.armor;
  if (AR) {
    const hi = (c) => shade(c, 0.3);
    const lo = (c) => shade(c, -0.34);
    const mid = (c) => shade(c, -0.12);

    // 头部防具:压在头发之上的盔沿 + 护鼻
    const hc = AR.head;
    if (hc) {
      P(15, 3, 18, 3, hc);
      P(15, 3, 18, 1, hi(hc));
      P(14, 6, 20, 1, lo(hc));
      P(16, 4, 4, 2, hi(hc));
      P(23, 6, 2, 4, hc);          // 护鼻
      P(23, 6, 1, 4, hi(hc));
      P(28, 4, 1, 1, '#ffffff');
    }

    // 上身防具:胸甲覆在服饰之上,并带两片肩甲
    const bc = AR.body;
    if (bc) {
      P(tx - 1, 23, tw + 2, 3, bc);
      P(tx - 1, 23, tw + 2, 1, hi(bc));
      P(tx, 26, tw, 15, bc);
      P(tx, 26, 2, 15, hi(bc));
      P(tx + tw - 2, 26, 2, 15, lo(bc));
      P(tx + 2, 28, tw - 4, 1, mid(bc));
      P(tx + 2, 34, tw - 4, 1, mid(bc));
      P(23, 27, 2, 13, hi(bc));    // 中脊
      P(22, 30, 4, 2, lo(bc));     // 甲扣
    }

    // 手部防具:护手
    const gc = AR.hands;
    if (gc) {
      PaL(armLx, 39, armW, 4, gc); PaL(armLx, 39, armW, 1, hi(gc));
      PaR(armRx, 39, armW, 4, gc); PaR(armRx, 39, armW, 1, hi(gc));
    }

    // 腿部防具:护腿
    const lc = AR.legs;
    if (lc) {
      const gLen = Math.max(2, legLen - 4);
      P(legLx, 47, legW, gLen, lc);
      P(legLx, 47, 1, gLen, hi(lc));
      P(legRx, 47, legW, gLen, lc);
      P(legRx + legW - 1, 47, 1, gLen, lo(lc));
    }

    // 脚步防具:战靴(盖住布靴)
    const fc = AR.feet;
    if (fc) {
      Pc(17, 55, 8, 7, fc); Pc(17, 55, 8, 1, hi(fc)); Pc(17, 61, 8, 1, lo(fc));
      Pc(23, 55, 8, 7, fc); Pc(23, 55, 8, 1, hi(fc)); Pc(23, 61, 8, 1, lo(fc));
    }

    // 戒指 / 耳饰(小而亮)
    if (AR.ring) { P(armLx, 41, 1, 1, AR.ring); P(armLx + armW - 1, 41, 1, 1, hi(AR.ring)); }
    if (AR.earring) { P(16, 12, 1, 1, AR.earring); P(15, 13, 1, 1, hi(AR.earring)); }
  }

  // ============================================================
  // 9. 伤势叠层
  // ============================================================
  if (hpRatio < 0.5) {
    PaL(armLx, 28, armW, 3, BANDAGE);
    PaL(armLx, 29, armW, 1, 'rgba(0,0,0,0.1)');
    P(29, 9, 1, 1, BLOOD);
  }
  if (hpRatio < 0.25) {
    P(19, 30, 2, 2, BLOOD);
    P(27, 32, 2, 1, BLOOD);
    P(18, 38, 1, 3, BLOOD);
  }
}

/** 像素风格帽子绘制 */
function drawHatPixel(P, a) {
  const style = a && a.hatStyle;
  if (!style || style === 'none' || a.hideHat) return;
  const c = a.hat || '#5a3f2a';
  const hi = a.hatHi || shade(c, 0.25);
  const lo = shade(c, -0.3);
  switch (style) {
    case 'straw':
      P(13, 1, 22, 1, c);
      P(14, 0, 20, 1, c);
      P(18, -1, 12, 1, c);
      P(19, -2, 10, 2, hi);
      P(18, 0, 12, 1, shade(c, 0.1));
      break;
    case 'cap':
      P(16, 1, 16, 1, lo);
      P(17, 0, 14, 1, c);
      P(18, -1, 12, 1, hi);
      P(14, 1, 4, 1, lo);
      break;
    case 'feather':
      P(16, 1, 16, 1, lo);
      P(17, 0, 14, 1, c);
      P(18, -1, 12, 1, hi);
      P(14, 1, 4, 1, lo);
      P(28, -2, 2, 3, hi);
      P(29, -3, 1, 2, shade(hi, 0.1));
      break;
    case 'hood':
      P(14, 1, 20, 2, c);
      P(13, 3, 22, 1, c);
      P(12, 4, 24, 1, lo);
      P(15, 0, 18, 1, hi);
      break;
    case 'helm':
      P(15, 1, 18, 1, METAL_DARK);
      P(16, 0, 16, 1, METAL);
      P(17, -1, 14, 1, shade(METAL, 0.15));
      P(18, -2, 12, 1, shade(METAL, 0.25));
      P(20, -2, 2, 1, '#fff');
      break;
    case 'crown':
      P(16, 1, 16, 1, lo);
      P(17, 0, 14, 1, c);
      P(18, -1, 2, 1, hi);
      P(22, -1, 2, 1, hi);
      P(26, -1, 2, 1, hi);
      P(19, -2, 1, 1, hi);
      P(23, -2, 1, 1, hi);
      P(27, -2, 1, 1, hi);
      break;
    default:
      P(16, 1, 16, 1, lo);
      P(17, 0, 14, 1, c);
      P(18, -1, 12, 1, hi);
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
    [/^sq1_/, { theme: 'ruins',  name: '圣殿废墟' }],
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
  ch02b: [
    [/^n0[1-5]/, { theme: 'ruins',    name: '废弃矿镇' }],
    [/^n0[6-8]/, { theme: 'mountain', name: '废矿井口' }],
    [/^n09|^n1[0-5]/, { theme: 'ruins', name: '地下矿道' }],
    [/^sq1_/, { theme: 'ruins', name: '老采空区' }],
    [/^sq2_/, { theme: 'ruins', name: '矿镇药铺 · 地窖' }],
  ],
  ch03: [[/^./, { theme: 'city',     name: '王城 · 书记官宅邸' }]],
  ch04: [[/^./, { theme: 'port',     name: '南方渔港' }]],
  ch05: [[/^./, { theme: 'mountain', name: '圣心坛 · 雪岭' }]],
  ch06: [[/^./, { theme: 'village',  name: '山间村舍' }]],
  ch07: [[/^./, { theme: 'forest',   name: '幽深森林' }]],
  ch08: [[/^./, { theme: 'mountain', name: '剑塔 · 雪原' }]],
  ch09: [[/^./, { theme: 'sky',      name: '云端浮岛' }]],
  ch10: [[/^./, { theme: 'port',     name: '远洋学院' }]],
  ch11: [[/^./, { theme: 'city',     name: '大神殿' }]],
  ch12: [[/^./, { theme: 'forest',   name: '山道密林' }]],
  ch13: [[/^./, { theme: 'ruins',    name: '被洗劫的村庄' }]],
  ch14: [[/^./, { theme: 'mountain', name: '圣心坛 · 火柱' }]],
  ch15: [[/^./, { theme: 'city',     name: '王城广场' }]],
};
const CHAPTER_DEFAULT = {
  ch01: { theme: 'meadow', name: '家园 · 边境村落' },
  ch02: { theme: 'road',   name: '王国北道' },
  ch02b: { theme: 'ruins', name: '废弃矿镇' },
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
    this.els = els;
    this._charCtx = els.charCanvas ? els.charCanvas.getContext('2d') : null;
    this._envCtx = els.envCanvas ? els.envCanvas.getContext('2d') : null;
    this._mapCtx = els.mapCanvas ? els.mapCanvas.getContext('2d') : null;
    // 人物像素风:关闭抗锯齿保持锐利
    if (this._charCtx) this._charCtx.imageSmoothingEnabled = false;
    if (this._envCtx) this._envCtx.imageSmoothingEnabled = false;
    if (this._mapCtx) this._mapCtx.imageSmoothingEnabled = false;
    this._animParams = null;
    this._mapAnimParams = null;
    this._animId = null;
    this._animating = false;
  }

  /** 启动动画循环(若已运行则不重复启动) */
  _startAnim() {
    if (this._animating) return;
    this._animating = true;
    const loop = (t) => {
      if (!this._animating) return;
      if (this._animParams) {
        const p = this._animParams;
        drawCharacter(this._charCtx, 3, p.career && p.career.id, p.hpRatio, p.flagSet, p.appearance, t);
      }
      if (this._mapAnimParams) {
        const p = this._mapAnimParams;
        drawCharacter(this._mapCtx, 2, p.career && p.career.id, p.hpRatio, p.flagSet, p.appearance, t);
      }
      this._animId = requestAnimationFrame(loop);
    };
    this._animId = requestAnimationFrame(loop);
  }

  /** 停止动画循环 */
  stopAnim() {
    this._animating = false;
    if (this._animId) cancelAnimationFrame(this._animId);
    this._animId = null;
  }

  /** 地区地图左下角的人物形象(像素风) */
  renderMapPortrait({ career, player, flags, appearance }) {
    if (!this._mapCtx) return;
    const flagSet = new Set(flags || []);
    const hpRatio = player && player.maxHp ? Math.max(0, Math.min(1, player.hp / player.maxHp)) : 1;
    this._mapAnimParams = { career, hpRatio, flagSet, appearance };
    // 地图画布 96x128,逻辑 48x64,缩放 = 2
    drawCharacter(this._mapCtx, 2, career && career.id, hpRatio, flagSet, appearance, performance.now());
    if (this.els.mapCharName) this.els.mapCharName.textContent = career ? career.name : '无名少年';
    this._startAnim();
  }

  render({ chapterId, nodeId, career, player, flags, appearance }) {
    if (!this._charCtx || !this._envCtx) return;
    const flagSet = new Set(flags || []);
    const hpRatio = player && player.maxHp ? Math.max(0, Math.min(1, player.hp / player.maxHp)) : 1;

    // ---- 人物 ----
    this._animParams = { career, hpRatio, flagSet, appearance };
    // 主画布 144x192,逻辑 48x64,缩放 = 3
    drawCharacter(this._charCtx, 3, career && career.id, hpRatio, flagSet, appearance, performance.now());
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

    this._startAnim();
  }
}

/**
 * 供外部(角色弹窗)使用:把某个形象画到任意 canvas 上。
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} scale 缩放倍率(逻辑画布 48×64)
 * @param {string} careerId 职业(决定服饰主色)
 * @param {object} appearance economy.appearance() 的返回值
 * @param {number} [time] 动画时刻(默认静止)
 */
export function paintCharacter(ctx, scale, careerId, appearance, time = 0) {
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  drawCharacter(ctx, scale, careerId, 1, new Set(), appearance || {}, time);
}
