/**
 * talk.js — 与路人交谈时「玩家可选的话」。
 *
 * 设计:
 *   · 点击本地人物后弹出对话。玩家先从若干「话题」里挑一句说出去,
 *     NPC 再以该话题对应的回答作答(见 npcs.js 的 replies)——
 *     即玩家有话语选择权,且回答不会答非所问。
 *   · 话题 id 与 npcs.js 的 replies 键一一对应。
 */

/** 玩家可选话题(按此顺序展示)。ask 为玩家要说的话(不含引号,由 UI 添加) */
export const TALK_TOPICS = [
  { id: 'greet', label: '打个招呼', ask: '你好,冒昧打扰一下。' },
  { id: 'local', label: '打听此地', ask: '这附近是什么地方?' },
  { id: 'rumor', label: '问问传闻', ask: '最近有什么值得留意的消息吗?' },
  { id: 'self',  label: '聊聊对方', ask: '你在这里做什么营生?' },
];

/** 一次交谈里 NPC 最多说几句(与需求「1~5 句」一致) */
export const TALK_MAX_LINES = 5;
