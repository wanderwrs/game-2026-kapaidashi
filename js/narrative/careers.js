/**
 * careers.js — 6 个冒险少年职业定义。
 * 主题:中世纪 / 宗教 / 龙族 / 飞行 / 远洋冒险。
 * 每个职业:背景故事 + 起始牌组 + 特色卡 + 关键数值。
 *
 * 卡组 ID 必须能在 data.js CARDS 里找到,或为本职业特色卡(此处扩展)。
 */

export const CAREERS = [
  {
    id: 'swordsman',
    name: '剑术学徒',
    title: '钢铁之誓',
    color: '#c0392b',
    icon: '⚔',
    maxHp: 75,
    energyMax: 3,
    mpMax: 2,
    backstory: '你出身于王国边境的铁匠世家,自幼在锤声与火星中长大。十二岁那年,一头黑龙焚毁了你的村庄,你被剑术大师收养,在冰原剑塔中磨砺十年。如今剑塔倾颓,你背起父亲的旧剑,踏上寻找弟弟与归乡的路。',
    starterDeck: ['strike', 'strike', 'strike', 'defend', 'defend', 'cleave', 'shield_bash', 'pommel'],
    signatureCards: ['riposte', 'iron_will'],
  },
  {
    id: 'mage',
    name: '魔法学徒',
    title: '星图执笔',
    color: '#8e44ad',
    icon: '✦',
    maxHp: 60,
    energyMax: 4,
    mpMax: 6,
    backstory: '你是神学院最年轻的星象学徒,能从夜空中读出命运轨迹。当大祭司以"净化"之名焚毁古籍、拘押异端孩童时,你抱着一卷被禁的星图逃离学院。星图指向龙脊山脉,那里藏着揭开真相的钥匙,也指向你失散的弟弟。',
    starterDeck: ['strike', 'defend', 'insight', 'insight', 'arcane_bolt', 'arcane_bolt', 'flex', 'recover'],
    signatureCards: ['arcane_bolt', 'starfall'],
  },
  {
    id: 'cavalier',
    name: '骑兵新兵',
    title: '风行之蹄',
    color: '#27ae60',
    icon: '♞',
    maxHp: 80,
    energyMax: 3,
    mpMax: 2,
    backstory: '你是王国骑兵团的弃儿,因身世不洁被逐出军营。马背上长大的你,带着一匹受伤的军马流落乡野。当你听说弟弟被"龙脊教团"掳走,便策马踏上漫漫寻亲路。马蹄踏过的每一寸土地,都在替你丈量正义的距离。',
    starterDeck: ['strike', 'strike', 'strike', 'defend', 'charge', 'charge', 'pommel', 'defend'],
    signatureCards: ['charge', 'trample'],
  },
  {
    id: 'aviator',
    name: '飞行学徒',
    title: '云端之翼',
    color: '#3498db',
    icon: '✈',
    maxHp: 65,
    energyMax: 3,
    mpMax: 3,
    backstory: '你生于云端浮岛族,自幼与风鸥为伴。弟弟被龙带走的那个黄昏,你跌下浮岛,被飞行学院收留。如今你以学徒之身驾驭初阶风翼,在云层之间追踪那道焚天的赤红龙影。天空是你的家,也是你寻回弟弟的唯一路径。',
    starterDeck: ['strike', 'defend', 'dive', 'dive', 'insight', 'defend', 'cleave', 'flex'],
    signatureCards: ['dive', 'gust'],
  },
  {
    id: 'mariner',
    name: '航海学徒',
    title: '盐风之子',
    color: '#16a085',
    icon: '⚓',
    maxHp: 70,
    energyMax: 3,
    mpMax: 3,
    backstory: '你出生于远洋渔家,父亲死于一场突如其来的海妖之乱。母亲改嫁后,继父将弟弟卖给龙脊教团做祭品。你逃离家门,登上商船当杂役,横渡墨色之海。每一道浪都在问你:为了寻回弟弟,你愿意潜入多深的海。',
    starterDeck: ['strike', 'strike', 'defend', 'defend', 'tide', 'tide', 'recover', 'insight'],
    signatureCards: ['tide', 'tsunami'],
  },
  {
    id: 'theologian',
    name: '神学学徒',
    title: '烛火之间',
    color: '#f1c40f',
    icon: '✟',
    maxHp: 65,
    energyMax: 3,
    mpMax: 5,
    backstory: '你是大教堂最虔诚的烛火学徒,每日为神像擦拭金箔。直到某夜,你听见神像背后传来弟弟的哭声——他被作为"献祭"封入圣坛。你撕下修士袍,带着偷出的圣典残页,踏上揭穿教团伪神的路。信仰不是枷锁,而是你出鞘的剑。',
    starterDeck: ['strike', 'defend', 'defend', 'bless', 'bless', 'insight', 'recover', 'pommel'],
    signatureCards: ['bless', 'judgement'],
  },
];

export const CAREER_MAP = Object.fromEntries(CAREERS.map((c) => [c.id, c]));
