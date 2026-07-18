// Landing-page media registry.
//
// Every entry resolves through src/lib/generated.json first: when
// `npm run generate:demo` has rendered real Seedream/Seedance output into
// /public/generated/, those files are served; otherwise the hand-crafted
// /art SVG placeholders are.

import generatedData from "./generated.json";

export interface ShowcaseMedia {
  id: string;
  type: "image" | "video";
  src: string;
  poster?: string;
  label: string;
  tag: string;
}

const generated = generatedData as Record<string, string>;

/** Real generated file if it exists, else the crafted placeholder. */
function resolve(id: string, fallback: string): Pick<ShowcaseMedia, "type" | "src"> {
  const src = generated[id];
  if (!src) return { type: "image", src: fallback };
  return { type: src.endsWith(".mp4") ? "video" : "image", src };
}

/** Public resolver so sections can pull real generated media by id. */
export function media(id: string, fallback: string, label: string, tag: string): ShowcaseMedia {
  return { id, ...resolve(id, fallback), label, tag };
}

/** The big hero visual — real Seedance clip > real Seedream still > SVG. */
export const HERO: ShowcaseMedia = {
  id: "hero",
  ...resolve("hero-video", generated["hero-neon-city"] ?? "/art/hero-neon-city.svg"),
  poster: generated["hero-neon-city"] ?? "/art/hero-neon-city.svg",
  label: "Neon samurai in rain-soaked Tokyo",
  tag: "Seedance 2.0 Pro",
};

/** The prompt shown typed into the hero's mock studio bar. */
export const HERO_PROMPT =
  "A neon samurai walks through rain-soaked Tokyo at night, cinematic slow motion";

/** Small floating thumbnails layered over the hero for flavor. */
export const HERO_CHIPS: ShowcaseMedia[] = [
  { id: "chip-char", type: "image", src: "/studio/cast-neon-samurai.svg", label: "Neon Samurai", tag: "Character" },
  { id: "chip-scene", type: "image", src: "/studio/set-cloud-temple.svg", label: "Cloud Temple", tag: "Scene" },
  { id: "chip-dress", type: "image", src: "/studio/dress-evening-gown.svg", label: "Evening Gown", tag: "Wardrobe" },
];

const TILE = (n: string, label: string): ShowcaseMedia => ({
  id: n,
  ...resolve(n, `/art/${n}.svg`),
  label,
  tag: "VIBVID",
});

/* ----------------------- Character consistency ------------------------ */
// One cast member, carried across many videos — the payoff of Characters.

/** The recurring hero we follow across scenes. */
export const CONSISTENT_CHARACTER = {
  ...media("cast-neon-samurai", "/studio/cast-neon-samurai.svg", "Rei, the Neon Samurai", "Character"),
  name: "Rei",
  role: "Neon Samurai",
  blurb: "Cast once from a single reference. The same face, hair and wardrobe hold in every shot she appears in.",
};

/** The same character, generated into six different videos — same identity throughout. */
export const CHARACTER_SCENES: ShowcaseMedia[] = [
  media("hero-video", "/studio/set-neon-tokyo.svg", "Rain-soaked Tokyo alley", "Scene 01"),
  media("set-cloud-temple", "/studio/set-cloud-temple.svg", "Duel at the cloud temple", "Scene 02"),
  media("set-mars-colony", "/studio/set-mars-colony.svg", "Aboard the Mars colony", "Scene 03"),
  media("set-underwater-city", "/studio/set-underwater-city.svg", "The drowned city", "Scene 04"),
  media("set-desert-highway", "/studio/set-desert-highway.svg", "Desert highway at dusk", "Scene 05"),
  media("set-enchanted-forest", "/studio/set-enchanted-forest.svg", "Deep in the spirit forest", "Scene 06"),
];

/* --------------------------- Long-form seasons ------------------------- */
// How individual shots ladder up into episodes, seasons and full films.

export interface EpisodeBeat {
  n: string;
  title: string;
  runtime: string;
  scenes: string;
  media: ShowcaseMedia;
}

/** A three-episode "season" assembled from scenes of the same cast. */
export const SEASON: EpisodeBeat[] = [
  {
    n: "E01",
    title: "The Awakening",
    runtime: "2:40",
    scenes: "8 scenes",
    media: media("set-neon-tokyo", "/studio/set-neon-tokyo.svg", "The Awakening", "Episode 1"),
  },
  {
    n: "E02",
    title: "Into the Temple",
    runtime: "3:10",
    scenes: "11 scenes",
    media: media("set-cloud-temple", "/studio/set-cloud-temple.svg", "Into the Temple", "Episode 2"),
  },
  {
    n: "E03",
    title: "The Last Stand",
    runtime: "3:55",
    scenes: "14 scenes",
    media: media("set-mars-colony", "/studio/set-mars-colony.svg", "The Last Stand", "Episode 3"),
  },
];

/** The "Made with VIBVID" gallery. */
export const SHOWCASE: ShowcaseMedia[] = [
  TILE("art-product-reveal", "Product reveal"),
  TILE("art-neon-tokyo", "Neon Tokyo"),
  TILE("art-cyber-detective", "Cyber Detective"),
  TILE("art-forest-spirit", "Forest Spirit"),
  TILE("art-ballet", "Ballet study"),
  TILE("art-desert-run", "Desert run"),
  TILE("art-underwater-city", "Underwater City"),
  TILE("art-astro-mars", "Mars Colony"),
  TILE("art-cloud-temple", "Cloud Temple"),
  TILE("art-evening-gown", "Evening Gown"),
];
