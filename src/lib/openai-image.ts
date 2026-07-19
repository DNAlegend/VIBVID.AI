// OpenAI image generation (GPT Image 2). Two endpoints, one entry point:
// /v1/images/generations for pure text-to-image, /v1/images/edits when
// reference images steer the output (identity, product, style). Both return
// base64 PNG. Enabled by OPENAI_API_KEY on the server.

const OPENAI_BASE = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

export function openaiImageConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** GPT Image canvas per aspect: square, landscape or portrait. */
function sizeFor(aspectRatio: string): string {
  if (aspectRatio === "1:1") return "1024x1024";
  const [w, h] = aspectRatio.split(":").map(Number);
  return w >= h ? "1536x1024" : "1024x1536";
}

/**
 * Generate one image and return the PNG bytes, or throw with the API's error
 * message. Reference images (public URLs) are fetched and forwarded to the
 * edits endpoint, which GPT Image treats as high-fidelity inputs.
 */
export async function openaiGenerateImage(opts: {
  model: string;
  prompt: string;
  aspectRatio: string;
  refImageUrls?: string[];
}): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const size = sizeFor(opts.aspectRatio);
  const refs = (opts.refImageUrls ?? []).slice(0, 6);

  let res: Response;
  if (refs.length) {
    const form = new FormData();
    form.append("model", opts.model);
    form.append("prompt", opts.prompt);
    form.append("size", size);
    form.append("quality", "high");
    for (const [i, url] of refs.entries()) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Reference image unreachable (${r.status})`);
      const blob = await r.blob();
      const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";
      const ext = type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
      form.append("image[]", new File([blob], `ref-${i + 1}.${ext}`, { type }));
    }
    res = await fetch(`${OPENAI_BASE}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } else {
    res = await fetch(`${OPENAI_BASE}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: opts.model, prompt: opts.prompt, size, quality: "high" }),
    });
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(detail || `OpenAI image error ${res.status}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  return Buffer.from(b64, "base64");
}
