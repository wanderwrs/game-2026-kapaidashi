/**
 * verify-chapters.mjs — 验证全部主线大章剧情能否正常通过。
 *
 * 检查项:
 *   1. 每个章节 start 节点存在
 *   2. 每个节点的 next / choice.next / battle.victory_next / battle.defeat_next 引用存在
 *   3. 跨章节引用(形如 "ch02:n12")目标节点存在
 *   4. 从 ch01.start 出发,通过 BFS 可达 ch15 的 ending 节点
 *   5. 每个大章都至少有一个节点连接到下一大章(或 ch15 有 ending)
 *   6. career_branch 分支目标存在
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const chaptersDir = join(__dirname, 'js/narrative/chapters');

/**
 * 动态导入章节模块,并把节点 Map 展开为普通对象。
 * 由于 import URL 带 ?v=... 后缀,Node 的 import() 无法直接解析,
 * 这里改用读取源码 → 去掉 ?v= 后缀 → 通过 data URL 执行。
 */
async function loadChapter(file) {
  let src = readFileSync(file, 'utf-8');
  // 把所有 import 的 ?v=... 后缀去掉,使其指向真实文件
  src = src.replace(/from\s+'([^']+)\?v=[^']*'/g, "from '$1'");
  src = src.replace(/from\s+"([^"]+)\?v=[^"]*"/g, 'from "$1"');
  const modUrl = pathToFileURL(file).href;
  // 用 import 直接加载(已清理 query,Node 可解析)
  const mod = await import(modUrl);
  const key = Object.keys(mod).find((k) => k.startsWith('CHAPTER_'));
  return mod[key];
}

