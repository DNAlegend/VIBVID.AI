"use client";

// Storyboard — the story room, two levels deep:
//
// STORY (the master planner): give it a story idea plus a CAST — saved
// characters, products, any of your assets — and how many parts to tell it
// in. The Story Writer (Claude) plans one continuous arc and breaks it into
// N parts; each part is a full storyboard of its own (a Seedance flow whose
// scenes sum to the part length + a nine-panel sheet prompt). Each part
// draws its sheet (cast reference photos steer identity) and can generate
// its VIDEO right here — the sheet + the cast sheets ride as references with
// an explicit legend, so the same faces and products carry across every clip.
//
// SINGLE STORYBOARD: the classic one-off product commercial — one board,
// one sheet, one prompt.
//
// Boards from either path save themselves as storyboard assets, so they all
// work in the Studio too. Stories save as 'story' assets grouping their
// parts. Everything is private to the creator.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clapperboard,
  Clock,
  Coins,
  Copy,
  Film,
  LayoutGrid,
  Loader2,
  Plus,
  Package,
  PenLine,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase, cloudConfigured } from "@/lib/supabase";
import { getModel, priceFor, videoRate } from "@/lib/models";
import { storyboardDurationSec } from "@/lib/storyboard";
import { clearPendingSheet, getPendingSheet, setPendingSheet } from "@/lib/pending-sheet";
import { DURATIONS, type Asset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, EmptyState, Progress } from "@/components/ui";
import { thumbFor } from "@/lib/catalog";

const textareaCls =
  "w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-base leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm";

