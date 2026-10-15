// Optional Three.js view. All meshes and textures are derived from W; simulation state stays in the engine.
'use strict';
const T25D_PIXELS = TW / Math.SQRT2;
const T25D_HEIGHT = EH / (T25D_PIXELS * Math.sqrt(3) / 2);
function t25dWorld(x, y, h = 0) { return { x, y: h * T25D_HEIGHT, z: y }; }
function t25dCameraTarget(cam) { return { x: cam.x / TW + cam.y / TH, y: 0, z: cam.y / TH - cam.x / TW }; }
function t25dInitialMode() {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(location.search);
  if (q.has('renderer')) return ['three', '3d', '25d'].includes(q.get('renderer'));
  try { return localStorage.getItem('aor_renderer') === 'three'; } catch (e) { return false; }
}
const T25D = {
  enabled: false, requested: t25dInitialMode(), lib: null, renderer: null, scene: null, camera: null,
  pending: null, error: null, lost: false, world: null, mapVersion: -1, terrain: null, terrainTexture: null,
  structures: new Map(), actors: new Map(), assets: new Map(), materials: new Map(), frame: 0,
  stats: { frames: 0, terrainBuilds: 0, structures: 0, sprites: 0, textures: 0, calls: 0, triangles: 0 },
  status(text) {
    this.error = text || null;
    if (typeof document === 'undefined') return;
    const el = document.getElementById('graphics-status'); if (el) el.textContent = text || (this.enabled ? '2.5D prototype · 3D terrain and buildings, original unit art' : 'Canvas 2D graphics');
    for (const id of ['btn-graphics', 'b-graphics']) {
      const b = document.getElementById(id); if (!b) continue;
      b.textContent = id === 'b-graphics' ? (this.enabled ? '2.5D → 2D' : '2D → 2.5D') : (this.enabled ? 'Use Canvas 2D' : 'Try 2.5D Graphics');
      b.setAttribute('aria-pressed', String(this.enabled));
    }
  },
  async prepare() {
    if (this.lost) throw new Error('WebGL context is recovering. Try again shortly.');
    if (this.renderer) return;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      const THREE = await import('../vendor/three/three.module.js'); this.lib = THREE;
      const canvas = document.createElement('canvas'); canvas.id = 'three25d'; canvas.setAttribute('aria-hidden', 'true');
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b0d10');
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
      scene.add(new THREE.HemisphereLight('#e9f5ff', '#655132', 2));
      const sun = new THREE.DirectionalLight('#fff0d4', 2.3); sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = sun.shadow.camera.bottom = -24;
      sun.shadow.camera.right = sun.shadow.camera.top = 24; sun.shadow.camera.near = 0.1; sun.shadow.camera.far = 140;
      sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
      scene.add(sun, sun.target);
      const statics = new THREE.Group(), props = new THREE.Group(), entities = new THREE.Group(); scene.add(statics, props, entities);
      this.renderer = renderer; this.scene = scene; this.camera = camera; this.sun = sun;
      this.statics = statics; this.props = props; this.entities = entities; this.raycaster = new THREE.Raycaster();
      this.box = new THREE.BoxGeometry(1, 1, 1); this.cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
      this.ring = new THREE.CircleGeometry(1, 24);
      R.cv.before(canvas);
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; this.enabled = this.requested = false; canvas.style.display = 'none'; this.status('WebGL context lost; Canvas 2D is active.'); });
      canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.world = null; this.status('WebGL recovered. You can try 2.5D again.'); });
      this.resize();
    })();
    try { await this.pending; } finally { this.pending = null; }
  },
  async setEnabled(value) {
    this.requested = !!value;
    const buttons = ['btn-graphics', 'b-graphics'].map(id => document.getElementById(id)).filter(Boolean);
    buttons.forEach(b => { b.disabled = true; });
    try {
      if (value) await this.prepare();
      this.enabled = !!value; if (this.renderer) this.renderer.domElement.style.display = value ? 'block' : 'none';
      try { localStorage.setItem('aor_renderer', value ? 'three' : 'canvas'); } catch (e) { }
      this.resize(); this.status();
    } catch (e) {
      this.enabled = this.requested = false;
      if (this.renderer) this.renderer.domElement.style.display = 'none';
      this.status('2.5D is unavailable on this browser. Canvas 2D remains active. ' + e.message);
    } finally { buttons.forEach(b => { b.disabled = false; }); }
    return this.enabled;
  },
  resize() {
    if (!this.renderer || !R.cv) return;
    const rect = R.cv.getBoundingClientRect(), canvas = this.renderer.domElement;
    canvas.style.left = rect.left + 'px'; canvas.style.top = rect.top + 'px';
    const w = Math.max(1, R.cw), h = Math.max(1, R.ch);
    if (this.width !== w || this.height !== h) { this.renderer.setSize(w, h); this.width = w; this.height = h; }
    this.camera.left = -w / (2 * T25D_PIXELS); this.camera.right = w / (2 * T25D_PIXELS);
    this.camera.top = h / (2 * T25D_PIXELS); this.camera.bottom = -h / (2 * T25D_PIXELS);
    this.camera.zoom = R.cam.zoom; this.camera.updateProjectionMatrix();
  },
  syncCamera() {
    this.resize();
    const t = t25dCameraTarget(R.cam), d = Math.sqrt(3 / 8);
    this.camera.position.set(t.x + d * 200, 100, t.z + d * 200); this.camera.lookAt(t.x, 0, t.z);
    this.camera.updateMatrixWorld(true);
    this.sun.position.set(t.x - 18, 38, t.z + 12); this.sun.target.position.set(t.x, 0, t.z);
  },
  material(color, kind = 'plain') {
    const key = color + ':' + kind; if (this.materials.has(key)) return this.materials.get(key);
    const THREE = this.lib;
    let map = null;
    if (kind !== 'plain') {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
      g.fillStyle = color; g.fillRect(0, 0, 128, 128);
      const rng = mulberry32(hashStr(key));
      for (let i = 0; i < 600; i++) { g.fillStyle = rng() > 0.5 ? 'rgba(255,255,220,.08)' : 'rgba(0,0,0,.07)'; g.fillRect(rng() * 128, rng() * 128, 2, 2); }
      g.strokeStyle = 'rgba(35,25,15,.28)'; g.lineWidth = 2;
      for (let y = 0; y < 128; y += kind === 'stone' ? 22 : 12) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
        if (kind === 'stone') for (let x = ((y / 22) | 0) % 2 ? 16 : 0; x < 128; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 22); g.stroke(); }
      }
      map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping;
    }
    const m = new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : color, map, roughness: 0.95 });
    this.materials.set(key, m); return m;
  },
  mesh(group, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) {
    const mesh = new this.lib.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  },
  roof(group, width, depth, height, base, material) {
    const THREE = this.lib, shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, height); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }); geo.translate(0, base, -depth / 2);
    const roof = this.mesh(group, geo, material, 0, 0, 0); roof.userData.ownedGeometry = true;
  },
  building(b) {
    const THREE = this.lib, s = BUILDINGS[b.type].size, age = b.ghost ? b.style : bldStyle(b), pc = pcolor(b.owner);
    const group = new THREE.Group(); group.userData.entity = b;
    const walls = this.material(age < 2 ? '#a18460' : '#c4b9a3', age < 2 ? 'wood' : 'stone');
    const timber = this.material('#66472c', 'wood'), stone = this.material('#928b79', 'stone');
    const roof = this.material(age === 0 ? '#a88b4a' : age === 1 ? '#a75f40' : '#596979', age === 0 ? 'thatch' : 'tile');
    const team = this.material(pc.c), dark = this.material('#342b24');
    const height = (BLD_H[b.type] || 70) / (T25D_PIXELS * Math.sqrt(3) / 2);
    this.mesh(group, this.box, stone, 0, 0.065, 0, s * 0.98, 0.13, s * 0.98);
    if (b.type === 'farm') {
      for (let k = -3; k <= 3; k++) this.mesh(group, this.box, this.material('#758148'), k * s / 8, 0.15, 0, 0.12, 0.12, s * 0.85);
    } else if (['wall', 'palisade', 'gate'].includes(b.type)) {
      const linked = (x, y) => { const id = W.map.blk[W.map.idx(x, y)], e = ent(id); return e && ['wall','palisade','gate','tower'].includes(e.type); };
      const mask = fxWallMask(linked, b.x, b.y), alongX = mask & 3 || !(mask & 12);
      const wall = this.mesh(group, this.box, b.type === 'palisade' ? timber : stone, 0, height * 0.45, 0, alongX ? s : 0.28, height * 0.9, alongX ? 0.28 : s);
      if (b.type === 'gate') { wall.scale.y *= 0.3; wall.position.y = height * 0.8; }
      for (let i = -1; i <= 1; i++) this.mesh(group, this.box, stone, alongX ? i * s / 3 : 0, height, alongX ? 0 : i * s / 3, 0.2, 0.2, 0.2);
    } else if (['tower', 'outpost', 'castle', 'wonder'].includes(b.type)) {
      if (b.type === 'castle') {
        this.mesh(group, this.box, walls, 0, height * 0.34, 0, s * 0.82, height * 0.64, s * 0.82);
        for (const x of [-1, 1]) for (const z of [-1, 1]) {
          this.mesh(group, this.cylinder, stone, x * s * 0.35, height * 0.5, z * s * 0.35, s * 0.19, height, s * 0.19);
          for (let k = 0; k < 6; k++) this.mesh(group, this.box, stone, x * s * 0.35 + Math.cos(k * Math.PI / 3) * s * 0.16, height, z * s * 0.35 + Math.sin(k * Math.PI / 3) * s * 0.16, 0.2, 0.25, 0.2);
        }
      } else {
        this.mesh(group, this.cylinder, walls, 0, height * 0.45, 0, s * 0.34, height * 0.85, s * 0.34);
        this.roof(group, s * 0.85, s * 0.85, height * 0.2, height * 0.86, roof);
      }
    } else if (b.type === 'well') {
      this.mesh(group, this.cylinder, stone, 0, 0.22, 0, s * 0.32, 0.35, s * 0.32);
      for (const x of [-0.3, 0.3]) this.mesh(group, this.box, timber, x, 0.6, 0, 0.08, 0.8, 0.08);
      this.roof(group, 0.9, 0.8, 0.25, 1, roof);
    } else if (b.type === 'dock') {
      this.mesh(group, this.box, timber, 0, 0.12, 0, s * 0.95, 0.16, s * 0.85);
      this.mesh(group, this.box, walls, 0, 0.5, -s * 0.22, s * 0.55, 0.8, s * 0.4);
      this.roof(group, s * 0.66, s * 0.5, 0.45, 0.9, roof);
    } else {
      const w = s * 0.78, d = s * 0.76, bodyH = height * 0.62;
      this.mesh(group, this.box, walls, 0, bodyH / 2 + 0.13, 0, w, bodyH, d);
      this.roof(group, w * 1.16, d * 1.18, height * 0.36, bodyH + 0.13, roof);
      this.mesh(group, this.box, dark, 0, bodyH * 0.26, d / 2 + 0.01, Math.min(0.45, w * 0.24), bodyH * 0.5, 0.025);
      this.mesh(group, this.box, team, -w * 0.28, bodyH * 0.65, d / 2 + 0.025, Math.min(0.28, w * 0.2), bodyH * 0.23, 0.028);
      if (age < 2) for (const x of [-w / 2, w / 2]) this.mesh(group, this.box, timber, x, bodyH / 2 + 0.13, d / 2 + 0.01, 0.06, bodyH, 0.04);
      if (b.type === 'tc' || b.type === 'monastery') {
        this.mesh(group, this.box, stone, -w * 0.32, height * 0.54, -d * 0.24, w * 0.3, height, d * 0.3);
        this.roof(group, w * 0.4, d * 0.4, height * 0.25, height * 1.03, roof);
      }
      if (b.type === 'mill') {
        const sails = new THREE.Group(); sails.position.set(0, bodyH, d / 2 + 0.06);
        this.mesh(sails, this.box, this.material('#dfd3ac'), 0, 0, 0, 0.08, height * 0.95, 0.04);
        this.mesh(sails, this.box, this.material('#dfd3ac'), 0, 0, 0, height * 0.95, 0.08, 0.04);
        group.add(sails); group.userData.sails = sails;
      }
    }
    if (!BUILDINGS[b.type].farm && !['wall', 'palisade', 'gate'].includes(b.type)) {
      this.mesh(group, this.box, timber, s * 0.3, height * 0.68, -s * 0.25, 0.035, height * 1.35, 0.035);
      this.mesh(group, this.box, team, s * 0.3 + 0.18, height * 1.16, -s * 0.25, 0.35, 0.24, 0.025);
    }
    group.userData.top = Math.max(height * 1.35, 0.4);
    return group;
  },
  disposeGroup(group) { group.traverse(o => { if (o.userData.ownedGeometry && o.geometry) o.geometry.dispose(); if(o.userData.ownedMaterial)o.material.dispose(); }); group.removeFromParent(); },
  resetWorld() {
    for (const o of this.structures.values()) this.disposeGroup(o.group);
    for (const o of this.actors.values()) o.sprite.removeFromParent();
    this.structures.clear(); this.actors.clear();
    for (const a of this.assets.values()) { a.texture.dispose(); a.material.dispose(); a.dimMaterial.dispose(); } this.assets.clear();
    for (const o of [...this.statics.children, ...this.props.children]) this.disposeGroup(o);
    if (this.terrainTexture) this.terrainTexture.dispose(); this.terrainTexture = null;
    this.world = W; this.mapVersion = -1; this.terrain = null; this.fogKey = '';
  },
  buildTerrain() {
    const THREE = this.lib, m = W.map, n = m.n, N = n + 1, positions = [], normals = [], uv = [];
    if (this.terrain) this.disposeGroup(this.terrain);
    for (const o of [...this.props.children]) this.disposeGroup(o);
    const vNorm = new Float32Array(N * N * 3);
    for (let vy = 0; vy <= n; vy++) for (let vx = 0; vx <= n; vx++) {
      const x0 = Math.max(0, vx - 1), x1 = Math.min(n, vx + 1), y0 = Math.max(0, vy - 1), y1 = Math.min(n, vy + 1);
      const nx = -(m.vh[vy * N + x1] - m.vh[vy * N + x0]) / Math.max(1, x1 - x0) * T25D_HEIGHT;
      const nz = -(m.vh[y1 * N + vx] - m.vh[y0 * N + vx]) / Math.max(1, y1 - y0) * T25D_HEIGHT;
      const inv = 1 / Math.hypot(nx, 1, nz), o = (vy * N + vx) * 3;
      vNorm[o] = nx * inv; vNorm[o + 1] = inv; vNorm[o + 2] = nz * inv;
    }
    const vertices = [[0,0],[0,1],[1,0],[1,0],[0,1],[1,1]];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const water = isWaterT(m.ter[m.idx(x,y)]);
      for (const [dx,dy] of vertices) {
        const vi = (y + dy) * N + x + dx, h = water ? -0.35 : m.vh[vi];
        positions.push(x+dx,h*T25D_HEIGHT,y+dy); uv.push((x+dx)/n,1-(y+dy)/n);
        if (water) normals.push(0, 1, 0);
        else normals.push(vNorm[vi * 3], vNorm[vi * 3 + 1], vNorm[vi * 3 + 2]);
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n*n*18).fill(1),3));
    if (typeof hdtSync === 'function') hdtSync(m, false);
    if (this.terrainTexture) this.terrainTexture.dispose();
    if (typeof HDT !== 'undefined' && HDT.cv) { this.terrainTexture = new THREE.CanvasTexture(HDT.cv); this.terrainTexture.colorSpace = THREE.SRGBColorSpace; this.terrainTexture.anisotropy = Math.min(4,this.renderer.capabilities.getMaxAnisotropy()); }
    const mat = new THREE.MeshStandardMaterial({ map: this.terrainTexture, color: this.terrainTexture ? '#ffffff' : '#75974a', vertexColors: true, roughness: 1, side: THREE.DoubleSide });
    const terrain = new THREE.Mesh(geo,mat); terrain.receiveShadow = true; terrain.userData.ownedGeometry = true; terrain.userData.ownedMaterial = true; terrain.userData.tileSurface = true;
    this.statics.add(terrain); this.terrain = terrain;
    // Slender decks keep waterways open beneath bridges; tunnels and trenches remain simulation layers.
    for (let i=0;i<n*n;i++) {
      if (m.bridge && m.bridge[i]) { const x=i%n,z=(i/n)|0; const b=this.mesh(this.props,this.box,this.material('#9d784b','wood'),x+0.5,-0.35*T25D_HEIGHT+0.055,z+0.5,1,0.08,1); b.castShadow=true;b.userData.tileSurface=true; }
      if (m.trench && m.trench[i]) { const x=i%n,z=(i/n)|0; this.mesh(this.props,this.box,this.material('#443929'),x+0.5,m.h(x+0.5,z+0.5)*T25D_HEIGHT+0.009,z+0.5,0.65,0.02,0.9); }
      if (m.tun && m.tun[i]) { const x=i%n,z=(i/n)|0; this.mesh(this.props,this.box,this.material('#493e32'),x+0.5,m.h(x+0.5,z+0.5)*T25D_HEIGHT+0.01,z+0.5,0.45,0.025,0.45); }
    }
    this.mapVersion = m.version; this.fogKey = ''; this.stats.terrainBuilds++;
  },
  fogAt(x, y, editor = false) {
    if (editor || W.settings.fog === 'none' || W.noFog) return 1;
    const m=W.map, i=m.idx(Math.max(0,Math.min(m.n-1,x|0)),Math.max(0,Math.min(m.n-1,y|0))), p=W.players[W.humanId];
    return p.visible[i] ? 1 : p.explored[i] ? 0.3 : 0;
  },
  updateFog(editor) {
    const visEpoch = (editor || W.settings.fog === 'none' || W.noFog) ? 'full' : ((W.tick / 6) | 0) + ':' + (W.revealAll ? 1 : 0);
    const key = `${this.mapVersion}:${!!editor}:${W.settings.fog}:${!!W.noFog}:${visEpoch}`;
    if (this.fogKey === key) return;
    this.fogKey = key;
    const a=this.terrain.geometry.attributes.color, n=W.n;
    for(let i=0;i<n*n;i++) { const f=this.fogAt(i%n,(i/n)|0,editor); for(let k=0;k<18;k++)a.array[i*18+k]=f; }
    a.needsUpdate=true;
    for(const o of this.props.children) o.visible=this.fogAt(o.position.x,o.position.z,editor)>0;
  },
  visibleEntities(opts) {
    const fog = !opts.editor && W.settings.fog !== 'none' && !W.noFog, p=W.players[W.humanId], out=[];
    for(const e of W.list) {
      if (e.kind==='unit' && e.inside || e.kind==='relic' && (e.carrier || e.inBld)) continue;
      const c=center(e), f=this.fogAt(c.x,c.y,!!opts.editor);
      if(!f) continue;
      if(fog && e.kind==='unit' && e.owner!==W.humanId && !isVisibleToHuman(e))continue;
      if(fog && e.kind==='bld' && e.owner!==W.humanId && !vicBldVisible(p,e)) {
        if (VIC.fogmem || !e.seenBy) continue;
      }
      out.push(e);
    }
    if(fog && VIC.fogmem && p.memory) for(const b of p.memory.values()) {
      const live=ent(b.id); if(live && vicBldVisible(p,live))continue;
      const maxhp=BUILDINGS[b.type].hp;
      out.push({...b,kind:'bld',ghost:true,hp:maxhp*b.hpFrac,maxhp,queue:[],garrison:[],relics:[]});
    }
    return out;
  },
  asset(e) {
    const unit=e.kind==='unit', d=unit?UNITS[e.type]:null, variant=e.id%12;
    const key=unit ? uhdKey(e,d,e.animT,W.t,1,pcolor(e.owner).c).key+':rank'+(e.rank||0)+':die'+Math.min(12,Math.floor((e.dieT||0)*8)) : `${e.kind}:${e.type}:${e.v||0}:${variant}:${!!e.felled}:${Math.ceil((e.amount/e.max||0)*4)}:${!!e.sap}`;
    let a=this.assets.get(key); if(a) { a.frame=this.frame;return a; }
    const THREE=this.lib, width=192,height=160, ax=96,ay=128, cv=document.createElement('canvas');cv.width=width*2;cv.height=height*2;
    const g=cv.getContext('2d'), c=unit?e:center(e), h=unit&&d.naval || e.type==='fish' ? -0.35 : W.map.h(c.x,c.y), origin=iso(c.x,c.y,h);
    g.setTransform(2,0,0,2,ax*2-origin.x*2,ay*2-origin.y*2);
    const mute=FX.mute; FX.mute='all';
    try {
      if(unit)drawUnit(g,e,null);
      else if(e.kind==='res')drawRes(g,{...e,id:variant+1});
      else drawRelic(g,e,origin.x,origin.y);
    } finally { FX.mute=mute; }
    const texture=new THREE.CanvasTexture(cv);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
    const material=new THREE.SpriteMaterial({map:texture,transparent:true,alphaTest:0.08,depthWrite:true,toneMapped:false});
    const dimMaterial=new THREE.SpriteMaterial({map:texture,color:'#808080',transparent:true,alphaTest:0.08,depthWrite:true,toneMapped:false});
    a={texture,material,dimMaterial,width,height,ax,ay,frame:this.frame};this.assets.set(key,a);return a;
  },
  syncEntities(list,opts) {
    const THREE=this.lib, keepBuildings=new Set(),keepActors=new Set(),selection=opts.selection||new Set();
    this.pickables=[];
    for(const e of list) {
      const c=center(e), screen=toScreen(c.x,c.y,0);
      if(screen.x < -220 || screen.x>R.cw+220 || screen.y < -150 || screen.y>R.ch+260)continue;
      if(e.kind==='bld') {
        keepBuildings.add(e.id);
        const age=e.ghost?e.style:bldStyle(e), mask=['wall','palisade','gate'].includes(e.type)?Array.from(W.map.blk.slice(Math.max(0,W.map.idx(e.x,e.y)-W.n),W.map.idx(e.x,e.y)+W.n+2)).join(','):'';
        const dim=e.ghost||this.fogAt(c.x,c.y,!!opts.editor)<1;
        const key=`${e.type}:${age}:${pcolor(e.owner).c}:${e.ghost}:${dim}:${mask}`;
        let cached=this.structures.get(e.id);
        if(!cached || cached.key!==key) {
          if(cached)this.disposeGroup(cached.group);
          cached={key,group:this.building(e)};
          if(dim)cached.group.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.color.multiplyScalar(0.4);o.userData.ownedMaterial=true;}});
          this.structures.set(e.id,cached);this.statics.add(cached.group);
        }
        const group=cached.group;group.userData.entity=e;group.visible=true;
        const h=BUILDINGS[e.type].water?-0.35:W.map.h(c.x,c.y);
        group.position.set(c.x,h*T25D_HEIGHT,c.y);group.scale.y=e.built?1:Math.max(0.08,e.progress||0);
        if(group.userData.sails)group.userData.sails.rotation.z=R.time*0.6;
        this.pickables.push(...group.children.filter(o=>o.isMesh));
      } else {
        keepActors.add(e.id);let cached=this.actors.get(e.id);
        const a=this.asset(e);
        let x=c.x,y=c.y;
        if(e.kind==='unit' && e._uhx!==undefined && UHD.on.unitsmooth) [x,y]=uhdLerpPos(e._uhx,e._uhy,e.x,e.y,uhdAlpha());
        const mat=this.fogAt(x,y,!!opts.editor)===1?a.material:a.dimMaterial;
        if(!cached) { const sprite=new THREE.Sprite(mat);this.entities.add(sprite);cached={sprite,asset:a};this.actors.set(e.id,cached); }
        const sprite=cached.sprite;
        if(sprite.material!==mat)sprite.material=mat;
        cached.asset=a;
        sprite.center.set(a.ax/a.width,1-a.ay/a.height);sprite.scale.set(a.width/T25D_PIXELS,a.height/T25D_PIXELS,1);
        let h=e.kind==='unit'&&UNITS[e.type].naval || e.type==='fish' ? -0.35:W.map.h(x,y);
        if(e.kind==='unit'&&!UNITS[e.type].naval&&W.map.bridge?.[W.map.idx(x|0,y|0)])h=Math.max(h,-0.35+0.11/T25D_HEIGHT);
        sprite.position.set(x,h*T25D_HEIGHT+0.004,y);
      }
    }
    for(const [id,o]of this.structures)if(!keepBuildings.has(id)){this.disposeGroup(o.group);this.structures.delete(id);}
    for(const [id,o]of this.actors)if(!keepActors.has(id)){o.sprite.removeFromParent();this.actors.delete(id);}
    // Textures from recent poses remain shared; dispose only assets unused this frame.
    for(const [key,a]of this.assets)if(this.assets.size>128 && a.frame<this.frame){a.texture.dispose();a.material.dispose();a.dimMaterial.dispose();this.assets.delete(key);}
    this.stats.structures=this.structures.size;this.stats.sprites=this.actors.size;this.stats.textures=this.assets.size;
  },
  overlay(ctx,list,opts) {
    camTransform(ctx);const selection=opts.selection||new Set();
    for(const e of list) {
      if(selection.has(e)) {
        const c=center(e),p=iso(c.x,c.y,BUILDINGS[e.type]?.water?-0.35:W.map.h(c.x,c.y));
        ctx.strokeStyle='#fff7cc';ctx.lineWidth=1.6;
        if(e.kind==='bld'){const s=bsize(e);ctx.save();ctx.translate(p.x,p.y);poly(ctx,[P(-s/2,-s/2,0),P(s/2,-s/2,0),P(s/2,s/2,0),P(-s/2,s/2,0)],null,'#fff7cc',1.6);ctx.restore();}
        else {ctx.beginPath();ctx.ellipse(p.x,p.y,14,7,0,0,Math.PI*2);ctx.stroke();}
      }
      if(!e.maxhp || e.dying || !(selection.has(e)||opts.hover===e||e.hp<e.maxhp && W.t-(e.hitT||-99)<4))continue;
      const c=center(e),p=iso(c.x,c.y,UNITS[e.type]?.naval?-0.35:W.map.h(c.x,c.y));
      const top=e.kind==='bld'?(this.structures.get(e.id)?.group.userData.top||1)*T25D_PIXELS*Math.sqrt(3)/2:unitHeight(e);
      const width=e.kind==='bld'?48:26;ctx.fillStyle='#151515';ctx.fillRect(p.x-width/2-1,p.y-top-9,width+2,6);
      ctx.fillStyle=e.owner===W.humanId?'#48db67':pcolor(e.owner).c;ctx.fillRect(p.x-width/2,p.y-top-8,width*Math.max(0,e.hp/e.maxhp),4);
    }
    const fog=!opts.editor&&W.settings.fog!=='none'&&!W.noFog;
    for(const p of W.projs)if(!fog||this.fogAt(p.x,p.y,!!opts.editor)===1)drawProjectile(ctx,p);
    for(const f of W.fx)if(!fog||this.fogAt(f.x,f.y,!!opts.editor)===1)drawFx(ctx,f);
    ctx.setTransform(1,0,0,1,0,0);
  },
  render(ctx,opts) {
    this.frame++;if(this.world!==W)this.resetWorld();
    this.syncCamera();if(this.mapVersion!==W.map.version)this.buildTerrain();
    this.updateFog(!!opts.editor);const list=this.visibleEntities(opts);this.syncEntities(list,opts);
    this.renderer.render(this.scene,this.camera);
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,R.cw,R.ch);this.overlay(ctx,list,opts);
    this.stats.frames++;this.stats.calls=this.renderer.info.render.calls;this.stats.triangles=this.renderer.info.render.triangles;
  },
  groundAt(sx,sy) {
    if(!this.terrain)return null;
    this.syncCamera();this.raycaster.setFromCamera(new this.lib.Vector2(sx/R.cw*2-1,1-sy/R.ch*2),this.camera);
    const hits=this.raycaster.intersectObjects([this.terrain,...this.props.children.filter(o=>o.userData.tileSurface)],false);
    return hits.length?{x:hits[0].point.x,y:hits[0].point.z}:null;
  },
  pickBuilding(sx,sy) {
    this.syncCamera();this.raycaster.setFromCamera(new this.lib.Vector2(sx/R.cw*2-1,1-sy/R.ch*2),this.camera);
    for(const hit of this.raycaster.intersectObjects(this.pickables||[],false)){
      let o=hit.object;while(o&&!o.userData.entity)o=o.parent;
      if(o?.userData.entity)return o.userData.entity;
    }
    return null;
  },
};

