const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function harness() {
  const noop = () => {}, sound = new Proxy({}, { get: (t, k) => k in t ? t[k] : noop });
  const warnings = [];
  const c = vm.createContext({ console: { ...console, warn: (...args) => warnings.push(args.map(String).join(' ')) }, performance, Sound: sound, URLSearchParams });
  const run = s => vm.runInContext(s, c);
  const html = fs.readFileSync(path.join(__dirname, '../game/index.html'), 'utf8');
  for (const [, file] of html.matchAll(/<script src="js\/(.*?)"><\/script>/g)) {
    if (['audio.js', 'main.js'].includes(file)) continue;
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../game/js', file), 'utf8'), c, { filename: file });
  }
  run(`UI.showEnd = () => {}; UI.gameRunning = true;
    function make(seed = 5) {
      const spec = generateMapSpec({size:'tiny',seed,mapType:'land',numPlayers:2});
      createWorld(spec,{players:[{name:'A',civ:'franks',color:PLAYER_COLORS[0],human:true},{name:'B',civ:'turks',color:PLAYER_COLORS[1]}],seed,fog:'normal',startRes:'high',startAge:1,difficulty:'standard'});
    }
    function signature() { return JSON.stringify({t:W.t,rng:W.rng.state(),players:W.players.slice(1).map(p=>({res:p.res,age:p.age,stats:p.stats})),entities:W.list.map(e=>({id:e.id,type:e.type,x:e.x,y:e.y,hp:e.hp,amount:e.amount,lifeK:e.lifeK,vows:e.vows,order:e.order,path:e.path}))}); }
    make();`);
  return { c, run, warnings };
};
