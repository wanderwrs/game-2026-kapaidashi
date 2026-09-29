/**
 * main.js — 入口。
 * 实例化 Game 并挂载到 #app。
 * 暴露到 window.__game 便于控制台调试与种子复现。
 */

import { Game } from './core/game.js?v=20260929w';
import { AgeGate } from './ui/agegate.js?v=20260929w';

// 先挂载年龄 / 内容警告门:遮住页面,直到真人验证通过
new AgeGate();

const app = document.getElementById('app');
const game = new Game(app);

window.__game = game;

console.log('[Roguelike Deckbuilder] framework ready. 用 __game.startNewRun() 直接开始一局。');
