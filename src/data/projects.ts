/**
 * The homepage's projects, in English and French. Edit freely: the Projects section renders
 * straight from here. Section titles and labels live in src/i18n/en.json and fr.json.
 *
 * Each card shows a pre-rendered 3D still: public/media/projects/<slug>.webp (and -light, -800
 * variants), made by `node scripts/render-project-art.mjs` from scripts/project-art/scenes.js.
 * The detail panels only state what the descriptions say: no invented features or numbers.
 */

export type Locale = 'en' | 'fr';
type Text = Record<Locale, string>;

export type Status = 'live' | 'progress' | 'ongoing' | 'done';

export interface Project {
  slug: string;
  title: Text;
  kind: Text;
  status: Status;
  /** Behind the render while it loads */
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

export type WorkshopStatus = 'idea' | 'planning' | 'prototype' | 'progress';

/** "In the workshop": smaller things on the bench, one line each */
export interface WorkshopItem {
  name: Text;
  line: Text;
  status: WorkshopStatus;
}

const GITHUB = 'https://github.com/AdelAbane';

export const featuredProjects: Project[] = [
  {
    slug: 'this-website',
    title: { en: 'This website', fr: 'Ce site' },
    kind: { en: 'Web', fr: 'Web' },
    status: 'ongoing',
    gradient: 'linear-gradient(135deg, #0B1A3A, #1D4ED8)',
    description: {
      en: 'My portfolio, built with Astro, Three.js and GSAP: a pixel-art galaxy, a 3D garage and scroll-driven animations, in English and French.',
      fr: 'Mon portfolio, construit avec Astro, Three.js et GSAP : une galaxie en pixel art, un garage 3D et des animations au défilement, en français et en anglais.',
    },
    tags: ['Astro', 'Three.js', 'GSAP', 'i18n'],
    details: {
      what: { en: 'My portfolio, in English and French.', fr: 'Mon portfolio, en français et en anglais.' },
      built: {
        en: 'The site with Astro, a pixel-art galaxy, a 3D garage with Three.js, and scroll-driven animations with GSAP.',
        fr: 'Le site avec Astro, une galaxie en pixel art, un garage 3D avec Three.js et des animations au défilement avec GSAP.',
      },
      learned: {
        en: 'How to bring Astro, Three.js and GSAP together in one site, in two languages.',
        fr: 'Comment réunir Astro, Three.js et GSAP dans un seul site, en deux langues.',
      },
    },
    stack: ['Astro', 'TypeScript', 'Three.js', 'GSAP', 'i18n'],
    links: { github: GITHUB },
  },
  {
    slug: 'homelab',
    title: { en: 'Homelab', fr: 'Homelab' },
    kind: { en: 'Infrastructure', fr: 'Infrastructure' },
    status: 'ongoing',
    gradient: 'linear-gradient(135deg, #0C4A6E, #2563EB)',
    description: {
      en: 'Pi-hole on a headless Raspberry Pi, Tailscale for remote access, and an old Dell rebuilt as a NAS on OpenMediaVault.',
      fr: 'Pi-hole sur un Raspberry Pi sans écran, Tailscale pour l’accès à distance, et un vieux Dell reconverti en NAS sous OpenMediaVault.',
    },
    tags: ['Linux', 'Docker', 'Tailscale'],
    details: {
      what: { en: 'A small home server setup.', fr: 'Un petit serveur maison.' },
      built: {
        en: 'Pi-hole on a headless Raspberry Pi, Tailscale for remote access, and an old Dell rebuilt as a NAS on OpenMediaVault.',
        fr: 'Pi-hole sur un Raspberry Pi sans écran, Tailscale pour l’accès à distance, et un vieux Dell reconverti en NAS sous OpenMediaVault.',
      },
      learned: {
        en: 'Running services on my own Linux hardware and reaching them remotely.',
        fr: 'Faire tourner des services sur mon propre matériel Linux et y accéder à distance.',
      },
    },
    stack: ['Linux', 'Docker', 'Raspberry Pi', 'Tailscale', 'OpenMediaVault'],
    links: { github: GITHUB },
  },
  {
    slug: 'roblox-games',
    title: { en: 'Roblox games', fr: 'Jeux Roblox' },
    kind: { en: 'Game dev', fr: 'Jeux vidéo' },
    status: 'progress',
    gradient: 'linear-gradient(135deg, #312E81, #60A5FA)',
    description: {
      en: 'I build games in Roblox Studio with Luau: game loops, player systems, maps and UI.',
      fr: 'Je crée des jeux dans Roblox Studio avec Luau : boucles de jeu, systèmes de joueurs, cartes et interfaces.',
    },
    tags: ['Roblox Studio', 'Luau'],
    details: {
      what: { en: 'Games I build in Roblox Studio.', fr: 'Des jeux que je crée dans Roblox Studio.' },
      built: {
        en: 'Game loops, player systems, maps and UI, written in Luau.',
        fr: 'Des boucles de jeu, des systèmes de joueurs, des cartes et des interfaces, écrits en Luau.',
      },
      learned: {
        en: 'How the parts of a game fit together, from the game loop to the interface.',
        fr: 'Comment les parties d’un jeu s’assemblent, de la boucle de jeu à l’interface.',
      },
    },
    stack: ['Roblox Studio', 'Luau', 'Blender'],
    links: { github: GITHUB },
  },
  {
    slug: 'wireguard-vpn-lab',
    title: { en: 'WireGuard VPN lab', fr: 'Labo VPN WireGuard' },
    kind: { en: 'Networking', fr: 'Réseau' },
    status: 'done',
    gradient: 'linear-gradient(135deg, #0F172A, #0E7490)',
    description: {
      en: 'An encrypted WireGuard VPN between virtual machines, built and tested with a teammate: keys, peers, IP addressing and routing.',
      fr: 'Un VPN WireGuard chiffré entre machines virtuelles, conçu et testé en équipe : clés, pairs, adressage IP et routage.',
    },
    tags: ['WireGuard', 'Linux'],
    details: {
      what: { en: 'An encrypted WireGuard VPN between virtual machines.', fr: 'Un VPN WireGuard chiffré entre machines virtuelles.' },
      built: {
        en: 'With a teammate: the keys, the peers, the IP addressing and the routing, then we tested it.',
        fr: 'En équipe : les clés, les pairs, l’adressage IP et le routage, puis nous l’avons testé.',
      },
      learned: {
        en: 'What a VPN needs to work (keys, peers, addressing, routing), and how to build and test it as a team.',
        fr: 'Ce qu’il faut pour qu’un VPN fonctionne (clés, pairs, adressage, routage), et comment le construire et le tester en équipe.',
      },
    },
    stack: ['WireGuard', 'Linux'],
    links: { github: GITHUB },
  },
  {
    slug: 'meal-finder',
    title: { en: 'Meal Finder', fr: 'Meal Finder' },
    kind: { en: 'Web app', fr: 'Application web' },
    status: 'done',
    gradient: 'linear-gradient(135deg, #1E3A8A, #7C3AED)',
    description: {
      en: 'A single-page React app that searches recipes from a public API, with client-side routing and reusable components.',
      fr: 'Une application React monopage qui recherche des recettes via une API publique, avec routage côté client et composants réutilisables.',
    },
    tags: ['React', 'JavaScript'],
    details: {
      what: { en: 'A single-page React app for searching recipes.', fr: 'Une application React monopage pour chercher des recettes.' },
      built: {
        en: 'Recipe search from a public API, client-side routing and reusable components.',
        fr: 'La recherche de recettes via une API publique, le routage côté client et des composants réutilisables.',
      },
      learned: {
        en: 'Using a public API in React, routing on the client, and splitting an interface into reusable components.',
        fr: 'Utiliser une API publique avec React, gérer le routage côté client et découper une interface en composants réutilisables.',
      },
    },
    stack: ['React', 'JavaScript', 'REST API'],
    links: { github: GITHUB },
  },
];

export const workshop: WorkshopItem[] = [
  {
    name: { en: 'App in development', fr: 'Application en développement' },
    line: { en: 'A new app I’m planning and building next.', fr: 'Une nouvelle application que je planifie et construis.' },
    status: 'planning',
  },
  {
    name: { en: 'Game dev in Roblox Studio', fr: 'Création de jeux dans Roblox Studio' },
    line: { en: 'Building and improving games with Luau.', fr: 'Je crée et j’améliore des jeux avec Luau.' },
    status: 'progress',
  },
  {
    name: { en: 'More projects coming', fr: 'D’autres projets à venir' },
    line: { en: 'New builds on the way.', fr: 'De nouveaux projets en route.' },
    status: 'idea',
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
