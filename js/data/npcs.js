/**
 * npcs.js — 随机 NPC 汇总。
 *
 * 每位 NPC:
 *   id      唯一标识 npc01 ~ npc70
 *   name    姓名或称呼
 *   tag     身份标签(UI 展示)
 *   where   可能出现的地区主题数组,取值限于以下 9 个之一或多个:
 *           'village' | 'forest' | 'mountain' | 'city' | 'port' | 'sky' | 'ruins' | 'cliff' | 'camp'
 *   replies 按「玩家所选话题」分类的回答:
 *           greet 回应问候 / local 介绍此地 / rumor 说一则见闻 / self 介绍自己
 *           每个话题 2 句,供玩家选择话题后抽取作答(见 core/game.js)
 *   hint    可选。少数 NPC 会透露后段章节某宝箱的密码与位置:
 *           { chest: 宝箱 id(见 chests.js), text: 含密码与位置的一段话 }
 *
 * 台词文本不含引号,引号由 UI 统一添加。
 */
import { NPCS_1 } from './npcs_1.js?v=20260929j';
import { NPCS_2 } from './npcs_2.js?v=20260929j';
import { NPCS_3 } from './npcs_3.js?v=20260929j';

export const NPCS = [...NPCS_1, ...NPCS_2, ...NPCS_3];
