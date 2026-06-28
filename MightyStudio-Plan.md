# Mighty Studio — Implementation Plan

> Evolving MightyMAK from a single-flow video demo into a full production studio:
> clients bring their own + business assets, organize them into classes, generate
> with multiple pluggable AI models, and manage every output. Power behind
> progressive disclosure — type one sentence and get a video, or assemble a
> multi-asset, multi-shot production. **One generation engine serves both ends.**

## 1. The mental model — four surfaces

| Pillar | Route | What it is | Mental model |
|---|---|---|---|
| **MAKE** | `/` | Fast path / front door. Prompt + pre-chosen model + Generate. Refs/options hidden behind disclosure. | "Type and get a result." |
| **ASSETS** | `/assets` | The **input** library — things you *own/upload*, organized into classes (Characters, Wardrobe, Scenes, Dances/Motion, Audio). Composites bundle image+voice+clip as one identity. | "My building blocks." |
| **PRODUCTION** | `/production` | Power path — deliberate, multi-slot assembly from the library against a chosen model, saved & reusable. | "Assemble from my blocks." |
| **LIBRARY** | `/library` | The **output** manager (replaces `/videos`), medium-agnostic (video + image). Filter, provenance, re-roll, promote. | "Everything I've generated." |

**Key seam:** Assets = inputs you own. Library = outputs you generated. "Save to Assets" is an explicit, opt-in promotion of a keeper output into a reusable input — so the input library stays curated instead of drowning in drafts.

## 2. End-to-end flow (empty account → managed output)

1. **First run** — account seeds 30 starter assets, 5 classes, 1200 credits, and one example composite Character. Lands on **Make** (never an empty state), prompt prefilled + "Try this" chips. Generate → win in <10s, output appears inline + in the jobs tray.
2. **Build a library (Assets)** — Upload, pick a **class** first. Composite classes get a slotted uploader (face required; body/motion/voice optional). Simple classes are a single dropzone. Name, tag, scope **My / Business**.
3. **Make with a ref** — in Make, "Add assets" → pick your Character → it appears as a shot chip → Generate. (Finally reads the existing-but-unused `draftRefAssetId`.)
4. **Graduate to Production** — pick a **model first**, then fill slots: Character + Dress + Scene + Dance + Audio, each from Assets filtered by class. Composite Character shows a facet selector. Review step shows composed prompt, resolved refs, live credit estimate, and **degradation chips** ("Flux can't take a driving clip — folded into the prompt"). Click **Produce** → assembly saved as a reusable Production.
5. **Manage output (Library)** — all outputs collect here, filterable by model/type/project/favorite + search. Item modal: play, full prompt, **provenance strip** (source assets as thumbnails), actions: Re-roll, Make variations, Promote to Assets, Download, Favorite, Delete, Move to project. Promoting a keeper writes it back to Assets — closing the loop.

## 3. Screen inventory

| Screen | Route | Page file | View component | Purpose |
|---|---|---|---|---|
| **Make** | `/` | `src/app/page.tsx` *(exists)* | `MakeView` → `src/components/make/make-view.tsx` | Fast path: model chip + prompt + Generate; refs/options disclosed. |
| **Assets** | `/assets` | `src/app/assets/page.tsx` *(exists)* | `AssetsView` *(evolved)* | Input library by class; My/Business scope; class-first upload. |
| **Production** | `/production` | `src/app/production/page.tsx` *(new)* | `ProductionView` *(new)* | Power path: model + slot-fill + review + Produce; saved as recipe. |
| **Library** | `/library` | `src/app/library/page.tsx` *(new)* | `LibraryView` *(new)* | Output manager (video+image); filter, provenance, re-roll, promote. |
| *(redirect)* | `/videos` | `src/app/videos/page.tsx` | — | `redirect("/library")` to preserve old links. |
| *(global)* Buy credits | modal in `AppShell` | — | — | Top up credits (Stripe later). |
| *(global)* Jobs tray | topbar popover in `AppShell` | — | — | In-flight generations, progress, cancel. |

