"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb,
  Loader2,
  Sparkles,
  Trash2,
  ArrowRight,
  Clapperboard,
  Film,
  Check,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import type { Plan, PlanIdea, VideoJob } from "@/lib/types";
import { timeAgo, cn } from "@/lib/utils";
import { Button, Card, Badge, EmptyState } from "@/components/ui";

const COUNTS = [3, 5, 10] as const;
const LENGTHS = [5, 10, 15] as const;

export function PlanView() {
  const router = useRouter();
  const plans = useStore((s) => s.plans);
  const videos = useStore((s) => s.videos);
  const hydrated = useStore((s) => s.hasHydrated);
  const addPlan = useStore((s) => s.addPlan);
  const removePlan = useStore((s) => s.removePlan);
  const markIdeaSent = useStore((s) => s.markIdeaSent);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const setDraftPlanRef = useStore((s) => s.setDraftPlanRef);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const [brief, setBrief] = useState("");
  const [count, setCount] = useState<number>(5);
  const [durationSec, setDurationSec] = useState<number>(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jobById = useMemo(() => Object.fromEntries(videos.map((v) => [v.id, v])), [videos]);
  // One plan at a time — the current one.
  const plan = plans[0] ?? null;

  async function generateIdeas() {
    const goal = brief.trim();
    if (!goal || busy) return;
    if (
      plan &&
      !confirm("Start a new plan? It replaces the current one (videos already made stay in My Videos).")
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) {
        setAuthOpen(true);
        return;
      }
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brief: goal, count, durationSec }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The Strategist is unavailable");
      addPlan(
        goal,
        (data.ideas as Array<{ title: string; hook: string; prompt: string }>).map((i) => ({
          ...i,
          durationSec,
        })),
      );
      setBrief("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function makeIdea(plan: Plan, idea: PlanIdea) {
    setDraftDirection(idea.prompt);
    setDraftPlanRef({ planId: plan.id, ideaId: idea.id });
    markIdeaSent(plan.id, idea.id);
    router.push("/app");
  }

  if (!hydrated) return <div className="mx-auto h-8 max-w-4xl w-40 rounded bg-surface-2" />;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Plan</h1>
        <p className="mt-1 text-sm text-muted">
          One plan at a time — brief the Strategist, pick a length, and get a detailed
          second-by-second plan for every video. Send each one to Make when it&apos;s ready.
        </p>
      </header>

      {/* The brief composer */}
      <div className="rounded-[var(--radius-xl2)] border border-line bg-surface p-4">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generateIdeas();
          }}
          placeholder='What are we making? — e.g. "Give me 5 videos that will go viral for my skincare brand"'
          rows={3}
          className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[15px] text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium uppercase tracking-wider text-faint">Ideas</span>
          {COUNTS.map((c) => (
            <button
              key={c}
              onClick={() => setCount(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                count === c
                  ? "border-accent/40 bg-accent-soft text-fg"
                  : "border-line text-muted hover:border-faint hover:text-fg",
              )}
            >
              {c}
            </button>
          ))}
          <span className="ml-3 text-[12px] font-medium uppercase tracking-wider text-faint">Length</span>
          {LENGTHS.map((d) => (
            <button
              key={d}
              onClick={() => setDurationSec(d)}
              className={cn(
                "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                durationSec === d
                  ? "border-accent/40 bg-accent-soft text-fg"
                  : "border-line text-muted hover:border-faint hover:text-fg",
              )}
            >
              {d}s
            </button>
          ))}
          <Button className="ml-auto" onClick={generateIdeas} disabled={busy || !brief.trim()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />}
            {busy ? "Writing the plan…" : plan ? "New plan" : "Write the plan"}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      {/* The one current plan */}
      {!plan ? (
        <div className="mt-6">
          <EmptyState
            icon={<Lightbulb size={24} />}
            title="No plan yet"
            description='Describe a goal above — "5 viral videos for my coffee brand" — pick a length, and the Strategist writes a detailed second-by-second plan for every video.'
          />
        </div>
      ) : (
        <div className="mt-6">
          <PlanCard
            key={plan.id}
            plan={plan}
            jobById={jobById}
            onMake={(idea) => makeIdea(plan, idea)}
            onDelete={() => {
              if (confirm("Delete this plan? Videos already made from it stay in My Videos.")) {
                removePlan(plan.id);
              }
            }}
            onViewJob={(jobId) => router.push(`/app/library?open=${jobId}`)}
          />
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  jobById,
  onMake,
  onDelete,
  onViewJob,
}: {
  plan: Plan;
  jobById: Record<string, VideoJob>;
  onMake: (idea: PlanIdea) => void;
  onDelete: () => void;
  onViewJob: (jobId: string) => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold leading-snug">{plan.brief}</p>
          <p className="mt-0.5 text-[12px] text-faint">
            {plan.ideas.length} ideas · {timeAgo(plan.createdAt)}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-danger"
          aria-label="Delete plan"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {plan.ideas.map((idea, n) => (
          <IdeaRow
            key={idea.id}
            n={n + 1}
            idea={idea}
            job={idea.jobId ? jobById[idea.jobId] : undefined}
            onMake={() => onMake(idea)}
            onViewJob={() => idea.jobId && onViewJob(idea.jobId)}
          />
        ))}
      </div>
    </Card>
  );
}

function IdeaRow({
  n,
  idea,
  job,
  onMake,
  onViewJob,
}: {
  n: number;
  idea: PlanIdea;
  job?: VideoJob;
  onMake: () => void;
  onViewJob: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // The visible history: idea → in Make → producing → produced.
  const state = job
    ? job.status === "succeeded"
      ? "produced"
      : job.status === "failed"
        ? "failed"
        : "producing"
    : idea.sentAt
      ? "sent"
      : "idea";

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold text-accent-2">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold">{idea.title}</span>
            {idea.durationSec && <Badge tone="neutral">{idea.durationSec}s</Badge>}
            {state === "produced" && (
              <Badge tone="teal">
                <Check size={11} /> Produced
              </Badge>
            )}
            {state === "producing" && (
              <Badge tone="accent">
                <Loader2 size={11} className="animate-spin" /> Producing
              </Badge>
            )}
            {state === "failed" && (
              <Badge tone="neutral" className="text-danger">
                <AlertTriangle size={11} /> Failed
              </Badge>
            )}
            {state === "sent" && (
              <Badge tone="accent">
                <Clapperboard size={11} /> In Make
              </Badge>
            )}
          </div>
          {idea.hook && <p className="mt-0.5 text-[13px] text-muted">{idea.hook}</p>}
          <button
            onClick={() => setExpanded((x) => !x)}
            className={cn(
              "mt-1.5 block w-full whitespace-pre-line rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-[12px] leading-relaxed text-muted transition-colors hover:border-faint",
              !expanded && "line-clamp-3",
            )}
            title={expanded ? "Collapse" : "Show the full plan"}
          >
            {idea.prompt}
          </button>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {state === "produced" || state === "producing" ? (
            <Button size="sm" variant="soft" onClick={onViewJob}>
              <Film size={14} /> View video
            </Button>
          ) : (
            <Button size="sm" variant={state === "failed" ? "outline" : "primary"} onClick={onMake}>
              <Sparkles size={14} /> {state === "failed" ? "Retry in Make" : state === "sent" ? "Open in Make" : "Make this"}
              <ArrowRight size={13} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
