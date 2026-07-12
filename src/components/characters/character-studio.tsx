"use client";

// Characters — design or capture a character once, get a full reference sheet
// (turnaround, portrait, expressions), optionally give them a voice, and cast
// them in any shot. A character is a composite asset plus a collection of its
// parts, so "Use in Make" fills image slots with their sheets/photos and a
// sound slot with their voice.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  Check,
  Coins,
  ImagePlus,
  Loader2,
  Mic,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { getModel, priceFor } from "@/lib/models";
import { uploadDataUrl } from "@/lib/cloud";
import type { Asset, AssetPart } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { Badge, Button, Card, Progress, Segmented, TextInput } from "@/components/ui";

type StyleKey = "photoreal" | "cinematic" | "anime" | "3d";

const STYLES: Record<StyleKey, { label: string; suffix: string }> = {
  photoreal: { label: "Photoreal", suffix: "photorealistic, natural skin texture, studio lighting" },
  cinematic: { label: "Cinematic", suffix: "cinematic film still, dramatic lighting, rich color grade, 35mm grain" },
  anime: { label: "Anime", suffix: "high-quality anime character art, clean lineart, cel shading" },
  "3d": { label: "3D Toon", suffix: "stylized 3D animation character render, soft global illumination, expressive" },
};

interface PanelDef {
  key: "sheet" | "portrait" | "expressions";
  label: string;
  hint: string;
  aspect: "16:9" | "1:1";
  wide: boolean;
  prompt: (base: string, style: string) => string;
}

const PANELS: PanelDef[] = [
  {
    key: "sheet",
    label: "Turnaround sheet",
    hint: "Front · side · back, full body",
    aspect: "16:9",
    wide: true,
    prompt: (base, style) =>
      `Character reference sheet of ${base} — full body turnaround with three views side by side on a clean white background: front view with arms slightly outstretched, side profile view, back view. Identical outfit, hair and proportions in every view, even studio lighting, fashion-catalog clarity. ${style}`,
  },
  {
    key: "portrait",
    label: "Portrait",
    hint: "The face card",
    aspect: "1:1",
    wide: false,
    prompt: (base, style) =>
      `Character portrait of ${base} — waist-up, facing camera, confident relaxed expression, clean white studio background. ${style}`,
  },
  {
    key: "expressions",
    label: "Expressions",
    hint: "Nine emotions & head angles",
    aspect: "1:1",
    wide: false,
    prompt: (base, style) =>
      `Expression sheet of ${base} — a clean 3x3 grid of close-up head shots: neutral front, happy, angry, surprised, sad, determined, looking left profile, looking right profile, looking up. Identical face, hair and outfit collar in every cell, white background. ${style}`,
  },
];

/** A locally staged upload (already in Storage) waiting to be saved as an asset. */
interface StagedFile {
  url: string;
  name: string;
}

