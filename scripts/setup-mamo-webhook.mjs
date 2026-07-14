// Register (or inspect) the Mamo webhook that grants credits after payment.
//
// Mamo has no dashboard UI for webhooks — they're managed over the API. This
// script lists the webhooks on your account and, unless you pass --list,
// ensures one exists pointing at <site>/api/mamo/webhook with the events our
// handler needs and auth_header = MAMOPAY_WEBHOOK_SECRET (which the handler
// verifies on every delivery).
//
// Usage (run with your Mamo secret + webhook secret in the environment):
//
//   MAMOPAY_API_KEY=sk_… \
//   MAMOPAY_WEBHOOK_SECRET=your-secret \
//   MAMOPAY_ENV=production \
//   node scripts/setup-mamo-webhook.mjs https://vibvid.ai
//
//   # just list what's registered, create nothing:
//   MAMOPAY_API_KEY=sk_… node scripts/setup-mamo-webhook.mjs --list
//
// MAMOPAY_ENV defaults to "sandbox". Use the API key that matches the env.

const LIVE = "https://business.mamopay.com/manage_api/v1";
const SANDBOX = "https://sandbox.dev.business.mamopay.com/manage_api/v1";

const EVENTS = [
  "charge.succeeded",
  "subscription.succeeded",
  "charge.failed",
  "subscription.failed",
];

const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const siteArg = args.find((a) => !a.startsWith("--"));

const apiKey = process.env.MAMOPAY_API_KEY;
const secret = process.env.MAMOPAY_WEBHOOK_SECRET;
const env = process.env.MAMOPAY_ENV === "production" ? "production" : "sandbox";
const base = env === "production" ? LIVE : SANDBOX;

if (!apiKey) {
  console.error("✗ MAMOPAY_API_KEY is required in the environment.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

async function api(path, init) {
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return body;
}

async function main() {
  console.log(`Mamo environment: ${env}  (${base})\n`);

  // 1. Show what's already registered.
  const existing = await api("/webhooks/", { method: "GET" });
  const list = Array.isArray(existing) ? existing : existing?.data ?? [];
  console.log(`Registered webhooks: ${list.length}`);
  for (const w of list) {
    console.log(`  • ${w.id}  ${w.url}`);
    console.log(`    events: ${(w.enabled_events ?? []).join(", ")}`);
  }
  console.log("");

  if (listOnly) return;

  if (!siteArg) {
    console.error("✗ Pass your site URL, e.g. node scripts/setup-mamo-webhook.mjs https://vibvid.ai");
    process.exit(1);
  }
  if (!secret) {
    console.error("✗ MAMOPAY_WEBHOOK_SECRET is required to create the webhook.");
    process.exit(1);
  }
  if (secret.length > 50) {
    console.error(`✗ MAMOPAY_WEBHOOK_SECRET is ${secret.length} chars; Mamo allows max 50. Shorten it.`);
    process.exit(1);
  }

  const url = `${siteArg.replace(/\/$/, "")}/api/mamo/webhook`;
  const already = list.find((w) => w.url === url);
  if (already) {
    console.log(`✓ A webhook for ${url} already exists (id ${already.id}). Nothing to do.`);
    console.log("  If credits still don't land, confirm its auth header equals MAMOPAY_WEBHOOK_SECRET.");
    return;
  }

  const created = await api("/webhooks/", {
    method: "POST",
    body: JSON.stringify({ url, enabled_events: EVENTS, auth_header: secret }),
  });
  console.log(`✓ Created webhook ${created.id}`);
  console.log(`  url:    ${created.url}`);
  console.log(`  events: ${(created.enabled_events ?? EVENTS).join(", ")}`);
  console.log("\nDone. Run a sandbox payment to confirm credits land.");
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
