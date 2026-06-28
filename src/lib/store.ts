"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type Asset,
  type Category,
  type GenerateParams,
  type VideoJob,
} from "./types";
import { pickSample } from "./samples";
import { getModel, priceFor } from "./models";
import { ASSET_CLASSES, CATALOG, categoryIdForClass, thumbFor } from "./catalog";
import { uid } from "./utils";

const STARTING_CREDITS = 1200;

// Module-level (non-persisted) handles for the in-flight simulation timers.
const timers = new Map<string, ReturnType<typeof setInterval>>();

/** Seeded class folders mirror the five asset classes; they're system folders. */
function seedCategories(): Category[] {
  const now = Date.now();
  return ASSET_CLASSES.map((c, i) => ({
    id: c.categoryId,
    name: c.plural,
    createdAt: now + i,
    system: true,
  }));
}

/** Curated starter library so the studio is "properly set up" from first load. */
function seedAssets(): Asset[] {
  const now = Date.now();
  const starters: Asset[] = CATALOG.map((e, i) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    url: thumbFor(e.id),
    posterUrl: e.kind === "image" ? thumbFor(e.id) : undefined,
    categoryId: categoryIdForClass(e.class),
    source: "starter" as const,
    class: e.class,
    owner: "user" as const,
    promptFragment: e.promptFragment,
    accent: e.accent,
    createdAt: now + i,
  }));

  // An example composite Character — a face image + reference clip + voice
  // bundled as one reusable identity, scoped to the Business library.
  const aria: Asset = {
    id: "ast-composite-aria",
    name: "Aria — Brand Host",
    kind: "image",
    url: thumbFor("cast-cyber-detective"),
    posterUrl: thumbFor("cast-cyber-detective"),
    categoryId: categoryIdForClass("character"),
    source: "starter",
    class: "character",
    owner: "business",
    promptFragment: "the brand host Aria",
    accent: "#36c5d6",
    createdAt: now + 100,
    parts: [
      { role: "face", kind: "image", url: thumbFor("cast-cyber-detective"), posterUrl: thumbFor("cast-cyber-detective"), label: "Face" },
      { role: "reference", kind: "video", url: "/samples/clip1.mp4", posterUrl: "/samples/poster1.svg", label: "Reference clip" },
      { role: "voice", kind: "audio", url: thumbFor("score-ambient"), label: "Voice sample" },
    ],
  };

  // A couple more Business-scoped assets so the My / Business toggle has content.
  const businessExtras: Asset[] = [
    {
      id: "ast-biz-uniform",
      name: "Brand Uniform",
      kind: "image",
      url: thumbFor("dress-tuxedo"),
      posterUrl: thumbFor("dress-tuxedo"),
      categoryId: categoryIdForClass("dress"),
      source: "starter",
      class: "dress",
      owner: "business",
      promptFragment: "the official brand uniform",
      accent: "#3a4a7a",
      createdAt: now + 101,
    },
    {
      id: "ast-biz-jingle",
      name: "Brand Jingle",
      kind: "audio",
      url: thumbFor("score-synthwave"),
      categoryId: categoryIdForClass("audio"),
      source: "starter",
      class: "audio",
      owner: "business",
      promptFragment: "the upbeat brand jingle",
      accent: "#ff5db8",
      createdAt: now + 102,
    },
  ];

  return [aria, ...businessExtras, ...starters];
}

function hasRefs(p: GenerateParams): boolean {
  return !!(p.refAssetId || (p.elements && p.elements.length > 0));
}

interface StoreState {
  hasHydrated: boolean;
  credits: number;
  videos: VideoJob[];
  assets: Asset[];
  categories: Category[];
  /** Director's note carried from a "Remix" action into the Studio. */
  draftDirection: string | null;
  /** Shot element ids carried from a "Remix" action into the Studio. */
  draftElements: string[] | null;
  /** Asset id carried from a "Use in Studio" action into the Studio. */
  draftRefAssetId: string | null;

  setHasHydrated: (v: boolean) => void;

  // generation
  estimate: (p: Pick<GenerateParams, "tier" | "durationSec" | "modelId" | "refAssetId">) => number;
  generate: (p: GenerateParams) => string;
  removeVideo: (id: string) => void;
  setDraftDirection: (direction: string | null) => void;
  setDraftElements: (elements: string[] | null) => void;
  setDraftRef: (assetId: string | null) => void;

  // credits
  addCredits: (n: number) => void;

  // assets
  addAsset: (a: Omit<Asset, "id" | "createdAt">) => Asset;
  saveVideoToAssets: (videoId: string, categoryId?: string | null) => Asset | null;
  removeAsset: (id: string) => void;
  renameAsset: (id: string, name: string) => void;
  moveAsset: (id: string, categoryId: string | null) => void;

  // categories
  addCategory: (name: string) => Category;
  renameCategory: (id: string, name: string) => void;
  removeCategory: (id: string) => void;
}

function patchVideo(set: StoreSet, id: string, patch: Partial<VideoJob>) {
  set((s) => ({
    videos: s.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)),
  }));
}

