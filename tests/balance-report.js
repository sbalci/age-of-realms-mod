// Balance harness: plays seeded AI-vs-AI games in parallel and writes a report that can be compared over time.
//   node tests/balance-report.js [--seeds=1,2,3] [--maps=land,coastal] [--civs=franks,turks] [--minutes=35]
//                                [--difficulty=standard] [--jobs=2] [--out=docs/balance] [--no-history]
// Writes <out>/latest.md and <out>/latest.json, and appends one summary row to <out>/history.csv.
// The phase-1 gate in docs/IMPROVEMENT_PLAN.md is "a standard AI reaches the Castle Age by minute 22 in 9 of 10 games".
'use strict';
const fs = require('fs'), path = require('path'), { fork, execSync } = require('child_process');

// ---------- worker: one game ----------
if (process.argv[2] === '--worker') {
  const harness = require('./engine-harness');
  process.on('message', o => {
    const { run, warnings } = harness();
    const t0 = Date.now();
    const r = run(`(() => {
      const o=${JSON.stringify(o)}, spec=generateMapSpec({size:'small',seed:o.seed,mapType:o.mapType,numPlayers:2});
      createWorld(spec,{players:o.civs.map((civ,i)=>({name:civ,civ,color:PLAYER_COLORS[i],human:i===0})),seed:o.seed,fog:'none',startRes:'standard',startAge:0,difficulty:o.difficulty});
      W.spectate=true; for(const p of W.players.slice(1)) p.ai=new AIPlayer(p,o.difficulty);
      const st=W.players.slice(1).map(()=>({old:0,vows:0,thirst:0,ageUp:[],vils:[],army:[]}));
      if(typeof modDieOfAge==='function'){ const f=modDieOfAge; modDieOfAge=function(u){ const s=st[u.owner-1]; if(s) s.old++; return f(u); }; }
      if(typeof modBecomeMonk==='function'){ const f=modBecomeMonk; modBecomeMonk=function(u){ const s=st[u.owner-1]; if(s) s.vows++; return f(u); }; }
      const lastAge=W.players.slice(1).map(p=>p.age), step=0.05, perMin=Math.round(60/step);
      let maxTick=0;
      for(let i=0;i<o.minutes*perMin&&!W.over;i++){
        const t0=performance.now(); worldTick(step); const dt=performance.now()-t0; if(dt>maxTick&&i>20) maxTick=dt;
        if(i%20===0) W.players.slice(1).forEach((p,k)=>{ if(p.waterDef>0) st[k].thirst++; if(p.age!==lastAge[k]){ lastAge[k]=p.age; st[k].ageUp.push(+(W.t/60).toFixed(1)); } });
        if(i%(perMin*5)===0) W.players.slice(1).forEach((p,k)=>{ const mine=W.list.filter(u=>u.kind==='unit'&&u.owner===p.id&&!u.dying); st[k].vils.push(mine.filter(u=>u.type==='villager').length); st[k].army.push(mine.filter(u=>u.type!=='villager'&&u.atk).length); });
      }
      const alive=W.players.slice(1).filter(p=>p.alive);
      return { minutes:+(W.t/60).toFixed(1), over:!!W.over, maxTickMs:Math.round(maxTick), winner:W.over&&alive.length===1?alive[0].civ:null,
        players:W.players.slice(1).map((p,k)=>({ civ:p.civ, age:p.age, ageUp:st[k].ageUp, gathered:Math.round(p.stats.gathered), kills:p.stats.kills, lost:p.stats.lost,
          oldAge:st[k].old, vows:st[k].vows, thirstSec:st[k].thirst, vils:st[k].vils, army:st[k].army })) };
    })()`);
    process.send({ ...o, ...r, warnings: warnings.slice(0, 5), wallSec: Math.round((Date.now() - t0) / 1000) });
  });
  return;
}