const t25dRenderWorld=renderWorld;
renderWorld=function(ctx,opts={}){
  if(!T25D.enabled||!T25D.renderer)return t25dRenderWorld(ctx,opts);
  try {return T25D.render(ctx,opts);} catch(e){T25D.enabled=T25D.requested=false;T25D.renderer.domElement.style.display='none';T25D.status('2.5D rendering stopped; Canvas 2D is active. '+e.message);return t25dRenderWorld(ctx,opts);}
};
const t25dResize=resize;
resize=function(){t25dResize();T25D.resize();};
const t25dScreenToTile=screenToTile;
screenToTile=function(sx,sy){return T25D.enabled&&T25D.renderer?(T25D.groundAt(sx,sy)||t25dScreenToTile(sx,sy)):t25dScreenToTile(sx,sy);};
const t25dHitTest=hitTest;
hitTest=function(sx,sy,opts={}){
  if(!T25D.enabled||!T25D.renderer)return t25dHitTest(sx,sy,opts);
  const existing=t25dHitTest(sx,sy,opts);if(existing&&existing.kind!=='bld')return existing;
  return T25D.pickBuilding(sx,sy)||existing;
};
async function toggleFullscreen(){
  try { if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen({navigationUI:'hide'}); }
  catch(e){T25D.status('Full screen could not start. Use your browser’s full-screen command instead.');}
}
function syncFullscreenButtons(){for(const id of ['btn-fullscreen','b-fullscreen']){const b=document.getElementById(id);if(b){b.textContent=document.fullscreenElement?'Exit Full Screen':'Full Screen';b.disabled=!document.fullscreenEnabled;b.setAttribute('aria-pressed',String(!!document.fullscreenElement));}}}
const t25dInitMenus=initMenus;
initMenus=function(){
  t25dInitMenus();document.getElementById('btn-graphics').onclick=()=>T25D.setEnabled(!T25D.enabled);
  document.getElementById('btn-fullscreen').onclick=toggleFullscreen;syncFullscreenButtons();T25D.status();
  if(T25D.requested)T25D.setEnabled(true);
};
const t25dInitHUD=initHUD;
initHUD=function(){
  t25dInitHUD();const bar=document.querySelector('#topbar .tb-btns');
  for(const [id,label,fn]of [['b-graphics','Try 2.5D Graphics',()=>T25D.setEnabled(!T25D.enabled)],['b-fullscreen','Full Screen',toggleFullscreen]]){const b=document.createElement('button');b.className='btn small display-control';b.id=id;b.textContent=label;b.onclick=fn;bar.prepend(b);}
  T25D.status();syncFullscreenButtons();
};
if(typeof document!=='undefined')document.addEventListener('fullscreenchange',()=>{syncFullscreenButtons();resize();});
