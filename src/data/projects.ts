/**
 * The homepage's projects, in English and French. Edit freely: the Projects section renders
 * straight from here. Section titles and labels live in src/i18n/en.json and fr.json.
 *
 * No photos: each card shows a pixel-art illustration (ProjectArt.astro), picked by `art`.
 * Texts marked [TODO] are placeholders.
 */

export type Locale = 'en' | 'fr';
type Text = Record<Locale, string>;

export type Status = 'live' | 'progress' | 'ongoing';

/** Each card's media: a pixel-art illustration drawn in ProjectArt.astro (no photos) */
export type Art = 'website' | 'homelab' | 'roblox' | 'wireguard' | 'mealfinder';

export interface Project {
  slug: string;
  title: Text;
  kind: Text;
  status: Status;
  art: Art;
  /** Behind the illustration */
  gradient: string;
  description: Text;
  tags: string[];
  /** The detail panel */
  details: {
    what: Text;
    built: Text;
    learned: Text;
  };
  stack: string[];
  links: { github?: string; demo?: string };
}

export type WorkshopStatus = 'idea' | 'prototype' | 'progress';

/** "In the workshop": smaller things on the bench, one line each */
export interface WorkshopItem {
  name: Text;
  line: Text;
  status: WorkshopStatus;
}

const todo = (en: string, fr: string): Text => ({ en: `[TODO] ${en}`, fr: `[TODO] ${fr}` });

// Placeholder detail texts, until the real ones are written
const placeholder = {
  what: todo('What it is: who it is for and what problem it solves.', 'Ce que c’est : pour qui, et quel problème ça règle.'),
  built: todo('What I built: the parts I designed and coded myself.', 'Ce que j’ai construit : les parties que j’ai conçues et codées moi-même.'),
  learned: todo('What I learned: the lesson this project taught me.', 'Ce que j’ai appris : la leçon que ce projet m’a apprise.'),
};

export const featuredProjects: Project[] = [
  {
    slug: 'this-website',
    title: { en: 'This website', fr: 'Ce site' },
    kind: { en: 'Web', fr: 'Web' },
    status: 'ongoing',
    art: 'website',
    gradient: 'linear-gradient(135deg, #0B1A3A, #1D4ED8)',
    description: {
      en: 'A retro arcade portfolio: a pixel galaxy, a scroll-driven garage and a 3D car you can pop the hood on, in English and French.',
      fr: 'Un portfolio façon arcade rétro : une galaxie en pixels, un garage qui s’ouvre au défilement et une voiture 3D dont on peut ouvrir le capot, en français et en anglais.',
    },
    tags: ['Astro', 'Three.js', 'GSAP', 'i18n'],
    details: { ...placeholder },
    stack: ['Astro', 'TypeScript', 'Three.js', 'GSAP', 'i18n'],
    links: {},
  },
  {
    slug: 'homelab',
    title: { en: 'Homelab', fr: 'Homelab' },
    kind: { en: 'Infrastructure', fr: 'Infrastructure' },
    status: 'ongoing',
    art: 'homelab',
    gradient: 'linear-gradient(135deg, #0C4A6E, #2563EB)',
    description: {
      en: 'Pi-hole on a headless Raspberry Pi, Tailscale for remote access, and an old Dell rebuilt as a NAS on OpenMediaVault.',
      fr: 'Pi-hole sur un Raspberry Pi sans écran, Tailscale pour l’accès à distance, et un vieux Dell reconverti en NAS sous OpenMediaVault.',
    },
    tags: ['Linux', 'Docker', 'Tailscale'],
    details: { ...placeholder },
    stack: ['Linux', 'Docker', 'Raspberry Pi', 'Tailscale', 'OpenMediaVault'],
    links: {},
  },
  {
    slug: 'roblox-games',
    title: { en: 'Roblox games', fr: 'Jeux Roblox' },
    kind: { en: 'Game dev', fr: 'Jeux vidéo' },
    status: 'progress',
    art: 'roblox',
    gradient: 'linear-gradient(135deg, #312E81, #60A5FA)',
    description: {
      en: 'I build games in Roblox Studio with Luau: game loops, player systems, maps and UI.',
      fr: 'Je crée des jeux dans Roblox Studio avec Luau : boucles de jeu, systèmes de joueurs, cartes et interfaces.',
    },
    tags: ['Roblox Studio', 'Luau'],
    details: { ...placeholder },
    stack: ['Roblox Studio', 'Luau', 'Blender'],
    links: {},
  },
  {
    slug: 'wireguard-vpn-lab',
    title: { en: 'WireGuard VPN lab', fr: 'Labo VPN WireGuard' },
    kind: { en: 'Networking', fr: 'Réseau' },
    status: 'live',
    art: 'wireguard',
    gradient: 'linear-gradient(135deg, #0F172A, #0E7490)',
    description: todo('One line on the VPN lab: what it connects and why.', 'Une ligne sur le labo VPN : ce qu’il relie et pourquoi.'),
    tags: ['WireGuard', 'Linux'],
    details: { ...placeholder },
    stack: ['WireGuard', 'Linux'],
    links: {},
  },
  {
    slug: 'meal-finder',
    title: { en: 'Meal Finder', fr: 'Meal Finder' },
    kind: { en: 'Web app', fr: 'Application web' },
    status: 'live',
    art: 'mealfinder',
    gradient: 'linear-gradient(135deg, #1E3A8A, #7C3AED)',
    description: todo('One line on Meal Finder: what it searches and how.', 'Une ligne sur Meal Finder : ce qu’il cherche et comment.'),
    tags: ['React', 'JavaScript'],
    details: { ...placeholder },
    stack: ['React', 'JavaScript', 'REST API'],
    links: {},
  },
];

