// Original age-specific monument art. One persistent building, footprint and victory timer.
'use strict';
const WONDER_NAMES = ['Ancestral Monument', 'Great Hall', 'Grand Library', 'Imperial Wonder', 'World Observatory', 'Fusion Beacon'];
function wonderName(p) {
  const age=Math.min(5,p?.age||0);
  if(p?.civ==='turks')return ['Ancestral Sanctuary','Seljuk Caravanserai','Great Madrasa','Imperial Mosque','World Observatory','Fusion Beacon'][age];
  return WONDER_NAMES[age];
}
// A civilization can begin its monument in any age; the full 4,000-resource investment still applies.
BUILDINGS.wonder.age=0;
BUILDINGS.wonder.desc+=' Its architecture changes with each Age; advancement preserves construction, health and the victory countdown.';
const wonderStyle=bldStyle;
bldStyle=function(b){return b.type==='wonder'?(b.ghost?b.style:Math.min(5,W.players[b.owner]?.age||0)):wonderStyle(b);};
const wonderArt=drawBuildingArt;
drawBuildingArt=function(g,type,age,pc,t){
  if(type!=='wonder'||age===3)return wonderArt(g,type,age,pc,t);
  const stone='#d6c8a4',gold='#d9ad51',blue='#429ba0',dark='#374653';
  box(g,0,0,2.4,2.4,0,6,'#918571',{bricks:true});
  box(g,0,0,2.1,2.1,6,5,stone,{bricks:true});
  if(age===0){
    for(const [x,y]of [[-1.4,-1.4],[1.4,-1.4],[-1.4,1.4],[1.4,1.4]]){box(g,x,y,.22,.27,11,46,'#9c998e',{bricks:true});box(g,x,y,.36,.36,57,5,'#b5ad96');}
    box(g,0,0,1.2,1.2,11,14,'#b4a58a',{bricks:true});cyl(g,0,0,.4,25,32,'#bcb098');cone(g,0,0,.45,57,12,gold);flag(g,0,0,72,pc.c,t,1);
  }else if(age===1){
    box(g,0,0,1.8,1.8,11,40,stone,{bricks:true});box(g,0,0,1.4,1.4,51,4,gold);
    box(g,0,0,.95,.95,18,36,'#624f39');
    for(const x of [-1.5,1.5])for(const y of [-1.5,1.5]){box(g,x,y,.3,.3,11,51,stone,{bricks:true});cone(g,x,y,.4,62,20,blue);}
    box(g,0,1.8,.6,.25,11,55,stone,{bricks:true});doorAt(g,0,2.05,11,'l',.38,36);flag(g,0,1.8,73,pc.c,t,1);
  }else if(age===2){
    box(g,0,0,1.75,1.75,11,44,stone,{bricks:true});box(g,0,0,1.84,1.84,55,5,blue);
    for(const x of [-1.3,-.65,0,.65,1.3]){vicColumn(g,x,1.95,11,39,'#eee1bf');vicColumn(g,1.95,x,11,39,'#eee1bf');}
    box(g,0,0,2.05,2.05,50,5,gold);doorAt(g,0,1.76,11,'l',.35,28);cyl(g,0,0,.9,60,12,stone);vicDome(g,0,0,.95,72,33,blue);flag(g,0,0,113,pc.c,t,1);
  }else if(age===4){
    box(g,0,0,1.8,1.8,11,36,'#d8d9cc',{bricks:true});box(g,0,0,1.84,1.84,47,5,dark);cyl(g,0,0,1.3,52,15,'#aeb9b7');vicDome(g,0,0,1.3,67,49,'#b6d1d4');
    box(g,0,.5,.12,1,98,7,dark);cyl(g,0,.2,.23,105,22,dark);cone(g,0,.2,.25,127,8,gold);
    for(const x of [-1.1,-.55,0,.55,1.1])windowAt(g,x,1.8,25,'l','#365668');
    for(const x of [-1.5,1.5]){box(g,x,-1.45,.5,.5,11,16,dark);box(g,x,-1.45,.65,.65,27,3,blue);}flag(g,-1.8,1.6,68,pc.c,t,1);
  }else{
    cyl(g,0,0,1.8,11,12,dark);cyl(g,0,0,1.6,23,5,blue);
    for(const [x,y]of [[-1.2,-1.2],[1.2,-1.2],[-1.2,1.2],[1.2,1.2]]){box(g,x,y,.26,.26,28,70,dark);cone(g,x,y,.32,98,32,'#a6c6cc');}
    cyl(g,0,0,.6,28,70,'#bed4dc');cyl(g,0,0,.75,88,7,pc.c);vicDome(g,0,0,.85,100,30,'#8af1ec');cyl(g,0,0,.18,130,24,gold);
    for(const z of [37,64,90]){const p=P(0,0,z);g.strokeStyle='#78e2de';g.lineWidth=3;g.beginPath();g.ellipse(p[0],p[1],48,18,0,0,Math.PI*2);g.stroke();}flag(g,0,0,163,pc.c,t,1);
  }
};
function wonderMesh(view,group,age,pc){
  const mat=c=>view.material(c),stone=mat('#d6c8a4'),roof=mat('#429ba0'),metal=mat('#455864'),team=mat(pc.c);
  const box=(x,y,z,w,h,d,m=stone)=>view.mesh(group,view.box,m,x,y,z,w,h,d);
  const cyl=(x,y,z,w,h,m=stone)=>view.mesh(group,view.cylinder,m,x,y,z,w,h,w);
  const dome=(y,r,m)=>{const geo=new view.lib.SphereGeometry(r,20,12,0,Math.PI*2,0,Math.PI/2);const mesh=view.mesh(group,geo,m,0,y,0);mesh.userData.ownedGeometry=true;};
  box(0,.16,0,4.6,.3,4.6);
  if(age===0){for(const x of [-1.5,1.5])for(const z of [-1.5,1.5])box(x,.8,z,.42,1.5,.42);cyl(0,1.1,0,.55,1.7);}
  else if(age===1){box(0,.85,0,3.5,1.3,3.5);box(0,1,1.77,.85,1.2,.04,metal);for(const x of [-1.5,1.5])for(const z of [-1.5,1.5]){box(x,1.2,z,.55,2,.55);view.roof(group,.7,.7,.6,2.2,roof);group.children[group.children.length-1].position.set(x,0,z);}}
  else if(age<=3){box(0,.9,0,3.3,1.5,3.3);cyl(0,1.85,0,1.25,.4);dome(2.05,1.25,roof);for(const x of [-1.7,1.7])for(const z of [-1.7,1.7]){cyl(x,1.65,z,.22,3);box(x,3.2,z,.32,.15,.32,team);}}
  else if(age===4){box(0,.7,0,3.6,1.1,3.6);cyl(0,1.45,0,1.5,.4);dome(1.65,1.5,mat('#abcbd0'));const telescope=box(0,2.9,.55,.32,.35,1.8,metal);telescope.rotation.x=-.4;for(const x of [-1.5,1.5])box(x,.5,-1.7,1,.1,.8,roof);}
  else{cyl(0,.5,0,1.8,.7,metal);for(const x of [-1.3,1.3])for(const z of [-1.3,1.3])box(x,1.8,z,.3,3,.3,metal);cyl(0,1.7,0,.45,2.5);dome(3,.7,mat('#8af1ec'));for(const y of [1,2,2.8]){const geo=new view.lib.TorusGeometry(1.25,.06,6,32),mesh=view.mesh(group,geo,roof,0,y,0);mesh.rotation.x=Math.PI/2;mesh.userData.ownedGeometry=true;}}
  box(1.7,1.15,1.8,.35,.65,.05,team);
}
const wonderCommands=commandsFor;
commandsFor=function(sel){const commands=wonderCommands(sel),p=UI.human();for(const c of commands)if(c.icon==='bld:wonder'){c.name=wonderName(p);c.desc+=' Current form: '+wonderName(p)+'.';}return commands;};
GameHooks.on('selInfo',(sel,box)=>{const b=sel.length===1&&sel[0];if(b?.type==='wonder'){const label=box.querySelector('.nm');if(label)label.textContent=wonderName(W.players[b.owner]);}});
const wonderIcon=iconFor;
iconFor=function(key){if(key!=='bld:wonder')return wonderIcon(key);const p=UI.human(),cacheKey=`wonder:${p?.age}:${p?.civ}:${p?.color.c}`;if(ICONS.has(cacheKey))return ICONS.get(cacheKey);ICONS.delete(key);const url=wonderIcon(key);ICONS.set(cacheKey,url);return url;};
