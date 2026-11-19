/**
 * The homepage's scroll story (GSAP + ScrollTrigger). Only ever loaded through a dynamic import()
 * from AboutQuick.astro once the hero is on screen, so GSAP stays out of the first paint.
 *
 *   About: the stage pins for ~100vh (60vh on phones); the scroll drives a garage door rolling up
 *          (0–60%), the garage lighting up (20–70%), then the cards sliding in (60–100%).
 *   About → Projects (~60vh): the garage dims, a cursor blinks in, and the code flows in to become
 *          the Projects background.
 *   Projects: the cards fade up as they arrive, 80ms apart.
 *
 * Reduced motion or the low tier (Lite mode): no pinning or scrubbing, just simple fades; the door
 * is never shown. Without
 * this module (no JS, or before it loads) everything is simply visible.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getSettings } from './quality';

export function initScrollStory() {
  const about = document.querySelector<HTMLElement>('.quick');
  const projects = document.querySelector<HTMLElement>('.projects');
  if (!about || !projects) return;

  gsap.registerPlugin(ScrollTrigger);
  const root = document.documentElement;
  const stage = about.querySelector<HTMLElement>('.stage')!;
  const seam = about.querySelector<HTMLElement>('.seam')!;
  const door = about.querySelector<HTMLElement>('.door')!;
  const shade = about.querySelector<HTMLElement>('.shade')!;
  const warm = about.querySelector<HTMLElement>('.warm')!;
  const dim = about.querySelector<HTMLElement>('.dim')!;
  const cards = gsap.utils.toArray<HTMLElement>('.story-card', about);
  const code = projects.querySelector<HTMLElement>('.code')!;
  const cursor = projects.querySelector<HTMLElement>('.cursor')!;
  const reveals = gsap.utils.toArray<HTMLElement>('.reveal', projects);

  const media = gsap.matchMedia();

  media.add(
    {
      motion: '(prefers-reduced-motion: no-preference)',
      phone: '(max-width: 767px)',
    },
    (context) => {
      const { motion, phone } = context.conditions as { motion: boolean; phone: boolean };

      if (!motion || !getSettings().scrollStory) {
        // Reduced motion: each piece simply fades in when it arrives
        for (const el of [...cards, ...reveals]) {
          gsap.from(el, { opacity: 0, duration: 0.5, scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
        }
        return;
      }

      // Shows the door and the seam (see the CSS); everything below is measured with them in place
      root.classList.add('story');

      // ---------- About: pinned, door up, lights on, cards in ----------
      gsap
        .timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: stage,
            start: 'top top',
            end: phone ? '+=60%' : '+=100%',
            pin: true,
            scrub: true,
            anticipatePin: 1,
          },
        })
        .fromTo(door, { yPercent: 0 }, { yPercent: -100, duration: 0.6 }, 0)
        .fromTo(shade, { opacity: 1 }, { opacity: 0, duration: 0.5 }, 0.2)
        .fromTo(warm, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.2)
        .fromTo(cards, { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.25, stagger: 0.15 / cards.length, ease: 'power2.out' }, 0.6);

      // ---------- About → Projects: the garage dims, a cursor, then code ----------
      gsap.fromTo(dim, { opacity: 0 }, { opacity: 0.8, ease: 'none', scrollTrigger: { trigger: seam, start: 'top bottom', end: 'top top', scrub: true } });
      gsap
        .timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: seam, start: 'top 70%', end: () => `+=${window.innerHeight * 0.6}`, scrub: true },
        })
        .fromTo(cursor, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0)
        .fromTo(code, { opacity: 0, yPercent: 6 }, { opacity: 1, yPercent: 0, duration: 0.7 }, 0.3)
        .to(cursor, { opacity: 0, duration: 0.2 }, 0.8);

      // ---------- Projects: cards fade up as they arrive, 80ms apart ----------
      gsap.set(reveals, { opacity: 0, y: 40 });
      ScrollTrigger.batch(reveals, {
        start: 'top 90%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power2.out', clearProps: 'transform' }),
      });

      return () => root.classList.remove('story');
    },
  );

  // Late fonts change the cards' heights: measure again
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
