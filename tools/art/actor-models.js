// CC0 base rigs plus original, editable Ottoman/Seljuk dress, weapons and later-era vehicles.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const THEMES = ['medieval', 'seljuk', 'ottoman', 'modern', 'future'];
export const ROLES = ['villager', 'villager_f', 'sword', 'spear', 'archer', 'monk', 'gunner', 'cavalry', 'horsearcher'];
export const ACTIONS = ['idle', 'walk', 'attack', 'work'];
export const ANIMALS = ['sheep', 'cow', 'deer', 'boar', 'wolf', 'horse'];
const cache = new Map(), gltf = new GLTFLoader(), fbx = new FBXLoader();
const gold = '#c9a658', steel = '#879aa1', leather = '#604332', cloth = '#796b55', team = '#e7e7e7';
const mat = (color, glow = false) => new T.MeshStandardMaterial({ color, roughness: .8, metalness: .05, flatShading: true, ...(glow ? { emissive: color, emissiveIntensity: .65 } : {}) });
function mesh(parent, geometry, color, x, y, z, isTeam = false, glow = false) {
  const o = new T.Mesh(geometry, mat(color, glow)); o.position.set(x, y, z); o.userData.team = isTeam; parent.add(o); return o;
}
const box = (p, c, x, y, z, w, h, d, t = false) => mesh(p, new T.BoxGeometry(w, h, d), c, x, y, z, t);
const ball = (p, c, x, y, z, w, h, d, t = false) => { const m = mesh(p, new T.SphereGeometry(1, 10, 7), c, x, y, z, t); m.scale.set(w, h, d); return m; };
const cyl = (p, c, x, y, z, r, h, rt = r, t = false) => mesh(p, new T.CylinderGeometry(rt, r, h, 12), c, x, y, z, t);
function curve(p, points, color, radius) {
  return mesh(p, new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v => new T.Vector3(...v))), 12, radius, 5, false), color, 0, 0, 0);
}
function cap(head, theme, civilian, monk, gunner) {
  if (theme === 'future') {
    ball(head, '#c3ccd2', 0, .047, .015, .098, .09, .096);
    box(head, '#102b3b', 0, .055, .096, .15, .062, .025);
    box(head, '#63dcf3', 0, .06, .112, .125, .012, .008);
    box(head, team, 0, .103, .025, .125, .02, .095, true);
  } else if (theme === 'modern') {
    ball(head, civilian ? '#dcb64e' : '#475a42', 0, .072, .01, .099, .065, .098);
    cyl(head, civilian ? '#e3ba50' : '#3b4b37', 0, .054, .023, .105, .012);
    if (!civilian) box(head, '#253029', .083, .04, .055, .023, .045, .02);
  } else if (theme === 'ottoman' && gunner) {
    cyl(head, '#e6dfc8', 0, .118, 0, .074, .19, .055);
    box(head, '#e8e0cc', 0, .066, -.086, .11, .20, .021);
    cyl(head, gold, 0, .035, .003, .084, .025);
    ball(head, gold, 0, .12, .058, .018, .043, .015);
  } else if (monk || theme === 'ottoman') {
    ball(head, '#e9e3cf', 0, .06, .008, .101, .065, .091);
    for (let i = 0; i < 3; i++) {
      const m = mesh(head, new T.TorusGeometry(.085 - i * .008, .012, 5, 16), '#d2cbb7', 0, .035 + i * .018, .008);
      m.rotation.x = Math.PI / 2;
    }
    cyl(head, monk ? '#397759' : gold, 0, .104, .007, .033, .05, .027);
  } else if (theme === 'seljuk') {
    cyl(head, civilian ? '#6e4931' : steel, 0, .115, .005, .078, .18, .008);
    cyl(head, '#514637', 0, .034, .005, .09, .037);
    if (!civilian) { box(head, steel, 0, .003, .09, .015, .1, .02); box(head, '#635a4b', 0, -.014, -.064, .14, .08, .035); }
  } else {
    ball(head, civilian ? '#90704b' : steel, 0, .068, .01, .088, .067, .088);
    cyl(head, civilian ? '#b89a61' : '#687b84', 0, .038, .01, civilian ? .13 : .11, .014);
  }
}
function sword(hand, curved) {
  box(hand, leather, 0, -.035, .018, .025, .09, .025);
  box(hand, gold, 0, -.085, .018, .11, .018, .035);
  curve(hand, [[0, -.08, .018], [curved ? .025 : 0, -.23, .018], [curved ? .1 : .008, -.39, .018]], '#cdd7d6', .014);
}
function bow(hand, theme) {
  if (theme === 'modern' || theme === 'future') return rifle(hand, theme, true);
  curve(hand, [[-.04, .12, .04], [.08, .02, .04], [.07, -.14, .04], [-.04, -.25, .04]], '#875433', .012);
  curve(hand, [[-.04, .12, .04], [-.09, -.06, .04], [-.04, -.25, .04]], '#dacbad', .003);
  box(hand, '#8f6b44', .0, -.06, .09, .012, .012, .29);
}
function rifle(hand, theme, scoped = false) {
  const future = theme === 'future', old = theme === 'ottoman' || theme === 'seljuk' || theme === 'medieval';
  box(hand, old ? '#795032' : '#26393e', 0, -.035, .13, .045, .055, .32);
  box(hand, old ? '#a8aeb1' : '#6c7b7e', 0, -.014, .35, .023, .027, old ? .27 : .23);
  if (!old) box(hand, '#182528', 0, -.085, .12, .035, .075, .075);
  if (scoped) { const m = cyl(hand, '#172c33', 0, .008, .19, .023, .105); m.rotation.x = Math.PI / 2; }
  if (future) {
    for (let i = 0; i < 3; i++) mesh(hand, new T.TorusGeometry(.028, .006, 4, 10), '#5be3f3', 0, -.014, .28 + i * .035, false, true);
    box(hand, '#82e8ef', 0, -.013, .46, .029, .03, .013);
  }
}
function shield(arm, theme) {
  const m = cyl(arm, '#79573d', .045, -.1, .01, .115, .025, .115); m.rotation.z = Math.PI / 2;
  const rim = mesh(arm, new T.TorusGeometry(.113, .012, 4, 16), gold, .061, -.1, .01); rim.rotation.y = Math.PI / 2;
  const center = ball(arm, team, .063, -.1, .01, .014, .095, .095, true);
  ball(arm, steel, .081, -.1, .01, .022, .026, .026);
  if (theme === 'seljuk') { box(arm, gold, .083, -.1, .01, .008, .12, .018).rotation.x = Math.PI / 4; }
  return center;
}
async function source(url, isFbx = false) {
  if (!cache.has(url)) cache.set(url, isFbx ? fbx.loadAsync(url).then(scene => ({ scene, animations: scene.animations })) : gltf.loadAsync(url));
  return cache.get(url);
}
function fit(scene, height) {
  scene.updateMatrixWorld(true);
  const b = new T.Box3().setFromObject(scene), k = height / (b.max.y - b.min.y);
  const wrap = new T.Group(); wrap.add(scene); wrap.scale.setScalar(k);
  scene.position.x -= (b.min.x + b.max.x) / 2; scene.position.y -= b.min.y; scene.position.z -= (b.min.z + b.max.z) / 2;
  return wrap;
}
export async function human(theme, role) {
  const civilian = role.startsWith('villager'), female = role === 'villager_f', monk = role === 'monk', gunner = role === 'gunner';
  const src = await source('/assets/thirdparty/kenney/mini-characters/Models/GLB format/character-' + (female ? 'female' : 'male') + '-b.glb');
  const body = clone(src.scene), root = new T.Group(); root.add(body);
  const head = new T.Group(), torso = new T.Group(), right = body.getObjectByName('arm-right'), left = body.getObjectByName('arm-left');
  body.getObjectByName('head').add(head); head.scale.setScalar(2.3); head.position.y = .16;
  body.getObjectByName('torso').add(torso); torso.scale.setScalar(1.5); torso.position.z = .02;
  cap(head, theme, civilian, monk, gunner);
  const future = theme === 'future', modern = theme === 'modern', eastern = theme === 'ottoman' || theme === 'seljuk';
  const coat = monk ? '#e0d7be' : civilian ? (female ? '#938371' : '#b3a08a') : future ? '#495e70' : modern ? '#56674d' : '#6f6454';
  // Editable clothing is attached to the rig, so walking and working move it with the body.
  box(torso, coat, 0, .063, .012, .175, .14, .12);
  box(torso, team, 0, .058, .079, .12, .105, .015, true);
  box(torso, gold, 0, -.012, .012, .19, .018, .135);
  box(torso, team, 0, .055, -.095, .16, .16, .02, true);
  box(torso, team, 0, -.012, .09, .19, .022, .02, true);
  if (eastern || monk) {
    cyl(torso, coat, 0, -.04, .01, .115, .11, .092);
    box(torso, team, 0, -.04, .115, .055, .1, .011, true);
    if (!civilian && !monk) for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
      box(torso, row % 2 ? '#738082' : '#a29b83', -.065 + col * .032, .02 + row * .026, .094, .026, .021, .009);
    }
    box(torso, team, .088, .066, .10, .022, .13, .02, true);
    if (monk) { cyl(torso, '#e4dcc7', 0, -.08, .01, .125, .2, .09); box(torso, '#398166', -.03, -.02, .12, .025, .23, .01); }
  }
  if (modern || future) {
    box(torso, '#344237', 0, .065, -.07, .12, .14, .045);
    for (const side of [-1, 1]) { box(torso, future ? '#798c9c' : '#3e4d3b', side * .11, .105, .013, .065, .06, .1); box(torso, '#263e3b', side * .06, .025, .1, .045, .04, .025); }
    if (future) { box(torso, '#65deec', 0, .085, .094, .09, .013, .011); cyl(torso, '#65deec', 0, .075, -.105, .025, .08); }
  }
  const hand = new T.Group(); hand.position.set(0, -.16, .03); hand.scale.setScalar(1.25); right.add(hand);
  if (role === 'sword' || role === 'cavalry') { sword(hand, eastern); if (!civilian) shield(left, theme); }
  else if (role === 'spear') {
    box(hand, leather, 0, -.04, .01, .018, .6, .018); cyl(hand, steel, 0, .29, .01, .027, .12, 0);
    shield(left, theme);
  } else if (role === 'archer' || role === 'horsearcher') bow(hand, theme);
  else if (gunner) rifle(hand, theme);
  else if (monk && !modern && !future) { box(hand, '#8b6c42', 0, -.08, .02, .018, .5, .018); ball(hand, gold, 0, .19, .02, .03, .035, .03); }
  else if (monk) { box(hand, '#e3e5da', 0, -.035, .08, .09, .1, .06); box(hand, '#3d9e86', 0, -.035, .113, .06, .02, .005); }
  const mixer = new T.AnimationMixer(body);
  const clips = new Map(src.animations.map(c => [c.name, c]));
  let active;
  const mounted = role === 'cavalry' || role === 'horsearcher';
  let horse;
  if (mounted) { horse = await animal('horse'); root.add(horse.root); body.scale.setScalar(.85); body.position.y = .48; box(root, team, 0, .59, -.06, .36, .09, .32, true); }
  else body.scale.setScalar(1.05);
  function pose(action, f) {
    let name = action === 'walk' && !mounted ? 'walk' : action === 'attack' ? (gunner || role === 'archer' || role === 'horsearcher' ? 'holding-right-shoot' : 'attack-melee-right') : action === 'work' ? 'interact-right' : mounted ? 'sit' : 'idle';
    const clip = clips.get(name) || clips.get('idle');
    if (active !== clip) { mixer.stopAllAction(); mixer.clipAction(clip).play(); active = clip; }
    mixer.setTime(f * Math.max(.01, clip.duration));
    if (mounted) horse.pose(action === 'walk' ? 'walk' : 'idle', f);
    if (!civilian && action === 'attack' && !gunner && role !== 'archer') right.rotation.x -= Math.sin(f * Math.PI) * .5;
    root.updateMatrixWorld(true);
  }
  pose('idle', 0);
  return { root, pose };
}

