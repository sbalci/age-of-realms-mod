// The '.' key, the top-bar counter and the minimap button share one idle-villager definition.
const assert = require('assert');
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
function test(name, code) {
  try { assert.strictEqual(run(code), true); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.error('FAIL ' + name, e); }
}
run(`
  var __els = {};
  // ui.js reads the DOM through document.querySelector; give it throwaway elements while a test runs.
  function withDom(fn) {
    globalThis.document = { querySelector: sel => __els[sel] || (__els[sel] = { textContent: '', style: {}, classList: { contains: () => true, toggle() {}, add() {}, remove() {} }, remove() {} }) };
    try { return fn(); } finally { delete globalThis.document; }
  }
  function threeIdle() {
    make(5); const vs = W.list.filter(e => e.owner === W.humanId && e.type === 'villager');
    for (const v of vs) { v.order = null; v.queue = []; }
    return vs;
  }
`);
test("first '.' press selects the first idle villager in exIdleList order", `withDom(() => {
  threeIdle(); UI.idleIdx = undefined; UI.selection = [];
  const list = exIdleList('vil'); if (list.length < 3) return false;
  onKey({ key: '.', shiftKey: false, preventDefault() {} });
  const first = UI.selection.length === 1 && UI.selection[0] === list[0];
  onKey({ key: '.', shiftKey: false, preventDefault() {} });
  return first && UI.selection[0] === list[1];
})`);
test("Shift+'.' selects every idle villager", `withDom(() => {
  threeIdle(); UI.selection = [];
  const list = exIdleList('vil');
  onKey({ key: '.', shiftKey: true, preventDefault() {} });
  return UI.selection.length === list.length && list.every(u => UI.selection.includes(u));
})`);
test('the top-bar idle count agrees with exIdleList', `withDom(() => {
  const vs = threeIdle(); vs[0].order = { t: 'move', x: 1, y: 1 };
  __els = {}; try { updateTopbar(); } catch (e) {}
  return __els['#r-vil span'].textContent === exIdleList('vil').length && exIdleList('vil').length === vs.length - 1;
})`);
console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
