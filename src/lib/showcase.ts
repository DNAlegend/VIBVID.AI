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

/** The big hero clip. */
export const HERO: ShowcaseMedia = {
  id: "hero",
  type: "video",
  src: "/samples/clip1.mp4",
  poster: "/samples/poster1.svg",
  label: "Neon city flythrough",
  tag: "Seedance 2.0",
};

/** Small floating thumbnails layered over the hero for flavor. */
export const HERO_CHIPS: ShowcaseMedia[] = [
  { id: "chip-char", type: "image", src: "/studio/cast-neon-samurai.svg", label: "Neon Samurai", tag: "Character" },
  { id: "chip-scene", type: "image", src: "/studio/set-cloud-temple.svg", label: "Cloud Temple", tag: "Scene" },
  { id: "chip-dress", type: "image", src: "/studio/dress-evening-gown.svg", label: "Evening Gown", tag: "Dress" },
];

/** The "Made with Mighty Studio" gallery. */
export const SHOWCASE: ShowcaseMedia[] = [
  { id: "s1", type: "video", src: "/samples/clip2.mp4", poster: "/samples/poster2.svg", label: "Product reveal", tag: "Video · Seedance" },
  { id: "s2", type: "image", src: "/studio/set-neon-tokyo.svg", label: "Neon Tokyo", tag: "Image · Seedream" },
  { id: "s3", type: "image", src: "/studio/cast-cyber-detective.svg", label: "Cyber Detective", tag: "Image · Seedream" },
  { id: "s4", type: "video", src: "/samples/clip3.mp4", poster: "/samples/poster3.svg", label: "Forest spirit", tag: "Video · Seedance" },
  { id: "s5", type: "image", src: "/studio/dance-ballet.svg", label: "Ballet study", tag: "Image · Seedream" },
  { id: "s6", type: "image", src: "/studio/set-underwater-city.svg", label: "Underwater City", tag: "Image · Seedream" },
  { id: "s7", type: "video", src: "/samples/clip4.mp4", poster: "/samples/poster4.svg", label: "Desert run", tag: "Video · Seedance" },
  { id: "s8", type: "image", src: "/studio/dress-cyber-armor.svg", label: "Cyber Armor", tag: "Image · Seedream" },
];
