// A small in-memory IndexedDB and localStorage for node tests of game/js/store.js (tests/store.test.js and the save
// and editor suites). Only what store.js uses: indexedDB.open with onupgradeneeded, db.objectStoreNames.contains,
// createObjectStore, single-store transactions with get, put, delete and getAllKeys, and the request and transaction
// events, each fired on a later turn of the event loop as a browser does. Values are kept as structured clones.
//   const { fakeIndexedDB, fakeLocalStorage } = require('./fake-idb');
//   c.indexedDB = fakeIndexedDB({ quota });   // c: the vm context of tests/engine-harness.js
// Options (also readable and changeable later as idb.opts): quota (bytes per stored value, roughly: strings count 2
// per character; a bigger put fails with a QuotaExceededError), commitQuota (the same limit, but the request succeeds
// and the transaction aborts at commit), failOpen (true, or a number of opens: they fail, so store.js falls back to
// localStorage), blocked (open fires onblocked and waits), hang (open fires nothing and waits).
// Controls: idb.release() finishes the opens waiting under blocked or hang; idb.failNext(n) fails the next n opens;
// idb.versionChange() fires onversionchange on every open connection; idb.abnormalClose({ silent }) closes them all as
// a browser does after an error, firing onclose unless silent (a transaction on one then throws InvalidStateError);
// idb.conns the open connections; idb.stats { puts, gets, opens, closes }.
'use strict';
const later = fn => setImmediate(fn);
const sizeOf = v => typeof v === 'string' ? v.length * 2 : JSON.stringify(v === undefined ? null : v).length * 2;
function quotaError() { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; return e; }
function fakeIndexedDB(opts = {}) {
  const dbs = new Map();   // name -> { version, stores: Map(store -> Map(key -> value)) }
  const conns = new Set(), waiting = [];
  const stats = { puts: 0, gets: 0, opens: 0, closes: 0 };
  let failures = opts.failOpen === true ? Infinity : (opts.failOpen || 0);
  function db(rec) {
    const d = {
      closed: false,
      objectStoreNames: { contains: n => rec.stores.has(n) },
      createObjectStore(n) { rec.stores.set(n, new Map()); return {}; },
      close() { if (!d.closed) { d.closed = true; conns.delete(d); stats.closes++; } },
      onversionchange: null,
      onclose: null,
      transaction(names, mode) {
        if (d.closed) { const e = new Error('The database connection is closing.'); e.name = 'InvalidStateError'; throw e; }
        for (const n of [].concat(names)) if (!rec.stores.has(n)) { const e = new Error('No object store ' + n); e.name = 'NotFoundError'; throw e; }
        const t = { oncomplete: null, onerror: null, onabort: null, error: null, open: 0, over: false };
        const settle = () => {
          if (t.open || t.over) return;
          t.over = true;
          if (t.aborted) later(() => { t.error = t.aborted; if (t.onabort) t.onabort(); });
          else later(() => t.oncomplete && t.oncomplete());
        };
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
            put: (v, k) => op(() => {
              if (mode !== 'readwrite') throw new Error('ReadOnlyError');
              if (opts.quota && sizeOf(v) > opts.quota) throw quotaError();
              if (opts.commitQuota && sizeOf(v) > opts.commitQuota) { t.aborted = quotaError(); return k; }   // the write is dropped at commit
              stats.puts++; m.set(k, structuredClone(v)); return k;
            }),
            delete: k => op(() => { if (mode !== 'readwrite') throw new Error('ReadOnlyError'); m.delete(k); }),
            getAllKeys: () => op(() => [...m.keys()].sort()),
          };
        };
        later(settle);   // a transaction that makes no request completes too
        return t;
      },
    };
    return d;
  }
  return {
    stats, dbs, opts, conns,
    release() { for (const f of waiting.splice(0)) f(); },
    failNext(n) { failures = n; },
    versionChange() { for (const c of [...conns]) if (c.onversionchange) c.onversionchange({ target: c }); },
    abnormalClose(o = {}) { for (const c of [...conns]) { c.closed = true; conns.delete(c); if (!o.silent && c.onclose) c.onclose({ target: c }); } },
    open(name, version) {
      const r = { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      const finish = () => {
        let rec = dbs.get(name); if (!rec) dbs.set(name, rec = { version: 0, stores: new Map() });
        r.result = db(rec); conns.add(r.result);
        if (version > rec.version) { const old = rec.version; rec.version = version; if (r.onupgradeneeded) r.onupgradeneeded({ oldVersion: old, newVersion: version }); }
        if (r.onsuccess) r.onsuccess();
      };
      later(() => {
        stats.opens++;
        if (failures > 0) { failures--; r.error = new Error('open failed'); if (r.onerror) r.onerror(); return; }
        if (opts.hang) { waiting.push(finish); return; }
        if (opts.blocked) { if (r.onblocked) r.onblocked(); waiting.push(finish); return; }
        finish();
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
