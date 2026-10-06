/**
 * regions.js — 地区地图与剧情锚点。
 *
 * 每个大章 = 一个「地区」，地区内 3 个「地点」(stop)。
 * 剧情节拍按地点分段:玩家必须在地图上抵达某个地点(找到该处的 NPC),
 * 才能开启下一段剧情 —— 即 stops[i].node 是段落起始节点,也是门控锚点。
 *
 * stops[].services:该地点提供的服务(商店 / 打工 / 休息)
 * stops[].npc:该地点的关键人物(可为 null)
 *
 * 旅行:任意两地点之间可通行,消耗行动力 = 距离 × TRAVEL_BASE_COST − 载具折扣(至少 1)。
 */

export const TRAVEL_BASE_COST = 2;

export const REGIONS = {
  ch01: {
    name: '灰石谷地', theme: 'village',
    stops: [
      { key: 'home', name: '焚毁的家园', theme: 'village', npc: null, node: 'n01', hint: '家已成焦土。整理行装,准备上路。', services: { shop: true, job: true } },
      { key: 'fork', name: '北道岔口', theme: 'forest', npc: '赫尔墨', node: 'n05', hint: '沿北道向北,去岔路口寻找那位白须老人。', services: { } },
      { key: 'camp', name: '山脚哨站', theme: 'mountain', npc: '哨兵', node: 'n10', hint: '继续北上,抵达龙脊山脚的教团哨站。', services: { job: true } },
    ],
  },
  ch02: {
    name: '边境北道', theme: 'forest',
    stops: [
      { key: 'hamlet', name: '边境荒村', theme: 'village', npc: null, node: 'n01', hint: '在边境荒村歇脚,补给后继续北上。', services: { shop: true, job: true } },
      { key: 'inn', name: '雨夜孤驿', theme: 'forest', npc: '驿丞', node: 'n04', hint: '夜雨将至,去孤驿找驿丞避雨。', services: { shop: true } },
      { key: 'pass', name: '山脚哨站', theme: 'mountain', npc: '同路人·林', node: 'n07', hint: '翻过山脊,在山脚哨站寻访那名出逃的少年。', services: { } },
    ],
  },
  ch02b: {
    name: '废弃矿镇', theme: 'ruins',
    stops: [
      { key: 'gate', name: '矿镇栅门', theme: 'ruins', npc: null, node: 'n01', hint: '绕到废弃矿镇,从镇口的栅门摸进去。', services: { shop: true, job: true } },
      { key: 'shaft', name: '废矿井口', theme: 'mountain', npc: '守矿人', node: 'n06', hint: '到废矿井口,寻访那位还守着绞车的老矿工。', services: { } },
      { key: 'tunnel', name: '地下矿道', theme: 'ruins', npc: null, node: 'n11', hint: '钻进地下矿道,从山脊北口出去。', services: { job: true } },
    ],
  },
  ch03: {
    name: '王畿三城', theme: 'city',
    stops: [
      // ===== 第一主城:王城 =====
      { key: 'gate', name: '王城城门', theme: 'city', npc: null, node: 'n01', hint: '入王城,先在城门一带落脚。', services: { shop: true, job: true } },
      { key: 'market', name: '王城集市', theme: 'city', npc: null, node: null, hint: '王城最大的集市,各色货品云集。', services: { shop: true, job: true } },
      { key: 'manor', name: '旧友宅邸', theme: 'city', npc: '洛恩', node: 'n04', hint: '按父亲留下的名字,去旧友洛恩的宅邸求见。', services: { } },
      { key: 'alley', name: '王城暗巷', theme: 'city', npc: null, node: 'n06', hint: '追查刺客的线索,深入王城暗巷。', services: { job: true } },
      { key: 'square', name: '王城广场', theme: 'city', npc: null, node: null, hint: '王城的中心广场,双头鹰旗猎猎作响。', services: { shop: true } },
      { key: 'dock', name: '王城码头', theme: 'port', npc: null, node: null, hint: '王城的内河码头,往来商船络绎不绝。', services: { shop: true, job: true } },
      // ===== 第二主城:双子城 =====
      { key: 'post', name: '官道驿站', theme: 'village', npc: null, node: null, hint: '王畿官道上的驿站,是前往双子城的歇脚处。', services: { shop: true } },
      { key: 'twin_east', name: '双子城东市', theme: 'city', npc: null, node: null, hint: '双子城的东市,商贾云集。', services: { shop: true, job: true } },
      { key: 'twin_tower', name: '双子城钟塔', theme: 'city', npc: null, node: null, hint: '双子城的地标——双生钟塔。', services: { } },
      { key: 'twin_tavern', name: '双子城酒馆', theme: 'city', npc: null, node: null, hint: '城中最热闹的酒馆,消息灵通。', services: { shop: true, job: true } },
      { key: 'twin_lock', name: '双子城水闸', theme: 'port', npc: null, node: null, hint: '扼守运河的双子城水闸。', services: { job: true } },
      // ===== 第三主城:云顶城 =====
      { key: 'pass', name: '山道哨卡', theme: 'mountain', npc: null, node: null, hint: '通往云顶城的山道哨卡。', services: { } },
      { key: 'cloud_gate', name: '云顶城山门', theme: 'city', npc: null, node: null, hint: '云顶城的山门,云雾缭绕。', services: { shop: true } },
      { key: 'cloud_altar', name: '云顶城祭坛', theme: 'city', npc: null, node: null, hint: '云顶城的祭祀祭坛。', services: { } },
      { key: 'cloud_armory', name: '云顶城军械库', theme: 'city', npc: null, node: null, hint: '云顶城的军械库,重兵把守。', services: { shop: true, job: true } },
      { key: 'cloud_observatory', name: '云顶城观星台', theme: 'sky', npc: null, node: null, hint: '云顶城最高处的观星台。', services: { } },
      { key: 'ruins', name: '城郊废村', theme: 'ruins', npc: null, node: null, hint: '王畿城郊的废弃村落,似有蹊跷。', services: { job: true } },
    ],
  },
  ch04: {
    name: '南方渔港', theme: 'port',
    stops: [
      { key: 'quay', name: '渔港码头', theme: 'port', npc: null, node: 'n01', hint: '回到盐风扑面的渔港,先上码头打听。', services: { shop: true, job: true } },
      { key: 'shack', name: '渔家老屋', theme: 'port', npc: '母亲', node: 'n04', hint: '循着旧记忆,找到那间渔家老屋。', services: { } },
      { key: 'reef', name: '港外礁岸', theme: 'port', npc: null, node: 'n06', hint: '顺潮声走向港外礁岸,了结旧账。', services: { job: true } },
    ],
  },
  // ===== 第四章 · 支线地区「潮生镇」(沿海盐镇,风土:赶潮市 / 晒盐 / 放海灯) =====
  // 37% 交叉:5 个地点中 2 个复用前三章(官道驿站 ch03、旧友宅邸 ch03),
  //           5 个关键人物中 2 个复用前三章(驿丞 ch02、同路人·林 ch02)。
  ch04b: {
    name: '潮生镇', theme: 'port',
    stops: [
      { key: 'post', name: '官道驿站', theme: 'village', npc: '驿丞', node: 'n01', hint: '沿官道南下,先在这处驿站歇脚,向驿丞打听潮生镇。', services: { shop: true } },
      { key: 'tide', name: '退潮市', theme: 'port', npc: '潮生', node: 'n03', hint: '等潮水退尽,赶海人的集市才在滩上支起来。', services: { shop: true, job: true } },
      { key: 'salt', name: '白盐田', theme: 'port', npc: '晒盐婆', node: 'n05', hint: '镇北的白盐田里,守着盐畦的老妇知道海上的旧事。', services: { job: true } },
      { key: 'wreck', name: '沉船滩', theme: 'port', npc: '同路人·林', node: 'n07', hint: '退潮后沉船的残骸露出滩面——有人约你在那里碰头。', services: { } },
      { key: 'manor', name: '旧友宅邸', theme: 'port', npc: '老管家', node: 'n09', hint: '循着银坠上的印记,找到那处临海的旧友宅邸。', services: { } },
    ],
  },
  ch05: {
    name: '圣心坛外围', theme: 'mountain',
    stops: [
      { key: 'camp', name: '雪线营地', theme: 'mountain', npc: null, node: 'n01', hint: '在雪线扎营,准备潜入圣心坛。', services: { shop: true, job: true } },
      { key: 'pass', name: '坛外密道', theme: 'cliff', npc: null, node: 'n02', hint: '沿冰隙摸进坛外密道。', services: { } },
      { key: 'steps', name: '坛前石阶', theme: 'mountain', npc: '幼年黑龙', node: 'n05', hint: '登上坛前石阶,直面那头幼龙。', services: { } },
    ],
  },
  // ===== 第五章 · 支线地区「雪脊商驿」(翻山商道,风土:煨桑 / 换命绳 / 雪盲哨铃) =====
  // 37% 交叉:5 个地点中 2 个复用前三章(山道哨卡 ch03、山脚哨站 ch01),
  //           5 个关键人物中 2 个复用前三章(哨兵 ch01、同路人·林 ch02)。
  ch05b: {
    name: '雪脊商驿', theme: 'mountain',
    stops: [
      { key: 'check', name: '山道哨卡', theme: 'mountain', npc: '哨兵', node: 'n01', hint: '翻过山脊的第一道哨卡,守卡的老兵认得这条路。', services: { shop: true } },
      { key: 'sang', name: '煨桑垭口', theme: 'cliff', npc: '煨桑僧', node: 'n03', hint: '垭口上终年煨着松柏枝——商队过关前都要添一把。', services: { } },
      { key: 'bell', name: '雪盲哨', theme: 'mountain', npc: '铃婆', node: 'n05', hint: '雪雾最浓处挂着引路的铜铃,摇铃的老妇守在那里。', services: { } },
      { key: 'rope', name: '换命栈', theme: 'mountain', npc: '商队头人', node: 'n07', hint: '换命栈上,翻山的人互换绳结,互为担保。', services: { job: true } },
      { key: 'foot', name: '山脚哨站', theme: 'mountain', npc: '同路人·林', node: 'n09', hint: '下了垭口,山脚的旧哨站里有人在等你。', services: { shop: true, job: true } },
    ],
  },
  ch06: {
    name: '山中村舍', theme: 'village',
    stops: [
      { key: 'hut', name: '山间村舍', theme: 'village', npc: null, node: 'n01', hint: '在此安顿弟弟,喘一口气。', services: { shop: true, job: true } },
      { key: 'edge', name: '村外林缘', theme: 'forest', npc: null, node: 'n02', hint: '教团追兵逼近,出村到林缘戒备。', services: { } },
      { key: 'post', name: '追兵哨位', theme: 'forest', npc: null, node: 'n04', hint: '循着脚印,找到教团追兵的哨位。', services: { job: true } },
    ],
  },
  ch07: {
    name: '迷心林', theme: 'forest',
    stops: [
      { key: 'mouth', name: '林口', theme: 'forest', npc: null, node: 'n01', hint: '入林的唯一入口,就在眼前。', services: { shop: true, job: true } },
      { key: 'deep', name: '林深处', theme: 'forest', npc: null, node: 'n02', hint: '循着林间微光,往更深处走。', services: { } },
      { key: 'eye', name: '妖精阵眼', theme: 'forest', npc: '林地妖精', node: 'n04', hint: '找到困住你们的阵眼,那里守着林地的妖精。', services: { } },
    ],
  },
  ch08: {
    name: '剑塔遗址', theme: 'mountain',
    stops: [
      { key: 'plain', name: '塔下荒原', theme: 'mountain', npc: null, node: 'n01', hint: '穿过荒原,走向倾颓的剑塔。', services: { shop: true, job: true } },
      { key: 'door', name: '塔门', theme: 'ruins', npc: null, node: 'n02', hint: '推开积灰的塔门。', services: { } },
      { key: 'room', name: '剑诀石室', theme: 'ruins', npc: '守塔人', node: 'n05', hint: '沿旋梯下到石室,寻访守塔人。', services: { } },
    ],
  },
  ch09: {
    name: '云端浮岛', theme: 'sky',
    stops: [
      { key: 'dock', name: '浮岛码头', theme: 'sky', npc: null, node: 'n00', hint: '风翼降落在浮岛码头。', services: { shop: true, job: true } },
      { key: 'trial', name: '风翼试炼场', theme: 'sky', npc: null, node: 'n02', hint: '前往风翼试炼场,证明你的胆量。', services: { } },
      { key: 'tower', name: '学院望楼', theme: 'sky', npc: '院长', node: 'n04', hint: '登上学院望楼,求见院长。', services: { } },
    ],
  },
  ch10: {
    name: '远洋学院', theme: 'port',
    stops: [
      { key: 'quay', name: '学院码头', theme: 'port', npc: null, node: 'n01', hint: '靠岸远洋学院码头。', services: { shop: true, job: true } },
      { key: 'chart', name: '海图室', theme: 'port', npc: null, node: 'n02', hint: '去海图室查阅远洋航线。', services: { } },
      { key: 'cape', name: '出海岬角', theme: 'cliff', npc: '老船长', node: 'n04', hint: '到出海岬角,找那位肯借船的老船长。', services: { } },
    ],
  },
  ch11: {
    name: '大典院', theme: 'city',
    stops: [
      { key: 'square', name: '圣殿广场', theme: 'city', npc: null, node: 'n01', hint: '混入圣殿广场,观察教团的宣讲。', services: { shop: true, job: true } },
      { key: 'booth', name: '思过室', theme: 'city', npc: '赎罪典士', node: 'n02', hint: '借思过的名义,接近那位动摇的典士。', services: { } },
      { key: 'vault', name: '藏典地下', theme: 'ruins', npc: null, node: 'n05', hint: '潜入藏典地下,取回古卷残页。', services: { job: true } },
    ],
  },
  ch12: {
    name: '山道密林', theme: 'forest',
    stops: [
      { key: 'mouth', name: '山道口', theme: 'forest', npc: null, node: 'n01', hint: '循着弟弟的踪迹,进山。', services: { shop: true, job: true } },
      { key: 'fork', name: '密林岔道', theme: 'forest', npc: null, node: 'n02', hint: '岔道上有新鲜的辙印,沿着它走。', services: { } },
      { key: 'camp', name: '追兵营地', theme: 'forest', npc: null, node: 'n04', hint: '摸到教团追兵的营地。', services: { job: true } },
    ],
  },
  ch13: {
    name: '被掳村庄', theme: 'ruins',
    stops: [
      { key: 'wall', name: '村口断墙', theme: 'ruins', npc: null, node: 'n01', hint: '翻过断墙,进入被洗劫的村庄。', services: { shop: true, job: true } },
      { key: 'altar', name: '村中石台', theme: 'ruins', npc: null, node: 'n02', hint: '循着哭声,走向村中的石台。', services: { } },
      { key: 'hall', name: '教团长老院', theme: 'ruins', npc: '教团长老', node: 'n05', hint: '闯进长老院,与教团长老对峙。', services: { } },
    ],
  },
  ch14: {
    name: '圣心坛', theme: 'mountain',
    stops: [
      { key: 'foot', name: '坛下', theme: 'mountain', npc: null, node: 'n01', hint: '最后的攀登,从坛下开始。', services: { shop: true, job: true } },
      { key: 'ring', name: '火柱环廊', theme: 'cliff', npc: null, node: 'n02', hint: '穿过燃烧的火柱环廊。', services: { } },
      { key: 'altar', name: '祭坛中央', theme: 'mountain', npc: '大祭司', node: 'n04', hint: '走向祭坛中央,面对大祭司。', services: { } },
    ],
  },
  ch15: {
    name: '王城广场', theme: 'city',
    stops: [
      { key: 'gate', name: '王城城门', theme: 'city', npc: null, node: 'n01', hint: '归城。城门在望。', services: { shop: true, job: true } },
      { key: 'square', name: '广场残垣', theme: 'city', npc: null, node: 'n02_battle', hint: '广场上有残党负隅顽抗。', services: { } },
      { key: 'tower', name: '钟楼', theme: 'city', npc: null, node: 'n03', hint: '登上钟楼,为这一程收束。', services: { } },
    ],
  },
  // ===== 第二大章 · 北境新程(4 节 · 共 10 个地图点) =====
  ch16: {
    name: '北境荒原', theme: 'mountain',
    stops: [
      { key: 'gate', name: '北境关隘', theme: 'mountain', npc: null, node: 'n01', hint: '穿过北境关隘,踏入人迹罕至的荒原。', services: { shop: true, job: true } },
      { key: 'ruin', name: '荒城断壁', theme: 'ruins', npc: '守关老兵', node: 'n04', hint: '荒原深处的断壁残垣里,有位老人记得旧事。', services: { } },
      { key: 'well', name: '枯水井', theme: 'ruins', npc: null, node: 'n06', hint: '枯井旁似乎藏着什么——但得先弄清楚状况。', services: { job: true } },
    ],
  },
  ch17: {
    name: '风蚀峡谷', theme: 'cliff',
    stops: [
      { key: 'mouth', name: '峡谷口', theme: 'cliff', npc: null, node: 'n01', hint: '风从峡谷深处灌出,卷起漫天黄沙。', services: { shop: true } },
      { key: 'ledge', name: '崖壁栈道', theme: 'cliff', npc: '峡谷向导', node: 'n03', hint: '栈道窄得仅容一人,那位向导说他能带你走过去。', services: { job: true } },
    ],
  },
  ch18: {
    name: '黑曜矿城', theme: 'ruins',
    stops: [
      { key: 'gate', name: '矿城正门', theme: 'ruins', npc: null, node: 'n01', hint: '黑曜矿城的正门半掩着——门后似有人在等你。', services: { shop: true, job: true } },
      { key: 'forge', name: '旧日锻炉', theme: 'ruins', npc: '矿工头领', node: 'n03', hint: '矿城深处的锻炉还在冒火星,矿工头领想跟你谈笔交易。', services: { } },
      { key: 'shaft', name: '黑曜矿井', theme: 'mountain', npc: null, node: 'n05', hint: '矿井最深处传来低沉的共鸣。', services: { job: true } },
    ],
  },
  ch19: {
    name: '龙骨荒原', theme: 'mountain',
    stops: [
      { key: 'bone', name: '巨龙骨堆', theme: 'mountain', npc: null, node: 'n01', hint: '荒原上散落着远古巨龙的骸骨,骨缝间藏着旧时代的秘密。', services: { shop: true } },
      { key: 'temple', name: '龙骨神庙', theme: 'ruins', npc: '守庙人', node: 'n03', hint: '骨堆尽头是一座以龙骨为梁的神庙,守庙人已等候多时。', services: { job: true } },
    ],
  },
  // ===== 第二大章 · 卡斯特罗城邦战争(ch20~ch27) =====
  ch20: {
    name: '边境要塞', theme: 'city',
    stops: [
      { key: 'gate', name: '要塞城门', theme: 'city', npc: null, node: 'n01', hint: '边境要塞的城门紧闭,城头的旗帜换了新的——卡斯特罗的黑鹰旗。', services: { shop: true, job: true } },
      { key: 'wall', name: '北城墙', theme: 'city', npc: '守将', node: 'n03', hint: '北城墙的守将似乎有话要说,但他身边全是卡斯特罗的耳目。', services: { } },
      { key: 'dungeon', name: '要塞地牢', theme: 'ruins', npc: null, node: 'n05', hint: '地牢深处传来熟悉的声音——那是被关押的友军。', services: { job: true } },
    ],
  },
  ch21: {
    name: '卡斯特罗前哨', theme: 'mountain',
    stops: [
      { key: 'camp', name: '敌军前营', theme: 'mountain', npc: null, node: 'n01', hint: '卡斯特罗的前营扎在山口,篝火连成一片。', services: { shop: true } },
      { key: 'ridge', name: '山脊观察哨', theme: 'cliff', npc: null, node: 'n03', hint: '攀上山脊,可以俯瞰敌军的全部部署。', services: { } },
      { key: 'cave', name: '山间暗道', theme: 'ruins', npc: '向导', node: 'n05', hint: '山间暗道直通敌后,但只有本地向导认得路。', services: { job: true } },
    ],
  },
  ch22: {
    name: '中立城邦', theme: 'city',
    stops: [
      { key: 'gate', name: '城邦大门', theme: 'city', npc: null, node: 'n01', hint: '中立城邦的大门向所有旅人敞开,但里面暗流涌动。', services: { shop: true, job: true } },
      { key: 'council', name: '议政厅', theme: 'city', npc: '执政官', node: 'n03', hint: '议政厅里,执政官正在权衡战与和。', services: { } },
      { key: 'market', name: '黑市巷', theme: 'city', npc: null, node: 'n05', hint: '黑市巷里什么都能买到——包括敌军的布防图。', services: { shop: true, job: true } },
    ],
  },
  ch23: {
    name: '联盟营地', theme: 'village',
    stops: [
      { key: 'tent', name: '联军大帐', theme: 'village', npc: null, node: 'n01', hint: '联军大帐里,各路将领争得面红耳赤。', services: { shop: true } },
      { key: 'heal', name: '医疗帐篷', theme: 'village', npc: '医疗长', node: 'n03', hint: '医疗帐篷里躺满了伤兵,医疗长急需帮手。', services: { } },
      { key: 'train', name: '演武场', theme: 'village', npc: null, node: 'n05', hint: '演武场上,新兵们正在操练——但他们需要一位真正的战士来带队。', services: { job: true } },
    ],
  },
  ch24: {
    name: '卡斯特罗主城', theme: 'city',
    stops: [
      { key: 'gate', name: '主城正门', theme: 'city', npc: null, node: 'n01', hint: '卡斯特罗的主城正门高耸入云,黑鹰旗在城头猎猎作响。', services: { shop: true, job: true } },
      { key: 'barracks', name: '军械库', theme: 'city', npc: null, node: 'n03', hint: '军械库里堆满了攻城器械——一旦开战,后果不堪设想。', services: { } },
      { key: 'keep', name: '城主堡', theme: 'city', npc: '卡斯特罗城主', node: 'n05', hint: '城主堡的主人,正是这场战争的始作俑者。', services: { } },
    ],
  },
  ch25: {
    name: '决战平原', theme: 'mountain',
    stops: [
      { key: 'line', name: '联军阵线', theme: 'mountain', npc: null, node: 'n01', hint: '联军阵线绵延数里,战旗在风中翻飞。', services: { shop: true } },
      { key: 'middle', name: '战场中央', theme: 'mountain', npc: null, node: 'n03', hint: '战场中央尸横遍野,但决战才刚刚开始。', services: { } },
      { key: 'hill', name: '指挥高地', theme: 'cliff', npc: null, node: 'n05', hint: '指挥高地上,可以看清整个战局的走向。', services: { job: true } },
    ],
  },
  ch26: {
    name: '卡斯特罗内城', theme: 'ruins',
    stops: [
      { key: 'breach', name: '城墙缺口', theme: 'ruins', npc: null, node: 'n01', hint: '城墙被轰开了一道缺口,联军正从这里涌入。', services: { shop: true } },
      { key: 'plaza', name: '中心广场', theme: 'ruins', npc: null, node: 'n03', hint: '中心广场上,敌军的精锐部队负隅顽抗。', services: { } },
      { key: 'tower', name: '黑鹰塔', theme: 'city', npc: null, node: 'n05', hint: '黑鹰塔是卡斯特罗最后的据点,塔顶飘扬着那面不祥的旗帜。', services: { job: true } },
    ],
  },
  ch27: {
    name: '和平之野', theme: 'village',
    stops: [
      { key: 'meadow', name: '停战草原', theme: 'village', npc: null, node: 'n01', hint: '战火熄灭后的草原,野花重新开了起来。', services: { shop: true } },
      { key: 'altar', name: '和平祭坛', theme: 'village', npc: '两国使者', node: 'n03', hint: '和平祭坛前,两国使者正在签署停战协议。', services: { } },
      { key: 'monument', name: '英雄纪念碑', theme: 'village', npc: null, node: 'n05', hint: '英雄纪念碑下,人们为逝者默哀,也为新生祈福。', services: { job: true } },
    ],
  },
};

/** 打工配置(含小游戏与难度档)见 data/jobs.js */

/** 「休息」操作已下线:行动力改由 剧情推进 / NPC赠予 / 食品 / 酒店休整 恢复 */
