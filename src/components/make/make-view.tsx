"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  Wand2,
  ChevronDown,
  X,
  Plus,
  Coins,
  Download,
  Bookmark,
  Check,
  ArrowRight,
  Layers,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { getModel, listModels, priceFor, DEFAULT_MODEL_ID } from "@/lib/models";
import { ASSET_CLASSES, CLASS_BY_KEY, composeFromAssets } from "@/lib/catalog";
import {
  ASPECT_RATIOS,
  DURATIONS,
  TIERS,
  type AspectRatio,
  type Asset,
  type AssetClass,
  type Modality,
  type Tier,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, Card, Badge, Segmented, Toggle, Modal } from "@/components/ui";
import { AssetThumb, ClassIcon, ModelPicker, ResultHero, CompositeBadge } from "@/components/shared";

type Picks = Partial<Record<AssetClass, string>>;

const PROMPT_IDEAS = [
  "A neon samurai walks through rain-soaked Tokyo at night, cinematic slow motion",
  "Close-up of a desert nomad at golden hour, dust drifting in the wind",
  "An astronaut floating above a glowing Mars colony, sweeping drone shot",
];

export function MakeView() {
  const credits = useStore((s) => s.credits);
  const hydrated = useStore((s) => s.hasHydrated);
  const assets = useStore((s) => s.assets);
  const generate = useStore((s) => s.generate);
  const videos = useStore((s) => s.videos);
  const saveVideoToAssets = useStore((s) => s.saveVideoToAssets);
  const draftElements = useStore((s) => s.draftElements);
  const draftDirection = useStore((s) => s.draftDirection);
  const draftRefAssetId = useStore((s) => s.draftRefAssetId);
  const setDraftElements = useStore((s) => s.setDraftElements);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const setDraftRef = useStore((s) => s.setDraftRef);

  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  const [modality, setModality] = useState<Modality>("video");
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [prompt, setPrompt] = useState("");
  const [picks, setPicks] = useState<Picks>({});
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [durationSec, setDurationSec] = useState<number>(6);
  const [tier, setTier] = useState<Tier>("standard");
  const [audio, setAudio] = useState(true);
  const [showAssets, setShowAssets] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [pickClass, setPickClass] = useState<AssetClass | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  // Consume drafts handed over from Assets ("Use in Make") or Library ("Remix").
  useEffect(() => {
    const seed: Picks = {};
    const place = (id: string) => {
      const a = byId[id];
      if (a?.class && !seed[a.class]) seed[a.class] = id;
    };
    if (draftRefAssetId) {
      place(draftRefAssetId);
      setDraftRef(null);
    }
    if (draftElements) {
      draftElements.forEach(place);
      setDraftElements(null);
    }
    if (draftDirection != null) {
      setPrompt(draftDirection);
      setDraftDirection(null);
    }
    if (Object.keys(seed).length) {
      setPicks((p) => ({ ...seed, ...p }));
      setShowAssets(true);
    }
    // "Try this prompt" links from the landing page arrive as ?prompt=…
    const linked = new URLSearchParams(window.location.search).get("prompt");
    if (linked) setPrompt(linked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const model = getModel(modelId);
  const pickedAssets = ASSET_CLASSES.map((c) => picks[c.key])
    .filter(Boolean)
    .map((id) => byId[id as string])
    .filter(Boolean) as Asset[];

  // The typed prompt doubles as the director's note when assets are picked.
  const finalPrompt = useMemo(() => composeFromAssets(pickedAssets, prompt), [pickedAssets, prompt]);
  const cost = priceFor(model, { durationSec, count: 1, hasRefs: pickedAssets.length > 0 });
  const canAfford = credits >= cost;
  // `hydrated` also gates the brief window while a signed-in account's cloud
  // state is loading, so a spend can't race the authoritative balance.
  const canGenerate = hydrated && finalPrompt.trim().length > 0 && canAfford;
  const activeJob = videos.find((v) => v.id === activeJobId) ?? null;
  const rendering = activeJob?.status === "rendering";
  const pickedCount = pickedAssets.length;

  function switchModality(m: Modality) {
    setModality(m);
    const first = listModels({ modality: m, enabledOnly: true })[0];
    if (first) setModelId(first.id);
  }

  function setPick(cls: AssetClass, id: string | null) {
    setPicks((p) => ({ ...p, [cls]: id ?? undefined }));
  }

  function onGenerate() {
    if (!canGenerate || rendering) return;
    const scene = pickedAssets.find((a) => a.class === "scene");
    const posterUrl = (scene ?? pickedAssets[0])?.posterUrl ?? (scene ?? pickedAssets[0])?.url;
    const id = generate({
      prompt: finalPrompt,
      tier,
      durationSec,
      aspectRatio,
      audio,
      modelId,
      modality,
      elements: pickedAssets.map((a) => a.id),
      direction: prompt,
      posterUrl,
    });
    setActiveJobId(id);
    setSavedMsg(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 text-center">
        <div className="mb-1.5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
          <Sparkles size={14} /> Make
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">What do you want to create?</h1>
        <p className="mt-1.5 text-sm text-muted">
          Describe your shot, or build it from your assets — pick a model and generate.
        </p>
      </header>

      <Card className="overflow-hidden">
        <div className="p-5">
          {/* Prompt */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe your shot — a character, a setting, a mood, a camera move…"
            className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3.5 text-[15px] leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />

          {/* Try-this chips */}
          {!prompt && pickedCount === 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1 text-[11px] font-medium text-faint">
                <Wand2 size={12} /> Try
              </span>
              {PROMPT_IDEAS.map((idea) => (
                <button
                  key={idea}
                  onClick={() => setPrompt(idea)}
                  className="rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-fg"
                >
                  {idea.length > 38 ? idea.slice(0, 38) + "…" : idea}
                </button>
              ))}
            </div>
          )}

          {/* Add assets (slot assembly) */}
          <div className="mt-4 border-t border-line pt-4">
            <button
              onClick={() => setShowAssets((v) => !v)}
              className="flex w-full items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg"
            >
              <ChevronDown size={15} className={cn("transition-transform", showAssets && "rotate-180")} />
              Add assets from your library
              {pickedCount > 0 && <Badge tone="accent" className="ml-1">{pickedCount}</Badge>}
            </button>

            {/* Collapsed summary chips */}
            {!showAssets && pickedCount > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pickedAssets.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-2 text-[12px] text-fg"
                  >
                    <AssetThumb a={a} className="h-5 w-5 rounded-full" />
                    {a.name}
                    <button onClick={() => setPick(a.class as AssetClass, null)} className="rounded-full p-0.5 text-faint hover:text-fg">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {showAssets && (
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {ASSET_CLASSES.map((c) => (
                  <SlotCard
                    key={c.key}
                    cls={c.key}
                    asset={picks[c.key] ? (byId[picks[c.key] as string] as Asset) : null}
                    onPick={() => setPickClass(c.key)}
                    onClear={() => setPick(c.key, null)}
                  />
                ))}
              </div>
            )}

            {pickedCount > 0 && (
              <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">Composed prompt</div>
                <p className="text-[13px] leading-relaxed text-muted">{finalPrompt}</p>
              </div>
            )}
          </div>

          {/* Model picker */}
          <div className="mt-5 border-t border-line pt-5">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-faint">Model</div>
            <ModelPicker modality={modality} modelId={modelId} onModality={switchModality} onModel={setModelId} />
          </div>

          {/* Options (disclosed) */}
          <div className="mt-4 border-t border-line pt-4">
            <button
              onClick={() => setShowOptions((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg"
            >
              <ChevronDown size={15} className={cn("transition-transform", showOptions && "rotate-180")} /> Options
            </button>

            {showOptions && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">Aspect</label>
                    <Segmented<AspectRatio>
                      value={aspectRatio}
                      onChange={setAspectRatio}
                      options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
                    />
                  </div>
                  {modality === "video" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted">Duration</label>
                      <Segmented<number>
                        value={durationSec}
                        onChange={setDurationSec}
                        options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
                      />
                    </div>
                  )}
                </div>
                {modality === "video" && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted">Quality</label>
                      <Segmented<Tier>
                        value={tier}
                        onChange={setTier}
                        options={(Object.keys(TIERS) as Tier[]).map((t) => ({
                          value: t,
                          label: TIERS[t].label,
                          hint: `${TIERS[t].resolution} · ${TIERS[t].creditsPerSec}/s`,
                        }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
                      <span className="text-sm font-medium text-fg">Native audio</span>
                      <Toggle checked={audio} onChange={setAudio} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Generate */}
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted">Estimated cost</span>
              <span className="flex items-center gap-1.5 font-semibold">
                <Coins size={15} className="text-warn" /> {cost} credits
              </span>
            </div>
            <Button size="lg" className="w-full" disabled={!canGenerate || rendering} onClick={onGenerate}>
              {rendering ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Generate
                </>
              )}
            </Button>
            {hydrated && !canAfford && (
              <p className="mt-2 text-center text-xs text-danger">
                Not enough credits — you need {cost - credits} more. Tap “Buy” in the top bar.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Result */}
      {activeJob && (
        <Card className="mt-5 p-5">
          <ResultHero job={activeJob} />
          {activeJob.status === "succeeded" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="soft"
                size="sm"
                onClick={() => {
                  saveVideoToAssets(activeJob.id);
                  setSavedMsg(true);
                  setTimeout(() => setSavedMsg(false), 2000);
                }}
              >
                {savedMsg ? (
                  <>
                    <Check size={15} className="text-teal" /> Saved
                  </>
                ) : (
                  <>
                    <Bookmark size={15} /> Save to Assets
                  </>
                )}
              </Button>
              {activeJob.videoUrl || activeJob.posterUrl ? (
                <a href={activeJob.videoUrl ?? activeJob.posterUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <Download size={15} /> Download
                  </Button>
                </a>
              ) : null}
              <Link href="/app/library" className="ml-auto">
                <Button variant="ghost" size="sm">
                  Library <ArrowRight size={15} />
                </Button>
              </Link>
            </div>
          )}
        </Card>
      )}

      <SlotPickerModal
        cls={pickClass}
        assets={assets}
        selectedId={pickClass ? picks[pickClass] ?? null : null}
        onSelect={(id) => {
          if (pickClass) setPick(pickClass, id);
          setPickClass(null);
        }}
        onClose={() => setPickClass(null)}
      />
    </div>
  );
}

/* --------------------------- Slot building blocks -------------------------- */

function SlotCard({
  cls,
  asset,
  onPick,
  onClear,
}: {
  cls: AssetClass;
  asset: Asset | null;
  onPick: () => void;
  onClear: () => void;
}) {
  const meta = CLASS_BY_KEY[cls];
  if (asset) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-2.5">
        <AssetThumb a={asset} className="h-11 w-11 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-accent-2">{meta.label}</div>
          <div className="truncate text-sm font-medium text-fg">{asset.name}</div>
        </div>
        <button onClick={onPick} className="rounded-lg px-2 py-1 text-[12px] font-medium text-muted hover:text-fg">
          Change
        </button>
        <button onClick={onClear} className="rounded-full p-1 text-faint hover:text-fg" aria-label="Remove">
          <X size={15} />
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onPick}
      className="flex items-center gap-3 rounded-xl border border-dashed border-line-2 p-2.5 text-left transition-colors hover:border-accent/40 hover:bg-surface-2"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-faint">
        <ClassIcon icon={meta.icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{meta.label}</span>
        <span className="block truncate text-[12px] text-faint">{meta.tagline}</span>
      </span>
      <Plus size={16} className="mr-1 text-faint" />
    </button>
  );
}

function SlotPickerModal({
  cls,
  assets,
  selectedId,
  onSelect,
  onClose,
}: {
  cls: AssetClass | null;
  assets: Asset[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const meta = cls ? CLASS_BY_KEY[cls] : null;
  const options = cls ? assets.filter((a) => a.class === cls) : [];
  return (
    <Modal open={!!cls} onClose={onClose} title={meta ? `Choose a ${meta.label}` : ""} size="lg">
      {options.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No {meta?.plural.toLowerCase()} yet.{" "}
          <Link href="/app/assets" className="text-accent-2 hover:underline" onClick={onClose}>
            Upload some
          </Link>{" "}
          to use here.
        </p>
      ) : (
        <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {options.map((a) => {
            const active = selectedId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => onSelect(active ? null : a.id)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border bg-surface text-left transition-all",
                  active ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-line-2",
                )}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <AssetThumb a={a} className="h-full w-full" />
                  <span className="absolute left-1.5 top-1.5 flex gap-1">
                    <CompositeBadge a={a} />
                    {a.owner === "business" && (
                      <Badge tone="neutral" className="bg-black/55 text-white border-white/20 backdrop-blur-sm">
                        Business
                      </Badge>
                    )}
                  </span>
                  {active && (
                    <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                      <Check size={14} />
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <div className="truncate text-[13px] font-medium text-fg">{a.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
