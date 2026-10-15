// ===== Drawn UI glyphs (replace emoji, which look different on every system and clash with the drawn icons) =====
// Loaded right after data.js. GLYPH(name) returns inline SVG that takes the surrounding text colour.
'use strict';
const GLYPH_PATHS = {
  sword: '<path d="M12.6 1.4 15 1l-.4 2.4-7.1 7.1-1.9-1.9z"/><path d="M3 9.3l1.2-1.2 3.7 3.7L6.7 13l-1.1-1.1-2.3 2.3a.9.9 0 0 1-1.3-1.3l2.3-2.3z"/>',
  target: '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="1.2"/>',
  shield: '<path d="M8 1 14 3v4.6c0 3.6-2.6 6.2-6 7.4-3.4-1.2-6-3.8-6-7.4V3z"/>',
  clock: '<circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.2 4h1.6v3.7l2.6 1.6-.8 1.3L7.2 8.6z"/>',
  lock: '<rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  trophy: '<path d="M4 1.5h8V6a4 4 0 0 1-8 0z"/><path d="M4 3H1.5v1.5A3 3 0 0 0 4.5 7.6M12 3h2.5v1.5a3 3 0 0 1-3 3.1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 9.5h2v2.5h2.5V14h-7v-2H7z"/>',
  skull: '<path d="M8 1.2c3.5 0 6 2.4 6 5.6 0 2-1 3.3-2.2 4V13H4.2v-2.2C3 10.1 2 8.8 2 6.8 2 3.6 4.5 1.2 8 1.2z"/><circle cx="5.6" cy="7" r="1.5" fill="#000" fill-opacity=".55"/><circle cx="10.4" cy="7" r="1.5" fill="#000" fill-opacity=".55"/><path d="M5 13.2h1.4v1.6H5zm2.3 0h1.4v1.6H7.3zm2.3 0H11v1.6H9.6z"/>',
  flag: '<path d="M3 1h1.6v14H3z"/><path d="M4.6 1.8h9l-2.2 3.1 2.2 3.1h-9z"/>',
  bolt: '<path d="M9.5 0.8 3 9h4l-1.2 6.2L13 6.8H9z"/>',
  fast: '<path d="M1 3l6.5 5L1 13zm7 0 6.5 5L8 13z"/>',
  sound: '<path d="M1.5 5.5h3L8.5 2v12l-4-3.5h-3z"/><path d="M10.5 5a4 4 0 0 1 0 6M12.3 3a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  dice: '<rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5" cy="5" r="1.3"/><circle cx="11" cy="11" r="1.3"/><circle cx="8" cy="8" r="1.3"/>',
  map: '<path d="M1 3.2 5.3 1.5l5.4 2 4.3-1.7v11L10.7 14.5l-5.4-2L1 14.2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.3 1.5v11M10.7 3.5v11" stroke="currentColor" stroke-width="1.2"/>',
  scroll: '<path d="M3.5 2h9a2 2 0 0 1 0 4H12v6.5a2.5 2.5 0 0 1-2.5 2.5h-7a2 2 0 0 1 0-4H4V4.5A2.5 2.5 0 0 1 3.5 2z"/><path d="M5.6 6h4.6M5.6 8.5h4.6" stroke="#000" stroke-opacity=".45" stroke-width="1"/>',
  trash: '<path d="M2 3.5h12v1.6H2zM6 1.5h4v2H6z"/><path d="M3.5 5.5h9l-.8 9H4.3z"/>',
  bridge: '<path d="M1 7.5h14v1.6H1z"/><path d="M1 9.1c2.3 0 3.7 1.4 4 3.9h1.2c.4-1.9 1-2.6 1.8-2.6s1.4.7 1.8 2.6H11c.3-2.5 1.7-3.9 4-3.9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 4.5h1.2v3H2.5zm4.5 0h1.2v3H7zm4.5 0h1.2v3h-1.2z"/>',
  pick: '<path d="M2.2 4.3C5.6 1.4 10.3.9 13.9 2.6c-1.7-.1-3.3.3-4.6 1.2L4 2.9z"/><path d="M8.3 4.6 9.6 6 3 14.6a1 1 0 0 1-1.5-1.3z"/>',
  trench: '<path d="M1 5h4l1.5 6h3L11 5h4v1.6h-2.8L10.7 13H5.3L3.8 6.6H1z"/>',
  mountain: '<path d="M.8 14 5.6 5l2.3 3.6L10.4 4 15.2 14z"/>',
  crown: '<path d="M1.5 5 5 8l3-5.5L11 8l3.5-3-1.5 8H3z"/><path d="M3 13.6h10V15H3z"/>',
  book: '<path d="M2 2.5c2.3-.6 4.3-.2 6 1.2v10.6c-1.7-1.4-3.7-1.8-6-1.2zm12 0c-2.3-.6-4.3-.2-6 1.2v10.6c1.7-1.4 3.7-1.8 6-1.2z"/>',
  save: '<path d="M2 2h10l2 2v10H2z"/><path d="M4.5 2h6v4h-6zM4 9h8v5H4z" fill="#000" fill-opacity=".4"/>',
  keys: '<rect x="1" y="4" width="14" height="9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 6.5h1.6v1.6H3.5zm3 0h1.6v1.6H6.5zm3 0h1.6v1.6H9.5zm-5 3h7v1.4h-7z"/>',
};
function GLYPH(name, title) {
  const p = GLYPH_PATHS[name]; if (!p) return '';
  return `<svg class="gl gl-${name}" viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="${title ? 'false' : 'true'}"${title ? ` role="img"><title>${title}</title>` : '>'}${p}</svg>`;
}
// static menu buttons in index.html carry data-glyph="<name>"
if (typeof document !== 'undefined') {
  const fill = () => document.querySelectorAll('[data-glyph]:not([data-glyph-done])').forEach(el => { el.insertAdjacentHTML('afterbegin', GLYPH(el.dataset.glyph) + ' '); el.dataset.glyphDone = '1'; });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
}
