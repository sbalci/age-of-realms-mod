// ===== Realms mod: Turks (with Imams), peaceful scouts, AI-vs-AI spectator mode, Ibn Battuta cheat =====
// Loaded after fx.js, before main.js. Wraps engine globals only.
'use strict';
const EXTRAS = { spectateSpeeds: [0.5, 1, 1.5, 2, 3, 5, 8] };

// ---------------------------------------------------------------- Turks
if (typeof CIVS === 'object' && !CIVS.turks) {
  CIVS.turks = {
    name: 'Turks', lang: 'tr-TR', uu: 'janissary', arch: 'med',
    bonuses: ['Janissaries (gunpowder) +25% hit points', 'Gold miners work 20% faster', 'Light Cavalry upgrade is free; Scout line +1 pierce armor', 'Monks are Imams'],
    voice: {
      select: ['Buyurun?', 'Efendim?', 'Emredersiniz', 'Hazırım', 'Ne istersiniz?', 'Buradayım!'],
      move: ['Gidelim!', 'İleri!', 'Peki', 'Hemen', 'Başüstüne', 'Yola çıkıyorum'],
      gather: ['İşe koyulalım!', 'Ben hallederim', 'Memnuniyetle', 'Çalışmaya!'],
      build: ['İnşa ediyorum!', 'Kuralım!', 'Emredersiniz'],
      attack: ['Saldırın!', 'Silah başına!', 'Allah Allah!', 'Hücum!', 'Vurun!'],
    },
  };
  if (typeof AI_NAMES !== 'undefined' && Array.isArray(AI_NAMES)) AI_NAMES.push('Mehmed', 'Suleiman', 'Alp Arslan');
}
// Turks do not eat pork: villagers will not hunt boar or butcher a boar carcass. Each boar near a Turkish
// start becomes three cows instead (a herd breed of sheep worth 150 food: 900 food against the boars' 680).
const COW = { food: 150, hp: 10 };
function makeCow(u) { u.breed = 'cow'; u.food = COW.food; u.maxhp = u.hp = COW.hp; return u; }
if (typeof CIVS === 'object' && CIVS.turks) {
  CIVS.turks.noMeat = ['boar'];
  CIVS.turks.noMeatMsg = 'Turks do not eat pork: villagers will not hunt wild boar.';
  if (!CIVS.turks.bonuses.includes('No pork: start with cows instead of wild boar')) CIVS.turks.bonuses.push('No pork: start with cows instead of wild boar');
}
if (typeof GameHooks === 'object') GameHooks.on('worldCreated', () => {
  if (W.editor) return;
  for (const p of W.players) {
    if (!p || !p.civ || !CIVS[p.civ] || !(CIVS[p.civ].noMeat || []).includes('boar') || p.startX === undefined) continue;
    for (const b of W.list.slice()) {
      if (b.kind !== 'unit' || b.type !== 'boar' || b.owner !== 0 || Math.hypot(b.x - p.startX, b.y - p.startY) > 22) continue;
      // only boars that are closer to this player than to any other start
      if (W.players.some(q => q && q !== p && q.startX !== undefined && Math.hypot(b.x - q.startX, b.y - q.startY) < Math.hypot(b.x - p.startX, b.y - p.startY))) continue;
      const x = b.x, y = b.y; removeEnt(b);
      for (let k = 0; k < 3; k++) makeCow(spawnUnit('sheep', 0, Math.min(W.n - 1, x + (k % 2) * 0.9), Math.min(W.n - 1, y + (k >> 1) * 0.9)));
    }
  }
});
if (typeof UNITS === 'object' && !UNITS.janissary) {
  UNITS.janissary = {
    name: 'Janissary', tags: ['archer', 'gunpowder', 'land', 'unique'], hp: 35, atk: 17, ma: 1, pa: 0, range: 7, rof: 3.45, speed: 0.96, los: 9,
    cost: { food: 60, gold: 55 }, time: 17, age: 2, from: 'castle', hk: 'Q', proj: 'bullet', bonus: { infantry: 6 },
    desc: 'Turkish unique: hand cannoneer. Huge damage at range, deadly against infantry, but slow to reload and inaccurate.', draw: 'janissary',
  };
}
if (typeof CMD === 'object' && CMD.acc) CMD.acc.janissary = 0.75;
if (typeof applyCivBonus === 'function') {
  const _acb = applyCivBonus;
  applyCivBonus = function (p) {
    const r = _acb(p);
    if (p.civ === 'turks') {
      addUp(p, 'gunpowder', { hpPct: 0.25 });
      p.gather.gold *= 1.2;
      p.freeTechs = (p.freeTechs || []).concat(['up_lightcav']);
      addUp(p, 'scout', { pa: 1 }); addUp(p, 'lightcav', { pa: 1 });
    }
    return r;
  };
}
const isImam = u => !!(u && u.type === 'monk' && typeof W !== 'undefined' && W.players && W.players[u.owner] && W.players[u.owner].civ === 'turks');
function civUnitName(type, owner, e) {
  if (e && e.breed === 'cow') return 'Cow';
  const p = typeof W !== 'undefined' && W.players ? W.players[owner] : null;
  if (type === 'monk' && p && p.civ === 'turks') return 'Imam';
  return UNITS[type] ? UNITS[type].name : type;
}
// drawing: Imams wear a white robe and turban with a green sash; Janissaries a white börk and a hand cannon
let EX_IMAM = false;
if (typeof drawHuman === 'function') {
  const _dh = drawHuman;
  drawHuman = function (g, o) {
    if (EX_IMAM && o.robe) { o = Object.assign({}, o, { tunic: o.tunic === '#6a5a4a' ? '#cfc8b6' : '#ece6d6', legs: '#bdb6a2', sash: '#2f7a3a', head: g2 => { g2.fillStyle = '#f6f2e8'; g2.beginPath(); g2.ellipse(0.5, -16, 4.4, 3.2, 0, 0, 6.3); g2.fill(); g2.strokeStyle = '#d8d0bc'; g2.lineWidth = 0.6; g2.beginPath(); g2.moveTo(-3.5, -16.5); g2.quadraticCurveTo(0.5, -14.5, 4.6, -16.8); g2.stroke(); g2.fillStyle = '#2f7a3a'; g2.beginPath(); g2.arc(0.5, -18.6, 1.3, 0, 6.3); g2.fill(); } }); }
    return _dh(g, o);
  };
}
const EX_BORK = g => { g.fillStyle = '#f2eee2'; g.beginPath(); g.moveTo(-3.4, -15); g.lineTo(4, -15); g.lineTo(2.4, -23.5); g.quadraticCurveTo(0.3, -25.5, -2, -23); g.closePath(); g.fill(); g.strokeStyle = '#cfc6b0'; g.lineWidth = 0.6; g.stroke(); g.fillStyle = '#c8a040'; g.fillRect(-3.4, -16.2, 7.4, 1.8); };
if (typeof drawUnitFigure === 'function') {
  const _duf = drawUnitFigure;
  drawUnitFigure = function (g, u, t) {
    const d = UNITS[u.type];
    if (d && d.draw === 'janissary') {
      const pc = pcolor(u.owner), attacking = u.anim === 'attack';
      const o = { t, anim: u.anim, tunic: pc.c, legs: '#4a3a2a', skin: SKIN[u.id % 4], sash: '#c8a040', head: EX_BORK, item: ITEMS.gun, armFront: attacking ? -1.57 : -0.3, armBack: attacking ? -1.4 : 0.1, itemRot: 0 };
      o.torsoDetail = g2 => { g2.fillStyle = 'rgba(200,160,64,0.8)'; g2.fillRect(-3.8, -9, 7.6, 1.2); g2.fillRect(-0.6, -9, 1.2, 9); };
      drawHuman(g, o);
      const since = u.atkT !== undefined && typeof W !== 'undefined' ? W.t - u.atkT : 9;
      if (attacking && since < 0.14) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,210,90,0.9)'; g.beginPath(); g.arc(13, -12, 3.2, 0, 6.3); g.fill(); g.fillStyle = 'rgba(255,255,220,0.9)'; g.beginPath(); g.arc(13, -12, 1.4, 0, 6.3); g.fill(); g.restore(); }
      return;
    }
    if (isImam(u)) { EX_IMAM = true; try { return _duf(g, u, t); } finally { EX_IMAM = false; } }
    return _duf(g, u, t);
  };
}
// names in the panel, the train buttons and messages
if (typeof renderSelInfo === 'function') {
  const _rsi = renderSelInfo;
  renderSelInfo = function () {
    _rsi();
    const sel = UI.selection; if (!sel.length || !sel.some(isImam)) return;
    const box = document.querySelector('#selinfo'); if (!box) return;
    const walk = n => { if (n.nodeType === 3) { if (/\bMonks?\b/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\bMonks\b/g, 'Imams').replace(/\bMonk\b/g, 'Imam'); } else for (const c of n.childNodes) walk(c); };
    walk(box);
  };
}
if (typeof commandsFor === 'function') {
  const _cf = commandsFor;
  commandsFor = function (sel) {
    if (typeof W !== 'undefined' && W.spectate) return [];
    const cmds = _cf(sel);
    const p = W.players[W.humanId];
    if (p && p.civ === 'turks') for (const c of cmds) if (c.icon === 'unit:monk') { c.name = 'Imam'; c.desc = (c.desc || '').replace(/\bMonks?\b/g, m => m === 'Monks' ? 'Imams' : 'Imam'); }
    return cmds;
  };
}
if (typeof msg === 'function') {
  const _msg = msg;
  msg = function (text, col) {
    const p = typeof W !== 'undefined' && W && W.players ? W.players[W.humanId] : null;
    if (p && p.civ === 'turks' && typeof text === 'string') {
      text = text.replace('taken monastic vows and become', 'become').replace('has taken monastic vows.', 'has become an imam.').replace(/\bMonk\b/g, 'Imam').replace(/\bmonk\b/g, 'imam');
    }
    return _msg(text, col);
  };
}

