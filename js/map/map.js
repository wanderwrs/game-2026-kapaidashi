/**
 * map.js — Roguelike 地图节点生成。
 * 默认 8 层,每层 2-3 个节点,末层为 Boss。
 * 节点类型加权抽取:前期多普通战斗,3 层后可出精英。
 * 框架版为线性可选结构;后续可扩展为分叉路径图。
 */

export const NodeType = Object.freeze({
  BATTLE: 'battle',
  ELITE: 'elite',
  REST: 'rest',
  EVENT: 'event',
  BOSS: 'boss',
  SHOP: 'shop',
});

export const NodeLabel = {
  battle: '战斗',
  elite: '精英',
  rest: '休息',
  event: '事件',
  boss: '首领',
  shop: '商店',
};

export function generateMap(rng, maxFloor = 8) {
  const nodes = [];
  let id = 0;

  for (let floor = 1; floor <= maxFloor; floor++) {
    if (floor === maxFloor) {
      nodes.push({ id: id++, floor, type: NodeType.BOSS, visited: false });
      continue;
    }
    const count = rng.range(2, 3);
    for (let i = 0; i < count; i++) {
      nodes.push({ id: id++, floor, type: rollType(rng, floor), visited: false });
    }
  }

  return { maxFloor, nodes };
}

function rollType(rng, floor) {
  const table = [
    { type: NodeType.BATTLE, weight: 50 },
    { type: NodeType.REST, weight: 15 },
    { type: NodeType.EVENT, weight: 15 },
    { type: NodeType.SHOP, weight: 5 },
    { type: NodeType.ELITE, weight: floor >= 3 ? 15 : 0 },
  ].filter((t) => t.weight > 0);

  const total = table.reduce((s, t) => s + t.weight, 0);
  let r = rng.next() * total;
  for (const t of table) {
    r -= t.weight;
    if (r <= 0) return t.type;
  }
  return NodeType.BATTLE;
}
