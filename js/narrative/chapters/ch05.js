/**
 * ch05.js — 第五章 · 屠龙少年(首战黑龙)
 * 节拍:潜入圣心坛外围 → 与幼年黑龙相遇 → 揭露弟弟真身 → 抉择屠龙或饶龙
 * 战斗:1 场(幼年黑龙)
 * 关键 flag:killed_dragon(屠龙)、spared_dragon(饶龙)
 */

const nodes = [
  {
    id: 'n01',
    kind: 'narrative',
    chapter: 5,
    text: `你沿山道攀了三日,终于望见双子峰之间的圣心坛。

那是一座用黑曜石垒成的祭坛,祭坛中央燃着一团永不熄灭的赤红火柱。火柱旁,一群黑袍教徒正在吟唱。而在火柱的阴影里,蜷着一头幼年黑龙——颈上的鳞片还带着胎羽的湿润,眼睛却已经透出成年龙才有的狡黠。

你认出来了:那双眼睛,和你梦里弟弟的眼睛,一模一样。`,
    next: 'n02',
  },
  {
    id: 'n02',
    kind: 'narrative',
    chapter: 5,
    text: `你伏在祭坛外的岩缝里,听见教徒的吟唱渐渐升高。

"……火种已就位……旧神将苏醒于十五后的月圆……"

一个白须长老走上祭坛,手里捧着一个布袋。布袋在动,里面是一个孩子。你认出那是弟弟的衣角——你母亲缝的小鱼图案。

长老把布袋递向黑龙。黑龙低头嗅了嗅,然后——

然后,黑龙开口说话了。

"哥哥?"它的声音稚嫩而颤抖,"哥哥,是你吗?"`,
    next: 'n03',
  },
  {
    id: 'n03',
    kind: 'choice',
    chapter: 5,
    text: `黑龙——你的弟弟——转头望向你藏身的岩缝。

"哥哥,我知道你在那。我闻得到你身上的盐味和铁味。"

长老们也听见了,纷纷转头。吟唱停滞了一瞬。

"火种已通灵智。"长老大惊,"必须立即完成苏醒!"

黑龙痛苦地嘶吼了一声,颈上的鳞片开始发烫发红。它不是想变成龙——它是被逼着变成龙。

你想起了母亲的话:"他不是你父亲亲生的。十六年前,龙脊教团送来一个婴孩,说是火种。"

你想起了赫尔墨的话:"剑是用来决定——你想成为谁。"

现在,轮到你决定:你想成为谁?`,
    choices: [
      { text: '"弟弟!我来救你!"(冲上祭坛,斩断教徒)',   next: 'n04_battle_cult', effects: { stats: { courage: 3, mercy: 1 } } },
      { text: '"……弟弟,对不起。"(拔剑,直取黑龙)',     next: 'n04_battle_dragon', effects: { stats: { courage: 2, reason: 1 }, flags: ['killed_dragon'] } },
      { text: '"停下!我不许你们逼他!"(挡在黑龙身前)',   next: 'n04_shield', effects: { stats: { mercy: 3, courage: 1 }, flags: ['spared_dragon'] } },
    ],
  },
  {
    id: 'n04_battle_cult',
    kind: 'battle',
    chapter: 5,
    text: `你跃上祭坛,一剑劈向最近的长老!

"护坛!"长老们纷纷拔出藏在袍中的短刃。黑龙痛苦地嘶吼,鳞片越发发红,但它的眼睛一直跟着你。

(战斗开始)`,
    enemyPool: 'ch05',
    victory_next: 'n05',
    defeat_next: 'n05',
  },
  {
    id: 'n04_battle_dragon',
    kind: 'battle',
    chapter: 5,
    text: `你跃上祭坛,一剑直取黑龙的心口!

"哥哥——"黑龙的眼睛里满是错愕。它没有躲。它不愿躲。

长老们狂笑:"火种自灭,旧神永眠!——杀了他!"

(战斗开始)`,
    enemyPool: 'ch05',
    victory_next: 'n05_kill',
    defeat_next: 'n05_kill',
  },
  {
    id: 'n04_shield',
    kind: 'battle',
    chapter: 5,
    text: `你跃上祭坛,挡在黑龙和长老之间!

"你们休想逼他!"

长老们脸色一变:"……火种的兄长?教主说了,凡是挡路的,一并送祭。"

他们拔出短刃,围了上来。

(战斗开始)`,
    enemyPool: 'ch05',
    victory_next: 'n05_spare',
    defeat_next: 'n05_spare',
  },
  {
    id: 'n05',
    kind: 'narrative',
    chapter: 5,
    text: `长老们倒下了。

黑龙痛苦地蜷在祭坛中央,鳞片还在发烫。它抬起头,望着你,眼里有泪。

"哥哥……我没想变成龙……他们逼我……"

你冲过去,抱住它的颈。它还在颤抖。火柱的光在你身后跳动。

"我们走。"你说,"回家。"

黑龙——你的弟弟——把头埋进你怀里,哭得像个孩子。`,
    next: 'n06',
    effects: { flags: ['spared_dragon', 'found_brother'] },
  },
  {
    id: 'n05_kill',
    kind: 'narrative',
    chapter: 5,
    text: `黑龙倒在祭坛上,血浸湿了黑曜石。

你跪在它身边,握着"守约"。剑上沾着你弟弟的血。

长老们狂笑:"火种自灭,旧神永眠!你帮了我们大忙,屠龙者!"

你低下头,很久很久。然后你站起来,一剑斩向还在狂笑的长老。

火柱熄灭了。祭坛空了。你独自站在血泊里,怀里揣着弟弟的木刻小鱼,和母亲那枚银坠。

它们再也不会相碰了。`,
    next: 'n06_kill',
    effects: { flags: ['killed_dragon', 'abandoned_quest'] },
  },
  {
    id: 'n05_spare',
    kind: 'narrative',
    chapter: 5,
    text: `长老们倒下了。

你转身抱住黑龙。它已经发烫得不能碰,但它的眼睛是清醒的。

"哥哥……我没想变龙……"

"我知道。"你抱紧它,"我们走。回家。"

黑龙——你的弟弟——把头埋进你怀里。火柱在身后跳动,但没有再催它苏醒。`,
    next: 'n06',
    effects: { flags: ['spared_dragon', 'found_brother'] },
  },
  {
    id: 'n06',
    kind: 'choice',
    chapter: 5,
    text: `你带着弟弟下了山。

弟弟还不能完全变回人形——他时而化龙,时而化人,每次化龙都痛苦得发抖。但他紧紧跟着你,一步都不肯落下。

走到山脚,你遇见了林——那个和你同行的少年。他看见你身边的弟弟,先是一惊,然后笑了。

"你做到了。"他说,"但教团不会善罢甘休。大祭司还在圣心坛深处,真正的祭典十五后才举行。"

"而且……"他压低声音,"我看见教团在抓另一批孩子。我们要不要救他们?"`,
    choices: [
      { text: '"先安顿弟弟,再去救其他孩子。"(收养弟弟)', next: 'ch06:n01', effects: { stats: { mercy: 2, reason: 1 }, flags: ['adopted_brother'] } },
      { text: '"先救孩子,弟弟我带着。"(继续冒险)',     next: 'ch13:n01', effects: { stats: { courage: 2, mercy: 2 }, flags: ['saved_village'] } },
      { text: '"直接杀回圣心坛,了结大祭司。"(直取祭典)',  next: 'ch14:n01', effects: { stats: { courage: 3, wild: 1 }, flags: ['direct_strike'] } },
    ],
  },
  {
    id: 'n06_kill',
    kind: 'narrative',
    chapter: 5,
    text: `你独自下了山。

走到山脚,你遇见了林——那个和你同行的少年。他看见你空着的手,先是一惊,然后沉默了很久。

"……你做了你以为对的事。"他终于开口,"但弟弟已经回不来了。"

"圣心坛真正的祭典十五后才举行。大祭司还在深处。"

他转身走了,没有再回头。你独自站在山道上,风掀起你的衣角。`,
    next: 'n07_kill',
  },
  {
    id: 'n07_kill',
    kind: 'choice',
    chapter: 5,
    text: `你握着"守约",剑上还沾着弟弟的血。

前方是圣心坛,大祭司在等你。后方是来时的路,可以归隐,可以遗忘。

你想起了赫尔墨的话:"剑是用来决定——你想成为谁。"`,
    choices: [
      { text: '"我屠了弟弟,不能让大祭司再害人。"(直取祭典)', next: 'ch14:n01', effects: { stats: { courage: 3, reason: 1 }, flags: ['direct_strike'] } },
      { text: '"……我累了。回家吧。"(归隐)',               next: 'ch15:n01', effects: { stats: { wild: 1 }, flags: ['abandoned_quest'] } },
    ],
  },
];

export const CHAPTER_05 = {
  id: 'ch05',
  title: '第五章 · 屠龙少年',
  start: 'n01',
  nodes: new Map(nodes.map((n) => [n.id, n])),
};
