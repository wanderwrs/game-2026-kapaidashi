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
   人物立绘(144 × 192 逻辑像素)
   写实油画风格:渐变体积 + 抗锯齿曲线 + 统一左上光源
   站立正面像 —— 少年:自然比例、立体五官、布料褶皱
   支持呼吸 / 眨眼 / 微晃 / 发丝飘动等待机动画
   ============================================================ */
const CHAR_W = 144;
const CHAR_H = 192;

/** 动画周期(毫秒) */
const BREATH_PERIOD = 3200;
const BLINK_PERIOD = 4200;
const BLINK_DURATION = 140;
const SHEEN_PERIOD = 2600;
const SWAY_PERIOD = 5200;
const GLANCE_PERIOD = 6500;
const GLANCE_HOLD = 900;
const FLUTTER_PERIOD = 3800;

/** 绘制椭圆(圆心 cx,cy; 半径 rx,ry) */
function ellipse(ctx, cx, cy, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}

/** 绘制圆形 */
function circle(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}

/** 线性渐变填充路径 */
function fillPath(ctx, pathFn, gradient) {
  ctx.beginPath();
  pathFn(ctx);
  ctx.fillStyle = gradient;
  ctx.fill();
}

function drawCharacter(ctx, scale, careerId, hpRatio, flags, look, time = 0) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, CHAR_W, CHAR_H);

  // ---- 动画参数 ----
  const breath = Math.sin((time % BREATH_PERIOD) / BREATH_PERIOD * Math.PI * 2);
  const breathY = breath * 1.2;
  const sway = Math.sin((time % SWAY_PERIOD) / SWAY_PERIOD * Math.PI * 2);
  const swayX = sway * 1.0;
  const armSwing = -sway * 1.6;
  const leftArmX = armSwing * 0.5;
  const rightArmX = -leftArmX;
  const blinkPhase = (time % BLINK_PERIOD) / BLINK_PERIOD;
  const blinking = blinkPhase > (1 - BLINK_DURATION / BLINK_PERIOD);
  const glancePhase = (time % GLANCE_PERIOD) / GLANCE_PERIOD;
  const glanceWindow = GLANCE_HOLD / GLANCE_PERIOD;
  let eyeShift = 0;
  if (glancePhase > 0.5 && glancePhase < 0.5 + glanceWindow) eyeShift = 2;
  else if (glancePhase > 0.75 && glancePhase < 0.75 + glanceWindow) eyeShift = -2;
  const sheen = (Math.sin((time % SHEEN_PERIOD) / SHEEN_PERIOD * Math.PI * 2) + 1) / 2;
  const flutter = Math.sin((time % FLUTTER_PERIOD) / FLUTTER_PERIOD * Math.PI * 2);
  const hairFlutter = flutter * 1.0;
  const clothFlutter = flutter * 1.2;

  const base = OUTFITS[careerId] || OUTFIT_DEFAULT;
  const a = look || {};
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

  const clothHi = shade(cloth, 0.2), clothLo = shade(cloth, -0.35), clothMid = shade(cloth, -0.12);
  const cloth2Hi = shade(cloth2, 0.2), cloth2Lo = shade(cloth2, -0.3);
  const trimHi = shade(trim, 0.25), trimLo = shade(trim, -0.3);
  const pantsHi = shade(pantsCol, 0.18), pantsLo = shade(pantsCol, -0.32);
  const bootHi = shade(bootCol, 0.2), bootLo = shade(bootCol, -0.4);
  const skinHi = shade(SKIN, 0.15), skinLo = shade(SKIN, -0.28), skinMid = shade(SKIN, -0.12);

  // 整体偏移原点
  const ox = swayX;
  const oy = breathY;

  // 坐标基准(优化比例:头部占全身约1/4)
  const headCX = 72 + ox;
  const headCY = 46 + oy;
  const headR = 26;
  const neckY = 72 + oy;
  const shoulderY = 86 + oy;
  const waistY = 138 + oy;
  const hipY = 150 + oy;

  ctx.save();

  // ============================================================
  // 1. 地面投影(软阴影)
  // ============================================================
  const shadowGrad = ctx.createRadialGradient(72 + ox, 188, 2, 72 + ox, 188, 40);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(72 + ox, 188, 38, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // ============================================================
  // 2. 身后配件(剑/杖/枪/翼)
  // ============================================================
  if (acc === 'sword') {
    // 剑身(背后,被身体遮挡下半部分)
    const bladeGrad = ctx.createLinearGradient(118, 20, 130, 20);
    bladeGrad.addColorStop(0, '#79818c');
    bladeGrad.addColorStop(0.5, '#d8dde4');
    bladeGrad.addColorStop(1, '#aeb6be');
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(122, 18 + oy);
    ctx.lineTo(128, 18 + oy);
    ctx.lineTo(126, 120 + oy);
    ctx.lineTo(124, 120 + oy);
    ctx.closePath();
    ctx.fill();
    // 剑身光泽
    ctx.fillStyle = `rgba(255,255,255,${0.3 + sheen * 0.5})`;
    ctx.fillRect(124, 20 + oy + sheen * 80, 1, 15);
    // 护手
    ctx.fillStyle = LEATHER;
    ctx.fillRect(116, 118 + oy, 18, 4);
    ctx.fillStyle = shade(LEATHER, 0.2);
    ctx.fillRect(116, 118 + oy, 18, 1);
    // 握柄
    ctx.fillStyle = LEATHER;
    ctx.fillRect(122, 122 + oy, 6, 16);
    ctx.fillStyle = shade(LEATHER, 0.15);
    ctx.fillRect(122, 122 + oy, 2, 16);
    // 剑首
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.arc(125, 140 + oy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (acc === 'staff') {
    ctx.strokeStyle = '#6b4a30';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(22 + ox, 50 + oy);
    ctx.lineTo(20 + ox, 155 + oy);
    ctx.stroke();
    ctx.strokeStyle = '#835c3c';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 法杖顶端宝石
    const gemGrad = ctx.createRadialGradient(22 + ox, 42 + oy, 1, 22 + ox, 42 + oy, 10);
    gemGrad.addColorStop(0, `rgba(255,240,184,${0.6 + sheen * 0.4})`);
    gemGrad.addColorStop(0.5, trim);
    gemGrad.addColorStop(1, trimLo);
    ctx.fillStyle = gemGrad;
    ctx.beginPath();
    ctx.arc(22 + ox, 42 + oy, 9, 0, Math.PI * 2);
    ctx.fill();
    circle(ctx, 22 + ox, 42 + oy, 3, `rgba(255,255,255,${0.5 + sheen * 0.5})`);
  }
  if (acc === 'spear') {
    ctx.strokeStyle = '#5a3f2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(120 + ox, 12 + oy);
    ctx.lineTo(124 + ox, 165 + oy);
    ctx.stroke();
    // 枪尖
    ctx.fillStyle = METAL;
    ctx.beginPath();
    ctx.moveTo(122 + ox, 0 + oy);
    ctx.lineTo(128 + ox, 16 + oy);
    ctx.lineTo(116 + ox, 16 + oy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e6ebf0';
    ctx.beginPath();
    ctx.moveTo(120 + ox, 2 + oy);
    ctx.lineTo(123 + ox, 14 + oy);
    ctx.lineTo(119 + ox, 14 + oy);
    ctx.closePath();
    ctx.fill();
  }
  if (acc === 'wings') {
    const wingGrad = ctx.createLinearGradient(0, 70, 50, 70);
    wingGrad.addColorStop(0, '#6f96a8');
    wingGrad.addColorStop(0.5, '#8fb6c9');
    wingGrad.addColorStop(1, '#b9d7e6');
    // 左翼
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(30 + ox, 90 + oy);
    ctx.bezierCurveTo(5 + ox, 70 + oy, 0 + ox, 110 + oy, 15 + ox, 140 + oy);
    ctx.bezierCurveTo(25 + ox, 125 + oy, 30 + ox, 110 + oy, 30 + ox, 90 + oy);
    ctx.fill();
    // 右翼
    const wingGrad2 = ctx.createLinearGradient(144, 70, 94, 70);
    wingGrad2.addColorStop(0, '#6f96a8');
    wingGrad2.addColorStop(0.5, '#8fb6c9');
    wingGrad2.addColorStop(1, '#b9d7e6');
    ctx.fillStyle = wingGrad2;
    ctx.beginPath();
    ctx.moveTo(114 + ox, 90 + oy);
    ctx.bezierCurveTo(139 + ox, 70 + oy, 144 + ox, 110 + oy, 129 + ox, 140 + oy);
    ctx.bezierCurveTo(119 + ox, 125 + oy, 114 + ox, 110 + oy, 114 + ox, 90 + oy);
    ctx.fill();
  }

  // ============================================================
  // 3. 腿部(先画,被躯干遮挡)
  // ============================================================
  const legGrad = ctx.createLinearGradient(56, waistY, 56, hipY + 20);
  legGrad.addColorStop(0, pantsCol);
  legGrad.addColorStop(0.5, pantsHi);
  legGrad.addColorStop(1, pantsLo);

  // 左腿
  ctx.fillStyle = legGrad;
  ctx.beginPath();
  ctx.moveTo(58 + ox, waistY);
  ctx.lineTo(70 + ox, waistY);
  ctx.lineTo(68 + ox + clothFlutter * 0.3, hipY + 18);
  ctx.lineTo(58 + ox + clothFlutter * 0.3, hipY + 18);
  ctx.closePath();
  ctx.fill();
  // 左腿褶皱阴影
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(62 + ox, waistY + 8, 2, 30);

  // 右腿
  const legGrad2 = ctx.createLinearGradient(88, waistY, 88, hipY + 20);
  legGrad2.addColorStop(0, pantsLo);
  legGrad2.addColorStop(0.5, pantsCol);
  legGrad2.addColorStop(1, pantsLo);
  ctx.fillStyle = legGrad2;
  ctx.beginPath();
  ctx.moveTo(74 + ox, waistY);
  ctx.lineTo(86 + ox, waistY);
  ctx.lineTo(86 + ox + clothFlutter * 0.3, hipY + 18);
  ctx.lineTo(76 + ox + clothFlutter * 0.3, hipY + 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(80 + ox, waistY + 8, 2, 30);

  // 靴子
  const bootGrad = ctx.createLinearGradient(56, hipY + 10, 56, hipY + 32);
  bootGrad.addColorStop(0, bootCol);
  bootGrad.addColorStop(0.5, bootHi);
  bootGrad.addColorStop(1, bootLo);
  // 左靴
  ctx.fillStyle = bootGrad;
  ctx.beginPath();
  ctx.ellipse(63 + ox + clothFlutter * 0.3, hipY + 24, 11, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bootHi;
  ctx.beginPath();
  ctx.ellipse(60 + ox + clothFlutter * 0.3, hipY + 20, 6, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // 右靴
  ctx.fillStyle = bootGrad;
  ctx.beginPath();
  ctx.ellipse(81 + ox + clothFlutter * 0.3, hipY + 24, 11, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bootHi;
  ctx.beginPath();
  ctx.ellipse(78 + ox + clothFlutter * 0.3, hipY + 20, 6, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // ============================================================
  // 4. 躯干(肩 → 腰)
  // ============================================================
  const torsoGrad = ctx.createLinearGradient(50, shoulderY, 94, waistY);
  torsoGrad.addColorStop(0, clothHi);
  torsoGrad.addColorStop(0.4, cloth);
  torsoGrad.addColorStop(1, clothLo);

  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.moveTo(48 + ox, shoulderY);
  ctx.bezierCurveTo(44 + ox, shoulderY + 10, 46 + ox, waistY - 5, 52 + ox, waistY);
  ctx.lineTo(92 + ox, waistY);
  ctx.bezierCurveTo(98 + ox, waistY - 5, 100 + ox, shoulderY + 10, 96 + ox, shoulderY);
  ctx.bezierCurveTo(90 + ox, shoulderY - 6, 54 + ox, shoulderY - 6, 48 + ox, shoulderY);
  ctx.closePath();
  ctx.fill();

  // 躯干右侧入影
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.moveTo(96 + ox, shoulderY);
  ctx.bezierCurveTo(100 + ox, shoulderY + 10, 98 + ox, waistY - 5, 92 + ox, waistY);
  ctx.lineTo(84 + ox, waistY);
  ctx.bezierCurveTo(90 + ox, waistY - 5, 92 + ox, shoulderY + 10, 88 + ox, shoulderY);
  ctx.closePath();
  ctx.fill();

  // 内襟
  const innerGrad = ctx.createLinearGradient(66, shoulderY, 78, waistY);
  innerGrad.addColorStop(0, cloth2Hi);
  innerGrad.addColorStop(1, cloth2Lo);
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.moveTo(66 + ox, shoulderY + 2);
  ctx.lineTo(78 + ox, shoulderY + 2);
  ctx.lineTo(80 + ox, waistY - 2);
  ctx.lineTo(64 + ox, waistY - 2);
  ctx.closePath();
  ctx.fill();
  // 内襟中线褶皱
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(72 + ox, shoulderY + 4);
  ctx.lineTo(72 + ox, waistY - 4);
  ctx.stroke();

  // V 领滚边
  ctx.strokeStyle = trim;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(64 + ox, shoulderY + 2);
  ctx.lineTo(72 + ox, shoulderY + 12);
  ctx.lineTo(80 + ox, shoulderY + 2);
  ctx.stroke();
  ctx.strokeStyle = trimHi;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(65 + ox, shoulderY + 2);
  ctx.lineTo(72 + ox, shoulderY + 11);
  ctx.lineTo(79 + ox, shoulderY + 2);
  ctx.stroke();

  // 腰带
  if (!bareTop) {
    ctx.fillStyle = LEATHER;
    ctx.fillRect(52 + ox, waistY - 3, 40, 6);
    ctx.fillStyle = shade(LEATHER, 0.2);
    ctx.fillRect(52 + ox, waistY - 3, 40, 1.5);
    ctx.fillStyle = shade(LEATHER, -0.3);
    ctx.fillRect(52 + ox, waistY + 1, 40, 2);
    // 带扣
    ctx.fillStyle = trim;
    ctx.fillRect(68 + ox, waistY - 2, 8, 4);
    ctx.fillStyle = trimHi;
    ctx.fillRect(68 + ox, waistY - 2, 8, 1);
  }

  // 胸前配件
  if (acc === 'anchor') {
    ctx.fillStyle = METAL;
    ctx.beginPath();
    ctx.arc(72 + ox, 120 + oy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = METAL_DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72 + ox, 125 + oy);
    ctx.lineTo(72 + ox, 135 + oy);
    ctx.moveTo(67 + ox, 132 + oy);
    ctx.lineTo(77 + ox, 132 + oy);
    ctx.stroke();
  }
  if (acc === 'censer') {
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.ellipse(88 + ox, 125 + oy, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = METAL_DARK;
    ctx.fillRect(85 + ox, 128 + oy, 6, 8);
  }

  // ============================================================
  // 5. 双臂(随重心摆动)
  // ============================================================
  // 左臂
  const armGradL = ctx.createLinearGradient(42 + leftArmX, shoulderY, 42 + leftArmX, 140);
  armGradL.addColorStop(0, clothHi);
  armGradL.addColorStop(0.5, cloth);
  armGradL.addColorStop(1, clothLo);
  ctx.fillStyle = armGradL;
  ctx.beginPath();
  ctx.ellipse(46 + ox + leftArmX, 115 + oy, 10, 26, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // 左手
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.ellipse(44 + ox + leftArmX, 140 + oy, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skinLo;
  ctx.beginPath();
  ctx.ellipse(46 + ox + leftArmX, 143 + oy, 5, 4, 0, 0, Math.PI);
  ctx.fill();

  // 右臂
  const armGradR = ctx.createLinearGradient(102 + rightArmX, shoulderY, 102 + rightArmX, 140);
  armGradR.addColorStop(0, cloth);
  armGradR.addColorStop(0.5, clothMid);
  armGradR.addColorStop(1, clothLo);
  ctx.fillStyle = armGradR;
  ctx.beginPath();
  ctx.ellipse(98 + ox + rightArmX, 115 + oy, 10, 26, 0.15, 0, Math.PI * 2);
  ctx.fill();
  // 右手
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.ellipse(100 + ox + rightArmX, 140 + oy, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skinLo;
  ctx.beginPath();
  ctx.ellipse(98 + ox + rightArmX, 143 + oy, 5, 4, 0, 0, Math.PI);
  ctx.fill();

  // ============================================================
  // 6. 颈部(延伸至躯干内,消除间隙)
  // ============================================================
  const neckGrad = ctx.createLinearGradient(66, neckY - 6, 78, neckY + 10);
  neckGrad.addColorStop(0, skinMid);
  neckGrad.addColorStop(0.5, SKIN);
  neckGrad.addColorStop(1, skinLo);
  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.moveTo(66 + ox, neckY - 4);
  ctx.lineTo(78 + ox, neckY - 4);
  ctx.lineTo(82 + ox, shoulderY + 4);
  ctx.lineTo(62 + ox, shoulderY + 4);
  ctx.closePath();
  ctx.fill();
  // 颈侧阴影(右侧入影)
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.moveTo(76 + ox, neckY - 2);
  ctx.lineTo(82 + ox, shoulderY + 4);
  ctx.lineTo(78 + ox, shoulderY + 4);
  ctx.lineTo(75 + ox, neckY - 2);
  ctx.closePath();
  ctx.fill();
  // 锁骨阴影
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(66 + ox, shoulderY);
  ctx.quadraticCurveTo(72 + ox, shoulderY + 3, 78 + ox, shoulderY);
  ctx.stroke();

  // ============================================================
  // 7. 头部(脸 + 五官)
  // ============================================================
  // 脸部渐变(左上受光,右下入影)
  const faceGrad = ctx.createRadialGradient(headCX - 8, headCY - 10, 5, headCX, headCY, headR);
  faceGrad.addColorStop(0, skinHi);
  faceGrad.addColorStop(0.5, SKIN);
  faceGrad.addColorStop(0.85, skinMid);
  faceGrad.addColorStop(1, skinLo);
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.ellipse(headCX, headCY, headR * 0.88, headR, 0, 0, Math.PI * 2);
  ctx.fill();

  // 右颊入影
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(headCX + 10, headCY + 2, 10, 16, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // 耳朵
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.ellipse(headCX - headR * 0.82, headCY, 4, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skinLo;
  ctx.beginPath();
  ctx.ellipse(headCX + headR * 0.82, headCY, 4, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- 眉毛 ----
  ctx.strokeStyle = HAIR;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(headCX - 16, headCY - 10);
  ctx.quadraticCurveTo(headCX - 10, headCY - 13, headCX - 4, headCY - 11);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(headCX + 4, headCY - 11);
  ctx.quadraticCurveTo(headCX + 10, headCY - 13, headCX + 16, headCY - 10);
  ctx.stroke();

  // ---- 眼睛 ----
  if (blinking) {
    // 闭眼:眼线
    ctx.strokeStyle = EYE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(headCX - 14, headCY - 2);
    ctx.quadraticCurveTo(headCX - 10, headCY + 1, headCX - 6, headCY - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(headCX + 6, headCY - 2);
    ctx.quadraticCurveTo(headCX + 10, headCY + 1, headCX + 14, headCY - 2);
    ctx.stroke();
  } else {
    // 左眼
    ctx.fillStyle = EYE_WHITE;
    ctx.beginPath();
    ctx.ellipse(headCX - 10, headCY - 2, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3a28'; // 虹膜(棕色)
    ctx.beginPath();
    ctx.arc(headCX - 10 + eyeShift, headCY - 2, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = EYE; // 瞳孔
    ctx.beginPath();
    ctx.arc(headCX - 10 + eyeShift, headCY - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff'; // 高光
    ctx.beginPath();
    ctx.arc(headCX - 11 + eyeShift, headCY - 3.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
    // 上眼睑阴影
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(headCX - 10, headCY - 6, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 右眼
    ctx.fillStyle = EYE_WHITE;
    ctx.beginPath();
    ctx.ellipse(headCX + 10, headCY - 2, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3a28';
    ctx.beginPath();
    ctx.arc(headCX + 10 + eyeShift, headCY - 2, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = EYE;
    ctx.beginPath();
    ctx.arc(headCX + 10 + eyeShift, headCY - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(headCX + 9 + eyeShift, headCY - 3.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(headCX + 10, headCY - 6, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 鼻子 ----
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(headCX + 2, headCY + 5, 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skinHi;
  ctx.beginPath();
  ctx.ellipse(headCX - 1, headCY + 4, 1.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- 嘴 ----
  const lipGrad = ctx.createLinearGradient(headCX, headCY + 12, headCX, headCY + 17);
  lipGrad.addColorStop(0, shade(MOUTH, 0.2));
  lipGrad.addColorStop(0.5, MOUTH);
  lipGrad.addColorStop(1, shade(MOUTH, -0.2));
  ctx.fillStyle = lipGrad;
  ctx.beginPath();
  ctx.moveTo(headCX - 6, headCY + 12);
  ctx.quadraticCurveTo(headCX, headCY + 10, headCX + 6, headCY + 12);
  ctx.quadraticCurveTo(headCX, headCY + 16, headCX - 6, headCY + 12);
  ctx.fill();
  // 嘴唇高光
  ctx.fillStyle = 'rgba(255,200,180,0.4)';
  ctx.beginPath();
  ctx.ellipse(headCX, headCY + 11, 4, 1, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- 腮红 ----
  ctx.fillStyle = 'rgba(230,161,132,0.35)';
  ctx.beginPath();
  ctx.ellipse(headCX - 14, headCY + 6, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(headCX + 14, headCY + 6, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // ============================================================
  // 8. 头发(多层曲线 + 渐变)
  // ============================================================
  const hairGrad = ctx.createLinearGradient(headCX, headCY - headR, headCX, headCY);
  hairGrad.addColorStop(0, HAIR_HI);
  hairGrad.addColorStop(0.6, HAIR);
  hairGrad.addColorStop(1, HAIR_SHADE);

  // 后发(底层)
  ctx.fillStyle = HAIR_SHADE;
  ctx.beginPath();
  ctx.ellipse(headCX, headCY - 5, headR + 2, headR + 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 主发层
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  ctx.moveTo(headCX - headR, headCY - 8);
  ctx.bezierCurveTo(headCX - headR - 2, headCY - headR - 5, headCX + headR + 2, headCY - headR - 5, headCX + headR, headCY - 8);
  ctx.bezierCurveTo(headCX + headR + 3, headCY + 2, headCX + headR - 2, headCY + 10, headCX + headR - 5, headCY + 8);
  ctx.bezierCurveTo(headCX + headR, headCY - 5, headCX + 10, headCY - headR + 2, headCX, headCY - headR + 2);
  ctx.bezierCurveTo(headCX - 10, headCY - headR + 2, headCX - headR, headCY - 5, headCX - headR + 5, headCY + 8);
  ctx.bezierCurveTo(headCX - headR + 2, headCY + 10, headCX - headR - 3, headCY + 2, headCX - headR, headCY - 8);
  ctx.fill();

  // 发丝高光
  ctx.strokeStyle = HAIR_HI;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    const sx = headCX + i * 6 + hairFlutter;
    ctx.moveTo(sx, headCY - headR + 2);
    ctx.quadraticCurveTo(sx + 2, headCY - headR + 10, sx + 1, headCY - headR + 16);
    ctx.stroke();
  }

  // 额前碎发
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  ctx.moveTo(headCX - 18, headCY - 10);
  ctx.quadraticCurveTo(headCX - 12, headCY - 18 + hairFlutter, headCX - 6, headCY - 12);
  ctx.quadraticCurveTo(headCX, headCY - 16 + hairFlutter, headCX + 6, headCY - 12);
  ctx.quadraticCurveTo(headCX + 12, headCY - 18 + hairFlutter, headCX + 18, headCY - 10);
  ctx.quadraticCurveTo(headCX, headCY - 8, headCX - 18, headCY - 10);
  ctx.fill();

  // ---- 帽子 ----
  drawHatReal(ctx, ox, oy, a);

  // ============================================================
  // 9. 伤势叠层
  // ============================================================
  if (hpRatio < 0.5) {
    // 左臂绷带
    ctx.fillStyle = BANDAGE;
    ctx.fillRect(40 + ox + leftArmX, 105 + oy, 12, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(40 + ox + leftArmX, 108 + oy, 12, 1);
    // 脸颊擦伤
    ctx.fillStyle = BLOOD;
    ctx.beginPath();
    ctx.ellipse(headCX + 12, headCY + 2, 2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (hpRatio < 0.25) {
    ctx.fillStyle = BLOOD;
    ctx.beginPath();
    ctx.ellipse(64 + ox, 110 + oy, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(82 + ox, 120 + oy, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(60 + ox, 135 + oy, 2, 6);
  }

  ctx.restore();
}

/** 写实风格帽子绘制 */
function drawHatReal(ctx, ox, oy, a) {
  const style = a && a.hatStyle;
  if (!style || style === 'none' || a.hideHat) return;
  const c = a.hat || '#5a3f2a';
  const hi = a.hatHi || shade(c, 0.25);
  const lo = shade(c, -0.3);
  const headCX = 72 + ox;
  const headCY = 46 + oy;
  const grad = ctx.createLinearGradient(headCX, headCY - 29, headCX, headCY - 12);
  grad.addColorStop(0, hi);
  grad.addColorStop(1, lo);

  switch (style) {
    case 'straw':
      // 宽檐草帽
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(headCX, headCY - 18, 30, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(headCX, headCY - 26, 15, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'cap':
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(headCX, headCY - 24, 16, 9, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(headCX - 16, headCY - 24, 32, 3);
      break;
    case 'feather':
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(headCX, headCY - 24, 16, 9, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(headCX - 16, headCY - 24, 32, 3);
      // 羽毛
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.moveTo(headCX + 12, headCY - 28);
      ctx.quadraticCurveTo(headCX + 22, headCY - 38, headCX + 18, headCY - 24);
      ctx.closePath();
      ctx.fill();
      break;
    case 'hood':
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(headCX - 22, headCY - 5);
      ctx.bezierCurveTo(headCX - 24, headCY - 35, headCX + 24, headCY - 35, headCX + 22, headCY - 5);
      ctx.lineTo(headCX + 18, headCY + 5);
      ctx.lineTo(headCX - 18, headCY + 5);
      ctx.closePath();
      ctx.fill();
      break;
    case 'helm':
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(headCX, headCY - 18, 18, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(headCX - 18, headCY - 18, 36, 5);
      // 金属反光
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.ellipse(headCX - 5, headCY - 26, 4, 6, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'crown':
      ctx.fillStyle = grad;
      ctx.fillRect(headCX - 16, headCY - 22, 32, 6);
      // 尖齿
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(headCX + i * 7 - 3, headCY - 22);
        ctx.lineTo(headCX + i * 7, headCY - 30);
        ctx.lineTo(headCX + i * 7 + 3, headCY - 22);
        ctx.closePath();
        ctx.fill();
      }
      break;
    default:
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(headCX, headCY - 24, 16, 9, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(headCX - 16, headCY - 24, 32, 3);
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
    this.els = els; // { charCanvas, envCanvas, charName, charOutfit, charStatus, envName, envDesc, mapCanvas, mapCharName }
    this._charCtx = els.charCanvas ? els.charCanvas.getContext('2d') : null;
    this._envCtx = els.envCanvas ? els.envCanvas.getContext('2d') : null;
    this._mapCtx = els.mapCanvas ? els.mapCanvas.getContext('2d') : null;
    // 人物立绘:开启抗锯齿(写实风格)
    if (this._charCtx) this._charCtx.imageSmoothingEnabled = true;
    // 环境:像素风保持锐利
    if (this._envCtx) this._envCtx.imageSmoothingEnabled = false;
    // 地图立绘:开启抗锯齿
    if (this._mapCtx) this._mapCtx.imageSmoothingEnabled = true;
    // 动画状态
    this._animParams = null;       // render() 传入的参数,供动画循环复用
    this._mapAnimParams = null;    // 地图立绘参数
    this._animId = null;           // requestAnimationFrame id
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
        drawCharacter(this._charCtx, 1, p.career && p.career.id, p.hpRatio, p.flagSet, p.appearance, t);
      }
      if (this._mapAnimParams) {
        const p = this._mapAnimParams;
        drawCharacter(this._mapCtx, 96 / 144, p.career && p.career.id, p.hpRatio, p.flagSet, p.appearance, t);
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

  /** 地区地图左下角的人物形象(与剧情界面同一套写实画法) */
  renderMapPortrait({ career, player, flags, appearance }) {
    if (!this._mapCtx) return;
    const flagSet = new Set(flags || []);
    const hpRatio = player && player.maxHp ? Math.max(0, Math.min(1, player.hp / player.maxHp)) : 1;
    this._mapAnimParams = { career, hpRatio, flagSet, appearance };
    // 地图画布 96x128,逻辑 144x192,缩放 = 96/144 ≈ 0.667
    drawCharacter(this._mapCtx, 96 / 144, career && career.id, hpRatio, flagSet, appearance, performance.now());
    if (this.els.mapCharName) this.els.mapCharName.textContent = career ? career.name : '无名少年';
    this._startAnim();
  }

  render({ chapterId, nodeId, career, player, flags, appearance }) {
    if (!this._charCtx || !this._envCtx) return;
    const flagSet = new Set(flags || []);
    const hpRatio = player && player.maxHp ? Math.max(0, Math.min(1, player.hp / player.maxHp)) : 1;

    // ---- 人物 ----
    this._animParams = { career, hpRatio, flagSet, appearance };
    // 主画布 144x192 = 逻辑尺寸,缩放 = 1
    drawCharacter(this._charCtx, 1, career && career.id, hpRatio, flagSet, appearance, performance.now());
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
