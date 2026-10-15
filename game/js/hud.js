// ===== Realms mod: HUD layout (fixed command grid, larger minimap with filters and order lines) =====
// Uses GameHooks events only ('commands', 'minimap', 'topbar'); no engine functions are wrapped.
// URL switch: ?hud=off keeps the earlier flowing command card and the small square minimap.
'use strict';
const HUD = {
  enabled: true,
  // A button's place on the card follows its hotkey on the keyboard, so position and key teach each other.
  grid: ['QWERTY', 'ASDFGH', 'ZXCVBN'],
  rows: 4, cols: 6,                  // row 4 holds Back (bottom left), Delete (bottom right) and keys outside the grid (U, K, L, P...)
  filters: [['all', 'All', 'Everything'], ['mil', 'Army', 'Soldiers, towers, castles and military buildings'], ['eco', 'Eco', 'Villagers, resources and economic buildings'], ['land', 'Land', 'Terrain only']],
  pings: [],                         // minimap clicks and right-click orders, drawn as fading rings
};
if (typeof location !== 'undefined' && location.search && new URLSearchParams(location.search).get('hud') === 'off') HUD.enabled = false;

// ---------- fixed command grid ----------
// Assign every command a slot: its hotkey's keyboard cell when free; otherwise the bottom row; otherwise the first free cell.
function hudAssignSlots(cmds, rows = HUD.rows, cols = HUD.cols) {
  const taken = new Set(), at = (r, c) => r * cols + c, put = (cmd, r, c) => { cmd.slot = { row: r, col: c }; taken.add(at(r, c)); };
  const last = rows - 1;
  for (const c of cmds) delete c.slot;
  for (const c of cmds) {
    if (c.key === 'Delete' && !taken.has(at(last, cols - 1))) put(c, last, cols - 1);
    else if (c.key === 'Escape' && !taken.has(at(last, 0))) put(c, last, 0);
  }
  for (const c of cmds) {
    if (c.slot || typeof c.key !== 'string' || c.key.length !== 1) continue;
    const k = c.key.toUpperCase();
    for (let r = 0; r < HUD.grid.length && r < last; r++) { const col = HUD.grid[r].indexOf(k); if (col >= 0 && col < cols && !taken.has(at(r, col))) { put(c, r, col); break; } }
  }
  const free = [];
  for (let c = 1; c < cols - 1; c++) free.push([last, c]);
  for (let r = 0; r < last; r++) for (let c = 0; c < cols; c++) free.push([r, c]);
  free.push([last, 0], [last, cols - 1]);
  let extra = rows;
  for (const c of cmds) {
    if (c.slot) continue;
    const f = free.find(([r, k]) => !taken.has(at(r, k)));
    if (f) put(c, f[0], f[1]); else { put(c, extra, 0); extra++; } // never lose a command; overflow scrolls
  }
  return cmds;
}
if (HUD.enabled && typeof GameHooks === 'object') {
  GameHooks.on('commands', (sel, cmds) => {
    if (!cmds) return;
    hudAssignSlots(cmds);
    if (typeof UI === 'object') UI.cmdGrid = cmds.length ? { rows: HUD.rows, cols: HUD.cols } : null;
  });
}

