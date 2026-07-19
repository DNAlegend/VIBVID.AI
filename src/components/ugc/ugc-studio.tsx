"use client";

// UGC Ads — the fastest path from "my product" to a creator-style vertical
// ad. Pick a format (product in hand / iPhone app / screen demo), attach the
// product or screenshots and an optional presenter, then start from a proven
// ad script — already written — and just swap in your product and its
// benefit. The clip generates right here, vertical 9:16, with every
// reference bound explicitly so Seedance reproduces YOUR product, YOUR app
// screens and YOUR presenter exactly.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Coins,
  Film,
  ImagePlus,
  Loader2,
  Megaphone,
  Package,
  Smartphone,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { getModel, videoRate } from "@/lib/models";
import { uploadDataUrl } from "@/lib/cloud";
import { UGC_TEMPLATES, UGC_FORMATS, type UgcFormat, type UgcTemplate } from "@/lib/ugc-templates";
import type { Asset } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { Badge, Button, Card, Progress } from "@/components/ui";

const textareaCls =
  "w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-base leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm";

type UgcTier = "mini" | "pro" | "4k";
const TIERS: Record<UgcTier, { label: string; modelId: string; resolution: string }> = {
  mini: { label: "Mini · 720p", modelId: "seedance-2-mini", resolution: "720p" },
  pro: { label: "Pro · 1080p", modelId: "seedance-2-pro", resolution: "1080p" },
  "4k": { label: "4K", modelId: "seedance-2-pro", resolution: "4K" },
};

