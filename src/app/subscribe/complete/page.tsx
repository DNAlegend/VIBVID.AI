import { SubscribeComplete } from "@/components/subscribe/subscribe-complete";

// Stripe's Embedded Checkout returns guest buyers here — we verify the paid
// session, sign them into their brand-new account, and enter the studio.
export default function SubscribeCompletePage() {
  return <SubscribeComplete />;
}
