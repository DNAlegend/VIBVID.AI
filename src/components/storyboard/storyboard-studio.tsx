"use client";

// Storyboard — the story room. ONE door in: give it a story idea plus a
// CAST — saved characters, products, any of your assets. The Story Writer
// (Claude) plans one continuous arc as ONE storyboard (a Seedance flow whose
// scenes sum to the clip length + a nine-panel sheet prompt). It draws its
// sheet (cast reference photos steer identity) and can generate its VIDEO
// right here — the sheet + the cast sheets ride as references with an
// explicit legend, so the same faces and products carry across the clip.
// (Older multi-part stories still open and render.)
//
// Every board saves itself as a storyboard asset, so it also works in the
// Studio; the story saves as a 'story' asset carrying the full recipe.
// Everything is private to the creator.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clapperboard,
  Clock,
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
import { getModel, priceFor } from "@/lib/models";
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

  /** Saved-board card whose full prompt is expanded. */
  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const boards = useMemo(() => assets.filter((a) => a.class === "storyboard"), [assets]);
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
  // Every story is ONE storyboard now — the writer plans the whole arc into a
  // single nine-panel board. (Older multi-part stories still open fine.)
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
  // Priced exactly as the store will charge it: refs always ride along (+4).
  const clipCost = priceFor(storyVideoModel, {
    durationSec: story?.durationSec ?? storyDur,
    resolution: storyVideoRes,
    hasRefs: true,
  });

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
      // Read assets FRESH from the store — the board this cover comes from may
      // have been added a moment ago in the same effect run, before the `byId`
      // memo has rebuilt. A stale lookup here silently drops the whole story.
      const liveById = new Map(useStore.getState().assets.map((a) => [a.id, a]));
      const cover =
        d.parts.map((p) => (p.boardId ? liveById.get(p.boardId)?.url : null)).find(Boolean) ?? null;
      if (!cover) return d;
      const recipe = JSON.stringify({ ...d, storyAssetId: undefined });
      const parts = [
        { role: "primary", kind: "image", url: cover, posterUrl: cover, label: "Story cover" },
        { role: "reference", kind: "prompt", url: recipe, label: STORY_RECIPE_LABEL },
      ] as Asset["parts"];
      const name = d.title.trim() || "New story";
      if (d.storyAssetId && liveById.get(d.storyAssetId)) {
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
    [updateAsset, addCategory, addAsset],
  );
  const needsSignIn = cloudConfigured && !cloudUser;
  // Unsubscribed: keep buttons clickable so they open the subscribe paywall.
  const locked = cloudConfigured && subscribed === false;

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
          parts: 1,
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
    // Fresh read — "draw" clicks in the same tick each deduct before re-render.
    if (useStore.getState().credits < sheetCost) return;
    const refs = castRefUrls(story.castIds, 6);
    const id = generate({
      prompt: part.imagePrompt,
      tier: "standard",
      durationSec: 5,
      aspectRatio: "1:1",
      audio: false,
      modelId: imageModel.id,
      modality: "image",
      direction:
        story.parts.length === 1 ? story.title : `${part.title || `Part ${idx + 1}`} — ${story.title}`,
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
    // One legend line PER ATTACHED IMAGE, built from the same list that ships —
    // a product can contribute two photos, so deriving lines from the cast
    // list would bind names to the wrong slots.
    const castEntries = story.castIds
      .map((cid) => byId[cid])
      .filter(Boolean)
      .flatMap((a) =>
        a.class === "product"
          ? productPhotoUrls(a)
              .slice(0, 2)
              .map((u) => ({ asset: a, url: u }))
          : /^https:\/\//i.test(a.url)
            ? [{ asset: a, url: a.url }]
            : [],
      )
      .slice(0, 8);
    const castUrls = castEntries.map((e) => e.url);
    // The reference legend — Seedance sees media in this exact order.
    const legend = [
      `Image 1 is the nine-panel storyboard sheet for this clip — follow it panel by panel: composition, staging and story exactly as drawn.`,
      ...castEntries.map(({ asset: a }, i) =>
        a.class === "product"
          ? `Image ${i + 2} is a photo of the product "${a.name}" — reproduce this exact product, its shape, colors and label; do not redesign it.`
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
      direction:
        story.parts.length === 1 ? story.title : `${part.title || `Part ${idx + 1}`} — ${story.title}`,
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
      // One-part story = one board named after the story itself; only
      // multi-part stories (older saves) carry the "— Part N" suffix.
      const name =
        next.parts.length === 1
          ? next.title.trim() || "Story"
          : `${next.title.trim() || "Story"} — ${p.title.trim() || `Part ${idx + 1}`}`;
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

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Storyboard</h1>
        <p className="mt-1 text-sm text-muted">
          The master planner. Tell one story with your characters, products and assets — it
          becomes one nine-panel board that generates its video right here. Every board also
          works in the Studio.
        </p>
      </header>

      {/* Gallery first — creation hides behind the button. One door in: a
          story IS a single board, so there's nothing separate to offer. */}
      {!storyView && (
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
        </div>
      )}

      {/* ---------------------------- Saved stories --------------------------- */}
      {!storyView && stories.length > 0 && (
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
                    {/* Board counts only mean something on legacy multi-part stories. */}
                    {(d?.partsCount ?? 1) > 1 && (
                      <span className="absolute left-2 top-2">
                        <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                          <Clapperboard size={10} /> {done}/{d?.partsCount} boards
                        </Badge>
                      </span>
                    )}
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

      {!storyView && boards.length === 0 && stories.length === 0 && (
        <EmptyState
          icon={<Plus size={24} />}
          art={[thumbFor("art-product-reveal"), thumbFor("prod-coffee"), thumbFor("set-desert-highway")]}
          title="No stories yet"
          description="Give it your cast and the idea — the writer plans the whole story as one nine-panel board that generates its video right here. Tap “New story” to plan your first."
        />
      )}

      {/* ------------------------- Saved storyboards ------------------------- */}
      {!storyView && boards.length > 0 && (
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-faint">Storyboards</h2>
      )}
      {!storyView && boards.length > 0 && (
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
            onClick={() => {
              // A draft that never drew a sheet has nothing paid to protect —
              // walking away discards it instead of force-reopening forever.
              if (story && !story.storyAssetId && story.parts.every((p) => !p.sheetJobId)) {
                clearPendingSheet("story");
                setStory(null);
              }
              setStoryView(false);
            }}
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
                Cast <span className="normal-case">(your characters and products — they stay identical in every scene)</span>
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

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
                  Clip length
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setStoryDur(d)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[12px] font-medium tabular-nums transition-all",
                        storyDur === d
                          ? "bg-accent text-white shadow-[0_6px_16px_-6px_rgba(236,19,32,0.6)]"
                          : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-fg",
                      )}
                    >
                      {d}s
                    </button>
                  ))}
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
                      <Loader2 size={17} className="animate-spin" /> Writing the story…
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
                The writer plans the whole story into ONE nine-panel board with its own Seedance
                prompt. The sheet costs {sheetCost} credits; the {storyDur}s clip on Seedance 2.0{" "}
                {STORY_TIERS[storyTier].label} costs{" "}
                {priceFor(getModel(STORY_TIERS[storyTier].modelId), {
                  durationSec: storyDur,
                  resolution: STORY_TIERS[storyTier].resolution,
                  hasRefs: true,
                })}{" "}
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
                      {/* A story is ONE board now — the count only matters on legacy multi-part saves. */}
                      {story.parts.length > 1 && (
                        <Badge tone="neutral">{story.parts.length} parts</Badge>
                      )}
                      <Badge tone="neutral">
                        <Clock size={10} /> {story.durationSec}s{story.parts.length > 1 ? " / clip" : " clip"}
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
                    {/* Bulk draw only earns its place on old multi-part stories. */}
                    {story.parts.length > 1 && story.parts.some((p) => !p.boardId) && (
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
                        {story.parts.length > 1 && (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">
                            {idx + 1}
                          </span>
                        )}
                        <span className="truncate text-[14.5px] font-semibold">
                          {story.parts.length === 1
                            ? part.title || "The board"
                            : part.title || `Part ${idx + 1}`}
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

    </div>
  );
}
