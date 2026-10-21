// ===== Storage: the IndexedDB database 'aor', with localStorage when IndexedDB is unavailable =====
// Loaded before map.js. Stores: 'saves' (match saves: manual slots '1'-'5' and 'auto'), 'maps' (editor maps by name)
// and 'meta' (small records: a summary per save slot, the migration flag). Keys are strings. Every call returns a
// promise. Store.mode says which backend answered: 'idb', 'local' (localStorage keys 'aor:<store>:<key>', values as
// JSON) or 'none' (no storage at all: every call rejects). localStorage keeps only settings once phase 4's migration
// has moved the old saves and maps (session.js).
'use strict';
const Store = {
  name: 'aor', version: 1, stores: ['saves', 'maps', 'meta'],
  mode: null, db: null, opening: null,
  // opens the database once; resolves with the mode
  open() {
    if (this.opening) return this.opening;
    const fallback = () => (this.mode = this.localOk() ? 'local' : 'none');
    this.opening = new Promise(resolve => {
      let idb = null; try { idb = typeof indexedDB !== 'undefined' ? indexedDB : null; } catch (e) { idb = null; }
      if (!idb) { resolve(fallback()); return; }
      let req; try { req = idb.open(this.name, this.version); } catch (e) { resolve(fallback()); return; }
      req.onupgradeneeded = () => { const db = req.result; for (const s of this.stores) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); };
      req.onsuccess = () => {
        this.db = req.result; this.mode = 'idb';
        this.db.onversionchange = () => { this.db.close(); this.db = null; this.opening = null; };   // another tab upgrades: reopen on the next call
        resolve('idb');
      };
      req.onerror = () => resolve(fallback());
      req.onblocked = () => resolve(fallback());
    });
    return this.opening;
  },
  localOk() { try { localStorage.setItem('aor:probe', '1'); localStorage.removeItem('aor:probe'); return true; } catch (e) { return false; } },
  check(store, key) {
    if (!this.stores.includes(store)) throw new Error('Unknown store ' + store + '.');
    if (key !== undefined && (typeof key !== 'string' || !key.length || key.length > 200)) throw new Error('Invalid storage key.');
  },
  // one request in its own transaction: resolves with the request's result once the transaction has completed
  async tx(store, mode, fn) {
    if (!this.db) { this.opening = null; if ((await this.open()) !== 'idb') throw new Error('Storage is unavailable in this browser.'); }
    return new Promise((resolve, reject) => {
      let t, r;
      try { t = this.db.transaction(store, mode); r = fn(t.objectStore(store)); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(t.error || r.error || new Error('Storage failed.'));
      t.onabort = () => reject(t.error || new Error('Storage failed.'));
    });
  },
  async get(store, key) {
    this.check(store, key); const mode = await this.open();
    if (mode === 'idb') return this.tx(store, 'readonly', s => s.get(key));
    if (mode === 'local') { const v = localStorage.getItem('aor:' + store + ':' + key); return v === null ? undefined : JSON.parse(v); }
    throw new Error('Storage is unavailable in this browser.');
  },
  async put(store, key, value) {
    this.check(store, key); const mode = await this.open();
    if (mode === 'idb') { await this.tx(store, 'readwrite', s => s.put(value, key)); return; }
    if (mode === 'local') { localStorage.setItem('aor:' + store + ':' + key, JSON.stringify(value)); return; }
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
