/**
 * ?debug overlay: frame rate, the quality tier, the active WebGL renderer's stats (from the scene
 * that registers itself on window.__renderStats) and the JS heap when the browser reports it.
 */
import { getTier } from './quality';

type Stats = { geometries: number; textures: number; calls: number; triangles: number };

declare global {
  interface Window {
    /** Set by a 3D scene while it runs (garage-three via About.astro) */
    __renderStats?: () => Stats | undefined;
  }
}

export function startDebug() {
  const panel = document.createElement('pre');
  panel.setAttribute('aria-hidden', 'true');
  panel.style.cssText = [
    'position: fixed',
    'left: 12px',
    'bottom: 12px',
    'z-index: 2000',
    'margin: 0',
    'padding: 10px 12px',
    'border: 1px solid rgba(92, 200, 255, 0.5)',
    'border-radius: 8px',
    'background: rgba(5, 11, 26, 0.85)',
    'color: #bfeaff',
    'font: 11px/1.5 "JetBrains Mono", ui-monospace, monospace',
    'pointer-events: none',
    'white-space: pre',
  ].join(';');
  document.body.append(panel);

  let frames = 0;
  let since = performance.now();
  let fps = 0;

  const loop = (now: number) => {
    frames++;
    if (now - since >= 500) {
      fps = Math.round((frames * 1000) / (now - since));
      frames = 0;
      since = now;
      const stats = window.__renderStats?.();
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      const lines = [
        `FPS        ${fps}`,
        `tier       ${getTier().toUpperCase()}`,
        stats ? `geometries ${stats.geometries}` : 'renderer   none',
        stats ? `textures   ${stats.textures}` : '',
        stats ? `draw calls ${stats.calls}` : '',
        stats ? `triangles  ${stats.triangles.toLocaleString('en')}` : '',
        memory ? `JS heap    ${(memory.usedJSHeapSize / 1048576).toFixed(1)} MB` : 'JS heap    n/a',
      ];
      panel.textContent = lines.filter(Boolean).join('\n');
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
