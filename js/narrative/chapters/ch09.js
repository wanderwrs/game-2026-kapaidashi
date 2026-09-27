/**
 * ch09.js — 第九章 · 飞行学院(云端求学线)
 * 节拍:登浮岛 → 风翼海盗来袭 → 学院借风翼 → 学院同盟
 * 战斗:1 场(风翼海盗)
 * 关键 flag:aviator_ally(飞行同盟)、got_wings(借风翼)
 */

const nodes = [
  {
    id: 'n01',
    kind: 'narrative',
    chapter: 9,
    text: `你带弟弟登上云端浮岛。

浮岛族世代与风鸥为伴,以云为田,以风为马。浮岛飞行学院就悬在最高的云层之上,只有借风翼才能抵达。

一个少女从云端降下,披着蓝白羽袍,驾驭一对银白的风翼。她看着你和弟弟,挑眉。

"地上的少年,带个会变龙的孩子上浮岛?"她绕着你们飞了一圈,"胆子不小。我叫云雀,飞行学院的学徒。找我何事?"`,
    next: 'n02',
  },
  {
    id: 'n02',
    kind: 'choice',
    chapter: 9,
    text: `你向云雀说明了来意:弟弟是教团的火种,你想借风翼去圣心坛,并在途中寻求同盟。

云雀听完,沉默了一会儿。

"教团……"她咬了咬唇,"三月前,他们抓走了我妹妹,说是'备火种'。她也在这批孩子里?"

"我能借你一对风翼。"她终于说,"但我有个条件——你必须帮我做一件事。教团雇佣的风翼海盗,每周都会从浮岛抢掠补给。我妹妹也在他们手里。"

"你帮我把海盗的船打下来,我把风翼借你。"

你想起了赫尔墨的话:"剑是用来决定——你想成为谁。"`,
    choices: [
      { text: '"我帮你打海盗。妹妹也是要救的人。"(助云雀)', next: 'n03_battle', effects: { stats: { mercy: 2, courage: 2 }, flags: ['aviator_ally', 'got_wings'] } },
      { text: '"我救不了妹妹,但我可以打海盗。"(只打海盗)',   next: 'n03_battle', effects: { stats: { courage: 2, wild: 1 }, flags: ['got_wings'] } },
      { text: '"风翼我另寻,不接这趟。"(婉拒)',           next: 'n03_decline', effects: { stats: { reason: 2 } } },
    ],
  },
  {
    id: 'n03_battle',
    kind: 'battle',
    chapter: 9,
    text: `云雀带你和弟弟升上云层,在浮岛边缘埋伏。

半个时辰后,一艘挂着龙脊印的黑帆风翼船从西边飞来。云雀举起信号旗。

"上!"

你跃上船舷,一剑斩向舵手。风翼海盗们纷纷拔出风刃围上来。

(战斗开始)`,
    enemyPool: 'ch09',
    victory_next: 'n04',
    defeat_next: 'n04',
  },
  {
    id: 'n03_decline',
    kind: 'narrative',
    chapter: 9,
    text: `云雀点头,不勉强。

"那我送你下浮岛。"她说,"风翼的事,你自己想办法。"

她把你和弟弟送回地面,转身升上云端。你望着她消失的方向,知道这条路走到了尽头。

你握紧"守约",带着弟弟走向北方的圣心坛。`,
    next: 'n05',
  },
  {
    id: 'n04',
    kind: 'narrative',
    chapter: 9,
    text: `海盗船被你打下来了。

云雀从船舱深处救出了十几个被掳的孩子,其中就有她妹妹。她抱着妹妹哭了一会儿,然后把一对银白的风翼塞进你怀里。

"……谢谢你。"她擦干眼泪,"这风翼,送你。它能载你直飞圣心坛。"

"还有……"她抬头,"我和学院的姐妹,愿意跟你走一程。教团欠我们的,我们一起讨回来。"`,
    next: 'n05',
    effects: { flags: ['aviator_ally', 'got_wings'] },
  },
  {
    id: 'n05',
    kind: 'choice',
    chapter: 9,
    text: `你借到了风翼(或没有)。弟弟在你身边,呼吸稳了。

圣心坛在北方云层之上。你想起了林——那个和你同行的少年,他大概已经先到了。

——这一步,决定你下一段旅程的方向。`,
    choices: [
      { text: '"直飞圣心坛,了结大祭司。"(直取祭典)', next: 'ch14:n01', effects: { stats: { courage: 3, wild: 1 }, flags: ['direct_strike'] } },
      { text: '"先去海洋学院拉同盟。"(海洋学院)',   next: 'ch10:n01', effects: { stats: { reason: 2, mercy: 1 }, flags: ['mariner_path'] } },
      { text: '"先去神学学院揭穿伪神。"(神学学院)',   next: 'ch11:n01', effects: { stats: { reason: 2, courage: 1 }, flags: ['expose_first'] } },
      { text: '"先救被掳的乡民。"(拯救村庄)',      next: 'ch13:n01', effects: { stats: { mercy: 3, courage: 1 }, flags: ['saved_village'] } },
    ],
  },
];

export const CHAPTER_09 = {
  id: 'ch09',
  title: '第九章 · 飞行学院',
  start: 'n01',
  nodes: new Map(nodes.map((n) => [n.id, n])),
};
