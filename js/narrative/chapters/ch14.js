/**
 * ch14.js — 第十四章 · 大祭司之战(终战)
 * 节拍:圣心坛终战 → 大祭司 + 圣坛傀儡 → 弟弟的最终抉择 → 结局触发
 * 战斗:1 场(大祭司/圣坛傀儡)
 * 关键 flag:killed_grandpriest(终战)、ending_* 由 resolveEnding 综合
 */

const nodes = [
  {
    id: 'n01',
    kind: 'narrative',
    chapter: 14,
    text: `你冲进圣心坛。

祭坛中央,火柱燃得通天。弟弟站在火柱前,周围是黑袍教徒。大祭司站在祭坛最高处,白须白袍,手中捧着一把燃烧的圣剑。

"火种已就位。"大祭司宣诵,"旧神,苏醒吧!"

弟弟转头看见你,眼里有光,也有泪。

"哥哥……我没变龙。我选择,不变成它。"

大祭司冷笑:"无知的火种。你不变龙,我便用这把圣剑替你变。"`,
    next: 'n02',
  },
  {
    id: 'n02',
    kind: 'choice',
    chapter: 14,
    text: `你想起了赫尔墨的话:"剑是用来决定——你想成为谁。"

你也想起了洛恩临终的低语:"揭穿伪神,才能让所有人重新选择。"

若你身上有圣典残页,你可以当众念出揭穿咒语;若你学过剑塔心法最后一式"化龙",你可以替弟弟承受龙化;若你只有"守约",你只能直取大祭司。`,
    choices: [
      { text: '"大祭司,受死!"(直取大祭司)',         next: 'n03_battle', effects: { stats: { courage: 3, wild: 2 }, flags: ['killed_grandpriest'] } },
      { text: '"我念圣典残页,揭穿伪神!"(揭穿伪神)',   next: 'n03_expose', effects: { stats: { reason: 3, courage: 1 }, flags: ['exposed_church', 'killed_grandpriest'] } },
      { text: `"弟弟,你走。我用'化龙',替你承受。"(化龙护弟)`, next: 'n03_transform', effects: { stats: { mercy: 3, courage: 3 }, flags: ['sacrificed_self', 'brother_returned'] } },
    ],
  },
  {
    id: 'n03_battle',
    kind: 'battle',
    chapter: 14,
    text: `你跃上祭坛,一剑直取大祭司!

大祭司抬手,一道燃烧的圣剑气劈向你。圣坛傀儡从祭坛阴影里走出,挡在你和大祭司之间。

"火种的兄长。"大祭司冷笑,"你的剑,守不住你的约。"

(战斗开始)`,
    enemyPool: 'ch14',
    victory_next: 'n04',
    defeat_next: 'n04',
  },
  {
    id: 'n03_expose',
    kind: 'battle',
    chapter: 14,
    text: `你掏出圣典残页,在祭坛前当众念出揭穿咒语。

"……所谓旧神,不过是沉睡的远古龙。教团以童心为火种,唤它焚毁王国,建立龙国!这'神',是你们自己造的!"

祭坛上的教徒们一片哗然。大祭司脸色铁青:"……叛教者!杀了他!"

圣坛傀儡扑向你,大祭司拔剑紧随。

(战斗开始)`,
    enemyPool: 'ch14',
    victory_next: 'n04_expose',
    defeat_next: 'n04_expose',
  },
  {
    id: 'n03_transform',
    kind: 'battle',
    chapter: 14,
    text: `你挡在弟弟身前,运起剑塔心法最后一式——化龙。

"守约。"你低声,"我守我的约。"

你的皮肤开始冒出鳞片,剧痛从骨髓深处涌来。弟弟惊叫:"哥哥,不要——"

但你笑了。你化龙,他化人。这是你替他守的约。

(战斗开始)`,
    enemyPool: 'ch14',
    victory_next: 'n04_transform',
    defeat_next: 'n04_transform',
  },
  {
    id: 'n04',
    kind: 'narrative',
    chapter: 14,
    text: `大祭司倒下了。

你跪在祭坛上,喘息。弟弟扑过来抱住你。

"哥哥……"他哭,"我没变龙。我没变它。"

你搂住他,笑了。火柱在你身后熄灭,祭坛归于沉寂。`,
    next: 'n05_hero',
    effects: { flags: ['found_brother', 'killed_grandpriest'] },
  },
  {
    id: 'n04_expose',
    kind: 'narrative',
    chapter: 14,
    text: `大祭司倒下了。

揭穿的咒语传遍祭坛。教徒们纷纷丢下黑袍,有人跪地忏悔,有人哭嚎。火柱熄灭,祭坛归于沉寂。

弟弟扑过来抱住你。"哥哥……我们做到了。"

你搂住他,笑了。`,
    next: 'n05_hero',
    effects: { flags: ['found_brother', 'killed_grandpriest', 'exposed_church'] },
  },
  {
    id: 'n04_transform',
    kind: 'narrative',
    chapter: 14,
    text: `大祭司倒下了。

你跪在祭坛上,鳞片一道道退去——但你回不去了。化龙的代价是,你的血脉已经改变。

弟弟扑过来抱住你,哭得不能自已。

"哥哥……你为什么……"

你搂住他,笑了。"……因为我选择,不让你变龙。守约,守的是这个约。"`,
    next: 'n05_tragic',
    effects: { flags: ['found_brother', 'killed_grandpriest', 'sacrificed_self'] },
  },
  // ===== 结局节点 =====
  {
    id: 'n05_hero',
    kind: 'ending',
    chapter: 14,
    text: `火柱熄灭了。

你带着弟弟走出圣心坛。山下的乡民、王城的人、各学院的学徒——你集结的同盟,在山脚等你。

你望向远方。龙脊山脉在你身后,双头鹰旗在你前方翻飞。王城在等你回去,带着父亲的旧友、母亲的银坠、弟弟的木刻小鱼。

新征程,即将开启。`,
    ending_id: 'hero',
  },
  {
    id: 'n05_tragic',
    kind: 'ending',
    chapter: 14,
    text: `火柱熄灭了。

你带着变了形的自己,和弟弟走下圣心坛。弟弟扶着你,因为他怕你倒下。

你望向远方,笑了一下。父亲的旧剑在你腰间,守了它的约。

你回不去了。但你守住了弟弟。`,
    ending_id: 'tragic',
  },
];

export const CHAPTER_14 = {
  id: 'ch14',
  title: '第十四章 · 大祭司之战',
  start: 'n01',
  nodes: new Map(nodes.map((n) => [n.id, n])),
};