/** Public https photos of a product composite. */
function productPhotoUrls(p: Asset): string[] {
  return (p.parts ?? [])
    .filter((x) => x.kind === "image" && /^https:\/\//i.test(x.url))
    .map((x) => x.url)
    .slice(0, 3);
}

export function UgcStudio() {
  const router = useRouter();
  const assets = useStore((s) => s.assets);
  const videos = useStore((s) => s.videos);
  const credits = useStore((s) => s.credits);
  const hydrated = useStore((s) => s.hasHydrated);
  const generate = useStore((s) => s.generate);
  const cloudUser = useStore((s) => s.cloudUser);
  const subscribed = useStore((s) => s.subscribed);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const [format, setFormat] = useState<UgcFormat>("product");
  const [productId, setProductId] = useState<string | null>(null);
  const [presenterId, setPresenterId] = useState<string | null>(null);
  const [shots, setShots] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [benefit, setBenefit] = useState("");
  const [script, setScript] = useState("");
  const [tier, setTier] = useState<UgcTier>("pro");
  const [jobId, setJobId] = useState<string | null>(null);
  const shotRef = useRef<HTMLInputElement>(null);

  const products = useMemo(
    () => assets.filter((a) => a.class === "product" && (a.parts?.length ?? 0) > 0),
    [assets],
  );
  const characters = useMemo(
    () => assets.filter((a) => a.class === "character" && (a.parts?.length ?? 0) > 0),
    [assets],
  );
  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);
  const needsSignIn = cloudConfigured && !cloudUser;
  const locked = cloudConfigured && subscribed === false;

  const templates = UGC_TEMPLATES.filter((t) => t.format === format);
  const template = templateId ? UGC_TEMPLATES.find((t) => t.id === templateId) ?? null : null;
  const product = productId ? byId[productId] : null;
  const presenter = presenterId ? byId[presenterId] : null;

  const model = getModel(TIERS[tier].modelId);
  const cost = template ? videoRate(model, TIERS[tier].resolution) * template.durationSec : 0;
  const canAfford = credits >= cost;

  const job = jobId ? videos.find((v) => v.id === jobId) ?? null : null;
  const rendering = job?.status === "rendering";
  const videoUrl = job?.status === "succeeded" ? job.videoUrl ?? null : null;

  /** Fill (or refill) the script from a template with the current inputs. */
  function applyTemplate(t: UgcTemplate, name = productName, ben = benefit) {
    setTemplateId(t.id);
    setScript(
      t.script({
        product: name.trim() || (format === "product" ? "the product" : "the app"),
        benefit: ben.trim() || "it just works",
      }),
    );
  }

  /** Inputs changed — regenerate the script unless the creator edited it by hand. */
  function refreshInputs(name: string, ben: string) {
    setProductName(name);
    setBenefit(ben);
    if (template) {
      const before = template.script({
        product: productName.trim() || (format === "product" ? "the product" : "the app"),
        benefit: benefit.trim() || "it just works",
      });
      // Only auto-rewrite when the script is still the untouched template.
      if (script === before) applyTemplate(template, name, ben);
    }
  }

  async function stageShots(files: FileList | null) {
    if (!files?.length) return;
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files).slice(0, 3 - shots.length)) {
        if (file.size > 8 * 1024 * 1024) {
          setUploadError("Screenshots must be under 8 MB.");
          continue;
        }
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        let url = await uploadDataUrl(uid("ugcshot"), dataUrl);
        if (!url && !cloudConfigured) url = dataUrl;
        if (!url) {
          setUploadError("Upload failed — try again.");
          continue;
        }
        setShots((s) => [...s, { url, name: file.name.replace(/\.[^.]+$/, "") }].slice(0, 3));
      }
    } finally {
      setUploading(false);
      if (shotRef.current) shotRef.current.value = "";
    }
  }

  /** References + their legend, in the exact order Seedance receives them. */
  function buildReferences(): { urls: string[]; legend: string[] } {
    const urls: string[] = [];
    const legend: string[] = [];
    const slot = () => `Image ${urls.length}`;
    if (presenter && format !== "screen" && /^https:\/\//i.test(presenter.url)) {
      urls.push(presenter.url);
      legend.push(
        `${slot()} is the character sheet of "${presenter.name}" — this exact person is the creator on camera; copy the face, hair and build exactly.`,
      );
    }
    if (format === "product" && product) {
      for (const u of productPhotoUrls(product)) {
        urls.push(u);
        legend.push(
          `${slot()} shows the product "${product.name}" — reproduce this exact product, its shape, colors, materials and label; do not redesign it.`,
        );
      }
    }
    if (format !== "product") {
      shots.forEach((s, i) => {
        if (!/^https:\/\//i.test(s.url)) return;
        urls.push(s.url);
        legend.push(
          format === "iphone"
            ? `${slot()} is screenshot ${i + 1} of the app — the iPhone screen in the video shows exactly this interface; reproduce the layout, colors and content faithfully.`
            : `${slot()} is screen ${i + 1} of the product — the on-screen interface in the video is exactly this; reproduce it faithfully and invent no other UI.`,
        );
      });
    }
    return { urls: urls.slice(0, 9), legend };
  }

  function onGenerate() {
    if (rendering || !template || !script.trim()) return;
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    if (locked) {
      useStore.getState().blockIfLocked();
      return;
    }
    if (!canAfford) return;
    const { urls, legend } = buildReferences();
    const t = TIERS[tier];
    const id = generate({
      prompt: legend.length ? `${legend.join(" ")}\n\n${script}` : script,
      tier: "standard",
      durationSec: template.durationSec,
      aspectRatio: "9:16",
      audio: true,
      modelId: t.modelId,
      modality: "video",
      elements: [presenterId, productId].filter(Boolean) as string[],
      direction: `UGC — ${template.name} — ${productName.trim() || product?.name || "ad"}`,
      posterUrl: product?.posterUrl ?? shots[0]?.url,
      resolution: t.resolution,
      refImageUrls: urls.length ? urls : undefined,
    });
    setJobId(id);
  }

  const needsMedia = format === "product" ? !product && !productName.trim() : shots.length === 0;
  const canGenerate = hydrated && !!template && script.trim().length > 0 && canAfford && !needsMedia;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">UGC Ads</h1>
        <p className="mt-1 text-sm text-muted">
          Creator-style vertical ads from proven scripts. Pick a format, drop in your product or
          screens, swap the benefit — the copy is already written.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* ------------------------------- Setup ------------------------------ */}
        <Card className="h-fit p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
            <Megaphone size={14} /> New UGC ad
          </div>

          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">Format</label>
          <div className="grid grid-cols-3 gap-2">
            {UGC_FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFormat(f.key);
                  setTemplateId(null);
                  setScript("");
                }}
                title={f.blurb}
                className={cn(
                  "rounded-xl border p-2.5 text-left transition-colors",
                  format === f.key ? "border-accent bg-accent-soft" : "border-line hover:border-line-2",
                )}
              >
                {f.key === "product" ? (
                  <Package size={16} className={format === f.key ? "text-accent-2" : "text-faint"} />
                ) : f.key === "iphone" ? (
                  <Smartphone size={16} className={format === f.key ? "text-accent-2" : "text-faint"} />
                ) : (
                  <Film size={16} className={format === f.key ? "text-accent-2" : "text-faint"} />
                )}
                <span className="mt-1 block text-[12px] font-semibold leading-tight text-fg">{f.label}</span>
              </button>
            ))}
          </div>

          {/* The product (physical) or the screens (app / web). */}
          {format === "product" ? (
            <>
              <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
                Your product
              </label>
              {products.length === 0 ? (
                <button
                  onClick={() => router.push("/app/products")}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-left text-[12.5px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
                >
                  <Package size={14} className="text-accent-2" /> Save a product first — its photos keep the ad exact
                </button>
              ) : (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {products.map((p) => {
                    const on = productId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setProductId(on ? null : p.id);
                          if (!on) refreshInputs(p.name, benefit);
                        }}
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
            </>
          ) : (
            <>
              <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
                {format === "iphone" ? "App screenshots" : "Screen shots"}{" "}
                <span className="normal-case">(up to 3 — shown exactly in the video)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {shots.map((s, i) => (
                  <span key={s.url} className="relative h-16 w-12 overflow-hidden rounded-lg border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt={s.name} className="h-full w-full object-cover" />
                    <button
                      onClick={() => setShots((x) => x.filter((_, j) => j !== i))}
                      className="absolute right-0 top-0 rounded-bl-lg bg-black/60 p-1 text-white"
                      aria-label="Remove screenshot"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {shots.length < 3 && (
                  <button
                    onClick={() => shotRef.current?.click()}
                    disabled={uploading}
                    className="flex h-16 w-12 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line-2 text-faint transition-colors hover:border-accent/50 hover:text-accent-2"
                  >
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                  </button>
                )}
                <input
                  ref={shotRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => stageShots(e.target.files)}
                />
              </div>
              {uploadError && <p className="mt-1.5 text-xs text-danger">{uploadError}</p>}
            </>
          )}

          {/* The presenter (optional; screen demos are voice-over only). */}
          {format !== "screen" && (
            <>
              <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
                Presenter <span className="normal-case">(optional — a saved character keeps the same face)</span>
              </label>
              {characters.length === 0 ? (
                <button
                  onClick={() => router.push("/app/characters")}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-left text-[12.5px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
                >
                  <UserRound size={14} className="text-accent-2" /> Create a character — or let the model cast one
                </button>
              ) : (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {characters.map((c) => {
                    const on = presenterId === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setPresenterId(on ? null : c.id)}
                        className={cn(
                          "flex shrink-0 items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 text-[12px] font-medium transition-colors",
                          on ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-2",
                        )}
                      >
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                          {c.posterUrl || c.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.posterUrl ?? c.url} alt={c.name} className="h-full w-full object-cover" />
                          ) : (
                            <UserRound size={14} className="m-auto text-faint" />
                          )}
                          {on && (
                            <span className="absolute inset-0 flex items-center justify-center bg-accent/70 text-white">
                              <Check size={13} />
                            </span>
                          )}
                        </span>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* The two swaps that personalise every template. */}
          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            {format === "product" ? "Product name" : "App / product name"}
          </label>
          <input
            value={productName}
            onChange={(e) => refreshInputs(e.target.value, benefit)}
            placeholder={format === "product" ? "Glow Serum" : "SleepWell"}
            className="h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <label className="mb-1.5 mt-3 block text-xs font-medium uppercase tracking-wide text-faint">
            The benefit <span className="normal-case">(one line — it carries the ad)</span>
          </label>
          <input
            value={benefit}
            onChange={(e) => refreshInputs(productName, e.target.value)}
            placeholder="cleared my skin in a week"
            className="h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Renders on
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TIERS) as UgcTier[]).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors",
                  tier === t ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-2",
                )}
              >
                Seedance 2.0 {TIERS[t].label}
              </button>
            ))}
          </div>
        </Card>

        {/* --------------------- Templates + script + clip --------------------- */}
        <div className="space-y-4">
          <div>
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-faint">
              Proven scripts — tap one, it fills in your product
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {templates.map((t) => {
                const on = templateId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className={cn(
                      "rounded-xl border p-3.5 text-left transition-colors",
                      on ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-2",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-bold text-fg">{t.name}</span>
                      <Badge tone="neutral">{t.durationSec}s</Badge>
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{t.tagline}</span>
                    <span className="mt-1.5 block truncate text-[11.5px] italic text-faint">
                      “{t.hook({ product: productName.trim() || (format === "product" ? "your product" : "your app"), benefit: benefit.trim() || "the benefit" })}”
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {template && (
            <Card className="p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
                  <Megaphone size={14} /> {template.name} — your script
                </div>
                <Badge tone="neutral">9:16 · {template.durationSec}s</Badge>
              </div>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={12}
                className={textareaCls}
              />
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="text-muted">Cost</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Coins size={15} className="text-warn" /> {cost} credits
                </span>
              </div>
              {needsSignIn ? (
                <Button size="lg" className="mt-3 w-full" onClick={() => setAuthOpen(true)}>
                  <Sparkles size={17} /> Sign in to generate
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="mt-3 w-full"
                  disabled={rendering || (!locked && !canGenerate)}
                  onClick={onGenerate}
                >
                  {rendering ? (
                    <>
                      <Loader2 size={17} className="animate-spin" /> Shooting the ad…
                    </>
                  ) : locked ? (
                    <>
                      <Sparkles size={17} /> Subscribe to generate
                    </>
                  ) : videoUrl ? (
                    <>
                      <Sparkles size={17} /> Regenerate the ad
                    </>
                  ) : (
                    <>
                      <Sparkles size={17} /> Generate the ad
                    </>
                  )}
                </Button>
              )}
              {needsMedia && (
                <p className="mt-2 text-center text-xs text-faint">
                  {format === "product"
                    ? "Pick a product (or at least type its name) so the ad shows the real thing."
                    : "Add at least one screenshot — it becomes the screen in the video."}
                </p>
              )}
              {hydrated && !needsSignIn && !locked && template && !canAfford && (
                <p className="mt-2 text-center text-xs text-danger">
                  Not enough credits — you need {cost - credits} more.
                </p>
              )}
            </Card>
          )}

          {job && (
            <Card className="overflow-hidden">
              {rendering ? (
                <div className="shimmer flex aspect-[9/16] max-h-[480px] w-full flex-col items-center justify-center bg-surface-2">
                  <Loader2 size={20} className="animate-spin text-accent-2" />
                  <div className="mt-3 w-32">
                    <Progress value={job.progress} />
                  </div>
                  <span className="mt-2 text-[11px] text-faint">Shooting your UGC ad…</span>
                </div>
              ) : videoUrl ? (
                <div className="p-3">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={videoUrl}
                    poster={job.posterUrl ?? undefined}
                    controls
                    playsInline
                    className="mx-auto max-h-[480px] rounded-xl border border-line"
                  />
                  <p className="mt-2 text-center text-[12px] text-faint">
                    Saved to My Videos with its full production record.
                  </p>
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-danger">{job.error ?? "The ad failed — try again."}</div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
