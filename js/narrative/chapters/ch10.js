/**
 * ch10.js — 第十章 · 海洋学院(远洋求学线)
 * 节拍:抵远洋学院 → 深海鱼人来袭 → 学院借船 → 学院同盟
 * 战斗:1 场(深海鱼人)
 * 关键 flag:mariner_ally(海洋同盟)、got_ship(借船)
 */

const nodes = [
  {
    id: 'n01',
    kind: 'narrative',
    chapter: 10,
    text: `你带弟弟南下,抵达远洋学院的港口。

远洋学院建在一座漂浮的木城上,学院四周,深蓝色的海浪拍打着木桩。一个戴眼镜的中年人从码头走来,披着褪色的海军袍。

"我是海洋学院的教导主任,海笛。"他打量你和弟弟,"你身上有剑塔的气息,有飞行学院的标记,如今又来找我——你想集结所有学院,对抗教团?"

你点头。`,
    next: 'n02',
  },
  {
    id: 'n02',
    kind: 'choice',
    chapter: 10,
    text: `海笛把你领进学院的水晶厅。

"教团……"他叹气,"他们抓走了我的儿子,说是'备火种'。备火种,你也听见这个词了?"

"学院还有一艘能远航的快船,叫'盐风号'。我可以借你,送你直奔圣心坛的海路入口。但我有个条件——"

"深海鱼人近期袭击学院码头三次,我儿子就在第三次被掳。你帮我把码头那批鱼人打下来,我把船借你。"

你想起了赫尔墨的话:"剑是用来决定——你想成为谁。"`,
    choices: [
      { text: '"我帮你打鱼人,你儿子我也要救。"(助海笛)',   next: 'n03_battle', effects: { stats: { mercy: 2, courage: 2 }, flags: ['mariner_ally', 'got_ship'] } },
      { text: '"船我借,鱼人我打,你儿子的事我不保证。"(只打鱼人)', next: 'n03_battle', effects: { stats: { courage: 2, wild: 1 }, flags: ['got_ship'] } },
      { text: '"快船我另想办法。"(婉拒)',                next: 'n03_decline', effects: { stats: { reason: 2 } } },
    ],
  },
  {
    id: 'n03_battle',
    kind: 'battle',
    chapter: 10,
    text: `你随海笛潜到码头水下,在木桩深处伏击。

一队深海鱼人从水底浮起,鳞片在月光下闪着油光,手中三叉戟滴着水。

"……入侵者!"为首的鱼人嘶吼,扑向你。

(战斗开始)`,
    enemyPool: 'ch10',
    victory_next: 'n04',
    defeat_next: 'n04',
  },
  {
    id: 'n03_decline',
    kind: 'narrative',
    chapter: 10,
    text: `海笛点头,不勉强。

"那我送你出港。"他说,"船的事,你自己想办法。"

他送你和弟弟出了学院。你望着墨色的海,知道这条路走到了尽头。

你握紧"守约",带弟弟走向北方的圣心坛。`,
    next: 'n05',
  },
  {
    id: 'n04',
    kind: 'narrative',
    chapter: 10,
    text: `鱼人倒下了。

海笛从水底救出了十几个被掳的孩子,其中就有他儿子。他抱着儿子哭了一会儿,然后把"盐风号"的钥匙塞进你手里。

"……谢谢你。"他擦干眼泪,"这船,送你。它能载你直航圣心坛的海路入口。"

"还有……"他抬头,"我和学院的水手,愿意跟你走一程。教团欠我们的,一起讨回来。"`,
    next: 'n05',
    effects: { flags: ['mariner_ally', 'got_ship'] },
  },
  {
    id: 'n05',
    kind: 'choice',
    chapter: 10,
    text: `你借到了船(或没有)。弟弟在你身边,呼吸稳了。

圣心坛在北方山脉。你想起了林——那个和你同行的少年,他大概已经先到了。

——这一步,决定你下一段旅程的方向。`,
    choices: [
      { text: '"直航圣心坛,了结大祭司。"(直取祭典)',     next: 'ch14:n01', effects: { stats: { courage: 3, wild: 1 }, flags: ['direct_strike'] } },
      { text: '"先去神学学院揭穿伪神。"(神学学院)',       next: 'ch11:n01', effects: { stats: { reason: 2, courage: 1 }, flags: ['expose_first'] } },
      { text: '"先去飞行学院拉同盟。"(飞行学院)',       next: 'ch09:n01', effects: { stats: { reason: 2, mercy: 1 }, flags: ['aviator_path'] } },
      { text: '"先救被掳的乡民。"(拯救村庄)',          next: 'ch13:n01', effects: { stats: { mercy: 3, courage: 1 }, flags: ['saved_village'] } },
    ],
  },
];

export const CHAPTER_10 = {
  id: 'ch10',
  title: '第十章 · 海洋学院',
  start: 'n01',
  nodes: new Map(nodes.map((n) => [n.id, n])),
};
