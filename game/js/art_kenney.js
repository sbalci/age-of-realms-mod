// ===== Default art style: Kenney CC0 kits, pre-rendered by tools/art/bake-kenney.mjs =====
// ?art=classic restores drawn art; valid choices are remembered in this browser.
// Local sprites load progressively, with drawn art as the fallback for missing assets. Shared sprites load at
// startup; a civilization's own building set (house_turks_2 ...) loads the first time that civ is drawn.
'use strict';
const KART = { on: false, img: {}, cache: new Map(), base: 'art/kenney/', revision: 0, failed: [], requested: new Set(), civs: new Map(), booted: false };
// the civilization a sprite key belongs to (house_turks_2 -> 'turks'), or null for shared sprites (tree_anatolian_0)
function kartCiv(k) {
  const m = /^.+_([a-z]+)_\d+$/.exec(k);
  return m && typeof CIVS === 'object' && Object.prototype.hasOwnProperty.call(CIVS, m[1]) ? m[1] : null;
}
(function () {
  let v = null;
  const valid = value => value === 'kenney' || value === 'classic';
  try { v = new URLSearchParams(location.search).get('art'); } catch (e) { /* headless */ }
  try { if (valid(v)) localStorage.setItem('aor.art', v); else v = localStorage.getItem('aor.art'); } catch (e) { /* storage blocked */ }
  KART.on = v !== 'classic' && typeof KENNEY_ART === 'object' && typeof Image === 'function';
  if (!KART.on) return;
  // Portraits, cached building canvases and HD unit sprites may have used the drawn fallback while sprites load.
  // Refresh them at most once per frame, however many images finish in it.
  let refreshQueued = false;
  const refresh = () => {
    refreshQueued = false;
    if (typeof R !== 'undefined' && R.spriteCache) R.spriteCache.clear();
    if (typeof UHD !== 'undefined' && UHD.cache) { UHD.cache.clear(); UHD.sets.clear(); UHD.bytes = 0; }
    if (typeof ICONS !== 'undefined') ICONS.clear();
    if (typeof UI !== 'undefined') UI.panelKey = '';
    const box = document.getElementById('selinfo');
    if (box) box.dataset.multiKey = '';
  };
  const queueRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout)(refresh);
  };
  // fetch each sprite once; resolves when every one of these keys has loaded or failed
  const request = keys => Promise.all(keys.filter(k => !KART.requested.has(k)).map(k => new Promise(done => {
    KART.requested.add(k);
    const im = new Image();
    im.onload = () => { KART.img[k] = im; KART.revision++; queueRefresh(); done(); };
    im.onerror = () => { KART.failed.push(k); done(); };
    im.src = KART.base + k + '.png';
  })));
  let boot;
  const booted = new Promise(resolve => { boot = resolve; });
  // a civilization's own building set: requested once, after startup; repeat calls return the same promise
  KART.loadCiv = civ => {
    if (!KART.civs.has(civ)) KART.civs.set(civ, booted.then(() => request(Object.keys(KENNEY_ART).filter(k => kartCiv(k) === civ))).then(() => undefined));
    return KART.civs.get(civ);
  };
  const load = () => {
    request(Object.keys(KENNEY_ART).filter(k => kartCiv(k) === null));
    KART.booted = true;
    boot();
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
// a civilization's own building sprite (house_turks_2): exact age, else the nearest lower age it was baked for
function civKartKey(type, civ, st) {
  for (let s = st; s >= 0; s--) if (KART.img[type + '_' + civ + '_' + s]) return type + '_' + civ + '_' + s;
  return null;
}
function kartSprite(name, decorate, under) {
  const m = KENNEY_ART[name], im = KART.img[name];
  const cv = document.createElement('canvas'); cv.width = Math.ceil(m.w * m.SC); cv.height = Math.ceil(m.h * m.SC);
  const g = cv.getContext('2d');
  if (under) { g.save(); g.scale(m.SC, m.SC); g.translate(m.ax, m.ay); under(g); g.restore(); }
  g.drawImage(im, 0, 0, cv.width, cv.height);
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
      const under = type !== 'dock' && !BUILDINGS[type].wall && type !== 'gate' && type !== 'outpost' ? g => {
        const r = size / 2 - 0.04;
        poly(g, [P(-r + 0.08, -r + 0.18, 0), P(r + 0.18, -r + 0.18, 0), P(r + 0.18, r + 0.18, 0), P(-r + 0.04, r + 0.18, 0)], 'rgba(0,0,0,0.16)');
      } : null;
      // player colour: front corner flagpole + heraldic banners and warm forge/hearth accents on major buildings
      s = kartSprite(name, g => {
        flag(g, -size / 2 + 0.12, size / 2 - 0.12, 0, pc.c, 0.3, size >= 3 ? 0.92 : 0.72);
        if (typeof vicBanner === 'function' && size >= 3) {
          if (type === 'wonder' || type === 'castle') {
            vicBanner(g, -0.75, size / 2 - 0.22, 18, pc, 16);
            vicBanner(g, 0.75, size / 2 - 0.22, 18, pc, 16);
          } else {
            vicBanner(g, size / 2 - 0.22, 0.55, 16, pc, 13);
          }
        }
        if (type === 'blacksmith') {
          const fp = P(0.18, 0.85, 6);
          const gr = g.createRadialGradient(fp[0], fp[1], 1, fp[0], fp[1], 12);
          gr.addColorStop(0, 'rgba(255,180,60,0.55)'); gr.addColorStop(1, 'rgba(255,100,20,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(fp[0], fp[1], 12, 0, Math.PI * 2); g.fill();
        }
      }, under);
      s.staticSails = type === 'mill';
      KART.cache.set(key, s);
    }
    return s;
  };
}
if (KART.on && typeof drawUnitFigure === 'function') {
  const _kartUnitFigure = drawUnitFigure;
  const SIEGE_KART = {
    ram: 'unit_ram',
    cappedram: 'unit_cappedram',
    mangonel: 'unit_mangonel',
    onager: 'unit_onager',
    scorpion: 'unit_scorpion',
    trebuchet: 'unit_trebuchet',
  };
  drawUnitFigure = function (g, u, t) {
    const kname = SIEGE_KART[u.type];
    if (kname && KART.img[kname]) {
      const m = KENNEY_ART[kname], im = KART.img[kname], d = UNITS[u.type], pc = pcolor(u.owner);
      const attacking = u.anim === 'attack';
      const since = u.atkT !== undefined && typeof W !== 'undefined' && W ? (W.t - u.atkT) : 9;
      const strike = attacking ? Math.max(0, 1 - since / 0.35) : 0;
      const walkBob = u.anim === 'walk' ? Math.sin(t * 14) * 0.6 : 0;
      const recoil = attacking ? (d.draw === 'ram' ? strike * 3.5 : -strike * 2.2) : 0;
      const sc = 0.68;
      g.save();
      g.translate(recoil, walkBob);
      g.drawImage(im, -m.ax * sc, -m.ay * sc - 8, m.w * sc, m.h * sc);
      // Heraldic team badge on the siege timber frame
      const bx = d.draw === 'trebuchet' ? -9 : -7, by = d.draw === 'trebuchet' ? -24 : -15;
      g.fillStyle = pc.c; g.strokeStyle = '#e8c860'; g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(bx, by); g.lineTo(bx + 5.5, by); g.lineTo(bx + 5.5, by + 5); g.lineTo(bx + 2.75, by + 7.5); g.lineTo(bx, by + 5);
      g.closePath(); g.fill(); g.stroke();
      g.restore();
      return;
    }
    return _kartUnitFigure.apply(this, arguments);
  };
}
if (KART.on && typeof drawShip === 'function') {
  const _kartDrawShip = drawShip;
  const SHIP_KART = {
    galley: 'ship_galley',
    wargalley: 'ship_galley',
    fireship: 'ship_galley',
    galleon: 'ship_galleon',
    tradecog: 'ship_tradecog',
    transport: 'ship_tradecog',
  };
  drawShip = function (g, u, t, pc, attacking, since) {
    const kname = SHIP_KART[u.type];
    if (!kname || !KART.img[kname]) return _kartDrawShip.apply(this, arguments);
    const m = KENNEY_ART[kname], im = KART.img[kname], type = u.type;
    const bob = Math.sin(t * 2 + u.id) * 1.2, roll = Math.sin(t * 1.5 + u.id) * 0.025;
    const L = { transport: 24, tradecog: 22, galley: 26, wargalley: 28, galleon: 32, fireship: 26 }[type] || 24;
    const sc = type === 'wargalley' ? 0.96 : type === 'transport' ? 0.96 : 0.90;
    g.save();
    g.rotate(roll); g.translate(0, bob);
    if (u.anim === 'walk') {
      g.strokeStyle = 'rgba(255,255,255,0.48)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-L, 2); g.quadraticCurveTo(-L - 10, 6, -L - 22, 4 + Math.sin(t * 5) * 2); g.stroke();
      g.beginPath(); g.moveTo(-L, -1); g.quadraticCurveTo(-L - 10, -4, -L - 20, -3); g.stroke();
    }
    g.fillStyle = 'rgba(0,20,40,0.32)'; g.beginPath(); g.ellipse(0, 2, L + 2, 7, 0, 0, 6.3); g.fill();
    g.drawImage(im, -m.ax * sc, -m.ay * sc + 8, m.w * sc, m.h * sc);
    // Team pennant & unit-specific naval overlays
    const mastTopY = -m.ay * sc + 11;
    g.fillStyle = pc.c; g.strokeStyle = '#e8c860'; g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(0, mastTopY); g.lineTo(10, mastTopY + 2 + Math.sin(t * 5 + u.id) * 1.2); g.lineTo(0, mastTopY + 5);
    g.closePath(); g.fill(); g.stroke();
    // Team emblem on main sail
    const sailY = mastTopY + (type === 'galleon' ? 18 : 14);
    g.fillStyle = pc.c; g.strokeStyle = 'rgba(255,240,200,0.85)'; g.lineWidth = 0.8;
    g.beginPath(); g.arc(2, sailY, 4.2, 0, Math.PI * 2); g.fill(); g.stroke();
    if (type === 'fireship') {
      g.fillStyle = '#3a2418'; g.fillRect(L - 8, -10, 9, 3);
      drawFlame(g, L + 2, -9, attacking && since < 0.45 ? 1.05 : 0.55, t);
    } else if (type === 'tradecog' && u.tradeGold) {
      g.fillStyle = '#f0c840'; g.beginPath(); g.arc(-6, -8, 3, 0, 6.3); g.fill();
    } else if (type === 'transport' && u.cargo && u.cargo.length) {
      for (let k = 0; k < Math.min(6, u.cargo.length); k++) {
        g.fillStyle = pc.l; g.beginPath(); g.arc(-10 + k * 4, -8, 1.8, 0, 6.3); g.fill();
      }
    }
    g.restore();
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
