// Performance baseline for bigger maps: npm run test:perf (runs the 'gpu' project). Slow, so the default browser
// run (playwright.config.js) ignores tests/browser/maps-perf.spec.js.
// 'gpu': Chromium's new headless mode on the real GPU, as the map evaluation measured.
// 'swiftshader': the default headless shell with software rendering, the low-end check:
//   PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test --config playwright.perf.config.js --project=swiftshader
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser', testMatch: 'maps-perf.spec.js', timeout: 20 * 60 * 1000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:8765', viewport: { width: 1440, height: 1000 }, trace: 'off', screenshot: 'off', launchOptions: { args: ['--enable-precise-memory-info'] } },
  projects: [
    { name: 'gpu', use: { channel: 'chromium' } },
    { name: 'swiftshader', use: {} },
  ],
  webServer: { command: 'node tests/serve.js', url: 'http://127.0.0.1:8765', reuseExistingServer: false, timeout: 10000 },
});
