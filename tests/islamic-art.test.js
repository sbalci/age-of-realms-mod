// Original Islamic building kit: GLB pieces, recipes and civ palettes stay consistent with each other and the game.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const KIT = path.join(root, 'assets/original/islamic');
const KENNEY = { town: 'assets/thirdparty/kenney/fantasy-town-kit', castle: 'assets/thirdparty/kenney/castle-kit', nature: 'assets/thirdparty/kenney/nature-kit' };
const SLOTS = ['wall', 'stone', 'trim', 'roof', 'dome', 'accent', 'band', 'gold', 'dark'];
const PIECES = ['wall', 'wall-window', 'wall-door', 'wall-arcade', 'wall-timber', 'roof-flat', 'roof-hip', 'merlon-pointed', 'merlon-stepped',
  'dome-lead', 'dome-ribbed', 'kumbet', 'minaret-pencil', 'minaret-square', 'portal', 'bay-cumba', 'alem', 'malqaf', 'mashrabiya'];
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } };

function glb(name) {
  const b = fs.readFileSync(path.join(KIT, name + '.glb'));
  assert.equal(b.toString('ascii', 0, 4), 'glTF', name);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
}
function bounds(j) {   // over every POSITION accessor, in glTF axes (y is up)
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const m of j.meshes) for (const p of m.primitives) {
    const a = j.accessors[p.attributes.POSITION];
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], a.min[i]); max[i] = Math.max(max[i], a.max[i]); }
  }
  return { min, max };
}

const R = vm.runInNewContext(fs.readFileSync(path.join(root, 'tools/art/islamic-recipes.js'), 'utf8').replace(/^export /gm, '') +
  ';({ PALETTES, TOP, ISLAMIC_RECIPES, islamicSlots })');
function placements() {   // every k.add(kit, name) made by every recipe at every style it bakes
  const out = [];
  for (const [recipe, r] of Object.entries(R.ISLAMIC_RECIPES)) for (const style of r.styles) {
    r.build({ style, add: (kit, name) => out.push({ recipe, style, kit, name }) });
  }
  return out;
}

test('the kit holds every piece', () => {
  for (const n of PIECES) assert.ok(fs.existsSync(path.join(KIT, n + '.glb')), n + '.glb missing');
});
test('kit pieces use only the named colour slots and are matte', () => {
  for (const n of PIECES) for (const m of glb(n).materials) {
    assert.ok(SLOTS.includes(m.name), n + ': unexpected material ' + m.name);
    assert.equal(m.pbrMetallicRoughness.metallicFactor ?? 1, 0, n + ' ' + m.name + ' metallic');
    assert.equal(m.pbrMetallicRoughness.roughnessFactor ?? 1, 1, n + ' ' + m.name + ' roughness');
  }
});
test('wall pieces follow the Kenney cell convention: +x edge, one storey, one cell wide', () => {
  for (const n of PIECES.filter(n => n.startsWith('wall'))) {
    const { min, max } = bounds(glb(n));
    assert.ok(min[0] >= 0.3 && max[0] <= 0.56, n + ' x ' + min[0] + '..' + max[0]);
    assert.ok(Math.abs(min[1]) < 1e-3 && Math.abs(max[1] - 1) < 1e-3, n + ' height');
    assert.ok(min[2] >= -0.501 && max[2] <= 0.501, n + ' width');
  }
});
test('every Islamic piece a recipe uses is in the kit', () => {
  for (const p of placements().filter(p => p.kit === 'islamic')) assert.ok(PIECES.includes(p.name), `${p.recipe}_${p.style}: unknown piece ${p.name}`);
});
test('every Kenney prop a recipe uses exists in its kit', () => {
  for (const p of placements().filter(p => p.kit !== 'islamic')) assert.ok(fs.existsSync(path.join(root, KENNEY[p.kit], p.name + '.glb')), `${p.recipe}_${p.style}: ${p.kit}/${p.name}`);
});
test('TOP heights match the crowning pieces', () => {
  for (const [n, h] of Object.entries(R.TOP)) {
    const top = bounds(glb(n)).max[1];
    assert.ok(Math.abs(top - h) < 0.005, n + ' top ' + top + ' vs TOP ' + h);
  }
});
test('palettes match CIV_ARCH in game/js/civ_art.js for ages 0-3', () => {
  const src = fs.readFileSync(path.join(root, 'game/js/civ_art.js'), 'utf8');
  const CIV_ARCH = vm.runInNewContext(src.slice(src.indexOf('const CIV_ARCH'), src.indexOf('const CIV_WONDER_NAMES')) + ';CIV_ARCH');
  for (const civ of ['turks', 'saracens']) for (let age = 0; age < 4; age++) for (const f of ['wall', 'stone', 'trim', 'roof', 'dome', 'accent']) {
    assert.equal(R.PALETTES[civ][age][f], CIV_ARCH[civ].ages[age][f], `${civ} age ${age} ${f}`);
  }
});
test('islamicSlots colours every slot, with ablaq bands only for Saracens from age 2', () => {
  for (const civ of ['turks', 'saracens']) for (let age = 0; age < 4; age++) {
    const s = R.islamicSlots(civ, age);
    for (const k of SLOTS) assert.match(s[k], /^#[0-9a-f]{6}$/, `${civ} ${age} ${k}`);
  }
  assert.equal(R.islamicSlots('saracens', 2).band, R.islamicSlots('saracens', 2).trim);
  assert.equal(R.islamicSlots('saracens', 1).band, R.islamicSlots('saracens', 1).wall);
  assert.equal(R.islamicSlots('turks', 3).band, R.islamicSlots('turks', 3).wall);
});
console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
