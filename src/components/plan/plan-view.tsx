"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb,
  Loader2,
  Sparkles,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Film,
  Check,
  AlertTriangle,
  ChevronDown,
  Clapperboard,
  Scissors,
  UserRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase, cloudConfigured } from "@/lib/supabase";
import { getModel, priceFor } from "@/lib/models";
import type { Asset, Plan, PlanIdea, VideoJob } from "@/lib/types";
import { timeAgo, cn } from "@/lib/utils";
import { Button, Card, Badge, EmptyState } from "@/components/ui";
import {
  classifyGenError,
  genErrorReason,
  safeRewritePrompt,
  planSegments,
  ScriptBeats,
} from "@/components/shared";

/** Target runtimes offered for the whole production (null = Director decides). */
const TARGETS: Array<{ label: string; sec: number | null }> = [
  { label: "Auto", sec: null },
  { label: "15s", sec: 15 },
  { label: "30s", sec: 30 },
  { label: "1 min", sec: 60 },
  { label: "2 min", sec: 120 },
  { label: "3 min", sec: 180 },
];

function fmtSec(total: number): string {
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m}:${String(s).padStart(2, "0")}` : `${m} min`;
}

/** One-click production presets: draft everything cheap, finalize the keepers.
 *  `quality` names the tier; `resolution` is surfaced in the UI and the confirm
 *  so a batch never renders at a quality the user didn't expect. */
const QUALITY = {
  draft: { modelId: "seedance-2-mini", resolution: "480p", label: "Draft", quality: "480p draft" },
  final: { modelId: "seedance-2-pro", resolution: "1080p", label: "Final", quality: "1080p · Full HD, native audio" },
} as const;
type QualityKey = keyof typeof QUALITY;

type ShotState = "idea" | "sent" | "producing" | "produced" | "failed";

function shotState(idea: PlanIdea, job: VideoJob | undefined): ShotState {
  if (job) {
    if (job.status === "succeeded") return "produced";
    if (job.status === "failed") return "failed";
    return "producing";
  }
  return idea.sentAt ? "sent" : "idea";
}

export function PlanView() {
  const router = useRouter();
  const plans = useStore((s) => s.plans);
  const videos = useStore((s) => s.videos);
  const assets = useStore((s) => s.assets);
  const hydrated = useStore((s) => s.hasHydrated);
  const addPlan = useStore((s) => s.addPlan);
  const removePlan = useStore((s) => s.removePlan);
  const markIdeaSent = useStore((s) => s.markIdeaSent);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const setDraftElements = useStore((s) => s.setDraftElements);
  const setDraftPlanRef = useStore((s) => s.setDraftPlanRef);
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const updateIdeaPrompt = useStore((s) => s.updateIdeaPrompt);
  const generate = useStore((s) => s.generate);
  const credits = useStore((s) => s.credits);
  const cloudUser = useStore((s) => s.cloudUser);

  const [brief, setBrief] = useState("");
  const [targetSec, setTargetSec] = useState<number | null>(null);
  const [castIds, setCastIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The one shot whose full script is open — keeps the production scannable. */
  const [openId, setOpenId] = useState<string | null>(null);
  /** Which preset one-click production uses (draft = cheap iteration). */
  const [quality, setQuality] = useState<QualityKey>("draft");

  const activePlanId = useStore((s) => s.activePlanId);
  const setActivePlan = useStore((s) => s.setActivePlan);
  // The production that's open; null shows the productions list.
  const plan = plans.find((p) => p.id === activePlanId) ?? null;
  const jobsById = useMemo(() => {
    const m = new Map<string, VideoJob>();
    for (const v of videos) m.set(v.id, v);
    return m;
  }, [videos]);

  // Saved characters the creator can cast into the production.
  const characters = useMemo(
    () => assets.filter((a) => a.class === "character" && (a.parts?.length ?? 0) > 0),
    [assets],
  );
  const castOfPlan = useMemo(
    () => (plan?.castIds ?? []).map((id) => assets.find((a) => a.id === id)).filter(Boolean) as Asset[],
    [plan, assets],
  );

  const totalSec = plan?.ideas.reduce((sum, i) => sum + (i.durationSec ?? 0), 0) ?? 0;

  const stateOf = (idea: PlanIdea) =>
    shotState(idea, idea.jobId ? jobsById.get(idea.jobId) : undefined);
  const producedCount = plan ? plan.ideas.filter((i) => stateOf(i) === "produced").length : 0;
  /** The next shot to work on — first one that isn't produced or rendering. */
  const nextShot = plan?.ideas.find((i) => {
    const st = stateOf(i);
    return st === "idea" || st === "failed" || st === "sent";
  });

  // A fresh production opens on its first unproduced shot.
  useEffect(() => {
    if (!plan) return;
    const next = plan.ideas.find((i) => stateOf(i) !== "produced") ?? plan.ideas[0];
    setOpenId(next?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);

  function jumpToShot(id: string) {
    setOpenId(id);
    requestAnimationFrame(() => {
      document.getElementById(`shot-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function writePlan() {
    const goal = brief.trim();
    if (!goal || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) {
        setAuthOpen(true);
        return;
      }
      const cast = castIds
        .map((id) => assets.find((a) => a.id === id))
        .filter(Boolean)
        .map((a) => ({ name: a!.name, look: a!.promptFragment ?? "" }));
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brief: goal, targetSec: targetSec ?? undefined, cast }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The Strategist is unavailable");
      const clips: Array<{ title: string; role: string; durationSec: number; why: string; prompt: string }> =
        data.clips ?? [];
      addPlan(
        goal,
        clips.map((c) => ({
          title: c.title,
          hook: c.why,
          prompt: c.prompt,
          role: c.role || undefined,
          durationSec: c.durationSec,
        })),
        {
          title: data.title || undefined,
          logline: data.logline || undefined,
          direction: data.direction || undefined,
          targetSec: targetSec ?? undefined,
          castIds: castIds.length ? [...castIds] : undefined,
        },
      );
      setBrief("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function openAndMake(p: Plan, idea: PlanIdea) {
    setDraftDirection(idea.prompt);
    setDraftPlanRef({ planId: p.id, ideaId: idea.id });
    // The production's cast rides along: sheets fill image slots, voices sound slots.
    const elementIds = (p.castIds ?? []).flatMap((cid) => {
      const c = assets.find((a) => a.id === cid);
      if (!c) return [];
      const voice = assets.find((a) => a.categoryId === c.categoryId && a.kind === "audio");
      return [c.id, ...(voice ? [voice.id] : [])];
    });
    if (elementIds.length) setDraftElements(elementIds);
    markIdeaSent(p.id, idea.id);
    router.push("/app/make");
  }

  const shotCost = (idea: PlanIdea, q: QualityKey = quality) =>
    priceFor(getModel(QUALITY[q].modelId), {
      durationSec: idea.durationSec ?? 5,
      count: 1,
      hasRefs: false,
      resolution: QUALITY[q].resolution,
    });

  /** One click: produce the shot right here with the production's cast attached. */
  function quickProduce(p: Plan, idea: PlanIdea, promptOverride?: string): boolean {
    if (cloudConfigured && !cloudUser) {
      setAuthOpen(true);
      return false;
    }
    const q = QUALITY[quality];
    const cost = shotCost(idea);
    if (credits < cost) {
      setError(`Not enough credits — this shot needs ~${cost}. Top up and try again.`);
      return false;
    }
    const cast = (p.castIds ?? [])
      .map((id) => assets.find((a) => a.id === id))
      .filter(Boolean) as Asset[];
    const refImageUrls = cast.map((c) => c.url).filter((u) => u?.startsWith("http"));
    const voiceIds = cast.flatMap((c) => {
      const v = assets.find((a) => a.categoryId === c.categoryId && a.kind === "audio");
      return v ? [v.id] : [];
    });
    const script = promptOverride ?? idea.prompt;
    markIdeaSent(p.id, idea.id);
    generate({
      prompt: script,
      tier: "standard",
      durationSec: idea.durationSec ?? 5,
      aspectRatio: "16:9",
      audio: true,
      modelId: q.modelId,
      modality: "video",
      elements: [...cast.map((c) => c.id), ...voiceIds],
      direction: script,
      planId: p.id,
      ideaId: idea.id,
      resolution: q.resolution,
      refImageUrls: refImageUrls.length ? refImageUrls : undefined,
      posterUrl: cast[0]?.posterUrl ?? cast[0]?.url ?? undefined,
    });
    setError(null);
    return true;
  }

  /** Produce every remaining shot in one go. */
  function produceAll(p: Plan) {
    const remaining = p.ideas.filter((i) => {
      const st = stateOf(i);
      return st === "idea" || st === "failed" || st === "sent";
    });
    if (remaining.length === 0) return;
    const total = remaining.reduce((sum, i) => sum + shotCost(i), 0);
    if (
      !confirm(
        `Produce ${remaining.length} shots at ${QUALITY[quality].quality} for ~${total} credits?`,
      )
    ) {
      return;
    }
    for (const idea of remaining) {
      if (!quickProduce(p, idea)) break;
    }
  }

  /** A failed shot: the Director rewrites it to pass the checks, then it reproduces itself. */
  async function fixAndRetry(p: Plan, idea: PlanIdea, job: VideoJob | undefined) {
    if (fixingId) return;
    setFixingId(idea.id);
    setError(null);
    try {
      const rewritten = await safeRewritePrompt(idea.prompt, job?.error);
      updateIdeaPrompt(p.id, idea.id, rewritten);
      quickProduce(p, idea, rewritten);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t rewrite the shot");
    } finally {
      setFixingId(null);
    }
  }

  if (!hydrated) return <div className="mx-auto h-8 max-w-3xl w-40 rounded bg-surface-2" />;

  return (
    <div className="mx-auto max-w-3xl">
      {plan ? (
        /* An open production: back to the list instead of the composer. */
        <div className="mb-4 flex items-center">
          <button
            onClick={() => setActivePlan(null)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={15} /> All productions
          </button>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto gap-1.5"
            onClick={() => setActivePlan(null)}
          >
            <Clapperboard size={14} /> New production
          </Button>
        </div>
      ) : (
        <>
          <header className="mb-4">
            <h1 className="text-2xl font-bold tracking-tight">Plan</h1>
            <p className="mt-1 text-sm text-muted">
              Tell the Strategist what you want to make — a goal or a whole story. It plans your
              movie shot by shot, with the full script for every shot.
            </p>
          </header>

          {/* The three moves — no stress, one path */}
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-[12.5px] text-muted">
            {[
              ["1", "Plan the movie"],
              ["2", "Produce the shots — one click each"],
              ["3", "Stitch the cut in Post"],
            ].map(([n, label], i) => (
              <span key={n} className="flex items-center gap-1.5">
                {i > 0 && <ArrowRight size={12} className="mr-2.5 text-faint" />}
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-accent-soft text-[10.5px] font-bold text-accent-2">
                  {n}
                </span>
                {label}
              </span>
            ))}
          </div>

          {/* The brief */}
          <div className="rounded-[var(--radius-xl2)] border border-line bg-surface p-4">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) writePlan();
          }}
          placeholder='A goal or a whole story — e.g. "A video that goes viral for my skincare brand", or paste the story you want told'
          rows={4}
          className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[15px] text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none"
        />

        {/* Target runtime */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium uppercase tracking-wider text-faint">Runtime</span>
          {TARGETS.map((t) => (
            <button
              key={t.label}
              onClick={() => setTargetSec(t.sec)}
              className={cn(
                "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                targetSec === t.sec
                  ? "border-accent/40 bg-accent-soft text-fg"
                  : "border-line text-muted hover:border-faint hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Cast */}
        {characters.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium uppercase tracking-wider text-faint">Cast</span>
            {characters.map((c) => {
              const on = castIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() =>
                    setCastIds((ids) => (on ? ids.filter((i) => i !== c.id) : [...ids, c.id]))
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[13px] font-medium transition-colors",
                    on
                      ? "border-accent/40 bg-accent-soft text-fg"
                      : "border-line text-muted hover:border-faint hover:text-fg",
                  )}
                  title={c.promptFragment ?? c.name}
                >
                  {c.posterUrl || c.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.posterUrl || c.url}
                      alt=""
                      className="h-5 w-5 rounded-full border border-line object-cover"
                    />
                  ) : (
                    <UserRound size={14} className="ml-1" />
                  )}
                  {c.name}
                  {on && <Check size={12} className="text-accent-2" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <span className="text-[12px] text-faint">
            The Strategist breaks it into 5–15s shots and keeps your cast identical in every one.
          </span>
          <Button className="ml-auto shrink-0" onClick={writePlan} disabled={busy || !brief.trim()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
            {busy ? "Directing…" : "Direct it"}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </div>
        </>
      )}

      {/* The productions */}
      {!plan ? (
        plans.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<Lightbulb size={24} />}
              title="Make your first video"
              description="Describe a goal or paste a story above and press Direct it — the Strategist turns it into shots you produce one click at a time, then you stitch the cut in Post."
            />
          </div>
        ) : (
          <div className="mt-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                Your productions
              </span>
              <span className="text-[11px] text-faint">{plans.length}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((p) => {
                const produced = p.ideas.filter((i) => stateOf(i) === "produced").length;
                const secs = p.ideas.reduce((sum, i) => sum + (i.durationSec ?? 0), 0);
                const thumbs = p.ideas
                  .map((i) => (i.jobId ? jobsById.get(i.jobId) : undefined))
                  .filter((j) => j && j.status === "succeeded" && j.posterUrl)
                  .slice(0, 3) as VideoJob[];
                const complete = produced === p.ideas.length && p.ideas.length > 0;
                return (
                  <Card key={p.id} className="relative overflow-hidden p-0">
                    <button
                      onClick={() => setActivePlan(p.id)}
                      className="block w-full text-left transition-colors hover:bg-surface-2/50"
                    >
                      <div className="flex h-20 bg-black/90">
                        {thumbs.length ? (
                          thumbs.map((j, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={j.posterUrl}
                              alt=""
                              className="h-full min-w-0 flex-1 object-cover"
                            />
                          ))
                        ) : (
                          <div className="flex flex-1 items-center justify-center">
                            <Clapperboard size={18} className="text-white/30" />
                          </div>
                        )}
                      </div>
                      <div className="p-3.5">
                        <p className="truncate font-display text-[14.5px] font-bold tracking-tight">
                          {p.title || p.brief}
                        </p>
                        {p.logline && (
                          <p className="mt-0.5 truncate text-[12.5px] text-muted">{p.logline}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge tone="neutral">
                            {p.ideas.length} {p.ideas.length === 1 ? "shot" : "shots"}
                            {secs > 0 && <> · {fmtSec(secs)}</>}
                          </Badge>
                          <Badge tone={complete ? "teal" : "neutral"}>
                            {complete && <Check size={11} />}
                            {produced}/{p.ideas.length} produced
                          </Badge>
                          <span className="ml-auto text-[11px] text-faint">
                            {timeAgo(p.createdAt)}
                          </span>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this production? Videos already made stay in My Videos.")) {
                          removePlan(p.id);
                        }
                      }}
                      className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white/70 transition-colors hover:bg-black/70 hover:text-white"
                      aria-label="Delete production"
                    >
                      <Trash2 size={13} />
                    </button>
                  </Card>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* Treatment header */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold tracking-tight">
                    {plan.title || plan.brief}
                  </h2>
                  <Badge tone="neutral">
                    {plan.ideas.length} {plan.ideas.length === 1 ? "shot" : "shots"}
                    {totalSec > 0 && <> · {fmtSec(totalSec)}</>}
                  </Badge>
                  {plan.targetSec ? <Badge tone="neutral">target {fmtSec(plan.targetSec)}</Badge> : null}
                  <Badge tone={producedCount === plan.ideas.length ? "teal" : "neutral"}>
                    {producedCount === plan.ideas.length && <Check size={11} />}
                    {producedCount}/{plan.ideas.length} produced
                  </Badge>
                </div>
                {plan.logline && <p className="mt-1 text-[14px] text-muted">{plan.logline}</p>}
                {castOfPlan.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
                      Cast
                    </span>
                    {castOfPlan.map((c) => (
                      <span
                        key={c.id}
                        className="flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pl-0.5 pr-2 text-[12px] text-fg"
                      >
                        {(c.posterUrl || c.url) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.posterUrl || c.url}
                            alt=""
                            className="h-4 w-4 rounded-full border border-line object-cover"
                          />
                        )}
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
                {plan.direction && (
                  <p className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-[13px] leading-relaxed text-fg">
                    <span className="mr-2 rounded-md bg-teal-soft px-2 py-0.5 text-[11px] font-bold text-teal">
                      Direction
                    </span>
                    {plan.direction}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  if (confirm("Delete this production? Videos already made stay in My Videos.")) {
                    removePlan(plan.id);
                  }
                }}
                className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-danger"
                aria-label="Delete production"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {/* Shot list — the whole movie at a glance; click a shot to open it. */}
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                  Shot list
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-teal transition-all"
                    style={{ width: `${(producedCount / plan.ideas.length) * 100}%` }}
                  />
                </div>
                <div
                  className="flex overflow-hidden rounded-lg border border-line text-[11.5px] font-semibold"
                  title="Draft is cheap for iterating — re-produce the keepers in Final quality."
                >
                  {(Object.keys(QUALITY) as QualityKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setQuality(k)}
                      title={`${QUALITY[k].label} — renders every shot at ${QUALITY[k].quality}`}
                      className={cn(
                        "px-2.5 py-1 transition-colors",
                        quality === k ? "bg-fg text-surface" : "text-muted hover:text-fg",
                      )}
                    >
                      {QUALITY[k].label}
                      <span className={cn("ml-1 font-medium", quality === k ? "text-surface/70" : "text-faint")}>
                        {QUALITY[k].resolution}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {plan.ideas.map((idea, i) => {
                  const st = stateOf(idea);
                  return (
                    <button
                      key={idea.id}
                      onClick={() => jumpToShot(idea.id)}
                      title={`Shot ${i + 1} — ${idea.title}${idea.durationSec ? ` (${idea.durationSec}s)` : ""}`}
                      className={cn(
                        "flex items-center gap-1 rounded-lg border px-2 py-1 text-[12px] font-bold tabular-nums transition-colors",
                        st === "produced"
                          ? "border-teal/30 bg-teal-soft text-teal"
                          : st === "producing"
                            ? "border-accent/40 bg-accent-soft text-accent-2"
                            : st === "failed"
                              ? "border-danger/40 bg-danger/5 text-danger"
                              : st === "sent"
                                ? "border-accent/30 text-fg"
                                : "border-line text-muted hover:border-faint hover:text-fg",
                        openId === idea.id && "ring-2 ring-accent/30",
                      )}
                    >
                      {i + 1}
                      {st === "produced" && <Check size={11} />}
                      {st === "producing" && <Loader2 size={11} className="animate-spin" />}
                      {st === "failed" && <AlertTriangle size={11} />}
                    </button>
                  );
                })}
                {producedCount === plan.ideas.length ? (
                  <Button size="sm" className="ml-auto gap-1.5" onClick={() => router.push("/app/post")}>
                    <Scissors size={13} /> Stitch it in Post <ArrowRight size={13} />
                  </Button>
                ) : nextShot ? (
                  <span className="ml-auto flex items-center gap-1.5">
                    {plan.ideas.filter((i) => ["idea", "failed", "sent"].includes(stateOf(i))).length > 1 && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => produceAll(plan)}>
                        Produce all
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => quickProduce(plan, nextShot)}
                    >
                      <Sparkles size={13} /> Produce Shot {plan.ideas.indexOf(nextShot) + 1} ·{" "}
                      ~{shotCost(nextShot)}cr
                    </Button>
                  </span>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-[12px] text-faint">
              from “{plan.brief.length > 90 ? `${plan.brief.slice(0, 90)}…` : plan.brief}” ·{" "}
              {timeAgo(plan.createdAt)}
            </p>
          </Card>

          {/* The shots — compact rows; the shot you're working on opens up. */}
          {plan.ideas.map((idea, index) => {
            const job = idea.jobId ? jobsById.get(idea.jobId) : undefined;
            const state = shotState(idea, job);
            const fixing = fixingId === idea.id;
            const segments = planSegments(idea.prompt);
            const open = openId === idea.id;
            const isNext = nextShot?.id === idea.id;
            return (
              <div key={idea.id} id={`shot-${idea.id}`}>
                <Card className={cn("overflow-hidden p-0", open && "ring-1 ring-accent/20")}>
                  <button
                    onClick={() => setOpenId(open ? null : idea.id)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
                  >
                    <span className="shrink-0 rounded-md bg-fg px-2 py-0.5 text-[11px] font-bold tabular-nums text-surface">
                      Shot {index + 1}
                    </span>
                    {idea.role && <Badge tone="accent">{idea.role}</Badge>}
                    {idea.durationSec && <Badge tone="neutral">{idea.durationSec}s</Badge>}
                    <span className="min-w-0 flex-1 truncate font-display text-[14.5px] font-bold tracking-tight">
                      {idea.title}
                    </span>
                    {isNext && state === "idea" && (
                      <Badge tone="accent" className="shrink-0">
                        Next up
                      </Badge>
                    )}
                    {state === "produced" && (
                      <Badge tone="teal" className="shrink-0">
                        <Check size={11} /> Produced
                      </Badge>
                    )}
                    {state === "producing" && (
                      <Badge tone="accent" className="shrink-0">
                        <Loader2 size={11} className="animate-spin" /> Producing
                      </Badge>
                    )}
                    {state === "sent" && (
                      <Badge tone="neutral" className="shrink-0">
                        In Make
                      </Badge>
                    )}
                    {state === "failed" && (
                      <Badge tone="neutral" className="shrink-0 text-danger">
                        <AlertTriangle size={11} /> Failed
                      </Badge>
                    )}
                    <ChevronDown
                      size={16}
                      className={cn("shrink-0 text-faint transition-transform", open && "rotate-180")}
                    />
                  </button>

                  {open && (
                    <div className="border-t border-line px-4 pb-4 pt-3">
                      {idea.hook && <p className="text-[13.5px] text-muted">{idea.hook}</p>}

                      {!segments ? (
                  <p className="mt-3 whitespace-pre-line rounded-xl border border-line bg-surface-2 p-4 text-[13.5px] leading-relaxed text-fg">
                    {idea.prompt}
                  </p>
                ) : (
                  <div className="mt-3">
                    <ScriptBeats segments={segments} />
                  </div>
                )}

                {/* Why it failed + how to get it through next time */}
                {state === "failed" &&
                  (() => {
                    const info = classifyGenError(job?.error);
                    const reason = genErrorReason(job?.error);
                    return (
                      <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-4">
                        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-danger">
                          <AlertTriangle size={14} /> {info.title}
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted">{info.detail}</p>
                        {reason && (
                          <p
                            className="mt-2 truncate rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-faint"
                            title={reason}
                          >
                            {reason}
                          </p>
                        )}
                        <ul className="mt-2.5 space-y-1">
                          {info.tips.map((tip) => (
                            <li key={tip} className="flex gap-2 text-[12.5px] leading-relaxed text-fg">
                              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-danger/60" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {state === "failed" ? (
                    <>
                      <Button onClick={() => fixAndRetry(plan, idea, job)} disabled={fixing || !!fixingId}>
                        {fixing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {fixing ? "Rewriting…" : "Fix & retry"}
                      </Button>
                      <Button variant="outline" onClick={() => openAndMake(plan, idea)} disabled={fixing}>
                        Tweak in Make
                      </Button>
                    </>
                  ) : state === "produced" || state === "producing" ? (
                    <>
                      <Button onClick={() => router.push(`/app/videos?open=${idea.jobId}`)}>
                        <Film size={16} /> View video
                      </Button>
                      <Button variant="outline" onClick={() => quickProduce(plan, idea)}>
                        <Sparkles size={15} /> Produce again · ~{shotCost(idea)}cr
                      </Button>
                      <Button variant="ghost" onClick={() => openAndMake(plan, idea)}>
                        Tweak in Make
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => quickProduce(plan, idea)}>
                        <Sparkles size={16} /> Produce this shot · ~{shotCost(idea)}cr
                      </Button>
                      <Button variant="outline" onClick={() => openAndMake(plan, idea)}>
                        Tweak in Make <ArrowRight size={15} />
                      </Button>
                    </>
                  )}
                </div>
                    </div>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