**Deliberately flat** — no dynamic segments in Phase 1. Detail views stay as **modals over grids** (matching today's `VideoModal`/`AssetActions`). No `/library/[id]` until there's a reason to deep-link/SSR.

**Nav** (replaces hardcoded `NAV`): Make (`Sparkles`, elevated primary) · Assets (`FolderOpen`) · Production (`Clapperboard`) · Library (`Film`).

## 4. Data model — the schema to build

```ts
// ============ src/lib/types.ts (core) ============
export type AspectRatio = "16:9" | "9:16" | "1:1";
export type Tier = "fast" | "standard" | "pro";
export const SHOT_LIMIT = 6;

// ---- Asset classes (library taxonomy; replaces Role) ----
export type AssetClass =
  | "character" | "wardrobe" | "scene" | "motion" | "audio"
  | "style" | "camera" | "clip"; // clip = generated/promoted finished media

export type PartKind = "image" | "video" | "audio";
export type PartRole =
  | "face" | "body" | "reference" | "motion"
  | "voice" | "music" | "sfx" | "turnaround" | "primary";

export interface PartMeta {
  mimeType?: string; sizeBytes?: number;
  width?: number; height?: number; durationSec?: number; checksum?: string;
}
export interface AssetPart {
  id: string;                 // uid("prt")
  role: PartRole; kind: PartKind;
  url: string;                // data URL now; storage URL later (the decoupling seam)
  posterUrl?: string; label?: string;
  meta: PartMeta; createdAt: number;
}

export type AssetOwner = "user" | "business";
export type AssetSource = "upload" | "generation" | "starter" | "import";

export interface Asset {
  id: string;                 // uid("ast") | starter slug
  class: AssetClass;          // replaces `role`
  name: string;
  parts: AssetPart[];         // one part = simple, many = composite
  primaryPartId: string;      // drives thumbnail
  owner: AssetOwner;          // My vs Business
  source: AssetSource;
  categoryId: string | null;  // user folders (soft) — class is the hard taxonomy
  tags: string[];
  promptFragment?: string;    // injected into composed prompt
  accent?: string;
  version: number;
  parentAssetId?: string | null;
  createdAt: number; updatedAt: number;
}

export const primaryPart = (a: Asset) =>
  a.parts.find((p) => p.id === a.primaryPartId) ?? a.parts[0];
export const thumbUrl = (a: Asset) => {
  const p = primaryPart(a); return p?.posterUrl ?? p?.url;
};
export const isComposite = (a: Asset) => a.parts.length > 1;

export interface Category { id: string; name: string; owner: AssetOwner; createdAt: number; }
```

```ts
// ============ src/lib/models/types.ts (registry) ============
export type Modality = "video" | "image";
export type Capability = "text-to-video" | "image-to-video" | "text-to-image" | "image-to-image";

export type ParamField =
  | { kind:"select"; key:string; label:string; hint?:string; default:string|number;
      options:{ value:string|number; label:string; sublabel?:string }[] }
  | { kind:"toggle"; key:string; label:string; hint?:string; default:boolean }
  | { kind:"slider"; key:string; label:string; hint?:string; min:number; max:number; step:number; unit?:string; default:number }
  | { kind:"seed";   key:string; label:string; hint?:string };

export interface AssetSlot {           // generalizes today's single refAssetId
  key:string; label:string; hint?:string;
  accepts:PartKind[]; required:boolean; max?:number;
}
export interface ModelSchema {
  prompt:{ required:boolean; placeholder?:string; supportsNegative?:boolean };
  aspectRatios:AspectRatio[];
  params:ParamField[];
  assetSlots:AssetSlot[];
}
export interface ModelInput {          // the new GenerateParams (model-agnostic)
  modelId:string; prompt:string; negativePrompt?:string;
  aspectRatio:AspectRatio;
  params:Record<string, string|number|boolean>;
  assets:Record<string, string[]>;     // slotKey -> asset ids
  seed?:number;
}
export interface ModelResult {
  status:"succeeded"|"failed";
  outputs:{ kind:PartKind; url:string; posterUrl?:string }[]; // 1..N
  providerJobId?:string; error?:string;
}
export type ProgressFn = (p:number)=>void;
export interface ModelAdapter {
  run(i:ModelInput, onProgress:ProgressFn, signal?:AbortSignal): Promise<ModelResult>;
}
export interface ModelProvider {
  id:string; name:string; vendor:string;
  modality:Modality; capabilities:Capability[];
  blurb:string; icon:string; badge?:"new"|"beta"|"simulated";
  enabled:boolean; recommended?:boolean;
  schema:ModelSchema;
  price(i:ModelInput):number;          // pricing lives on the model, not global
  adapter:ModelAdapter;
}
```

```ts
// ============ src/lib/types.ts (jobs, content, production) ============
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export interface JobError { code:string; message:string; retryable:boolean }

export interface Job {
  id:string;                  // uid("job")
  modelId:string; modality:Modality;
  projectId:string | null;
  status:JobStatus; progress:number;
  input:ModelInput;           // immutable request snapshot (powers exact Remix)
  creditsCost:number; creditsRefunded?:number;
  outputIds:string[];         // ContentItem ids (0..N)
  productionId?:string | null;
  providerJobId?:string; error?:JobError;
  createdAt:number; updatedAt:number; finishedAt?:number;
}

export interface ContentItem {
  id:string;                  // uid("ctn")
  jobId:string; projectId:string | null;
  kind:PartKind;              // video | image | audio
  modelId:string;
  url:string; posterUrl?:string;
  durationSec?:number; aspectRatio?:AspectRatio; width?:number; height?:number;
  variantIndex:number;        // position in the job batch
  parentId?:string | null;    // lineage for re-rolls
  favorite:boolean;
  promotedAssetId?:string | null;
  sourceAssetIds:string[];    // denormalized provenance
  prompt:string;              // denormalized for search/cards
  createdAt:number;
}

export interface Project { id:string; name:string; coverContentId?:string|null; createdAt:number; updatedAt:number }

// ---- Production (structured assembly; Make = ephemeral Production) ----
export type SlotKey = "character" | "dress" | "scene" | "dance" | "audio";
export interface SlotPick { assetId:string; facet?:PartKind; weight?:number }
export interface ShotAssembly {
  id:string;
  picks:Partial<Record<SlotKey, SlotPick[]>>;
  direction?:string; durationSec:number;
  promptPreview?:string;
}
export type ProductionKind = "make" | "production";
export interface Production {
  id:string; kind:ProductionKind; title:string;
  modelId:string;
  tier:Tier; aspectRatio:AspectRatio; audio:boolean;
  shots:ShotAssembly[];       // 1 for Make, N for a sequence
  jobIds:string[];
  createdAt:number; updatedAt:number;
}
```

**Decisive resolutions:**
- One Job produces 1..N outputs. This supersedes today's `VideoJob`, which conflated request + output.
- `Asset` is a composite container (parts list); simple = one part. Production picks one Asset row regardless of part count.
- Models are data in a registry; `ModelInput` replaces baked-in `GenerateParams`; `price()` lives on the provider. `estimateCredits` is removed in favor of `provider.price(input)`.
- Production slot vocabulary is user-facing `character/dress/scene/dance/audio`; `dress`→`wardrobe` class, `dance`→`motion` class.
- My Videos → Library (`/library`), medium-agnostic. `/videos` redirects.

## 5. Model registry & dynamic Make form

`src/lib/models/registry.ts` — a static `Map<id, ModelProvider>` with `getModel(id)`, `listModels({modality, capability, enabledOnly})`, `DEFAULT_MODEL_ID`. Same surface whether providers are hardcoded today or hydrated from Supabase later.

**Make renders its form from the selected model's schema — zero model-specific UI.** A single `ParamForm` maps each `ParamField` to an existing `ui.tsx` primitive:

| `ParamField.kind` | Renders as | Primitive |
|---|---|---|
| `select` | option pills | `Segmented` |
| `toggle` | switch | `Toggle` |
| `slider` | range row | new thin `Slider` |
| `seed` | number + randomize | `TextInput` + ghost `Button` |

Unsupported options **disappear** (not greyed). `model.price(input)` drives the live cost next to Generate.

**Simulated Seedance becomes one provider** (`src/lib/models/providers/seedance.ts`): the `setInterval` loop and `pickSample()` move out of `store.ts` into its `adapter.run`, behind the standard async + `AbortSignal` interface. **Real providers slot in later with one new file** — a BytePlus adapter's `run()` POSTs to ModelArk and polls/webhooks. No Make/Library UI changes.

## 6. Mapping to the future backend (no coupling now)

| Client concept | Supabase later |
|---|---|
| `Asset` (minus `parts`) | `assets`: `org_id`, `owner_id`, `owner_type`, `class`, `tags text[]`, `version`, `parent_asset_id` … |
| `AssetPart` | `asset_parts`: `storage_path`, `poster_path`, meta columns |
| `ModelProvider` registry | optional `models` table (or stay client-static) |
| `Job` / `ContentItem` | `jobs` / `content_items`; `providerJobId` correlates BytePlus webhooks |
| `Production` | `productions` + `shots` (jsonb or child table) |

**Decoupling rules honored now:** UI reads media only via `thumbUrl()` / `part.url`; keep `uid()` string ids; timestamps stay epoch `number`; `parts` stays embedded array client-side. **Stripe**: `BuyCreditsModal` + `addCredits` is the seam — checkout replaces instant-add. **BytePlus**: only `adapter.run` changes.

**The antidote: let the schema be rich; keep the UI poor.**

## 7. Simplicity guardrails

1. **One screen, one verb** — exactly one primary button: Make→Generate, Production→Produce, Assets→Upload.
2. **Make stays one textbox, forever** — resting state = model chip + prompt + Generate. Refs, options, and Advanced are three disclosure tiers, all collapsed.
3. **Defaults are a product** — model = recommended, tier = standard, duration = 6, aspect = 16:9, audio = on. Ship a video touching none.
4. **Make and Production are one engine** — no parallel job type; Production is Make with slots exposed.
5. **Composites: consumed as one tile, authored as a list** — no timeline/canvas DAW.
6. **Rich schema, poor UI** — jobs stay as cards; no admin UI; one credit number + Buy modal, no ledger screen.

## 8. Phased roadmap (each phase shippable)

### Phase 1 — Walking skeleton (whole vision at today's complexity)
- [ ] `src/lib/models/`: `types.ts`, `registry.ts`, `providers/seedance.ts` (port the sim out of `store.ts`). One enabled model.
- [ ] `src/lib/types.ts`: add `Asset.parts`/`AssetClass`, `Job`, `ContentItem`, `ModelInput`; helpers.
- [ ] `src/lib/store.ts`: bump persist to `mightymak-v3` + add `version`/`migrate` (currently absent) mapping old `VideoJob`→`Job`+`ContentItem`, old `Asset`→parts shape. Add `jobs`/`content`/`productions` slices. New `generate(input: ModelInput)` dispatching to `provider.adapter.run`; `AbortController` map replaces `timers`.
- [ ] `src/components/make/make-view.tsx`: prompt-first, model chip, disclosures, `ParamForm`. Reads `draftRefAssetId`.
- [ ] `src/app/page.tsx` → `MakeView`. New `/production`, `/library` routes; `/videos`→redirect.
- [ ] `src/components/production/production-view.tsx`: today's rail-based `generate-view`, relabeled to slots → Produce (mostly move + rename).
- [ ] `src/components/library/library-view.tsx`: today's `videos-view`, broadened to video+image; provenance strip; re-roll/promote/favorite.
- [ ] `app-shell.tsx`: 4-item NAV + icons; jobs-tray popover.
- [ ] Seed one example composite Character (consumption only — defer authoring).

### Phase 2 — Assets depth + content management
- [ ] Class-first upload + multi-slot composite **authoring**; My/Business scope toggle.
- [ ] `duplicateAsVersion`; `promoteToAsset` (generalized `saveVideoToAssets`, `class:"clip"`).
- [ ] Library filters (model/type/project/favorite + search); toasts; credit refunds on fail/cancel; lineage view.

### Phase 3 — Production power + 2nd model
- [ ] `compile(shot, model)` with graceful degradation chips; review step; saveable/reusable Productions; multi-shot sequencing.
- [ ] Enable a second model (`flux` image) to prove pluggability; variations/batches (1 Job → N ContentItems).
- [ ] Projects as folders inside Library.

### Phase 4 — Real backend
- [ ] Supabase (`assets`/`asset_parts`/`jobs`/`content_items`/`productions`, RLS, storage buckets) behind the data layer.
- [ ] Real BytePlus adapter (`adapter.run` → ModelArk poll/webhook); `next.config.ts` remote patterns.
- [ ] Stripe checkout replacing instant `addCredits`. Org/business membership if confirmed.

## 9. Open questions (genuine product decisions)

1. **"Production" naming** — keep "Production", or "Compose"/"Studio"/"Scenes"?
2. **Outputs in Library vs Assets** — confirm outputs stay in Library until explicitly promoted.
3. **Class lock-in** — are the five Production slots final, or should users define custom Production-eligible classes?
4. **Images in Production** — video-only, or first-class for image models too?
5. **Business assets = real org?** — true multi-user org, or just a second personal bucket labeled "Business" for v1?
6. **Composites in v1** — consumption-only (authoring deferred), or user-built composites at launch?
7. **Credit parity across models** — one shared cost table, or each model defines its own credit math?
8. **Multi-output & refund** — do image models emit N outputs per Job in v1, and is failure a full refund?
9. **Sequence deliverable** — multi-shot Production → one stitched video or a set of clips?
10. **Default model** — is Seedance 2.0 always the recommended default?
