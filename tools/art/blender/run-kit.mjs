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
