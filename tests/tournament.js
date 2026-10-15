// Each AI pairing is played twice to swap starting positions.
const fs = require('fs'), harness = require('./engine-harness');
const args = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const minutes = Number(args.minutes || 10), seeds = (args.seeds || '1').split(',').map(Number), maps = (args.maps || 'land').split(','), civs = (args.civs || 'franks,turks').split(','), difficulty = args.difficulty || 'standard';
if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 120 || seeds.some(s => !Number.isInteger(s)) || maps.some(m => !['land','coastal','islands'].includes(m)) || !['easy','standard','hard','hardest'].includes(difficulty)) throw new Error('Invalid tournament options.');
const { run, warnings } = harness();
for (const civ of civs) if (!run(`Object.prototype.hasOwnProperty.call(CIVS,${JSON.stringify(civ)})`)) throw new Error('Unknown civilization: '+civ);
const results = [];
for (const seed of seeds) for (const mapType of maps) for (let a=0;a<civs.length;a++) for(let b=a+1;b<civs.length;b++) for(const pair of [[civs[a],civs[b]],[civs[b],civs[a]]]) {
  const options = { seed, mapType, civs: pair, difficulty, minutes };
  const result = run(`(() => {
    const o=${JSON.stringify(options)}, spec=generateMapSpec({size:'small',seed:o.seed,mapType:o.mapType,numPlayers:2});
    createWorld(spec,{players:o.civs.map((civ,i)=>({name:civ,civ,color:PLAYER_COLORS[i],human:i===0})),seed:o.seed,fog:'none',startRes:'standard',startAge:0,difficulty:o.difficulty});
    W.spectate=true; for(const p of W.players.slice(1))p.ai=new AIPlayer(p,o.difficulty);
    const progress=W.players.slice(1).map(()=>({value:0,last:0}));
    for(let i=0;i<o.minutes*60*20&&!W.over;i++) {
      worldTick(0.05);
      if(W.tick%1200===0)for(let k=1;k<W.players.length;k++){const p=W.players[k],value=p.stats.gathered+p.stats.kills*100+p.age*1000;if(value!==progress[k-1].value){progress[k-1].value=value;progress[k-1].last=W.t;}}
    }
    const alive=W.players.slice(1).filter(p=>p.alive);
    return {...o,time:W.t,finished:W.over,winner:W.over&&alive.length===1?alive[0].civ:null,players:W.players.slice(1).map((p,i)=>({civ:p.civ,age:p.age,pop:p.pop,gathered:Math.round(p.stats.gathered),kills:p.stats.kills,losses:p.stats.lost,inactiveSeconds:Math.round(W.t-progress[i].last)}))};
  })()`);
  if (warnings.length) throw new Error(warnings.join('\n'));
  results.push(result); console.log(JSON.stringify(result));
}
if (args.out) fs.writeFileSync(args.out,JSON.stringify(results,null,2)+'\n');
