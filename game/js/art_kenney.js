// ===== Optional art style: Kenney CC0 kits, pre-rendered by tools/art/bake-kenney.mjs =====
// Turn on with /game/?art=kenney (remembered in this browser), off with ?art=classic.
// Buildings, trees and mines use the baked sprites; walls, gates, farms and anything without a sprite keep
// the drawn art. Sprites load in the background; until one arrives the drawn version is shown.
'use strict';
const KART = { on: false, img: {}, cache: new Map(), base: 'art/kenney/' };
(function () {
  let v = null;
  try { v = new URLSearchParams(location.search).get('art'); } catch (e) { /* headless */ }
  try { if (v) localStorage.setItem('aor.art', v); else v = localStorage.getItem('aor.art'); } catch (e) { /* storage blocked */ }
  KART.on = v === 'kenney' && typeof KENNEY_ART === 'object' && typeof Image === 'function';
  if (!KART.on) return;
  for (const k of Object.keys(KENNEY_ART)) {
    const im = new Image();
    im.onload = () => { KART.img[k] = im; KART.cache.clear(); };
    im.src = KART.base + k + '.png';
  }
})();

// best sprite name for a type at an age style: exact, else the nearest lower age, else the bare name
function kartKey(type, st) {
  for (let s = st; s >= 0; s--) if (KART.img[type + '_' + s]) return type + '_' + s;
  return KART.img[type] ? type : null;
}
function kartSprite(name, decorate) {
  const m = KENNEY_ART[name], im = KART.img[name];
  const cv = document.createElement('canvas'); cv.width = Math.ceil(m.w * m.SC); cv.height = Math.ceil(m.h * m.SC);
  const g = cv.getContext('2d'); g.drawImage(im, 0, 0, cv.width, cv.height);
  if (decorate) { g.save(); g.scale(m.SC, m.SC); g.translate(m.ax, m.ay); decorate(g); g.restore(); }
  return { cv, ax: m.ax, ay: m.ay, w: m.w, h: m.h, SC: m.SC };
}

if (KART.on && typeof bldSprite === 'function') {
  const _bldSprite = bldSprite;
  bldSprite = function (type, st, pc) {
    const name = kartKey(type, st);
    if (!name) return _bldSprite.apply(this, arguments);
    const key = name + '|' + pc.c;
    let s = KART.cache.get(key);
    if (!s) {
      const size = BUILDINGS[type].size;
      // player colour: a small flag at the front-left corner of the footprint
      s = kartSprite(name, g => flag(g, -size / 2 + 0.12, size / 2 - 0.12, 0, pc.c, 0.3, size >= 3 ? 0.9 : 0.7));
      KART.cache.set(key, s);
    }
    return s;
  };
}
if (KART.on && typeof drawBuilding === 'function') {
  // the drawn mill animates its own sails; the Kenney mill has sails baked in
  const _drawBuilding = drawBuilding;
  drawBuilding = function (ctx, b) {
    if (b.type !== 'mill' || !kartKey('mill', 0)) return _drawBuilding.apply(this, arguments);
    b.type = 'kart_mill';
    try { return _drawBuilding.apply(this, arguments); } finally { b.type = 'mill'; }
  };
  if (typeof BUILDINGS === 'object' && BUILDINGS.mill && !BUILDINGS.kart_mill) Object.defineProperty(BUILDINGS, 'kart_mill', { value: BUILDINGS.mill, enumerable: false });
  if (typeof BLD_H === 'object') BLD_H.kart_mill = BLD_H.mill;
  const _bs = bldSprite;
  bldSprite = function (type, st, pc) { return _bs.call(this, type === 'kart_mill' ? 'mill' : type, st, pc); };
}
if (KART.on && typeof treeSprite === 'function') {
  const _treeSprite = treeSprite;
  const PICK = [['tree_0', 'tree_1', 'tree_2', 'tree_5'], ['tree_3', 'tree_4', 'tree_3', 'tree_4'], ['tree_6', 'tree_6', 'tree_6', 'tree_6']];
  treeSprite = function (v, shadeV) {
    const name = (PICK[v] || PICK[0])[shadeV & 3];
    if (!KART.img[name]) return _treeSprite.apply(this, arguments);
    let s = KART.cache.get(name);
    if (!s) { s = kartSprite(name); KART.cache.set(name, s); }
    return s;
  };
}
if (KART.on && typeof drawRes === 'function') {
  const _drawRes = drawRes;
  drawRes = function (ctx, e) {
    if (e.type !== 'gold' && e.type !== 'stone') return _drawRes.apply(this, arguments);
    const name = e.type + '_' + (e.id & 1);
    if (!KART.img[name]) return _drawRes.apply(this, arguments);
    let s = KART.cache.get(name);
    if (!s) { s = kartSprite(name); KART.cache.set(name, s); }
    const cx = e.x + 0.5, cy = e.y + 0.5, gp = iso(cx, cy, W.map.h(cx, cy));
    const k = 0.55 + 0.45 * Math.sqrt(Math.max(0, e.amount / e.max));   // the pile shrinks as it is mined
    ctx.drawImage(s.cv, gp.x - s.ax * k, gp.y - s.ay * k, s.w * k, s.h * k);
    if (e.type === 'gold' && Math.sin(R.time * 3 + e.id) > 0.97) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gp.x + (e.id % 7) - 3, gp.y - 10, 1.5, 0, 6.3); ctx.fill(); }
  };
}
// main-menu toggle next to "Try 2.5D Graphics"; switching reloads the page (only offered in the menu)
if (typeof document !== 'undefined' && typeof KENNEY_ART === 'object') {
  const addBtn = () => {
    const bar = document.querySelector('.display-buttons'); if (!bar || document.getElementById('btn-art')) return;
    const b = document.createElement('button'); b.className = 'btn'; b.id = 'btn-art';
    b.textContent = KART.on ? 'Classic Art' : 'Try Kenney Art';
    b.title = 'Switch building and tree art between the drawn style and Kenney\'s free (CC0) low-poly kits';
    b.onclick = () => { const u = new URL(location.href); u.searchParams.set('art', KART.on ? 'classic' : 'kenney'); location.href = u.toString(); };
    bar.prepend(b);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBtn); else addBtn();
}