// ---------------------------------------------------------------- scouts and soldiers leave livestock alone
// Automatic targeting skips harmless animals (sheep, deer) and boars; wolves are still fought. Direct orders still work.
let EX_AUTO = false;
if (typeof canAttack === 'function') {
  const _ca = canAttack;
  canAttack = function (u, t) {
    if (EX_AUTO && t && t.kind === 'unit' && hasTag(t.type, 'animal') && t.type !== 'wolf') return false;
    return _ca(u, t);
  };
}
if (typeof findTargetFor === 'function') {
  const _ftf = findTargetFor;
  findTargetFor = function (u, range) { EX_AUTO = true; try { return _ftf(u, range); } finally { EX_AUTO = false; } };
}
if (typeof findTarget === 'function') {
  const _ft = findTarget;
  findTarget = function (src, range) {
    const t = _ft(src, range);
    if (t && t.kind === 'unit' && hasTag(t.type, 'animal') && t.type !== 'wolf') return null;
    return t;
  };
}

// ---------------------------------------------------------------- Ibn Battuta cheat
// Like marco + polo together: the traveller has seen the whole world. Toggle.
if (typeof runCheat === 'function') {
  const _rc = runCheat;
  runCheat = function (raw) {
    const code = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!/^ibn ?bat+ut+a$/.test(code)) return _rc(raw);
    if (!W.settings.cheats) { msg('Cheats are disabled in this game (enable "Allow cheats" in setup).', '#fc8'); return false; }
    const p = UI.human();
    W.ibnBattuta = !W.ibnBattuta;
    let r;
    if (W.ibnBattuta) {
      W.ibnBackup = { explored: p.explored.slice(), revealAll: !!W.revealAll, noFog: !!W.noFog };
      W.revealAll = true; W.noFog = true; p.explored.fill(1);
      r = 'Ibn Battuta has travelled the whole world: map revealed, fog lifted';
    } else {
      const b = W.ibnBackup || {};
      W.revealAll = !!b.revealAll; W.noFog = !!b.noFog; if (b.explored && !W.revealAll) p.explored.set(b.explored);
      r = 'Ibn Battuta has gone home: map and fog restored';
    }
    if (typeof updateVisibility === 'function') updateVisibility(true);
    W.cheatsUsed = (W.cheatsUsed || 0) + 1;
    msg('Cheat: ' + r, '#9f9'); Sound.play('research');
    return r;
  };
}