// ---------- coordinator ----------
const args = Object.fromEntries(process.argv.slice(2).map(s => { const [k, v] = s.replace(/^--/, '').split('='); return [k, v === undefined ? true : v]; }));
const list = (v, d) => String(v || d).split(',').map(s => s.trim()).filter(Boolean);
const seeds = list(args.seeds, '1,2,3,4,5').map(Number), maps = list(args.maps, 'land'), civs = list(args.civs, 'franks,turks');
const limitSec = Number(args.timeout || 1200); // a game that takes longer than this (wall clock) is stopped and reported
const minutes = Number(args.minutes || 35), difficulty = args.difficulty || 'standard', jobs = Math.max(1, Number(args.jobs || require('os').cpus().length));
const out = path.resolve(args.out || path.join(__dirname, '../docs/balance'));
if (seeds.some(s => !Number.isInteger(s)) || maps.some(m => !['land', 'coastal', 'islands'].includes(m)) || !(minutes > 0 && minutes <= 120)) throw new Error('Invalid options.');

const games = [];
for (const seed of seeds) for (const mapType of maps) for (let a = 0; a < civs.length; a++) for (let b = a + 1; b < civs.length; b++)
  games.push({ seed, mapType, civs: [civs[a], civs[b]], difficulty, minutes });
if (civs.length === 1) for (const seed of seeds) for (const mapType of maps) games.push({ seed, mapType, civs: [civs[0], civs[0]], difficulty, minutes });

