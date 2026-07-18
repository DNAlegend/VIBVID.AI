// Commercial use cases — the buyer-facing layer over the demo catalog. One
// source of truth for the landing #usecases section, the /use-cases SEO pages,
// the footer links and the sitemap.
//
// Positioning guardrail: VIBVID generates ORIGINAL scenes with consistent
// characters/products — it does not lip-sync presenters, clone voices, dub or
// translate footage, and impersonation is banned by the Acceptable Use Policy.
// Every use case below is framed honestly around what the engine really does:
// scenario re-enactments, b-roll, explainers and creator-style scenes.

import { DEMO_CONTENT, type DemoItem } from "./demo-content";

export interface UseCaseStep {
  title: string;
  body: string;
}

export interface UseCaseFaq {
  q: string;
  a: string;
}

export interface UseCase {
  /** URL segment: /use-cases/<slug> */
  slug: string;
  /** Short name for links, tags, footer. */
  label: string;
  /** Page h1. */
  title: string;
  /** Who buys this: shown as the card's small line + page badge. */
  buyer: string;
  /** One-line pain statement. */
  pain: string;
  /** Hero paragraph — honest capability framing. */
  intro: string;
  metaTitle: string;
  metaDescription: string;
  /** Purpose preset the CTAs deep-link to (see lib/purposes.ts). */
  purposeId: string;
  /** Flagship DemoItem for the landing card + page hero media. */
  heroDemoId: string;
  /** 3-4 "how VIBVID does it" steps referencing real features. */
  steps: UseCaseStep[];
  /** Extra prompt-only cards on the page (no clip needed). */
  extraPrompts: { title: string; prompt: string }[];
  faqs: UseCaseFaq[];
}