// ---------------------------------------------------------------- AI vs AI (spectator mode)
// Setup checkbox "Watch AI vs AI": your slot is played by the computer too, the map is revealed, commands are disabled,
// the score panel opens, and game speed goes up to 8x (+/-). The game ends when one side (or alliance) is left.
if (typeof buildSetup === 'function') {
  const _bs = buildSetup;
  buildSetup = function () {
    _bs();
    const ch = document.querySelector('#s-cheats'); if (!ch || document.querySelector('#s-spectate')) return;
    let saved = false; try { saved = !!JSON.parse(localStorage.getItem('aoe_spectate') || 'false'); } catch (e) { }
    const lab = document.createElement('label'); lab.className = 'check';
    lab.title = 'Every player, including yours, is played by the computer. You watch with the whole map revealed.';
    lab.innerHTML = `<input type="checkbox" id="s-spectate" ${saved ? 'checked' : ''}> Watch AI vs AI`;
    ch.closest('label').insertAdjacentElement('afterend', lab);
  };
}
if (typeof launchFromSetup === 'function') {
  const _lfs = launchFromSetup;
  launchFromSetup = function (cfg) {
    const box = typeof document !== 'undefined' ? document.querySelector('#s-spectate') : null;
    if (cfg && cfg.spectate === undefined && box && box.offsetParent !== null) {
      cfg = Object.assign({}, cfg, { spectate: box.checked });
      try { localStorage.setItem('aoe_spectate', JSON.stringify(!!cfg.spectate)); } catch (e) { }
    }
    return _lfs(cfg);
  };
}
function exSpectateBegin(settings) {
  const p = W.players[W.humanId];
  W.spectate = true;
  if (p.name === settings.name || p.name === 'Player') {
    const used = new Set(W.players.filter(q => q && q !== p).map(q => q.name));
    if (typeof aiLeaderName === 'function') p.name = aiLeaderName(p.civ, simRandom, used);
    else {
      const pool = (typeof AI_NAMES !== 'undefined' ? AI_NAMES : ['Observer']).filter(n => !used.has(n));
      p.name = pool.length ? pool[(simRandom() * pool.length) | 0] : p.name + ' (AI)';
    }
  }
  p.ai = new AIPlayer(p, settings.difficulty || 'standard');
  W.revealAll = true; W.noFog = true; p.explored.fill(1);
  if (typeof updateVisibility === 'function') updateVisibility(true);
  if (typeof CMD === 'object' && CMD.speeds) { EXTRAS.savedSpeeds = EXTRAS.savedSpeeds || CMD.speeds; CMD.speeds = EXTRAS.spectateSpeeds; }
  if (typeof vicToggleScore === 'function') vicToggleScore(true);
  UI.selection = [];
  msg('Spectating: every player is computer-controlled. Keys 1-8 jump to a player, +/- change speed (up to 8x), F4 toggles scores, click units to inspect them.', '#9fd');
}
if (typeof startGame === 'function') {
  const _sg = startGame;
  startGame = function (spec, settings, fromEditor) {
    if (typeof CMD === 'object' && EXTRAS.savedSpeeds) CMD.speeds = EXTRAS.savedSpeeds;
    const r = _sg(spec, settings, fromEditor);
    if (settings && settings.spectate) exSpectateBegin(settings);
    return r;
  };
}
if (typeof rightClick === 'function') {
  const _rcl = rightClick;
  rightClick = function (...a) { if (W && W.spectate) return; return _rcl.apply(this, a); };
}
if (typeof alertAttack === 'function') {
  const _aa = alertAttack;
  alertAttack = function (...a) { if (W && W.spectate) return; return _aa.apply(this, a); };
}
if (typeof endGame === 'function') {
  const _eg = endGame;
  endGame = function (win) {
    if (!W.spectate) return _eg(win);
    if (W.over) return;
    const alive = W.players.filter(p => p && p.alive);
    if (alive.length > 1 && !alive.every(a => alive.every(b => isFriend(a.id, b.id)))) return;   // the watched slot fell; others fight on
    W.over = true; W.won = true; W.spectWinners = alive.map(p => p.id);
    UI.showEnd(true);
    const h = typeof document !== 'undefined' ? document.querySelector('#modal .modal-box h2') : null;
    if (h) h.innerHTML = (typeof GLYPH === 'function' ? GLYPH('flag') + ' ' : '') + (alive.length ? `${alive.map(p => escapeHtml(p.name)).join(' &amp; ')} win${alive.length === 1 ? 's' : ''}` : 'Game over');
    Sound.fanfare();
  };
}
if (typeof checkVictory === 'function') {
  const _cv = checkVictory;
  checkVictory = function () {
    _cv();
    if (W.spectate && !W.over && !W.players[W.humanId].alive) endGame(false);
  };
}
// spectator: number keys 1-8 jump to that player's Town Center (or army if it has none)
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (!W || !W.spectate || !UI.gameRunning || UI.chatOpen || e.ctrlKey || e.altKey || e.metaKey) return;
    const k = +e.key; if (!(k >= 1 && k <= 8) || !W.players[k]) return;
    const p = W.players[k];
    const t = W.list.find(b => b.kind === 'bld' && b.owner === k && b.type === 'tc') || W.list.find(u => u.owner === k && u.kind === 'unit' && !u.dying);
    W.watchId = k; UI.panelKey = '';   // the top bar and the hint follow the watched player (polish.js)
    if (t) { const c = t.kind === 'bld' ? center(t) : t; centerCamOn(c.x, c.y); msg(`Watching ${p.name} (${CIVS[p.civ].name})`, p.color.l); }
    e.stopImmediatePropagation(); e.preventDefault();
  }, true);
}