async function main() {
  const mainOrder = ['ch01','ch02','ch03','ch04','ch05','ch06','ch07','ch08','ch09','ch10','ch11','ch12','ch13','ch14','ch15','ch16','ch17','ch18','ch19','ch20','ch21','ch22','ch23','ch24','ch25','ch26','ch27'];
  const allFiles = ['ch01.js','ch02.js','ch02b.js','ch03.js','ch04.js','ch04b.js','ch05.js','ch05b.js','ch06.js','ch07.js','ch08.js','ch09.js','ch10.js','ch11.js','ch12.js','ch13.js','ch14.js','ch15.js','ch16.js','ch17.js','ch18.js','ch19.js','ch20.js','ch21.js','ch22.js','ch23.js','ch24.js','ch25.js','ch26.js','ch27.js','fs1.js','fs2.js','fs3.js','fs4.js','fsa5.js','fsa6.js','fsa7.js','fsa8.js','fsb5.js','fsb6.js','fsb7.js','fsb8.js'];

  const chapters = {};
  for (const f of allFiles) {
    const ch = await loadChapter(join(chaptersDir, f));
    chapters[ch.id] = ch;
  }

  let errors = 0;
  let warnings = 0;
  const log = (type, msg) => {
    if (type === 'ERR') { console.error('❌', msg); errors++; }
    else if (type === 'WARN') { console.warn('⚠️ ', msg); warnings++; }
    else console.log('✅', msg);
  };

  // ---- 1 & 2. 节点引用完整性 ----
  console.log('\n=== 1. 节点引用完整性 ===');
  for (const [cid, ch] of Object.entries(chapters)) {
    const nodes = ch.nodes;
    const nodeIds = new Set(nodes.keys());

    // start 存在
    if (!nodes.has(ch.start)) {
      log('ERR', `${cid}: start 节点 "${ch.start}" 不存在`);
      continue;
    }

    // 遍历所有节点检查引用
    for (const [nid, node] of nodes) {
      const checkRef = (ref, ctx) => {
        if (!ref) return;
        if (ref.includes(':')) {
          const [tid, tnid] = ref.split(':');
          if (!chapters[tid]) { log('ERR', `${cid}:${nid} ${ctx} → 跨章引用 ${ref} 目标章节不存在`); return; }
          if (!chapters[tid].nodes.has(tnid)) { log('ERR', `${cid}:${nid} ${ctx} → 跨章引用 ${ref} 目标节点不存在`); }
        } else {
          if (!nodeIds.has(ref)) log('ERR', `${cid}:${nid} ${ctx} → 本节点引用 "${ref}" 不存在`);
        }
      };

      checkRef(node.next, 'next');
      checkRef(node.victory_next, 'victory_next');
      checkRef(node.defeat_next, 'defeat_next');
      if (node.choices) {
        node.choices.forEach((c, i) => checkRef(c.next, `choice[${i}].next`));
      }
      if (node.career_branch) {
        for (const [k, v] of Object.entries(node.career_branch)) {
          checkRef(v, `career_branch.${k}`);
        }
      }
    }
  }
  if (errors === 0) log('OK', '所有节点引用均有效');

  // ---- 3. 通关可达性:BFS 从 ch01.start 到所有 ending ----
  console.log('\n=== 2. 通关可达性(ch01 → 所有结局) ===');
  const visited = new Set();
  const queue = [`ch01:${chapters.ch01.start}`];
  visited.add(queue[0]);
  const reachableEndings = [];
  const reachableChapters = new Set();

  while (queue.length) {
    const cur = queue.shift();
    const [cid, nid] = cur.split(':');
    const node = chapters[cid]?.nodes.get(nid);
    if (!node) continue;
    reachableChapters.add(cid);

    if (node.kind === 'ending') {
      reachableEndings.push({ chapter: cid, node: nid, ending_id: node.ending_id });
    }

    const refs = [];
    if (node.next) refs.push(node.next);
    if (node.victory_next) refs.push(node.victory_next);
    if (node.defeat_next) refs.push(node.defeat_next);
    if (node.choices) refs.push(...node.choices.map((c) => c.next));
    if (node.career_branch) refs.push(...Object.values(node.career_branch));

    for (const ref of refs) {
      const target = ref.includes(':') ? ref : `${cid}:${ref}`;
      if (!visited.has(target)) {
        visited.add(target);
        queue.push(target);
      }
    }
  }

  console.log(`   BFS 可达节点数:${visited.size}`);
  console.log(`   可达结局:${reachableEndings.map((e) => `${e.chapter}:${e.node}(${e.ending_id})`).join(', ') || '无'}`);

  // 所有主线大章必须可达
  for (const cid of mainOrder) {
    if (reachableChapters.has(cid)) log('OK', `${cid} 可达`);
    else log('ERR', `${cid} 从 ch01 不可达`);
  }

  // 必须有至少一个结局可达
  if (reachableEndings.length > 0) log('OK', `共 ${reachableEndings.length} 个结局可达`);
  else log('ERR', '没有任何结局可达');

  // 收集所有 ending 节点,确认全部可达
  const allEndings = [];
  for (const cid of mainOrder) {
    for (const [nid, node] of chapters[cid].nodes) {
      if (node.kind === 'ending') allEndings.push({ chapter: cid, node: nid, ending_id: node.ending_id });
    }
  }
  console.log(`\n   全部定义的结局:${allEndings.map((e) => `${e.chapter}:${e.node}(${e.ending_id})`).join(', ')}`);
  for (const e of allEndings) {
    if (visited.has(`${e.chapter}:${e.node}`)) log('OK', `结局 ${e.chapter}:${e.node}(${e.ending_id}) 可达`);
    else log('WARN', `结局 ${e.chapter}:${e.node}(${e.ending_id}) 不可达(可能为隐藏分支)`);
  }

  // ---- 4. 各大章间衔接(宽松版:每章至少有一个出边指向其他章节或有 ending) ----
  console.log('\n=== 3. 各大章出边检查 ===');
  for (const cid of mainOrder) {
    const ch = chapters[cid];
    let hasOut = false;
    let hasEnding = false;
    for (const node of ch.nodes.values()) {
      if (node.kind === 'ending') { hasEnding = true; }
      const refs = [];
      if (node.next) refs.push(node.next);
      if (node.victory_next) refs.push(node.victory_next);
      if (node.defeat_next) refs.push(node.defeat_next);
      if (node.choices) refs.push(...node.choices.map((c) => c.next));
      if (node.career_branch) refs.push(...Object.values(node.career_branch));
      if (refs.some((r) => r.includes(':'))) { hasOut = true; break; }
    }
    if (hasEnding) log('OK', `${cid} 含结局节点`);
    else if (hasOut) log('OK', `${cid} 有跨章出边`);
    else log('ERR', `${cid} 既无结局也无跨章出边`);
  }

  // ---- 5. 死节点检测(从 start 不可达) ----
  console.log('\n=== 4. 各章死节点(从 start 不可达) ===');
  for (const cid of mainOrder) {
    const ch = chapters[cid];
    const reachable = new Set([ch.start]);
    const q = [ch.start];
    while (q.length) {
      const nid = q.shift();
      const node = ch.nodes.get(nid);
      if (!node) continue;
      const refs = [];
      if (node.next && !node.next.includes(':')) refs.push(node.next);
      if (node.victory_next && !node.victory_next.includes(':')) refs.push(node.victory_next);
      if (node.defeat_next && !node.defeat_next.includes(':')) refs.push(node.defeat_next);
      if (node.choices) refs.push(...node.choices.map((c) => c.next).filter((r) => !r.includes(':')));
      if (node.career_branch) refs.push(...Object.values(node.career_branch).filter((r) => !r.includes(':')));
      for (const r of refs) {
        if (!reachable.has(r)) { reachable.add(r); q.push(r); }
      }
    }
    const dead = [...ch.nodes.keys()].filter((nid) => !reachable.has(nid));
    if (dead.length === 0) log('OK', `${cid} 无死节点(${ch.nodes.size} 节点)`);
    else log('WARN', `${cid} 有 ${dead.length} 个死节点:${dead.slice(0, 5).join(', ')}${dead.length > 5 ? '...' : ''}`);
  }

  // ---- 6. 结局 flag 检查 ----
  console.log('\n=== 5. 结局 flag 覆盖 ===');
  const endingFlags = new Set();
  for (const ch of Object.values(chapters)) {
    for (const node of ch.nodes.values()) {
      if (node.effects?.flags) node.effects.flags.forEach((f) => endingFlags.add(f));
      if (node.choices) node.choices.forEach((c) => c.effects?.flags?.forEach((f) => endingFlags.add(f)));
    }
  }
  const keyFlags = ['sacrificed_self','saved_village','found_brother','abandoned_quest'];
  for (const f of keyFlags) {
    if (endingFlags.has(f)) log('OK', `关键结局 flag "${f}" 存在`);
    else log('WARN', `关键结局 flag "${f}" 未在剧情中设置`);
  }

  console.log(`\n=== 验证完成:${errors} 个错误,${warnings} 个警告 ===`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
