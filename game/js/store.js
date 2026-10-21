// ===== Storage: the IndexedDB database 'aor', with localStorage when IndexedDB is unavailable =====
// Loaded before map.js. Stores: 'saves' (match saves: manual slots '1'-'5' and 'auto'), 'maps' (editor maps by name)
// and 'meta' (small records: a summary per save slot, the migration flag). Keys are strings. Every call returns a
// promise. Store.mode says which backend answered: 'idb', 'local' (localStorage keys 'aor:<store>:<key>', values as
// JSON) or 'none' (no storage at all: every call rejects). Store.reason says in a few words why the fallback was
// chosen ('' while IndexedDB works). localStorage keeps only settings once phase 4's migration has moved the old
// saves and maps (session.js).
// The backend is chosen once per page: a first open that fails, stays blocked or does not answer within
// STORE_OPEN_TIMEOUT_MS falls back to localStorage for good (a late success is closed and ignored), so data never
// splits between the two. After IndexedDB has worked, a lost connection (another tab's upgrade, an abnormal close) is
// reopened on the next call; if that fails the call rejects and the next call tries again.
'use strict';
const STORE_OPEN_TIMEOUT_MS = 5000;
const Store = {
  name: 'aor', version: 1, stores: ['saves', 'maps', 'meta'],
  mode: null, reason: '', db: null, opening: null, openTimeout: STORE_OPEN_TIMEOUT_MS,
  // timing[store]: the store's last put, { key, ms, at }: how long the put call itself took (IndexedDB's copy of the
  // value, or localStorage's write) and performance.now() as it returned. The autosave reports it.
  timing: {},
  clock() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); },
  // opens the database once (concurrent callers share the pending open); resolves with the mode
  open() {
    if (!this.opening) {
      const p = this.opening = this.connect();
      p.catch(() => { if (this.opening === p) this.opening = null; });   // a failed reopen is tried again by the next call
    }
    return this.opening;
  },
  connect() {
    const canFall = this.mode !== 'idb';   // before the first success only: later the backend never changes
    return new Promise((resolve, reject) => {
      let done = false, timer = null;
      const stop = () => { done = true; if (timer !== null) clearTimeout(timer); };
      const fail = why => {
        if (done) return; stop();
        if (canFall) { this.reason = why; this.mode = this.localOk() ? 'local' : 'none'; if (this.mode === 'none') this.reason += ' localStorage is unavailable too.'; resolve(this.mode); }
        else reject(new Error(why));
      };
      const msg = e => (e && e.message) || String(e || 'unknown error');
      let idb = null; try { idb = typeof indexedDB !== 'undefined' ? indexedDB : null; } catch (e) { idb = null; }
      if (!idb) { fail('IndexedDB is not available in this browser.'); return; }
      let req; try { req = idb.open(this.name, this.version); } catch (e) { fail('IndexedDB could not be opened: ' + msg(e)); return; }
      if (typeof setTimeout === 'function') timer = setTimeout(() => fail('IndexedDB did not open within ' + this.openTimeout + ' ms.'), this.openTimeout);
      req.onupgradeneeded = () => { const db = req.result; for (const s of this.stores) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); };
      req.onsuccess = () => {
        const db = req.result;
        if (done) { try { db.close(); } catch (e) { /* already gone */ } return; }   // too late: the fallback is in use
        stop(); this.db = db; this.mode = 'idb'; this.reason = '';
        const lost = () => { if (this.db === db) { this.db = null; this.opening = null; } };   // reopen on the next call
        db.onversionchange = e => { const c = (e && e.target) || db; try { c.close(); } catch (x) { /* already gone */ } if (c === db) lost(); };   // another tab upgrades
        db.onclose = lost;   // the browser closed it abnormally
        resolve('idb');
      };
      req.onerror = () => fail('IndexedDB failed to open: ' + msg(req.error));
      req.onblocked = () => { /* an older connection is open in another tab: keep waiting, the timeout bounds it */ };
    });
  },
  // available means readable; a full localStorage still answers get and keys (a write then rejects)
  localOk() { try { localStorage.getItem('aor:probe'); return true; } catch (e) { return false; } },
  check(store, key) {
    if (!this.stores.includes(store)) throw new Error('Unknown store ' + store + '.');
    if (key !== undefined && (typeof key !== 'string' || !key.length || key.length > 200)) throw new Error('Invalid storage key.');
  },
  // one request in its own transaction: resolves with the request's result once the transaction has completed
  async tx(store, mode, fn, again) {
    if (!this.db) { await this.open(); if (!this.db) throw new Error('Storage is unavailable in this browser.'); }
    const db = this.db;
    return new Promise((resolve, reject) => {
      let t, r;
      try { t = db.transaction(store, mode); r = fn(t.objectStore(store)); }
      catch (e) {
        if (!again && e && e.name === 'InvalidStateError') {   // a stale connection: reopen and retry once
          if (this.db === db) { this.db = null; this.opening = null; }
          try { db.close(); } catch (x) { /* already gone */ }
          resolve(this.tx(store, mode, fn, true)); return;
        }
        reject(e); return;
      }
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(t.error || r.error || new Error('Storage failed.'));
      t.onabort = () => reject(t.error || new Error('Storage failed.'));
    });
  },
  async get(store, key) {
    this.check(store, key); const mode = await this.open();
    if (mode === 'idb') return this.tx(store, 'readonly', s => s.get(key));
    if (mode === 'local') {
      const k = 'aor:' + store + ':' + key, v = localStorage.getItem(k);
      if (v === null) return undefined;
      try { return JSON.parse(v); } catch (e) { throw new Error('The stored value ' + k + ' is corrupt.'); }
    }
    throw new Error('Storage is unavailable in this browser.');
  },
  async put(store, key, value) {
    this.check(store, key); const mode = await this.open();
    if (mode === 'idb') { await this.tx(store, 'readwrite', s => { const q = this.clock(), r = s.put(value, key), at = this.clock(); this.timing[store] = { key, ms: at - q, at }; return r; }); return; }
    if (mode === 'local') {
      const k = 'aor:' + store + ':' + key, json = JSON.stringify(value);
      if (json === undefined) throw new Error('Cannot store ' + k + ': the value cannot be written as JSON.');
      const q = this.clock(); localStorage.setItem(k, json); const at = this.clock(); this.timing[store] = { key, ms: at - q, at }; return;
    }
    throw new Error('Storage is unavailable in this browser.');
  },
  async del(store, key) {
    this.check(store, key); const mode = await this.open();
    if (mode === 'idb') { await this.tx(store, 'readwrite', s => s.delete(key)); return; }
    if (mode === 'local') { localStorage.removeItem('aor:' + store + ':' + key); return; }
    throw new Error('Storage is unavailable in this browser.');
  },
  // the keys of a store, sorted
  async keys(store) {
    this.check(store); const mode = await this.open();
    if (mode === 'idb') return (await this.tx(store, 'readonly', s => s.getAllKeys())).map(String).sort();
    if (mode === 'local') { const p = 'aor:' + store + ':', out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(p)) out.push(k.slice(p.length)); } return out.sort(); }
    throw new Error('Storage is unavailable in this browser.');
  },
};
