"use client";

// A tiny safety net for the sheet studios (Characters / Products /
// Storyboard): sheet renders auto-save from a component effect, so if the
// creator navigates away mid-render the paid result used to vanish — the job
// finished in the global store, but nothing was left watching it. Each studio
// records its in-flight render (job id + the full form state) here, restores
// it on the next visit, and the ordinary auto-save effect finishes the job.

export interface PendingSheet<T> {
  jobId: string;
  data: T;
}

const key = (kind: string) => `vibvid-pending-${kind}`;

export function setPendingSheet<T>(kind: string, pending: PendingSheet<T>): void {
  try {
    localStorage.setItem(key(kind), JSON.stringify(pending));
  } catch {
    /* storage unavailable — the in-page flow still works */
  }
}

export function getPendingSheet<T>(kind: string): PendingSheet<T> | null {
  try {
    const raw = localStorage.getItem(key(kind));
    return raw ? (JSON.parse(raw) as PendingSheet<T>) : null;
  } catch {
    return null;
  }
}

export function clearPendingSheet(kind: string): void {
  try {
    localStorage.removeItem(key(kind));
  } catch {
    /* nothing to clear */
  }
}