export const USE_CASES: UseCase[] = [
  {
    slug: "ai-ugc-ads",
    label: "AI UGC Ads",
    title: "AI UGC ads that convert — without briefing a single creator",
    buyer: "For e-commerce brands & performance agencies",
    pain: "Creator content converts, but sourcing and briefing creators for every ad variation is slow and expensive.",
    intro:
      "Generate creator-style ad scenes with original characters and your real product. Swap the hook, the setting or the angle and render a fresh variation in minutes — test 20 cuts for what one creator brief used to cost.",
    metaTitle: "AI UGC Ads — VIBVID.AI",
    metaDescription:
      "Produce creator-style UGC ad variations with AI: original characters, your real product, fresh hooks in minutes. From $19/month.",
    purposeId: "ugc-ad",
    heroDemoId: "ugc-skincare",
    steps: [
      {
        title: "Add your product",
        body: "Upload photos to Products and get a reference sheet — so the serum in every ad is your serum, not a lookalike.",
      },
      {
        title: "Board it",
        body: "Give the Storyboard the product and the angle — it writes the ad scene by scene, hook to call-to-action, and draws it as one sheet.",
      },
      {
        title: "Generate variations",
        body: "Change the hook, the setting, the energy — each render is a new creative to test, in 9:16 vertical.",
      },
      {
        title: "Download the winners",
        body: "Every render lands in My Videos in 1080p with native audio — download and post straight to Meta or TikTok.",
      },
    ],
    extraPrompts: [
      {
        title: "Unboxing reveal",
        prompt:
          "Overhead unboxing video: hands lift limited-edition sneakers out of a box on a wooden desk, tissue paper crinkles, warm afternoon light, satisfying slow reveal",
      },
      {
        title: "Morning-routine ad",
        prompt:
          "A guy taste-tests the coffee at his kitchen counter and reacts with delight, morning light, handheld iPhone framing, authentic creator energy",
      },
    ],
    faqs: [
      {
        q: "Are these real creators?",
        a: "No — every character is an original, AI-generated person you create and cast. That means no usage rights to negotiate and no re-booking a creator to change one line, and nobody real is being impersonated.",
      },
      {
        q: "Can it show my actual product?",
        a: "Yes. Add your product in the Products studio from a few photos; its reference sheet steers every scene so the product stays true to the real thing.",
      },
    ],
  },
  {
    slug: "product-explainers",
    label: "Product Explainers",
    title: "Product explainers & social content, shipped the same day",
    buyer: "For marketing teams",
    pain: "Every launch needs a video, and the design team is booked for weeks.",
    intro:
      "Turn a feature description into a polished explainer scene or a punchy social reel. Draft cheaply to iterate on the idea, then produce the final in full 1080p with native audio.",
    metaTitle: "AI Product Explainer Videos — VIBVID.AI",
    metaDescription:
      "Create product explainer videos and social content with AI — hero shots, feature scenes and vertical reels from a text brief. From $19/month.",
    purposeId: "explainer",
    heroDemoId: "product-earbuds",
    steps: [
      {
        title: "Add the product",
        body: "A few photos in Products gives you a reference sheet — every shot renders your product, true to material and finish.",
      },
      {
        title: "Describe the moment",
        body: "The feature, the reveal, the benefit — or let the Storyboard write a multi-scene launch film from one brief.",
      },
      {
        title: "Draft, then produce",
        body: "Iterate on the cheap Draft tier until the motion is right, then render the final in Production quality.",
      },
    ],
    extraPrompts: [
      {
        title: "Social food reel",
        prompt:
          "POV food reel: thick berry smoothie pours into a ceramic bowl, granola sprinkled on top in slow motion, bright morning kitchen, appetizing macro detail",
      },
      {
        title: "Feature highlight",
        prompt:
          "The earbuds pair to a phone on a clean desk, a soft pulse of light traveling between them, minimal tech aesthetic, bright modern setting",
      },
    ],
    faqs: [
      {
        q: "Can it record my app's UI?",
        a: "No — VIBVID generates original scenes and b-roll, not screen recordings. Upload your own screen captures to Assets, and cut them together with your generated scenes in any video editor.",
      },
      {
        q: "What formats can I export?",
        a: "16:9 widescreen, 9:16 vertical and 1:1 square, up to 1080p Full HD with native audio (4K on the Production model).",
      },
    ],
  },
  {
    slug: "training-videos",
    label: "Training Videos",
    title: "Training & compliance videos without a film crew",
    buyer: "For HR, L&D and operations teams",
    pain: "Procedures change; re-filming training footage every time doesn't scale.",
    intro:
      "Generate scenario re-enactments, safety demonstrations and explainer scenes with a consistent cast — and when the procedure changes, regenerate the scene instead of re-booking a crew. Your instructor stays your instructor; VIBVID makes the footage.",
    metaTitle: "AI Training & Compliance Videos — VIBVID.AI",
    metaDescription:
      "Create workplace training and compliance video scenes with AI — scenario re-enactments and safety demos with consistent characters, updated in minutes.",
    purposeId: "training",
    heroDemoId: "training-safety",
    steps: [
      {
        title: "Board the module",
        body: "Give the Storyboard the procedure — it writes the module scene by scene, timed and scripted.",
      },
      {
        title: "Cast a consistent employee",
        body: "Create a character once; the same face appears in every scenario across the whole course.",
      },
      {
        title: "Regenerate when things change",
        body: "New equipment, new steps? Regenerate the affected scenes — no crew, no reshoot, no scheduling.",
      },
      {
        title: "Download by lesson",
        body: "Each scene lands in My Videos ready to download — drop them into your LMS or cut modules together in any editor.",
      },
    ],
    extraPrompts: [
      {
        title: "Closing checklist",
        prompt:
          "A barista walks through the closing checklist behind the counter, wiping down the espresso machine step by step, clear instructional framing, bright even lighting",
      },
      {
        title: "PPE demonstration",
        prompt:
          "A lab technician puts on gloves, goggles and a coat in the correct order at a lab bench, each step clearly framed, clean instructional style",
      },
    ],
    faqs: [
      {
        q: "Can it make a talking presenter read my script?",
        a: "No — VIBVID doesn't lip-sync presenters, clone voices or generate talking-head avatars. It creates the scenario footage, demonstrations and b-roll; pair them with your own narration or instructor recordings.",
      },
      {
        q: "How do I keep the same 'employee' across 30 videos?",
        a: "Create them once in Characters. Their reference sheet locks the identity, so the same person appears in every scenario you generate.",
      },
    ],
  },
  {
    slug: "course-videos",
    label: "Course Videos",
    title: "Course visuals that make lessons land",
    buyer: "For course creators, educators & edtech",
    pain: "Lesson visuals and course intros are the difference between a slide deck and a course people finish.",
    intro:
      "Generate lesson visualizations, cinematic course intros and b-roll that make concepts click — you stay the teacher, VIBVID makes the visuals.",
    metaTitle: "AI Course & Education Videos — VIBVID.AI",
    metaDescription:
      "Create lesson visuals, course intros and educational b-roll with AI. Visualize any concept in video. From $19/month.",
    purposeId: "course",
    heroDemoId: "course-solar",
    steps: [
      {
        title: "Board the lesson's visuals",
        body: "Give the Storyboard your lesson outline — it boards a visual for every concept that needs one.",
      },
      {
        title: "Visualize anything",
        body: "The solar system forming, a medieval market, a cell dividing — if you can describe it, you can show it.",
      },
      {
        title: "Drop into your course",
        body: "Download scenes individually from My Videos and drop them straight into your course platform.",
      },
    ],
    extraPrompts: [
      {
        title: "History lesson intro",
        prompt:
          "A medieval market street comes to life around the camera, merchants and carts in period detail, documentary style, warm natural light, for a history lesson intro",
      },
      {
        title: "Biology visualization",
        prompt:
          "A cell divides in luminous microscopic detail, membranes stretching and separating, clear scientific visualization, deep blue backdrop",
      },
    ],
    faqs: [
      {
        q: "Can it translate or dub my lessons?",
        a: "No — VIBVID doesn't translate, dub or lip-sync footage. It generates original visuals; you keep your own voice and language.",
      },
      {
        q: "Do I own the videos for my paid course?",
        a: "Yes — commercial use is included on every plan, subject to the Terms of Service.",
      },
    ],
  },
  {
    slug: "internal-communications",
    label: "Internal Comms",
    title: "Internal videos your team will actually watch",
    buyer: "For internal comms, people teams & leadership",
    pain: "Company-wide emails get skimmed; a 30-second video gets watched.",
    intro:
      "Turn announcements, milestones and culture moments into short, energetic videos — made in minutes, not booked through an agency.",
    metaTitle: "AI Internal Communication Videos — VIBVID.AI",
    metaDescription:
      "Create internal announcement and culture videos with AI — launches, milestones and updates as watchable 30-second videos.",
    purposeId: "internal",
    heroDemoId: "internal-launch",
    steps: [
      {
        title: "Describe the announcement",
        body: "The launch, the milestone, the office move — one sentence is enough to start.",
      },
      {
        title: "Generate on the fast tier",
        body: "Internal videos don't need cinema budgets — the Draft-class model renders them fast and cheap.",
      },
      {
        title: "Share anywhere",
        body: "Export and drop it in Slack, Teams or the all-hands deck — 16:9 or vertical.",
      },
    ],
    extraPrompts: [
      {
        title: "Milestone celebration",
        prompt:
          "A rocket made of sticky notes lifts off a whiteboard as coworkers cheer, playful office energy, warm light, milestone announcement",
      },
      {
        title: "Welcome video scene",
        prompt:
          "A sunlit modern office lobby with plants, a welcome board reading nothing, friendly warm atmosphere, smooth dolly-in",
      },
    ],
    faqs: [
      {
        q: "Can our CEO deliver the message in the video?",
        a: "Not as an AI likeness — VIBVID doesn't clone real people's faces or voices, and impersonation is prohibited. Generate the b-roll and celebration scenes, then pair them with your CEO's real recording.",
      },
    ],
  },
  {
    slug: "customer-onboarding",
    label: "Customer Onboarding",
    title: "Onboarding & tutorial videos that stay fresh",
    buyer: "For SaaS product-marketing & customer-success teams",
    pain: "Feature videos go stale every release cycle.",
    intro:
      "Generate welcome scenes, feature-highlight visuals and explainer b-roll for your help centre and onboarding flows — and regenerate them in minutes when the product moves on.",
    metaTitle: "AI Customer Onboarding Videos — VIBVID.AI",
    metaDescription:
      "Create onboarding and tutorial video scenes with AI — welcome videos, feature highlights and help-centre explainers that are easy to keep current.",
    purposeId: "explainer",
    heroDemoId: "onboarding-checklist",
    steps: [
      {
        title: "Describe the feature moment",
        body: "The aha moment, the workflow, the outcome — VIBVID turns it into a clean explainer scene.",
      },
      {
        title: "Mix with your recordings",
        body: "Upload real screen captures to Assets and cut them together with your generated scenes in any editor.",
      },
      {
        title: "Refresh every release",
        body: "When the product changes, regenerate the affected scenes instead of re-producing the whole video.",
      },
    ],
    extraPrompts: [
      {
        title: "Welcome scene",
        prompt:
          "A friendly sunrise time-lapse over a clean desk setup as a laptop opens to a glowing dashboard, optimistic morning energy, modern tech aesthetic",
      },
      {
        title: "Success moment",
        prompt:
          "Confetti bursts softly over a laptop showing a completed progress bar, shallow depth of field, celebratory but clean",
      },
    ],
    faqs: [
      {
        q: "Can it capture my product's actual screens?",
        a: "No — generated scenes are original footage, not screen recordings. Upload your own captures to Assets and combine them with generated b-roll in your editor.",
      },
    ],
  },
];

export const USE_CASE_BY_SLUG: Record<string, UseCase> = Object.fromEntries(
  USE_CASES.map((u) => [u.slug, u]),
);

/** Demos surfaced for a use case (flagship first). */
export function demosFor(u: UseCase): DemoItem[] {
  return DEMO_CONTENT.filter((d) => d.useCase === u.slug).sort((a, b) =>
    a.id === u.heroDemoId ? -1 : b.id === u.heroDemoId ? 1 : 0,
  );
}

/** The flagship demo for a use case. */
export function heroDemo(u: UseCase): DemoItem {
  return DEMO_CONTENT.find((d) => d.id === u.heroDemoId) ?? demosFor(u)[0];
}
