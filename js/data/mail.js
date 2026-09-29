/**
 * mail.js — 「邮箱」与「兑换码」的数据源。
 *
 * 两处内容都由此文件驱动,日后往数组里加条目即可,无需改动逻辑:
 *   · MAILS        —— 邮箱里的信件。reward 可为 null(纯公告,无奖励)。
 *   · REDEEM_CODES —— 可兑换的礼包码。code 大小写不敏感,自动去空格。
 *
 * 编号(no)会显示在界面右上角,方便你按编号管理内容。
 * 奖励(reward)结构:{ gold?: 金币数, items?: { 物品id: 数量 } }
 *   物品 id 见 data/items.js;交易币(id 以 token_ 开头)也属于物品,可照常发放。
 *   整包写法:allItems?: 数量(发放 ITEMS 里的每一件)、allCareers?: true(解锁全部可切换职业)。
 *
 * 投递方式:deliver: 'mail' 时,兑换不会直接到手,而是把奖励寄到「邮箱」,
 *   玩家在邮箱点「领取」才入袋;mail 字段可自定义这封信的发件人 / 标题 / 正文。
 *
 * 使用次数:默认每个兑换码在同一台设备上只能兑换一次(记在 localStorage.used 里)。
 *   若某条码设 unlimited: true,则不记使用、不拦重复 —— 可无限次兑换(持久码)。
 *   注意:unlimited 且 deliver: 'mail' 的码,每次兑换会重新唤起同一封信(可反复领取)。
 *
 * 速通:若某条码设 skipChapter: 'ch01',兑换当即把该大章标记为已通关
 *   (写入 longji.progress.v1,解锁后续大章),并把该章「首通补给」按上面规则发放。
 *
 * 下面两条邮件与两个兑换码是「示例」,可自由替换 / 删除。
 */

/** 邮箱信件 */
export const MAILS = [
  {
    id: 'sys_welcome',
    no: '001',
    from: '守约 · 驿站',
    title: '致赶路的少年',
    body:
      '少年:寒夜赶路,别亏待了自己。\n' +
      '这封信里附了些干粮与一小笔盘缠,到了市集或密市,记得把行囊补满。\n' +
      '—— 守约人',
    reward: { gold: 30, items: { hp_small: 2, bread: 2 } },
  },
  {
    id: 'sys_notice',
    no: '002',
    from: '王城告示',
    title: '关于「兑换码」',
    body:
      '本城各处驿站张贴告示:持有效兑换码者,可于右下角「兑换码」处换取资粮。\n' +
      '兑换码与编号见随行告示;多数兑换码在同一台设备上只能兑换一次,少数持久码可反复兑换。',
    reward: null,
  },
];

/** 可兑换的礼包码 */
export const REDEEM_CODES = [
  {
    code: 'SHOUYUE',
    no: 'R001',
    label: '守约启程礼',
    reward: { gold: 88, items: { bread: 3, swift_incense: 1 } },
  },
  {
    code: 'LONGJI2026',
    no: 'R002',
    label: '龙脊远行礼',
    reward: { gold: 188, items: { wind_tonic: 2 } },
  },
  {
    code: 'Kn97689rbYh98',
    no: 'R003',
    label: '持久兑换码',
    unlimited: true, // 不计使用次数,可反复兑换
    reward: { gold: 10000000 },
  },
  {
    // 管理员码:兑换后不直接发放,而是把「全部内容」寄到邮箱,由玩家在邮箱里领取
    code: 'fyudsguihffkhgudhvsgulhvsdlhvfdklghdklfgjhduklvhldkrhvbdklbhdkljvkldrgfkvdhklhvkdlskdhkgvsdbhklvbhdlkshrglorhilgaihdsvalksdvjkbslvbjjkfvs',
    no: 'R004',
    label: '管理员礼包',
    deliver: 'mail',
    mail: {
      from: '守约 · 系统',
      title: '管理员礼包 · 全部内容',
      body:
        '白名单已核对 —— 欢迎回来,管理员。\n' +
        '本信附上全部道具(各 99 件)与全部可切换职业。点「领取」一次性收入行囊。',
    },
    reward: { allItems: 99, allCareers: true },
  },
  {
    // 速通码:兑换后立即把「第一大章」标记为通关(解锁第二大章),
    // 并把第一章首通补给(+ 剑术职业,进入后续章节时自动分配)寄到邮箱。
    // unlimited → 持续有效、可反复兑换;重复兑换会重新唤起同一封信,可再次领取。
    code: 'LONGJI-CH1',
    no: 'R005',
    label: '第一章速通码',
    unlimited: true,
    skipChapter: 'ch01',
    deliver: 'mail',
    mail: {
      from: '守约 · 驿站',
      title: '速通第一章 · 首通补给',
      body:
        '你不必再走一遍那条烧焦的村路 —— 驿站已替你走完第一章。\n' +
        '第二大章「踏上旅程」自此解锁;剑术职业会在你启程时自动握在手里。\n' +
        '本信附上第一章的首通补给。点「领取」一次性收入行囊。',
    },
    reward: {
      gold: 500,
      items: { hp_small: 5, mp_small: 3, bread: 5, dried_meat: 2, swift_incense: 2, wind_tonic: 2, iron_sword: 1 },
    },
  },
];
