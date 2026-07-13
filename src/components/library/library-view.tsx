"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Film,
  Play,
  Sparkles,
  Loader2,
  Trash2,
  Download,
  Bookmark,
  Repeat2,
  Check,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { getModel } from "@/lib/models";
import { TIERS, type Asset, type VideoJob } from "@/lib/types";
import { timeAgo, cn } from "@/lib/utils";
import { Button, Card, Badge, EmptyState, Modal, Progress } from "@/components/ui";
import {
  AssetThumb,
  VideoPreview,
  classifyGenError,
  genErrorReason,
  safeRewritePrompt,
} from "@/components/shared";

export function LibraryView() {
  const allJobs = useStore((s) => s.videos);
  const hydrated = useStore((s) => s.hasHydrated);
  const [openId, setOpenId] = useState<string | null>(null);

  // Videos only — the product doesn't produce images for now.
  const videos = useMemo(() => allJobs.filter((v) => (v.modality ?? "video") === "video"), [allJobs]);
  const open = videos.find((v) => v.id === openId) ?? null;
  const done = videos.filter((v) => v.status === "succeeded").length;
  const failed = videos.filter((v) => v.status === "failed").length;

  // Deep link from Plan ("View video"): /app/videos?open=<jobId>
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("open");
    if (!id) return;
    window.history.replaceState({}, "", window.location.pathname);
    setOpenId(id);
  }, []);

  if (!hydrated) return <GridSkeleton />;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Videos</h1>
          <p className="mt-1 text-sm text-muted">
            {videos.length === 0
              ? "Every video you generate is collected and managed here."
              : `${done} ${done === 1 ? "video" : "videos"} generated${
                  failed > 0 ? ` · ${failed} failed` : ""
                }.`}
          </p>
        </div>
        <Button onClick={() => (window.location.href = "/app/make")} className="hidden sm:inline-flex">
          <Sparkles size={16} /> Make
        </Button>
      </header>

      {videos.length === 0 ? (
        <EmptyState
          icon={<Film size={24} />}
          title="Nothing here yet"
          description="Generate from Make and your videos land here — ready to play, download, remix and reuse."
          action={
            <Button onClick={() => (window.location.href = "/app/make")}>
              <Sparkles size={16} /> Make something
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <ContentCard key={v.id} video={v} onOpen={() => v.status === "succeeded" && setOpenId(v.id)} />
          ))}
        </div>
      )}

      <ContentModal video={open} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ContentCard({ video, onOpen }: { video: VideoJob; onOpen: () => void }) {
  const router = useRouter();
  const removeVideo = useStore((s) => s.removeVideo);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const updateIdeaPrompt = useStore((s) => s.updateIdeaPrompt);
  const [fixing, setFixing] = useState(false);
  const rendering = video.status === "rendering";
  const failed = video.status === "failed";
  const model = getModel(video.modelId);
  const failInfo = failed ? classifyGenError(video.error) : null;
  return (
    <Card className="group overflow-hidden">
      <button
        onClick={onOpen}
        disabled={rendering || failed}
        className="relative block aspect-video w-full overflow-hidden bg-surface-2"
      >
        {rendering ? (
          <div className="shimmer flex h-full flex-col items-center justify-center">
            <Loader2 size={22} className="animate-spin text-accent-2" />
            <div className="mt-3 w-32">
              <Progress value={video.progress} />
            </div>
            <span className="mt-1.5 text-xs tabular-nums text-faint">{video.progress}%</span>
          </div>
        ) : failed ? (
          // Say it plainly: this one didn't make it — and exactly why.
          <div className="flex h-full flex-col items-center justify-center gap-1.5 border-b-2 border-danger/40 bg-danger/5 px-5 text-center">
            <AlertTriangle size={20} className="text-danger" />
            <span className="text-[13.5px] font-semibold text-fg">{failInfo!.title}</span>
            <span className="line-clamp-2 text-[12px] leading-snug text-muted">{failInfo!.detail}</span>
            {genErrorReason(video.error) && (
              <span
                className="max-w-full truncate font-mono text-[10.5px] text-faint"
                title={genErrorReason(video.error)}
              >
                {genErrorReason(video.error)}
              </span>
            )}
          </div>
        ) : (
          <>
            {video.videoUrl ? (
              // Proper preview: a real frame from the clip, playing on hover.
              <VideoPreview
                src={video.videoUrl}
                poster={video.posterUrl}
                className="h-full w-full"
              />
            ) : video.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.posterUrl} alt={video.prompt} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-faint">
                <Film size={26} />
              </div>
            )}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                <Play size={18} className="ml-0.5 text-black" fill="black" />
              </span>
            </span>
            <span className="absolute bottom-2 right-2">
              <Badge tone="neutral" className="bg-black/60 text-white border-white/20 backdrop-blur-sm">
                {video.durationSec}s
              </Badge>
            </span>
          </>
        )}
      </button>
      {failed && (
        <div className="flex flex-wrap gap-2 border-b border-line px-3.5 py-2.5">
          <Button
            size="sm"
            variant="soft"
            disabled={fixing}
            onClick={async () => {
              setFixing(true);
              try {
                const rewritten = await safeRewritePrompt(video.prompt, video.error);
                if (video.planId && video.ideaId) {
                  updateIdeaPrompt(video.planId, video.ideaId, rewritten);
                }
                setDraftDirection(rewritten);
                router.push("/app/make");
              } catch {
                // Rewrite unavailable — fall back to editing the original.
                setDraftDirection(video.prompt);
                router.push("/app/make");
              } finally {
                setFixing(false);
              }
            }}
          >
            {fixing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {fixing ? "Rewriting…" : "Fix & retry"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={fixing}
            onClick={() => {
              setDraftDirection(video.prompt);
              router.push("/app/make");
            }}
          >
            <Repeat2 size={14} /> Edit in Make
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            onClick={() => removeVideo(video.id)}
          >
            <Trash2 size={14} /> Remove
          </Button>
        </div>
      )}
      <div className="p-3.5">
        <p className="line-clamp-2 text-sm text-fg">{video.prompt}</p>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone="accent">
            {model.glyph} {model.name}
          </Badge>
          <span className="text-xs text-faint">{timeAgo(video.createdAt)}</span>
        </div>
      </div>
    </Card>
  );
}