// ---------- minimap: size, filters, order lines ----------
function hudFitMinimap() {
  if (typeof document === 'undefined') return;
  const wrap = document.querySelector('#mm-wrap'), cv = document.querySelector('#minimap'); if (!wrap || !cv) return;
  const bar = wrap.querySelector('.mm-filters'), barH = bar ? bar.offsetHeight + 4 : 0;
  const cs = getComputedStyle(wrap), availW = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), availH = wrap.clientHeight - barH - 8;
  if (availW <= 0 || availH <= 0) return;
  const h = Math.floor(Math.min(availW / 2, availH)), w = h * 2, dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const W2 = Math.round(w * dpr), H2 = Math.round(h * dpr);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  if (cv.width !== W2 || cv.height !== H2) { cv.width = W2; cv.height = H2; if (typeof W === 'object' && W && W.map) try { renderMinimap(cv, typeof Editor === 'object' && Editor.active); } catch (e) { /* drawn next frame */ } }
}
function hudMinimapBar() {
  if (typeof document === 'undefined') return;
  const wrap = document.querySelector('#mm-wrap'); if (!wrap || wrap.querySelector('.mm-filters')) return;
  wrap.classList.add('hud-mm');
  const bar = document.createElement('div'); bar.className = 'mm-filters';
  bar.innerHTML = HUD.filters.map(([id, label, title]) => `<button type="button" data-f="${id}" title="${title}" class="${(MM.filter || 'all') === id ? 'on' : ''}">${label}</button>`).join('');
  bar.onmousedown = e => e.stopPropagation();
  bar.onclick = e => {
    const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
    MM.filter = b.dataset.f; bar.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    try { localStorage.setItem('aor.mmFilter', MM.filter); } catch (err) { /* private mode */ }
    if (typeof W === 'object' && W && W.map) renderMinimap(document.querySelector('#minimap'));
  };
  wrap.appendChild(bar);
  const cv = document.querySelector('#minimap');
  // right-click orders and jumps leave a ring on the minimap
  if (cv) cv.addEventListener('mousedown', e => {
    if (typeof minimapToTile !== 'function' || !W || !W.map) return;
    const r = cv.getBoundingClientRect(), t = minimapToTile(cv, (e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height);
    HUD.pings.push({ x: t.x, y: t.y, t: performance.now(), col: e.button === 2 ? '#7dff7a' : '#ffffff' });
  });
  hudFitMinimap();
  if (typeof ResizeObserver === 'function') new ResizeObserver(hudFitMinimap).observe(wrap);
  else window.addEventListener('resize', hudFitMinimap);
}
if (HUD.enabled && typeof MM === 'object') {
  try { const f = localStorage.getItem('aor.mmFilter'); if (HUD.filters.some(x => x[0] === f)) MM.filter = f; } catch (e) { /* private mode */ }
}
if (HUD.enabled && typeof GameHooks === 'object') {
  GameHooks.on('topbar', () => { hudMinimapBar(); });
  GameHooks.on('minimap', (g, cv, editor) => {
    if (editor || !W || !UI) return;
    const k = cv.width / (W.n * 2), px = 1 / k; // one screen pixel in tile units
    // where the selected units are heading
    const mine = (UI.selection || []).filter(u => u.kind === 'unit' && u.owner === W.humanId && !u.dying).slice(0, 60);
    if (mine.length) {
      g.save(); g.lineWidth = 1.2 * px; g.strokeStyle = 'rgba(125,255,122,0.75)'; g.setLineDash([3 * px, 2 * px]);
      for (const u of mine) {
        const o = u.order; if (!o) continue;
        const p = typeof cmdOrderPoint === 'function' ? cmdOrderPoint(o) : (o.x !== undefined ? o : null);
        if (!p || Math.hypot(p.x - u.x, p.y - u.y) < 2) continue;
        g.strokeStyle = o.t === 'attack' || o.t === 'attackmove' ? 'rgba(255,110,90,0.8)' : 'rgba(125,255,122,0.75)';
        g.beginPath(); g.moveTo(u.x, u.y); g.lineTo(p.x, p.y); g.stroke();
      }
      g.restore();
    }
    const now = performance.now();
    HUD.pings = HUD.pings.filter(p => now - p.t < 1200);
    for (const p of HUD.pings) {
      const a = 1 - (now - p.t) / 1200;
      g.strokeStyle = p.col; g.globalAlpha = a; g.lineWidth = 1.5 * px;
      g.beginPath(); g.arc(p.x, p.y, (3 + (1 - a) * 6) * px, 0, 6.3); g.stroke(); g.globalAlpha = 1;
    }
  });
}
// the card is laid out on a fixed grid; styles live here so ?hud=off restores the old look completely
if (HUD.enabled && typeof document !== 'undefined' && !document.querySelector('#hud-css')) {
  const st = document.createElement('style'); st.id = 'hud-css';
  st.textContent = `:root{--hud-h:202px;--cmd-w:60px;--cmd-h:44px}
#bottom{height:var(--hud-h)}
#chatbox{bottom:calc(var(--hud-h) + 20px)} body.vic-score-open #tipbox{bottom:calc(var(--hud-h) + 16px)}
#cmds{width:auto;grid-template-columns:repeat(6,var(--cmd-w));grid-template-rows:repeat(4,var(--cmd-h));grid-auto-rows:var(--cmd-h);overflow-y:auto}
.cmd{width:var(--cmd-w);height:var(--cmd-h)}
.cmd-empty{border:1px solid rgba(154,122,68,.22);border-radius:3px;background:rgba(0,0,0,.14)}
#mm-wrap.hud-mm{width:clamp(280px,27vw,420px);box-sizing:border-box;padding:4px 4px 4px 52px;flex-direction:column;justify-content:center;align-items:center;gap:4px}
#mm-wrap.hud-mm #minimap{object-fit:fill;max-width:none}
.mm-filters{display:flex;gap:3px;justify-content:center}
.mm-filters button{font:600 11px/1 sans-serif;color:#e8d4a0;background:rgba(0,0,0,.35);border:1px solid #7a5c30;border-radius:3px;padding:3px 7px;cursor:pointer}
.mm-filters button.on{background:#8a6a38;color:#fff3cf;border-color:#d8b46a}
.mm-filters button:focus-visible{outline:2px solid #fff3aa;outline-offset:1px}
@media (max-height:780px){:root{--hud-h:178px;--cmd-h:38px}}
@media (max-width:1100px){:root{--cmd-w:50px}}`;
  (document.head || document.documentElement).appendChild(st);
}
