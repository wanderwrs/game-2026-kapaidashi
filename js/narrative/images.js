/**
 * images.js — 15 张主线剧情插图映射。
 * 图片由 AI 文生图接口生成,16:9 横屏,适配剧情视图。
 * 不涉及具体职业形象,仅呈现主线关键场景(通用少年 + 通用场景)。
 * key 格式:`${chapterId}:${nodeId}`
 */

const BASE = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image';
const SIZE = 'landscape_16_9';

function img(prompt) {
  return `${BASE}?prompt=${encodeURIComponent(prompt)}&image_size=${SIZE}`;
}

export const CHAPTER_IMAGES = {
  // ===== 第一章 家园破碎 =====
  'ch01:n01': img('A medieval village burning at dusk, a black dragon silhouette flying over rooftops, orange flames against dark red sky, a teenage boy running toward the village with a bundle of firewood, cinematic fantasy illustration, dramatic lighting, wide shot'),
  'ch01:n02': img('Three black-robed cultists with red dragon-spine emblems entering a ruined cottage at night, a crying child under a bed, firelight through broken roof, dark fantasy illustration, tense atmosphere'),
  'ch01:n05': img('A teenage boy waking up alone in a burned wheat field at night, distant village still burning red against the sky, holding a small wooden fish pendant in his hand, melancholic fantasy illustration, moonlight, wide shot'),

  // ===== 第一章 赫尔墨引路(不展示具体职业,只展示岔路与引路人)=====
  'ch01:n06': img('An old white-bearded man in grey robe showing an ancient parchment map to a teenage boy at a village entrance stone pillar, six diverging paths drawn on the map, dawn light, fantasy illustration, mentor scene'),

  // ===== 第二章 踏上旅程 =====
  'ch02:n01': img('A ruined roadside inn at dusk on a muddy trade road, distant dragon-spine mountains on the horizon, a lone teenage traveler with a sword approaching, medieval fantasy illustration, moody atmosphere'),
  'ch02:n04': img('Two teenage boys meeting under a rock overhang in heavy rain, one in blue robe holding a star chart, small campfire glowing between them, dark forest, fantasy illustration, night, intimate'),

  // ===== 第三章 王国拜访 =====
  'ch03:n01': img('A grand medieval walled city with double-headed eagle banners also marked with red dragon-spine symbols, grey stone towers, overcast sky, fantasy illustration, wide establishing shot'),
  'ch03:n06': img('An old white-haired scribe collapsing at a writing desk in a candlelit study, three masked assassins with short blades, scattered papers and blood, dark fantasy illustration, dramatic'),

  // ===== 第四章 渔港寻亲 =====
  'ch04:n01': img('A fishing harbor at dusk with masts covered in red dragon-spine marks, black cult ships replacing fishing boats, huddled fishermen in leaky shacks at the end of the pier, melancholic fantasy illustration'),

  // ===== 第五章 屠龙少年 =====
  'ch05:n01': img('A black obsidian sacrificial altar between twin mountain peaks, an eternal red flame pillar in the center, a young black dragon coiled nearby with fetal down on its scales, dark-robed cultists chanting, epic dark fantasy illustration'),

  // ===== 第八章 拜师学艺 =====
  'ch08:n01': img('Ruins of an ice-plains sword tower, broken swords stuck in rubble, a white-haired sword master practicing sword forms in the ruins, snow falling, grey sky, fantasy illustration, contemplative'),

  // ===== 第九章 飞行学院 =====
  'ch09:n01': img('A floating island above a sea of clouds, a girl in blue-white feathered robe descending on silver-white wings, bright daylight, fantasy illustration, airy and bright'),

  // ===== 第十章 海洋学院 =====
  'ch10:n01': img('A floating wooden city on dark blue ocean, crashing waves against wooden pillars, a middle-aged man in faded navy robe standing on a dock, overcast sky, fantasy illustration, maritime'),

  // ===== 第十四章 大祭司之战 =====
  'ch14:n01': img('A grand altar with a white-bearded high priest in white robe holding a burning holy sword at the highest point, a young dragon-boy standing before a flame pillar, cultists around, epic dark fantasy illustration, dramatic red lighting'),

  // ===== 第十五章 回归主城 =====
  'ch15:n03': img('A medieval city square at dawn, a crowd cheering, a teenage boy with a sword standing in the center, a white-haired mother nearby, banners flying, hopeful fantasy illustration, wide shot, warm light'),
};
