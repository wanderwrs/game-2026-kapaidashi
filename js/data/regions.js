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
      { key: 'home', name: '焚毁的家园', theme: 'village', npc: null, node: 'n01', hint: '家已成焦土。整理行装,准备上路。', services: { shop: true, job: true, rest: true } },
      { key: 'fork', name: '北道岔口', theme: 'forest', npc: '赫尔墨', node: 'n05', hint: '沿北道向北,去岔路口寻找那位白须老人。', services: { rest: true } },
      { key: 'camp', name: '山脚哨站', theme: 'mountain', npc: '哨兵', node: 'n10', hint: '继续北上,抵达龙脊山脚的教团哨站。', services: { job: true, rest: true } },
    ],
  },
  ch02: {
    name: '边境北道', theme: 'forest',
    stops: [
      { key: 'hamlet', name: '边境荒村', theme: 'village', npc: null, node: 'n01', hint: '在边境荒村歇脚,补给后继续北上。', services: { shop: true, job: true, rest: true } },
      { key: 'inn', name: '雨夜孤驿', theme: 'forest', npc: '驿丞', node: 'n04', hint: '夜雨将至,去孤驿找驿丞避雨。', services: { shop: true, rest: true } },
      { key: 'pass', name: '山脚哨站', theme: 'mountain', npc: '同路人·林', node: 'n07', hint: '翻过山脊,在山脚哨站寻访那名出逃的少年。', services: { rest: true } },
    ],
  },
  ch03: {
    name: '王城', theme: 'city',
    stops: [
      { key: 'gate', name: '王城城门', theme: 'city', npc: null, node: 'n01', hint: '入王城,先在城门一带落脚。', services: { shop: true, job: true, rest: true } },
      { key: 'manor', name: '旧友宅邸', theme: 'city', npc: '洛恩', node: 'n04', hint: '按父亲留下的名字,去旧友洛恩的宅邸求见。', services: { rest: true } },
      { key: 'alley', name: '王城暗巷', theme: 'city', npc: null, node: 'n06', hint: '追查刺客的线索,深入王城暗巷。', services: { job: true, rest: true } },
    ],
  },
  ch04: {
    name: '南方渔港', theme: 'port',
    stops: [
      { key: 'quay', name: '渔港码头', theme: 'port', npc: null, node: 'n01', hint: '回到盐风扑面的渔港,先上码头打听。', services: { shop: true, job: true, rest: true } },
      { key: 'shack', name: '渔家老屋', theme: 'port', npc: '母亲', node: 'n04', hint: '循着旧记忆,找到那间渔家老屋。', services: { rest: true } },
      { key: 'reef', name: '港外礁岸', theme: 'port', npc: null, node: 'n06', hint: '顺潮声走向港外礁岸,了结旧账。', services: { job: true, rest: true } },
    ],
  },
  ch05: {
    name: '圣心坛外围', theme: 'mountain',
    stops: [
      { key: 'camp', name: '雪线营地', theme: 'mountain', npc: null, node: 'n01', hint: '在雪线扎营,准备潜入圣心坛。', services: { shop: true, job: true, rest: true } },
      { key: 'pass', name: '坛外密道', theme: 'cliff', npc: null, node: 'n02', hint: '沿冰隙摸进坛外密道。', services: { rest: true } },
      { key: 'steps', name: '坛前石阶', theme: 'mountain', npc: '幼年黑龙', node: 'n05', hint: '登上坛前石阶,直面那头幼龙。', services: { rest: true } },
    ],
  },
  ch06: {
    name: '山中村舍', theme: 'village',
    stops: [
      { key: 'hut', name: '山间村舍', theme: 'village', npc: null, node: 'n01', hint: '在此安顿弟弟,喘一口气。', services: { shop: true, job: true, rest: true } },
      { key: 'edge', name: '村外林缘', theme: 'forest', npc: null, node: 'n02', hint: '教团追兵逼近,出村到林缘戒备。', services: { rest: true } },
      { key: 'post', name: '追兵哨位', theme: 'forest', npc: null, node: 'n04', hint: '循着脚印,找到教团追兵的哨位。', services: { job: true, rest: true } },
    ],
  },
  ch07: {
    name: '迷心林', theme: 'forest',
    stops: [
      { key: 'mouth', name: '林口', theme: 'forest', npc: null, node: 'n01', hint: '入林的唯一入口,就在眼前。', services: { shop: true, job: true, rest: true } },
      { key: 'deep', name: '林深处', theme: 'forest', npc: null, node: 'n02', hint: '循着林间微光,往更深处走。', services: { rest: true } },
      { key: 'eye', name: '妖精阵眼', theme: 'forest', npc: '林地妖精', node: 'n04', hint: '找到困住你们的阵眼,那里守着林地的妖精。', services: { rest: true } },
    ],
  },
  ch08: {
    name: '剑塔遗址', theme: 'mountain',
    stops: [
      { key: 'plain', name: '塔下荒原', theme: 'mountain', npc: null, node: 'n01', hint: '穿过荒原,走向倾颓的剑塔。', services: { shop: true, job: true, rest: true } },
      { key: 'door', name: '塔门', theme: 'ruins', npc: null, node: 'n02', hint: '推开积灰的塔门。', services: { rest: true } },
      { key: 'room', name: '剑诀石室', theme: 'ruins', npc: '守塔人', node: 'n05', hint: '沿旋梯下到石室,寻访守塔人。', services: { rest: true } },
    ],
  },
  ch09: {
    name: '云端浮岛', theme: 'sky',
    stops: [
      { key: 'dock', name: '浮岛码头', theme: 'sky', npc: null, node: 'n00', hint: '风翼降落在浮岛码头。', services: { shop: true, job: true, rest: true } },
      { key: 'trial', name: '风翼试炼场', theme: 'sky', npc: null, node: 'n02', hint: '前往风翼试炼场,证明你的胆量。', services: { rest: true } },
      { key: 'tower', name: '学院望楼', theme: 'sky', npc: '院长', node: 'n04', hint: '登上学院望楼,求见院长。', services: { rest: true } },
    ],
  },
  ch10: {
    name: '远洋学院', theme: 'port',
    stops: [
      { key: 'quay', name: '学院码头', theme: 'port', npc: null, node: 'n01', hint: '靠岸远洋学院码头。', services: { shop: true, job: true, rest: true } },
      { key: 'chart', name: '海图室', theme: 'port', npc: null, node: 'n02', hint: '去海图室查阅远洋航线。', services: { rest: true } },
      { key: 'cape', name: '出海岬角', theme: 'cliff', npc: '老船长', node: 'n04', hint: '到出海岬角,找那位肯借船的老船长。', services: { rest: true } },
    ],
  },
  ch11: {
    name: '大神学', theme: 'city',
    stops: [
      { key: 'square', name: '教堂广场', theme: 'city', npc: null, node: 'n01', hint: '混入教堂广场,观察教团的布道。', services: { shop: true, job: true, rest: true } },
      { key: 'booth', name: '忏悔室', theme: 'city', npc: '赎罪修士', node: 'n02', hint: '借忏悔的名义,接近那位动摇的修士。', services: { rest: true } },
      { key: 'vault', name: '藏典地下', theme: 'ruins', npc: null, node: 'n05', hint: '潜入藏典地下,取回圣典残页。', services: { job: true, rest: true } },
    ],
  },
  ch12: {
    name: '山道密林', theme: 'forest',
    stops: [
      { key: 'mouth', name: '山道口', theme: 'forest', npc: null, node: 'n01', hint: '循着弟弟的踪迹,进山。', services: { shop: true, job: true, rest: true } },
      { key: 'fork', name: '密林岔道', theme: 'forest', npc: null, node: 'n02', hint: '岔道上有新鲜的辙印,沿着它走。', services: { rest: true } },
      { key: 'camp', name: '追兵营地', theme: 'forest', npc: null, node: 'n04', hint: '摸到教团追兵的营地。', services: { job: true, rest: true } },
    ],
  },
  ch13: {
    name: '被掳村庄', theme: 'ruins',
    stops: [
      { key: 'wall', name: '村口断墙', theme: 'ruins', npc: null, node: 'n01', hint: '翻过断墙,进入被洗劫的村庄。', services: { shop: true, job: true, rest: true } },
      { key: 'altar', name: '村中石台', theme: 'ruins', npc: null, node: 'n02', hint: '循着哭声,走向村中的石台。', services: { rest: true } },
      { key: 'hall', name: '教团长老院', theme: 'ruins', npc: '教团长老', node: 'n05', hint: '闯进长老院,与教团长老对峙。', services: { rest: true } },
    ],
  },
  ch14: {
    name: '圣心坛', theme: 'mountain',
    stops: [
      { key: 'foot', name: '坛下', theme: 'mountain', npc: null, node: 'n01', hint: '最后的攀登,从坛下开始。', services: { shop: true, job: true, rest: true } },
      { key: 'ring', name: '火柱环廊', theme: 'cliff', npc: null, node: 'n02', hint: '穿过燃烧的火柱环廊。', services: { rest: true } },
      { key: 'altar', name: '祭坛中央', theme: 'mountain', npc: '大祭司', node: 'n04', hint: '走向祭坛中央,面对大祭司。', services: { rest: true } },
    ],
  },
  ch15: {
    name: '王城广场', theme: 'city',
    stops: [
      { key: 'gate', name: '王城城门', theme: 'city', npc: null, node: 'n01', hint: '归城。城门在望。', services: { shop: true, job: true, rest: true } },
      { key: 'square', name: '广场残垣', theme: 'city', npc: null, node: 'n02_battle', hint: '广场上有残党负隅顽抗。', services: { rest: true } },
      { key: 'tower', name: '钟楼', theme: 'city', npc: null, node: 'n03', hint: '登上钟楼,为这一程收束。', services: { rest: true } },
    ],
  },
};

/** 打工配置(含小游戏与难度档)见 data/jobs.js */

/** 休息:恢复行动力(免费,但会消耗一点时间) */
export const REST_AP_RECOVER = 6;
