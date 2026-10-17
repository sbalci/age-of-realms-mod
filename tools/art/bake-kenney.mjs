#!/usr/bin/env node
// Bake Kenney CC0 models into isometric sprites for the Canvas 2D renderer.
//   node tools/art/bake-kenney.mjs                 -> writes game/art/kenney/*.png and game/art/kenney/manifest.js
//   node tools/art/bake-kenney.mjs --preview a,b   -> writes tools/art/preview.png (contact sheet), nothing else
//   node tools/art/bake-kenney.mjs --only a,b        -> bakes only recipes a and b and merges them into manifest.js
// Needs the dev dependencies (npm ci): three and @playwright/test with Chromium.
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBakeArgs, parseManifest, serializeManifest, mergeManifest } from './bake-io.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'game/art/kenney');
const { preview, only } = parseBakeArgs(process.argv.slice(2));

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  fs.readFile(file, (e, d) => e ? res.writeHead(404).end() : res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(d));
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const port = server.address().port;

const launch = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', e => console.log('[page error]', e.message));
await page.goto(`http://127.0.0.1:${port}/tools/art/kenney-bake.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });

if (preview) {
  await page.evaluate(o => window.preview(o), only);
  await page.evaluate(() => { document.querySelector('canvas').style.display = 'none'; });
  await page.screenshot({ path: path.join(root, 'tools/art/preview.png'), fullPage: true });
  console.log('wrote tools/art/preview.png');
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
await browser.close();
server.close();
