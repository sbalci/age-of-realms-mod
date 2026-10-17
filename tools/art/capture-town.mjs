// Reproducible screenshots of both art styles: node tools/art/capture-town.mjs
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
  catch { res.writeHead(400).end(); return; }
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => err ? res.writeHead(404).end() : res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(data));
}).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const art of ['classic', 'kenney']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/game/?art=${art}`);
    if (art === 'kenney') await page.waitForFunction(() => KART.booted && Object.keys(KART.img).length + KART.failed.length === KART.requested.size);
    await page.locator('#btn-tutorial').click();
    if (art === 'kenney') await page.evaluate(() => KART.loadCiv(__game.W.players[1].civ));
    await page.evaluate(() => {
      const g = __game, w = g.W, m = w.map, p = w.players[1];
      g.UI.paused = true; w.noFog = true; p.age = 2; w.menu = false;
      document.getElementById('tutorial-panel')?.remove();
      document.getElementById('msgs').style.display = 'none';
      document.getElementById('pausebanner').style.display = 'none';
      const tc = w.list.find(e => e.type === 'tc' && e.owner === 1);
      const buildings = [['house', -4, 0], ['house', -4, 3], ['mill', 1, 6], ['farm', 4, 6], ['farm', 7, 6], ['barracks', 6, 1], ['blacksmith', 6, -4], ['market', 1, -5], ['well', -1, 4]];
      for (const [type, dx, dy] of buildings) {
        const x = tc.x + dx, y = tc.y + dy, s = BUILDINGS[type].size;
        for (const e of w.list.slice()) if (e.kind === 'res' && e.x >= x && e.x < x + s && e.y >= y && e.y < y + s) removeEnt(e);
        const b = spawnBuilding(type, 1, x, y, true);
        if (type === 'farm' && dx === 7) b.food = p.farmFood * 0.4;
      }
      g.UI.selection = [tc]; g.UI.panelKey = ''; renderCommands(); renderSelInfo(); updateTopbar();
      g.centerCamOn(tc.x + 3, tc.y + 3); g.R.cam.zoom = 1.25;
      g.R.time = 1;
      // One fixed render avoids camera drift or simulation differences between styles.
      renderWorld(g.R.ctx, { selection: new Set([tc]) });
    });
    await page.screenshot({ path: path.join(root, `assets/screenshots/art-${art}.jpg`), type: 'jpeg', quality: 88 });
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`Captured assets/screenshots/art-${art}.jpg`);
    await page.close();
  }
} finally {
  await browser?.close();
  server.close();
}
