// The UGC ad copy library — proven short-form ad formats, already written.
// Each template is a complete Seedance shooting script with {product} and
// {benefit} left open: the creator swaps in their own product and what it
// does for them, and the script is ready to render. Scripts are vertical
// (9:16), handheld, creator-energy — the native language of TikTok/Reels ads.
//
// Three formats:
//   product — a creator shows and reviews a physical product on camera
//   iphone  — a creator reacts around an iPhone whose screen runs the app
//             (app screenshots ride as references and must be reproduced)
//   screen  — a screen-recording style walkthrough with a voice-over

export type UgcFormat = "product" | "iphone" | "screen";

export interface UgcInputs {
  /** The product or app name, e.g. "Glow Serum" / "SleepWell". */
  product: string;
  /** The one benefit that carries the ad, e.g. "cleared my skin in a week". */
  benefit: string;
}

export interface UgcTemplate {
  id: string;
  name: string;
  tagline: string;
  format: UgcFormat;
  durationSec: number;
  /** The proven hook line, shown on the card (with placeholders filled). */
  hook: (i: UgcInputs) => string;
  /** The full Seedance script with the inputs swapped in. */
  script: (i: UgcInputs) => string;
}

/** Shared presenter language — one consistent UGC visual grammar. */
const UGC_STYLE =
  "Style: authentic UGC creator video, vertical 9:16 handheld selfie framing, phone front-camera look, ring-light catchlights, natural imperfect motion, soft daylight interior, true-to-life skin and textures, no text overlays, no captions, no watermark.";

