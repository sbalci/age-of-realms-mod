// ===== Realms mod: battle tactics — terrain, flanking, veterans, and an AI that learns from its battles =====
// Loaded after balance.js, before main.js. Uses the GameHooks 'damage' modifier (world.js computeDamage) instead of
// wrapping engine functions. The AI side adds methods on AIPlayer that ai.js calls when present.
// URL switch: ?tactics=off
'use strict';
const TAC = {
  enabled: true,
  forestCover: 0.75,      // ranged damage taken by a unit standing in forest
  fordAttack: 0.8,        // damage dealt by a unit standing in shallow water (a ford, a wading spot)
  fordDefence: 1.15,      // melee damage taken while standing in shallow water
  flank: 1.2,             // melee damage to a unit that is busy fighting someone else and is hit from behind
  leader: 1.1,            // damage of units near a friendly Elite or Champion (rank 2+)
  leaderRange: 4,
  retreatHp: 0.35,        // AI veterans below this share of hit points fall back to heal
  regroupShare: 0.35,     // an AI wave whose strength falls below this share of its start pulls back
  stageDist: 11,          // tiles short of the target where an AI wave gathers before the assault
  stageWait: 25,          // seconds an AI wave waits at the staging point at most
};
if (typeof location !== 'undefined' && location.search && new URLSearchParams(location.search).get('tactics') === 'off') TAC.enabled = false;

// ---------- terrain under a unit ----------
function tacTerrain(e) {
  if (!e || e.kind !== 'unit' || !W || !W.map) return 'open';
  const m = W.map, x = e.x | 0, y = e.y | 0; if (!m.inb(x, y)) return 'open';
  const t = m.ter[m.idx(x, y)];
  if (m.trench && m.trench[m.idx(x, y)]) return 'trench';
  if (t === T.FOREST) return 'forest';
  if (t === T.SHALLOW) return 'ford';
  return 'open';
}
function tacIsRanged(att) { if (!att) return false; if (att.kind === 'bld') return true; const d = UNITS[att.type]; return !!(d && d.range > 0 && !d.meleeDmg); }
// is the attacker behind a target that is fighting someone else?
function tacFlanked(att, t) {
  if (!t || t.kind !== 'unit' || !att || att.kind !== 'unit' || tacIsRanged(att) || t.dir === undefined) return false;
  const o = t.order, busy = o && (o.t === 'attack' || o.t === 'attackmove') && o.id && o.id !== att.id && t.anim === 'attack';
  if (!busy) return false;
  const ang = Math.atan2(att.y - t.y, att.x - t.x), diff = Math.abs(Math.atan2(Math.sin(ang - t.dir), Math.cos(ang - t.dir)));
  return diff > Math.PI * 0.6;   // more than ~110 degrees off the way it faces
}
// a friendly Elite or Champion nearby (cached for a second per unit)
function tacLed(att) {
  if (!att || att.kind !== 'unit' || !att.owner) return false;
  if (att._ledT !== undefined && W.t - att._ledT < 1) return att._led;
  att._ledT = W.t;
  att._led = unitsNear(att.x, att.y, TAC.leaderRange, o => o !== att && o.owner === att.owner && (o.rank || 0) >= 2 && !o.dying).length > 0;
  return att._led;
}
// one place that explains the modifiers, for the selection panel and the tests
function tacFactors(att, t) {
  const f = [];
  if (!TAC.enabled || !att || !t) return f;
  const ranged = tacIsRanged(att), tt = tacTerrain(t), at = tacTerrain(att);
  if (ranged && tt === 'forest') f.push(['forest cover', TAC.forestCover]);
  if (at === 'ford') f.push(['attacking from a ford', TAC.fordAttack]);
  if (!ranged && tt === 'ford') f.push(['target caught in a ford', TAC.fordDefence]);
  if (tacFlanked(att, t)) f.push(['flanked', TAC.flank]);
  if (tacLed(att)) f.push(['led by a veteran', TAC.leader]);
  return f;
}
if (TAC.enabled && typeof GameHooks === 'object' && GameHooks.modify) {
  GameHooks.modify('damage', (dmg, att, t) => {
    if (!att || !t || t.kind !== 'unit' || (UNITS[t.type] && UNITS[t.type].animal)) return dmg;
    let k = 1; for (const [, m] of tacFactors(att, t)) k *= m;
    const out = dmg * k;
    tacRecord(att, t, out);
    return out;
  });
}

