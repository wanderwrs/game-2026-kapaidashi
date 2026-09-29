/**
 * jobs.js — 各地区的打工(小游戏)配置。
 *
 * 打工不再是一键换金币,而要玩一局小游戏:
 *   collect 拾取 —— 左右移动接住掉落的目标物,躲开危险物,在限时内收满目标数量
 *   dodge   躲避 —— 左右移动躲开不断坠落的危险物,存活到目标时间
 *   parkour 跑酷 —— 自动向前奔跑,跳过障碍,跑过目标里程
 *
 * 每项打工三档难度(轻松 / 认真 / 拼命):金币越多,目标越难、速度越快、生命越少。
 * 数据按「地点主题」分组,与 regions.js 里 stops[].theme 对应 ——
 * 走到不同主题的地方,打工的活儿与小游戏都不一样。
 */

/** 难度档名(由易到难) */
const TIER_LABELS = ['轻松', '认真', '拼命'];
/** 各档金币倍率 */
const GOLD_MUL = [1, 1.85, 2.9];

/** 小游戏模式的中文名(UI 展示用) */
export const MODE_LABELS = { collect: '拾取', dodge: '躲避', parkour: '跑酷' };

/**
 * 由基础参数展开出三档难度。
 * @param {'collect'|'dodge'|'parkour'} mode
 * @param {{ gold:number, goal?:number, time?:number, dist?:number }} base
 */
function makeTiers(mode, base) {
  return TIER_LABELS.map((label, i) => {
    const lv = i + 1;
    const spec = {
      mode, label, ap: lv, gold: Math.round(base.gold * GOLD_MUL[i]),
      lives: lv === 3 ? 2 : 3,      // 最难档少一条命
    };
    if (mode === 'collect') {
      spec.goal = Math.round(base.goal * (0.82 + 0.34 * lv));
      spec.time = Math.max(16, base.time - 3 * i);
      spec.speed = 1 + 0.3 * i;
      spec.hazard = 0.22 + 0.09 * i;
      spec.goalText = `收满 ${spec.goal}`;
    } else if (mode === 'dodge') {
      spec.goal = 15 + 6 * lv;
      spec.time = spec.goal;
      spec.speed = 1 + 0.32 * i;
      spec.spawn = 0.85 + 0.35 * i;
      spec.goalText = `存活 ${spec.goal} 秒`;
    } else {
      spec.goal = Math.round(base.dist * (0.78 + 0.34 * lv));
      spec.speed = 1 + 0.3 * i;
      spec.goalText = `跑过 ${spec.goal} 米`;
    }
    return spec;
  });
}

/** 定义一项打工 */
const J = (id, name, game, desc, hero, good, bad, gold, extra = {}) => ({
  id, name, game, desc, hero, good, bad,
  tiers: makeTiers(game, { gold, ...extra }),
});

export const JOBS = {
  village: [
    J('farm', '帮农户收麦', 'collect', '抢在雷雨前把麦捆收进筐,别让鸟雀叼走。', '🧺', '🌾', '🐦', 14, { goal: 14, time: 30 }),
    J('smith', '铁匠铺打杂', 'dodge', '拉风箱、递铁钳,当心飞溅的火星。', '🧍', '', '🔥', 24),
  ],
  forest: [
    J('wood', '林中伐木', 'dodge', '斧头起落,别被头顶坠下的枝干砸着。', '🪓', '', '🪵', 16),
    J('herb', '采集草药', 'collect', '在苔痕间辨认能入药的叶子,提防草里的蛇。', '🧺', '🌿', '🐍', 22, { goal: 13, time: 30 }),
  ],
  mountain: [
    J('mine', '矿道背矿', 'parkour', '背着矿石,在塌方的坑道里一路奔跑。', '⛏️', '', '', 28, { dist: 300 }),
    J('guide', '给商队引路', 'dodge', '带商队穿过结冰的隘口,躲开滚落的碎石。', '🧭', '', '🪨', 18),
  ],
  city: [
    J('porter', '码头扛包', 'collect', '一袋接一袋,别让老鼠咬破了麻袋。', '💪', '📦', '🐀', 26, { goal: 15, time: 30 }),
    J('scribe', '替人抄书', 'collect', '在灯下誊抄,接住飘落的书页,避开虫蛀。', '✒️', '📜', '🐛', 20, { goal: 12, time: 28 }),
  ],
  port: [
    J('fish', '随船打鱼', 'collect', '在颠簸的甲板上收网,当心水里的凶鱼。', '🎣', '🐟', '🦈', 30, { goal: 15, time: 30 }),
    J('unload', '码头卸货', 'parkour', '扛着盐渍的麻袋,在跳板之间奔跑。', '📦', '', '', 17, { dist: 280 }),
  ],
  sky: [
    J('wind', '校风翼索具', 'dodge', '在高处检修绳索,躲开突如其来的乱流。', '🪢', '', '⚡', 20),
    J('courier', '浮岛送信', 'parkour', '系紧风翼,在浮岛之间跳跃送信。', '🕊️', '', '', 32, { dist: 320 }),
  ],
  ruins: [
    J('salvage', '废墟拾荒', 'collect', '在瓦砾里扒出尚能用的东西,提防蛛网里的毒虫。', '🔦', '🏺', '🕷️', 15, { goal: 14, time: 30 }),
    J('clear', '清理断壁', 'dodge', '把塌下来的墙石搬开,当心二次塌落。', '⛏️', '', '🧱', 25),
  ],
  cliff: [
    J('climb', '替人攀崖采药', 'parkour', '贴着崖壁向上挪,跳过松动的石台。', '🧗', '', '', 27, { dist: 340 }),
    J('rope', '修补攀绳', 'dodge', '把磨断的绳索重新编紧,躲开碎石。', '🪢', '', '🪨', 16),
  ],
  camp: [
    J('cook', '营地烧饭', 'collect', '看火翻锅,接住热腾腾的肉,别被火舌燎到。', '🍳', '🍗', '🔥', 13, { goal: 12, time: 28 }),
    J('watch', '替人守夜', 'dodge', '抱着长矛守到天亮,赶开扑来的夜枭。', '🗡️', '', '🦇', 21),
  ],
};

/** 取某主题的打工列表(未知主题回落到村庄) */
export function jobsFor(theme) {
  return JOBS[theme] || JOBS.village;
}
