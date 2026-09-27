/**
 * ch09.js — 第九章 · 飞行学院(云端求学线)
 * 节拍:登浮岛 → 风翼海盗来袭 → 学院借风翼 → 学院同盟
 * 战斗:1 场(风翼海盗)
 * 关键 flag:aviator_ally(飞行同盟)、got_wings(借风翼)
 */

const nodes = [
  // ===== n00 路由节点:根据当前职业自动分支 =====
  // 飞行学徒(aviator)走 n01_aviator 专属简化路径(云雀认出同门,直接借风翼,跳过海盗战)
  // 其他职业走 n01 普通路径(需打海盗换风翼)
  {
    id: 'n00',
    kind: 'narrative',
    chapter: 9,
    text: `你带弟弟向云端浮岛进发。

浮岛悬在最高的云层之上。你抬头望去,云海翻涌,银白的浮岛在云顶若隐若现。`,
    next: 'n01',
    career_branch: {
      aviator: 'n01_aviator',
      default: 'n01',
    },
  },
  // ===== n01_aviator:飞行学徒专属路径(简化)=====
  {
    id: 'n01_aviator',
    kind: 'narrative',
    chapter: 9,
    text: `你展开自己的风翼,带着弟弟直飞云顶。风鸥绕着你鸣叫,像是认出同族。

浮岛上的少女远远就看见了你——她披着蓝白羽袍,驾驭一对银白风翼,迎面飞来。

"风翼一族?"她靠近,看清你肩上的羽纹,"你是学院的人!"

"我叫云雀。"她按住你的肩,"你来得正好。教团雇佣的风翼海盗三月前抓走了我妹妹,说是'备火种'。我独力难支,你愿意帮我打下来吗?"

你点头。同门之谊,不必多言。云雀当即取出一对备用风翼递给你弟弟——"这孩子也能飞了。"

(飞行学徒专属:云雀认出同门,直接同盟,无需交涉。风翼已备,弟弟可同行。)`,
    next: 'n03_battle',
    effects: { flags: ['aviator_ally', 'got_wings'], stats: { mercy: 1, courage: 1 } },
  },
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
    next: 'n04_switch',
    effects: { flags: ['aviator_ally', 'got_wings'], unlock_career: 'aviator' },
  },
  // ===== 休息节点:可选择是否切换到新解锁的飞行学徒职业 =====
  {
    id: 'n04_switch',
    kind: 'switch_career',
    chapter: 9,
    text: `云雀临别时把一本飞行心法塞给你:"你是同门(或非同门),但这一程我看清了你。这心法,你若愿意学,飞行学院的门永远为你开。"

——你已解锁『飞行学徒』职业。

她教了你驾驭风翼的基础心法。你想了想:剑与风翼,是两条路,但都通往圣心坛。

(此处可选择切换到『飞行学徒』职业。飞行学徒在后续云端/浮岛剧情中将有专属简化路径与同盟加成,或保持当前职业继续。)`,
    next: 'n05',
  },
  {
    id: 'n05',
    kind: 'choice',
    chapter: 9,
    text: `你借到了风翼(或没有)。弟弟在你身边,呼吸稳了。

云雀临别时,把一本飞行心法塞给你:"你是同门(或非同门),但这一程我看清了你。这心法,你若愿意学,飞行学院的门永远为你开。"

——你已解锁『飞行学徒』职业。可在后续任意休息节点切换。

圣心坛在北方云层之上。你想起了林——那个和你同行的少年,他大概已经先到了。

——这一步,决定你下一段旅程的方向。`,
    choices: [
      { text: '"直飞圣心坛,了结大祭司。"(直取祭典)', next: 'ch14:n01', effects: { stats: { courage: 3, wild: 1 }, flags: ['direct_strike'] } },
      { text: '"先去海洋学院拉同盟。"(海洋学院)',   next: 'ch10:n01', effects: { stats: { reason: 2, mercy: 1 }, flags: ['mariner_path'] } },
      { text: '"先去神学学院揭穿伪神。"(神学学院)',   next: 'ch11:n01', effects: { stats: { reason: 2, courage: 1 }, flags: ['expose_first'] } },
      { text: '"先救被掳的乡民。"(拯救村庄)',      next: 'ch13:n01', effects: { stats: { mercy: 3, courage: 1 }, flags: ['saved_village'] } },
    ],
    effects: { unlock_career: 'aviator' },
  },
];

export const CHAPTER_09 = {
  id: 'ch09',
  title: '第九章 · 飞行学院',
  start: 'n00',
  nodes: new Map(nodes.map((n) => [n.id, n])),
};
