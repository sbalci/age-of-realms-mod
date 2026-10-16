# Islamic Building Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Turks and Saracens their own House, Town Center and Monastery sprites, built from an original Blender-scripted parts kit and rendered by the existing three.js baker. That is 20 sprites, keyed `<type>_<civ>_<age>`.

**Architecture:**
- A Blender script (`tools/art/blender/islamic_kit.py`) writes 19 modular `.glb` pieces to `assets/original/islamic/`.
- `tools/art/islamic-recipes.js` assembles them, with Kenney props, into per-civ recipes.
- `kenney-bake.html` recolours each piece's named material slots from the civ's age palette.
- A new `--only` merge mode in `bake-kenney.mjs` bakes just those recipes and adds them to `manifest.js`.
- In game, `civ_art.js` prefers `type_civ_age` sprites and skips its painted dome and minaret for them. Missing sprites fall back to today's art.

**Tech Stack:**
- Blender 5.2.2 (bpy/bmesh, glTF exporter), headless and over the Blender MCP for visual checks
- three.js 0.186 baker in Playwright Chromium
- Plain browser JS (game)
- Node 22 test scripts (`tests/*.test.js`) and Playwright (`tests/browser/*.spec.js`)

**Spec:** [docs/superpowers/specs/2026-10-16-islamic-building-kit-design.md](../specs/2026-10-16-islamic-building-kit-design.md)

## Global Constraints

**Tools and environment**
- Free and open-source tools only:
  - Do not call the Blender MCP `generate_3d`, `search_assets` or `import_asset` tools.
  - No AI image generation.
  - Every mesh comes from `islamic_kit.py` or the existing Kenney CC0 kits.
- Blender: `D:\Blender\blender.exe` (5.2.2 LTS). The `BLENDER` environment variable overrides it.
- Playwright Chromium lives in `D:\ms-playwright` (installed in Task 0). Every command that bakes or runs browser tests needs `PLAYWRIGHT_BROWSERS_PATH=D:\ms-playwright`. In this VS Code session, prefix it on each command; new shells get it from `setx`.

**Git**
- Work on branch `feat/islamic-building-kit`.
- Every commit message ends with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

**Baking**
- Never run a plain full bake (`npm run art:bake` with no flags). Bake only with `--only <recipes>`, so the existing 109 sprites stay byte-identical.
- After every bake, `git status --short game/art/kenney` must list only new or changed `*_turks_*` / `*_saracens_*` PNGs and `manifest.js`.

**Sprites**
- 20 sprites, keyed `<type>_<civ>_<age>`:
  - `house` and `tc`: ages 0–3
  - `monastery`: ages 2–3
  - for both `turks` and `saracens`
- Recipe sizes match the Kenney recipes they replace:

  | Building | `size` | `scale` | `sq` |
  |---|---|---|---|
  | house | 2 | 0.72 | 0.80 |
  | tc | 4 | 1.06 | 1.02 |
  | monastery | 3 | 1.02 | 1.02 |

**Kit conventions**
- 1×1 cell pieces centred on the origin; one storey = 1 unit.
- Wall pieces sit on the cell's +x edge, facing +x; glTF is Y-up.
- Material names are exactly `wall stone trim roof dome accent band gold dark`, all metallic 0 and roughness 1.

**Colours**
- Palettes are copied from `CIV_ARCH.turks/saracens.ages[0..3]` in `game/js/civ_art.js`.
- `band` (the striped stone courses) uses `trim` for Saracens from age 2, and `wall` otherwise. This narrows the spec's "band → trim" so only Saracen ablaq is striped.
- `gold` = `#e8c040`, `dark` = `#2a2420`.
- One `SHADE` multiplier is tuned at review point 1.

**Out of scope:** other civs, other buildings, ages 4–5 sprites, units, the 2.5D renderer (`?renderer=three`), and `?art=classic`.

**Review gates.** Tasks 4 and 8 end with a user approval. Do not start the next task until the user approves.

**Main-session steps.** These need the user or the live Blender MCP, so the coordinating session runs them itself even under subagent-driven execution:
- Task 2 Step 7 (Blender preview)
- Task 4 Steps 1–4 (hero review)
- Task 8 Steps 1–2 (full-set review)
- Task 9 Step 3 (screenshot review)

Everything else is code and suits subagents.

**Deviation from the spec, and why.** The spec says to build only the hero's pieces before review point 1. All 19 kit pieces were already written and checked while planning (headless export plus the kit tests), so Task 2 exports all of them; they are cheap to regenerate if the hero review changes the style. The gate still holds where it costs effort: no recipe other than `tc_turks` (age 2) is added or baked before approval.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `tools/art/bake-io.mjs` | create | Pure helpers: bake CLI options, manifest parse/merge/serialize |
| `tools/art/bake-kenney.mjs` | modify | Uses `bake-io.mjs`; adds `--only` merge bakes |
| `tools/art/blender/islamic_kit.py` | create | Builds the 19 kit pieces (bpy/bmesh) and exports GLBs; `preview()` for the live Blender |
| `tools/art/blender/run-kit.mjs` | create | Finds Blender, runs the kit script headless (`npm run art:kit`) |
| `assets/original/islamic/*.glb` | create (generated) | The 19 committed kit pieces |
| `assets/original/islamic/README.md` | create | Provenance, licence (CC0), conventions |
| `tools/art/islamic-recipes.js` | create | Palettes, slot colouring, recipe helpers, the 6 Turks/Saracens recipes |
| `tools/art/kenney-recipes.js` | modify | Merges `ISLAMIC_RECIPES` into `RECIPES` |
| `tools/art/kenney-bake.html` | modify | `islamic` kit path and per-slot recolouring |
| `game/js/art_kenney.js` | modify | `civKartKey(type, civ, st)` |
| `game/js/civ_art.js` | modify | Prefer civ sprites; skip the painted crown for them |
| `game/art/kenney/*_turks_*.png`, `*_saracens_*.png`, `manifest.js` | create/modify (generated) | Baked sprites |
| `tests/art-bake-io.test.js` | create | Unit tests for `bake-io.mjs` |
| `tests/islamic-art.test.js` | create | Kit, recipe, palette and manifest consistency |
| `tests/run-all.js` | modify | Adds both new tests to the `--quick` set |
| `tests/browser/art.spec.js` | modify | Civ sprite selection and fallback; computed missing-sprite count |
| `tests/browser/islamic-art.spec.js` | create | In-game scene with both civs, plus screenshots for review |
| `package.json` | modify | `art:kit` script |
| `docs/ASSET_PLAN.md`, `README.md` | modify | One line each on the Blender kit |

---

### Task 0: Toolchain and baseline

**Files:**
- No repo files change.

**Interfaces:**
- Produces: Chromium in `D:\ms-playwright`, the `create-game-assets` skill installed, and recorded baseline test results.

- [ ] **Step 1: Install Playwright's Chromium on D: and persist the path**

  The baker and the browser tests need Chromium for `@playwright/test` 1.64.1. Today only an older build (`chromium-1208`) is under `%LOCALAPPDATA%\ms-playwright`.

  Run in PowerShell:

  ```powershell
  $env:PLAYWRIGHT_BROWSERS_PATH = 'D:\ms-playwright'
  npx playwright install chromium
  setx PLAYWRIGHT_BROWSERS_PATH D:\ms-playwright
  ```

  Expected: the install finishes with no error, and `D:\ms-playwright` contains a `chromium-*` folder.

- [ ] **Step 2: Install the create-game-assets skill** (Apache-2.0)

  ```bash
  npx -y skills add gamedev-skills/awesome-gamedev-agent-skills@create-game-assets -g -y
  ```

  Expected: the output says it was installed.

  It is used at the review gates (Tasks 4 and 8) for its contact-sheet QA checklist. Load it with the Skill tool when you reach those tasks.

- [ ] **Step 3: Record the baseline**

  ```bash
  npm run test:quick
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/art.spec.js --reporter=line
  ```

  Expected:
  - `test:quick`: `Total: 180 checks passed; 0 suites failed.`
  - Browser art tests: write down which pass. The test `missing sprites fall back to drawn art` may fail with `Expected: 7, Received: 9`. That count predates this work: `tc_4` and `tc_5` were added in commit `206a898`. Task 5 replaces the constant with a computed count.

  Nothing to commit.

---

### Task 1: Merge-mode bake (`--only`)

**Files:**
- Create: `tools/art/bake-io.mjs`
- Create: `tests/art-bake-io.test.js`
- Modify: `tools/art/bake-kenney.mjs` (header comment, argument parsing at lines 13–16, bake branch at lines 45–57)
- Modify: `tests/run-all.js:3` (quick set)

**Interfaces:**
- Produces, used by every later bake:
  - `parseBakeArgs(argv) → { preview: boolean, only: string[] | null }`
  - `parseManifest(src) → object`
  - `serializeManifest(art) → string`
  - `mergeManifest(existing, baked) → object`
  - CLI: `node tools/art/bake-kenney.mjs --only a,b` (also `npm run art:bake -- --only a,b`)

- [ ] **Step 1: Write the failing test** `tests/art-bake-io.test.js`

```js
// tools/art/bake-io.mjs: bake options and manifest merge, so partial bakes never churn existing sprites.
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } };

(async () => {
  const io = await import('../tools/art/bake-io.mjs');
  const manifestPath = path.join(__dirname, '../game/art/kenney/manifest.js');

  await test('parseBakeArgs reads --preview and --only lists', () => {
    assert.deepEqual(io.parseBakeArgs([]), { preview: false, only: null });
    assert.deepEqual(io.parseBakeArgs(['--preview']), { preview: true, only: null });
    assert.deepEqual(io.parseBakeArgs(['--preview', 'tc_turks,tc']), { preview: true, only: ['tc_turks', 'tc'] });
    assert.deepEqual(io.parseBakeArgs(['--only', 'house_turks']), { preview: false, only: ['house_turks'] });
    assert.deepEqual(io.parseBakeArgs(['--only', '--preview']), { preview: true, only: null });
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
```

- [ ] **Step 2: Run it to verify it fails**

  Run: `node tests/art-bake-io.test.js`

  Expected: the process crashes with `ERR_MODULE_NOT_FOUND` for `tools/art/bake-io.mjs`.

- [ ] **Step 3: Implement** `tools/art/bake-io.mjs`

