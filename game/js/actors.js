// Animated, locally baked CC0 rigs with original historical dress and later-era equipment.
'use strict';
const UnitArt = {
  mode: 'auto', revision: 0, loaded: new Map(), pending: new Set(), failed: new Set(),
  modes: ['auto', 'seljuk', 'ottoman', 'medieval', 'modern', 'future', 'classic'],
  labels: { auto: 'Follow civilization & age', seljuk: 'Seljuk', ottoman: 'Ottoman', medieval: 'Medieval', modern: 'Modern', future: 'Futuristic', classic: 'Classic drawn units' },
  invalidate() {
    this.revision++;
    if (typeof UHD !== 'undefined') { UHD.cache.clear(); UHD.sets.clear(); UHD.bytes = 0; }
    if (typeof ICONS !== 'undefined') ICONS.clear();
    if (typeof T25D !== 'undefined') T25D.fogKey = '';
    if (typeof UI !== 'undefined') UI.panelKey = '';
    const info = typeof document !== 'undefined' && document.getElementById('selinfo');
    if (info) info.dataset.multiKey = '';
  },
  set(mode) {
    if (!this.modes.includes(mode)) return;
    this.mode = mode;
    try { localStorage.setItem('aor.units', mode); } catch (e) { }
    this.invalidate();
    if (typeof document !== 'undefined') document.querySelectorAll('[data-unit-style]').forEach(s => { s.value = mode; });
  },
  theme(u) {
    if (this.mode === 'classic') return null;
    const d = UNITS[u.type];
    if (!d) return null;
    if (d.animal) return 'animals';
    if (d.era) return d.era;
    if (this.mode !== 'auto') return this.mode;
    const p = typeof W !== 'undefined' && W && W.players[u.owner];
    if (p && p.age >= 4 && ['villager', 'monk'].includes(d.draw)) return p.age >= 5 ? 'future' : 'modern';
    return p && p.civ === 'turks' ? p.age < 2 ? 'seljuk' : 'ottoman' : 'medieval';
  },
  role(u) {
    const d = UNITS[u.type];
    if (!d) return null;
    if (d.artRole) return d.artRole;
    if (d.animal) return u.breed === 'cow' ? 'cow' : d.draw;
    if (d.draw === 'villager') return u.id % 3 === 0 ? 'villager_f' : 'villager';
    return { sword: 'sword', samurai: 'sword', tknight: 'sword', berserk: 'sword', axeman: 'sword', spear: 'spear', bow: 'archer', xbow: 'archer', jav: 'archer', monk: 'monk', janissary: 'gunner', scout: 'cavalry', knight: 'cavalry', mameluke: 'cavalry', cavarcher: 'horsearcher', conq: 'horsearcher' }[d.draw];
  },
  key(u) { const theme = this.theme(u), role = this.role(u); return theme && role ? theme + '-' + role : null; },
  ensure(key) {
    if (!key || typeof ACTOR_ART !== 'object' || !ACTOR_ART[key] || typeof Image !== 'function' || this.loaded.has(key) || this.pending.has(key) || this.failed.has(key)) return;
    this.pending.add(key);
    const base = new Image(), mask = new Image(); let n = 0, bad = false;
    const arrived = () => {
      if (++n !== 2 || bad) return;
      this.loaded.set(key, { base, mask }); this.pending.delete(key); this.invalidate();
    };
    const fail = () => { bad = true; this.failed.add(key); this.pending.delete(key); };
    base.onload = mask.onload = arrived; base.onerror = mask.onerror = fail;
    base.src = 'art/actors/' + key + '.png'; mask.src = 'art/actors/' + key + '-team.png';
  },
};
(function () {
  let mode;
  try { mode = new URLSearchParams(location.search).get('units'); } catch (e) { }
  try { if (!UnitArt.modes.includes(mode)) mode = localStorage.getItem('aor.units'); } catch (e) { }
  if (UnitArt.modes.includes(mode)) {
    UnitArt.mode = mode;
    try { localStorage.setItem('aor.units', mode); } catch (e) { }
  }
})();
function actorFrame(u, t, m) {
  const d = UNITS[u.type], action = m.actions.includes(u.anim) ? u.anim : 'idle';
  const age = typeof W !== 'undefined' && W ? W.t : t;
  const phase = action === 'attack' ? Math.max(0, Math.min(.999, (age - (u.atkT === undefined ? age : u.atkT)) / Math.max(.1, d.rof || 2))) : (t * (action === 'idle' ? .4 : 1.8)) % 1;
  return { frame: Math.max(0, Math.min(m.frames - 1, Math.floor(phase * m.frames))), direction: u.back ? ((u.face || 1) < 0 ? 3 : 2) : ((u.face || 1) < 0 ? 1 : 0), action: m.actions.indexOf(action) };
}
if (typeof drawUnitFigure === 'function') {
  const fallback = drawUnitFigure;
  drawUnitFigure = function (g, u, t) {
    const key = UnitArt.key(u); UnitArt.ensure(key);
    const asset = UnitArt.loaded.get(key);
    if (!asset) return fallback.apply(this, arguments);
    const m = ACTOR_ART[key], f = actorFrame(u, t, m), sx = f.frame * m.cell, sy = (f.action * m.directions + f.direction) * m.cell;
    const w = m.cell / m.scale, h = w, face = (u.face || 1) < 0 ? -1 : 1;
    g.save(); g.scale(face, 1); // source directions already include both facings
    g.drawImage(asset.base, sx, sy, m.cell, m.cell, -m.ax, -m.ay, w, h);
    if (u.owner && typeof document !== 'undefined') {
      if (!UnitArt.tint) { UnitArt.tint = document.createElement('canvas'); UnitArt.tint.width = UnitArt.tint.height = m.cell; }
      const tg = UnitArt.tint.getContext('2d'); tg.clearRect(0, 0, m.cell, m.cell);
      tg.globalCompositeOperation = 'source-over'; tg.drawImage(asset.mask, sx, sy, m.cell, m.cell, 0, 0, m.cell, m.cell);
      tg.globalCompositeOperation = 'source-in'; tg.fillStyle = pcolor(u.owner).c; tg.fillRect(0, 0, m.cell, m.cell); tg.globalCompositeOperation = 'source-over';
      g.drawImage(UnitArt.tint, -m.ax, -m.ay, w, h);
    }
    g.restore();
    // Preserve the worker's visible task and cargo on top of the animated body.
    if (UNITS[u.type].draw === 'villager') {
      if (u.anim === 'work' && u.work) {
        const item = { chop: 'axe', mine: 'pick', farm: 'hoe', build: 'hammer', repair: 'hammer', butcher: 'knife', forage: 'basket' }[u.work.kind];
        if (item) { g.save(); g.translate(7, -15); g.rotate(-.7 + Math.sin(t * 7) * .8); ITEMS[item](g); g.restore(); }
      } else if (u.carry && u.carry.amt > .5) { g.save(); g.translate(4, -12); ITEMS.basket(g); g.restore(); }
    }
  };
}
if (typeof treeSprite === 'function') {
  const treeFallback = treeSprite;
  treeSprite = function (v, variant) {
    const p = typeof W !== 'undefined' && W && W.players[W.humanId];
    const anatolian = ['seljuk', 'ottoman'].includes(UnitArt.mode) || UnitArt.mode === 'auto' && p && p.civ === 'turks';
    const name = 'tree_anatolian_' + (variant % 3);
    if (v !== 0 || !anatolian || typeof KART === 'undefined' || !KART.on || !KART.img[name]) return treeFallback.apply(this, arguments);
    let sp = KART.cache.get(name); if (!sp) { sp = kartSprite(name); KART.cache.set(name, sp); } return sp;
  };
}
if (typeof document !== 'undefined') {
  const add = () => {
    const box = document.querySelector('.menu-box'); if (!box || document.getElementById('unit-style')) return;
    const label = document.createElement('label'); label.className = 'unit-style'; label.textContent = 'Unit artwork ';
    const select = document.createElement('select'); select.id = 'unit-style'; select.dataset.unitStyle = '';
    for (const mode of UnitArt.modes) { const o = document.createElement('option'); o.value = mode; o.textContent = UnitArt.labels[mode]; select.appendChild(o); }
    select.value = UnitArt.mode; select.onchange = () => UnitArt.set(select.value); label.appendChild(select);
    box.querySelector('.display-buttons').after(label);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
}
