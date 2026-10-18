// Coal economy and buried deposits. Deposits do not block the surface above them.
'use strict';
for (const type of ['tc', 'miningcamp']) if (!BUILDINGS[type].drop.includes('coal')) BUILDINGS[type].drop.push('coal');
BUILDINGS.miningcamp.desc += ' Also accepts coal from excavated seams.';
for (const [id, coal] of Object.entries({ modernage: 300, industrialization: 200, rifling: 100, compositearmor: 150 })) {
  TECHS[id].cost.coal = coal;
  TECHS[id].desc += ` Requires ${coal} coal.`;
}
const mineCaches = new WeakMap();
GameHooks.on('entityAdded',e=>{if(W?.map?.tun&&(e.kind==='bld'||e.kind==='res'))mineCaches.delete(W.map);});
const geologyRemove=removeEnt;
removeEnt=function(e){if(W?.map?.tun)mineCaches.delete(W.map);return geologyRemove(e);};
function mineTunnelAccess(m) {
  const old = mineCaches.get(m), key = `${m.version}:${m.mineRevision || 0}`;
  if (old && old.key === key) return old.open;
  const n = m.n, open = new Uint8Array(n*n), queue = [];
  if (m.tun) {
    // A tunnel must connect to a walkable surface entrance; an isolated bore inside a peak is sealed.
    for (let y=1;y<n-1;y++)for(let x=1;x<n-1;x++) {
      const i=m.idx(x,y);if(!m.tun[i]||m.blk[i]||isWaterT(m.ter[i]))continue;
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const j=m.idx(x+dx,y+dy);
        if(!m.tun[j]&&!m.blk[j]&&!isWaterT(m.ter[j])&&m.elev[j]<=1&&Math.abs(m.elev[i]-m.elev[j])<=1){open[i]=1;queue.push(i);break;}
      }
    }
    for(let k=0;k<queue.length;k++) {
      const i=queue[k],x=i%n,y=(i/n)|0;
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=x+dx,ny=y+dy;if(!m.inb(nx,ny))continue;const j=m.idx(nx,ny);
        if(m.tun[j]&&!open[j]&&!m.blk[j]&&!isWaterT(m.ter[j])){open[j]=1;queue.push(j);}
      }
    }
  }
  mineCaches.set(m,{key,open});return open;
}
function mineAccessible(e) {
  if (!e || !e.depth) return true;
  const m=W.map,i=m.idx(e.x,e.y);
  if (isWaterT(m.ter[i]) || (m.blk[i] && m.blk[i] !== e.id)) return false;
  return (!m.elev[i] && (m.excavated?.[i] || 0) >= e.depth) || !!mineTunnelAccess(m)[i];
}
function mineDigRemaining(x,y) {
  const depth=W.list.reduce((v,e)=>e.kind==='res'&&e.x===x&&e.y===y&&e.amount>0?Math.max(v,e.depth||0):v,0);
  return Math.max(0,depth-(W.map.excavated?.[W.map.idx(x,y)]||0));
}
const geologyApply=terraApply;
terraApply=function(op,x,y,p,sim){const result=geologyApply(op,x,y,p,sim);if(!result)W.map.mineRevision=(W.map.mineRevision||0)+1;return result;};
const geologyOrder=setOrder;
setOrder=function(u,o){
  const e=o?.t==='gather'&&ent(o.id);
  if(e?.depth&&!mineAccessible(e)) {
    if(u.type!=='villager'||!TERRA.enabled){if(u.owner===W.humanId)msg('This deposit needs excavation or a connected tunnel. Enable Terraforming to excavate it.','#fc8');return geologyOrder(u,null);}
    const job=terraJob('dig',[{x:e.x,y:e.y}]);job.mineId=e.id;
    return geologyOrder(u,{t:'terra',job});
  }
  return geologyOrder(u,o);
};

