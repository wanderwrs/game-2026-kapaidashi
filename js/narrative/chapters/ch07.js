/**
 * ch07.js — 第七章 · 森林探险(迷心林线)
 * 节拍:入迷心林 → 林中妖精困阵 → 弟弟失控与救弟 → 穿林而出
 * 战斗:2 场(迷林妖精 / 林中熊)
 * 关键 flag:forest_passed(穿林)
 */

const nodes = [
  {
    id: 'n01',
    kind: 'narrative',
    chapter: 7,
    text: `你牵着弟弟走进迷心林。

林子黑得不像白天。树冠遮天蔽日,阳光只能从叶缝里漏下点点光斑。空气潮湿,带着腐叶和苔藓的味道。

林在身后叮嘱:"怀揣执念的人会被林困住。你和弟弟,谁的执念先乱,谁就先迷。"

你握紧弟弟的手。他的手心在发烫。

走了半个时辰,你听见树丛里传来笑声。一个半透明的妖精从叶缝里钻出来,歪头看你。

"少年,你执念很重啊。"她咯咯笑,"是要救弟弟?还是要屠龙?还是要回家?"

你愣住了。这三个念头,你确实分不清哪个是主。`,
    next: 'n02',
  },
  {
    id: 'n02',
    kind: 'choice',
    chapter: 7,
    text: `妖精在你身边绕了一圈,弟弟的鳞片开始冒热气。

"我说出来你就要变龙了,小家伙。"妖精凑近弟弟,声音甜得发腻,"你的执念是——回家。可你没有家。你的家在祭坛上,你忘了?"

弟弟的眼睛开始发红。

你想起了赫尔墨的话:"剑是用来决定——你想成为谁。"

现在,你要先决定:你想成为谁?`,
    choices: [
      { text: '"我要带弟弟回家,无论如何。"(信念定林)',   next: 'n03_resolve', effects: { stats: { mercy: 2, courage: 1 }, flags: ['forest_passed'] } },
      { text: '"我要斩断执念,先斩这妖精。"(拔剑斩妖)',     next: 'n03_battle', effects: { stats: { courage: 2, wild: 1 } } },
      { text: '"我不知道我要成为谁。但我要保护弟弟。"(护弟)', next: 'n03_bear', effects: { stats: { mercy: 3 }, flags: ['forest_passed'] } },
    ],
  },
  {
    id: 'n03_resolve',
    kind: 'narrative',
    chapter: 7,
    text: `你深吸一口气,把弟弟搂进怀里。

"我要带弟弟回家。"你对妖精说,声音稳了,"家不在祭坛上,家在他和我一起走路的地方。"

妖精愣了一下,然后咯咯笑起来,声音却弱了。

"……好奇怪的人。"她绕着你们转了一圈,"我困不住你了。走你的路吧。"

林子忽然亮了一些,前方的路也清晰了。弟弟的鳞片退了下去,他抬头看你,眼里有光。`,
    next: 'n04',
  },
  {
    id: 'n03_battle',
    kind: 'battle',
    chapter: 7,
    text: `你拔剑斩向妖精!

"无礼!"妖精尖叫,化作一团飞舞的光点向你扑来。弟弟惊叫着后退,鳞片又一次顶出皮肤。

(战斗开始)`,
    enemyPool: 'ch07',
    victory_next: 'n04',
    defeat_next: 'n04',
  },
  {
    id: 'n03_bear',
    kind: 'battle',
    chapter: 7,
    text: `你把弟弟护在身后,挡在妖精和弟弟之间。

"护弟心切?好,让我看看你能护多久。"妖精冷笑,从树丛里唤出一头黑熊。熊掌落地,震得树皮簌簌掉落。

(战斗开始)`,
    enemyPool: 'ch07',
    victory_next: 'n04',
    defeat_next: 'n04',
  },
  {
    id: 'n04',
    kind: 'narrative',
    chapter: 7,
    text: `无论那场遭遇如何,你和弟弟都穿过了迷心林。

林子在身后渐渐变亮。你们走出林缘,看见一片开阔的山谷。山谷里有炊烟——是一座被教团洗劫过的村庄,如今只剩残垣。

你握紧弟弟的手,走向那片炊烟。

——这一步,决定你下一段旅程的方向。`,
    next: 'n05',
  },
  {
    id: 'n05',
    kind: 'choice',
    chapter: 7,
    text: `你站在山谷口,弟弟的呼吸稳了。

前方是被洗劫的村庄,有需要救的乡民。远处是飞行学院的浮岛,有你想拜的旧识。更远是圣心坛,有大祭司在等你。

你想起了赫尔墨的话:"剑是用来决定——你想成为谁。"`,
    choices: [
      { text: '"先救村庄,乡民需要我。"(拯救村庄)',   next: 'ch13:n01', effects: { stats: { mercy: 3, courage: 1 }, flags: ['saved_village'] } },
      { text: '"去飞行学院求援。"(飞行学院)',      next: 'ch09:n01', effects: { stats: { reason: 2 }, flags: ['aviator_path'] } },
      { text: '"直接杀回圣心坛,了结大祭司。"(直取祭典)', next: 'ch14:n01', effects: { stats: { courage: 3, wild: 1 }, flags: ['direct_strike'] } },
    ],
  },
];

export const CHAPTER_07 = {
  id: 'ch07',
  title: '第七章 · 森林探险',
  start: 'n01',
  nodes: new Map(nodes.map((n) => [n.id, n])),
};
