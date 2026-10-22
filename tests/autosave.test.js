// Saves in IndexedDB (store.js): five manual slots and the autosave, the autosave's snapshot and slices (session.js), a
// message for every failure, and gzip export and import (codec.js), against the shims of tests/fake-idb.js.
//   node tests/autosave.test.js
const harness = require('./engine-harness');
const { fakeIndexedDB } = require('./fake-idb');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
// a context with storage, timers (the slices wait for setTimeout, as without requestIdleCallback) and the stream APIs
function page(idb) {
  const h = harness();
  Object.assign(h.c, { indexedDB: idb, setTimeout, clearTimeout, Blob, Response, CompressionStream, DecompressionStream, TextDecoderStream });
  return h;
}
const scene = (n, np, minutes) => `(() => {
  MAP_SIZES['x${n}'] = ${n};
  const spec = generateMapSpec({ size: 'x${n}', seed: 33, mapType: 'coastal', numPlayers: ${np} }), civs = Object.keys(CIVS);
  createWorld(spec, { players: Array.from({ length: ${np} }, (_, i) => ({ name: 'P' + i, civ: civs[(i * 5) % civs.length], color: PLAYER_COLORS[i], human: i === 0 })), seed: 33, size: 'x${n}', mapType: 'coastal', fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard', rules: currentRules() });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.nextAutosave = 1e9;   // the tests start each autosave themselves
  W.spectate = true; for (let i = 0; i < ${minutes} * 1200; i++) worldTick(0.05); W.spectate = false;
})()`;
// waits (on node's own timers) until the autosave has finished; with play, the match plays a tick every millisecond meanwhile
const settled = (run, play = false) => new Promise(resolve => {
  const iv = play ? setInterval(() => run('worldTick(0.05)'), 1) : null;
  const t = () => (run('MatchSave.busy') ? setTimeout(t, 5) : (iv && clearInterval(iv), resolve())); t();
});
// the one-shot save at the moment the autosave takes its snapshot (serializeSliced's first, synchronous step)
const SPY = `(() => { const sliced = MatchSave.serializeSliced;
  MatchSave.serializeSliced = function () {
    const mu = W.list.find(e => e.kind === 'unit' && e.owner === 1); mu.path = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]; mu.pi = 1; mu.mvAt = mu.path[1]; globalThis.__mvId = mu.id;   // a mid-path unit: mvAt is the path's own waypoint
    globalThis.__sync = MatchSave.serialize(); globalThis.__syncTick = W.tick; return sliced.apply(this, arguments); }; })()`;
