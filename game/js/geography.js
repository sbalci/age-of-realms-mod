// North-up geographic presets; shorelines never depend on the random seed.
'use strict';
const REAL_MAPS = {
  anatolia: { name: 'Anatolia', starts: [[33,39],[29,40],[38,38],[41,40],[28,37],[36,41],[43,38],[32,37]], ridges: [[[28,40],[34,41],[41,41]],[[29,37],[33,37],[37,38],[42,39]]] },
  mediterranean: { name: 'Mediterranean', starts: [[32,39],[-4,40],[8,35],[29,30],[21,44],[39,35],[13,45],[1,45]], ridges: [[[-7,31],[0,34],[9,35]],[[6,45],[12,46],[16,45]],[[19,43],[23,40]],[[28,37],[35,38],[42,39]]] },
  world: { name: 'World', starts: [[33,39],[-100,39],[105,35],[-58,-15],[23,4],[133,-24],[0,49],[78,23]], ridges: [[[-125,50],[-110,35],[-102,22]],[[-72,8],[-70,-25],[-72,-48]],[[5,45],[15,46]],[[35,39],[50,34],[72,34],[88,29],[100,28]],[[25,10],[35,-5],[30,-25]]] },
};
const geographyMasks = new Map();
function geographyMask(type) {
  if (geographyMasks.has(type)) return geographyMasks.get(type);
  const data = GEOGRAPHY_DATA[type], mask = new Uint8Array(data.n ** 2); let offset = 0, value = 0;
  for (const length of data.runs) { mask.fill(value, offset, offset + length); offset += length; value = 1 - value; }
  geographyMasks.set(type, mask); return mask;
}
function geographyPoint(type, n, lon, lat) {
  const [w,s,e,t] = GEOGRAPHY_DATA[type].bounds;
  return { x: (lon-w)/(e-w)*n, y: (t-lat)/(t-s)*n };
}
function geographyTerrain(type, n, np) {
  if (!REAL_MAPS[type]) return null;
  const def = REAL_MAPS[type], src = geographyMask(type), N = GEOGRAPHY_DATA[type].n;
  const water = new Uint8Array(n*n), elev = new Uint8Array(n*n);
  for (let y=0;y<n;y++) for(let x=0;x<n;x++) water[y*n+x] = 1-src[Math.min(N-1,Math.floor((y+.5)/n*N))*N+Math.min(N-1,Math.floor((x+.5)/n*N))];
  const shore = bfsDist(n, i=>water[i]), candidates = [], starts = [];
  for(let y=5;y<n-5;y++)for(let x=5;x<n-5;x++)if(!water[y*n+x] && shore[y*n+x]>=4) {
    let fits=true;
    for(let dy=-2;dy<=3;dy++)for(let dx=-2;dx<=3;dx++)if(water[(y+dy)*n+x+dx])fits=false;
    if(fits)candidates.push({x,y});
  }
  for(let k=0;k<np;k++) {
    const anchor=geographyPoint(type,n,...def.starts[k]), minDistance=Math.max(7,n/8);
    let best=null,score=Infinity;
    for(const spacing of [minDistance,6]) {
      for(const q of candidates) {
        if(starts.some(s=>Math.hypot(q.x-s.x,q.y-s.y)<spacing || (Math.abs(q.x-s.x)<5&&Math.abs(q.y-s.y)<6)))continue;
        const cost=Math.hypot(q.x-anchor.x,q.y-anchor.y);
        if(cost<score){score=cost;best=q;}
      }
      if(best && score < n/10)break;
    }
    if(!best)throw new Error('Not enough room for these players on this geographic map. Use a larger map.');
    starts.push({...best});
  }
  for(const line of def.ridges)for(let k=1;k<line.length;k++) {
    const a=geographyPoint(type,n,...line[k-1]),b=geographyPoint(type,n,...line[k]),dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const i=y*n+x;if(water[i]||shore[i]<2)continue;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(len||1))),distance=Math.hypot(x-a.x-dx*t,y-a.y-dy*t);
      const h=Math.max(0,Math.round(3-distance/(n/110)));elev[i]=Math.max(elev[i],h);
    }
  }
  return {water,elev,starts,name:def.name};
}
// Narrow peninsulas cannot always fit the random generator's large resource clusters.
// Guarantee a usable local economy without changing the coastline or blocking more tiles than needed.
function geographySupplies(spec,seed) {
  const n=spec.n,map=new GameMap(n);map.ter.set(spec.ter);map.elev.set(spec.elev);map.computeRegions();
  const occupied=new Map(),units=new Set(),rng=mulberry32((seed>>>0)^0x1a4d);
  for(const o of spec.objects){
    if(o.k==='unit'){units.add(o.y*n+o.x);continue;}
    const size=o.k==='bld'?BUILDINGS[o.t].size:1;
    for(let y=o.y;y<o.y+size;y++)for(let x=o.x;x<o.x+size;x++)occupied.set(y*n+x,o);
  }
  for(const [kind,min]of [['gold',4],['stone',3],['berry',6],['tree',20]])for(const p of spec.players){
    const s=p.start,region=map.landReg[s.y*n+s.x];
    const local=o=>map.landReg[o.y*n+o.x]===region&&Math.hypot(o.x-s.x,o.y-s.y)<=12;
    {
      let need=min-spec.objects.filter(o=>o.k===kind&&local(o)).length;
      while(need-->0){
        let best=null,score=Infinity;
        for(let y=Math.max(2,s.y-12);y<Math.min(n-2,s.y+13);y++)for(let x=Math.max(2,s.x-12);x<Math.min(n-2,s.x+13);x++){
          const i=y*n+x,o=occupied.get(i),d=Math.hypot(x-s.x,y-s.y);
          if(d<4||d>12||map.landReg[i]!==region||units.has(i)||(o&&!['tree','shrub'].includes(o.k))||(kind==='tree'&&o?.k==='tree'))continue;
          const exits=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>{const j=(y+dy)*n+x+dx;return !occupied.has(j)&&!isWaterT(map.ter[j])&&Math.abs(map.elev[i]-map.elev[j])<=1;}).length;
          if(exits<2)continue;
          const value=d+(o?.k==='tree'?-1:0)+rng();if(value<score){score=value;best={x,y,old:o};}
        }
        if(!best)break;
        if(best.old)spec.objects.splice(spec.objects.indexOf(best.old),1);
        const o={k:kind,x:best.x,y:best.y};spec.objects.push(o);occupied.set(best.y*n+best.x,o);
      }
    }
  }
}