```js
// Pure helpers for tools/art/bake-kenney.mjs: command-line options and manifest.js read/merge/write.
export const MANIFEST_HEADER = '// Generated by tools/art/bake-kenney.mjs from Kenney CC0 kits (assets/thirdparty/kenney). Do not edit.\n';

// --preview [a,b] renders a contact sheet; --only a,b bakes just those recipes and merges them into manifest.js
export function parseBakeArgs(argv) {
  const list = flag => { const i = argv.indexOf(flag); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1].split(',') : null; };
  const preview = argv.includes('--preview');
  return { preview, only: preview ? list('--preview') : list('--only') };
}
export function parseManifest(src) {
  const m = /const KENNEY_ART = (\{[\s\S]*\});/.exec(src);
  return m ? JSON.parse(m[1]) : {};
}
export function serializeManifest(art) {
  return MANIFEST_HEADER + 'const KENNEY_ART = ' + JSON.stringify(art, null, 1) + ';\n';
}
// existing keys keep their order (re-baked ones are updated in place); new keys are appended
export function mergeManifest(existing, baked) {
  return { ...existing, ...baked };
}
```

- [ ] **Step 4: Run the test to verify it passes**

  Run: `node tests/art-bake-io.test.js`

  Expected: `4 passed, 0 failed`. The round-trip test proves a merge rewrites the existing manifest byte for byte.

- [ ] **Step 5: Wire it into `tools/art/bake-kenney.mjs`**

  In the header comment, after the `--preview` usage line, add:

```js
//   node tools/art/bake-kenney.mjs --only a,b        -> bakes only recipes a and b and merges them into manifest.js
```

  After the line `import { fileURLToPath } from 'node:url';`, add:

```js
import { parseBakeArgs, parseManifest, serializeManifest, mergeManifest } from './bake-io.mjs';
```

  Replace:

```js
const args = process.argv.slice(2);
const previewIdx = args.indexOf('--preview');
const preview = previewIdx >= 0;
const only = preview && args[previewIdx + 1] ? args[previewIdx + 1].split(',') : null;
```

  with:

```js
const { preview, only } = parseBakeArgs(process.argv.slice(2));
```

  Replace the whole bake branch:

```js
} else {
  const res = await page.evaluate(() => window.bakeAll());
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = {};
  for (const [name, v] of Object.entries(res)) {
    fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(v.png.split(',')[1], 'base64'));
    manifest[name] = { w: v.w, h: v.h, ax: v.ax, ay: v.ay, SC: v.SC };
  }
  fs.writeFileSync(path.join(outDir, 'manifest.js'),
    '// Generated by tools/art/bake-kenney.mjs from Kenney CC0 kits (assets/thirdparty/kenney). Do not edit.\n' +
    'const KENNEY_ART = ' + JSON.stringify(manifest, null, 1) + ';\n');
  console.log(`baked ${Object.keys(res).length} sprites into game/art/kenney`);
}
```

  with:

```js
} else {
  const res = await page.evaluate(o => window.bakeAll(o), only);
  fs.mkdirSync(outDir, { recursive: true });
  const baked = {};
  for (const [name, v] of Object.entries(res)) {
    fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(v.png.split(',')[1], 'base64'));
    baked[name] = { w: v.w, h: v.h, ax: v.ax, ay: v.ay, SC: v.SC };
  }
  // --only merges into the existing manifest so untouched sprites keep their entries; a full bake replaces it
  const file = path.join(outDir, 'manifest.js');
  const manifest = only && fs.existsSync(file) ? mergeManifest(parseManifest(fs.readFileSync(file, 'utf8')), baked) : baked;
  fs.writeFileSync(file, serializeManifest(manifest));
  console.log(`baked ${Object.keys(res).length} sprites into game/art/kenney` + (only ? ` (merged: manifest has ${Object.keys(manifest).length})` : ''));
}
```

- [ ] **Step 6: Add the new test to the quick set**

  In `tests/run-all.js` line 3, add `'art-bake-io.test.js', ` as the first entry of the `quick` Set:

```js
const quick = new Set(['art-bake-io.test.js', 'assist.test.js', 'geography-geology.test.js', 'actors.test.js', 'reliability.test.js', 'timing.test.js', 'engineering.test.js', 'eras.test.js', 'extras.test.js', 'terrain.test.js', 'fx.test.js', 'units_hd.test.js', 'polish.test.js', 'tactics.test.js', 'hud.test.js']);
```

