// tools/art/bake-io.mjs: bake options and manifest merge, so partial bakes never churn existing sprites.
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } };

(async () => {
  const io = await import('../tools/art/bake-io.mjs');
  const manifestPath = path.join(__dirname, '../game/art/kenney/manifest.js');

  await test('parseBakeArgs reads --preview and --recipes lists', () => {
    assert.deepEqual(io.parseBakeArgs([]), { preview: false, only: null });
    assert.deepEqual(io.parseBakeArgs([], {}), { preview: false, only: null });
    assert.deepEqual(io.parseBakeArgs(['--preview']), { preview: true, only: null });
    assert.deepEqual(io.parseBakeArgs(['--preview', 'tc_turks,tc']), { preview: true, only: ['tc_turks', 'tc'] });
    assert.deepEqual(io.parseBakeArgs(['--recipes', 'house_turks']), { preview: false, only: ['house_turks'] });
    assert.deepEqual(io.parseBakeArgs(['--recipes', '--preview']), { preview: true, only: null });
  });
  await test('parseBakeArgs rejects --recipes without a list and unknown options', () => {
    assert.throws(() => io.parseBakeArgs(['--recipes']), /--recipes needs/);
    assert.throws(() => io.parseBakeArgs(['--recipes', '--x']), /unknown option --x/);
    assert.throws(() => io.parseBakeArgs(['--onyl', 'tc']), /unknown option --onyl/);
    assert.throws(() => io.parseBakeArgs(['--only', 'tc']), /unknown option --only/);
  });
  await test('parseBakeArgs rejects what npm run passes when -- is missing', () => {
    assert.throws(() => io.parseBakeArgs(['tc_turks']), /npm run art:bake -- /);
    assert.throws(() => io.parseBakeArgs(['--preview', 'a', 'b']), /npm run art:bake -- /);
    assert.throws(() => io.parseBakeArgs([], { npm_config_recipes: 'true' }), /npm run art:bake -- /);
    assert.throws(() => io.parseBakeArgs([], { npm_config_recipes: 'tc' }), /npm run art:bake -- /);
    assert.throws(() => io.parseBakeArgs([], { npm_config_preview: 'true' }), /npm run art:bake -- /);
  });
  await test('the committed manifest.js round-trips byte for byte', () => {
    const src = fs.readFileSync(manifestPath, 'utf8').replace(/\r\n/g, '\n');
    assert.equal(io.serializeManifest(io.parseManifest(src)), src);
  });
  await test('mergeManifest keeps existing keys in order, updates re-baked ones and appends new ones', () => {
    const merged = io.mergeManifest({ a: { w: 1 }, b: { w: 2 } }, { b: { w: 3 }, c: { w: 4 } });
    assert.deepEqual(Object.keys(merged), ['a', 'b', 'c']);
    assert.deepEqual(merged, { a: { w: 1 }, b: { w: 3 }, c: { w: 4 } });
  });
  await test('a manifest without the KENNEY_ART block parses as empty', () => {
    assert.deepEqual(io.parseManifest('// nothing here\n'), {});
  });

  console.log(`${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
