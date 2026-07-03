// The AI model registry. Each entry is data describing a pluggable provider —
// its modality, capabilities, params and pricing. The UI renders model pickers
// and cost from this; today every model routes to the same simulated render,
// and a real BytePlus adapter slots in behind the same shape later.

import type { Modality } from "./types";

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
  /** Video pricing. */
  creditsPerSec?: number;
  maxDurationSec?: number;
  /** Image pricing. */
  creditsPerImage?: number;
  /** Real BytePlus ModelArk model id — presence enables real generation. */
  arkModel?: string;
  /** Seedance resolution flag; encodes this tier's quality positioning. */
  arkResolution?: "480p" | "720p" | "1080p";
}

export const MODELS: ModelProvider[] = [
  {
    id: "seedance-2-pro",
    name: "Seedance 2.0 Pro",
    vendor: "ByteDance",
    modality: "video",
    capabilities: ["text-to-video", "image-to-video"],
    blurb: "Flagship cinematic video — strong motion, native audio, up to 2K.",
    glyph: "🎬",
    accent: "#6d5ef8",
    badge: "recommended",
    enabled: true,
    creditsPerSec: 12,
    maxDurationSec: 10,
    arkModel: "dreamina-seedance-2-0-260128",
    arkResolution: "1080p",
  },
  {
    id: "seedance-2-lite",
    name: "Seedance 2.0 Lite",
    vendor: "ByteDance",
    modality: "video",
    capabilities: ["text-to-video", "image-to-video"],
    blurb: "Faster, cheaper drafts. Great for iterating before a Pro render.",
    glyph: "⚡",
    accent: "#0d9488",
    badge: "fast",
    enabled: true,
    creditsPerSec: 5,
    maxDurationSec: 8,
    arkModel: "dreamina-seedance-2-0-fast-260128",
    arkResolution: "720p",
  },
  {
    id: "seedream-3",
    name: "Seedream 3.0",
    vendor: "ByteDance",
    modality: "image",
    capabilities: ["text-to-image"],
    blurb: "High-fidelity image generation with crisp text and rich detail.",
    glyph: "🖼️",
    accent: "#d6457a",
    badge: "new",
    enabled: true,
    creditsPerImage: 8,
    arkModel: "seedream-4-0-250828",
  },
  {
    id: "seededit-3",
    name: "SeedEdit 3.0",
    vendor: "ByteDance",
    modality: "image",
    capabilities: ["image-to-image"],
    blurb: "Edit and restyle an existing image from a text instruction.",
    glyph: "✨",
    accent: "#c2820a",
    badge: "soon",
    enabled: false,
    creditsPerImage: 6,
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

/** Credits a generation will cost on a given model. */
export function priceFor(
  model: ModelProvider,
  opts: { durationSec?: number; count?: number; hasRefs?: boolean },
): number {
  const refPenalty = opts.hasRefs ? 5 : 0;
  if (model.modality === "video") {
    const secs = opts.durationSec ?? 6;
    return Math.ceil(secs * (model.creditsPerSec ?? 12)) + refPenalty;
  }
  const count = opts.count ?? 1;
  return count * (model.creditsPerImage ?? 8) + refPenalty;
}
