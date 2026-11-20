/**
 * Logos for the skill and tag chips, from simple-icons (CC0), rendered as inline SVG at build time.
 * A label that isn't here (or a technology simple-icons doesn't carry, like Java or C#) gets the
 * generic code icon instead.
 */
import {
  siAstro,
  siBlender,
  siDocker,
  siDotnet,
  siGreensock,
  siJavascript,
  siLinux,
  siLuau,
  siNodedotjs,
  siOpenmediavault,
  siPython,
  siRaspberrypi,
  siReact,
  siRobloxstudio,
  siTailscale,
  siThreedotjs,
  siTypescript,
  siWireguard,
} from 'simple-icons';

export interface TechIcon {
  /** SVG path on a 24 × 24 grid; null for the generic code icon */
  path: string | null;
  /** Brand colour, shown on hover */
  hex: string | null;
}

const icons: Record<string, { path: string; hex: string }> = {
  'c# / .net': siDotnet,
  python: siPython,
  javascript: siJavascript,
  'roblox studio': siRobloxstudio,
  luau: siLuau,
  blender: siBlender,
  linux: siLinux,
  docker: siDocker,
  'raspberry pi': siRaspberrypi,
  tailscale: siTailscale,
  wireguard: siWireguard,
  react: siReact,
  astro: siAstro,
  'three.js': siThreedotjs,
  gsap: siGreensock,
  'node.js': siNodedotjs,
  typescript: siTypescript,
  openmediavault: siOpenmediavault,
};

export function techIcon(label: string): TechIcon {
  const icon = icons[label.trim().toLowerCase()];
  return icon ? { path: icon.path, hex: `#${icon.hex}` } : { path: null, hex: null };
}
