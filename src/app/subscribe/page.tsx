import { redirect } from "next/navigation";

// Onboarding is OTP-first now: sign up with your email in the app, then pick a
// plan at the gate. Old /subscribe links (ads, bookmarks) land there too, with
// a chosen plan carried along as ?buy= so the gate preselects it.
export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  redirect(plan ? `/app?buy=${encodeURIComponent(plan)}` : "/app");
}
