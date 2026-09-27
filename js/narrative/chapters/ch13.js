/**
 * ch13.js — 第十三章 · 拯救村庄(解救乡民线)
 * 节拍:抵被掳村庄 → 教团长老 → 解救乡民 → 抉择独追或先送乡民
 * 战斗:1 场(教团长老)
 * 关键 flag:saved_village(救村庄)、spared_priest(饶过长老)
 */

const nodes = [
  {
    id: 'n01',
    kind: 'narrative',
    chapter: 13,
    text: `你带弟弟走进被洗劫的村庄。

村口的谷仓还在烧,瓦砾下掩着几具乡民的尸体。幸存者蜷在教堂残垣里,看见你握剑,先是一惊,然后——

"救救我们……"一个老妇扑过来,"教团把我们的孩子都抓走了,关在山后的祭坛地窖里。今夜就要'献祭'。"

你想起了赫尔墨的话:"剑是用来决定——你想成为谁。"`,
    next: 'n02',
  },
  {
    id: 'n02',
    kind: 'choice',
    chapter: 13,
    text: `你握紧"守约"。前方是山后的祭坛地窖,十几个孩子在等你。

老妇又说:"地窖守着的是教团长老,会妖术。你自己一个人,够吗?"

你想起了林——那个和你同行的少年,他大概在圣心坛等你。你想起了飞行学院、海洋学院的同盟——如果你求过援,他们应该已经赶来。`,
    choices: [
      { text: '"我自己去。弟弟你在这等我。"(独闯)',     next: 'n03_battle', effects: { stats: { courage: 3, wild: 2 }, flags: ['saved_village'] } },
      { text: '"弟弟,你和乡民们守好,我速去速回。"(护乡民)', next: 'n03_battle', effects: { stats: { mercy: 2, courage: 2 }, flags: ['saved_village'] } },
      { text: '"我先求同盟,再回来救乡民。"(求援)',     next: 'n03_aid', effects: { stats: { reason: 2, mercy: 1 } } },
    ],
  },
  {
    id: 'n03_battle',
    kind: 'battle',
    chapter: 13,
    text: `你潜到山后祭坛地窖。

地窖门口,一个白须长老披着黑袍,正在念咒。他听见脚步,转身。

"……火种的兄长?"他冷笑,"教主说了,你在路上。我们长老,奉命在此候你。"

他抬手,一道黑气凝成锁链向你扑来。

(战斗开始)`,
    enemyPool: 'ch13',
    victory_next: 'n04',
    defeat_next: 'n04',
  },
  {
    id: 'n03_aid',
    kind: 'narrative',
    chapter: 13,
    text: `你让弟弟守好乡民,自己翻山去求同盟。

若你曾去过飞行或海洋学院,同盟此刻应该已到山下;若没有,你只能独自返回。

半个时辰后,你回到村庄。无论是同盟到齐还是独自,你都握紧剑,走向山后祭坛地窖。`,
    next: 'n04',
  },
  {
    id: 'n04',
    kind: 'choice',
    chapter: 13,
    text: `长老倒下了(或被你绕过了)。

地窖里,十几个孩子蜷成一团,看见你,扑过来。你逐一安抚,把他们领出地窖。

长老还活着,胸口插着你的剑。他咳着血,看着你。

"……你不杀我?"他冷笑,"杀了我,教团不会放过你。不杀,我也不会感谢你。"

你想起了母亲的话:"剑是用来决定——你想成为谁。"`,
    choices: [
      { text: '"我不杀你。你的命,你自己选。"(饶长老)',     next: 'n05', effects: { stats: { mercy: 3, reason: 1 }, flags: ['spared_priest', 'saved_village'] } },
      { text: '"你不死,乡民永无宁日。"(了结长老)',        next: 'n05', effects: { stats: { courage: 2, wild: 1 }, flags: ['saved_village'] } },
      { text: '"把他交给乡民,让他们自己决定。"(交乡民)',    next: 'n05', effects: { stats: { mercy: 1, reason: 2 }, flags: ['saved_village'] } },
    ],
  },
  {
    id: 'n05',
    kind: 'narrative',
    chapter: 13,
    text: `无论长老如何,你都把孩子们送回了乡民手里。

老妇抱着孙女哭了一会儿,然后转身从怀里摸出一卷羊皮地图,塞进你手里。

"……这是我们年轻时画的圣心坛地道图。"她声音发抖,"当年教团还没掌权,我们进去过一次。从祭坛后山的下水道,能直通火柱底下。"

"孩子,去吧。"她握住你的手,"救你的弟弟。"`,
    next: 'n06',
    effects: { flags: ['saved_village', 'got_secret_map'] },
  },
  {
    id: 'n06',
    kind: 'choice',
    chapter: 13,
    text: `你揣着地道图,弟弟在你身边。

圣心坛就在北方。十五后的祭典就在今夜。

——这一步,决定你下一段旅程的方向。`,
    choices: [
      { text: '"直取圣心坛,了结大祭司。"(直取祭典)', next: 'ch14:n01', effects: { stats: { courage: 3, wild: 2 }, flags: ['direct_strike'] } },
      { text: '"先告知林,集结所有同盟。"(集结)',  next: 'ch12:n01', effects: { stats: { reason: 2 }, flags: ['shared_path'] } },
    ],
  },
];

export const CHAPTER_13 = {
  id: 'ch13',
  title: '第十三章 · 拯救村庄',
  start: 'n01',
  nodes: new Map(nodes.map((n) => [n.id, n])),
};