- [ ] **Step 7: Prove a merge bake leaves existing sprites untouched**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright node tools/art/bake-kenney.mjs --only well
  git status --short game/art/kenney
  ```

  Expected:
  - The console prints `baked 2 sprites into game/art/kenney (merged: manifest has 109)`.
  - `git status` shows nothing, or at most `well_0.png`/`well_2.png` if the renderer is not byte-deterministic.

  If anything else is listed, stop and investigate before continuing. Then discard any change with `git checkout -- game/art/kenney`.

- [ ] **Step 8: Run the quick suite and commit**

  ```bash
  npm run test:quick
  git add tools/art/bake-io.mjs tools/art/bake-kenney.mjs tests/art-bake-io.test.js tests/run-all.js
  git commit -F - <<'EOF'
  feat(art): add --only merge mode to the Kenney sprite baker

  Partial bakes write only the named recipes and merge them into
  manifest.js, so existing sprites are not re-rendered or reordered.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  EOF
  ```

  Expected: `Total: 184 checks passed; 0 suites failed.`

---

### Task 2: Blender parts kit

**Files:**
- Create: `tools/art/blender/islamic_kit.py`
- Create: `tools/art/blender/run-kit.mjs`
- Create: `assets/original/islamic/README.md`
- Create (generated): `assets/original/islamic/*.glb` (19 files)
- Create: `tests/islamic-art.test.js`
- Modify: `package.json` (scripts)
- Modify: `tests/run-all.js:3` (quick set)

**Interfaces:**
- Produces 19 GLB pieces named:
  `wall wall-window wall-door wall-arcade wall-timber roof-flat roof-hip merlon-pointed merlon-stepped dome-lead dome-ribbed kumbet minaret-pencil minaret-square portal bay-cumba alem malqaf mashrabiya`
- Crowning heights at scale 1 (Task 3's `TOP` table depends on these):

  | Piece | Height |
  |---|---|
  | `dome-lead` | 0.62 |
  | `dome-ribbed` | 0.959 |
  | `kumbet` | 1.98 |
  | `minaret-pencil` | 3.27 |
  | `minaret-square` | 2.995 |
  | `portal` | 1.76 |

- Python API for the live Blender:
  - `PIECES` (name → builder)
  - `preview(names, spacing=1.6)`
  - `build_object(piece)`

- [ ] **Step 1: Write the failing kit test** `tests/islamic-art.test.js`

  This is the kit-only version; Task 3 extends it.

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

  Run: `node tests/islamic-art.test.js`

  Expected: `0 passed, 3 failed`. The `.glb` files are missing (`wall.glb missing` / `ENOENT`).

- [ ] **Step 3: Write the kit script** `tools/art/blender/islamic_kit.py`

```python
"""Original Islamic architecture parts kit for the Age of Realms sprite baker.

Headless (tools/art/blender/run-kit.mjs calls this):
  blender -b --factory-startup --python tools/art/blender/islamic_kit.py -- <out_dir> [piece,piece,...]
Live Blender (Blender MCP): exec this file with __name__ != '__main__', then call preview([...]).

Conventions match the Kenney kits used by tools/art/kenney-recipes.js:
  * one piece per 1x1 tile cell, centred on the origin; one storey = 1 unit high
  * wall-type pieces sit on the cell's +x edge and face +x
  * Blender is Z-up; the glTF exporter writes Y-up, which is what the baker expects
  * materials are named after colour slots; the baker recolours every slot per civ and age
"""
import bmesh
import bpy
import math
import os
import sys

SLOTS = {   # preview colours only (sRGB); tools/art/islamic-recipes.js supplies the baked colours
    'wall': '#ded4c2', 'stone': '#ccc2b0', 'trim': '#288290', 'roof': '#526270', 'dome': '#586878',
    'accent': '#c83028', 'band': '#288290', 'gold': '#e8c040', 'dark': '#2a2420',
}
T = 0.12      # wall thickness
FACE = 0.5    # outer wall face: the cell's +x edge


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(slot):
    m = bpy.data.materials.get(slot)
    if m:
        return m
    m = bpy.data.materials.new(slot)
    try:
        m.use_nodes = True
    except (AttributeError, TypeError):
        pass
    h = SLOTS[slot]
    rgb = [srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5)]
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 1.0
    m.diffuse_color = (*rgb, 1.0)
    return m


class Piece:
    """Accumulates one piece's geometry in a bmesh; every part names its colour slot."""

    def __init__(self, name):
        self.name, self.bm, self.slots = name, bmesh.new(), []

    def _mat(self, slot):
        if slot not in self.slots:
            self.slots.append(slot)
        return self.slots.index(slot)

    def box(self, slot, x0, y0, z0, x1, y1, z1):
        i = self._mat(slot)
        v = [self.bm.verts.new((x, y, z)) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
        for f in ((0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)):
            self.bm.faces.new([v[k] for k in f]).material_index = i

    def slab_yz(self, slot, pts, x0, x1):
        """Extrude a closed (y, z) outline along x from x0 to x1."""
        i, n = self._mat(slot), len(pts)
        a = [self.bm.verts.new((x0, y, z)) for y, z in pts]
        b = [self.bm.verts.new((x1, y, z)) for y, z in pts]
        self.bm.faces.new(a).material_index = i
        self.bm.faces.new(b[::-1]).material_index = i
        for k in range(n):
            self.bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])).material_index = i

    def lathe(self, slot, prof, n, cx=0.0, cy=0.0, z0=0.0, rot=0.0):
        """Revolve a (radius, z) profile, bottom to top, with n sides; radius 0 makes an apex."""
        i, rings = self._mat(slot), []
        for r, z in prof:
            if r <= 1e-6:
                rings.append([self.bm.verts.new((cx, cy, z0 + z))])
            else:
                rings.append([self.bm.verts.new((cx + r * math.cos(rot + 2 * math.pi * k / n),
                                                 cy + r * math.sin(rot + 2 * math.pi * k / n), z0 + z)) for k in range(n)])
        for lo, hi in zip(rings, rings[1:]):
            for k in range(n):
                if len(lo) == 1:
                    f = (lo[0], hi[(k + 1) % n], hi[k])
                elif len(hi) == 1:
                    f = (lo[k], lo[(k + 1) % n], hi[0])
                else:
                    f = (lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k])
                self.bm.faces.new(f).material_index = i
        if len(rings[0]) > 1:
            self.bm.faces.new(rings[0][::-1]).material_index = i
        if len(rings[-1]) > 1:
            self.bm.faces.new(rings[-1]).material_index = i

    def prism(self, slot, r, n, z0, z1, cx=0.0, cy=0.0, rot=0.0):
        self.lathe(slot, [(r, 0.0), (r, z1 - z0)], n, cx, cy, z0, rot)


# ---- 2D outlines in the (y, z) wall plane ----
def pointed_arch(a, zs, k=1.6, steps=6):
    """Pointed arch of half-width a springing at zs: right springing point, apex, left springing point."""
    R = k * a
    tmax = math.acos((R - a) / R)
    right = [(a - R + R * math.cos(t), zs + R * math.sin(t)) for t in (tmax * s / steps for s in range(steps + 1))]
    return right + [(-y, z) for y, z in reversed(right[:-1])]


def opening(a, z0, zs, k=1.6):
    return [(a, z0)] + pointed_arch(a, zs, k) + [(-a, z0)]


def horseshoe(r, zs, beta=math.radians(20), steps=12):
    """Horseshoe arch of radius r whose feet stand on zs, from the right foot over the top to the left foot."""
    zc = zs + r * math.sin(beta)
    return [(r * math.cos(t), zc + r * math.sin(t)) for t in (-beta + (math.pi + 2 * beta) * s / steps for s in range(steps + 1))]


def crescent(R, r, off, steps=10):
    """Crescent with horns up: outer circle at the origin minus an inner circle raised by off."""
    yi = (R * R - r * r + off * off) / (2 * off)
    xi = math.sqrt(max(R * R - yi * yi, 1e-9))
    a0, b1, b0 = math.atan2(yi, xi), math.atan2(yi - off, -xi), math.atan2(yi - off, xi)
    a1 = -math.pi - a0
    if b0 < b1:
        b0 += 2 * math.pi
    outer = [(R * math.cos(a0 + (a1 - a0) * s / steps), R * math.sin(a0 + (a1 - a0) * s / steps)) for s in range(steps + 1)]
    inner = [(r * math.cos(b1 + (b0 - b1) * s / steps), off + r * math.sin(b1 + (b0 - b1) * s / steps)) for s in range(1, steps)]
    return outer + inner


def pointed_dome(r, k=1.7, steps=6):
    """(radius, z) profile of a pointed dome of base radius r."""
    Rc = k * r
    tmax = math.acos((Rc - r) / Rc)
    prof = [(r - Rc + Rc * math.cos(t), Rc * math.sin(t)) for t in (tmax * s / steps for s in range(steps + 1))]
    prof[-1] = (0.0, prof[-1][1])
    return prof


def round_dome(r, hz, steps=6):
    prof = [(r * math.cos(math.pi / 2 * s / steps), hz * math.sin(math.pi / 2 * s / steps)) for s in range(steps + 1)]
    prof[-1] = (0.0, hz)
    return prof


# ---- shared wall parts ----
def wall_body(p, slot='wall'):
    p.box(slot, FACE - T, -0.5, 0.0, FACE, 0.5, 1.0)
    p.box('stone', FACE - T - 0.01, -0.5, 0.0, FACE + 0.02, 0.5, 0.12)   # plinth
    p.box('band', FACE, -0.5, 0.30, FACE + 0.015, 0.5, 0.34)               # lower course (ablaq stripe)
    p.box('band', FACE, -0.5, 0.90, FACE + 0.015, 0.5, 0.95)               # string course


def arched_hole(p, a, z0, zs):
    p.slab_yz('trim', opening(a + 0.035, max(0.0, z0 - 0.03), zs), FACE, FACE + 0.02)
    p.slab_yz('dark', opening(a, z0, zs), FACE, FACE + 0.03)


# ---- pieces ----
def piece_wall():
    p = Piece('wall')
    wall_body(p)
    return p


def piece_wall_window():
    p = Piece('wall-window')
    wall_body(p)
    arched_hole(p, 0.13, 0.36, 0.62)
    return p


def piece_wall_door():
    p = Piece('wall-door')
    wall_body(p)
    arched_hole(p, 0.17, 0.0, 0.48)
    return p


def piece_wall_arcade():
    p = Piece('wall-arcade')
    zs, arch = 0.46, horseshoe(0.32, 0.46)
    foot = arch[0][0]
    p.slab_yz('wall', [(0.5, 1.0), (0.5, zs)] + arch + [(-0.5, zs), (-0.5, 1.0)], FACE - T, FACE)
    for y0, y1 in ((-0.5, -foot), (foot, 0.5)):
        p.box('wall', FACE - T, y0, 0.0, FACE, y1, zs)
        p.box('stone', FACE - T - 0.01, y0, 0.0, FACE + 0.02, y1, 0.12)
        p.box('trim', FACE - T - 0.01, y0, zs - 0.04, FACE + 0.02, y1, zs)
    p.box('band', FACE, -0.5, 0.90, FACE + 0.015, 0.5, 0.95)
    return p


def piece_wall_timber():
    p = Piece('wall-timber')
    p.box('wall', FACE - T, -0.5, 0.0, FACE, 0.5, 1.0)
    for y0, y1 in ((-0.5, -0.44), (0.44, 0.5)):
        p.box('trim', FACE, y0, 0.0, FACE + 0.015, y1, 1.0)
    p.box('trim', FACE, -0.5, 0.0, FACE + 0.015, 0.5, 0.06)
    p.box('trim', FACE, -0.5, 0.94, FACE + 0.015, 0.5, 1.0)
    p.slab_yz('trim', [(-0.44, 0.06), (-0.37, 0.06), (-0.16, 0.5), (-0.23, 0.5)], FACE, FACE + 0.015)
    p.slab_yz('trim', [(0.44, 0.06), (0.37, 0.06), (0.16, 0.5), (0.23, 0.5)], FACE, FACE + 0.015)
    p.box('trim', FACE, -0.16, 0.32, FACE + 0.02, 0.16, 0.75)
    p.box('dark', FACE, -0.13, 0.35, FACE + 0.03, 0.13, 0.72)
    return p


def piece_roof_flat():
    p = Piece('roof-flat')
    p.box('stone', -0.5, -0.5, 0.0, 0.5, 0.5, 0.06)
    return p


def piece_roof_hip():
    p = Piece('roof-hip')
    r = 0.62 * math.sqrt(2)
    p.lathe('roof', [(r, 0.0), (r, 0.04), (0.0, 0.45)], 4, rot=math.pi / 4)
    return p


def parapet(p):
    p.box('wall', FACE - 0.08, -0.5, 0.0, FACE, 0.5, 0.10)


def piece_merlon_pointed():
    p = Piece('merlon-pointed')
    parapet(p)
    for y in (-0.375, -0.125, 0.125, 0.375):
        p.lathe('wall', [(0.06 * math.sqrt(2), 0.0), (0.0, 0.13)], 4, cx=FACE - 0.04, cy=y, z0=0.10, rot=math.pi / 4)
    return p


def piece_merlon_stepped():
    p = Piece('merlon-stepped')
    parapet(p)
    for y in (-0.375, -0.125, 0.125, 0.375):
        for w, z0, z1 in ((0.07, 0.10, 0.16), (0.045, 0.16, 0.21), (0.02, 0.21, 0.25)):
            p.box('wall', FACE - 0.08, y - w, z0, FACE, y + w, z1)
    return p


def piece_dome_lead():
    p = Piece('dome-lead')
    p.prism('stone', 0.42, 8, 0.0, 0.20, rot=math.pi / 8)
    p.prism('trim', 0.44, 8, 0.20, 0.23, rot=math.pi / 8)
    p.lathe('dome', round_dome(0.40, 0.34), 16, z0=0.23)
    p.prism('gold', 0.035, 6, 0.57, 0.62)
    return p


def piece_dome_ribbed():
    p = Piece('dome-ribbed')
    p.prism('stone', 0.40, 8, 0.0, 0.28, rot=math.pi / 8)
    p.prism('trim', 0.42, 8, 0.28, 0.31, rot=math.pi / 8)
    prof = pointed_dome(0.38)
    p.lathe('dome', prof, 12, z0=0.31)
    top = 0.31 + prof[-1][1]
    p.prism('gold', 0.03, 6, top, top + 0.06)
    return p


def piece_kumbet():
    p = Piece('kumbet')
    p.prism('stone', 0.40, 8, 0.0, 0.15, rot=math.pi / 8)
    p.prism('wall', 0.36, 8, 0.15, 1.30, rot=math.pi / 8)
    p.prism('accent', 0.365, 8, 1.12, 1.20, rot=math.pi / 8)
    p.prism('trim', 0.39, 8, 1.30, 1.36, rot=math.pi / 8)
    p.lathe('dome', [(0.39, 0.0), (0.0, 0.62)], 8, z0=1.36, rot=math.pi / 8)
    face = 0.36 * math.cos(math.pi / 8)
    p.slab_yz('dark', opening(0.07, 0.45, 0.68), face, face + 0.012)
    return p


def piece_minaret_pencil():
    p = Piece('minaret-pencil')
    p.box('stone', -0.17, -0.17, 0.0, 0.17, 0.17, 0.35)
    p.prism('wall', 0.11, 12, 0.35, 2.0)
    p.lathe('trim', [(0.11, 0.0), (0.17, 0.08)], 12, z0=1.92)
    p.prism('trim', 0.17, 12, 2.0, 2.07)
    p.prism('wall', 0.09, 12, 2.07, 2.55)
    p.lathe('dome', [(0.11, 0.0), (0.0, 0.60)], 12, z0=2.55)
    p.prism('gold', 0.02, 6, 3.15, 3.27)
    return p


def piece_minaret_square():
    p = Piece('minaret-square')
    p.box('stone', -0.18, -0.18, 0.0, 0.18, 0.18, 0.20)
    p.box('wall', -0.15, -0.15, 0.20, 0.15, 0.15, 1.50)
    p.box('band', -0.152, -0.152, 0.75, 0.152, 0.152, 0.80)
    p.box('trim', -0.20, -0.20, 1.50, 0.20, 0.20, 1.56)
    p.prism('wall', 0.13, 8, 1.56, 2.30, rot=math.pi / 8)
    p.prism('trim', 0.17, 8, 2.30, 2.35, rot=math.pi / 8)
    p.prism('stone', 0.09, 12, 2.35, 2.75)
    prof = pointed_dome(0.10)
    p.lathe('dome', prof, 12, z0=2.75)
    top = 2.75 + prof[-1][1]
    p.prism('gold', 0.02, 6, top, top + 0.09)
    return p


def piece_portal():
    p = Piece('portal')
    p.box('stone', 0.30, -0.5, 0.0, 0.62, 0.5, 1.70)
    p.slab_yz('accent', [(0.40, 0.10), (0.40, 1.55), (-0.40, 1.55), (-0.40, 0.10)], 0.62, 0.635)
    p.slab_yz('trim', opening(0.30, 0.10, 0.85), 0.62, 0.645)
    p.slab_yz('dark', opening(0.25, 0.10, 0.85), 0.62, 0.655)
    p.box('trim', 0.28, -0.52, 1.70, 0.64, 0.52, 1.76)
    return p


def piece_bay_cumba():
    p = Piece('bay-cumba')
    for y in (-0.25, 0.0, 0.25):
        p.box('trim', FACE, y - 0.025, -0.12, 0.74, y + 0.025, 0.05)
    p.box('wall', FACE, -0.32, 0.05, 0.78, 0.32, 0.85)
    for y in (-0.32, 0.32):
        p.box('trim', 0.76, y - 0.02, 0.05, 0.79, y + 0.02, 0.85)
    for y0, y1 in ((-0.20, -0.04), (0.04, 0.20)):
        p.box('dark', 0.78, y0, 0.35, 0.79, y1, 0.70)
    p.box('roof', 0.48, -0.38, 0.85, 0.84, 0.38, 0.90)
    return p


def piece_alem():
    p = Piece('alem')
    p.prism('gold', 0.018, 6, 0.0, 0.16)
    p.prism('gold', 0.04, 8, 0.06, 0.10)
    p.slab_yz('gold', [(y, z + 0.235) for y, z in crescent(0.07, 0.06, 0.03)], -0.008, 0.008)
    return p


def piece_malqaf():
    p = Piece('malqaf')
    p.box('wall', -0.12, -0.18, 0.0, 0.12, 0.18, 0.55)
    p.box('trim', -0.14, -0.20, 0.55, 0.14, 0.20, 0.60)
    p.box('dark', 0.12, -0.10, 0.30, 0.13, 0.10, 0.50)
    return p


def piece_mashrabiya():
    p = Piece('mashrabiya')
    p.box('trim', FACE, -0.20, 0.12, 0.60, 0.20, 0.20)
    p.box('trim', FACE, -0.25, 0.20, 0.68, 0.25, 0.80)
    for row in range(4):
        for col in range(3):
            y, z = -0.15 + col * 0.15, 0.29 + row * 0.14
            p.box('dark', 0.68, y - 0.035, z - 0.035, 0.69, y + 0.035, z + 0.035)
    p.box('trim', 0.48, -0.28, 0.80, 0.72, 0.28, 0.84)
    return p


PIECES = {
    'wall': piece_wall, 'wall-window': piece_wall_window, 'wall-door': piece_wall_door,
    'wall-arcade': piece_wall_arcade, 'wall-timber': piece_wall_timber,
    'roof-flat': piece_roof_flat, 'roof-hip': piece_roof_hip,
    'merlon-pointed': piece_merlon_pointed, 'merlon-stepped': piece_merlon_stepped,
    'dome-lead': piece_dome_lead, 'dome-ribbed': piece_dome_ribbed, 'kumbet': piece_kumbet,
    'minaret-pencil': piece_minaret_pencil, 'minaret-square': piece_minaret_square,
    'portal': piece_portal, 'bay-cumba': piece_bay_cumba, 'alem': piece_alem,
    'malqaf': piece_malqaf, 'mashrabiya': piece_mashrabiya,
}


def build_object(p):
    bmesh.ops.recalc_face_normals(p.bm, faces=p.bm.faces)
    mesh = bpy.data.meshes.new(p.name)
    p.bm.to_mesh(mesh)
    p.bm.free()
    for s in p.slots:
        mesh.materials.append(material(s))
    return bpy.data.objects.new(p.name, mesh)


def export(p, out_dir):
    obj = build_object(p)
    bpy.context.scene.collection.objects.link(obj)
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, p.name + '.glb'), export_format='GLB',
                              use_selection=True, export_yup=True)
    mesh = obj.data
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(mesh)


def preview(names, spacing=1.6):
    """Build pieces side by side in a 'kit-preview' collection of the open scene, without exporting."""
    col = bpy.data.collections.get('kit-preview') or bpy.data.collections.new('kit-preview')
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o)
    for i, n in enumerate(names):
        obj = build_object(PIECES[n]())
        obj.location.x = i * spacing
        col.objects.link(obj)
    return col


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(here, '..', '..', '..', 'assets', 'original', 'islamic')
    names = argv[1].split(',') if len(argv) > 1 else list(PIECES)
    unknown = [n for n in names if n not in PIECES]
    if unknown:
        raise SystemExit('unknown pieces: ' + ', '.join(unknown))
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for n in names:
        export(PIECES[n](), out_dir)
        print('wrote ' + n)


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: Write the runner** `tools/art/blender/run-kit.mjs`

```js
#!/usr/bin/env node
// Builds the original Islamic parts kit with Blender, headless:
//   node tools/art/blender/run-kit.mjs                  -> every piece into assets/original/islamic/
//   node tools/art/blender/run-kit.mjs wall,dome-lead   -> only those pieces
// Blender comes from $BLENDER, else D:\Blender\blender.exe, else `blender` on PATH. The GLBs are committed,
// so only changes to the kit need Blender; npm run art:bake does not.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const script = path.join(root, 'tools/art/blender/islamic_kit.py');
const outDir = path.join(root, 'assets/original/islamic');
const blender = process.env.BLENDER || (fs.existsSync('D:/Blender/blender.exe') ? 'D:/Blender/blender.exe' : 'blender');
const args = ['-b', '--factory-startup', '--python-exit-code', '1', '--python', script, '--', outDir, ...process.argv.slice(2, 3)];
const r = spawnSync(blender, args, { encoding: 'utf8', maxBuffer: 16e6 });
if (r.error) { console.error(`could not run Blender (${blender}): ${r.error.message}. Set BLENDER to the blender executable.`); process.exit(1); }
const out = (r.stdout || '') + (r.stderr || '');
for (const line of out.split(/\r?\n/)) if (/^wrote /.test(line)) console.log(line);
if (r.status !== 0 || /Traceback/.test(out)) { console.error(out); process.exit(1); }
```

  Then in `package.json` `scripts`, after `"art:actors": "node tools/art/bake-actors.mjs",`, add:

```json
    "art:kit": "node tools/art/blender/run-kit.mjs",
```

- [ ] **Step 5: Export the kit**

  Run: `npm run art:kit`

  Expected: 19 lines, from `wrote wall` to `wrote mashrabiya`. `assets/original/islamic/` now holds 19 `.glb` files.

- [ ] **Step 6: Run the test to verify it passes**

  Run: `node tests/islamic-art.test.js`

  Expected: `3 passed, 0 failed`.

- [ ] **Step 7: Look at the pieces in the live Blender**

  Requirements:
  - Blender is open with the MCP add-on running (N panel → **MCP for Blender** → **Start MCP Server**).
  - Do not wipe the user's scene. `preview()` only replaces its own `kit-preview` collection.

  With `mcp__blender__execute_blender_code`:

```python
import runpy
ns = runpy.run_path(r"G:\GitHub\age-of-realms-mod\tools\art\blender\islamic_kit.py", run_name="kit")
ns['preview'](['wall-window', 'wall-door', 'wall-arcade', 'wall-timber', 'portal', 'bay-cumba', 'mashrabiya', 'merlon-stepped', 'merlon-pointed', 'dome-lead', 'dome-ribbed', 'kumbet', 'minaret-pencil', 'minaret-square', 'malqaf', 'alem', 'roof-hip'], spacing=1.5)
```

  Then call `mcp__blender__look` with `mode: "angles"`, `views: [[0.61, 0.61, 0.5]]` (the bake's 45°/30° view), `shading: "material"` and `target` set to the piece names.

  Check that:
  - every piece is intact (no missing faces, no inverted dark patches)
  - arches are pointed or horseshoe-shaped as named
  - minarets stand upright

  Fix any defect in `islamic_kit.py`, then re-run Step 5 and Step 6.

  Remove the preview afterwards:

```python
import bpy
col = bpy.data.collections.get('kit-preview')
if col:
    meshes = [o.data for o in col.objects]
    for o in list(col.objects): bpy.data.objects.remove(o)
    bpy.data.collections.remove(col)
    for m in meshes:
        if m.users == 0: bpy.data.meshes.remove(m)
```

- [ ] **Step 8: Write** `assets/original/islamic/README.md`

```markdown
# Original Islamic building kit

Modular architecture pieces for the Turks and Saracens buildings:
- pointed and horseshoe arches
- flat and hipped roofs
- pointed and stepped merlons
- Ottoman lead domes and Mamluk ribbed domes
- a Seljuk kümbet
- pencil and square minarets
- a tiled portal
- cumba and mashrabiya bays
- a windcatcher (malqaf)
- a crescent finial (alem)

**Source:** every piece is generated by `tools/art/blender/islamic_kit.py`, with no imported meshes and no AI generation. Rebuild with `npm run art:kit` (Blender 5.2.2). Set `BLENDER` if Blender is not at `D:\Blender\blender.exe`.

**Licence:** original work for this project, dedicated to the public domain under Creative Commons Zero 1.0 Universal (CC0-1.0), like the project's other original recipes (`tools/art/ACTOR_LICENSE.txt`). https://creativecommons.org/publicdomain/zero/1.0/

**Conventions:**
- Pieces are 1×1 tile cells centred on the origin; one storey = 1 unit.
- Wall pieces sit on the cell's +x edge and face +x.
- glTF is Y-up.
- Materials are named after colour slots: `wall`, `stone`, `trim`, `roof`, `dome`, `accent`, `band`, `gold`, `dark`. They are metallic 0 and roughness 1 to match the Kenney kits.
- `tools/art/kenney-bake.html` recolours every slot per civilization and age from `tools/art/islamic-recipes.js`.
```

- [ ] **Step 9: Add the test to the quick set and commit**

  In `tests/run-all.js` line 3, add `'islamic-art.test.js', ` after `'art-bake-io.test.js', `.

  ```bash
  npm run test:quick
  git add tools/art/blender assets/original/islamic tests/islamic-art.test.js tests/run-all.js package.json
  git commit -F - <<'EOF'
  feat(art): add Blender-scripted Islamic architecture parts kit

  19 original CC0 pieces (pointed/horseshoe arches, merlons, Ottoman and
  Mamluk domes, kumbet, minarets, portal, cumba, mashrabiya, malqaf, alem)
  exported as GLB by tools/art/blender/islamic_kit.py (npm run art:kit).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  EOF
  ```

  Expected: `Total: 187 checks passed; 0 suites failed.`

---

### Task 3: Bake integration and the hero recipe

**Files:**
- Create: `tools/art/islamic-recipes.js`
- Modify: `tools/art/kenney-recipes.js` (import at top; one line at the end)
- Modify: `tools/art/kenney-bake.html:20` (import), `:26` (`KITS`), `:112` (recolour branch in `k.add`)
- Modify: `tests/islamic-art.test.js` (recipe and palette tests)

**Interfaces:**
- Consumes: the kit pieces and `TOP` heights from Task 2.
- Produces, used by Tasks 4, 6 and 7:
  - Exports: `PALETTES`, `FIXED`, `SHADE`, `TOP`, `islamicSlots(civ, age)`, `ISLAMIC_RECIPES`
  - Recipe shape: `{ civ, size, styles, scale, sq, build(k) }`
  - Helpers inside the file: `ring(k, x0, y0, w, d, z, feats, base)`, `roof(k, x0, y0, w, d, z, edge)`, `crown(k, piece, x, y, z, s, alem)`, `portico(k, x0, y0, w, domes, edge)`

- [ ] **Step 1: Extend the test with recipe and palette checks**

  In `tests/islamic-art.test.js`, insert after the `bounds()` function:

```js
const R = vm.runInNewContext(fs.readFileSync(path.join(root, 'tools/art/islamic-recipes.js'), 'utf8').replace(/^export /gm, '') +
  ';({ PALETTES, TOP, ISLAMIC_RECIPES, islamicSlots })');
function placements() {   // every k.add(kit, name) made by every recipe at every style it bakes
  const out = [];
  for (const [recipe, r] of Object.entries(R.ISLAMIC_RECIPES)) for (const style of r.styles) {
    r.build({ style, add: (kit, name) => out.push({ recipe, style, kit, name }) });
  }
  return out;
}
```

  Then insert before the final `console.log`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

  Run: `node tests/islamic-art.test.js`

  Expected: the process crashes with `ENOENT ... tools\art\islamic-recipes.js`.

- [ ] **Step 3: Write** `tools/art/islamic-recipes.js`

  For now it holds only the hero recipe: `tc_turks` with `styles: [2]`.

```js
// Turks and Saracens building recipes, assembled from the original parts kit in assets/original/islamic/
// (built by tools/art/blender/islamic_kit.py). Same coordinates as kenney-recipes.js: game tiles x, y and
// height z in storeys; the camera sees the east (+x) and south (+y) faces. kenney-recipes.js merges these
// into RECIPES, so this file must not import anything (tests/islamic-art.test.js also loads it in a vm).

// Per-age colours copied from CIV_ARCH in game/js/civ_art.js, ages 0-3. tests/islamic-art.test.js keeps them in sync.
export const PALETTES = {
  turks: [
    { wall: '#a88254', roof: '#3a7880', trim: '#684828', stone: '#b09878', accent: '#289098', dome: '#3a7880' },
    { wall: '#d6be98', roof: '#2e7c88', trim: '#6e5030', stone: '#c2ac8c', accent: '#2494a0', dome: '#2e8490' },
    { wall: '#ded4c2', roof: '#526270', trim: '#288290', stone: '#ccc2b0', accent: '#c83028', dome: '#586878' },
    { wall: '#eae2d2', roof: '#465666', trim: '#228898', stone: '#dad2c0', accent: '#e2b038', dome: '#4a5c6e' },
  ],
  saracens: [
    { wall: '#b88c58', roof: '#d4b068', trim: '#78522c', stone: '#bca07c', accent: '#1e824c', dome: '#c8a058' },
    { wall: '#dfc496', roof: '#c89e54', trim: '#7c5630', stone: '#ceb28a', accent: '#1e824c', dome: '#2e8b78' },
    { wall: '#e8d0a6', roof: '#28887a', trim: '#8c6438', stone: '#dcc29a', accent: '#d8a830', dome: '#289484' },
    { wall: '#f2deb8', roof: '#1e7c72', trim: '#c89830', stone: '#e8d0aa', accent: '#e8b838', dome: '#d8a830' },
  ],
};
export const FIXED = { gold: '#e8c040', dark: '#2a2420' };
// One multiplier on every slot colour. The civ palettes were tuned for flat 2D art; tune once at review point 1.
export const SHADE = 1.0;
// Height of each crowning piece at scale 1, so a finial can sit on top. tests/islamic-art.test.js checks these against the GLBs.
export const TOP = { 'dome-lead': 0.62, 'dome-ribbed': 0.959, 'kumbet': 1.98, 'minaret-pencil': 3.27, 'minaret-square': 2.995, 'portal': 1.76 };

const shade = (hex, f) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)).toString(16).padStart(2, '0')).join('');

// Colour of every kit material slot for one civ at one age. The band slot draws the striped (ablaq) courses:
// trim-coloured for Saracens from age 2, wall-coloured (a plain ledge) otherwise.
export function islamicSlots(civ, age) {
  const P = PALETTES[civ][Math.min(3, Math.max(0, age))];
  const band = civ === 'saracens' && age >= 2 ? P.trim : P.wall;
  const out = { wall: P.wall, stone: P.stone, trim: P.trim, roof: P.roof, dome: P.dome, accent: P.accent, band, ...FIXED };
  for (const k of Object.keys(out)) out[k] = shade(out[k], SHADE);
  return out;
}

const I = 'islamic';
const ROT = { e: 0, s: -90, w: 180, n: 90 };
const CYPRESS = { color: '#2f5a3a' };

// ring of wall pieces around a w x d block of cells from tile (x0, y0); feats: { s0: 'wall-door', e1: 'wall-window' }
function ring(k, x0, y0, w, d, z = 0, feats = {}, base = 'wall') {
  const pick = (side, i) => feats[side + i] || base;
  for (let i = 0; i < w; i++) { k.add(I, pick('n', i), x0 + i + 0.5, y0 + 0.5, z, ROT.n); k.add(I, pick('s', i), x0 + i + 0.5, y0 + d - 0.5, z, ROT.s); }
  for (let j = 0; j < d; j++) { k.add(I, pick('w', j), x0 + 0.5, y0 + j + 0.5, z, ROT.w); k.add(I, pick('e', j), x0 + w - 0.5, y0 + j + 0.5, z, ROT.e); }
}
// flat roof over the block, optionally edged with a parapet piece along every outer cell edge
function roof(k, x0, y0, w, d, z, edge = null) {
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) k.add(I, 'roof-flat', x0 + i + 0.5, y0 + j + 0.5, z);
  if (edge) ring(k, x0, y0, w, d, z + 0.06, {}, edge);
}
// a crowning piece standing at (x, y, z), optionally topped by the crescent finial
function crown(k, piece, x, y, z, s = 1, alem = false) {
  k.add(I, piece, x, y, z, 0, s);
  if (alem) k.add(I, 'alem', x, y, z + TOP[piece] * s, 0, Math.max(1, s * 0.8));
}
// arcaded portico along the south side of a 1-cell-deep row, roofed at storey 1
function portico(k, x0, y0, w, domes, edge = null) {
  for (let i = 0; i < w; i++) k.add(I, 'wall-arcade', x0 + i + 0.5, y0 + 0.5, 0, ROT.s);
  k.add(I, 'wall-arcade', x0 + w - 0.5, y0 + 0.5, 0, ROT.e);
  k.add(I, 'wall-arcade', x0 + 0.5, y0 + 0.5, 0, ROT.w);
  roof(k, x0, y0, w, 1, 1, edge);
  if (domes) for (let i = 0; i < w; i++) crown(k, domes, x0 + i + 0.5, y0 + 0.5, 1.06, 0.55);
}

export const ISLAMIC_RECIPES = {
  tc_turks: { civ: 'turks', size: 4, styles: [2], scale: 1.06, sq: 1.02, build(k) {
    if (k.style <= 1) {
      // Seljuk caravanserai: walled stone court behind a tall tiled portal, with a kümbet tower
      ring(k, 0.5, 0.5, 3, 3, 0, { e0: 'wall-window', e2: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
      roof(k, 0.5, 0.5, 3, 3, 1, 'merlon-pointed');
      k.add(I, 'portal', 2, 3, 0, ROT.s);
      crown(k, 'kumbet', 1, 1, 1.06, 0.9);
      if (k.style === 1) crown(k, 'dome-lead', 2.4, 1.6, 1.06, 1.1);
      k.add('nature', 'tent_detailedOpen', 3.7, 3.7, 0, -30, 0.5);
    } else {
      // Ottoman Divan: two-storey hall behind a domed portico, stepped domes up to a central dome with an alem
      ring(k, 0.5, 0.5, 3, 2, 0, { s0: 'wall-window', s1: 'wall-door', s2: 'wall-window', e0: 'wall-window', e1: 'wall-door' });
      ring(k, 0.5, 0.5, 3, 2, 1, { s0: 'wall-window', s1: 'wall-window', s2: 'wall-window', e0: 'wall-window', e1: 'wall-window' });
      roof(k, 0.5, 0.5, 3, 2, 2);
      crown(k, 'dome-lead', 2, 1.5, 2.06, k.style === 3 ? 2.0 : 1.8, true);
      for (const x of [0.95, 3.05]) crown(k, 'dome-lead', x, 1.5, 2.06, 0.8);
      portico(k, 0.5, 2.5, 3, 'dome-lead');
      k.add('town', 'fountain-round', 0.3, 3.75, 0, 0, 0.3);
      if (k.style === 3) k.add('nature', 'tree_cone', 3.75, 3.75, 0, 0, 0.9, CYPRESS);
    }
    k.add('nature', 'tree_cone', 3.75, 0.35, 0, 0, 0.9, CYPRESS);
  } },
};
```

- [ ] **Step 4: Run the test to verify it passes**

  Run: `node tests/islamic-art.test.js`

  Expected: `8 passed, 0 failed`.

- [ ] **Step 5: Merge the recipes into `RECIPES`**

  In `tools/art/kenney-recipes.js`, add as the very first line of the file, above the header comment (ES module imports must come before other code):

```js
import { ISLAMIC_RECIPES } from './islamic-recipes.js';
```

  Append at the end of the file:

```js

// Turks and Saracens buildings from the original Islamic kit (assets/original/islamic/)
Object.assign(RECIPES, ISLAMIC_RECIPES);
```

- [ ] **Step 6: Teach the bake page the kit**

  In `tools/art/kenney-bake.html`, after line 20 (`import { RECIPES, STYLES } from './kenney-recipes.js';`), add:

```js
import { islamicSlots } from './islamic-recipes.js';
```

  Replace line 26:

```js
const KITS = { town: '/assets/thirdparty/kenney/fantasy-town-kit/', castle: '/assets/thirdparty/kenney/castle-kit/', nature: '/assets/thirdparty/kenney/nature-kit/' };
```

  with:

```js
const KITS = { town: '/assets/thirdparty/kenney/fantasy-town-kit/', castle: '/assets/thirdparty/kenney/castle-kit/', nature: '/assets/thirdparty/kenney/nature-kit/', islamic: '/assets/original/islamic/' };
```

  In `assemble()`, directly after the line that starts `if (kit === 'town' || kit === 'castle') {`, add:

```js
        // original kit pieces carry named colour slots; colour them from the recipe civ's palette for this age
        if (kit === 'islamic') { const slots = islamicSlots(recipe.civ, styleIdx); m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.map = null; o.material.color = new THREE.Color(slots[o.material.name] || '#ff00ff'); o.material.roughness = 1; o.material.metalness = 0; } }); }
```

  An unknown slot renders magenta, so it can't go unnoticed.

- [ ] **Step 7: Render a preview to prove the wiring**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --preview tc_turks
  ```

  Expected:
  - The console prints `wrote tools/art/preview.png`.
  - There are no `[page error]` lines and no `404` warnings for `/assets/original/islamic/`.

  Open `tools/art/preview.png` with the Read tool. It must show one Ottoman Town Center with no magenta.

- [ ] **Step 8: Commit**

  ```bash
  npm run test:quick
  git add tools/art/islamic-recipes.js tools/art/kenney-recipes.js tools/art/kenney-bake.html tests/islamic-art.test.js
  git commit -F - <<'EOF'
  feat(art): bake recipes from the Islamic kit with per-civ slot colours

  Adds islamic-recipes.js (palettes from civ_art.js, slot colouring,
  ring/roof/crown/portico helpers) with the Ottoman Town Center as the
  hero recipe, and an islamic kit in the bake page.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  EOF
  ```

---

### Task 4: Review point 1 — the hero Town Center (user gate)

**Files:**
- Modify (tuning only): `tools/art/islamic-recipes.js` (`SHADE`, and the `tc_turks` build if needed); possibly `tools/art/blender/islamic_kit.py` and the regenerated GLBs.
- Create (generated): `game/art/kenney/tc_turks_2.png`
- Modify (generated): `game/art/kenney/manifest.js`
- Modify: `tests/islamic-art.test.js` (manifest test)

**Interfaces:**
- Produces: `tc_turks_2` in `KENNEY_ART` and on disk. Task 5's browser tests use it.

- [ ] **Step 1: Load the create-game-assets skill**

  Use the Skill tool, `create-game-assets`. Apply its contact-sheet QA:
  - silhouette at game scale
  - value contrast against neighbours
  - palette consistency
  - outline and edge treatment

- [ ] **Step 2: Render the comparison sheet**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --preview tc_turks,tc,house,barracks
  ```

  Open `tools/art/preview.png` with the Read tool. The sheet shows `tc_turks_2` beside Kenney `tc_0..3`, `house_0..3` and `barracks_0..3` at 1× logical size.

- [ ] **Step 3: Tune before showing**

  Fix what the QA finds. Typical fixes:
  - **Walls washed out** next to Kenney: lower `SHADE` in steps of 0.05 (try 0.9).
  - **Dome too small or large** against the TC tier: change the main `crown(... 'dome-lead' ...)` scale.
  - **Too tall**: the hall plus dome should land between `tc_2`'s height and 1.3× of it.

  Re-run Step 2 after each change. If a piece itself must change, edit `islamic_kit.py` and run `npm run art:kit` and `node tests/islamic-art.test.js` again.

- [ ] **Step 4: STOP and ask the user to approve the hero**

  Show the user `tools/art/preview.png` (its path) and describe what it shows. Ask:

  > Does the Ottoman Town Center fit next to the Kenney buildings? Approve, or say what to change.

  Iterate Steps 3–4 until they approve. Do not continue without approval.

- [ ] **Step 5: Write the manifest test**

  In `tests/islamic-art.test.js`, insert before the final `console.log`:

```js
test('every recipe style is baked into the manifest with its PNG', () => {
  const art = vm.runInNewContext(fs.readFileSync(path.join(root, 'game/art/kenney/manifest.js'), 'utf8') + ';KENNEY_ART');
  for (const [name, r] of Object.entries(R.ISLAMIC_RECIPES)) for (const s of r.styles) {
    const key = name + '_' + s;
    assert.ok(art[key], key + ' missing from manifest.js');
    assert.ok(fs.existsSync(path.join(root, 'game/art/kenney', key + '.png')), key + '.png missing');
  }
});
```

- [ ] **Step 6: Run it to verify it fails**

  Run: `node tests/islamic-art.test.js`

  Expected: `FAIL every recipe style is baked into the manifest with its PNG` with `tc_turks_2 missing from manifest.js`.

- [ ] **Step 7: Bake the hero for real**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --only tc_turks
  git status --short game/art/kenney
  git diff --stat game/art/kenney/manifest.js
  ```

  Expected:
  - The bake prints `baked 1 sprites into game/art/kenney (merged: manifest has 110)`.
  - `git status` shows exactly `M game/art/kenney/manifest.js` and `?? game/art/kenney/tc_turks_2.png`.
  - The manifest diff adds 1 entry.

- [ ] **Step 8: Run the tests and commit**

  Run `npm run test:quick`. Expected: all suites pass, and `islamic-art.test.js` reports `9 passed, 0 failed`.

  ```bash
  git add game/art/kenney/tc_turks_2.png game/art/kenney/manifest.js tests/islamic-art.test.js tools/art/islamic-recipes.js tools/art/blender assets/original/islamic
  git commit -F - <<'EOF'
  feat(art): bake the Ottoman Town Center (tc_turks_2) from the Islamic kit

  Approved at review point 1.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  EOF
  ```

---

### Task 5: Game uses civ sprites

**Files:**
- Modify: `game/js/art_kenney.js:35-39` (add `civKartKey` after `kartKey`)
- Modify: `game/js/civ_art.js:337` (overlay signature), `:345-346` (crown guard), `:840-846` (lookup), `:866` (overlay call)
- Modify: `tests/browser/art.spec.js:68` (computed count), plus two new tests

**Interfaces:**
- Consumes: `tc_turks_2` (Task 4); the existing `kartKey`, `KART`, `bldSprite(type, st, pc, civ)` and `vicDome`.
- Produces:
  - `civKartKey(type, civ, st) → string | null`
  - `drawCivBuildingOverlay(g, type, st, pc, civ, isKenney, opts = {})`, where `opts.crown === false` skips section 1
  - Rule: a civ sprite is used only when its age suffix ≥ the age of the shared sprite `kartKey(type, st)` would pick. This keeps `tc_4`/`tc_5`.

- [ ] **Step 1: Write the failing browser tests**

  In `tests/browser/art.spec.js`, replace line 68:

```js
  expect(await page.evaluate(() => KART.failed.length)).toBe(7);
```

  with:

```js
  expect(await page.evaluate(() => KART.failed.length)).toBe(await page.evaluate(() => Object.keys(KENNEY_ART).filter(k => /^(tc|farm)_/.test(k)).length));
```

  Append at the end of the file:

```js
// Renders one building sprite from scratch and reports which baked sprite it used and how many painted domes it drew.
const drawProbe = () => {
  window.drawProbe = (type, st, civ) => {
    const real = vicDome; let domes = 0;
    vicDome = (...a) => { domes++; return real(...a); };
    try {
      KART.cache.clear();
      bldSprite(type, st, W.players[1].color, civ);
      return { names: [...KART.cache.keys()].map(k => k.split('|')[0]), domes };
    } finally { vicDome = real; KART.cache.clear(); }
  };
};

test('Turks and Saracens use their own building sprites without the painted crown', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(drawProbe);
  const r = await page.evaluate(() => ({
    turks2: drawProbe('tc', 2, 'turks'),
    turks5: drawProbe('tc', 5, 'turks'),
    franks2: drawProbe('tc', 2, 'franks'),
    turksMonastery1: drawProbe('monastery', 1, 'turks'),
  }));
  expect(r.turks2).toEqual({ names: ['tc_turks_2'], domes: 0 });
  expect(r.turks5.names).toEqual(['tc_5']);   // the dedicated Future Town Center outranks the medieval civ sprite
  expect(r.franks2.names).toEqual(['tc_2']);
  expect(r.turksMonastery1.names).toEqual(['monastery_1']);
  expect(r.turksMonastery1.domes).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a missing civ sprite falls back to the shared sprite and its painted crown', async ({ page }) => {
  await page.route('**/art/kenney/tc_turks_*.png', route => route.abort());
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(drawProbe);
  const r = await page.evaluate(() => drawProbe('tc', 2, 'turks'));
  expect(r.names).toEqual(['tc_2']);
  expect(r.domes).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run them to verify they fail**

  Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/art.spec.js --reporter=line`

  Expected:
  - `own building sprites` FAILS: `turks2.names` is `['tc_2']` instead of `['tc_turks_2']`.
  - The fallback test passes, since today's behaviour already is the fallback.
  - `missing sprites` passes with the computed count.

- [ ] **Step 3: Add `civKartKey`**

  In `game/js/art_kenney.js`, directly after the `kartKey` function (after line 39), add:

```js
// a civilization's own building sprite (house_turks_2): exact age, else the nearest lower age it was baked for
function civKartKey(type, civ, st) {
  for (let s = st; s >= 0; s--) if (KART.img[type + '_' + civ + '_' + s]) return type + '_' + civ + '_' + s;
  return null;
}
```

- [ ] **Step 4: Let the overlay skip its crown**

  In `game/js/civ_art.js`, replace:

```js
function drawCivBuildingOverlay(g, type, st, pc, civ, isKenney) {
```

  with:

```js
function drawCivBuildingOverlay(g, type, st, pc, civ, isKenney, opts = {}) {
```

  Replace:

```js
  // 1. Civilization-specific roof & crown ornament on major & civic buildings
  if (st >= 1 && !BUILDINGS[type]?.wall && type !== 'palisade' && type !== 'outpost') {
```

  with:

```js
  // 1. Civilization-specific roof & crown ornament on major & civic buildings (civ sprites model their own; opts.crown = false)
  if (opts.crown !== false && st >= 1 && !BUILDINGS[type]?.wall && type !== 'palisade' && type !== 'outpost') {
```

- [ ] **Step 5: Prefer civ sprites in the wrapped `bldSprite`**

  In `game/js/civ_art.js` section D, replace:

```js
        if (!name) name = kartKey(type, st);
```

  with:

```js
        // per-civilization building sets (e.g. house_turks_2) replace the shared sprite unless the shared one is
        // newer, so the dedicated Modern/Future Town Centers (tc_4, tc_5) still win over tc_turks_3
        const shared = kartKey(type, st), own = !name && civKartKey(type, civ, st);
        const ageOf = k => { const n = +k.slice(k.lastIndexOf('_') + 1); return Number.isFinite(n) ? n : -1; };
        const civSet = own && (!shared || ageOf(own) >= ageOf(shared)) ? own : null;
        if (civSet) name = civSet;
        if (!name) name = kartKey(type, st);
```

  How the rule resolves:

  | Lookup | Picks | Why |
  |---|---|---|
  | `house`, Turks, age 5 | `house_turks_3` | civ age 3 = shared `house_3` age 3 |
  | `tc`, Turks, age 2 | `tc_turks_2` | tie; the civ sprite wins |
  | `tc`, Turks, age 5 | `tc_5` | shared age 5 > civ age 3 |
  | `monastery`, Turks, age 1 | `monastery_1` | no civ sprite at or below age 1 |

  Then replace:

```js
              drawCivBuildingOverlay(g, type, st, pc, civ, true);
```

  with:

```js
              drawCivBuildingOverlay(g, type, st, pc, civ, true, civSet ? { crown: false } : undefined);
```

- [ ] **Step 6: Run the browser tests to verify they pass**

  Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/art.spec.js --reporter=line`

  Expected: all 6 tests pass.

- [ ] **Step 7: Run the syntax and quick suites, then commit**

  ```bash
  npm run test:syntax && npm run test:quick
  git add game/js/art_kenney.js game/js/civ_art.js tests/browser/art.spec.js
  git commit -F - <<'EOF'
  feat(game): draw per-civ building sprites when baked

  bldSprite prefers <type>_<civ>_<age> (nearest lower age) and skips the
  painted dome/minaret overlay for them; missing sprites fall back to the
  shared Kenney sprite. The missing-sprite test now counts tc_/farm_ keys.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  EOF
  ```

---

### Task 6: The Turks set

**Files:**
- Modify: `tools/art/islamic-recipes.js` (`tc_turks` styles; add `house_turks` and `monastery_turks`)
- Create (generated): `game/art/kenney/{house_turks_0..3, tc_turks_0, tc_turks_1, tc_turks_3, monastery_turks_2, monastery_turks_3}.png`
- Modify (generated): `game/art/kenney/manifest.js`

**Interfaces:**
- Consumes: the helpers and `TOP` from Task 3, and the kit from Task 2.
- Produces: 10 Turks sprites in total.

- [ ] **Step 1: Add the recipes**

  In `tools/art/islamic-recipes.js`:
  - In `tc_turks`, change `styles: [2]` to `styles: [0, 1, 2, 3]`.
  - In `ISLAMIC_RECIPES`, insert before `tc_turks`:

```js
  house_turks: { civ: 'turks', size: 2, styles: [0, 1, 2, 3], scale: 0.72, sq: 0.80, build(k) {
    ring(k, 0.1, 0.1, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e1: 'wall-window' });
    if (k.style <= 1) {
      // Seljuk stone dwelling with a flat roof; a roof room from age 1
      roof(k, 0.1, 0.1, 2, 2, 1);
      if (k.style === 1) { ring(k, 0.1, 0.1, 1, 1, 1.06, { s0: 'wall-window', e0: 'wall-window' }); roof(k, 0.1, 0.1, 1, 1, 2.06); }
    } else {
      // Ottoman konak: timber-framed upper floor, projecting cumba bay, wide hipped roof
      ring(k, 0.1, 0.1, 2, 2, 1, {}, 'wall-timber');
      k.add(I, 'bay-cumba', 1.1, 1.6, 1, ROT.s);
      if (k.style === 3) k.add(I, 'bay-cumba', 1.6, 1.1, 1, ROT.e);
      k.add(I, 'roof-hip', 1.1, 1.1, 2, 0, [2, 1, 2]);
    }
    k.add('nature', 'tree_cone', 2.3, 0.35, 0, 0, 0.8, CYPRESS);
  } },
```

  - Insert after the `tc_turks` entry:

```js
  monastery_turks: { civ: 'turks', size: 3, styles: [2, 3], scale: 1.02, sq: 1.02, build(k) {
    if (k.style === 2) {
      // Seljuk Gök Medrese: stone court, tiled portal flanked by twin minarets, domed hall
      ring(k, 0, 0, 3, 3, 0, { e0: 'wall-window', e1: 'wall-window', e2: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
      roof(k, 0, 0, 3, 3, 1, 'merlon-pointed');
      k.add(I, 'portal', 1.5, 2.5, 0, ROT.s);
      for (const x of [1.1, 1.9]) crown(k, 'minaret-pencil', x, 2.97, TOP.portal, 0.55);
      crown(k, 'dome-lead', 1.5, 1.1, 1.06, 1.3, true);
    } else {
      // Ottoman mosque: prayer hall under a great dome with corner domes, domed portico, pencil minaret
      ring(k, 0.5, 0, 2, 2, 0, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s1: 'wall-window' });
      ring(k, 0.5, 0, 2, 2, 1, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s1: 'wall-window' });
      roof(k, 0.5, 0, 2, 2, 2);
      crown(k, 'dome-lead', 1.5, 1, 2.06, 1.9, true);
      for (const [x, y] of [[0.95, 0.45], [2.05, 0.45], [0.95, 1.55], [2.05, 1.55]]) crown(k, 'dome-lead', x, y, 2.06, 0.6);
      portico(k, 0.5, 2, 2, 'dome-lead');
      crown(k, 'minaret-pencil', 2.75, 0.25, 0, 1.15);
    }
  } },
```

- [ ] **Step 2: Run the test to verify it fails on the unbaked keys**

  Run: `node tests/islamic-art.test.js`

  Expected: only `every recipe style is baked into the manifest with its PNG` fails, with `house_turks_0 missing from manifest.js`. Every other test passes, which proves the new recipes only use existing pieces and props.

- [ ] **Step 3: Self-check the look**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --preview house_turks,house,tc_turks,tc,monastery_turks,monastery
  ```

  Open `tools/art/preview.png`. Check that:
  - every Turks sprite sits inside its footprint like its Kenney neighbour
  - no pieces float or overlap
  - Seljuk ages (0–1) read as stone and turquoise cones; Ottoman ages (2–3) as lead domes and minarets

  Fix the recipe coordinates or scales where needed and re-render. This is a self-check, not a user gate.

- [ ] **Step 4: Bake**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --only house_turks,tc_turks,monastery_turks
  git status --short game/art/kenney
  ```

  Expected:
  - The bake prints `baked 10 sprites ... (merged: manifest has 119)`.
  - `git status` lists `manifest.js`, 9 new `*_turks_*` PNGs, and possibly `tc_turks_2.png` if its bytes changed.

- [ ] **Step 5: Run the tests and commit**

  Run `npm run test:quick`. Expected: all pass.

  ```bash
  git add tools/art/islamic-recipes.js game/art/kenney
  git commit -F - <<'EOF'
  feat(art): Turks houses, Town Centers and mosques (Seljuk to Ottoman)

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  EOF
  ```

---

### Task 7: The Saracens set

**Files:**
- Modify: `tools/art/islamic-recipes.js` (add `house_saracens`, `tc_saracens`, `monastery_saracens`)
- Create (generated): `game/art/kenney/{house_saracens_0..3, tc_saracens_0..3, monastery_saracens_2, monastery_saracens_3}.png`
- Modify (generated): `game/art/kenney/manifest.js`

**Interfaces:**
- Consumes: the helpers, `TOP` and `islamicSlots` (the ablaq band for age ≥ 2) from Task 3.
- Produces: 10 Saracens sprites.

- [ ] **Step 1: Add the recipes**

  In `tools/art/islamic-recipes.js`, append these three entries at the end of `ISLAMIC_RECIPES`, after `monastery_turks`:

```js
  house_saracens: { civ: 'saracens', size: 2, styles: [0, 1, 2, 3], scale: 0.72, sq: 0.80, build(k) {
    // sandstone courtyard house behind stepped merlons; windcatcher from age 1, upper floor with mashrabiya from age 2
    ring(k, 0.1, 0.1, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e1: 'wall-window' });
    if (k.style <= 1) {
      roof(k, 0.1, 0.1, 2, 2, 1, 'merlon-stepped');
      if (k.style === 1) k.add(I, 'malqaf', 0.6, 0.6, 1.06);
    } else {
      ring(k, 0.1, 0.1, 2, 2, 1, { s0: 'wall-window', e1: 'wall-window' });
      k.add(I, 'mashrabiya', 1.6, 1.6, 1, ROT.s);
      if (k.style === 3) k.add(I, 'mashrabiya', 1.6, 0.6, 1, ROT.e);
      roof(k, 0.1, 0.1, 2, 2, 2, 'merlon-stepped');
      k.add(I, 'malqaf', 0.6, 0.6, 2.06);
    }
    k.add('nature', 'tree_palm', 2.3, 0.4, 0, 20, 0.55);
  } },
  tc_saracens: { civ: 'saracens', size: 4, styles: [0, 1, 2, 3], scale: 1.06, sq: 1.02, build(k) {
    const tall = k.style >= 2, top = tall ? 2 : 1;
    ring(k, 0.5, 0.5, 3, 2, 0, { s0: 'wall-window', s1: 'wall-door', s2: 'wall-window', e0: 'wall-window', e1: 'wall-door' });
    if (tall) ring(k, 0.5, 0.5, 3, 2, 1, { s0: 'wall-window', s1: 'wall-window', s2: 'wall-window', e0: 'wall-window', e1: 'wall-window' });
    roof(k, 0.5, 0.5, 3, 2, top, 'merlon-stepped');
    if (k.style === 0) {
      // mud-brick compound: walled hall, shade tent and palms
      k.add('nature', 'tent_detailedOpen', 1.6, 3.3, 0, 0, 0.7);
    } else {
      // Dar al-Imara: horseshoe-arcaded portico before a hall under a pointed ribbed dome
      crown(k, 'dome-ribbed', 2, 1.5, top + 0.06, tall ? 1.7 : 1.3);
      portico(k, 0.5, 2.5, 3, null, 'merlon-stepped');
      if (k.style === 3) crown(k, 'minaret-square', 0.8, 0.8, top + 0.06, 0.6);
    }
    k.add('nature', 'tree_palm', 3.75, 0.4, 0, 0, 0.8);
    k.add('nature', 'tree_palmBend', 3.75, 3.7, 0, 200, 0.75);
  } },
  monastery_saracens: { civ: 'saracens', size: 3, styles: [2, 3], scale: 1.02, sq: 1.02, build(k) {
    // courtyard mosque: arcaded front, prayer hall under a pointed ribbed dome, square tiered minaret
    ring(k, 0, 0, 3, 2, 0, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s1: 'wall-door', s2: 'wall-window' });
    ring(k, 0, 0, 3, 2, 1, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
    roof(k, 0, 0, 3, 2, 2, 'merlon-stepped');
    crown(k, 'dome-ribbed', 1.5, 0.95, 2.06, k.style === 3 ? 1.6 : 1.3);
    if (k.style === 3) for (const x of [0.55, 2.45]) crown(k, 'dome-ribbed', x, 0.95, 2.06, 0.6);
    portico(k, 0, 2, 2, null, 'merlon-stepped');
    crown(k, 'minaret-square', 2.5, 2.5, 0, 1.15);
    k.add('nature', 'tree_palm', 0.3, 2.75, 0, 0, 0.6);
  } },
```

- [ ] **Step 2: Run the test to verify it fails on the unbaked keys**

  Run: `node tests/islamic-art.test.js`

  Expected: only the manifest test fails, with `house_saracens_0 missing from manifest.js`.

- [ ] **Step 3: Self-check the look**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --preview house_saracens,house,tc_saracens,tc,monastery_saracens,monastery
  ```

  Check that:
  - the ablaq stripes appear from age 2 only
  - stepped merlons line every flat roof
  - palms sit inside the footprint
  - ribbed domes are pointed
  - the square minaret is upright

  Fix and re-render as needed.

- [ ] **Step 4: Bake**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --only house_saracens,tc_saracens,monastery_saracens
  git status --short game/art/kenney
  ```

  Expected:
  - The bake prints `baked 10 sprites ... (merged: manifest has 129)`.
  - `git status` lists `manifest.js` and 10 new `*_saracens_*` PNGs.

- [ ] **Step 5: Run the tests and commit**

  Run `npm run test:quick`. Expected: all pass.

  ```bash
  git add tools/art/islamic-recipes.js game/art/kenney
  git commit -F - <<'EOF'
  feat(art): Saracens houses, palace courts and courtyard mosques

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  EOF
  ```

---

### Task 8: Review point 2 — the full set (user gate)

**Files:**
- Modify: `tests/islamic-art.test.js` (count check)
- Possibly re-tune: `tools/art/islamic-recipes.js`, and re-bake with `--only`

**Interfaces:**
- Produces: the approved 20 sprites.

- [ ] **Step 1: Render the full contact sheet**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --preview house_turks,house_saracens,house,tc_turks,tc_saracens,tc,monastery_turks,monastery_saracens,monastery
  ```

  Open `tools/art/preview.png`. Apply the create-game-assets contact-sheet QA across all 20 sprites against their Kenney neighbours. Fix obvious defects, re-bake those recipes with `--only`, and re-render.

- [ ] **Step 2: STOP and ask the user to approve the set**

  Show the user `tools/art/preview.png` and ask:

  > Here are all 20 Turks and Saracens buildings next to the shared Kenney ones. Approve, or say what to change.

  Iterate until they approve. Every re-bake uses `--only`.

- [ ] **Step 3: Pin the sprite count**

  In `tests/islamic-art.test.js`, insert before the final `console.log`:

```js
test('the pilot covers exactly 20 sprites', () => {
  assert.equal(Object.values(R.ISLAMIC_RECIPES).reduce((n, r) => n + r.styles.length, 0), 20);
});
```

- [ ] **Step 4: Run the test and commit**

  Run `node tests/islamic-art.test.js`. Expected: `10 passed, 0 failed`.

  ```bash
  git add tests/islamic-art.test.js tools/art/islamic-recipes.js game/art/kenney
  git commit -F - <<'EOF'
  test(art): pin the Islamic pilot at 20 approved sprites

  Approved at review point 2.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  EOF
  ```

---

### Task 9: In-game check, docs, full verification

**Files:**
- Create: `tests/browser/islamic-art.spec.js`
- Modify: `docs/ASSET_PLAN.md` (§2, item 2)
- Modify: `README.md:82`

**Interfaces:**
- Consumes: everything above.
- Produces: `test-results/islamic-age1.png` and `test-results/islamic-age3.png` for the review. They are git-ignored.

- [ ] **Step 1: Write the in-game test** `tests/browser/islamic-art.spec.js`

```js
const { test, expect } = require('@playwright/test');

const waitForArt = page => page.waitForFunction(() => typeof KART !== 'undefined' && KART.on && Object.keys(KART.img).length + KART.failed.length === Object.keys(KENNEY_ART).length);

// A Turks row and a Saracens row of Town Center, Monastery and House on cleared grass, drawn by the live game.
// Saves test-results/islamic-age<N>.png for the in-game review: footprint fit, shadows, flag and shield, no doubled domes.
const EXPECTED = {
  1: ['tc_turks_1', 'house_turks_1', 'tc_saracens_1', 'house_saracens_1', 'monastery_1'],
  3: ['tc_turks_3', 'monastery_turks_3', 'house_turks_3', 'tc_saracens_3', 'monastery_saracens_3', 'house_saracens_3'],
};

for (const age of [1, 3]) test(`Turks and Saracens towns use their own buildings in game (age ${age})`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(age => {
    const g = __game, w = g.W, m = w.map;
    g.UI.paused = true; w.noFog = true; w.players[1].age = age;
    const x0 = (w.n >> 1) - 7, y0 = (w.n >> 1) - 6;
    for (const e of w.list.slice()) if (e.x >= x0 - 1 && e.x < x0 + 15 && e.y >= y0 - 1 && e.y < y0 + 13) removeEnt(e);
    for (let y = y0 - 1; y < y0 + 13; y++) for (let x = x0 - 1; x < x0 + 15; x++) { const i = m.idx(x, y); m.ter[i] = T.GRASS; m.elev[i] = 0; m.blk[i] = 0; }
    m.computeVH(); m.computeRegions(); invalidateTerrain(); MM.baseVer = -1;
    for (const [row, civ] of [[0, 'turks'], [6, 'saracens']]) for (const [type, dx] of [['tc', 0], ['monastery', 5], ['house', 9]]) {
      spawnBuilding(type, 1, x0 + dx, y0 + row, true).civ = civ;
    }
    KART.cache.clear(); R.spriteCache.clear();
    g.centerCamOn(x0 + 6, y0 + 6);
  }, age);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/islamic-age${age}.png` });
  const used = await page.evaluate(() => [...KART.cache.keys()].map(k => k.split('|')[0]));
  for (const name of EXPECTED[age]) expect(used).toContain(name);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run it**

  Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/islamic-art.spec.js --reporter=line`

  Expected: 2 passed.

  If the sprite keys are missing because the paused game does not render, add `await page.evaluate(() => __game.R && requestAnimationFrame(() => {}))` before the wait, or unpause for 500 ms. Then investigate rather than weakening the assertion.

- [ ] **Step 3: Review the screenshots**

  Open `test-results/islamic-age1.png` and `test-results/islamic-age3.png` with the Read tool. Check:
  - the buildings sit on their footprints
  - shadows fall the same way as neighbouring sprites
  - the player flag and civ shield are visible
  - there is no painted dome or minaret on top of the modelled ones

  Show both to the user with a one-line summary each.

- [ ] **Step 4: Update the docs**

  In `docs/ASSET_PLAN.md` §2, after item 2's bullet (the line starting `   - Uses Three.js to assemble 230+ CC0 modular 3D meshes`), add:

```markdown
   - Original kits: `tools/art/blender/islamic_kit.py` builds CC0 Islamic architecture pieces in Blender (`npm run art:kit`, output `assets/original/islamic/`); `tools/art/islamic-recipes.js` assembles the Turks and Saracens `house`/`tc`/`monastery` sprites (`<type>_<civ>_<age>`), and `bake-kenney.mjs --only` merges them into the manifest without re-baking other sprites. In game, `civ_art.js` prefers these per-civ sprites and skips its painted crown for them.
```

  In `README.md` line 82, replace `rebuilds the 86 scenery sprites` with `rebuilds the scenery sprites`. At the end of that paragraph, append:

```markdown
 Turks and Saracens buildings come from an original CC0 parts kit scripted in Blender (`tools/art/blender/islamic_kit.py`, `npm run art:kit`); its GLBs are committed, so baking does not need Blender. Use `npm run art:bake -- --only <recipe,...>` to bake specific recipes without re-rendering the rest.
```

- [ ] **Step 5: Run the full verification**

  ```bash
  npm test
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:browser
  git status --short
  ```

  Expected:
  - `npm test` ends with `0 suites failed`.
  - The browser suite has no failures beyond those recorded as pre-existing in Task 0, each confirmed unrelated.
  - `git status` lists only this task's files.

- [ ] **Step 6: Commit**

  ```bash
  git add tests/browser/islamic-art.spec.js docs/ASSET_PLAN.md README.md
  git commit -F - <<'EOF'
  test(art): in-game Turks and Saracens town check; document the Blender kit

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  EOF
  ```

- [ ] **Step 7: Finish the branch**

  Use superpowers:finishing-a-development-branch to choose between merge, PR and keep.
