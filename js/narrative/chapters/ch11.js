/**
 * ch11.js — 第十一章 · 神学学院(揭穿伪神线)
 * 节拍:潜入大教堂 → 揭穿教团伪神 → 异端审问官来袭 → 取圣典残页
 * 战斗:1 场(异端审问官)
 * 关键 flag:exposed_church(揭穿伪神)、got_holy_page(圣典残页)
 */

const nodes = [
  {
    id: 'n01',
    kind: 'narrative',
    chapter: 11,
    text: `你带弟弟潜入大教堂。

教堂的穹顶画满了飞升的圣人,祭坛前燃着七支长明灯。一个年迈的修士在灯下抄经,他抬头看见你,先是一惊,然后——

"……林的朋友?"他低声,"林去圣心坛之前,留了话:若有人来揭穿伪神,带他来见我。"

他叫烛老,是教堂里仍记得"真神"教义的最后一位修士。`,
    next: 'n02',
  },
  {
    id: 'n02',
    kind: 'choice',
    chapter: 11,
    text: `烛老把你领进教堂地下的藏书室。

"教团崇拜的'旧神',是龙脊山脉深处一头沉睡的远古龙。"他翻开一卷残页,"他们用童心作火种,唤醒这头龙,让它焚毁王国,建立'龙国'。"

"但旧神不是真神。"他叹气,"真神教会的是:人之所以为人,在于能选择。教团把'选择'夺走,代之以'服从'。"

"这卷圣典残页,记载了揭穿伪神的咒语。我藏了二十年。"他把残页推到你面前,"你若要在圣心坛揭穿大祭司,带上它。"

"但我必须告诉你——"他压低声音,"一旦你在大庭广众念出咒语,教团会不惜代价杀你。你做好准备了么?"`,
    choices: [
      { text: '"我已无退路。揭穿伪神,也是我父亲的约。"(接残页)', next: 'n03_accept', effects: { stats: { courage: 3, reason: 1 }, flags: ['exposed_church', 'got_holy_page'] } },
      { text: '"揭穿可以,但保命要紧。我需要后路。"(求保命)',   next: 'n03_plan', effects: { stats: { reason: 2 }, flags: ['exposed_church'] } },
      { text: '"这责任太重。我只救弟弟。"(婉拒)',          next: 'n03_decline', effects: { stats: { wild: 1 } } },
    ],
  },
  {
    id: 'n03_accept',
    kind: 'narrative',
    chapter: 11,
    text: `烛老把残页塞进你怀里,然后转身走向教堂正厅。

"我去引开异端审问官。"他说,"你从地下密道走。十五后,圣心坛见。"

他走前回头:"孩子,记住——剑是用来决定,你想成为谁。揭穿伪神,不是为了胜利,是为了让所有人,都能重新选择。"

就在他走出藏书室的瞬间,外面传来靴声。`,
    next: 'n04_battle',
  },
  {
    id: 'n03_plan',
    kind: 'narrative',
    chapter: 11,
    text: `烛老点头,帮你规划了一条密道。

"地下密道通向王城旧水管,从那出城最快。"他塞给你一把钥匙,"念咒前,先确保有退路。"

就在这时,外面传来靴声。`,
    next: 'n04_battle',
  },
  {
    id: 'n03_decline',
    kind: 'narrative',
    chapter: 11,
    text: `烛老叹气,不勉强。

"那这残页,我替你保管。"他说,"若你改变心意,十五后,圣心坛见。"

就在这时,外面传来靴声。`,
    next: 'n04_battle',
  },
  {
    id: 'n04_battle',
    kind: 'battle',
    chapter: 11,
    text: `三个异端审问官闯进藏书室。

"……烛老的同党。"为首者冷笑,"一并送祭。"

你拔剑挡在弟弟身前。

(战斗开始)`,
    enemyPool: 'ch11',
    victory_next: 'n05',
    defeat_next: 'n05',
  },
  {
    id: 'n05',
    kind: 'narrative',
    chapter: 11,
    text: `审问官倒下了。

你带着弟弟从地下密道逃出大教堂。怀里揣着圣典残页(或没有)。天亮前,你已在城外山道。

十五后的祭典,在等你。圣心坛在北方。`,
    next: 'n06',
    effects: { flags: ['exposed_church'] },
  },
  {
    id: 'n06',
    kind: 'choice',
    chapter: 11,
    text: `你握着"守约"和圣典残页(或没有),弟弟在你身边。

圣心坛在北方。林大概已经先到了。

——这一步,决定你下一段旅程的方向。`,
    choices: [
      { text: '"直取圣心坛,了结大祭司。"(直取祭典)',     next: 'ch14:n01', effects: { stats: { courage: 3, wild: 1 }, flags: ['direct_strike'] } },
      { text: '"先去救被掳的乡民。"(拯救村庄)',        next: 'ch13:n01', effects: { stats: { mercy: 3, courage: 1 }, flags: ['saved_village'] } },
      { text: '"先去找飞行/海洋学院同盟。"(集结同盟)',     next: 'ch09:n01', effects: { stats: { reason: 2 }, flags: ['aviator_path'] } },
    ],
  },
];

export const CHAPTER_11 = {
  id: 'ch11',
  title: '第十一章 · 神学学院',
  start: 'n01',
  nodes: new Map(nodes.map((n) => [n.id, n])),
};
