/**
 * ch04.js — 第四章 · 渔港寻亲(回乡寻母线)
 * 节拍:渔港打听母亲下落 → 继父爪牙追杀 → 找到母亲 → 母亲告知弟弟真身
 * 战斗:1 场(码头恶棍/继父爪牙)
 * 关键 flag:found_mother(寻亲)、mother_truth(弟弟真身)
 */

const nodes = [
  {
    id: 'n01',
    kind: 'narrative',
    chapter: 4,
    text: '你南下渔港。\n\n这是你长大的地方,每一道浪都认识你的脚。但五年过去,码头已经变了模样——龙脊印挂满了每一根桅杆,商船被教团的黑船取代,渔家被驱赶到码头最末段,蜷在漏雨的棚屋下。\n\n你认出一个卖咸鱼的老妇。她看见你,先是一惊,然后压低嗓门:"你母亲……她还活着,在灯塔下面的渔屋。但你继父的人每天巡逻三次,你夜里去。"\n\n你谢过她,在码头废棚里蹲到天黑。',
    next: 'n02',
  },
  {
    id: 'n02',
    kind: 'choice',
    chapter: 4,
    text: '夜深,你贴着码头栈道潜向灯塔。\n\n走到半路,三个壮汉从木箱后转出来,挡住去路。他们腰间别着短刀,胸口没有龙脊印,但你看得出他们是继父的爪牙——五年前抓走弟弟的那批人。\n\n"小子,你去哪?"为首者咧嘴笑,"老爹说了,你回来,就别想再走。"\n\n你想起了五年前那夜——继父把弟弟卖给教团做祭品时,这人也站在门口。',
    choices: [
      { text: '「滚开。」(拔剑硬闯)', next: 'n03_battle', effects: { stats: { courage: 2, wild: 1 } } },
      { text: '「我是来接母亲走的,不找你们的麻烦。」(交涉)', next: 'n03_trick', effects: { stats: { reason: 2, mercy: 1 } } },
    ],
  },
  {
    id: 'n03_battle',
    kind: 'battle',
    chapter: 4,
    text: '你拔剑冲上去,三人合围。\n\n(战斗开始)',
    enemyPool: 'ch04',
    victory_next: 'n04',
    defeat_next: 'n04',
  },
  {
    id: 'n03_trick',
    kind: 'narrative',
    chapter: 4,
    text: '你把『守约』插回剑鞘,举起空手。\n\n"我不为复仇。我母亲老了,我想接她去王城看病,三天就回。"\n\n为首者迟疑了一会儿,终于挥手。"放他过去。老爹说了,不找他麻烦,只要他别多管闲事。"\n\n你从他身边走过,没有回头。但你知道,这一步只是暂时的——他们终究会算账。',
    next: 'n04',
    effects: { flags: ['spared_stepfather_men'] },
  },
  {
    id: 'n04',
    kind: 'narrative',
    chapter: 4,
    text: '灯塔下的渔屋,门虚掩着。\n\n你推门进去。一个佝偻的妇人正在灯下补网,头发已经全白。她抬头看见你,先是一怔,然后眼泪就下来了。\n\n"……孩子。"她扑过来抱住你,"你父亲……你弟弟……"\n\n你搂住她。五年了,你第一次搂住她。\n\n"母亲,弟弟还活着。"你把她按回椅上,"我在追他。十五后,龙脊圣心坛。"',
    next: 'n05',
  },
  {
    id: 'n05',
    kind: 'choice',
    chapter: 4,
    text: '母亲擦干眼泪,从怀里摸出一枚褪色的银坠——和你口袋里弟弟那枚木刻小鱼是一对。\n\n"孩子,你弟弟……不完全是你的弟弟。"她声音发抖,"他不是你父亲亲生的。十六年前,龙脊教团送来一个婴孩,说是『火种』,托你父亲寄养。你父亲知道这意味着什么,但他不忍心拒绝一个婴孩。他把这孩子当亲生的养大。"\n\n"如今他们要收回火种,完成苏醒。"\n\n"……你父亲守了一辈子的约,就是这个约——保护这孩子,直到他能自己选择命运。"\n\n你想起了赫尔墨的话:"这剑叫『守约』。你父亲为它守了一辈子的约。现在轮到你了。"',
    choices: [
      { text: '「无论他是谁的血,他是我弟弟。我去救他。」(护弟)', next: 'n06', effects: { stats: { mercy: 3, courage: 1 }, flags: ['found_mother', 'mother_truth', 'brother_bond'] } },
      { text: '「……我需要时间想想。这孩子,是龙?」(犹豫)', next: 'n06', effects: { stats: { reason: 2 }, flags: ['found_mother', 'mother_truth'] } },
    ],
  },
  {
    id: 'n06',
    kind: 'narrative',
    chapter: 4,
    text: '母亲给你装了一袋干粮,把那枚银坠也塞进你怀里。\n\n"孩子,你去吧。"她站在灯塔下送你,"无论你找到什么,记住——剑是用来决定,你想成为谁。"\n\n你回头看她最后一眼,转身走向北方的山道。\n\n天亮前,你已走出渔港二十里。十五后的祭典,在等你。',
    next: 'n07',
    effects: { flags: ['found_mother'] },
  },
  {
    id: 'n07',
    kind: 'choice',
    chapter: 4,
    text: '你站在通往龙脊山脉的山道上。母亲的银坠和弟弟的木刻小鱼,在你怀里相碰。\n\n弟弟在圣心坛。也许父亲的旧友在王城。也许林——那个和你同行的少年——已经先到了山上。\n\n——这一步,决定你下一段旅程的方向。',
    choices: [
      { text: '「直奔圣心坛。弟弟等我。」(继续直追)', next: 'ch05:n01', effects: { stats: { courage: 2 }, flags: ['direct_chase'] } },
      { text: '「先去王城,洛恩大人曾说要给我调兵印。」(转道王国)', next: 'ch03:n01', effects: { stats: { reason: 2 }, flags: ['seek_aid'] } },
      { text: '「先去拜会剑塔的赫尔墨,他或许有破圣心坛之法。」(拜师)', next: 'ch08:n01', effects: { stats: { reason: 1, wild: 1 }, flags: ['seek_master'] } },
    ],
  },
];

export const CHAPTER_04 = {
  id: 'ch04',
  title: '第四章 · 渔港寻亲',
  start: 'n01',
  nodes: new Map(nodes.map((n) => [n.id, n])),
};
