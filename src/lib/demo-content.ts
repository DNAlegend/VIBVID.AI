// Demo/use-case content for the landing page — UGC ads, product films, etc.
// Definitions live in demo-content.json (shared with scripts/generate-demo.mjs,
// which renders each prompt through the real Seedance model). Until a real
// clip exists in generated.json, cards render a styled placeholder.

import demoData from "./demo-content.json";
import generatedData from "./generated.json";

export interface DemoItem {
  id: string;
  tag: string;
  title: string;
  aspect: "16:9" | "9:16";
  accent: string;
  prompt: string;
  /** Purpose preset id this demo maps to in Make (see lib/purposes.ts). */
  purpose: string;
  /** Use-case slug this demo belongs to (see lib/use-cases.ts); "" = none. */
  useCase: string;
}

export const DEMO_CONTENT = demoData.demos as DemoItem[];

const generated = generatedData as Record<string, string>;

/** Path of the real generated clip for a demo id, or null if not yet rendered. */
export function generatedSrc(id: string): string | null {
  return generated[id] ?? null;
}
