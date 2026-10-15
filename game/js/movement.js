// ===== Realms mod: smoother, unstickable unit movement =====
// Loaded after units_hd.js, before main.js. Replaces followPath and separate (the originals are kept for ?move=off).
// Problems fixed:
//  - a unit off its tile centre heading for a diagonal waypoint clipped the corner tile (a tree, a building), was
//    refused the step, repathed from the same tile, got the same path and stood there for good;
//  - continuous movement and crowd separation could carry a unit across a cliff edge or onto a blocked tile;
//  - two units walking into each other in a corridor pushed each other back and forth.
// Now: blocked steps slide along the free axis, then fall back to the tile centre; cliff edges are respected; repeated
// failure repaths, then lifts the unit to the nearest free tile; oncoming units sidestep instead of shoving.
'use strict';
const MOVE = { enabled: true, repathAfter: 0.5, rescueAfter: 3, sidestep: true };
if (typeof location !== 'undefined' && location.search && new URLSearchParams(location.search).get('move') === 'off') MOVE.enabled = false;

// can u stand at (x, y) coming from (fx, fy)? tile passable for it and no cliff between the two tiles
function mvCanEnter(u, fx, fy, x, y) {
  const m = W.map, tx = x | 0, ty = y | 0, ox = fx | 0, oy = fy | 0;
  if (!m.inb(tx, ty) || !tilePassFor(u, x, y)) return false;
  if (tx === ox && ty === oy) return true;
  if (UNITS[u.type].naval) return true;
  if (!m.canStep(ox, oy, tx, ty)) return false;
  if (tx !== ox && ty !== oy) {   // diagonal tile change: both side tiles must be open (no squeezing between two corners)
    if (!tilePassFor(u, tx + 0.5, oy + 0.5) || !tilePassFor(u, ox + 0.5, ty + 0.5)) return false;
  }
  return true;
}
function mvNearestFree(u, maxR) {
  const m = W.map, cx = u.x | 0, cy = u.y | 0, pass = unitPass(u);
  let best = null, bd = 1e9;
  for (let r = 1; r <= maxR && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = cx + dx, y = cy + dy; if (!m.inb(x, y) || !pass(m.idx(x, y))) continue;
    const d = Math.hypot(x + 0.5 - u.x, y + 0.5 - u.y); if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5 }; }
  }
  return best;
}

