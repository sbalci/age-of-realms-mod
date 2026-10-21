// A small in-memory IndexedDB and localStorage for node tests of game/js/store.js (tests/store.test.js and the save
// and editor suites). Only what store.js uses: indexedDB.open with onupgradeneeded, db.objectStoreNames.contains,
// createObjectStore, single-store transactions with get, put, delete and getAllKeys, and the request and transaction
// events, each fired on a later turn of the event loop as a browser does. Values are kept as structured clones.
//   const { fakeIndexedDB, fakeLocalStorage } = require('./fake-idb');
//   c.indexedDB = fakeIndexedDB({ quota });   // c: the vm context of tests/engine-harness.js
// Options: quota (bytes per stored value, roughly: strings count 2 per character; a bigger put fails with a
// QuotaExceededError), failOpen (open fails, so store.js falls back to localStorage).
'use strict';
const later = fn => setImmediate(fn);
const sizeOf = v => typeof v === 'string' ? v.length * 2 : JSON.stringify(v === undefined ? null : v).length * 2;
function quotaError() { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; return e; }
function fakeIndexedDB(opts = {}) {
  const dbs = new Map();   // name -> { version, stores: Map(store -> Map(key -> value)) }
  const stats = { puts: 0, gets: 0, opens: 0 };
  function db(rec) {
    return {
      objectStoreNames: { contains: n => rec.stores.has(n) },
      createObjectStore(n) { rec.stores.set(n, new Map()); return {}; },
      close() { },
      onversionchange: null,
      transaction(names, mode) {
        for (const n of [].concat(names)) if (!rec.stores.has(n)) { const e = new Error('No object store ' + n); e.name = 'NotFoundError'; throw e; }
        const t = { oncomplete: null, onerror: null, onabort: null, error: null, open: 0, over: false };
        const settle = () => { if (!t.open && !t.over) { t.over = true; later(() => t.oncomplete && t.oncomplete()); } };
        t.objectStore = n => {
          const m = rec.stores.get(n);
          const op = f => {
            const r = { result: undefined, error: null, onsuccess: null, onerror: null }; t.open++;
            later(() => {
              try { r.result = f(); } catch (e) { r.error = t.error = e; t.over = true; if (r.onerror) r.onerror(); if (t.onerror) t.onerror(); return; }
              if (r.onsuccess) r.onsuccess(); t.open--; settle();
            });
            return r;
          };
          return {
            get: k => op(() => { stats.gets++; return m.has(k) ? structuredClone(m.get(k)) : undefined; }),
            put: (v, k) => op(() => { if (mode !== 'readwrite') throw new Error('ReadOnlyError'); if (opts.quota && sizeOf(v) > opts.quota) throw quotaError(); stats.puts++; m.set(k, structuredClone(v)); return k; }),
            delete: k => op(() => { if (mode !== 'readwrite') throw new Error('ReadOnlyError'); m.delete(k); }),
            getAllKeys: () => op(() => [...m.keys()].sort()),
          };
        };
        later(settle);   // a transaction that makes no request completes too
        return t;
      },
    };
  }
  return {
    stats, dbs,
    open(name, version) {
      const r = { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      later(() => {
        stats.opens++;
        if (opts.failOpen) { r.error = new Error('open failed'); if (r.onerror) r.onerror(); return; }
        let rec = dbs.get(name); if (!rec) dbs.set(name, rec = { version: 0, stores: new Map() });
        r.result = db(rec);
        if (version > rec.version) { const old = rec.version; rec.version = version; if (r.onupgradeneeded) r.onupgradeneeded({ oldVersion: old, newVersion: version }); }
        if (r.onsuccess) r.onsuccess();
      });
      return r;
    },
  };
}
// localStorage with a quota in characters (keys and values), like Chromium's 5,242,880
function fakeLocalStorage(quota = 5242880) {
  const m = new Map(), used = () => { let s = 0; for (const [k, v] of m) s += k.length + v.length; return s; };
  return {
    get length() { return m.size; },
    key: i => [...m.keys()][i] ?? null,
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { v = String(v); const old = m.has(k) ? k.length + m.get(k).length : 0; if (used() - old + k.length + v.length > quota) throw quotaError(); m.set(k, v); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
  };
}
module.exports = { fakeIndexedDB, fakeLocalStorage };
