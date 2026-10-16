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
function actorUnitOverlay(g, u, t) {
  const pc = pcolor(u.owner), bob = u.anim === 'walk' ? Math.abs(Math.sin(t * 11)) * 0.9 : 0;
  g.save();
  switch (u.type) {
    case 'manatarms':
      if (typeof roundShield === 'function') roundShield(pc, -4.5, -13 - bob, 3.6)(g);
      break;
    case 'longsword':
      if (typeof kiteShield === 'function') kiteShield(pc, -4.5, -13 - bob)(g);
      break;
    case 'twohanded':
      g.fillStyle = '#e8c040'; g.fillRect(4.5, -17 - bob, 5, 1.5);
      g.fillStyle = '#eef2f8'; g.beginPath(); g.moveTo(6.2, -17 - bob); g.lineTo(7, -30 - bob); g.lineTo(7.8, -17 - bob); g.fill();
      break;
    case 'samurai':
      // Golden kabuto crescent crest (maedate) & crimson shoulder sode
      g.fillStyle = '#e8c040';
      g.beginPath(); g.moveTo(-2.5, -25 - bob); g.lineTo(0.5, -30 - bob); g.lineTo(3.5, -25 - bob); g.lineTo(0.5, -26.5 - bob); g.closePath(); g.fill();
      g.fillStyle = pc.c; g.strokeStyle = '#e8c040'; g.lineWidth = 0.7;
      g.fillRect(-5.5, -18 - bob, 3.2, 4.5); g.strokeRect(-5.5, -18 - bob, 3.2, 4.5);
      break;
    case 'tknight':
      // Crusader white tabard & heraldic Teutonic cross shield
      g.fillStyle = '#f4f0e8'; g.strokeStyle = '#222'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-8, -18 - bob); g.lineTo(-1, -18 - bob); g.lineTo(-1.5, -10 - bob); g.lineTo(-4.5, -7 - bob); g.lineTo(-7.5, -10 - bob); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#1a1a1a'; g.fillRect(-5.3, -17 - bob, 1.6, 8.5); g.fillRect(-7.2, -14.5 - bob, 5.4, 1.6);
      g.fillStyle = '#d8b040'; g.fillRect(-1.5, -27 - bob, 4, 1.2);
      break;
    case 'berserk':
      // Curved ivory Viking horns & bossed round shield
      g.strokeStyle = '#f0ead8'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-2.5, -24 - bob); g.quadraticCurveTo(-6.5, -26 - bob, -5, -29.5 - bob);
      g.moveTo(3.5, -24 - bob); g.quadraticCurveTo(7.5, -26 - bob, 6, -29.5 - bob); g.stroke();
      if (typeof roundShield === 'function') roundShield(pc, -4.5, -13 - bob, 4.2)(g);
      break;
    case 'axeman':
      // Bearded Francisca throwing axe & kite shield
      if (typeof kiteShield === 'function') kiteShield(pc, -4.5, -13 - bob)(g);
      g.save(); g.translate(6.5, -15 - bob); ITEMS.throwaxe(g); g.restore();
      break;
    case 'pikeman':
      g.strokeStyle = '#6a4a2a'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(5, -10 - bob); g.lineTo(8, -31 - bob); g.stroke();
      g.fillStyle = '#dfe4ec'; g.beginPath(); g.moveTo(6.6, -30 - bob); g.lineTo(8.3, -35 - bob); g.lineTo(9.4, -30 - bob); g.closePath(); g.fill();
      break;
    case 'halberdier':
      // Crimson plumed helm & broad steel halberd blade
      g.fillStyle = '#c8202a';
      g.beginPath(); g.moveTo(0.5, -26 - bob); g.quadraticCurveTo(-4.5, -31 - bob, -6.5, -25 - bob); g.quadraticCurveTo(-3, -27 - bob, 0.5, -24.5 - bob); g.fill();
      g.strokeStyle = '#5a3a1e'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(5, -10 - bob); g.lineTo(8, -32 - bob); g.stroke();
      g.fillStyle = '#e4e8f0'; g.beginPath(); g.moveTo(8, -35 - bob); g.lineTo(12, -29 - bob); g.lineTo(7.5, -27 - bob); g.closePath(); g.fill();
      break;
    case 'longbow':
      // Tall English yew longbow & feathered quiver
      g.strokeStyle = '#7a4a22'; g.lineWidth = 1.7; g.beginPath(); g.arc(4, -15 - bob, 10.5, -1.15, 1.15); g.stroke();
      g.fillStyle = '#d83030'; g.fillRect(-5.5, -22 - bob, 2.5, 2.5);
      break;
    case 'chukonu':
      // Repeating crossbow wooden magazine box with brass trim
      g.fillStyle = '#5a381e'; g.fillRect(3, -18 - bob, 6.5, 4);
      g.strokeStyle = '#e0b840'; g.lineWidth = 0.8; g.strokeRect(3, -18 - bob, 6.5, 4);
      break;
    case 'genoese':
      // Tall Genoese pavise shield with heraldic cross
      g.fillStyle = '#f4f0e8'; g.strokeStyle = '#b89630'; g.lineWidth = 0.9;
      g.fillRect(-7.5, -19 - bob, 5.5, 11); g.strokeRect(-7.5, -19 - bob, 5.5, 11);
      g.fillStyle = pc.c; g.fillRect(-5.3, -18.5 - bob, 1.3, 10); g.fillRect(-7, -14.5 - bob, 4.5, 1.3);
      break;
    case 'skirmisher':
    case 'eskirm':
      if (typeof roundShield === 'function') roundShield(pc, -4.5, -13 - bob, u.type === 'eskirm' ? 4.2 : 3.4)(g);
      if (u.type === 'eskirm') { g.fillStyle = '#e8c040'; g.fillRect(-1.5, -26.5 - bob, 4, 1.4); }
      break;
    case 'cavalier':
      if (typeof kiteShield === 'function') kiteShield(pc, -2, -17 - bob)(g);
      break;
    case 'paladin':
      // Gilded great helm crest, golden horse barding trim & heraldic shield
      if (typeof kiteShield === 'function') kiteShield(pc, -2, -17 - bob)(g);
      g.fillStyle = '#f0c840';
      g.beginPath(); g.moveTo(-1, -34 - bob); g.lineTo(1.5, -40.5 - bob); g.lineTo(4, -34 - bob); g.closePath(); g.fill();
      g.strokeStyle = '#f0c840'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-11, -8 - bob); g.lineTo(10, -8 - bob); g.stroke();
      break;
    case 'cataphract':
      // Byzantine golden scale barding & imperial crest
      g.strokeStyle = '#d8a838'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-11, -9 - bob); g.lineTo(11, -9 - bob); g.stroke();
      g.fillStyle = '#d8a838'; g.beginPath(); g.arc(1.5, -34 - bob, 2.5, Math.PI, 0); g.fill();
      break;
    case 'mameluke':
      // White turban with ruby jewel & curved scimitar
      g.fillStyle = '#f4efe4'; g.beginPath(); g.ellipse(1, -33.5 - bob, 4, 2.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d82030'; g.beginPath(); g.arc(2.5, -34 - bob, 1.1, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#eef2f8'; g.lineWidth = 1.6; g.beginPath(); g.arc(6, -22 - bob, 6, -1.2, 0.5); g.stroke();
      break;
    case 'conq':
      // Morion helmet crest & red/gold plume
      g.fillStyle = '#c8ccd4'; g.beginPath(); g.arc(1, -33 - bob, 3.8, Math.PI, 0); g.fill();
      g.fillStyle = '#d82828'; g.beginPath(); g.moveTo(-1, -35 - bob); g.quadraticCurveTo(-5, -39 - bob, -6, -34 - bob); g.fill();
      break;
    case 'hcavarcher':
      // Gilded steppe helm with tall team-colored plume
      g.fillStyle = '#d8b040'; g.beginPath(); g.arc(1, -33 - bob, 3.5, Math.PI, 0); g.fill();
      g.fillStyle = pc.l; g.fillRect(0.3, -39 - bob, 1.5, 5.5);
      break;
    case 'monk':
      if (u.relic) {
        g.fillStyle = '#f0c840'; g.strokeStyle = '#8a6018'; g.lineWidth = 0.7;
        g.fillRect(2, -23 - bob, 6.5, 4.8); g.strokeRect(2, -23 - bob, 6.5, 4.8);
        g.fillStyle = '#b02030'; g.fillRect(4.6, -22.4 - bob, 1.3, 3.6);
      }
      if (u.anim === 'work' && u.work) {
        g.strokeStyle = u.work.kind === 'heal' ? 'rgba(140,255,150,0.65)' : 'rgba(255,235,130,0.7)';
        g.lineWidth = 1.2; g.beginPath(); g.arc(0, -28 - bob, 4.5 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2); g.stroke();
      }
      break;
  }
  g.restore();
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
    actorUnitOverlay(g, u, t);
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
