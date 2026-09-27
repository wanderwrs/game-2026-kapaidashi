/**
 * ch08.js — 第八章 · 拜师学艺(剑塔师承线)
 * 节拍:寻访剑塔遗址 → 遇剑塔叛徒 → 师承剑诀心法 → 弟弟渐能控龙
 * 战斗:1 场(剑塔叛徒)
 * 关键 flag:mastered_sword(剑诀心法)、brother_control(弟弟能控龙)
 */

const nodes = [
  {
    id: 'n01',
    kind: 'narrative',
    chapter: 8,
    text: `你带弟弟北上,寻找赫尔墨提过的冰原剑塔遗址。

剑塔已经塌了一半,残垣上还插着几把锈断的旧剑。塔中央,一个白发老者正在练剑。他听见脚步,转身。

"……铁匠的儿子。"他盯着你,"赫尔墨的徒弟。"

"你是?"你握剑警戒。

"我叫剑岚。曾是这塔的剑师。"他收剑入鞘,"赫尔墨走时,我留下了。教团烧塔时,我没护住学生,只剩我一个人。"

他看着你身边的弟弟,眼神复杂。"你弟弟……是火种?"

你点头。`,
    next: 'n02',
  },
  {
    id: 'n02',
    kind: 'choice',
    chapter: 8,
    text: `剑岚把你领进塔下的练剑窟。

"赫尔墨教你听剑。"他说,"剑塔的剑诀心法,叫'守约'。和你的剑同名。这心法不是教你杀,是教你护。"

他摆出三式剑诀,看着你。"我能教你三天。三天后,你和弟弟都得走——教团会找来。"

"但我必须告诉你一件事。"他压低声音,"剑塔心法的最后一式,叫'化龙'。这一式,能让火种回归人形。但用这一式,持剑者会替火种承受'龙化'之痛——你会变龙,他会变人。"

"你愿意学吗?"`,
    choices: [
      { text: '"我学。弟弟变人,我变龙也认了。"(接受化龙)', next: 'n03_learn', effects: { stats: { mercy: 3, courage: 2 }, flags: ['mastered_sword', 'brother_control'] } },
      { text: '"我学守约心法,但化龙那一式,我不学。"(只学守约)',  next: 'n03_learn', effects: { stats: { reason: 2, courage: 1 }, flags: ['mastered_sword'] } },
      { text: '"心法我不要。我只求您指点弟子如何自控。"(求弟自控)',   next: 'n03_dragon', effects: { stats: { mercy: 2, reason: 1 }, flags: ['brother_control'] } },
    ],
  },
  {
    id: 'n03_learn',
    kind: 'narrative',
    chapter: 8,
    text: `三日后,你能听见"守约"在掌心的低鸣。

剑岚把最后一式也传给了你——无论你学或不学,他都把剑诀的口诀念给了你。

"……记住,守约不是杀人的剑,是护约的剑。"他收剑,"你父亲守了一辈子,现在轮到你。"

就在这时,塔门被踹开。一个披黑袍的剑客走了进来,手中握着一把断成两截的剑。

"剑岚。"黑袍剑客冷笑,"教主说了,把那两个孩子交出来。"

剑岚脸色一变:"剑塔叛徒——阿诺!"`,
    next: 'n04_battle',
  },
  {
    id: 'n03_dragon',
    kind: 'narrative',
    chapter: 8,
    text: `剑岚没传你剑诀,只教了弟弟三日控龙心法。

弟弟一天天稳了。第三日傍晚,他能在你面前完整化龙又化人,而不发抖。

"……剑塔心法的最后一式,叫'化龙'。"剑岚忽然开口,"持剑者替火种承受龙化之痛。我本想传你,但看你心意——你只想让弟弟自控,自己不愿化龙。"

"那就这样吧。"他叹气,"走你们的路。"

就在这时,塔门被踹开。`,
    next: 'n04_battle',
  },
  {
    id: 'n04_battle',
    kind: 'battle',
    chapter: 8,
    text: `黑袍剑客阿诺拔出断剑,扑向剑岚。

"护住弟弟!"剑岚挡在你们身前,一剑迎上。

你握紧"守约",从侧翼杀出。

(战斗开始)`,
    enemyPool: 'ch08',
    victory_next: 'n05',
    defeat_next: 'n05',
  },
  {
    id: 'n05',
    kind: 'narrative',
    chapter: 8,
    text: `阿诺倒下了。

剑岚受了重伤,他靠在塔壁上,把剑诀的最后一卷手稿塞进你怀里。

"……孩子,走。"他咳出一口血,"塔我守。你们走你们的路。"

你搂过弟弟,向剑岚深深一礼,转身走出剑塔。

天亮前,你们已在百里之外。弟弟的呼吸是稳的。`,
    next: 'n06',
    effects: { flags: ['mastered_sword'] },
  },
  {
    id: 'n06',
    kind: 'choice',
    chapter: 8,
    text: `你握着剑诀手稿,弟弟在你身后呼吸平稳。

前方是圣心坛,大祭司在等你。但教团势力遍布——你或许该先去飞行学院、海洋学院或神学学院,寻求同盟。

——这一步,决定你下一段旅程的方向。`,
    choices: [
      { text: '"去飞行学院寻求同盟。"(飞行学院)',    next: 'ch09:n01', effects: { stats: { reason: 2 }, flags: ['aviator_path'] } },
      { text: '"去海洋学院寻求同盟。"(海洋学院)',    next: 'ch10:n01', effects: { stats: { reason: 2, mercy: 1 }, flags: ['mariner_path'] } },
      { text: '"去神学学院揭穿伪神。"(神学学院)',    next: 'ch11:n01', effects: { stats: { reason: 2, courage: 1 }, flags: ['expose_first'] } },
      { text: '"我已足够,直取圣心坛。"(直取祭典)', next: 'ch14:n01', effects: { stats: { courage: 3, wild: 1 }, flags: ['direct_strike'] } },
    ],
  },
];

export const CHAPTER_08 = {
  id: 'ch08',
  title: '第八章 · 拜师学艺',
  start: 'n01',
  nodes: new Map(nodes.map((n) => [n.id, n])),
};
