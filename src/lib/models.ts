// The AI model registry. Each entry is data describing a pluggable provider —
// its modality, capabilities, params and pricing. The UI renders model pickers
// and cost from this; today every model routes to the same simulated render,
// and a real BytePlus adapter slots in behind the same shape later.

import type { Modality } from "./types";

export type Resolution = "480p" | "720p" | "1080p";

export type Capability =
  | "text-to-video"
  | "image-to-video"
  | "text-to-image"
  | "image-to-image";

export interface ModelProvider {
  id: string;
  name: string;
  vendor: string;
  modality: Modality;
  capabilities: Capability[];
  blurb: string;
  /** Emoji glyph used as a lightweight model avatar. */
  glyph: string;
  accent: string;
  badge?: "recommended" | "fast" | "new" | "soon";
  enabled: boolean;
  /** Video pricing: flat fallback rate (credits per second). */
  creditsPerSec?: number;
  /**
   * Quality-priced rates: credits per second at each resolution. Grounded in
   * upstream token pricing — tokens scale with pixels × seconds, so 720p costs
   * ~2.2× a 480p render and 1080p ~5×.
   */
  creditsPerSecByRes?: Partial<Record<Resolution, number>>;
  /** Resolutions this model can render. */
  resolutions?: Resolution[];
  maxDurationSec?: number;
  /** Image pricing. */
  creditsPerImage?: number;
  /** Real BytePlus ModelArk model id — presence enables real generation. */
  arkModel?: string;
  /** Default resolution for this model. */
  arkResolution?: Resolution;
  /** Image output class — newer Seedream models require ≥2K canvases. */
  arkSize?: "1k" | "2k";
}

export const MODELS: ModelProvider[] = [
  {
    id: "seedance-2-pro",
    name: "Mak Production",
    vendor: "MightyMak",
    modality: "video",
    capabilities: ["text-to-video", "image-to-video"],
    blurb: "The detailed production model — cinematic motion, native audio, up to 1080p.",
    glyph: "🎬",
    accent: "#6d5ef8",
    badge: "recommended",
    enabled: true,
    creditsPerSec: 12,
    creditsPerSecByRes: { "480p": 6, "720p": 12, "1080p": 24 },
    resolutions: ["480p", "720p", "1080p"],
    maxDurationSec: 15,
    arkModel: "dreamina-seedance-2-0-260128",
    arkResolution: "1080p",
  },
  {
    id: "seedance-2-mini",
    name: "Mak Draft",
    vendor: "MightyMak",
    modality: "video",
    capabilities: ["text-to-video", "image-to-video"],
    blurb: "The draft model — fast, cheap takes to explore ideas before a Production render.",
    glyph: "✏️",
    accent: "#0d9488",
    badge: "fast",
    enabled: true,
    creditsPerSec: 3,
    creditsPerSecByRes: { "480p": 3, "720p": 6 },
    resolutions: ["480p", "720p"],
    maxDurationSec: 15,
    arkModel: "dreamina-seedance-2-0-mini-260615",
    arkResolution: "480p",
  },
  {
    // Legacy tier — hidden from pickers; old generations still resolve its badge.
    id: "seedance-2-lite",
    name: "Mak Fast",
    vendor: "MightyMak",
    modality: "video",
    capabilities: ["text-to-video", "image-to-video"],
    blurb: "Faster, cheaper drafts at 720p.",
    glyph: "⚡",
    accent: "#0d9488",
    badge: "fast",
    enabled: false,
    creditsPerSec: 5,
    maxDurationSec: 15,
    arkModel: "dreamina-seedance-2-0-fast-260128",
    arkResolution: "720p",
  },
  {
    id: "seedream-3",
    name: "Mak Image",
    vendor: "MightyMak",
    modality: "image",
    capabilities: ["text-to-image"],
    blurb: "The proven workhorse — high-fidelity images with rich detail.",
    glyph: "🖼️",
    accent: "#d6457a",
    badge: "recommended",
    enabled: true,
    creditsPerImage: 8,
    arkModel: "seedream-4-0-250828",
  },
  {
    id: "seedream-45",
    name: "Mak Image Plus",
    vendor: "MightyMak",
    modality: "image",
    capabilities: ["text-to-image", "image-to-image"],
    blurb: "Sharper composition and better text rendering than 4.0.",
    glyph: "🎨",
    accent: "#b05ad0",
    enabled: true,
    creditsPerImage: 9,
    arkModel: "seedream-4-5-251128",
    arkSize: "2k",
  },
  {
    id: "seedream-5",
    name: "Mak Image Pro",
    vendor: "MightyMak",
    modality: "image",
    capabilities: ["text-to-image", "image-to-image"],
    blurb: "The flagship — best realism, lighting and fine detail.",
    glyph: "✨",
    accent: "#6d5ef8",
    badge: "new",
    enabled: true,
    creditsPerImage: 12,
    arkModel: "seedream-5-0-260128",
    arkSize: "2k",
  },
];

export const MODELS_BY_ID: Record<string, ModelProvider> = Object.fromEntries(
  MODELS.map((m) => [m.id, m]),
);

export const DEFAULT_MODEL_ID = "seedance-2-pro";

export function getModel(id?: string | null): ModelProvider {
  return (id && MODELS_BY_ID[id]) || MODELS_BY_ID[DEFAULT_MODEL_ID];
}

export function listModels(opts?: { modality?: Modality; enabledOnly?: boolean }): ModelProvider[] {
  return MODELS.filter(
    (m) =>
      (!opts?.modality || m.modality === opts.modality) &&
      (!opts?.enabledOnly || m.enabled),
  );
}

/** The resolution actually rendered: the requested one if the model supports it. */
export function clampResolution(model: ModelProvider, res?: string | null): Resolution {
  const supported = model.resolutions ?? (model.arkResolution ? [model.arkResolution] : ["720p" as Resolution]);
  if (res && (supported as string[]).includes(res)) return res as Resolution;
  return model.arkResolution ?? supported[supported.length - 1];
}

/** Credits per second on a model at a given quality. */
export function videoRate(model: ModelProvider, resolution?: string | null): number {
  const res = clampResolution(model, resolution);
  return model.creditsPerSecByRes?.[res] ?? model.creditsPerSec ?? 12;
}

/** Credits a generation will cost on a given model — quality included. */
export function priceFor(
  model: ModelProvider,
  opts: { durationSec?: number; count?: number; hasRefs?: boolean; resolution?: string | null },
): number {
  const refPenalty = opts.hasRefs ? 5 : 0;
  if (model.modality === "video") {
    const secs = opts.durationSec ?? 6;
    return Math.ceil(secs * videoRate(model, opts.resolution)) + refPenalty;
  }
  const count = opts.count ?? 1;
  return count * (model.creditsPerImage ?? 8) + refPenalty;
}
