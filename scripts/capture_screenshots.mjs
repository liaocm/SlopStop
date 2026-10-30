// Captures raw 1280x800 store screenshots with the extension loaded, in a
// fresh, logged-out Chromium profile (so no personal account data shows up).
//
//   npm install && npx playwright install chromium
//   npm run screenshots
//
// Output goes to store/raw/; scripts/make_store_assets.py turns those into the
// final listing images.
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'store', 'raw');

const SHOTS = [
  {
    name: 'search',
    url: 'https://www.youtube.com/results?search_query=ai+cat+shorts+veo',
  },
  {
    name: 'channel',
    url: 'https://www.youtube.com/@Milo-m7n7q/videos',
    // Scroll past the channel banner so the video grid fills the frame.
    scrollToSelector: 'yt-tab-group-shape, tp-yt-app-toolbar, #tabs-container',
    // Also capture the page with overlays hidden, for the before/after image.
    alsoWithout: true,
  },
];

async function settle(page) {
  await page.waitForSelector('.slopstopper-overlay', { timeout: 30000 });
  // Let lookups for the rest of the visible thumbnails finish and images load.
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'slopstopper-shots-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    args: [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`],
  });

  try {
    const page = context.pages()[0] || (await context.newPage());
    for (const shot of SHOTS) {
      await page.goto(shot.url, { waitUntil: 'domcontentloaded' });
      await settle(page);

      if (shot.scrollToSelector) {
        await page.evaluate((selector) => {
          const el = document.querySelector(selector);
          if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 64);
        }, shot.scrollToSelector);
        await settle(page);
      }

      const file = path.join(OUT, `${shot.name}.png`);
      await page.screenshot({ path: file });
      console.log(`wrote ${path.relative(ROOT, file)}`);

      if (shot.alsoWithout) {
        await page.addStyleTag({ content: '.slopstopper-overlay { display: none !important; }' });
        await page.waitForTimeout(300);
        const plain = path.join(OUT, `${shot.name}-without.png`);
        await page.screenshot({ path: plain });
        console.log(`wrote ${path.relative(ROOT, plain)}`);
      }
    }
  } finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

await main();
