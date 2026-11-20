#!/usr/bin/env node
/**
 * Renders the project cards' stills: one small three.js studio scene per project
 * (scripts/project-art/scenes.js), in a headless Chrome driven by Playwright, then saved with sharp.
 *
 *   node scripts/render-project-art.mjs            all projects
 *   node scripts/render-project-art.mjs homelab    just some
 *
 * Writes public/media/projects/<slug>[-light].webp (1600 × 1000) and <slug>[-light]-800.webp
 * (800 × 500), WebP quality ~82, each under 150 KB. Scenes render at 2× and are downsampled.
 * Needs Google Chrome installed (or a Playwright Chromium).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'media', 'projects');
const SLUGS = ['this-website', 'homelab', 'roblox-games', 'wireguard-vpn-lab', 'meal-finder'];
const THEMES = ['dark', 'light'];
const MAX_BYTES = 150 * 1024;

const page = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#000}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body><script type="module" src="/scenes.js"></script></body></html>`;

const types = { '.js': 'text/javascript', '.html': 'text/html' };

/** Serves the page, the scenes and three.js from node_modules */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost').pathname;
  try {
    let file;
    if (url === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(page);
    if (url === '/scenes.js') file = path.join(root, 'scripts', 'project-art', 'scenes.js');
    else if (url.startsWith('/three/')) file = path.join(root, 'node_modules', 'three', url.slice('/three/'.length));
    else return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

/** WebP at ~82, stepping the quality down only if a file would go over 150 KB */
async function save(png, width, height, file) {
  for (let quality = 82; quality >= 50; quality -= 4) {
    const buffer = await sharp(png).resize(width, height, { kernel: 'lanczos3' }).webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
    if (buffer.length <= MAX_BYTES || quality <= 54) {
      await sharp(buffer).toFile(file);
      return { quality, kb: Math.round(buffer.length / 1024) };
    }
  }
}

const wanted = process.argv.slice(2).filter((slug) => SLUGS.includes(slug));
const slugs = wanted.length ? wanted : SLUGS;
mkdirSync(out, { recursive: true });

let browser;
try {
  // The installed Chrome (real GPU); falls back to a Playwright Chromium
  browser = await chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist'] }).catch(() => chromium.launch());
  const tab = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  tab.on('pageerror', (error) => console.error('page error:', error.message));
  await tab.goto(base);
  await tab.waitForFunction(() => window.artReady === true, null, { timeout: 30000 });

  for (const slug of slugs) {
    for (const theme of THEMES) {
      const dataUrl = await tab.evaluate(([s, t]) => window.renderArt(s, t), [slug, theme]);
      const png = Buffer.from(dataUrl.split(',')[1], 'base64');
      const name = theme === 'light' ? `${slug}-light` : slug;
      const big = await save(png, 1600, 1000, path.join(out, `${name}.webp`));
      const small = await save(png, 800, 500, path.join(out, `${name}-800.webp`));
      console.log(`${name.padEnd(24)} 1600: ${big.kb} KB (q${big.quality})   800: ${small.kb} KB (q${small.quality})`);
    }
  }
} finally {
  await browser?.close();
  server.close();
}