// ---------------------------------------------------------------- idle villager / idle soldier buttons (on the minimap corner)
// Click: select the next idle one and centre on it. Shift-click: select all of them. The top-bar 💤 counter is clickable too.
function exIdleList(kind) {
  if (!W || !W.list) return [];
  const mil = u => typeof cmdMilitary === 'function' ? cmdMilitary(u) : (UNITS[u.type].atk > 0 && u.type !== 'villager' && !hasTag(u.type, 'animal'));
  return W.list.filter(u => u.kind === 'unit' && u.owner === W.humanId && !u.order && !u.inside && !u.dying && !(u.queue && u.queue.length) && (kind === 'vil' ? (u.type === 'villager' || u.type === 'sapper') : mil(u)));
}
function exSelectIdle(kind, all) {
  const list = exIdleList(kind);
  if (!list.length) { msg(kind === 'vil' ? 'No idle villagers.' : 'No idle military units.', '#ccc'); return; }
  if (all) { selectEnts(list, false); const c = list.reduce((a, u) => ({ x: a.x + u.x / list.length, y: a.y + u.y / list.length }), { x: 0, y: 0 }); centerCamOn(c.x, c.y); }
  else {
    const key = kind === 'vil' ? 'idleIdx' : 'idleMilIdx';
    UI[key] = ((UI[key] === undefined ? -1 : UI[key]) + 1) % list.length;
    const u = list[UI[key]]; selectEnts([u], false); centerCamOn(u.x, u.y);
  }
  Sound.play('click');
}
function exIdleButtons() {
  const wrap = document.querySelector('#mm-wrap'); if (!wrap || document.querySelector('#b-idlevil')) return;
  wrap.style.position = 'relative';
  if (!document.querySelector('#ex-idle-css')) {
    const st = document.createElement('style'); st.id = 'ex-idle-css';
    st.textContent = `.ex-idle{position:absolute;left:4px;width:42px;height:42px;padding:0;border:2px solid #b08a48;border-radius:6px;background:radial-gradient(circle at 35% 30%,#6a4c2a,#2a1c0e);cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,230,170,.25);z-index:3}
.ex-idle img{width:36px;height:36px;display:block;margin:1px auto 0;image-rendering:auto}
.ex-idle b{position:absolute;right:-6px;top:-7px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#c0392b;color:#fff;font:bold 11px/18px sans-serif;text-align:center;box-shadow:0 1px 2px #000}
.ex-idle.none{opacity:.45;filter:grayscale(.7)} .ex-idle.none b{display:none}
.ex-idle:hover{border-color:#ffd77a} #b-idlevil{top:4px} #b-idlemil{top:52px}
#r-vil{cursor:pointer}`;
    document.head.appendChild(st);
  }
  const mk = (id, kind, unit, title) => {
    const b = document.createElement('button'); b.id = id; b.className = 'ex-idle none'; b.title = title;
    let src = ''; try { src = iconFor('unit:' + unit); } catch (e) { }
    b.innerHTML = `<img alt="" src="${src}"><b>0</b>`;
    b.onclick = e => { e.stopPropagation(); exSelectIdle(kind, e.shiftKey); };
    b.onmousedown = e => e.stopPropagation();
    wrap.appendChild(b);
  };
  mk('b-idlevil', 'vil', 'villager', 'Idle villagers — click: next one (.), shift-click: select all');
  mk('b-idlemil', 'mil', 'militia', 'Idle soldiers — click: next one (,), shift-click: select all');
  const rv = document.querySelector('#r-vil'); if (rv) { rv.title = 'Idle villagers — click or press . to select (shift-click: all)'; rv.onclick = e => exSelectIdle('vil', e.shiftKey); }
}
if (typeof updateTopbar === 'function') {
  const _utb = updateTopbar;
  updateTopbar = function () {
    _utb();
    if (typeof document === 'undefined' || !W || !W.players || W.menu) return;
    exIdleButtons();
    for (const [id, kind] of [['#b-idlevil', 'vil'], ['#b-idlemil', 'mil']]) {
      const b = document.querySelector(id); if (!b) continue;
      const n = W.spectate ? 0 : exIdleList(kind).length;
      b.style.display = W.spectate ? 'none' : '';
      b.classList.toggle('none', !n); b.querySelector('b').textContent = n;
      const img = b.querySelector('img'); if (img && !img.getAttribute('src')) { try { img.src = iconFor('unit:' + (kind === 'vil' ? 'villager' : 'militia')); } catch (e) { } }
    }
  };
}