type StoreSet = (
  partial: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>),
) => void;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      credits: STARTING_CREDITS,
      videos: [],
      assets: seedAssets(),
      categories: seedCategories(),
      draftDirection: null,
      draftElements: null,
      draftRefAssetId: null,

      setHasHydrated: (v) => set({ hasHydrated: v }),

      estimate: (p) =>
        priceFor(getModel(p.modelId), {
          durationSec: p.durationSec,
          count: 1,
          hasRefs: !!p.refAssetId,
        }),

      generate: (p) => {
        const model = getModel(p.modelId);
        const modality = p.modality ?? model.modality;
        const cost = priceFor(model, {
          durationSec: p.durationSec,
          count: 1,
          hasRefs: hasRefs(p),
        });
        const id = uid("vid");
        const job: VideoJob = {
          id,
          prompt: p.prompt.trim(),
          status: "rendering",
          progress: 0,
          tier: p.tier,
          durationSec: p.durationSec,
          aspectRatio: p.aspectRatio,
          audio: p.audio,
          modelId: model.id,
          modality,
          refAssetId: p.refAssetId ?? null,
          elements: p.elements,
          direction: p.direction,
          creditsCost: cost,
          createdAt: Date.now(),
        };

        set((s) => ({ credits: s.credits - cost, videos: [job, ...s.videos] }));

        // Simulate an async render: progress ticks, then a sample result lands.
        let progress = 0;
        const sampleIndex = get().videos.length;
        const interval = setInterval(() => {
          progress = Math.min(100, progress + 9 + Math.random() * 12);
          if (progress >= 100) {
            clearInterval(interval);
            timers.delete(id);
            const sample = pickSample(sampleIndex);
            patchVideo(set, id, {
              status: "succeeded",
              progress: 100,
              // Image models produce a still; video models produce a clip.
              videoUrl: modality === "image" ? undefined : sample.video,
              posterUrl: p.posterUrl ?? sample.poster,
            });
          } else {
            patchVideo(set, id, { progress: Math.round(progress) });
          }
        }, 380);
        timers.set(id, interval);

        return id;
      },

      removeVideo: (id) => {
        const t = timers.get(id);
        if (t) {
          clearInterval(t);
          timers.delete(id);
        }
        set((s) => ({ videos: s.videos.filter((v) => v.id !== id) }));
      },

      setDraftDirection: (direction) => set({ draftDirection: direction }),

      setDraftElements: (elements) => set({ draftElements: elements }),

      setDraftRef: (assetId) => set({ draftRefAssetId: assetId }),

      addCredits: (n) => set((s) => ({ credits: s.credits + n })),

      addAsset: (a) => {
        const asset: Asset = { ...a, id: uid("ast"), createdAt: Date.now() };
        set((s) => ({ assets: [asset, ...s.assets] }));
        return asset;
      },

      saveVideoToAssets: (videoId, categoryId = null) => {
        const v = get().videos.find((x) => x.id === videoId);
        if (!v) return null;
        const isImage = v.modality === "image";
        return get().addAsset({
          name: v.prompt.slice(0, 40) || (isImage ? "Generated image" : "Generated video"),
          kind: isImage ? "image" : "video",
          url: (isImage ? v.posterUrl : v.videoUrl) ?? v.posterUrl ?? "",
          posterUrl: v.posterUrl,
          categoryId,
          source: "generation",
        });
      },

      removeAsset: (id) => set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),

      renameAsset: (id, name) =>
        set((s) => ({
          assets: s.assets.map((a) => (a.id === id ? { ...a, name } : a)),
        })),

      moveAsset: (id, categoryId) =>
        set((s) => ({
          assets: s.assets.map((a) => (a.id === id ? { ...a, categoryId } : a)),
        })),

      addCategory: (name) => {
        const cat: Category = { id: uid("cat"), name: name.trim(), createdAt: Date.now() };
        set((s) => ({ categories: [...s.categories, cat] }));
        return cat;
      },

      renameCategory: (id, name) =>
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, name } : c)),
        })),

      removeCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          // orphaned assets fall back to "Uncategorized"
          assets: s.assets.map((a) => (a.categoryId === id ? { ...a, categoryId: null } : a)),
        })),
    }),
    {
      name: "mightymak-v3",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // Reseed the library around the new class taxonomy when upgrading from an
      // older shape; keep the user's credits and generated videos.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<StoreState>;
        if (version < 3) {
          return { ...s, assets: seedAssets(), categories: seedCategories() } as StoreState;
        }
        return s as StoreState;
      },
      partialize: (s) => ({
        credits: s.credits,
        videos: s.videos,
        assets: s.assets,
        categories: s.categories,
      }),
      onRehydrateStorage: () => (state) => {
        // A render interrupted by a tab close shouldn't hang — settle it with a sample.
        state?.videos.forEach((v, i) => {
          if (v.status === "rendering") {
            const sample = pickSample(i);
            v.status = "succeeded";
            v.progress = 100;
            if (v.modality !== "image") v.videoUrl = v.videoUrl ?? sample.video;
            v.posterUrl = v.posterUrl ?? sample.poster;
          }
        });
        state?.setHasHydrated(true);
      },
    },
  ),
);