// Deterministic, equal starting coal reserves on every generated map, plus mountain mineral seams.
const geologyGenerate=generateMapSpec;
generateMapSpec=function(opts){
  const spec=geologyGenerate(opts),n=spec.n,rng=mulberry32((opts.seed>>>0)^0xc0a1);
  const used=new Set();for(const o of spec.objects){const s=o.k==='bld'?BUILDINGS[o.t].size:1;for(let y=o.y;y<o.y+s;y++)for(let x=o.x;x<o.x+s;x++)used.add(y*n+x);}
  const free=(x,y)=>x>1&&y>1&&x<n-2&&y<n-2&&!isWaterT(spec.ter[y*n+x])&&!used.has(y*n+x);
  for(const player of spec.players){
    const s=player.start;if(!s)continue;
    for(let k=0;k<3;k++){
      let best=null,score=Infinity;
      for(let y=Math.max(2,s.y-17);y<Math.min(n-2,s.y+18);y++)for(let x=Math.max(2,s.x-17);x<Math.min(n-2,s.x+18);x++){
        const d=Math.hypot(x-s.x,y-s.y);if(d<7||d>17||!free(x,y))continue;
        if(![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>free(x+dx,y+dy)&&Math.abs(spec.elev[(y+dy)*n+x+dx]-spec.elev[y*n+x])<2))continue;
        const v=d+(k===1?-spec.elev[y*n+x]*2:spec.elev[y*n+x]*3)+rng()*2;
        if(v<score){score=v;best={x,y};}
      }
      if(best){spec.objects.push({k:'coal',...best,depth:1});used.add(best.y*n+best.x);}
    }
  }
  let added=0;
  for(let i=0;i<n*n&&added<spec.players.length*3;i++){
    const x=(rng()*(n-4)+2)|0,y=(rng()*(n-4)+2)|0;
    if(!free(x,y)||spec.elev[y*n+x]<2)continue;
    spec.objects.push({k:added%2?'gold':'stone',x,y,depth:2});used.add(y*n+x);added++;
  }
  return spec;
};
function geologyWorld(w){
  if(w.market.coal===undefined)w.market.coal=180;
  for(const p of w.players)if(p){if(p.res.coal===undefined)p.res.coal=0;if(p.gather.coal===undefined)p.gather.coal=1;if(p.vs?.gathered&&p.vs.gathered.coal===undefined)p.vs.gathered.coal=0;}
}
GameHooks.on('worldCreated',geologyWorld);GameHooks.on('worldRestored',geologyWorld);
const geologyPlace=canPlace;
// Buried seams are gold, stone or coal deposits with a depth; the entity index finds the ones under a footprint.
function geologySeamUnder(x,y,size){return ['res:gold','res:stone','res:coal'].some(c=>idxRect(c,x,y,x+size-1,y+size-1).some(e=>e.depth&&e.amount>0));}
canPlace=function(p,type,x,y,ignoreExplored){const error=geologyPlace(p,type,x,y,ignoreExplored);if(error)return error;const size=BUILDINGS[type].size;return geologySeamUnder(x,y,size)?'A mineral seam is in the way':null;};

// AIs budget coal in Imperial and beyond, and use the same excavation orders as human players for coal, gold, and stone seams.
function geologyBuriedNear(v,res,home){return idxNear('res:'+res,home.x,home.y,35).filter(e=>e.amount>0&&!mineAccessible(e)&&Math.hypot(e.x-home.x,e.y-home.y)<35&&adjReachable(v,e));}
function geologyCoalNear(p){return idxNear('res:coal',p.startX,p.startY,40).some(e=>Math.hypot(e.x-p.startX,e.y-p.startY)<40);}
const geologyAssign=AIPlayer.prototype.assign;
AIPlayer.prototype.assign=function(v,res){
  if(geologyAssign.call(this,v,res))return true;
  if(!['coal','gold','stone'].includes(res)||!TERRA.enabled)return false;
  const home=this.home(),targets=geologyBuriedNear(v,res,home);
  targets.sort((a,b)=>Math.hypot(a.x-v.x,a.y-v.y)-Math.hypot(b.x-v.x,b.y-v.y));
  if(!targets.length)return false;setOrder(v,{t:'gather',id:targets[0].id});return true;
};
const geologyTask=AIPlayer.prototype.vTask;
AIPlayer.prototype.vTask=function(v){if(v.order?.t==='terra'&&v.order.job?.mineId)return ent(v.order.job.mineId)?.type||'coal';if(v.order?.t==='gather'&&(v.order.rtype==='coal'||ent(v.order.id)?.type==='coal'))return 'coal';return geologyTask.call(this,v);};
const geologyEconomy=AIPlayer.prototype.economy;
AIPlayer.prototype.economy=function(dt){geologyEconomy.call(this,dt);const p=this.p;if(p.age>=3&&p.res.coal<300&&p.res.gold>650&&hasBuilt(p,'market')&&(!TERRA.enabled||!geologyCoalNear(p)))marketTrade(p,'coal',true);};

