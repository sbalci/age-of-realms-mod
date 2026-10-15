const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const noop = () => {}, listeners = {};
const c = vm.createContext({ performance: { now: () => 0 }, W: { speed: 8, over: false, t: 0 }, R: { time: 0 }, UI: { keys: new Set(), gameRunning: true }, window: { addEventListener: (k,f) => listeners[k]=f }, document: { addEventListener: (k,f) => listeners[k]=f }, worldTick: dt => { c.W.t += dt; } });
vm.runInContext(fs.readFileSync('game/js/main.js', 'utf8'), c);
const run = s => vm.runInContext(s, c);
let pass=0,fail=0;
function test(name, fn) { try { fn(); pass++; console.log('PASS '+name); } catch(e){fail++;console.error('FAIL '+name+' '+e.message);} }
test('8x simulation keeps time at 15 FPS', () => { run('for(let i=0;i<150;i++)advanceSimulation(1/15)'); assert.ok(Math.abs(c.W.t-80)<1e-7); });
test('a tick budget retains remaining time instead of dropping it', () => { run('resetGameClock(); W.t=0; advanceSimulation(0.24)'); assert.ok(run('simAcc')>0.3); run('advanceSimulation(0)'); assert.ok(Math.abs(c.W.t-1.9)<1e-8); assert.ok(Math.abs(run('simAcc')-0.02)<1e-8); });
test('post-victory simulation is independent of render frame rate', () => { c.W.over=true; run('resetGameClock();W.t=0;for(let i=0;i<60;i++)advanceSimulation(1/60)'); const a=c.W.t; run('resetGameClock();W.t=0;for(let i=0;i<15;i++)advanceSimulation(1/15)'); assert.ok(Math.abs(c.W.t-a)<1e-8); assert.ok(Math.abs(a-0.5)<1e-8); });
test('blur clears held keys and pauses until focus returns', () => { c.UI.keys.add('ArrowRight'); listeners.blur(); assert.equal(c.UI.keys.size,0); assert.equal(c.UI.focusPaused,true); listeners.focus(); assert.equal(c.UI.focusPaused,false); });
test('the actual frame loop keeps 8x speed at 5 FPS', () => {
  Object.assign(c, { Editor: {active:false}, requestAnimationFrame:noop, $:()=>({classList:{contains:()=>true,toggle:noop}}), scrollCamera:noop, renderWorld:noop, drawOverlays:noop, updateTopbar:noop, renderCommands:noop, renderSelInfo:noop, screenToTile:()=>({x:0,y:0}), Sound:{updateAmbient:noop}, renderMinimap:noop });
  Object.assign(c.UI,{selection:[],mouse:{inCanvas:false},paused:false,focusPaused:false}); Object.assign(c.W,{t:0,over:false,map:{isWater:()=>false}});
  run('resetGameClock();frame(200)'); assert.ok(Math.abs(c.W.t-1.6)<1e-8);
});
console.log(`${pass} passed, ${fail} failed`); process.exitCode=fail?1:0;
