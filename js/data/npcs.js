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
 *   localTheme
 *           可选但推荐。按「场景类型」分开写的「打听此地」回答:
 *           { village: ['…','…'], forest: ['…','…'], … }
 *           键需覆盖 where 里的每个主题;玩家在哪种地方问,就答哪种地方的样子。
 *           缺失时回落到 replies.local(因此 replies.local 要写得足够通用)。
 *   hint    可选。少数 NPC 会透露后段章节某宝箱的密码与位置:
 *           { chest: 宝箱 id(见 chests.js), text: 含密码与位置的一段话 }
 *   evolve  可选。剧情推进后改变「问法」与「回答」,为数组、按 from 依次累积:
 *           [{
 *             from: 6,                                   // 到达过第 6 章起生效
 *             topics: { rumor: { label: '问教团动向', ask: '教团近来在忙什么?' } },
 *             replies: { greet: ['…', '…'] },            // 只写有变化的话题
 *           }]
 *           话题 id 仍为 greet / local / rumor / self,未改写的话题沿用 replies。
 *
 * 台词文本不含引号,引号由 UI 统一添加。
 * local 台词必须贴合「当前所处的场景类型」(村口 / 林间 / 山道 / 街巷 / 码头 /
 * 废墟 / 崖壁 / 营地 / 云上),不得点名具体地区名,以免出现在别处时答非所问。
 */
import { NPCS_1 } from './npcs_1.js?v=20260929k';
import { NPCS_2 } from './npcs_2.js?v=20260929k';
import { NPCS_3 } from './npcs_3.js?v=20260929k';

export const NPCS = [...NPCS_1, ...NPCS_2, ...NPCS_3];
