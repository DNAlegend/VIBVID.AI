// Landing-page media registry.
//
// >>> SWAP TARGET <<<
// These are PLACEHOLDERS using the existing demo art in /public. Once the
// ByteDance models are activated, generated files will be written to
// /public/generated/ and the `src`/`poster` paths below get pointed at them —
// the landing page reads only from here, so the swap is a one-file edit.
// Keep the shape (type / src / poster / label / tag) identical.

export interface ShowcaseMedia {
  id: string;
  type: "image" | "video";
  src: string;
  poster?: string;
  label: string;
  tag: string;
}

/** The big hero visual. */
export const HERO: ShowcaseMedia = {
  id: "hero",
  type: "image",
  src: "/art/hero-neon-city.svg",
  label: "Neon samurai in rain-soaked Tokyo",
  tag: "Seedance 2.0",
};

/** The prompt shown typed into the hero's mock studio bar. */
export const HERO_PROMPT =
  "A neon samurai walks through rain-soaked Tokyo at night, cinematic slow motion";

/** Small floating thumbnails layered over the hero for flavor. */
export const HERO_CHIPS: ShowcaseMedia[] = [
  { id: "chip-char", type: "image", src: "/studio/cast-neon-samurai.svg", label: "Neon Samurai", tag: "Character" },
  { id: "chip-scene", type: "image", src: "/studio/set-cloud-temple.svg", label: "Cloud Temple", tag: "Scene" },
  { id: "chip-dress", type: "image", src: "/studio/dress-evening-gown.svg", label: "Evening Gown", tag: "Dress" },
];

/** The "Made with MightyMak" gallery. */
export const SHOWCASE: ShowcaseMedia[] = [
  { id: "s1", type: "image", src: "/art/art-product-reveal.svg", label: "Product reveal", tag: "Image · Seedream" },
  { id: "s2", type: "image", src: "/art/art-neon-tokyo.svg", label: "Neon Tokyo", tag: "Image · Seedream" },
  { id: "s3", type: "image", src: "/art/art-cyber-detective.svg", label: "Cyber Detective", tag: "Image · Seedream" },
  { id: "s4", type: "image", src: "/art/art-forest-spirit.svg", label: "Forest Spirit", tag: "Image · Seedream" },
  { id: "s5", type: "image", src: "/art/art-ballet.svg", label: "Ballet study", tag: "Image · Seedream" },
  { id: "s6", type: "image", src: "/art/art-desert-run.svg", label: "Desert run", tag: "Image · Seedream" },
  { id: "s7", type: "image", src: "/art/art-underwater-city.svg", label: "Underwater City", tag: "Image · Seedream" },
  { id: "s8", type: "image", src: "/art/art-astro-mars.svg", label: "Mars Colony", tag: "Image · Seedream" },
  { id: "s9", type: "image", src: "/art/art-cloud-temple.svg", label: "Cloud Temple", tag: "Image · Seedream" },
  { id: "s10", type: "image", src: "/art/art-evening-gown.svg", label: "Evening Gown", tag: "Image · Seedream" },
];
