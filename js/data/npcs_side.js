/**
 * npcs_side.js — 支线触发 NPC(第 5 批: npc_side1~npc_side6)。
 *
 * 这批 NPC 不同于普通随机路人:每位携带一个 quest 字段,在交谈面板中
 * 额外提供一个「任务」按钮,点击后跳转到对应支线章节(sq1~sq6)。
 *
 * quest 字段说明:
 *   text        NPC 任务对话引导语(显示在接受按钮上方)
 *   accept      接受按钮的文本(点击触发 ui:npc-quest 事件)
 *   decline     拒绝按钮的文本(仅作占位,关闭对话等同拒绝)
 *   sideChapter 接受后跳转的支线章节 id(如 'sq1')
 *   reqFlag     触发所需的前置 flag(null 表示无前置;未满足则不显示任务按钮)
 *   doneFlag    支线完成后由 effects.flags 设置的标记;持有时按钮变灰禁用,
 *               避免重复触发。支线不影响主线进度(不调 markChapterCleared、不发谢仪)。
 *
 * 6 位 NPC 分布在第三章 6 个地图点对应的地形,主题与龙族相关,
 * 作为 sq1~sq6 支线的入口占位数据,后续可调整台词与地形。
 */
export const NPCS_SIDE = [
  {
    id: 'npc_side1',
    name: '失落的龙语者',
    tag: '神秘学者',
    where: ['sky', 'village', 'mountain', 'forest'],
    region: ['ch28', 'ch29'],   // 地图点1: 世界之缘
    replies: {
      greet: [
        '你踩到的不是石板,是一段被埋掉的碑文。',
        '龙语不是给人念的,可你这双眼睛倒像见过点什么。',
      ],
      local: [
        '废墟底下还压着一整座祭坛,没人敢动。',
        '风从断层里钻出来,吹得碑上的字都像在念。',
      ],
      rumor: [
        '听说有人把龙骨当柴烧,烧完那晚整片废墟都在响。',
        '前些年有人来拓碑,第二天就疯了。',
      ],
      self: [
        '我守了这块碑四十年,念得出每个字的回音。',
        '我识字不多,但龙语只认我。',
      ],
    },
    quest: {
      text: '我有一桩旧事,想请你帮忙——',
      accept: '「我在听。」(开启支线:失落的龙语者)',
      decline: '「下次再说。」',
      sideChapter: 'sq1',
      reqFlag: null,
      doneFlag: 'sq1_done',
    },
  },
  {
    id: 'npc_side2',
    name: '龙血后裔',
    tag: '隐居武士',
    where: ['ruins', 'mountain'],
    region: ['ch30', 'ch31'],   // 地图点2: 灰烬村 / 龙迹山谷
    replies: {
      greet: [
        '山道不好走,你身上却没半点喘。',
        '你这身板,倒像是在高处住惯了的。',
      ],
      local: [
        '再往上就是龙脊,没人带路你走不下来。',
        '垭口那头的雪,常年是红的。',
      ],
      rumor: [
        '听说教团在山下又抓了一批孩子,说是要选祭品。',
        '龙脊背后有人点着火把,整夜不灭。',
      ],
      self: [
        '我祖母是龙脊上的人,我血管里有一半是热的。',
        '我守这山,不是为谁,是为她留下的那把刀。',
      ],
    },
    quest: {
      text: '我祖母留下的东西,还压在山那头——',
      accept: '「我替你取回来。」(开启支线:龙血后裔)',
      decline: '「山路太险,改日。」',
      sideChapter: 'sq2',
      reqFlag: null,
      doneFlag: 'sq2_done',
    },
  },
  {
    id: 'npc_side3',
    name: '古代守卫',
    tag: '沉默剑士',
    where: ['city', 'port', 'ruins'],
    region: ['ch32', 'ch33'],   // 地图点3: 耶鲁贺图尔领地
    replies: {
      greet: [
        '林子里不该有人声,你且站住。',
        '我这把剑已经很久没出鞘,你别让我破例。',
      ],
      local: [
        '这片林子底下,埋着不让人进的东西。',
        '往深处走,你会看到不该看的东西。',
      ],
      rumor: [
        '听说有人在林中挖出过整副盔甲,戴上就再没取下来。',
        '夜里林子会自己动,连鸟都不敢叫。',
      ],
      self: [
        '我守这片林子比你这辈子还长。',
        '我不替谁守,只替一个不能再开口的人。',
      ],
    },
    quest: {
      text: '我守的东西,到了该交出去的时候——',
      accept: '「我接。」(开启支线:古代守卫)',
      decline: '「我担不起。」',
      sideChapter: 'sq3',
      reqFlag: null,
      doneFlag: 'sq3_done',
    },
  },
  {
    id: 'npc_side4',
    name: '鳞衣巫女',
    tag: '洞中祭司',
    where: ['ruins'],
    region: ['ch34','ch35','ch36','ch37','ch38','ch39','ch40','ch41'],   // 地图点4: 远古洞穴
    replies: {
      greet: [
        '你手上没有灯,却走得比我熟。',
        '洞里没有白天,你来做什么?',
      ],
      local: [
        '这洞底下有水,水里映着的东西不一定是你自己。',
        '再深一些就是封住的旧殿,没人回得来。',
      ],
      rumor: [
        '听说洞里那口泉,喝一口就能听见龙在哭。',
        '前些日子有人进来,只找回了一双鞋。',
      ],
      self: [
        '我生在洞里,也将死在洞里,这是规矩。',
        '我身上长着鳞,你看见了别喊。',
      ],
    },
    quest: {
      text: '泉眼底下封着一段心事,我替人守了很久——',
      accept: '「我去看看。」(开启支线:鳞衣巫女)',
      decline: '「水太深,我不沾。」',
      sideChapter: 'sq4',
      reqFlag: null,
      doneFlag: 'sq4_done',
    },
  },
  {
    id: 'npc_side5',
    name: '云上牧人',
    tag: '风之行者',
    where: ['mountain', 'sky'],
    region: ['ch42', 'ch43'],   // 地图点5: 龙脊古道
    replies: {
      greet: [
        '你怎么上来的?这地方风大,留神脚下。',
        '云上不收过路人,你倒是个例外。',
      ],
      local: [
        '这片云原上没有路,只有风向。',
        '再往高处,连鸟都飞不动了。',
      ],
      rumor: [
        '听说云上有只走丢的龙崽,整夜在叫。',
        '前些天有人从云上掉下来,身上没有一处是完整的。',
      ],
      self: [
        '我在云上牧风已经三十年。',
        '我认得每一片云的脾气。',
      ],
    },
    quest: {
      text: '云原尽头有一头老龙,它认得我——',
      accept: '「我陪你去。」(开启支线:云上牧人)',
      decline: '「我恐高。」',
      sideChapter: 'sq5',
      reqFlag: null,
      doneFlag: 'sq5_done',
    },
  },
  {
    id: 'npc_side6',
    name: '故土游魂',
    tag: '归乡之人',
    where: ['ruins', 'sky'],
    region: ['ch44','ch45','ch46','ch47'],   // 地图点6: 龙堡遗迹
    replies: {
      greet: [
        '这片地我认得,可它认不得我了。',
        '你脚下的土,先前是我的家。',
      ],
      local: [
        '这一带土地空了,连野草都长不齐。',
        '往北走是旧田,犁头还在地里。',
      ],
      rumor: [
        '听说有人在旧田里翻出了一具没腐烂的尸,脸上还带着笑。',
        '夜里能听见地底下有人在念名字。',
      ],
      self: [
        '我死过一次,又走回来了,为的是把一件事办完。',
        '我不是活人,但我也没走。',
      ],
    },
    quest: {
      text: '我有一桩没办完的事,想托付给你——',
      accept: '「你说。」(开启支线:故土游魂)',
      decline: '「亡者之事,我不掺和。」',
      sideChapter: 'sq6',
      reqFlag: null,
      doneFlag: 'sq6_done',
    },
  },
];