(async () => {
  // ---------- 1. the autosave takes one snapshot, then writes it in slices while the match plays on ----------
  const idb = fakeIndexedDB(), A = page(idb);
  A.run(scene(256, 3, 2)); A.run(SPY);
  // a tree also held elsewhere in the save: the snapshot keeps it one node
  A.run(`(() => { const t = W.list.find(e => e.kind === 'res' && e.type === 'tree'); W.probe = { a: t, b: [t] }; })()`);
  A.run('W.nextAutosave = W.t; worldTick(0.05);');   // the hook starts it; the snapshot comes two timers later (after the rehearsal)
  const started = JSON.parse(A.run('JSON.stringify({ busy: MatchSave.busy, taken: typeof __sync === "string" })'));
  // right after the snapshot, before the slices: change what the save holds, in every way the match can
  const change = () => A.run(`(() => {
    if (typeof __sync !== 'string' || W.changed) return false;
    const p = W.players[1], tree = W.probe.a, mine = W.list.find(e => e.kind === 'res' && e.type === 'gold' && !e.gatherers), u = W.list.find(e => e.kind === 'unit' && e.owner === 1);
    tree.amount -= 7; tree.gatherers++; tree.fallDir = 1;   // a flat record: values changed, a key added
    removeEnt(mine);                                       // a flat record gone from W.list
    spawnUnit('villager', 1, p.startX, p.startY + 3);      // an entity added
    p.res.gold -= 50; u.cargo.push(1);                     // an object and an array inside an entity
    W.map.blk[5] = 99; p.explored[7] = 1; p.visible[9] ^= 1;                  // typed arrays
    W.probe.b.push(u); W.changed = true;
    return true;
  })()`);
  const watch = setInterval(() => { if (change()) clearInterval(watch); }, 0);
  await settled(A.run, true); clearInterval(watch);
  const S = JSON.parse(A.run('JSON.stringify(MatchSave.stats)'));
  const auto = await A.run(`Store.get('saves', 'auto')`);
  A.c.__auto = auto;
  const cmp = JSON.parse(A.run(`(() => { const a = JSON.parse(__auto), b = JSON.parse(__sync), now = JSON.parse(MatchSave.serialize());
    return JSON.stringify({ same: JSON.stringify(a.graph) === JSON.stringify(b.graph) && a.version === 2, changed: !!W.changed && JSON.stringify(now.graph) !== JSON.stringify(b.graph), ticks: W.tick - __syncTick, snapTick: MatchSave.stats.tick === __syncTick }); })()`));
  const info = JSON.parse(await A.run(`MatchSave.slotInfos().then(i => JSON.stringify(i.auto))`));
  ok(`the autosave at 256 x 256 takes its snapshot after the tick that started it, nearly every entity as a flat record (${S.flat.toLocaleString('en-US')} of ${S.entities.toLocaleString('en-US')}; ${S.snapMs} ms in the vm)`, !started.taken && started.busy && cmp.snapTick && S.flat * 10 > S.entities * 9, { started, snapMs: S.snapMs });
  ok(`the match played ${cmp.ticks} ticks during the ${S.slices.length} slices and changed in every way, and the text is the one-shot save of the snapshot's moment: ${auto.length.toLocaleString('en-US')} characters`, cmp.same && cmp.changed && cmp.ticks >= 2 && S.slices.length >= 2 && info.chars === auto.length && info.slot === 'auto', { cmp, info, ms: S.ms });
  // the vm runs the game 2-12x slower than the browser; the browser's 8 ms is checked in tests/browser/saves.spec.js
  const maxAll = Math.max(...S.slices);
  ok(`no slice runs long: the longest took ${maxAll} ms in the vm (budget 8 ms a slice in the browser)`, maxAll < 80, S.slices);
  // stats hold every task but the snapshot: the rehearsal's first, then the slices, the join and the write (IndexedDB's put)
  const R = S.rehearsal, L = S.slices.length, num = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  const statsOk = Array.isArray(R) && R.length >= 2 && JSON.stringify(S.slices.slice(0, R.length)) === JSON.stringify(R) && S.rehearseMs === Math.max(...R)
    && S.slices[L - 2] === S.joinMs && num(S.joinMs) && num(S.putMs) && num(S.slices[L - 1]) && S.tailMs === Math.max(S.joinMs, S.slices[L - 1])
    && S.hold === Math.max(...S.slices) && [S.walkMs, S.packMs, S.jsonMs].every(num) && A.run(`Store.timing.saves.at > 0`);
  ok(`stats time the rehearsal (${R.length} tasks, longest ${S.rehearseMs} ms) and the tail (join ${S.joinMs} ms, write ${S.slices[L - 1]} ms, put ${S.putMs} ms) among the slices: hold ${S.hold} ms`, statsOk, { rehearsal: R, joinMs: S.joinMs, putMs: S.putMs, tailMs: S.tailMs, hold: S.hold, walkMs: S.walkMs, packMs: S.packMs, jsonMs: S.jsonMs });
  A.run('delete W.probe; delete W.changed');
  // the shared reference survives the snapshot copy and the save: a loaded mid-path unit's mvAt is its path[pi]
  const B = page(fakeIndexedDB()); B.run(scene(96, 2, 0)); B.c.__auto = auto;
  const mv = JSON.parse(B.run(`(() => { MatchSave.restore(__auto); const u = W.list.find(e => e.id === ${A.run('__mvId')}); return JSON.stringify({ pi: u.pi, same: u.mvAt === u.path[u.pi], len: u.path.length }); })()`));
  ok('after an autosave and load, a mid-path unit keeps mvAt === path[pi]', mv.pi === 1 && mv.same && mv.len === 3, mv);

  // ---------- 2. manual slots ----------
  const M = JSON.parse(await A.run(`(async () => {
    W.players[1].res.gold = 4321; await MatchSave.saveTo('3', MatchSave.serialize());
    W.players[1].res.gold = 1; const text = await MatchSave.loadFrom('3'); MatchSave.restore(text);
    const infos = await MatchSave.slotInfos(); let bad = '';
    try { await MatchSave.saveTo('9', 'x'); } catch (e) { bad = e.message; }
    return JSON.stringify({ gold: W.players[1].res.gold, filled: Object.keys(infos).filter(k => infos[k]), label: MatchSave.slotLabel('3', infos['3']).slice(0, 8), empty: MatchSave.slotLabel('2', infos['2']), bad });
  })()`));
  ok('a save in slot 3 loads back exactly; the slot list knows slot 3 and the autosave, and names empty slots', M.gold === 4321 && JSON.stringify(M.filled) === '["3","auto"]' && M.label === 'Slot 3 ·' && M.empty === 'Slot 2 · empty' && M.bad === 'Unknown save slot.', M);

  // ---------- 3. every failure shows a message ----------
  const F = page(fakeIndexedDB({ quota: 1000 }));
  F.run(scene(96, 2, 0));
  const msgs = [];
  for (let k = 0; k < 2; k++) { F.run('W.nextAutosave = W.t; worldTick(0.05);'); await settled(F.run); msgs.push(F.run(`W.msgs.filter(m => m.text.startsWith('Autosave failed')).length`)); }
  const text0 = F.run(`W.msgs.filter(m => m.text.startsWith('Autosave failed'))[0].text`);
  ok(`two failed autosaves (storage quota) show two messages, naming the error, and the match plays on: "${text0}"`, msgs[0] === 1 && msgs[1] === 2 && /quota/i.test(text0) && F.run('!W.over && W.autosaveError === true'), msgs);
  // a value no save can hold, in a flat record: the one-shot save refuses it, and the autosave fails with the same message
  const bad = F.run(`(() => { const t = W.list.find(e => e.kind === 'res'); t.amount = NaN; let e1 = ''; try { MatchSave.serialize(); } catch (e) { e1 = e.message; } return e1; })()`);
  F.run('W.nextAutosave = W.t; worldTick(0.05);'); await settled(F.run);
  const text1 = F.run(`W.msgs.filter(m => m.text.startsWith('Autosave failed')).pop().text`);
  ok(`a non-finite value fails the autosave as it fails the one-shot save ("${bad}")`, bad === 'Cannot save non-finite state.' && text1.includes(bad), text1);

  // ---------- 4. gzip export and import ----------
  const Z = JSON.parse(await A.run(`(async () => {
    const text = MatchSave.serialize(), blob = await gzipText(text), head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    const back = await readTextFile(blob), plain = await readTextFile(new Blob([text]));
    const cap = CODEC.cap; CODEC.cap = 100000; let bomb = '';
    try { await readTextFile(await gzipText(' '.repeat(200000))); } catch (e) { bomb = e.message; } finally { CODEC.cap = cap; }
    return JSON.stringify({ chars: text.length, gz: blob.size, magic: head[0] === 0x1f && head[1] === 0x8b, same: back === text, plain: plain === text, bomb });
  })()`));
  ok(`a gzip export (${Z.gz.toLocaleString('en-US')} bytes for ${Z.chars.toLocaleString('en-US')} characters) imports back to the same text; a plain .json still imports`, Z.magic && Z.same && Z.plain && Z.gz * 3 < Z.chars, Z);
  ok('a small gzip file that inflates past the sanity cap is refused while it is read', Z.bomb === 'File is too large.', Z.bomb);

  // ---------- 5. one autosave at a time, and only of the match it started in ----------
  let unhandled = 0; const onUnhandled = () => { unhandled++; }; process.on('unhandledRejection', onUnhandled);
  const until = (run, expr) => new Promise(resolve => { const t = () => (run(expr) ? resolve() : setTimeout(t, 0)); t(); });
  // a second autosave while one runs is refused at once, and the hook postpones its own: nothing interleaves
  const idbB = fakeIndexedDB(), C = page(idbB);
  C.run(scene(128, 2, 0));
  C.run('W.nextAutosave = W.t; worldTick(0.05); globalThis.__first = MatchSave.stats;');
  const second = await C.run('MatchSave.busy ? MatchSave.autosave().then(v => JSON.stringify({ v, busy: MatchSave.busy, stats: MatchSave.stats === __first })) : "not busy"');
  C.run('W.nextAutosave = W.t - 1; globalThis.__due = W.nextAutosave; worldTick(0.05);');   // due again while busy: the hook waits
  const held = C.run('JSON.stringify({ busy: MatchSave.busy, kept: W.nextAutosave === __due })');
  await settled(C.run);
  const puts1 = idbB.stats.puts;
  C.run('worldTick(0.05)');   // the postponed autosave starts on the next tick
  const restarted = C.run('MatchSave.busy');
  await settled(C.run);
  ok(`a second autosave while one runs resolves false at once (${second}); the hook keeps its due autosave (${held}) and runs it after: ${puts1} then ${idbB.stats.puts} puts`, JSON.parse(second).v === false && JSON.parse(second).busy === true && JSON.parse(held).busy && JSON.parse(held).kept && puts1 === 2 && restarted === true && idbB.stats.puts === 4, { second, held, puts1, puts: idbB.stats.puts });
  // the match is replaced mid-slice (a load): the autosave stops, writes nothing and tells nothing, on either match
  const idbD = fakeIndexedDB(), D = page(idbD);
  D.run(scene(128, 2, 0)); D.c.__other = D.run('MatchSave.serialize()');
  D.run('MatchSave.sliceMs = 0.2; globalThis.__w0 = W; globalThis.__r = "pending"; MatchSave.autosave().then(v => { __r = v; }, e => { __r = "rejected " + e.message; });');
  await until(D.run, 'MatchSave.stats !== null && MatchSave.stats.slices.length >= MatchSave.stats.rehearsal.length + 2 || !MatchSave.busy');   // two of the walk's slices have run
  D.run('globalThis.__mid = MatchSave.stats.slices.length - MatchSave.stats.rehearsal.length; MatchSave.restore(__other);');
  await settled(D.run);
  const rep = JSON.parse(await D.run(`Store.get('saves', 'auto').then(t => JSON.stringify({ r: __r, written: t !== undefined, msgs: [...__w0.msgs, ...W.msgs].filter(m => m.text.startsWith('Autosave')).length, err: W.autosaveError === undefined && __w0.autosaveError === undefined, busy: MatchSave.busy, mid: __mid, slices: MatchSave.stats.slices.length }))`));
  ok(`a match replaced during the slices (after ${rep.mid} of them) stops the autosave: nothing written, no message, no error flag on either match, not busy`, rep.mid >= 2 && rep.r === false && !rep.written && rep.msgs === 0 && rep.err && rep.busy === false, rep);
  // W gone (null) mid-slice: the same, and the hook's promise never rejects unhandled
  D.run('W.nextAutosave = W.t; worldTick(0.05);');
  await until(D.run, 'MatchSave.stats !== null && MatchSave.stats.tick === W.tick && MatchSave.stats.slices.length >= MatchSave.stats.rehearsal.length + 2 || !MatchSave.busy');
  D.run('globalThis.__keep = W; W = null;');
  await settled(D.run);
  await new Promise(r => setTimeout(r, 50));   // let any unhandled rejection surface
  const gone = JSON.parse(await D.run(`Store.get('saves', 'auto').then(t => JSON.stringify({ written: t !== undefined, busy: MatchSave.busy }))`));
  D.run('W = __keep; MatchSave.sliceMs = 6;');
  // and the autosave after an aborted one runs as usual
  D.run('W.nextAutosave = W.t; worldTick(0.05);'); await settled(D.run);
  const after = await D.run(`Store.get('saves', 'auto').then(t => typeof t === 'string' && t.length > 1000)`);
  ok(`W set to null mid-slice: nothing written, not busy, ${unhandled} unhandled rejections; the next autosave writes as usual`, !gone.written && !gone.busy && unhandled === 0 && after === true, { gone, unhandled, after });
  process.off('unhandledRejection', onUnhandled);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e.stack || e)); process.exit(1); });
