// Screenshots the same town in Kenney and classic art: node tools/art/screenshot-art.mjs (writes test-results/*.png)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const srv = spawn('node', ['tests/serve.js'], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const [art, age] of [['kenney', 2], ['classic', 2], ['kenney', 0]]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:8765/game/?art=${art}`);
  await page.waitForFunction(() => window.__game);
  await page.locator('#btn-sp').click();
  await page.waitForTimeout(500);
  const start = page.locator('#btn-start, button:has-text("Start Game")').first();
  if (await start.count()) await start.click();
  await page.waitForFunction(() => __game.W && __game.W.players && __game.W.list.length > 10, null, { timeout: 20000 });
  const info = await page.evaluate((age) => {
    const g = __game, W = g.W; g.UI.paused = true; W.noFog = true;
    const p = W.players[W.humanId]; p.age = age;
    const tc = W.list.find(e => e.type === 'tc' && e.owner === W.humanId);
    const ox = tc.x, oy = tc.y;
    // clear an area and lay out one of each building
    for (const e of W.list.slice()) if (e.kind === 'res' && Math.abs(e.x - ox - 4) < 14 && Math.abs(e.y - oy - 4) < 12 && e.type !== 'tree') removeEnt(e);
    const lay = [['house', 5, -1], ['house', 5, 2], ['mill', 8, -1], ['lumbercamp', 8, 2], ['miningcamp', 11, -1], ['barracks', -5, 5], ['range', -1, 6], ['stable', 3, 6], ['blacksmith', 7, 5], ['market', 11, 3], ['monastery', -5, -4], ['university', -1, -5], ['siege', 11, 7], ['castle', 14, -2], ['tower', 15, 4], ['outpost', 16, 6], ['well', 3, -3], ['wonder', 15, 8]];
    const made = [];
    for (const [t, dx, dy] of lay) { try { const b = spawnBuilding(t, W.humanId, ox + dx, oy + dy, true); made.push(t); } catch (e) { made.push(t + ':ERR ' + e.message); } }
    spawnRes('gold', ox + 4, oy + 10); spawnRes('gold', ox + 5, oy + 10); spawnRes('stone', ox + 7, oy + 10); spawnRes('stone', ox + 8, oy + 10);
    g.centerCamOn(ox + 6, oy + 2);
    return { made, kart: typeof KART === 'object' ? KART.on : null };
  }, age);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `test-results/${art}_${age}.png` });
  console.log(art, age, JSON.stringify(info), errs.slice(0, 3));
  await page.close();
}
await browser.close(); srv.kill();