if (typeof followPath === 'function') {
  const _fp = followPath;
  followPath = function (u, dt) {
    if (!MOVE.enabled) return _fp(u, dt);
    if (!u.path || u.pi >= u.path.length) { u.anim = u.anim === 'walk' ? 'idle' : u.anim; return true; }
    const d = UNITS[u.type];
    let p = u.path[u.pi];
    let dx = p.x - u.x, dy = p.y - u.y, dist = Math.hypot(dx, dy);
    // skip waypoints we are already standing on (after a slide or a separation push)
    while (dist < 0.05 && u.pi < u.path.length - 1) { u.pi++; p = u.path[u.pi]; dx = p.x - u.x; dy = p.y - u.y; dist = Math.hypot(dx, dy); }
    let sp = d.speed + statU(u, 'speed');
    if (!d.naval) { const e0 = W.map.h(u.x, u.y), e1 = W.map.h(u.x + dx / (dist || 1) * 0.3, u.y + dy / (dist || 1) * 0.3); sp *= e1 > e0 + 0.05 ? 0.8 : e1 < e0 - 0.05 ? 1.1 : 1; }
    if (u.carry && u.carry.amt > 0 && u.type === 'villager') sp *= 0.95;
    if (u.yieldT > 0) { u.yieldT -= dt; sp *= 0.35; }
    const step = Math.max(0, sp * dt);
    u.anim = 'walk';
    setFacing(u, dx, dy);
    const startOk = tilePassFor(u, u.x, u.y);
    if (dist <= step) {
      if (!startOk || mvCanEnter(u, u.x, u.y, p.x, p.y)) {
        u.x = p.x; u.y = p.y; u.pi++; u.stuck = 0; u.mvFails = 0;
        if (u.pi >= u.path.length) { u.anim = 'idle'; return true; }
        return false;
      }
    }
    const ux = dx / (dist || 1), uy = dy / (dist || 1);
    const tries = [[ux * step, uy * step]];
    // slide along whichever axis still gets us closer
    if (Math.abs(ux) > 0.05) tries.push([Math.sign(ux) * step, 0]);
    if (Math.abs(uy) > 0.05) tries.push([0, Math.sign(uy) * step]);
    // last resort: drift to the centre of the current tile (always enterable), which lines us up for the next try
    const cx = (u.x | 0) + 0.5 - u.x, cy = (u.y | 0) + 0.5 - u.y, cd = Math.hypot(cx, cy);
    if (cd > 0.02) tries.push([cx / cd * Math.min(step, cd), cy / cd * Math.min(step, cd)]);
    let moved = false;
    for (const [mx, my] of tries) {
      const nx = u.x + mx, ny = u.y + my;
      if (!startOk || mvCanEnter(u, u.x, u.y, nx, ny)) { u.x = nx; u.y = ny; moved = true; break; }
    }
    // progress is measured toward the waypoint, so sliding back and forth on the spot still counts as stuck
    const nd = Math.hypot(p.x - u.x, p.y - u.y);
    if (moved && nd < dist - step * 0.25) { u.stuck = Math.max(0, (u.stuck || 0) - dt); u.mvRescues = 0; return false; }
    u.stuck = (u.stuck || 0) + dt;
    if (u.stuck > MOVE.repathAfter) {
      u.stuck = 0; u.mvFails = (u.mvFails || 0) + 1;
      if (u.mvFails >= MOVE.rescueAfter) {
        // still nowhere after several fresh paths: step onto the centre of the nearest free tile and try again
        u.mvFails = 0; u.mvRescues = (u.mvRescues || 0) + 1;
        // the last stretch is unreachable (a blocked click point or a squeezed corner): call it arrived
        const end = u.path[u.path.length - 1];
        if (u.mvRescues >= 2 && Math.hypot(end.x - u.x, end.y - u.y) < 2.5) { u.path = null; u.mvRescues = 0; u.anim = 'idle'; return true; }
        if (u.mvRescues >= 4) { u.path = null; u.mvRescues = 0; u.anim = 'idle'; return true; }
        const f = tilePassFor(u, u.x, u.y) ? { x: (u.x | 0) + 0.5, y: (u.y | 0) + 0.5 } : mvNearestFree(u, 4);
        if (f) { u.x = f.x; u.y = f.y; }
      }
      if (u.goalRect) {
        const dest = u.dest;
        pathTo(u, u.goalRect, u.goalR);
        if (dest && u.pathOk && u.path && u.path.length) u.path[u.path.length - 1] = { x: dest.x, y: dest.y };
        u.dest = dest;
      } else if (u.path) {   // a hand-made path (formation slot etc.): just head straight for the last point via a fresh route
        const last = u.path[u.path.length - 1];
        pathTo(u, { x0: last.x | 0, y0: last.y | 0, x1: last.x | 0, y1: last.y | 0 }, 0);
      }
    }
    return false;
  };
}

// Crowd separation: never push across a cliff or into a blocked tile, and let a unit that is walking yield sideways
// to one coming the other way instead of shoving it back.
if (typeof separate === 'function') {
  const _sep = separate;
  separate = function (u, dt) {
    if (!MOVE.enabled) return _sep(u, dt);
    const r = UNIT_R(u), naval = !!UNITS[u.type].naval;
    const near = unitsNear(u.x, u.y, r + 0.9);
    const walking = u.path && u.pi < u.path.length;
    for (const o of near) {
      if (o === u || o.kind !== 'unit' || o.dying || !!UNITS[o.type].naval !== naval) continue;
      let ddx = u.x - o.x, ddy = u.y - o.y, dd = Math.hypot(ddx, ddy);
      const min = r + UNIT_R(o);
      if (dd >= min) continue;
      if (dd <= 0.0001) { ddx = simRandom() - 0.5; ddy = simRandom() - 0.5; dd = Math.hypot(ddx, ddy) || 1; }
      let push = (min - dd) * 0.5 * Math.min(1, dt * 6);
      let px = ddx / dd * push, py = ddy / dd * push;
      const oWalking = o.path && o.pi < o.path.length;
      if (MOVE.sidestep && walking && oWalking && u.dir !== undefined && o.dir !== undefined) {
        // head-on (directions roughly opposite): both step to their right
        const dot = Math.cos(u.dir) * Math.cos(o.dir) + Math.sin(u.dir) * Math.sin(o.dir);
        if (dot < -0.5) { const rx = -Math.sin(u.dir), ry = Math.cos(u.dir); px = rx * push * 1.4; py = ry * push * 1.4; u.yieldT = 0.25; }
      } else if (!walking && oWalking) {
        // standing units give way a little more, walking ones barely get pushed off their line
        px *= 1.3; py *= 1.3;
      } else if (walking && !oWalking) { px *= 0.5; py *= 0.5; }
      const nx = u.x + px, ny = u.y + py;
      if (mvCanEnter(u, u.x, u.y, nx, ny)) { u.x = nx; u.y = ny; }
      else if (mvCanEnter(u, u.x, u.y, u.x + px, u.y)) u.x += px;
      else if (mvCanEnter(u, u.x, u.y, u.x, u.y + py)) u.y += py;
    }
  };
}