function ContentModal({ video, onClose }: { video: VideoJob | null; onClose: () => void }) {
  const router = useRouter();
  const assets = useStore((s) => s.assets);
  const plans = useStore((s) => s.plans);
  const removeVideo = useStore((s) => s.removeVideo);
  const saveVideoToAssets = useStore((s) => s.saveVideoToAssets);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const setDraftElements = useStore((s) => s.setDraftElements);
  const [saved, setSaved] = useState(false);

  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);
  if (!video) return null;

  const model = getModel(video.modelId);
  const sources = (video.elements ?? []).map((id) => byId[id]).filter(Boolean) as Asset[];
  // Provenance: the plan idea this video was made from.
  const fromPlan = video.planId ? plans.find((p) => p.id === video.planId) : null;
  const fromIdea = fromPlan?.ideas.find((i) => i.id === video.ideaId) ?? null;

  function remix() {
    if (!video) return;
    setDraftElements(video.elements ?? []);
    setDraftDirection(video.direction ?? "");
    onClose();
    router.push("/app/make");
  }

  return (
    <Modal open={!!video} onClose={onClose} size="lg" title="Video">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={video.videoUrl} poster={video.posterUrl} controls autoPlay playsInline className="w-full rounded-xl bg-black" />
      <p className="mt-4 text-sm text-fg">{video.prompt}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone="accent">
          {model.glyph} {model.name}
        </Badge>
        <Badge>{TIERS[video.tier].label}</Badge>
        <Badge>{video.durationSec}s</Badge>
        <Badge>{video.aspectRatio}</Badge>
        {video.audio && <Badge tone="teal">Audio</Badge>}
        <span className="text-xs text-faint">{timeAgo(video.createdAt)}</span>
      </div>

      {fromPlan && (
        <button
          onClick={() => {
            onClose();
            router.push("/app");
          }}
          className="mt-4 flex w-full items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2.5 text-left transition-colors hover:border-accent/50"
        >
          <Lightbulb size={14} className="shrink-0 text-accent-2" />
          <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
            From plan: <span className="font-semibold">{fromIdea?.title ?? "idea"}</span>
            <span className="text-muted"> · “{fromPlan.brief}”</span>
          </span>
        </button>
      )}

      {sources.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">Made from</div>
          <div className="flex flex-wrap gap-2">
            {sources.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 text-[12px] text-fg">
                <AssetThumb a={a} className="h-5 w-5 rounded-full" />
                {a.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        <Button variant="primary" size="sm" onClick={remix}>
          <Repeat2 size={15} /> Remix
        </Button>
        <Button
          variant="soft"
          size="sm"
          onClick={() => {
            saveVideoToAssets(video.id);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        >
          {saved ? (
            <>
              <Check size={15} className="text-teal" /> Saved
            </>
          ) : (
            <>
              <Bookmark size={15} /> Save to Assets
            </>
          )}
        </Button>
        <a href={video.videoUrl ?? video.posterUrl} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">
            <Download size={15} /> Download
          </Button>
        </a>
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={() => {
            removeVideo(video.id);
            onClose();
          }}
        >
          <Trash2 size={15} /> Delete
        </Button>
      </div>
    </Modal>
  );
}

function GridSkeleton() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 h-8 w-40 rounded-lg bg-surface-2" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn("rounded-[var(--radius-xl2)] border border-line bg-surface-2")}>
            <div className="aspect-video w-full rounded-t-[var(--radius-xl2)] bg-surface-3" />
            <div className="space-y-2 p-3.5">
              <div className="h-3 w-full rounded bg-surface-3" />
              <div className="h-3 w-2/3 rounded bg-surface-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
