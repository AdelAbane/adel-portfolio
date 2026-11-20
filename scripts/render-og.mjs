#!/usr/bin/env node
/**
 * Share previews (Open Graph / Twitter), 1200 × 630: the hero (galaxy, .ADEL, the judokas) for the
 * homepage, the 3D garage for /about, each with a glass caption. Renders the built site, so run
 * `npm run build` first:
 *
 *   npm run build && node scripts/render-og.mjs
 *
 * Writes public/og/home-en.jpg, home-fr.jpg, about-en.jpg and about-fr.jpg (then build again to ship them).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'public', 'og');
mkdirSync(out, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

/** A tiny static server over dist/ (clean URLs: /about → about/index.html) */
const server = createServer(async (req, res) => {
  let file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
  } catch {
    file = (await stat(`${file}.html`).catch(() => null)) ? `${file}.html` : file;
  }
  try {
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const captions = {
  en: 'Adel Abane · Computer Science Student · Montréal',
  fr: 'Adel Abane · Étudiant en informatique · Montréal',
};

/** The glass caption, in the header's style: along the bottom (hero) or the top (garage) */
const caption = (text, edge) => `
  (() => {
    const el = document.createElement('div');
    el.textContent = ${JSON.stringify(text)};
    el.style.cssText = [
      'position: absolute', 'left: 50%', '${edge}: ${edge === 'top' ? 34 : 150}px', 'transform: translateX(-50%)', 'z-index: 9999',
      'padding: 16px 28px', 'border-radius: 999px', 'white-space: nowrap',
      'background: rgba(10, 22, 48, 0.55)', 'backdrop-filter: blur(18px) saturate(160%)',
      'border: 1px solid rgba(190, 224, 255, 0.22)', 'box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 20px 50px rgba(2,6,20,.5)',
      'color: #EAF2FF', 'font: 600 30px "Inter Tight", Inter, system-ui, sans-serif', 'letter-spacing: -0.01em',
    ].join(';');
    document.body.append(el);
  })();
`;

const shots = [
  { name: 'home-en', url: '/?tier=high', lang: 'en', about: false },
  { name: 'home-fr', url: '/fr/?tier=high', lang: 'fr', about: false },
  { name: 'about-en', url: '/about?tier=high', lang: 'en', about: true },
  { name: 'about-fr', url: '/fr/about?tier=high', lang: 'fr', about: true },
];

let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist'] }).catch(() => chromium.launch());
  for (const shot of shots) {
    // The hero lays out taller than 630: render it at its natural height, then crop to the frame
    const context = await browser.newContext({ viewport: { width: 1200, height: shot.about ? 630 : 860 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
      sessionStorage.setItem('garage-arrived', '1');
    });
    const page = await context.newPage();
    await page.goto(base + shot.url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    if (shot.about) {
      // The 3D garage with its car in, and none of the page's UI
      await page.waitForFunction(() => document.querySelector('.garage')?.classList.contains('is-car-in'), null, { timeout: 30000 });
      await page.addStyleTag({ content: '.site-header, .garage .layer:not(.room), .garage .bottom { visibility: hidden !important } .room-view::after { display: none !important }' });
      await page.mouse.move(600, 315);
      await page.waitForTimeout(2500);
    } else {
      // The hero: galaxy, .ADEL and the judokas; no header, buttons or HUD
      await page.addStyleTag({ content: '.site-header, .hero .actions, .hero .hud, .hero .scroll-hint, .hero .sweep { visibility: hidden !important }' });
      await page.waitForTimeout(1500);
    }
    // Garage: the frame is the viewport. Hero: 630px ending just under the judokas' mat
    const clip = shot.about
      ? { x: 0, y: 0, width: 1200, height: 630 }
      : await page.evaluate(() => {
          const strip = document.querySelector('.hero .strip').getBoundingClientRect();
          return { x: 0, y: Math.max(0, Math.round(strip.bottom + 12 - 630)), width: 1200, height: 630 };
        });
    await page.evaluate(([code, y]) => {
      // Captions sit inside the cropped frame
      const holder = document.createElement('div');
      holder.style.cssText = `position: absolute; left: 0; top: ${y}px; width: 1200px; height: 630px; z-index: 9999; pointer-events: none`;
      document.body.append(holder);
      const before = document.body.lastElementChild;
      new Function(code)();
      holder.append(document.body.lastElementChild === before ? before : document.body.lastElementChild);
    }, [caption(captions[shot.lang], shot.about ? 'top' : 'bottom'), clip.y]);
    await page.waitForTimeout(300);
    const png = await page.screenshot({ type: 'png', clip });
    const info = await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(out, `${shot.name}.jpg`));
    console.log(`${shot.name}.jpg  ${Math.round(info.size / 1024)} KB`);
    await context.close();
  }
} finally {
  await browser?.close();
  server.close();
}
