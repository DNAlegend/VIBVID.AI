import type { Metadata } from "next";
import { SubscribeFlow } from "@/components/subscribe/subscribe-flow";

export const metadata: Metadata = {
  title: "Subscribe — VIBVID.AI",
  description: "Pick a plan, pay, and you're in the studio — under a minute.",
};

// Pay-first onboarding: plan → email → pay → straight into the studio.
export default function SubscribePage() {
  return <SubscribeFlow />;
}