// ---------- battle memory: what each AI has learned about which troops work ----------
// Damage dealt and taken per troop class, decayed over time, so the AI keeps what works against this enemy.
const TAC_CLASSES = ['infantry', 'spear', 'archer', 'skirm', 'cavalry', 'cavarcher', 'siege', 'other'];
function tacClass(type) {
  const d = UNITS[type]; if (!d) return 'other'; const t = d.tags;
  if (t.includes('siege')) return 'siege';
  if (t.includes('archer') && t.includes('mounted')) return 'cavarcher';
  if (t.includes('skirm')) return 'skirm';
  if (t.includes('archer')) return 'archer';
  if (t.includes('mounted') || t.includes('cavalry')) return 'cavalry';
  if (t.includes('spear')) return 'spear';
  if (t.includes('infantry')) return 'infantry';
  return 'other';
}
function tacMem(p) {
  if (!p.ai) return null;
  if (!p.ai.battle) p.ai.battle = { dealt: {}, taken: {}, seen: {}, t: 0 };
  return p.ai.battle;
}
function tacRecord(att, t, dmg) {
  if (!W || !W.players || att.kind !== 'unit' || !att.owner || !t.owner || att.owner === t.owner) return;
  const pa = W.players[att.owner], pt = W.players[t.owner];
  const ca = tacClass(att.type), ct = tacClass(t.type);
  const ma = pa && tacMem(pa); if (ma) { ma.dealt[ca] = (ma.dealt[ca] || 0) + dmg; ma.seen[ct] = (ma.seen[ct] || 0) + dmg * 0.1; }
  const mt = pt && tacMem(pt); if (mt) { mt.taken[ct] = (mt.taken[ct] || 0) + dmg; mt.seen[ca] = (mt.seen[ca] || 0) + dmg; }
}
function tacDecay(mem, k) { for (const b of [mem.dealt, mem.taken, mem.seen]) for (const c in b) b[c] *= k; }

