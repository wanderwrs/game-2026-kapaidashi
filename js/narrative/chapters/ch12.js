/**
 * ch12.js — 第十二章 · 弟弟失踪(伪失踪线)
 * 节拍:弟弟为护哥哥主动回圣心坛 → 教团守卫 → 寻亲路途
 * 战斗:1 场(教团守卫)
 * 关键 flag:brother_lost(弟失)、brother_returned(弟返)
 */

const nodes = [
  {
    id: 'n01',
    kind: 'narrative',
    chapter: 12,
    text: `你醒来时,弟弟不见了。

篝火只剩灰烬。他的行囊还放在原处,木刻小鱼吊坠也还在你口袋——但人不见了。

地上有一行小脚印,延伸向北方。

你慌乱起身,沿脚印追。脚印在一处山岩前断了——岩石上刻着一道龙脊印,印下还有弟弟歪歪扭扭的字:"哥哥,别找我。我回去,他们就不抓你了。"`,
    next: 'n02',
  },
  {
    id: 'n02',
    kind: 'choice',
    chapter: 12,
    text: `你呆立了半晌。

弟弟以为,只要他回圣心坛,教团就会放过你。他不知道,大祭司要的不是"归还",是"完成苏醒"——他这一去,正是把自己献上祭坛。

你握紧"守约"。前方是圣心坛,弟弟在等你。

但山路上有教团守卫。你想起赫尔墨的话:"剑是用来决定——你想成为谁。"`,
    choices: [
      { text: '"弟弟,我不会让你一个人回去。"(直追)',  next: 'n03_battle', effects: { stats: { courage: 3, mercy: 1 }, flags: ['brother_lost', 'brother_returned'] } },
      { text: '"我先把弟弟的去向告知林,再追。"(通报林)', next: 'n03_lin', effects: { stats: { reason: 2 }, flags: ['brother_lost'] } },
      { text: '"弟弟是为了我。我……我累了。"(放弃)',   next: 'n03_giveup', effects: { stats: { wild: 1 }, flags: ['abandoned_quest', 'brother_lost'] } },
    ],
  },
  {
    id: 'n03_battle',
    kind: 'battle',
    chapter: 12,
    text: `你沿弟弟的脚印直冲圣心坛外围。

四个教团守卫从山岩后转出,挡住去路。

"火种的兄长?"为首者冷笑,"教主说了,你来,也一并送祭。"

你拔剑。

(战斗开始)`,
    enemyPool: 'ch12',
    victory_next: 'n04',
    defeat_next: 'n04',
  },
  {
    id: 'n03_lin',
    kind: 'narrative',
    chapter: 12,
    text: `你找到林,告诉他弟弟主动回了圣心坛。

林脸色一变:"那孩子——"他低声,"他是想替你死。圣心坛真正的祭典,十五后月圆,就在今夜。我们必须赶到。"

两人一同上路。`,
    next: 'n04',
    effects: { flags: ['shared_path', 'brother_returned'] },
  },
  {
    id: 'n03_giveup',
    kind: 'narrative',
    chapter: 12,
    text: `你跪在山岩前,很久很久。

弟弟为了你,主动回祭坛送死。你没能护住他。你想起赫尔墨的话,想起父亲守的"约",想起母亲的白发……

你站不起来。你独自坐在山道上,直到天黑。

风掀起你的衣角。剑在你身边,但你没有再握。`,
    next: 'n04_giveup',
  },
  {
    id: 'n04',
    kind: 'narrative',
    chapter: 12,
    text: `无论那场遭遇如何,你终于冲到圣心坛外围。

祭坛深处传来吟唱,你听见了弟弟的声音——不是哭喊,而是平静的低语,像是在念一段古老的祷词。

"……哥哥,我听见旧神在喊我。但我不害怕。我选择,不变成它。"

你冲进祭坛。`,
    next: 'n05',
    effects: { flags: ['brother_returned'] },
  },
  {
    id: 'n04_giveup',
    kind: 'choice',
    chapter: 12,
    text: `你坐在山道上。剑在身边,弟弟的脚印在岩前。

风很冷。你想起了赫尔墨,想起了父亲,想起了母亲,想起了弟弟塞进你口袋的木刻小鱼。

——这一步,决定你下一段旅程的方向。`,
    choices: [
      { text: '"不,我不能让他一个人死。"(追回弟弟)',  next: 'ch14:n01', effects: { stats: { courage: 3, mercy: 2 }, flags: ['direct_strike', 'brother_returned'] } },
      { text: '"我累了。回渔港,陪母亲。"(归隐)',     next: 'ch15:n01', effects: { stats: { wild: 1 }, flags: ['abandoned_quest'] } },
    ],
  },
  {
    id: 'n05',
    kind: 'choice',
    chapter: 12,
    text: `你冲进祭坛深处。

弟弟站在火柱前,周围是黑袍教徒。大祭司站在祭坛最高处,白须白袍,手中捧着一把燃烧的圣剑。

"火种已就位。"大祭司宣诵,"旧神,苏醒吧!"

弟弟转头看见你,眼里有光,也有泪。

——这一步,决定你下一段旅程的方向。`,
    choices: [
      { text: '"弟弟,我来救你!大祭司,受死!"(直取大祭司)', next: 'ch14:n01', effects: { stats: { courage: 3, wild: 2 }, flags: ['direct_strike'] } },
      { text: '"先念圣典残页揭穿伪神!"(揭穿)',         next: 'ch14:n01', effects: { stats: { reason: 3, courage: 1 }, flags: ['exposed_church', 'direct_strike'] } },
    ],
  },
];

export const CHAPTER_12 = {
  id: 'ch12',
  title: '第十二章 · 弟弟失踪',
  start: 'n01',
  nodes: new Map(nodes.map((n) => [n.id, n])),
};
