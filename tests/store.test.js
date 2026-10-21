// Storage module (game/js/store.js): IndexedDB 'aor' with the stores saves, maps and meta, and the localStorage
// fallback, against the in-memory shims of tests/fake-idb.js.   node tests/store.test.js
const harness = require('./engine-harness');
const { fakeIndexedDB, fakeLocalStorage } = require('./fake-idb');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const err = p => p.then(() => 'resolved', e => (e && e.name ? e.name + ': ' : '') + (e && e.message));
(async () => {
  // ---------- 1. IndexedDB: the three stores, round trips, keys, delete, and a second page that sees the data ----------
  const idb = fakeIndexedDB();
  const A = harness(); A.c.indexedDB = idb; A.c.localStorage = fakeLocalStorage();
  const mode = await A.run('Store.open()');
  const big = 'x'.repeat(6 * 1024 * 1024);   // a 6 M-character save: more than the whole localStorage quota
  A.c.__big = big;
  await A.run(`Promise.all([Store.put('saves', '1', __big), Store.put('saves', 'auto', 'second'), Store.put('maps', 'My Map', { n: 16, ter: [1, 2, 3] }), Store.put('meta', 'save:1', { chars: __big.length })])`);
  const got = await A.run(`Promise.all([Store.get('saves', '1'), Store.get('maps', 'My Map'), Store.get('saves', 'nothing'), Store.keys('saves'), Store.keys('maps')]).then(r => JSON.stringify([r[0].length, r[1], r[2] === undefined, r[3], r[4]]))`);
  const stores = [...idb.dbs.get('aor').stores.keys()].sort();
  ok('IndexedDB: database aor at version 1 with the stores maps, meta and saves', mode === 'idb' && idb.dbs.get('aor').version === 1 && JSON.stringify(stores) === '["maps","meta","saves"]', { mode, stores });
  ok('a 6 M-character save, a map object and a missing key round trip; keys come sorted', got === JSON.stringify([big.length, { n: 16, ter: [1, 2, 3] }, true, ['1', 'auto'], ['My Map']]), got);
  await A.run(`Store.del('saves', 'auto')`);
  const B = harness(); B.c.indexedDB = idb;   // another page load: the data is still there
  const later = await B.run(`Promise.all([Store.keys('saves'), Store.get('saves', '1')]).then(r => JSON.stringify([r[0], r[1].length, Store.mode]))`);
  ok('after a delete, a new page opens the same database and reads what the first one wrote', later === JSON.stringify([['1'], big.length, 'idb']), later);
  ok('nothing was written to localStorage while IndexedDB works', A.c.localStorage.length === 0, A.c.localStorage.length);

  // ---------- 2. a failing put rejects with the browser's error, and nothing half-written is kept ----------
  const Q = harness(); Q.c.indexedDB = fakeIndexedDB({ quota: 1024 * 1024 }); Q.c.__big = big;
  const qe = await err(Q.run(`Store.put('saves', '2', __big)`));
  const qk = await Q.run(`Store.keys('saves').then(k => JSON.stringify(k))`);
  ok('a put past the quota rejects with QuotaExceededError and leaves no key behind', qe.startsWith('QuotaExceededError') && qk === '[]', { qe, qk });

  // ---------- 3. no IndexedDB: localStorage keys aor:<store>:<key> ----------
  const L = harness(); L.c.localStorage = fakeLocalStorage(); L.c.indexedDB = fakeIndexedDB({ failOpen: true });
  const lm = await L.run('Store.open()');
  await L.run(`Promise.all([Store.put('saves', '3', 'third'), Store.put('maps', 'm', { a: 1 }), Store.put('meta', 'save:3', { chars: 5 })])`);
  const lr = await L.run(`Promise.all([Store.get('saves', '3'), Store.get('maps', 'm'), Store.keys('saves'), Store.keys('meta')]).then(r => JSON.stringify(r))`);
  const raw = L.c.localStorage.getItem('aor:saves:3');
  ok('IndexedDB failing to open falls back to localStorage, with JSON values under aor:<store>:<key>', lm === 'local' && lr === JSON.stringify(['third', { a: 1 }, ['3'], ['save:3']]) && raw === '"third"', { lm, lr, raw });
  const L2 = harness(); L2.c.localStorage = fakeLocalStorage(1000);
  const le = await err(L2.run(`Store.put('saves', '1', 'y'.repeat(2000))`));
  ok('without IndexedDB at all, a save past the localStorage quota rejects with QuotaExceededError', le.startsWith('QuotaExceededError'), le);

  // ---------- 4. no storage at all, and bad arguments ----------
  const N = harness();
  const nm = await N.run('Store.open()'), ne = await err(N.run(`Store.get('saves', '1')`));
  ok('with neither IndexedDB nor localStorage every call rejects with a clear message', nm === 'none' && ne.includes('Storage is unavailable'), { nm, ne });
  const be = await err(A.run(`Store.put('nope', 'k', 1)`)), ke = await err(A.run(`Store.get('saves', '')`));
  ok('an unknown store or an empty key is refused', be.includes('Unknown store') && ke.includes('Invalid storage key'), { be, ke });
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e.stack || e)); process.exit(1); });
