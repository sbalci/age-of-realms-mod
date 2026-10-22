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
  await Q.run(`Store.put('saves', '1', 'small')`);
  const qe = await err(Q.run(`Store.put('saves', '2', __big)`));
  const qk = await Q.run(`Promise.all([Store.keys('saves'), Store.get('saves', '1')]).then(r => JSON.stringify(r))`);
  ok('a put past the quota rejects with QuotaExceededError; the earlier save is untouched and no key is left behind', qe.startsWith('QuotaExceededError') && qk === '[["1"],"small"]', { qe, qk });
  const C = harness(); C.c.indexedDB = fakeIndexedDB({ commitQuota: 1024 * 1024 }); C.c.__big = big;
  await C.run(`Store.put('saves', '1', 'small')`);
  const ce = await err(C.run(`Store.put('saves', '2', __big)`));
  const ck = await C.run(`Promise.all([Store.keys('saves'), Store.get('saves', '2')]).then(r => JSON.stringify(r))`);
  ok('a transaction aborted at commit rejects with its QuotaExceededError and keeps nothing', ce.startsWith('QuotaExceededError') && ck === '[["1"],null]', { ce, ck });

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
  // ---------- 5. the backend is chosen once: blocked, hung and late opens ----------
  const tick = ms => new Promise(r => setTimeout(r, ms));
  const mk = (idb, ls) => {
    const h = harness(); h.c.setTimeout = setTimeout; h.c.clearTimeout = clearTimeout;
    if (idb) h.c.indexedDB = idb;
    if (ls) h.c.localStorage = ls;
    return h;
  };
  const idbBl = fakeIndexedDB({ blocked: true }), BL = mk(idbBl, fakeLocalStorage());
  const blOpen = BL.run('Store.open()');
  await tick(30); idbBl.release();   // the other tab let go: the open succeeds late, inside the timeout
  const blMode = await blOpen;
  await BL.run(`Store.put('saves', 'a', 'in idb')`);
  ok('a blocked open that succeeds in time is used: IndexedDB consistently, nothing in localStorage', blMode === 'idb' && idbBl.dbs.get('aor').stores.get('saves').get('a') === 'in idb' && BL.c.localStorage.length === 0, { blMode });

  const idbNe = fakeIndexedDB({ blocked: true }), NE = mk(idbNe, fakeLocalStorage());
  await NE.run('Store.openTimeout = 40');
  const t0 = Date.now(), neMode = await NE.run('Store.open()'), took = Date.now() - t0;
  const neReason = await NE.run('Store.reason');
  idbNe.release();   // the open succeeds after the fallback was chosen: closed and ignored
  await tick(30);
  await NE.run(`Store.put('saves', 'b', 'in local')`);
  ok('a blocked open that never succeeds falls back to localStorage after the timeout, with a reason', neMode === 'local' && took >= 30 && took < 2000 && /did not open within 40 ms/.test(neReason), { neMode, took, neReason });
  ok('a late success after the fallback is closed and ignored: the backend never switches mid-session',
    idbNe.conns.size === 0 && idbNe.stats.closes === 1 && await NE.run('Store.mode') === 'local' && await NE.run('Store.db === null') && NE.c.localStorage.getItem('aor:saves:b') === '"in local"' && idbNe.dbs.get('aor').stores.get('saves').size === 0, { closes: idbNe.stats.closes });

  const idbHg = fakeIndexedDB({ hang: true }), HG = mk(idbHg, fakeLocalStorage());
  await HG.run('Store.openTimeout = 40');
  const hgGet = await HG.run(`Store.put('saves', '1', 'x').then(() => Store.get('saves', '1'))`);
  ok('an open that never answers does not hang the calls: they use localStorage after the timeout', hgGet === 'x' && await HG.run('Store.mode') === 'local' && HG.c.localStorage.getItem('aor:saves:1') === '"x"', hgGet);
  ok('the fallback is for the whole page: a second open() answers local without trying again', await HG.run('Store.open()') === 'local' && idbHg.stats.opens === 1, idbHg.stats.opens);

  // ---------- 6. lost connections: versionchange, abnormal close, a stale connection, concurrent opens ----------
  const idbV = fakeIndexedDB(), V = mk(idbV, fakeLocalStorage());
  await V.run(`Store.put('saves', '1', 'kept')`);
  const first = [...idbV.conns][0], firstHandler = first.onversionchange;
  idbV.versionChange();
  ok('versionchange closes the connection the event fired on and clears it', first.closed && idbV.conns.size === 0 && await V.run('Store.db === null'));
  const afterV = await V.run(`Store.get('saves', '1')`);
  const second = [...idbV.conns][0];
  ok('the next call reopens the database and reads the same data', afterV === 'kept' && idbV.stats.opens === 2 && second && second !== first, { opens: idbV.stats.opens });
  firstHandler({ target: first });   // a late event of the old connection must not drop the new one
  ok('a versionchange event of an old connection leaves the current connection alone', !second.closed && await V.run('Store.db !== null') && await V.run(`Store.get('saves', '1')`) === 'kept' && idbV.stats.opens === 2);

  idbV.abnormalClose();
  ok('onclose (an abnormal close) clears the connection; the next call reopens', await V.run('Store.db === null') && await V.run(`Store.get('saves', '1')`) === 'kept' && idbV.stats.opens === 3, idbV.stats.opens);
  idbV.abnormalClose({ silent: true });   // dead, but nobody was told
  const stale = await V.run(`Store.put('saves', '2', 'again').then(() => Store.get('saves', '2'))`);
  ok('a transaction on a stale connection (InvalidStateError) reopens once and retries once', stale === 'again' && idbV.stats.opens === 4 && V.c.localStorage.length === 0, idbV.stats.opens);
  idbV.abnormalClose(); idbV.failNext(1);
  const re = await err(V.run(`Store.get('saves', '1')`)), re2 = await V.run(`Store.get('saves', '1')`);
  ok('a reopen that fails rejects (the mode does not switch to localStorage); the next call retries and succeeds',
    re.includes('IndexedDB failed to open') && re2 === 'kept' && await V.run('Store.mode') === 'idb' && V.c.localStorage.length === 0, { re, re2 });

  const idbR = fakeIndexedDB(), R = mk(idbR, fakeLocalStorage());
  await R.run('Store.open()');
  const o0 = idbR.stats.opens;
  await R.run(`Promise.all([1, 2, 3, 4, 5].map(i => Store.put('saves', String(i), i)))`);
  idbR.versionChange();
  await R.run(`Promise.all([1, 2, 3, 4, 5].map(i => Store.get('saves', String(i))))`);
  ok('concurrent callers share one pending open, also after a lost connection', o0 === 1 && idbR.stats.opens === 2, { o0, opens: idbR.stats.opens });
  const idbF = fakeIndexedDB(), F0 = mk(idbF, fakeLocalStorage());
  await F0.run(`Promise.all([1, 2, 3].map(() => Store.get('saves', '1')))`);
  ok('concurrent first calls open the database once', idbF.stats.opens === 1, idbF.stats.opens);

  // ---------- 7. localStorage: a full one is still readable; bad values; local del and keys; reasons ----------
  const full = fakeLocalStorage(200); full.setItem('aor:saves:1', JSON.stringify('x'.repeat(150)));
  const FU = mk(null, full);
  const fm = await FU.run('Store.open()'), fg = await FU.run(`Store.get('saves', '1')`), fe = await err(FU.run(`Store.put('saves', '2', 'y'.repeat(100))`));
  ok('a completely full localStorage is available: reads work, a write rejects with the quota error', fm === 'local' && fg.length === 150 && fe.startsWith('QuotaExceededError'), { fm, fe });
  await FU.run(`Store.del('saves', '1')`);
  ok('local del frees the key and keys lists what is left', JSON.stringify(await FU.run(`Store.keys('saves')`)) === '[]' && await FU.run(`Store.get('saves', '1')`) === undefined);

  const LC = mk(null, fakeLocalStorage());
  LC.c.localStorage.setItem('aor:saves:9', '{broken'); LC.c.localStorage.setItem('aor:saves:2', '"two"'); LC.c.localStorage.setItem('aor:maps:z', '1'); LC.c.localStorage.setItem('other', '1');
  const ue = await err(LC.run(`Store.put('saves', '3', undefined)`)), fn = await err(LC.run(`Store.put('saves', '3', () => 1)`));
  const ce2 = await err(LC.run(`Store.get('saves', '9')`));
  ok('a local put of undefined or a function rejects clearly and stores nothing', /Cannot store aor:saves:3/.test(ue) && /Cannot store aor:saves:3/.test(fn) && LC.c.localStorage.getItem('aor:saves:3') === null, { ue, fn });
  ok('a corrupt local value rejects with an error that names the key', ce2.includes('aor:saves:9') && ce2.includes('corrupt') && !ce2.includes('SyntaxError'), ce2);
  await LC.run(`Store.del('saves', '2')`);
  ok('local keys lists only the store\'s own keys, sorted; del removes one', JSON.stringify(await LC.run(`Store.keys('saves')`)) === '["9"]' && JSON.stringify(await LC.run(`Store.keys('maps')`)) === '["z"]');

  const NO = harness();
  const none = await Promise.all([err(NO.run(`Store.put('saves', '1', 1)`)), err(NO.run(`Store.del('saves', '1')`)), err(NO.run(`Store.keys('saves')`))]);
  ok('with no storage at all put, del and keys reject with the clear message too', none.every(m => m.includes('Storage is unavailable')), none);

  const rs = [await mk(fakeIndexedDB(), fakeLocalStorage()).run('Store.open().then(() => Store.reason)'),
    await mk(null, fakeLocalStorage()).run('Store.open().then(() => Store.reason)'),
    await mk(fakeIndexedDB({ failOpen: true }), fakeLocalStorage()).run('Store.open().then(() => Store.reason)'),
    await mk(null, null).run('Store.open().then(() => Store.reason)')];
  ok('Store.reason is empty while IndexedDB works and says why the fallback was chosen otherwise',
    rs[0] === '' && /not available/.test(rs[1]) && /failed to open/.test(rs[2]) && /not available/.test(rs[3]) && /localStorage is unavailable/.test(rs[3]), rs);
  const FR = mk(fakeIndexedDB({ failOpen: 1 }), fakeLocalStorage());
  const fr1 = await FR.run('Store.open()'), fr2 = await FR.run('Store.open()');
  ok('a first open that fails stays on localStorage for the page: open() does not retry into IndexedDB', fr1 === 'local' && fr2 === 'local' && FR.c.indexedDB.stats.opens === 1);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e.stack || e)); process.exit(1); });
