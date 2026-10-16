const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {run}=require('./engine-harness')();let pass=0,fail=0;
const test=(n,f)=>{try{f();pass++;console.log('PASS '+n);}catch(e){fail++;console.error('FAIL '+n+'\n'+e.stack);}};
test('Turkish medieval artwork follows Seljuk and Ottoman ages; workers enter later eras',()=>{
  assert.equal(run(`(()=>{make();UnitArt.mode='auto';const p=W.players[1];p.civ='turks';const v={type:'villager',owner:1,id:2},s={type:'militia',owner:1,id:3};p.age=0;const early=UnitArt.key(v)==='seljuk-villager';p.age=2;const late=UnitArt.key(s)==='ottoman-sword';p.age=4;const modern=UnitArt.key(v)==='modern-villager';p.age=5;return early&&late&&modern&&UnitArt.key(v)==='future-villager'&&UnitArt.key(s)==='ottoman-sword';})()`),true);
});
test('new units select their actual era assets and animals keep species',()=>{
  assert.equal(run(`(()=>{UnitArt.mode='auto';return UnitArt.key({type:'rifleman',owner:1,id:1})==='modern-gunner'&&UnitArt.key({type:'fusionwalker',owner:1,id:1})==='future-walker'&&UnitArt.key({type:'sheep',breed:'cow',owner:0,id:1})==='animals-cow'&&UnitArt.key({type:'wolf',owner:0,id:1})==='animals-wolf';})()`),true);
});
test('style switches invalidate cached poses and Classic preserves the drawn fallback',()=>{
  assert.equal(run(`(()=>{const r=UnitArt.revision;UnitArt.set('seljuk');const themed=UnitArt.key({type:'militia',owner:1,id:1})==='seljuk-sword';UnitArt.set('classic');const off=UnitArt.key({type:'militia',owner:1,id:1})===null;UnitArt.set('auto');return themed&&off&&UnitArt.revision===r+3;})()`),true);
});
test('all 53 atlases and team masks match their frame metadata',()=>{
  const dir=path.join(__dirname,'../game/art/actors'),m=vm.runInNewContext(fs.readFileSync(path.join(dir,'manifest.js'),'utf8')+';ACTOR_ART');
  assert.equal(Object.keys(m).length,53);
  for(const [key,d]of Object.entries(m))for(const suffix of ['','-team']){
    const png=fs.readFileSync(path.join(dir,key+suffix+'.png'));
    assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),d.cell*d.frames);assert.equal(png.readUInt32BE(20),d.cell*d.directions*d.actions.length);
  }
});
test('animal model derivatives are valid GLB files, and source licenses are retained',()=>{
  const dir=path.join(__dirname,'../assets/thirdparty/quaternius/animals');
  for(const name of ['Cow','Horse','Wolf','Deer'])assert.equal(fs.readFileSync(path.join(dir,name+'.glb')).subarray(0,4).toString(),'glTF');
  assert.match(fs.readFileSync(path.join(dir,'License.txt'),'utf8'),/CC0/);
  assert.match(fs.readFileSync(path.join(__dirname,'../assets/thirdparty/kenney/mini-characters/License.txt'),'utf8'),/CC0/);
});
console.log(`${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
