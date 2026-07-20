import "server-only";

// One-line founder notifications ("someone signed up", "someone subscribed")
// sent through the same Resend account that delivers all vibvid.ai email.
// Fire-and-forget: failures are logged, never thrown — a notification must
// never break the flow that triggered it (webhook ack, account creation).

const RECIPIENT = process.env.NOTIFY_EMAIL ?? "abuaisha.hussin@gmail.com";
const FROM = process.env.NOTIFY_FROM ?? "VIBVID <notifications@vibvid.ai>";

export async function emailFounder(subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[notify-founder] RESEND_API_KEY not set — not sent: ${subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [RECIPIENT], subject, text }),
    });
    if (!res.ok) {
      console.warn("[notify-founder] Resend rejected:", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[notify-founder] request failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
