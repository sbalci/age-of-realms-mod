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
console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
