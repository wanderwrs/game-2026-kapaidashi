/**
 * chests.js — 后段章节的上锁宝箱。
 *
 * 每个宝箱需要「三位数密码」才能打开,密码由随机 NPC 的「问问传闻」透露(见 npcs.js 的 hint)。
 * 玩家在「情报」面板里可随时回看已知的密码与位置。
 *
 * 字段:
 *   id       唯一标识
 *   chapter  所在章节(= 地区 id,见 regions.js)
 *   stop     所在地点索引(地区内第几个 stop,从 0 起)
 *   name     箱名
 *   password 三位数字密码
 *   loot     开箱所得 { gold, items: { itemId: qty } }
 *   place    位置描述(情报面板展示)
 */
export const CHESTS = [
  {
    id: 'chest_ch02', chapter: 'ch02', stop: 2, name: '哨站的旧铁箱', password: '274',
    place: '山脚哨站的柴堆后', loot: { gold: 60, items: { hp_small: 2 } },
  },
  {
    id: 'chest_ch03', chapter: 'ch03', stop: 2, name: '暗巷的旧木箱', password: '371',
    place: '王城暗巷最深的那堵墙根', loot: { gold: 90, items: { mp_small: 2 } },
  },
  {
    id: 'chest_ch04', chapter: 'ch04', stop: 2, name: '礁岸的防水箱', password: '508',
    place: '港外礁岸的石缝里', loot: { gold: 110, items: { dried_meat: 2 } },
  },
  {
    id: 'chest_ch05', chapter: 'ch05', stop: 1, name: '密道的铁皮匣', password: '196',
    place: '坛外密道拐角的冰隙后', loot: { gold: 130, items: { hp_large: 1 } },
  },
  {
    id: 'chest_ch06', chapter: 'ch06', stop: 2, name: '哨位的行囊', password: '643',
    place: '追兵哨位旁的断树洞里', loot: { gold: 150, items: { mp_small: 2, iron_sword: 1 } },
  },
  {
    id: 'chest_ch07', chapter: 'ch07', stop: 2, name: '阵眼的藤箱', password: '812',
    place: '妖精阵眼边的古藤下', loot: { gold: 170, items: { honey_cake: 2 } },
  },
  {
    id: 'chest_ch08', chapter: 'ch08', stop: 2, name: '石室的石匣', password: '450',
    place: '剑诀石室墙上的暗龛', loot: { gold: 200, items: { steel_blade: 1 } },
  },
  {
    id: 'chest_ch09', chapter: 'ch09', stop: 2, name: '望楼的藏书箱', password: '927',
    place: '学院望楼顶层书架的后侧', loot: { gold: 230, items: { mp_large: 1, mp_small: 2 } },
  },
  {
    id: 'chest_ch10', chapter: 'ch10', stop: 2, name: '岬角的旧木箱', password: '135',
    place: '出海岬角废弃的灯塔基座下', loot: { gold: 260, items: { noble_robe: 1 } },
  },
  {
    id: 'chest_ch11', chapter: 'ch11', stop: 2, name: '地下的铜箱', password: '768',
    place: '藏典地下最里一排书架的底板下', loot: { gold: 300, items: { power_elixir: 2 } },
  },
  {
    id: 'chest_ch12', chapter: 'ch12', stop: 2, name: '营地的军械箱', password: '204',
    place: '追兵营地账房帐篷的睡铺下', loot: { gold: 340, items: { dragon_fang: 1 } },
  },
  {
    id: 'chest_ch13', chapter: 'ch13', stop: 2, name: '长老院的银箱', password: '589',
    place: '教团长老院祭台石阶的夹层里', loot: { gold: 380, items: { leather_armor: 1, hp_large: 2 } },
  },
  {
    id: 'chest_ch14', chapter: 'ch14', stop: 2, name: '祭坛的圣匣', password: '316',
    place: '祭坛中央石像的背身凹槽', loot: { gold: 430, items: { power_elixir: 3, mp_large: 2 } },
  },
  {
    id: 'chest_ch15', chapter: 'ch15', stop: 1, name: '钟楼的鎏金箱', password: '731',
    place: '广场残垣钟楼夹道的神龛后面', loot: { gold: 500, items: { emperor_new_clothes: 1 } },
  },
];

/** id → 宝箱 */
export const CHEST_MAP = Object.fromEntries(CHESTS.map((c) => [c.id, c]));

/** 取某章节某地点上的宝箱(没有则 null) */
export function chestAt(chapter, stop) {
  return CHESTS.find((c) => c.chapter === chapter && c.stop === stop) || null;
}