// The seam marker stays visible for surveying; it is never a gatherable surface pile until opened.
const geologyDrawRes=drawRes;
drawRes=function(g,e){
  if(!e.depth&&e.type!=='coal')return geologyDrawRes(g,e);
  const c=center(e),p=iso(c.x,c.y,W.map.h(c.x,c.y)),open=mineAccessible(e),color={coal:'#31363b',gold:'#d9b74d',stone:'#9ba6b1'}[e.type];
  g.save();g.translate(p.x,p.y);
  g.fillStyle='rgba(0,0,0,.24)';g.beginPath();g.ellipse(0,2,23,10,0,0,Math.PI*2);g.fill();
  if(!open){
    g.setLineDash([3,3]);g.strokeStyle='#d9ba77';g.lineWidth=1.4;g.beginPath();g.ellipse(0,0,21,10,0,0,Math.PI*2);g.stroke();g.setLineDash([]);
    g.fillStyle='#78634c';g.fillRect(-2,-22,3,23);g.fillStyle=color;g.fillRect(1,-23,18,13);g.strokeStyle='#e3d0a2';g.strokeRect(1,-23,18,13);
    g.fillStyle='#fff0c0';g.font='bold 10px sans-serif';g.textAlign='center';g.fillText(e.type[0].toUpperCase(),10,-13);
    g.strokeStyle='#e3c878';g.lineWidth=2;g.beginPath();g.moveTo(-14,-5);g.lineTo(-5,2);g.moveTo(-16,0);g.lineTo(-7,-7);g.stroke();
  }else{
    g.fillStyle='#161b1e';g.beginPath();g.ellipse(-5,0,15,8,0,0,Math.PI*2);g.fill();
    g.strokeStyle='#a07c4d';g.lineWidth=4;g.beginPath();g.moveTo(-19,5);g.lineTo(-19,-13);g.lineTo(7,-13);g.lineTo(7,5);g.stroke();
    g.strokeStyle='#e4bf7c';g.lineWidth=1;g.beginPath();g.moveTo(-18,-11);g.lineTo(5,-11);g.stroke();
    g.strokeStyle='#807b6c';g.lineWidth=2;for(let k=0;k<3;k++){g.beginPath();g.moveTo(-16+k*5,3+k*2);g.lineTo(1+k*5,3+k*2);g.stroke();}
    for(let k=0;k<6;k++){const x=10+(k%3)*6,y=-2+Math.floor(k/3)*4;poly(g,[[x,y-6],[x+5,y-3],[x+3,y+2],[x-3,y+1]],color,'#111820');}
  }
  g.restore();
};
const geologyIcon=iconFor;
iconFor=function(key){if(key!=='coal')return geologyIcon(key);return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="4" fill="#352c22"/><path d="M7 43 17 20 32 15 41 28 55 32 57 47 34 54 13 52Z" fill="#353e49" stroke="#a3a7a4" stroke-width="2"/><path d="m17 20 7 18 17-10M24 38l10 16M41 28l-2 17 16-13" fill="none" stroke="#73818c" stroke-width="2"/></svg>');};
RES_ICON.coal='<img class="uhd-ri" src="'+iconFor('coal')+'" alt="Coal">';
GameHooks.on('selInfo',(sel,box)=>{const e=sel.length===1&&sel[0];if(e?.depth){const line=typeof document!=='undefined'&&document.createElement('div');if(line){line.className='small';line.textContent=mineAccessible(e)?'Underground mine open — right-click with villagers to gather.':'Buried seam — right-click with villagers to excavate and mine, or dig a connected sapper tunnel beneath it.';box.querySelector('.info')?.appendChild(line);}}});
