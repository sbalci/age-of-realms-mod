// ===== Default art style: Kenney CC0 kits, pre-rendered by tools/art/bake-kenney.mjs =====
// ?art=classic restores drawn art; valid choices are remembered in this browser.
// Local sprites load progressively, with drawn art as the fallback for missing assets.
'use strict';
const KART = { on: false, img: {}, cache: new Map(), base: 'art/kenney/', revision: 0, failed: [] };
(function () {
  let v = null;
  const valid = value => value === 'kenney' || value === 'classic';
  try { v = new URLSearchParams(location.search).get('art'); } catch (e) { /* headless */ }
  try { if (valid(v)) localStorage.setItem('aor.art', v); else v = localStorage.getItem('aor.art'); } catch (e) { /* storage blocked */ }
  KART.on = v !== 'classic' && typeof KENNEY_ART === 'object' && typeof Image === 'function';
  if (!KART.on) return;
  const load = () => {
    for (const k of Object.keys(KENNEY_ART)) {
      const im = new Image();
      im.onload = () => {
        KART.img[k] = im; KART.revision++;
        // Portraits and command buttons may have cached the drawn fallback during loading.
        if (typeof ICONS !== 'undefined') ICONS.clear();
        if (typeof UI !== 'undefined') UI.panelKey = '';
        const box = document.getElementById('selinfo');
        if (box) box.dataset.multiKey = '';
      };
      im.onerror = () => { KART.failed.push(k); };
      im.src = KART.base + k + '.png';
    }
  };
  // Start after the page has booted so a slow image cannot hold up the main loop's load handler.
  if (typeof window !== 'undefined' && document.readyState !== 'complete') window.addEventListener('load', load, { once: true });
  else load();
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
    if (type === 'wonder') return _bldSprite.apply(this, arguments);
    const name = kartKey(type, st);
    if (!name) return _bldSprite.apply(this, arguments);
    const key = name + '|' + pc.c;
    let s = KART.cache.get(key);
    if (!s) {
      const size = BUILDINGS[type].size;
      // player colour: a small flag at the front-left corner of the footprint
      s = kartSprite(name, g => flag(g, -size / 2 + 0.12, size / 2 - 0.12, 0, pc.c, 0.3, size >= 3 ? 0.9 : 0.7));
      s.staticSails = type === 'mill';
      KART.cache.set(key, s);
    }
    return s;
  };
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
if (KART.on) {
  // A renderer hook keeps resource hit flashes and other surrounding effects intact.
  R.resourceArt = function (ctx, e, gp, frac) {
    const pile = e.type === 'gold' || e.type === 'stone';
    const felled = e.type === 'tree' && e.felled;
    if (!pile && !felled && e.type !== 'berry' && e.type !== 'shrub') return false;
    const name = (felled ? 'felled' : e.type) + '_' + (e.id & 1);
    if (!KART.img[name]) return false;
    const stage = e.type === 'berry' ? Math.ceil(Math.max(0, Math.min(1, frac)) * 4) : 0;
    const key = name + '|' + stage;
    let s = KART.cache.get(key);
    if (!s) {
      s = kartSprite(name, e.type === 'berry' ? g => {
        const rng = mulberry32(31 + (e.id & 1));
        for (let i = 0; i < stage * 4; i++) {
          const x = (rng() - 0.5) * 24, y = -8 - rng() * 12;
          g.fillStyle = '#702a39'; g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#ec7b79'; g.beginPath(); g.arc(x - 0.5, y - 0.6, 0.8, 0, Math.PI * 2); g.fill();
        }
      } : null);
      KART.cache.set(key, s);
    }
    const k = pile ? 0.55 + 0.45 * Math.sqrt(Math.max(0, frac)) : felled ? 0.75 + 0.25 * Math.max(0, frac) : 1;
    ctx.save(); ctx.translate(gp.x, gp.y);
    if (felled && e.fallDir < 0) ctx.scale(-1, 1);
    ctx.drawImage(s.cv, -s.ax * k, -s.ay * k, s.w * k, s.h * k); ctx.restore();
    if (e.type === 'gold' && Math.sin(R.time * 3 + e.id) > 0.97) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gp.x + (e.id % 7) - 3, gp.y - 10, 1.5, 0, 6.3); ctx.fill(); }
    return true;
  };
}
if (KART.on && typeof drawFarm === 'function') {
  const _drawFarm = drawFarm;
  drawFarm = function (ctx, b, gp) {
    const p = W && W.players[b.owner];
    const frac = Math.max(0, b.food / Math.max(1, p ? p.farmFood : 175));
    const name = 'farm_' + (frac > 0.5 ? 2 : frac > 0.2 ? 1 : 0);
    if (!b.built || !KART.img[name]) return _drawFarm.apply(this, arguments);
    let s = KART.cache.get(name);
    if (!s) { s = kartSprite(name); KART.cache.set(name, s); }
    ctx.drawImage(s.cv, gp.x - s.ax, gp.y - s.ay, s.w, s.h);
  };
}
// main-menu toggle next to "Try 2.5D Graphics"; switching reloads the page (only offered in the menu)
if (typeof document !== 'undefined' && typeof KENNEY_ART === 'object') {
  const addBtn = () => {
    const bar = document.querySelector('.display-buttons'); if (!bar || document.getElementById('btn-art')) return;
    const b = document.createElement('button'); b.className = 'btn'; b.id = 'btn-art';
    b.textContent = KART.on ? 'Classic Art' : 'Kenney Art';
    b.title = 'Switch between classic drawn art and Kenney’s CC0 medieval buildings, farms and scenery';
    b.onclick = () => { const u = new URL(location.href); u.searchParams.set('art', KART.on ? 'classic' : 'kenney'); location.href = u.toString(); };
    bar.prepend(b);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBtn); else addBtn();
}