export const workshop: WorkshopItem[] = [
  {
    name: todo('Project name', 'Nom du projet'),
    line: todo('One line about it.', 'Une ligne pour le décrire.'),
    status: 'idea',
  },
  {
    name: todo('Project name', 'Nom du projet'),
    line: todo('One line about it.', 'Une ligne pour le décrire.'),
    status: 'prototype',
  },
  {
    name: todo('Project name', 'Nom du projet'),
    line: todo('One line about it.', 'Une ligne pour le décrire.'),
    status: 'progress',
  },
];

/** The scrolling code behind the section: Luau, Astro + TypeScript, then docker-compose and C# */
export const codeColumns: string[][] = [
  [
    'local Players = game:GetService("Players")',
    'local RunService = game:GetService("RunService")',
    '',
    'local BASE_SPEED = 48',
    'local MAX_SPEED = 140',
    '',
    'local function onStep(dt)',
    '  speed = math.min(speed + dt * 2.5, MAX_SPEED)',
    '  board.CFrame *= CFrame.new(0, 0, -speed * dt)',
    'end',
    '',
    'RunService.Heartbeat:Connect(onStep)',
    '',
    'local function spawnObstacle(z)',
    '  local rock = template:Clone()',
    '  rock.Position = Vector3.new(math.random(-20, 20), 2, z)',
    '  rock.Parent = workspace.Obstacles',
    'end',
    '',
    'for i = 1, 40 do',
    '  spawnObstacle(-i * 60)',
    'end',
  ],
  [
    '---',
    "import { getTranslations } from '../i18n';",
    "import { featuredProjects } from '../data/projects';",
    '',
    'const t = getTranslations(Astro.currentLocale);',
    '---',
    '',
    '<section id="projects">',
    '  {featuredProjects.map((p) => (',
    '    <ProjectCard project={p} />',
    '  ))}',
    '</section>',
    '',
    'export function getTier(): Tier {',
    "  if (isLiteMode()) return 'low';",
    "  const gl = probeWebGL();",
    "  if (!gl.ok) return 'low';",
    "  return touch ? 'medium' : 'high';",
    '}',
    '',
    'gsap.to(door, { yPercent: -100, scrub: true });',
  ],
  [
    '# homelab: docker-compose.yml',
    'services:',
    '  pihole:',
    '    image: pihole/pihole:latest',
    '    ports: ["53:53/udp", "80:80"]',
    '    restart: unless-stopped',
    '',
    '  jellyfin:',
    '    image: jellyfin/jellyfin',
    '    volumes:',
    '      - /srv/media:/media',
    '',
    '$ tailscale up --ssh',
    '$ systemctl status omv-engined',
    '',
    'public record Booking(int Id, string Facility,',
    '    DateTime Start, DateTime End);',
    '',
    'var free = bookings',
    '    .Where(b => b.Start > DateTime.Now)',
    '    .OrderBy(b => b.Start)',
    '    .ToList();',
  ],
];