// ---------- AI: choosing troops from experience ----------
// Counters (AoE rock-paper-scissors) plus what has worked so far: a class that trades well gets more slots, one
// that dies without effect gets fewer.
const TAC_COUNTER = { cavalry: ['spearman', 'pikeman'], archer: ['skirmisher', 'scout', 'knight'], infantry: ['archer', 'crossbow'], spear: ['archer', 'militia'], skirm: ['militia', 'knight'], cavarcher: ['skirmisher', 'spearman'], siege: ['scout', 'knight', 'militia'] };
if (typeof AIPlayer === 'function') {
  AIPlayer.prototype.adaptTypes = function (btype, list) {
    if (!TAC.enabled || !this.battle) return list;
    const mem = this.battle;
    let main = null, mv = 0; for (const c in mem.seen) if (mem.seen[c] > mv) { mv = mem.seen[c]; main = c; }
    const out = list.slice();
    if (main && mv > 150 && TAC_COUNTER[main]) for (const t of TAC_COUNTER[main]) if (TRAIN[btype] && TRAIN[btype].includes(t)) out.push(t, t);
    // trade ratio by class for what this building makes
    for (const t of list) {
      const c = tacClass(t), dealt = mem.dealt[c] || 0, taken = mem.taken[c] || 0;
      if (dealt + taken < 200) continue;
      const ratio = dealt / Math.max(1, taken);
      if (ratio > 1.5) out.push(t); else if (ratio < 0.6 && out.filter(x => x === t).length > 1) out.splice(out.indexOf(t), 1);
    }
    return out;
  };

  // ---------- AI: ground to stand on ----------
  // the best spot near (x, y): high, open ground, not forest or water, reachable from home
  AIPlayer.prototype.highGround = function (x, y, r) {
    const m = W.map, h = this.home(), reg = m.landReg[m.idx(h.x | 0, h.y | 0)];
    let best = null, bs = -1e9;
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      const tx = (x + dx) | 0, ty = (y + dy) | 0; if (!m.inb(tx, ty)) continue;
      const i = m.idx(tx, ty); if (isWaterT(m.ter[i]) || m.ter[i] === T.SHALLOW || m.blk[i] || m.landReg[i] !== reg) continue;
      const s = m.elev[i] * 3 - Math.hypot(dx, dy) * 0.25 - (m.ter[i] === T.FOREST ? 2 : 0);
      if (s > bs) { bs = s; best = { x: tx + 0.5, y: ty + 0.5 }; }
    }
    return best;
  };
  // rally point: the highest open ground just in front of home, toward the enemy
  AIPlayer.prototype.rallyPoint = function () {
    const h = this.home();
    if (!TAC.enabled) return { x: h.x + 5, y: h.y + 5 };
    if (this.rally && W.t - this.rally.t < 60) return this.rally;
    const tp = typeof this.targetPlayer === 'function' ? this.targetPlayer() : null;
    const eb = tp ? W.list.find(e => e.owner === tp && e.kind === 'bld' && e.type === 'tc') : null;
    let dx = 5, dy = 5;
    if (eb) { const c = center(eb), d = Math.hypot(c.x - h.x, c.y - h.y) || 1; dx = (c.x - h.x) / d * 7; dy = (c.y - h.y) / d * 7; }
    const p = this.highGround(h.x + dx, h.y + dy, 4) || { x: h.x + 5, y: h.y + 5 };
    this.rally = { x: p.x, y: p.y, t: W.t };
    return this.rally;
  };
  // Before an assault the wave gathers on high ground short of the target, so it arrives together instead of
  // trickling in one unit at a time. Returns true while the army is still staging.
  AIPlayer.prototype.stageAttack = function (army, tc) {
    if (!TAC.enabled || army.length < 4) return false;
    const st = this.staging;
    if (st && st.done && Math.hypot(st.tx - tc.x, st.ty - tc.y) < 8) return false;
    if (!st || Math.hypot(st.tx - tc.x, st.ty - tc.y) >= 8) {
      const cx = army.reduce((s, u) => s + u.x, 0) / army.length, cy = army.reduce((s, u) => s + u.y, 0) / army.length;
      const d = Math.hypot(tc.x - cx, tc.y - cy); if (d < TAC.stageDist + 4) { this.staging = { tx: tc.x, ty: tc.y, done: true }; return false; }
      const sx = tc.x + (cx - tc.x) / d * TAC.stageDist, sy = tc.y + (cy - tc.y) / d * TAC.stageDist;
      const p = this.highGround(sx, sy, 4) || { x: sx, y: sy };
      this.staging = { tx: tc.x, ty: tc.y, x: p.x, y: p.y, t: W.t, done: false };
      orderMove(army.filter(u => !(u.order && u.order.t === 'attack')), p.x, p.y);
      return true;
    }
    const near = army.filter(u => Math.hypot(u.x - st.x, u.y - st.y) < 6).length;
    if (near >= army.length * 0.7 || W.t - st.t > TAC.stageWait || this.underThreatAt(st.x, st.y)) { st.done = true; return false; }
    return true;
  };
  AIPlayer.prototype.underThreatAt = function (x, y) {
    return unitsNear(x, y, 7, u => isEnemy(this.id, u.owner) && !u.dying && UNITS[u.type].atk > 0 && u.type !== 'villager').length >= 2;
  };
  // Battle discipline, every second: wounded veterans fall back to heal, a broken wave regroups, ranged units
  // in the open step onto nearby high ground when the enemy closes in.
  AIPlayer.prototype.tactics = function (dt) {
    if (!TAC.enabled) return;
    this.tacT = (this.tacT || 0) + dt; if (this.tacT < 1) return; const step = this.tacT; this.tacT = 0;
    const mem = tacMem(this.p); if (mem) tacDecay(mem, Math.pow(0.5, step / 240));   // half-life of 4 minutes
    const army = this.army();
    // 1. veterans are worth keeping: below 35% hp they go home to the nearest Town Center, castle or tower
    const havens = this.mine(e => e.kind === 'bld' && e.built && (e.type === 'tc' || e.type === 'castle' || e.type === 'tower') && BUILDINGS[e.type].garrison);
    for (const u of army) {
      if ((u.rank || 0) < 1 || u.hp > u.maxhp * TAC.retreatHp || u.inside || (u.order && u.order.t === 'garrison')) continue;
      if (!havens.length || UNITS[u.type].naval || hasTag(u.type, 'siege')) continue;
      const hv = havens.reduce((a, b) => Math.hypot(center(a).x - u.x, center(a).y - u.y) < Math.hypot(center(b).x - u.x, center(b).y - u.y) ? a : b);
      if (typeof canGarrisonIn === 'function' && !canGarrisonIn(u, hv)) continue;
      setOrder(u, { t: 'garrison', id: hv.id });
    }
    // healed veterans come back out (garrisons heal slowly; the town bell keeps its own villagers inside)
    if (!this.p.bell) for (const b of havens) for (const id of (b.garrison || []).slice()) {
      const u = ent(id); if (u && (u.rank || 0) >= 1 && u.hp >= u.maxhp * 0.9 && typeof ungarrisonOne === 'function') ungarrisonOne(b, id);
    }
    // 2. a wave that has lost most of its strength pulls back to the rally point instead of dying piecemeal
    const value = army.reduce((s, u) => s + u.hp, 0);
    if (this.state === 'attacking') {
      if (!this.waveStart) this.waveStart = value;
      if (value < this.waveStart * TAC.regroupShare && army.length) {
        const rp = this.rallyPoint();
        orderMove(army.filter(u => !u.inside), rp.x, rp.y);
        this.state = 'boom'; this.nextAttack = this.t + 90; this.waveStart = 0; this.staging = null;
        this.regroups = (this.regroups || 0) + 1;
      }
    } else this.waveStart = 0;
    // 3. archers facing an enemy in the open take nearby high ground or kite back between shots when melee closes in
    const byDist = (x, y) => (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y);
    for (const u of army) {
      if (!tacIsRanged(u) || hasTag(u.type, 'siege') || u.inside || (u.order && u.order.t !== 'attackmove' && u.order.t !== 'attack')) continue;
      if (u._hgT && W.t - u._hgT < 5) continue;
      const foe = unitsNear(u.x, u.y, 6, o => isEnemy(this.id, o.owner) && !o.dying && UNITS[o.type].atk > 0 && !tacIsRanged(o)).sort(byDist(u.x, u.y))[0];
      if (!foe) continue;
      const m = W.map, here = m.elevAt(u.x, u.y), hg = this.highGround(u.x, u.y, 3);
      if (hg && m.elevAt(hg.x, hg.y) > here && m.elevAt(hg.x, hg.y) >= m.elevAt(foe.x, foe.y)) { u._hgT = W.t; setOrder(u, { t: 'move', x: hg.x, y: hg.y }); continue; }
      const dist = Math.hypot(u.x - foe.x, u.y - foe.y);
      if (dist < 2.1 && u.cd > 0.35 && (!u._kiteT || W.t - u._kiteT >= 4)) {
        const dx = (u.x - foe.x) / (dist || 1), dy = (u.y - foe.y) / (dist || 1);
        const kx = u.x + dx * 2.4, ky = u.y + dy * 2.4;
        if (tilePassFor(u, kx, ky)) { u._kiteT = W.t; setOrder(u, { t: 'move', x: kx, y: ky, then: { t: 'attack', id: foe.id } }); }
      }
    }
    // 4. combat monks: convert high-value enemy units when recharged, or heal wounded allies
    const monks = this.mine(e => e.kind === 'unit' && e.type === 'monk' && !e.inside && !e.dying && !e.relic);
    for (const m of monks) {
      if (m.order && (m.order.t === 'relic' || m.order.t === 'deposit' || m.order.t === 'convert' || m.order.t === 'heal' || m.order.flee)) continue;
      const followOrder = m.order && m.order.t === 'follow' ? { t: 'follow', id: m.order.id } : null;
      if ((m.recharge || 0) <= 0) {
        const hv = unitsNear(m.x, m.y, 9, o => isEnemy(this.id, o.owner) && !o.dying && !o.inside && !UNITS[o.type].animal && !UNITS[o.type].naval && !hasTag(o.type, 'siege') && (UNITS[o.type].cost && (UNITS[o.type].cost.gold || 0) >= 40 || hasTag(o.type, 'mounted') || hasTag(o.type, 'unique'))).sort(byDist(m.x, m.y))[0];
        if (hv) { setOrder(m, { t: 'convert', id: hv.id }); continue; }
      }
      const wounded = unitsNear(m.x, m.y, 8, o => isFriend(this.id, o.owner) && o !== m && !o.dying && !o.inside && o.hp < o.maxhp * 0.85 && !hasTag(o.type, 'machine') && !UNITS[o.type].animal).sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp)[0];
      if (wounded) setOrder(m, { t: 'heal', id: wounded.id, then: followOrder });
    }
    // 5. siege escort: intercept enemy melee units attacking our siege engines
    const sieges = army.filter(u => hasTag(u.type, 'siege'));
    for (const s of sieges) {
      const raider = unitsNear(s.x, s.y, 4.5, o => isEnemy(this.id, o.owner) && !o.dying && !tacIsRanged(o) && UNITS[o.type].atk > 0).sort(byDist(s.x, s.y))[0];
      if (!raider) continue;
      const guards = army.filter(u => !hasTag(u.type, 'siege') && !tacIsRanged(u) && (!u.order || u.order.t === 'attackmove' || u.order.t === 'move') && Math.hypot(u.x - s.x, u.y - s.y) < 8).sort(byDist(s.x, s.y)).slice(0, 2);
      for (const g of guards) if (canAttack(g, raider)) setOrder(g, { t: 'attack', id: raider.id, then: g.order && g.order.t === 'attackmove' ? Object.assign({}, g.order) : null });
    }
  };
}

// ---------- the player's view: why a fight goes the way it does ----------
if (TAC.enabled && typeof renderSelInfo === 'function') {
  const _rsi = renderSelInfo;
  renderSelInfo = function () {
    _rsi();
    const sel = UI.selection; if (sel.length !== 1 || typeof document === 'undefined') return;
    const u = sel[0], info = document.querySelector('#selinfo .info');
    if (!info || u.kind !== 'unit' || UNITS[u.type].animal || UNITS[u.type].naval) return;
    const notes = [];
    const tt = tacTerrain(u), elev = W.map.elevAt(u.x, u.y);
    if (tt === 'forest') notes.push('in forest: arrows do 25% less');
    if (tt === 'ford') notes.push('in a ford: fights 20% worse');
    if (tt === 'trench') notes.push('in a trench: +2 pierce armor');
    if (elev >= 2) notes.push('on high ground: +25% damage downhill');
    if (tacLed(u)) notes.push('led by a veteran: +10% damage');
    if (notes.length) info.insertAdjacentHTML('beforeend', `<div class="small dim">${notes.join(' · ')}</div>`);
  };
}