// Wildlife source rigs, with an original deer and wild-boar details where the available pack differs.
export async function animal(kind) {
  if (kind === 'deer') return deer();
  const file = { sheep: 'Sheep', cow: 'Cow', boar: 'Pig', wolf: 'Wolf', horse: 'Horse' }[kind];
  const src = await source('/assets/thirdparty/quaternius/animals/' + file + '.fbx', true);
  const body = clone(src.scene), root = new T.Group();
  root.add(fit(body, { sheep: .43, cow: .68, boar: .42, wolf: .46, horse: .75 }[kind]));
  body.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; o.material = ms.map(m => { const n = m.clone(); n.metalness = 0; n.roughness = .9; return n; }); if (o.material.length === 1) o.material = o.material[0]; } });
  if (kind === 'boar') body.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.color.multiply(new T.Color('#6c4f37')); } });
  if (kind === 'boar') {
    for (const side of [-1, 1]) curve(root, [[side * .075, .17, .3], [side * .1, .23, .37], [side * .11, .29, .35]], '#e2d4af', .016);
    for (let i = 0; i < 7; i++) cyl(root, '#3e3027', 0, .42, -.18 + i * .05, .011, .08, 0);
  }
  if (kind === 'wolf') body.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.color.multiply(new T.Color('#9a9586')); } });
  const clips = src.animations || [], mixer = new T.AnimationMixer(body);
  const walkClip = clips.find(c => /walk|run|gallop/i.test(c.name)), idleClip = clips.find(c => /idle/i.test(c.name));
  let active;
  const rest = new Map(); body.traverse(o => { if (o.isBone) rest.set(o, { q: o.quaternion.clone(), p: o.position.clone(), s: o.scale.clone() }); });
  const pose = (action, f) => {
    for (const [b, v] of rest) { b.quaternion.copy(v.q); b.position.copy(v.p); b.scale.copy(v.s); }
    const clip = action === 'walk' ? walkClip : action === 'attack' ? clips.find(c => /attack/i.test(c.name)) || idleClip : idleClip;
    if (clip) {
      if (active !== clip) { mixer.stopAllAction(); mixer.clipAction(clip).play(); active = clip; }
      mixer.setTime(f * clip.duration);
    } else {
      mixer.stopAllAction(); active = null;
      // The older farm pack has idle/jump clips only. Author a walk on its leg joints instead of playing jump.
      if (action === 'walk') for (const [b] of rest) if (/^(Front|Back)(UpLeg|Leg)[LR]$/.test(b.name)) {
        const opposite = /Front.*L|Back.*R/.test(b.name);
        b.rotateX(Math.sin(f * Math.PI * 2 + (opposite ? Math.PI : 0)) * .38);
      }
    }
    root.updateMatrixWorld(true);
  };
  return { root, pose, sourceClips: clips.map(c => ({ name: c.name, duration: c.duration })), bones: Array.from(rest.keys(), b => b.name) };
}
function deer() {
  const root = new T.Group(), c = '#9b7550', dark = '#3c342b';
  ball(root, c, 0, .38, 0, .13, .16, .28);
  ball(root, c, 0, .54, .2, .095, .19, .10).rotation.x = .3;
  ball(root, c, 0, .67, .27, .075, .08, .115);
  ball(root, '#292a25', 0, .65, .365, .045, .028, .025);
  for (const side of [-1, 1]) {
    ball(root, '#242b25', side * .062, .7, .3, .012, .014, .013);
    ball(root, '#b8976d', side * .1, .73, .24, .067, .025, .035).rotation.z = side * .5;
    curve(root, [[side * .045, .74, .25], [side * .085, .87, .22], [side * .13, .98, .13]], '#b2a188', .012);
    curve(root, [[side * .08, .85, .22], [side * .145, .91, .25]], '#b2a188', .009);
  }
  const legs = [];
  for (const x of [-.085, .085]) for (const z of [-.19, .19]) { const g = new T.Group(); g.position.set(x, .34, z); root.add(g); box(g, c, 0, -.13, 0, .035, .28, .04); box(g, dark, 0, -.285, .018, .04, .05, .07); legs.push(g); }
  ball(root, '#e0d2b8', 0, .41, -.27, .07, .07, .045);
  return { root, pose(action, f) { legs.forEach((g, i) => { g.rotation.x = action === 'walk' ? Math.sin(f * Math.PI * 2 + (i % 2) * Math.PI) * .5 : 0; }); root.updateMatrixWorld(true); } };
}
export function vehicle(theme, role) {
  const root = new T.Group(), future = role === 'walker', hull = future ? '#536879' : '#596b50';
  const moving = [];
  if (!future) {
    for (const side of [-1, 1]) {
      box(root, '#242a29', side * .29, .14, 0, .15, .21, .8);
      for (let i = 0; i < 5; i++) { const w = cyl(root, '#899080', side * .375, .14, -.29 + i * .145, .078, .02); w.rotation.z = Math.PI / 2; moving.push(w); }
      for (let i = 0; i < 8; i++) box(root, '#424a41', side * .29, .25, -.34 + i * .095, .16, .025, .055);
    }
    box(root, hull, 0, .27, 0, .55, .2, .72);
    box(root, team, 0, .38, -.15, .35, .025, .28, true);
    box(root, hull, 0, .45, .015, .36, .18, .37);
    const barrel = cyl(root, '#6b7861', 0, .46, .43, .033, .65); barrel.rotation.x = Math.PI / 2;
    box(root, '#29352e', 0, .46, .75, .08, .065, .1);
    for (const side of [-1, 1]) ball(root, '#ead9a8', side * .18, .28, .37, .035, .025, .02);
  } else {
    for (const side of [-1, 1]) {
      const leg = new T.Group(); leg.position.set(side * .21, .53, 0); root.add(leg);
      box(leg, '#a5b3bc', 0, -.12, 0, .12, .26, .14).rotation.x = -.25;
      box(leg, '#354958', 0, -.32, .04, .1, .24, .12).rotation.x = .25;
      box(leg, '#8a9ea9', 0, -.47, .1, .18, .07, .27); moving.push(leg);
      ball(root, '#66e1e8', side * .24, .55, 0, .06, .06, .06);
    }
    box(root, hull, 0, .76, 0, .63, .37, .38);
    box(root, team, 0, .85, .2, .4, .11, .02, true);
    box(root, '#132c3b', 0, .78, .21, .24, .06, .03);
    box(root, '#6febf5', 0, .78, .23, .18, .025, .014);
    for (const side of [-1, 1]) {
      const gun = cyl(root, '#263c4d', side * .43, .74, .2, .065, .6); gun.rotation.x = Math.PI / 2;
      for (let i = 0; i < 3; i++) mesh(root, new T.TorusGeometry(.07, .012, 5, 12), '#6ce6f0', side * .43, .74, .33 + i * .05, false, true);
    }
  }
  return { root, pose(action, f) { moving.forEach((o, i) => { if (future) o.rotation.x = action === 'walk' ? Math.sin(f * Math.PI * 2 + i * Math.PI) * .3 : 0; }); root.position.y = future && action === 'walk' ? Math.abs(Math.sin(f * Math.PI * 2)) * .025 : 0; root.updateMatrixWorld(true); } };
}