export const UGC_TEMPLATES: UgcTemplate[] = [
  {
    id: "skeptic",
    name: "The Skeptic",
    tagline: "“I didn’t think it would work” — the highest-trust arc in UGC.",
    format: "product",
    durationSec: 12,
    hook: (i) => `Okay, I really didn’t think ${i.product} would work…`,
    script: (i) =>
      `UGC-style vertical ad. The creator speaks directly to their phone camera, handheld selfie framing.

0-3s: Tight selfie shot, the creator leans in with a doubtful half-smile and says "Okay, I really didn’t think ${i.product} would work". Natural window light, slight handheld sway.
3-6s: They raise ${i.product} into frame beside their face, turning it once so it reads clearly, eyebrows raised. Quick punch-in on the product.
6-9s: Fast cut: the product in use — hands demonstrating it naturally on a counter or in daily life, real textures, real motion.
9-12s: Back to the selfie shot, genuine surprised laugh, they point at the product and say "${i.benefit} — I’m honestly shocked".

Audio: casual room tone, soft trending acoustic beat underneath, the two spoken lines clear and natural, a small paper/foley detail when the product enters frame.

${UGC_STYLE}`,
  },
  {
    id: "three-reasons",
    name: "3 Reasons",
    tagline: "The listicle that retains — a reason every three seconds.",
    format: "product",
    durationSec: 12,
    hook: (i) => `Three reasons ${i.product} lives on my counter now`,
    script: (i) =>
      `UGC-style vertical ad, energetic jump-cut rhythm, creator to camera.

0-3s: Selfie framing, the creator holds up three fingers and says "Three reasons ${i.product} lives here now". Quick zoom punch on "three".
3-6s: Jump cut, they hold ${i.product} up close to the lens — reason one — mouthing enthusiastically, product label facing camera, crisp focus pull from face to product.
6-9s: Jump cut, product in use: hands demonstrating it in real daily context, fast and satisfying, one macro insert of its texture or mechanism.
9-12s: Jump cut back to selfie framing, they tap the product twice and say "${i.benefit} — that’s reason three", grin, quick nod.

Audio: upbeat percussive pop loop, whoosh on each jump cut, both spoken lines bright and clear, a click of the product being set down at the end.

${UGC_STYLE}`,
  },
  {
    id: "morning-routine",
    name: "Morning Routine",
    tagline: "POV aesthetic routine — the product earns its place.",
    format: "product",
    durationSec: 10,
    hook: (i) => `POV: the step of my morning I never skip`,
    script: (i) =>
      `UGC aesthetic routine clip, first-person POV, soft morning light.

0-3s: POV hands open bright curtains, warm sunrise floods a tidy bedroom, slow dreamy handheld drift.
3-6s: POV at a clean counter: hands reach past everyday items and pick up ${i.product}, a gentle rack focus lands on its label, steam or dust motes drifting in the light.
6-8s: Macro of ${i.product} in use — the exact product, its texture and finish rendered true — one slow satisfying beat.
8-10s: Mirror shot: the creator smiles at their reflection holding ${i.product}, and a warm voice-over says "${i.benefit}".

Audio: soft lo-fi morning beat, curtain swish, gentle counter foley, the single voice-over line warm and close.

${UGC_STYLE}`,
  },
  {
    id: "stop-scrolling",
    name: "Stop Scrolling",
    tagline: "Pattern interrupt — eight seconds, one job.",
    format: "product",
    durationSec: 8,
    hook: () => `Stop scrolling — you need to see this`,
    script: (i) =>
      `UGC-style vertical ad, maximum energy pattern interrupt.

0-2s: The creator’s palm covers the lens then pulls away fast to a tight selfie shot, they say "Stop scrolling — you need to see this", eyes wide, slight fisheye feel.
2-5s: Whip-pan to ${i.product} held dead center, crash-zoom onto the label, then a lightning-fast demonstration beat — the product doing its thing with real physics.
5-8s: Snap back to the creator holding it beside their face: "${i.benefit}. You’re welcome." Confident smirk, quick outward push ending the clip mid-motion.

Audio: bass-heavy trending beat that drops at the whip-pan, whoosh and impact hits on the cuts, both lines punchy and clear.

${UGC_STYLE}`,
  },
  {
    id: "before-after",
    name: "Before / After",
    tagline: "The oldest ad on earth, still undefeated.",
    format: "product",
    durationSec: 10,
    hook: (i) => `Me before ${i.product} vs. me after`,
    script: (i) =>
      `UGC-style vertical ad built on one hard before/after cut.

0-3s: Muted, slightly desaturated selfie shot: the creator looks tired and unimpressed, gestures at the everyday problem, shoulders slumped. Flat grey light. A voice-over says "me, before ${i.product}".
3-5s: They lift ${i.product} into frame; on the beat the whole grade snaps to warm and vivid — a hard cut, same framing, new world.
5-8s: Bright quick montage: the product in use, confident hands, one macro insert of its detail, everything saturated and alive.
8-10s: Tight happy selfie shot, the creator taps the product and says "${i.benefit}", genuine smile, small shrug like it’s obvious.

Audio: dull room tone in the before, a riser into the cut, warm upbeat track after, the two lines clear, one satisfying foley hit on the transition.

${UGC_STYLE}`,
  },
  {
    id: "unboxing",
    name: "First Unboxing",
    tagline: "Anticipation does the selling.",
    format: "product",
    durationSec: 10,
    hook: (i) => `It finally came — unboxing ${i.product}`,
    script: (i) =>
      `UGC unboxing clip, tabletop + selfie mix, real anticipation.

0-3s: Overhead tabletop shot: hands slide a clean parcel into frame and tear the tab in one satisfying motion, crisp paper physics, soft daylight.
3-6s: The creator lifts ${i.product} out slowly toward the lens, tissue paper falling away, the exact product with its true label and finish catching the light, a quiet "oh wow" off camera.
6-8s: Macro pass over ${i.product} — texture, edges, finish — slow orbit, shallow focus.
8-10s: Selfie framing, the creator holds it up beside their grin and says "${i.benefit} — worth the wait".

Audio: gentle acoustic bed, rich unboxing foley (tape rip, paper rustle, soft thunk), the whispered reaction and final line natural and close.

${UGC_STYLE}`,
  },
  {
    id: "app-fixed-it",
    name: "This App Fixed It",
    tagline: "Problem → phone screen → result. The app-install classic.",
    format: "iphone",
    durationSec: 12,
    hook: (i) => `I was doing this the hard way until ${i.product}`,
    script: (i) =>
      `UGC-style vertical app ad. The app's real interface (from the attached screenshots) appears on the iPhone screen and must be reproduced exactly — same layout, same colors.

0-3s: Tight selfie shot, the creator rubs their forehead and says "I was doing this the hard way until ${i.product}", exasperated half-laugh, cozy room behind.
3-7s: They raise an iPhone toward the lens; the screen fills the frame showing the app exactly as in the reference screenshots, a thumb scrolls and taps through it naturally, subtle screen glow on their fingers.
7-9s: Over-the-shoulder shot: the app on screen mid-action, the creator nodding along, the interface crisp and legible.
9-12s: Back to selfie framing, phone lowered, they point at the camera and say "${i.benefit} — it’s free, just get it", easy smile.

Audio: light plucky tech beat, soft UI tap sounds synced to the thumb, both spoken lines conversational and clear.

${UGC_STYLE}`,
  },
  {
    id: "screen-walkthrough",
    name: "Watch Me Use It",
    tagline: "A guided screen demo — voice-over sells the flow.",
    format: "screen",
    durationSec: 12,
    hook: (i) => `Let me show you ${i.product} in 10 seconds`,
    script: (i) =>
      `Screen-recording style demo with a warm voice-over. The interface shown is exactly the attached screenshots — reproduce the layout, colors and content faithfully; a cursor moves naturally through it.

0-3s: The screen fades in on the product's main view exactly as in the reference screenshots; a cursor glides to the primary action as the voice-over says "let me show you ${i.product}".
3-7s: Smooth guided flow: the cursor clicks through the key screens from the references in order, each click landing with a gentle zoom toward the acted-on element, interface crisp and legible throughout.
7-10s: The payoff screen: the result view holds center frame, a slow subtle push-in, small celebratory motion in the UI.
10-12s: Hold on the final screen as the voice-over closes: "${i.benefit} — try it today". Clean end frame.

Audio: minimal soft-key electronic bed, gentle click and whoosh sounds synced to the cursor, the two voice-over lines warm and unhurried.

Style: high-fidelity screen capture look, exact reproduction of the referenced interface, smooth 60fps cursor motion, subtle depth shadows, no invented UI text beyond the references, no watermark.`,
  },
];

export const UGC_FORMATS: { key: UgcFormat; label: string; blurb: string }[] = [
  { key: "product", label: "Product in hand", blurb: "A creator shows your product on camera" },
  { key: "iphone", label: "iPhone app", blurb: "Your app on an iPhone, creator reacts" },
  { key: "screen", label: "Screen demo", blurb: "A guided walkthrough of your screens" },
];