export function CharacterStudio() {
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
  const cloudUser = useStore((s) => s.cloudUser);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [biology, setBiology] = useState("");
  const [wardrobe, setWardrobe] = useState("");
  const [style, setStyle] = useState<StyleKey>("photoreal");
  const [photos, setPhotos] = useState<StagedFile[]>([]);
  const [voice, setVoice] = useState<StagedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<PanelDef["key"], boolean>>({
    sheet: true,
    portrait: true,
    expressions: true,
  });
  const [jobIds, setJobIds] = useState<Partial<Record<PanelDef["key"], string>>>({});
  const [saved, setSaved] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<HTMLInputElement>(null);

  const characters = useMemo(
    () => assets.filter((a) => a.class === "character" && (a.parts?.length ?? 0) > 0),
    [assets],
  );
  const needsSignIn = cloudConfigured && !cloudUser;

  // Sheets render on the 2K image model — identity work deserves the detail.
  const model = getModel("seedream-45");
  const perPanel = priceFor(model, { count: 1 });
  const chosen = PANELS.filter((p) => selected[p.key]);
  const cost = chosen.length * perPanel;
  const canAfford = credits >= cost;
  const described = description.trim().length > 3 || photos.length > 0;
  const canGenerate = hydrated && described && chosen.length > 0 && canAfford;

  const jobs = PANELS.map((p) => ({
    panel: p,
    job: jobIds[p.key] ? videos.find((v) => v.id === jobIds[p.key]) ?? null : null,
  }));
  const activeJobs = jobs.filter((j) => j.job);
  const rendering = activeJobs.some((j) => j.job!.status === "rendering");
  const doneJobs = activeJobs.filter((j) => j.job!.status === "succeeded" && j.job!.posterUrl);
  const allDone = activeJobs.length > 0 && !rendering && doneJobs.length > 0;

  const base = [
    photos.length
      ? "the exact person shown in the reference photos — same face, same hair, same body"
      : null,
    description.trim() || null,
    biology.trim() || null,
    wardrobe.trim() ? `wearing ${wardrobe.trim()}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  async function stageFiles(files: FileList | null, kind: "photo" | "voice") {
    if (!files?.length) return;
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files).slice(0, kind === "photo" ? 4 - photos.length : 1)) {
        if (file.size > 8 * 1024 * 1024) {
          setUploadError("Files must be under 8 MB.");
          continue;
        }
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        const url = await uploadDataUrl(uid("charup"), dataUrl);
        if (!url) {
          setUploadError("Upload failed — try again.");
          continue;
        }
        const staged = { url, name: file.name.replace(/\.[^.]+$/, "") };
        if (kind === "photo") setPhotos((p) => [...p, staged].slice(0, 4));
        else setVoice(staged);
      }
    } finally {
      setUploading(false);
    }
  }

  function onGenerate() {
    if (!canGenerate || rendering) return;
    setSaved(false);
    const ids: Partial<Record<PanelDef["key"], string>> = {};
    for (const p of chosen) {
      ids[p.key] = generate({
        prompt: p.prompt(base, STYLES[style].suffix),
        tier: "standard",
        durationSec: 5,
        aspectRatio: p.aspect,
        audio: false,
        modelId: model.id,
        modality: "image",
        direction: description.trim() || name.trim(),
        refImageUrls: photos.length ? photos.map((p2) => p2.url) : undefined,
      });
    }
    setJobIds(ids);
  }

  /** Character = a collection of real assets + one composite card that bundles them. */
  function onSave() {
    const charName = name.trim() || "New Character";
    const col = addCategory(`${charName} — character`);

    const partAssets: Asset[] = [];
    photos.forEach((p, i) => {
      partAssets.push(
        addAsset({
          name: `${charName} — photo ${i + 1}`,
          kind: "image",
          url: p.url,
          posterUrl: p.url,
          categoryId: col.id,
          source: "upload",
          promptFragment: `${charName}'s reference photo`,
        }),
      );
    });
    doneJobs.forEach(({ panel, job }) => {
      partAssets.push(
        addAsset({
          name: `${charName} — ${panel.label}`,
          kind: "image",
          url: job!.posterUrl!,
          posterUrl: job!.posterUrl,
          categoryId: col.id,
          source: "generation",
          promptFragment: `${charName}'s ${panel.label.toLowerCase()}`,
        }),
      );
    });
    if (voice) {
      partAssets.push(
        addAsset({
          name: `${charName} — voice`,
          kind: "audio",
          url: voice.url,
          categoryId: col.id,
          source: "upload",
          promptFragment: `${charName}'s voice`,
        }),
      );
    }

    const parts: AssetPart[] = [
      ...photos.map((p, i) => ({
        role: "face" as const,
        kind: "image" as const,
        url: p.url,
        posterUrl: p.url,
        label: `Photo ${i + 1}`,
      })),
      ...doneJobs.map(({ panel, job }) => ({
        role: (panel.key === "portrait" ? "primary" : "reference") as AssetPart["role"],
        kind: "image" as const,
        url: job!.posterUrl!,
        posterUrl: job!.posterUrl,
        label: panel.label,
      })),
      ...(voice ? [{ role: "voice" as const, kind: "audio" as const, url: voice.url, label: "Voice" }] : []),
    ];
    const hero =
      doneJobs.find((j) => j.panel.key === "portrait")?.job?.posterUrl ??
      doneJobs[0]?.job?.posterUrl ??
      photos[0]?.url;
    addAsset({
      name: charName,
      kind: "image",
      url: hero ?? "",
      posterUrl: hero,
      categoryId: col.id,
      source: "generation",
      class: "character",
      promptFragment: `${charName}${description.trim() ? `, ${description.trim().split(/[,.\n]/)[0].toLowerCase()}` : ""}`,
      parts,
    } as Omit<Asset, "id" | "createdAt">);
    setSaved(true);
  }

  /** Cast them: their sheets & photos fill image slots, their voice a sound slot. */
  function useInMake(character: Asset) {
    const ids = assets
      .filter((a) => a.categoryId === character.categoryId && a.id !== character.id)
      .map((a) => a.id);
    setDraftElements(ids.length ? ids : [character.id]);
    router.push("/app");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Characters</h1>
        <p className="mt-1 text-sm text-muted">
          Create a character from photos or a description — get a full character sheet, give
          them a voice, and cast them in any video.
        </p>
      </header>

      {/* ------------------------- Saved characters ------------------------- */}
      {characters.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {characters.map((c) => {
            const hasVoice = c.parts?.some((p) => p.role === "voice");
            const views = c.parts?.filter((p) => p.kind === "image").length ?? 0;
            return (
              <Card key={c.id} className="group overflow-hidden">
                <div className="relative aspect-square bg-surface-2">
                  {c.posterUrl || c.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.posterUrl ?? c.url} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-faint">
                      <UserRound size={26} />
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${c.name}? Their sheet assets stay in your library.`)) {
                        removeAsset(c.id);
                      }
                    }}
                    className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100"
                    aria-label="Delete character"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="p-3">
                  <div className="truncate text-[13.5px] font-semibold">{c.name}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-faint">
                    {views} views
                    {hasVoice && (
                      <Badge tone="teal">
                        <Mic size={10} /> Voice
                      </Badge>
                    )}
                  </div>
                  <Button size="sm" variant="soft" className="mt-2 w-full" onClick={() => useInMake(c)}>
                    <Sparkles size={13} /> Use in Make
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* ------------------------------ Form ------------------------------ */}
        <Card className="h-fit p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
            <UserRound size={14} /> New character
          </div>

          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">Name</label>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Aria, Kato, Nova…" />

          {/* Photos — build the character from one or more pictures */}
          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Photos <span className="normal-case">(optional — 1 to 4 pictures of them)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <span key={p.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.name} className="h-14 w-14 rounded-xl border border-line object-cover" />
                <button
                  onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-fg text-bg"
                  aria-label="Remove photo"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {photos.length < 4 && (
              <button
                onClick={() => photoRef.current?.click()}
                disabled={uploading}
                className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-line-2 text-faint transition-colors hover:border-accent/50 hover:text-accent-2"
                aria-label="Add photo"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              </button>
            )}
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void stageFiles(e.target.files, "photo");
                e.target.value = "";
              }}
            />
          </div>

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Who are they?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="A confident creative director in her late 20s, calm and warm…"
            className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-sm leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />

          <label className="mb-1.5 mt-3 block text-xs font-medium uppercase tracking-wide text-faint">
            Biology <span className="normal-case">(body, face, hair — the physical facts)</span>
          </label>
          <textarea
            value={biology}
            onChange={(e) => setBiology(e.target.value)}
            rows={2}
            placeholder="Long blonde hair, blue eyes, fair skin, 175cm, athletic build…"
            className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-sm leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />

          <label className="mb-1.5 mt-3 block text-xs font-medium uppercase tracking-wide text-faint">
            What are they wearing?
          </label>
          <TextInput
            value={wardrobe}
            onChange={(e) => setWardrobe(e.target.value)}
            placeholder="a camel wool coat over a cream sweater, black leggings, ankle boots"
          />

          {/* Voice — optional */}
          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Voice <span className="normal-case">(optional — a sample of how they sound)</span>
          </label>
          {voice ? (
            <span className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-[13px]">
              <Mic size={14} className="text-teal" />
              <span className="min-w-0 flex-1 truncate">{voice.name}</span>
              <button onClick={() => setVoice(null)} className="text-faint hover:text-fg" aria-label="Remove voice">
                <X size={13} />
              </button>
            </span>
          ) : (
            <button
              onClick={() => voiceRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:border-accent/50 hover:text-fg"
            >
              <Mic size={14} className="text-accent-2" /> Add voice sample
            </button>
          )}
          <input
            ref={voiceRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              void stageFiles(e.target.files, "voice");
              e.target.value = "";
            }}
          />
          {uploadError && <p className="mt-2 text-xs text-danger">{uploadError}</p>}

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">Style</label>
          <Segmented<StyleKey>
            value={style}
            onChange={setStyle}
            options={(Object.keys(STYLES) as StyleKey[]).map((k) => ({ value: k, label: STYLES[k].label }))}
          />

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">Sheet panels</label>
          <div className="space-y-2">
            {PANELS.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelected((s) => ({ ...s, [p.key]: !s[p.key] }))}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                  selected[p.key] ? "border-accent/60 bg-accent-soft" : "border-line hover:border-line-2",
                )}
              >
                <span>
                  <span className="block text-[13px] font-semibold text-fg">{p.label}</span>
                  <span className="block text-[11px] text-faint">{p.hint}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] text-faint">{perPanel} cr</span>
                  {selected[p.key] && <Check size={15} className="text-accent-2" />}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
            <span className="text-muted">Estimated cost</span>
            <span className="flex items-center gap-1.5 font-semibold">
              <Coins size={15} className="text-warn" /> {cost} credits
            </span>
          </div>
          {needsSignIn ? (
            <Button size="lg" className="mt-3 w-full" onClick={() => setAuthOpen(true)}>
              <Sparkles size={17} /> Sign in to generate
            </Button>
          ) : (
            <Button size="lg" className="mt-3 w-full" disabled={!canGenerate || rendering} onClick={onGenerate}>
              {rendering ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles size={17} /> Generate character sheet
                </>
              )}
            </Button>
          )}
          {hydrated && !needsSignIn && !canAfford && (
            <p className="mt-2 text-center text-xs text-danger">
              Not enough credits — you need {cost - credits} more.
            </p>
          )}
        </Card>

        {/* ----------------------------- Results ---------------------------- */}
        <div className="space-y-4">
          {activeJobs.length === 0 ? (
            <Card className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-2">
                <UserRound size={22} />
              </span>
              <p className="mt-3 max-w-sm text-sm text-muted">
                Your character sheet appears here — full-body turnaround, portrait and
                expressions, generated from your photos or your description.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {jobs
                .filter((j) => j.job)
                .map(({ panel, job }) => (
                  <Card key={panel.key} className={cn("overflow-hidden", panel.wide && "sm:col-span-2")}>
                    <div className={cn("relative w-full bg-surface-2", panel.aspect === "16:9" ? "aspect-video" : "aspect-square", !panel.wide && "sm:aspect-square")}>
                      {job!.status === "rendering" ? (
                        <div className="shimmer flex h-full flex-col items-center justify-center">
                          <Loader2 size={20} className="animate-spin text-accent-2" />
                          <div className="mt-3 w-32">
                            <Progress value={job!.progress} />
                          </div>
                        </div>
                      ) : job!.status === "succeeded" && job!.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={job!.posterUrl} alt={panel.label} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center p-4 text-center text-xs text-danger">
                          {job!.error ?? "Failed"}
                        </div>
                      )}
                      <span className="absolute left-2 top-2">
                        <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                          {panel.label}
                        </Badge>
                      </span>
                    </div>
                  </Card>
                ))}
            </div>
          )}

          {allDone && (
            <Card className="flex flex-wrap items-center gap-2 p-4">
              <Button onClick={onSave} disabled={saved}>
                {saved ? (
                  <>
                    <Check size={16} className="text-teal" /> Saved to Characters
                  </>
                ) : (
                  <>
                    <Bookmark size={16} /> Save character
                  </>
                )}
              </Button>
              {saved && (
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                  See your characters <ArrowRight size={15} />
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