/** Public https photos of a product composite — the image-model identity refs. */
function productPhotoUrls(p: Asset): string[] {
  const urls = (p.parts ?? [])
    .filter((x) => x.kind === "image" && /^https:\/\//i.test(x.url))
    .map((x) => x.url);
  return urls.slice(0, 5);
}

/* ------------------------------ Story types ------------------------------ */

/** One part of a story — its own storyboard, sheet render and video. */
interface StoryPart {
  title: string;
  flow: string;
  imagePrompt: string;
  /** In-flight/finished sheet render job. */
  sheetJobId?: string | null;
  /** The saved storyboard asset for this part (set once the sheet lands). */
  boardId?: string | null;
  /** In-flight/finished video render job. */
  videoJobId?: string | null;
}

/** Video tier a story's clips render on. */
type StoryTier = "mini" | "pro" | "4k";
const STORY_TIERS: Record<StoryTier, { label: string; modelId: string; resolution: string }> = {
  mini: { label: "Mini · 720p", modelId: "seedance-2-mini", resolution: "720p" },
  pro: { label: "Pro · 1080p", modelId: "seedance-2-pro", resolution: "1080p" },
  "4k": { label: "4K", modelId: "seedance-2-pro", resolution: "4K" },
};

/** The whole story being planned — persisted as a 'story' asset. */
interface StoryDraft {
  title: string;
  logline: string;
  brief: string;
  castIds: string[];
  durationSec: number;
  partsCount: number;
  tier: StoryTier;
  parts: StoryPart[];
  storyAssetId?: string | null;
}

const STORY_RECIPE_LABEL = "Recipe";

/** Read a saved story back into an editable draft. */
function storyDraftOf(a: Asset): StoryDraft | null {
  const part = a.parts?.find((p) => p.label === STORY_RECIPE_LABEL);
  if (!part) return null;
  try {
    const r = JSON.parse(part.url) as Partial<StoryDraft>;
    if (!Array.isArray(r.parts)) return null;
    return {
      title: r.title ?? a.name,
      logline: r.logline ?? "",
      brief: r.brief ?? "",
      castIds: Array.isArray(r.castIds) ? r.castIds : [],
      durationSec: typeof r.durationSec === "number" ? r.durationSec : 10,
      partsCount: r.parts.length,
      tier: (r.tier as StoryTier) ?? "pro",
      parts: r.parts.map((p) => ({
        title: p?.title ?? "",
        flow: p?.flow ?? "",
        imagePrompt: p?.imagePrompt ?? "",
        sheetJobId: p?.sheetJobId ?? null,
        boardId: p?.boardId ?? null,
        videoJobId: p?.videoJobId ?? null,
      })),
      storyAssetId: a.id,
    };
  } catch {
    return null;
  }
}

export function StoryboardStudio() {
  const router = useRouter();
  /** Gallery first — the creation wizard opens on "Add new". */
  const [creating, setCreating] = useState(false);
  const assets = useStore((s) => s.assets);
  const videos = useStore((s) => s.videos);
  const credits = useStore((s) => s.credits);
  const hydrated = useStore((s) => s.hasHydrated);
  const generate = useStore((s) => s.generate);
  const addAsset = useStore((s) => s.addAsset);
  const addCategory = useStore((s) => s.addCategory);
  const removeAsset = useStore((s) => s.removeAsset);
  const setDraftElements = useStore((s) => s.setDraftElements);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const cloudUser = useStore((s) => s.cloudUser);
  const subscribed = useStore((s) => s.subscribed);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const [productId, setProductId] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [durationSec, setDurationSec] = useState<number>(10);
  const [title, setTitle] = useState("");
  const [flow, setFlow] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  /** Job ids already auto-saved — a board saves itself exactly once. */
  const savedJobs = useRef<Set<string>>(new Set());
  const [savedAssetId, setSavedAssetId] = useState<string | null>(null);
  /** Saved-board card whose full prompt is expanded. */
  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const boards = useMemo(() => assets.filter((a) => a.class === "storyboard"), [assets]);
  const products = useMemo(
    () => assets.filter((a) => a.class === "product" && (a.parts?.length ?? 0) > 0),
    [assets],
  );
  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  /* ------------------------------ Story state ----------------------------- */
  const updateAsset = useStore((s) => s.updateAsset);
  const stories = useMemo(() => assets.filter((a) => a.class === "story"), [assets]);
  /** Anything castable in a story: saved characters and products. */
  const castOptions = useMemo(
    () =>
      assets.filter(
        (a) => (a.class === "character" || a.class === "product") && (a.parts?.length ?? 0) > 0,
      ),
    [assets],
  );
  const [storyView, setStoryView] = useState(false);
  const [story, setStory] = useState<StoryDraft | null>(null);
  const [storyWriting, setStoryWriting] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  // Inputs for a new story (kept when re-writing).
  const [storyBrief, setStoryBrief] = useState("");
  const [storyCastIds, setStoryCastIds] = useState<string[]>([]);
  const [storyPartsCount, setStoryPartsCount] = useState(4);
  const [storyDur, setStoryDur] = useState(10);
  const [storyTier, setStoryTier] = useState<StoryTier>("pro");
  /** Part whose full flow is expanded for editing. */
  const [openPartFlow, setOpenPartFlow] = useState<number | null>(null);
  /** Sheet jobs already saved as boards — each sheet persists exactly once. */
  const storySavedSheets = useRef<Set<string>>(new Set());

  const imageModel = getModel("gpt-image-2");
  const sheetCost = priceFor(imageModel, { count: 1 });
  const storyVideoModel = getModel(STORY_TIERS[story?.tier ?? storyTier].modelId);
  const storyVideoRes = STORY_TIERS[story?.tier ?? storyTier].resolution;
  const clipCost = videoRate(storyVideoModel, storyVideoRes) * (story?.durationSec ?? storyDur);

  /** Identity reference photos for the cast (character sheets, product photos). */
  const castRefUrls = useCallback(
    (ids: string[], cap: number): string[] => {
      const urls: string[] = [];
      for (const id of ids) {
        const a = byId[id];
        if (!a) continue;
        if (a.class === "product") urls.push(...productPhotoUrls(a).slice(0, 2));
        else if (/^https:\/\//i.test(a.url)) urls.push(a.url);
      }
      return urls.slice(0, cap);
    },
    [byId],
  );

  /** Persist the story as a 'story' asset once at least one sheet exists. */
  const persistStory = useCallback(
    (d: StoryDraft): StoryDraft => {
      const cover =
        d.parts.map((p) => (p.boardId ? byId[p.boardId]?.url : null)).find(Boolean) ?? null;
      if (!cover) return d;
      const recipe = JSON.stringify({ ...d, storyAssetId: undefined });
      const parts = [
        { role: "primary", kind: "image", url: cover, posterUrl: cover, label: "Story cover" },
        { role: "reference", kind: "prompt", url: recipe, label: STORY_RECIPE_LABEL },
      ] as Asset["parts"];
      const name = d.title.trim() || "New story";
      if (d.storyAssetId && byId[d.storyAssetId]) {
        updateAsset(d.storyAssetId, { name, url: cover, posterUrl: cover, promptFragment: d.logline, parts });
        return d;
      }
      const col = addCategory(`${name} — story`);
      const a = addAsset({
        name,
        kind: "image",
        url: cover,
        posterUrl: cover,
        categoryId: col.id,
        source: "generation",
        class: "story",
        promptFragment: d.logline,
        parts,
      } as Omit<Asset, "id" | "createdAt">);
      return { ...d, storyAssetId: a.id };
    },
    [byId, updateAsset, addCategory, addAsset],
  );
  const product = productId ? products.find((p) => p.id === productId) ?? null : null;
  const needsSignIn = cloudConfigured && !cloudUser;
  // Unsubscribed: keep buttons clickable so they open the subscribe paywall.
  const locked = cloudConfigured && subscribed === false;

  // The sheet renders on the 2K image model — nine legible panels need the detail.
  const model = getModel("gpt-image-2");
  const cost = priceFor(model, { count: 1, hasRefs: !!product });
  const canAfford = credits >= cost;

  const job = jobId ? videos.find((v) => v.id === jobId) ?? null : null;
  const rendering = job?.status === "rendering";
  const boardUrl = job?.status === "succeeded" ? job.posterUrl : undefined;

  /** The Storyboard Artist: product + idea + length → { title, flow, imagePrompt }. */
  async function onWrite() {
    const idea = brief.trim();
    if ((!idea && !product) || writing) return;
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    // Browsing is free; the writer isn't — prompt subscribe if locked.
    if (useStore.getState().blockIfLocked()) return;
    setWriting(true);
    setWriteError(null);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error("Please sign in first");
      const res = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          brief: idea || `A premium commercial for ${product!.name}.`,
          durationSec,
          product: product
            ? { name: product.name, look: product.promptFragment ?? "" }
            : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.flow) throw new Error(data.error ?? "The storyboard writer is unavailable");
      setTitle((data.title as string) || product?.name || idea.slice(0, 40));
      setFlow(data.flow as string);
      setImagePrompt(data.imagePrompt as string);
      setJobId(null);
      setSavedAssetId(null);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : "The storyboard writer is unavailable");
    } finally {
      setWriting(false);
    }
  }

  /** Fallback sheet prompt when the creator wrote/edited the flow by hand. */
  const composedImagePrompt =
    imagePrompt.trim() ||
    `A professional product-storyboard sheet: a 3×3 grid of nine vertical frames on a clean white background with thin gutters; each cell carries exactly ONE small grey numeral in its bottom-left corner, numbered in reading order, and no other text anywhere. The nine panels are the key frames of this commercial in story order, the exact same product identical in every panel: ${flow.trim()} Ultra realistic product photography, studio lighting.`;

  function onGenerate() {
    if (rendering) return;
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    if (locked) {
      useStore.getState().blockIfLocked(); // opens the subscribe paywall
      return;
    }
    if (!flow.trim() || !canAfford) return;
    setSavedAssetId(null);
    const refs = product ? productPhotoUrls(product) : [];
    const id = generate({
      prompt: composedImagePrompt,
      tier: "standard",
      durationSec: 5,
      aspectRatio: "1:1",
      audio: false,
      modelId: model.id,
      modality: "image",
      direction: title.trim() || brief.trim(),
      refImageUrls: refs.length ? refs : undefined,
    });
    setJobId(id);
    // Safety net: if they navigate away mid-render, the next visit restores
    // this state and the auto-save still lands the paid board.
    setPendingSheet("storyboard", {
      jobId: id,
      data: { productId, brief, durationSec, title, flow, imagePrompt },
    });
  }

  // A finished board saves itself: one storyboard asset carrying the sheet,
  // the Seedance prompt and the video length — nothing for the creator to do.
  useEffect(() => {
    if (!job || job.status !== "succeeded" || !job.posterUrl) return;
    if (savedJobs.current.has(job.id)) return;
    savedJobs.current.add(job.id);
    const name = title.trim() || product?.name || brief.trim().slice(0, 40) || "New storyboard";
    const col = addCategory(`${name} — storyboard`);
    const asset = addAsset({
      name,
      kind: "image",
      url: job.posterUrl,
      posterUrl: job.posterUrl,
      categoryId: col.id,
      source: "generation",
      class: "storyboard",
      // The Seedance prompt rides along as the asset's prompt.
      promptFragment: flow.trim(),
      parts: [
        { role: "primary", kind: "image", url: job.posterUrl, posterUrl: job.posterUrl, label: "Storyboard sheet" },
        // The video length, machine-readable for Make.
        { role: "reference", kind: "prompt", url: String(durationSec), label: `Video length: ${durationSec}s` },
      ],
    } as Omit<Asset, "id" | "createdAt">);
    setSavedAssetId(asset.id);
    clearPendingSheet("storyboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status, job?.posterUrl]);

  // Restore an in-flight (or finished-but-unsaved) render from a previous
  // visit, so navigating away mid-render never loses the paid board.
  useEffect(() => {
    if (!hydrated || jobId) return;
    const pending = getPendingSheet<{
      productId: string | null;
      brief: string;
      durationSec: number;
      title: string;
      flow: string;
      imagePrompt: string;
    }>("storyboard");
    if (!pending) return;
    const pendingJob = useStore.getState().videos.find((v) => v.id === pending.jobId);
    // Not in the store YET may just mean cloud videos haven't hydrated —
    // keep the marker and try again on the next hydration; only a job we can
    // SEE failed is truly dead.
    if (!pendingJob) return;
    if (pendingJob.status === "failed") {
      clearPendingSheet("storyboard");
      return;
    }
    const d = pending.data;
    setProductId(d.productId);
    setBrief(d.brief);
    setDurationSec(d.durationSec);
    setTitle(d.title);
    setFlow(d.flow);
    setImagePrompt(d.imagePrompt);
    setJobId(pending.jobId);
    setCreating(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  /** Shoot it: the sheet becomes a reference, the prompt the script, the length the clip. */
  function useInMake(board: Asset) {
    setDraftElements([board.id]);
    if (board.promptFragment) setDraftDirection(board.promptFragment);
    router.push("/app/make");
  }

  /* ------------------------------ Story actions --------------------------- */

  /** The Story Writer: idea + cast + parts → a full arc, one storyboard per part. */
  async function onWriteStory() {
    const idea = storyBrief.trim();
    if (!idea || storyWriting) return;
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    if (useStore.getState().blockIfLocked()) return;
    setStoryWriting(true);
    setStoryError(null);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error("Please sign in first");
      const res = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          brief: idea,
          durationSec: storyDur,
          parts: storyPartsCount,
          cast: storyCastIds
            .map((id) => byId[id])
            .filter(Boolean)
            .map((a) => ({
              type: a.class === "product" ? "product" : "character",
              name: a.name,
              look: a.promptFragment ?? "",
            })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.parts)) {
        throw new Error(data.error ?? "The story writer is unavailable");
      }
      setStory({
        title: (data.title as string) || idea.slice(0, 40),
        logline: (data.logline as string) || "",
        brief: idea,
        castIds: storyCastIds,
        durationSec: storyDur,
        partsCount: data.parts.length,
        tier: storyTier,
        parts: (data.parts as { title: string; flow: string; imagePrompt: string }[]).map((p) => ({
          title: p.title,
          flow: p.flow,
          imagePrompt: p.imagePrompt,
          sheetJobId: null,
          boardId: null,
          videoJobId: null,
        })),
        storyAssetId: null,
      });
      setOpenPartFlow(null);
    } catch (e) {
      setStoryError(e instanceof Error ? e.message : "The story writer is unavailable");
    } finally {
      setStoryWriting(false);
    }
  }

  /** Draw one part's nine-panel sheet (cast photos steer identity). */
  function drawSheet(idx: number) {
    if (!story) return;
    const part = story.parts[idx];
    if (!part || !part.imagePrompt.trim()) return;
    if (locked) {
      useStore.getState().blockIfLocked();
      return;
    }
    if (credits < sheetCost) return;
    const refs = castRefUrls(story.castIds, 6);
    const id = generate({
      prompt: part.imagePrompt,
      tier: "standard",
      durationSec: 5,
      aspectRatio: "1:1",
      audio: false,
      modelId: imageModel.id,
      modality: "image",
      direction: `${part.title || `Part ${idx + 1}`} — ${story.title}`,
      refImageUrls: refs.length ? refs : undefined,
    });
    setStory((s) =>
      s ? { ...s, parts: s.parts.map((p, i) => (i === idx ? { ...p, sheetJobId: id } : p)) } : s,
    );
  }

  /** Every part that still needs a sheet, in one go. */
  function drawAllSheets() {
    if (!story) return;
    story.parts.forEach((p, i) => {
      const job = p.sheetJobId ? videos.find((v) => v.id === p.sheetJobId) : null;
      if (!p.boardId && (!job || job.status === "failed")) drawSheet(i);
    });
  }

  /**
   * Generate one part's VIDEO right here: the part's sheet + the cast sheets
   * ride as references with an explicit legend, the flow is the script.
   */
  function genPartVideo(idx: number) {
    if (!story) return;
    const part = story.parts[idx];
    const board = part?.boardId ? byId[part.boardId] : null;
    const sheetUrl = board?.url;
    if (!part || !sheetUrl) return;
    if (locked) {
      useStore.getState().blockIfLocked();
      return;
    }
    if (credits < clipCost) return;
    const cast = story.castIds.map((id) => byId[id]).filter(Boolean);
    const castUrls = castRefUrls(story.castIds, 8);
    // The reference legend — Seedance sees media in this exact order.
    const legend = [
      `Image 1 is the nine-panel storyboard sheet for this clip — follow it panel by panel: composition, staging and story exactly as drawn.`,
      ...cast
        .filter((a) => /^https:\/\//i.test(a.url) || a.class === "product")
        .slice(0, castUrls.length)
        .map((a, i) =>
          a.class === "product"
            ? `Image ${i + 2} is the product "${a.name}" — reproduce this exact product, its shape, colors and label; do not redesign it.`
            : `Image ${i + 2} is the character sheet of "${a.name}" — this exact person appears in the clip; copy the face, hair and build exactly.`,
        ),
    ].join(" ");
    const t = STORY_TIERS[story.tier];
    const id = generate({
      prompt: `${legend}\n\n${part.flow}`,
      tier: "standard",
      durationSec: story.durationSec,
      aspectRatio: "16:9",
      audio: true,
      modelId: t.modelId,
      modality: "video",
      elements: [part.boardId!, ...story.castIds],
      direction: `${part.title || `Part ${idx + 1}`} — ${story.title}`,
      posterUrl: sheetUrl,
      resolution: t.resolution,
      refImageUrls: [sheetUrl, ...castUrls].slice(0, 9),
    });
    setStory((s) =>
      s ? { ...s, parts: s.parts.map((p, i) => (i === idx ? { ...p, videoJobId: id } : p)) } : s,
    );
  }

  /** Reopen a saved story for more work. */
  function openStory(a: Asset) {
    const d = storyDraftOf(a);
    if (!d) return;
    setStory(d);
    setStoryBrief(d.brief);
    setStoryCastIds(d.castIds);
    setStoryPartsCount(d.partsCount);
    setStoryDur(d.durationSec);
    setStoryTier(d.tier);
    setStoryView(true);
    setOpenPartFlow(null);
  }

  // A finished part sheet saves itself as a storyboard asset (usable in the
  // Studio like any board), then the story asset is created/refreshed.
  useEffect(() => {
    if (!story) return;
    let changed = false;
    let next = story;
    story.parts.forEach((p, idx) => {
      if (!p.sheetJobId || p.boardId || storySavedSheets.current.has(p.sheetJobId)) return;
      const job = videos.find((v) => v.id === p.sheetJobId);
      if (!job || job.status !== "succeeded" || !job.posterUrl) return;
      storySavedSheets.current.add(p.sheetJobId);
      const name = `${next.title.trim() || "Story"} — ${p.title.trim() || `Part ${idx + 1}`}`;
      const col = addCategory(`${next.title.trim() || "Story"} — story`);
      const asset = addAsset({
        name,
        kind: "image",
        url: job.posterUrl,
        posterUrl: job.posterUrl,
        categoryId: col.id,
        source: "generation",
        class: "storyboard",
        promptFragment: p.flow.trim(),
        parts: [
          { role: "primary", kind: "image", url: job.posterUrl, posterUrl: job.posterUrl, label: "Storyboard sheet" },
          { role: "reference", kind: "prompt", url: String(next.durationSec), label: `Video length: ${next.durationSec}s` },
        ],
      } as Omit<Asset, "id" | "createdAt">);
      next = { ...next, parts: next.parts.map((q, i) => (i === idx ? { ...q, boardId: asset.id } : q)) };
      changed = true;
    });
    if (changed) setStory(persistStory(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos, story]);

  // Keep the story asset's recipe fresh (video job ids, edited flows) and
  // keep a local safety-net marker while any sheet render is in flight.
  useEffect(() => {
    if (!story) return;
    if (story.storyAssetId) {
      const a = byId[story.storyAssetId];
      const recipe = a?.parts?.find((p) => p.label === STORY_RECIPE_LABEL)?.url;
      const fresh = JSON.stringify({ ...story, storyAssetId: undefined });
      if (recipe !== fresh) persistStory(story);
    }
    const rendering = story.parts.some((p) => {
      if (!p.sheetJobId || p.boardId) return false;
      const j = videos.find((v) => v.id === p.sheetJobId);
      return !j || j.status === "rendering";
    });
    if (rendering || !story.storyAssetId) {
      setPendingSheet("story", { jobId: story.parts[0]?.sheetJobId ?? "story-draft", data: story });
    } else {
      clearPendingSheet("story");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, videos]);

  // Restore an unfinished story from a previous visit.
  useEffect(() => {
    if (!hydrated || story) return;
    const pending = getPendingSheet<StoryDraft>("story");
    if (!pending?.data || !Array.isArray(pending.data.parts)) return;
    setStory(pending.data);
    setStoryBrief(pending.data.brief);
    setStoryCastIds(pending.data.castIds);
    setStoryPartsCount(pending.data.partsCount);
    setStoryDur(pending.data.durationSec);
    setStoryTier(pending.data.tier);
    setStoryView(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  async function copyPrompt(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      /* clipboard unavailable — the prompt is visible to select manually */
    }
  }

  const canWrite = hydrated && (brief.trim().length > 3 || !!product);
  const canGenerate = hydrated && flow.trim().length > 0 && canAfford;
  const savedBoard = savedAssetId ? boards.find((b) => b.id === savedAssetId) ?? null : null;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Storyboard</h1>
        <p className="mt-1 text-sm text-muted">
          The master planner. Tell one story with your characters, products and assets — broken
          into parts, each part a nine-panel board that generates its video right here. Every
          board also works in the Studio.
        </p>
      </header>

      {/* Gallery first — creation hides behind the buttons. */}
      {!creating && !storyView && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Button
            size="lg"
            onClick={() => {
              setStory(null);
              setStoryError(null);
              setStoryView(true);
            }}
          >
            <BookOpen size={17} /> New story
          </Button>
          <Button size="lg" variant="soft" onClick={() => setCreating(true)}>
            <Plus size={17} /> Single storyboard
          </Button>
        </div>
      )}

      {/* ---------------------------- Saved stories --------------------------- */}
      {!creating && !storyView && stories.length > 0 && (
        <>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-faint">Stories</h2>
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((s) => {
              const d = storyDraftOf(s);
              const done = d?.parts.filter((p) => p.boardId).length ?? 0;
              return (
                <Card key={s.id} className="group overflow-hidden">
                  <div className="relative aspect-video bg-surface-2">
                    {s.posterUrl || s.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.posterUrl ?? s.url} alt={s.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-faint">
                        <BookOpen size={26} />
                      </div>
                    )}
                    <span className="absolute left-2 top-2">
                      <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                        <Clapperboard size={10} /> {done}/{d?.partsCount ?? "?"} boards
                      </Badge>
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Delete the "${s.name}" story? Its boards stay in your storyboards.`))
                          removeAsset(s.id);
                      }}
                      className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white transition-opacity hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Delete story"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="p-3">
                    <div className="truncate text-[13.5px] font-semibold">{s.name}</div>
                    {s.promptFragment && (
                      <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-faint">{s.promptFragment}</p>
                    )}
                    <Button size="sm" variant="soft" className="mt-2 w-full" onClick={() => openStory(s)}>
                      <BookOpen size={13} /> Open story
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {!creating && !storyView && boards.length === 0 && stories.length === 0 && (
        <EmptyState
          icon={<Plus size={24} />}
          art={[thumbFor("art-product-reveal"), thumbFor("prod-coffee"), thumbFor("set-desert-highway")]}
          title="No stories yet"
          description="Give it your cast and the idea — the writer plans the whole story, boards every part as a nine-panel sheet, and each part generates its video right here. Tap “New story” to plan your first."
        />
      )}

      {/* ------------------------- Saved storyboards ------------------------- */}
      {!creating && !storyView && boards.length > 0 && (
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-faint">Storyboards</h2>
      )}
      {!creating && !storyView && boards.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => {
            const dur = storyboardDurationSec(b);
            return (
              <Card key={b.id} className="group overflow-hidden">
                <div className="relative aspect-square bg-surface-2">
                  {b.posterUrl || b.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.posterUrl ?? b.url} alt={b.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-faint">
                      <LayoutGrid size={26} />
                    </div>
                  )}
                  {dur && (
                    <span className="absolute left-2 top-2">
                      <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                        <Clock size={10} /> {dur}s
                      </Badge>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Delete the "${b.name}" storyboard?`)) removeAsset(b.id);
                    }}
                    className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white transition-opacity hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Delete storyboard"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="p-3">
                  <div className="truncate text-[13.5px] font-semibold">{b.name}</div>
                  {b.promptFragment && (
                    <>
                      <p
                        className={cn(
                          "mt-1 whitespace-pre-wrap text-[11.5px] leading-snug text-faint",
                          openBoard !== b.id && "line-clamp-2",
                        )}
                      >
                        {b.promptFragment}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <button
                          onClick={() => setOpenBoard(openBoard === b.id ? null : b.id)}
                          className="text-[11px] font-medium text-accent-2 hover:underline"
                        >
                          {openBoard === b.id ? "Hide the prompt" : "Read the full prompt"}
                        </button>
                        <button
                          onClick={() => copyPrompt(b.id, b.promptFragment!)}
                          className="flex items-center gap-1 text-[11px] font-medium text-muted hover:text-fg"
                        >
                          {copiedId === b.id ? (
                            <>
                              <Check size={11} className="text-teal" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy size={11} /> Copy
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                  <Button size="sm" variant="soft" className="mt-2 w-full" onClick={() => useInMake(b)}>
                    <Sparkles size={13} /> Use in Studio
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ------------------------------ Story view ---------------------------- */}
      {storyView && (
        <>
          <button
            onClick={() => setStoryView(false)}
            className="mb-4 text-[13px] font-medium text-muted transition-colors hover:text-fg"
          >
            ← All stories
          </button>

          {!story ? (
            /* -------- New story: cast + idea + shape -------- */
            <Card className="max-w-2xl p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
                <BookOpen size={14} /> New story
              </div>

              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
                Cast <span className="normal-case">(your characters and products — they stay identical in every part)</span>
              </label>
              {castOptions.length === 0 ? (
                <button
                  onClick={() => router.push("/app/characters")}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-left text-[12.5px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
                >
                  <UserRound size={14} className="text-accent-2" /> Save a character or product first — or just describe everything below
                </button>
              ) : (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {castOptions.map((a) => {
                    const on = storyCastIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() =>
                          setStoryCastIds((ids) => (on ? ids.filter((x) => x !== a.id) : [...ids, a.id]))
                        }
                        className={cn(
                          "flex shrink-0 items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 text-[12px] font-medium transition-colors",
                          on ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-2",
                        )}
                      >
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                          {a.posterUrl || a.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.posterUrl ?? a.url} alt={a.name} className="h-full w-full object-cover" />
                          ) : a.class === "product" ? (
                            <Package size={14} className="m-auto text-faint" />
                          ) : (
                            <UserRound size={14} className="m-auto text-faint" />
                          )}
                          {on && (
                            <span className="absolute inset-0 flex items-center justify-center bg-accent/70 text-white">
                              <Check size={13} />
                            </span>
                          )}
                        </span>
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              )}

              <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
                The story
              </label>
              <textarea
                value={storyBrief}
                onChange={(e) => setStoryBrief(e.target.value)}
                rows={4}
                placeholder="Jessica discovers Celsius before sunrise yoga: the can wakes the city with her — rooftop flow at dawn, an electric run through neon streets, and a final toast on the skyline…"
                className={textareaCls}
              />

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
                    Parts <span className="normal-case">(one board + one clip each)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[2, 3, 4].map((n) => (
                      <button
                        key={n}
                        onClick={() => setStoryPartsCount(n)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-[12px] font-medium tabular-nums transition-colors",
                          storyPartsCount === n
                            ? "border-accent bg-accent-soft text-fg"
                            : "border-line text-muted hover:border-line-2",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
                    Length per clip
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setStoryDur(d)}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-[12px] font-medium tabular-nums transition-colors",
                          storyDur === d
                            ? "border-accent bg-accent-soft text-fg"
                            : "border-line text-muted hover:border-line-2",
                        )}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
                Clips render on
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(STORY_TIERS) as StoryTier[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setStoryTier(t)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors",
                      storyTier === t
                        ? "border-accent bg-accent-soft text-fg"
                        : "border-line text-muted hover:border-line-2",
                    )}
                  >
                    Seedance 2.0 {STORY_TIERS[t].label}
                  </button>
                ))}
              </div>

              {needsSignIn ? (
                <Button size="lg" className="mt-5 w-full" onClick={() => setAuthOpen(true)}>
                  <PenLine size={17} /> Sign in to write
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="mt-5 w-full"
                  disabled={storyWriting || (!locked && storyBrief.trim().length < 4)}
                  onClick={onWriteStory}
                >
                  {storyWriting ? (
                    <>
                      <Loader2 size={17} className="animate-spin" /> Planning {storyPartsCount} parts…
                    </>
                  ) : locked ? (
                    <>
                      <PenLine size={17} /> Subscribe to write
                    </>
                  ) : (
                    <>
                      <PenLine size={17} /> Write the story
                    </>
                  )}
                </Button>
              )}
              {storyError && <p className="mt-2 text-xs text-danger">{storyError}</p>}
              <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
                The writer plans one continuous story across {storyPartsCount} parts — each part gets
                its own Seedance prompt and nine-panel board. Sheets cost {sheetCost} credits each;
                each {storyDur}s clip on Seedance 2.0 {STORY_TIERS[storyTier].label} costs{" "}
                {videoRate(getModel(STORY_TIERS[storyTier].modelId), STORY_TIERS[storyTier].resolution) * storyDur}{" "}
                credits.
              </p>
            </Card>
          ) : (
            /* -------- The planned story: parts, sheets, clips -------- */
            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
                      <BookOpen size={14} /> Story
                    </div>
                    <h2 className="mt-1 text-xl font-bold tracking-tight">{story.title || "New story"}</h2>
                    {story.logline && <p className="mt-1 text-[13.5px] text-muted">{story.logline}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral">{story.parts.length} parts</Badge>
                      <Badge tone="neutral">
                        <Clock size={10} /> {story.durationSec}s / clip
                      </Badge>
                      <Badge tone="neutral">Seedance 2.0 {STORY_TIERS[story.tier].label}</Badge>
                      {story.castIds.map((id) =>
                        byId[id] ? <Badge key={id} tone="neutral">{byId[id].name}</Badge> : null,
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button size="sm" variant="soft" onClick={() => setStory(null)}>
                      <PenLine size={13} /> Edit & rewrite
                    </Button>
                    {story.parts.some((p) => !p.boardId) && (
                      <Button size="sm" onClick={drawAllSheets} disabled={!hydrated || locked}>
                        <Sparkles size={13} /> Draw all boards
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {story.parts.map((part, idx) => {
                const sheetJob = part.sheetJobId ? videos.find((v) => v.id === part.sheetJobId) ?? null : null;
                const videoJob = part.videoJobId ? videos.find((v) => v.id === part.videoJobId) ?? null : null;
                const board = part.boardId ? byId[part.boardId] : null;
                const sheetUrl = board?.url ?? (sheetJob?.status === "succeeded" ? sheetJob.posterUrl : null);
                const sheetRendering = sheetJob?.status === "rendering";
                const videoRendering = videoJob?.status === "rendering";
                const videoUrl = videoJob?.status === "succeeded" ? videoJob.videoUrl ?? null : null;
                return (
                  <Card key={idx} className="p-4 sm:p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">
                          {idx + 1}
                        </span>
                        <span className="truncate text-[14.5px] font-semibold">
                          {part.title || `Part ${idx + 1}`}
                        </span>
                      </div>
                      <span className="flex items-center gap-1.5">
                        {board && (
                          <Badge tone="neutral">
                            <Check size={10} className="text-teal" /> board saved
                          </Badge>
                        )}
                        {videoUrl && (
                          <Badge tone="neutral">
                            <Film size={10} className="text-teal" /> clip done
                          </Badge>
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
                      {/* The nine-panel sheet */}
                      <div>
                        <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
                          {sheetRendering ? (
                            <div className="shimmer flex h-full flex-col items-center justify-center">
                              <Loader2 size={18} className="animate-spin text-accent-2" />
                              <div className="mt-2 w-24">
                                <Progress value={sheetJob?.progress ?? 5} />
                              </div>
                            </div>
                          ) : sheetUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={sheetUrl} alt={part.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
                              <LayoutGrid size={20} className="text-faint" />
                              <span className="text-[11px] text-faint">Nine-panel board — not drawn yet</span>
                            </div>
                          )}
                          {sheetJob?.status === "failed" && !sheetUrl && (
                            <div className="absolute inset-0 flex items-center justify-center bg-surface/80 p-3 text-center text-[11px] text-danger">
                              {sheetJob.error ?? "Sheet failed — try again"}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={sheetUrl ? "soft" : undefined}
                          className="mt-2 w-full"
                          disabled={sheetRendering || !hydrated || (!locked && credits < sheetCost)}
                          onClick={() => drawSheet(idx)}
                        >
                          {sheetRendering ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Sparkles size={13} />
                          )}{" "}
                          {sheetUrl ? "Redraw" : "Draw board"} · {sheetCost} cr
                        </Button>
                      </div>

                      {/* The flow + the clip */}
                      <div className="min-w-0">
                        {openPartFlow === idx ? (
                          <>
                            <textarea
                              value={part.flow}
                              onChange={(e) =>
                                setStory((s) =>
                                  s
                                    ? {
                                        ...s,
                                        parts: s.parts.map((p, i) =>
                                          i === idx ? { ...p, flow: e.target.value } : p,
                                        ),
                                      }
                                    : s,
                                )
                              }
                              rows={10}
                              className={textareaCls}
                            />
                            <button
                              onClick={() => setOpenPartFlow(null)}
                              className="mt-1 text-[11px] font-medium text-accent-2 hover:underline"
                            >
                              Collapse the prompt
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap text-[12px] leading-snug text-muted line-clamp-4">
                              {part.flow}
                            </p>
                            <button
                              onClick={() => setOpenPartFlow(idx)}
                              className="mt-1 text-[11px] font-medium text-accent-2 hover:underline"
                            >
                              Read &amp; edit the full prompt
                            </button>
                          </>
                        )}

                        {/* The clip, generated right here from the board + cast */}
                        <div className="mt-3 border-t border-line pt-3">
                          {videoUrl ? (
                            // eslint-disable-next-line jsx-a11y/media-has-caption
                            <video
                              src={videoUrl}
                              poster={sheetUrl ?? undefined}
                              controls
                              playsInline
                              className="w-full rounded-xl border border-line"
                            />
                          ) : videoRendering ? (
                            <div className="shimmer flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-line bg-surface-2">
                              <Loader2 size={18} className="animate-spin text-accent-2" />
                              <div className="mt-2 w-28">
                                <Progress value={videoJob?.progress ?? 5} />
                              </div>
                              <span className="mt-2 text-[11px] text-faint">Generating the clip…</span>
                            </div>
                          ) : videoJob?.status === "failed" ? (
                            <p className="text-[12px] text-danger">{videoJob.error ?? "Clip failed — try again."}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              disabled={videoRendering || !board || !hydrated || (!locked && credits < clipCost)}
                              onClick={() => genPartVideo(idx)}
                              title={board ? undefined : "Draw the board first — it steers the clip"}
                            >
                              {videoRendering ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Film size={13} />
                              )}{" "}
                              {videoUrl ? "Regenerate clip" : "Generate clip"} · {clipCost} cr
                            </Button>
                            {board && (
                              <Button size="sm" variant="soft" onClick={() => useInMake(board)}>
                                Use in Studio <ArrowRight size={13} />
                              </Button>
                            )}
                            {!board && !sheetRendering && (
                              <span className="text-[11.5px] text-faint">Draw the board first — it steers the clip.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {creating && (
        <>
          <button
            onClick={() => setCreating(false)}
            className="mb-4 text-[13px] font-medium text-muted transition-colors hover:text-fg"
          >
            ← All storyboards
          </button>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* ------------------------------ Brief ------------------------------ */}
        <Card className="h-fit p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
            <LayoutGrid size={14} /> New storyboard
          </div>

          {/* The hero product — a saved Product steers the sheet with its photos. */}
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
            Product <span className="normal-case">(the hero of every frame)</span>
          </label>
          {products.length === 0 ? (
            <button
              onClick={() => router.push("/app/products")}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-left text-[12.5px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
            >
              <Package size={14} className="text-accent-2" /> Save a product first — or just describe it below
            </button>
          ) : (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {products.map((p) => {
                const on = productId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProductId(on ? null : p.id)}
                    title={on ? `Deselect ${p.name}` : `Star ${p.name}`}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 text-[12px] font-medium transition-colors",
                      on ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-2",
                    )}
                  >
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      {p.posterUrl || p.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.posterUrl ?? p.url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package size={14} className="m-auto text-faint" />
                      )}
                      {on && (
                        <span className="absolute inset-0 flex items-center justify-center bg-accent/70 text-white">
                          <Check size={13} />
                        </span>
                      )}
                    </span>
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            The commercial
          </label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            placeholder="A premium spot for a pink strawberry kefir bottle: macro crown splashes of white kefir, strawberries falling in slow motion, the bottle rising from swirling liquid…"
            className={textareaCls}
          />

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Video length
          </label>
          {/* Any second in Seedance's 4–15 range. */}
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDurationSec(d)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[12px] font-medium tabular-nums transition-colors",
                  durationSec === d
                    ? "border-accent bg-accent-soft text-fg"
                    : "border-line text-muted hover:border-line-2",
                )}
              >
                {d}s
              </button>
            ))}
          </div>

          {needsSignIn ? (
            <Button size="lg" className="mt-5 w-full" onClick={() => setAuthOpen(true)}>
              <PenLine size={17} /> Sign in to write
            </Button>
          ) : (
            <Button size="lg" className="mt-5 w-full" disabled={writing || (!locked && !canWrite)} onClick={onWrite}>
              {writing ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Writing the board…
                </>
              ) : locked ? (
                <>
                  <PenLine size={17} /> Subscribe to write
                </>
              ) : flow ? (
                <>
                  <PenLine size={17} /> Rewrite storyboard
                </>
              ) : (
                <>
                  <PenLine size={17} /> Write storyboard
                </>
              )}
            </Button>
          )}
          {writeError && <p className="mt-2 text-xs text-danger">{writeError}</p>}
          <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
            The writer directs a {durationSec}-second commercial scene by scene — the Seedance
            prompt — and one prompt that draws its nine key frames as a single 3×3 sheet
            {product ? `, locked to ${product.name}'s photos` : ""}.
          </p>
        </Card>

        {/* ------------------------ Prompt + the sheet ------------------------ */}
        <div className="space-y-4">
          {flow ? (
            <Card className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
                  <PenLine size={14} /> Seedance prompt
                </div>
                <span className="flex items-center gap-1.5">
                  <Badge tone="neutral">
                    <Clock size={10} /> {durationSec}s
                  </Badge>
                  {title && <Badge tone="neutral">{title}</Badge>}
                </span>
              </div>
              <textarea
                value={flow}
                onChange={(e) => setFlow(e.target.value)}
                rows={12}
                className={textareaCls}
              />
              <button
                onClick={() => setShowImagePrompt((v) => !v)}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-fg"
              >
                <ChevronDown
                  size={13}
                  className={showImagePrompt ? "rotate-180 transition-transform" : "transition-transform"}
                />
                Board image prompt
              </button>
              {showImagePrompt && (
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={6}
                  placeholder="How the sheet itself is drawn — filled in by the writer, editable here."
                  className={`${textareaCls} mt-2`}
                />
              )}

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="text-muted">Model</span>
                <span className="font-medium">
                  {model.glyph} {model.name}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="text-muted">Board render cost</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Coins size={15} className="text-warn" /> {cost} credits
                </span>
              </div>
              <Button
                size="lg"
                className="mt-3 w-full"
                disabled={rendering || (!locked && !canGenerate)}
                onClick={onGenerate}
              >
                {rendering ? (
                  <>
                    <Loader2 size={17} className="animate-spin" /> Drawing the board…
                  </>
                ) : locked ? (
                  <>
                    <Sparkles size={17} /> Subscribe to generate
                  </>
                ) : boardUrl ? (
                  <>
                    <Sparkles size={17} /> Redraw storyboard
                  </>
                ) : (
                  <>
                    <Sparkles size={17} /> Generate storyboard
                  </>
                )}
              </Button>
              {hydrated && !needsSignIn && !locked && !canAfford && (
                <p className="mt-2 text-center text-xs text-danger">
                  Not enough credits — you need {cost - credits} more.
                </p>
              )}
            </Card>
          ) : (
            <Card className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-2">
                <LayoutGrid size={22} />
              </span>
              <p className="mt-3 max-w-sm text-sm text-muted">
                Your storyboard appears here — the Seedance prompt written scene by scene, and one
                image holding all nine key frames of the commercial. Finished boards save
                themselves.
              </p>
            </Card>
          )}

          {job && (
            <Card className="overflow-hidden">
              <div className="relative aspect-square w-full bg-surface-2">
                {job.status === "rendering" ? (
                  <div className="shimmer flex h-full flex-col items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-accent-2" />
                    <div className="mt-3 w-32">
                      <Progress value={job.progress} />
                    </div>
                  </div>
                ) : boardUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={boardUrl} alt="Storyboard sheet" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center p-4 text-center text-xs text-danger">
                    {job.error ?? "Failed"}
                  </div>
                )}
                <span className="absolute left-2 top-2">
                  <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                    9-panel storyboard · {durationSec}s
                  </Badge>
                </span>
              </div>
            </Card>
          )}

          {!!boardUrl && !rendering && (
            <Card className="flex flex-wrap items-center gap-2 p-4">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-teal">
                <Check size={15} /> Saved to your storyboards
              </span>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => savedBoard && useInMake(savedBoard)}
                disabled={!savedBoard}
              >
                Use in Studio <ArrowRight size={15} />
              </Button>
            </Card>
          )}
        </div>
      </div>
        </>
      )}

    </div>
  );
}