// ---------------------------------------------------------------- edge scrolling at the window edges
// The map canvas sits between the top bar and the bottom panel, and the panel (taller than the layout reserves)
// covers the canvas's own bottom edge, so the canvas never sees the pointer there. Scroll down when the pointer:
//  - touches the top of the bottom panel (the visible bottom edge of the map),
//  - is in the bottom 8 px of the window, or
//  - has just left the window through its bottom edge (like AoE2, keep scrolling until it comes back).
// The same window-edge rules apply to the other three sides.
const EX_PTR = { x: -1, y: -1, inWin: false, out: null };
const EX_EDGE = { win: 8, band: 6, leave: 40 };
if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', e => { EX_PTR.x = e.clientX; EX_PTR.y = e.clientY; EX_PTR.inWin = true; EX_PTR.out = null; }, true);
  document.addEventListener('mouseleave', () => {
    EX_PTR.inWin = false;
    // remember which edge the pointer went out through, if it was close to one
    const L = EX_EDGE.leave, W_ = window.innerWidth, H_ = window.innerHeight;
    EX_PTR.out = { l: EX_PTR.x <= L, r: EX_PTR.x >= W_ - L, t: EX_PTR.y <= L, b: EX_PTR.y >= H_ - L };
    if (!EX_PTR.out.l && !EX_PTR.out.r && !EX_PTR.out.t && !EX_PTR.out.b) EX_PTR.out = null;
  });
  window.addEventListener('blur', () => { EX_PTR.inWin = false; EX_PTR.out = null; });
}
function exEdgeDir() {
  const W_ = window.innerWidth, H_ = window.innerHeight, m = EX_EDGE.win;
  if (!EX_PTR.inWin) { const o = EX_PTR.out; return o ? { x: o.l ? -1 : o.r ? 1 : 0, y: o.t ? -1 : o.b ? 1 : 0 } : { x: 0, y: 0 }; }
  const x = EX_PTR.x, y = EX_PTR.y; let dx = 0, dy = 0;
  if (x < m) dx = -1; else if (x >= W_ - m) dx = 1;
  if (y < m) dy = -1; else if (y >= H_ - m) dy = 1;
  // the visible bottom edge of the map: the top border of the bottom panel
  const bottom = document.getElementById('bottom');
  if (!dy && bottom && bottom.offsetParent !== null) {
    const top = bottom.getBoundingClientRect().top;
    if (top > 0 && y >= top - EX_EDGE.band && y <= top + EX_EDGE.band) dy = 1;
  }
  return { x: dx, y: dy };
}
if (typeof scrollCamera === 'function') {
  const _sc = scrollCamera;
  scrollCamera = function (dt) {
    _sc(dt);
    if (UI.drag || typeof document === 'undefined' || !document.hasFocus()) return;
    if (document.body.classList.contains('in-editor') || !document.body.classList.contains('in-game')) return;
    const d = exEdgeDir(); if (!d.x && !d.y) return;
    // the canvas already scrolls at its own left, right and top edges; avoid doubling the speed there
    const c = UI.mouse.inCanvas, mx = UI.mouse.x, my = UI.mouse.y, cm = 6;
    if (c && ((d.x < 0 && mx < cm) || (d.x > 0 && mx > R.cw - cm))) d.x = 0;
    if (c && ((d.y < 0 && my < cm) || (d.y > 0 && my > R.ch - cm))) d.y = 0;
    const sp = 900 * dt / R.cam.zoom;
    if (d.x || d.y) { R.cam.x += d.x * sp; R.cam.y += d.y * sp; clampCam(); }
  };
}
