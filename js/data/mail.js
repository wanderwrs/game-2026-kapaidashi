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
      '兑换码与编号见随行告示;每个兑换码在同一台设备上只能兑换一次。',
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
    reward: { gold: 10000000 },
  },
];