const results = [];
let next = 0;
const started = Date.now();
function launch() {
  if (next >= games.length) return null;
  const g = games[next++], w = fork(__filename, ['--worker'], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  return new Promise(res => {
    const timer = setTimeout(() => { results.push({ ...g, error: `stopped after ${limitSec}s (simulation too slow)`, players: [] }); console.log(`[${results.length}/${games.length}] seed ${g.seed} ${g.mapType}: stopped after ${limitSec}s`); w.kill(); res(); }, limitSec * 1000);
    w.on('message', r => { clearTimeout(timer); results.push(r); console.log(`[${results.length}/${games.length}] seed ${r.seed} ${r.mapType} ${r.civs.join(' v ')}: ${r.winner ? r.winner + ' won' : 'no winner'} at ${r.minutes} min (${r.wallSec}s)`); w.kill(); res(); });
    w.on('exit', code => { clearTimeout(timer); if (code && !results.some(r => r.seed === g.seed && r.mapType === g.mapType && r.civs.join() === g.civs.join())) { results.push({ ...g, error: 'worker exited ' + code, players: [] }); res(); } });
    w.send(g);
  }).then(launch);
}
Promise.all(Array.from({ length: Math.min(jobs, games.length) }, launch)).then(() => report());

// ---------- report ----------
function median(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(1); }
function fmt(v, unit = '') { return v === null || v === undefined ? '–' : v + unit; }
function report() {
  results.sort((a, b) => a.seed - b.seed || a.mapType.localeCompare(b.mapType) || a.civs.join().localeCompare(b.civs.join()));
  const ok = results.filter(r => !r.error), players = ok.flatMap(r => r.players.map(p => ({ ...p, game: r })));
  const feudal = players.map(p => p.ageUp[0]).filter(v => v !== undefined), castle = players.map(p => p.ageUp[1]).filter(v => v !== undefined), imperial = players.map(p => p.ageUp[2]).filter(v => v !== undefined);
  const gate = players.filter(p => p.ageUp[1] !== undefined && p.ageUp[1] <= 22).length;
  const decided = ok.filter(r => r.winner).length;
  let commit = args.commit || '';
  if (!commit) try { commit = execSync('git rev-parse --short HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { /* not a repo */ }
  const date = new Date().toISOString().slice(0, 10);
  const summary = {
    date, commit, games: results.length, errors: results.length - ok.length, minutes, difficulty, maps: maps.join(' '), civs: civs.join(' '),
    decidedShare: ok.length ? +(decided / ok.length).toFixed(2) : 0, medianLength: median(ok.map(r => r.minutes)),
    feudalMedian: median(feudal), castleMedian: median(castle), castleReached: +(castle.length / Math.max(1, players.length)).toFixed(2),
    imperialReached: +(imperial.length / Math.max(1, players.length)).toFixed(2), gateCastleBy22: `${gate}/${players.length}`,
    peakVillagersMedian: median(players.map(p => Math.max(0, ...p.vils))), gatheredMedian: median(players.map(p => p.gathered)),
    slowestTickMs: Math.max(0, ...ok.map(r => r.maxTickMs || 0)),
    oldAgeMedian: median(players.map(p => p.oldAge)), vowsMedian: median(players.map(p => p.vows)), thirstMedian: median(players.map(p => p.thirstSec)),
  };
  // per civilisation
  const civRows = civs.map(c => {
    const mine = players.filter(p => p.civ === c), games = ok.filter(r => r.civs.includes(c));
    const wins = games.filter(r => r.winner === c).length, losses = games.filter(r => r.winner && r.winner !== c).length;
    return `| ${c} | ${games.length} | ${wins}–${losses} | ${fmt(median(mine.map(p => p.ageUp[0]).filter(v => v !== undefined)), ' min')} | ${fmt(median(mine.map(p => p.ageUp[1]).filter(v => v !== undefined)), ' min')} | ${mine.filter(p => p.ageUp[1] !== undefined).length}/${mine.length} | ${fmt(median(mine.map(p => Math.max(0, ...p.vils))))} | ${fmt(median(mine.map(p => p.gathered)))} |`;
  });
  const gameRows = results.map(r => r.error ? `| ${r.seed} | ${r.mapType} | ${r.civs.join(' v ')} | error: ${r.error} | | | |` :
    `| ${r.seed} | ${r.mapType} | ${r.civs.join(' v ')} | ${r.winner || 'none'} | ${r.minutes} | ${r.players.map(p => p.ageUp.join('/') || '–').join(' · ')} | ${r.players.map(p => p.vils.join('→')).join(' · ')} | ${r.players.map(p => `${p.oldAge}+${p.vows}`).join(' · ')} |`);
  const md = `# Balance report

${date}${commit ? ' · commit `' + commit + '`' : ''} · ${results.length} games · ${difficulty} AI · ${minutes}-minute limit · maps: ${maps.join(', ')}

Generated by \`node tests/balance-report.js\`. Each row of [history.csv](history.csv) is one run of this report.

## Summary

| Measure | Value |
| --- | --- |
| Phase-1 gate: AI players in the Castle Age by minute 22 | **${summary.gateCastleBy22}** (target 9 of 10) |
| Games with a winner | ${decided}/${ok.length} |
| Median game length | ${fmt(summary.medianLength, ' min')} |
| Median Feudal Age time | ${fmt(summary.feudalMedian, ' min')} |
| Median Castle Age time (players who reached it) | ${fmt(summary.castleMedian, ' min')} |
| Players reaching the Castle Age / Imperial Age | ${Math.round(summary.castleReached * 100)}% / ${Math.round(summary.imperialReached * 100)}% |
| Median peak villagers | ${fmt(summary.peakVillagersMedian)} |
| Median resources gathered | ${fmt(summary.gatheredMedian)} |
| Median old-age deaths / vows per player | ${fmt(summary.oldAgeMedian)} / ${fmt(summary.vowsMedian)} |
| Median seconds short of clean water per player | ${fmt(summary.thirstMedian)} |
| Slowest simulation tick in any game | ${summary.slowestTickMs} ms |
${summary.errors ? `| Games that crashed | **${summary.errors}** |\n` : ''}
## By civilization

| Civilization | Games | Won–lost | Median Feudal | Median Castle | Reached Castle | Peak villagers | Gathered |
| --- | --- | --- | --- | --- | --- | --- | --- |
${civRows.join('\n')}

## Games

Age-up times are minutes (Feudal/Castle/Imperial). Villagers are counted every 5 minutes. Old age shows deaths + vows.

| Seed | Map | Players | Winner | Minutes | Age-ups | Villagers | Old age |
| --- | --- | --- | --- | --- | --- | --- | --- |
${gameRows.join('\n')}
`;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'latest.md'), md);
  fs.writeFileSync(path.join(out, 'latest.json'), JSON.stringify({ summary, results }, null, 2) + '\n');
  if (!args['no-history']) {
    const file = path.join(out, 'history.csv'), cols = Object.keys(summary);
    if (!fs.existsSync(file)) fs.writeFileSync(file, cols.join(',') + '\n');
    fs.appendFileSync(file, cols.map(k => /[,"]/.test(String(summary[k])) ? `"${String(summary[k]).replace(/"/g, '""')}"` : summary[k]).join(',') + '\n');
  }
  console.log(`\nGate (Castle by 22 min): ${summary.gateCastleBy22} · decided ${decided}/${ok.length} · ${Math.round((Date.now() - started) / 1000)}s\nReport: ${path.relative(process.cwd(), path.join(out, 'latest.md'))}`);
  if (summary.errors) process.exitCode = 1;
}
