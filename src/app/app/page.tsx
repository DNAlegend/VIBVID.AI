import { PlanView } from "@/components/plan/plan-view";

// The app opens on Plan — your productions overview — so the workflow starts
// guided (Plan → Make → Post) instead of on a blank prompt. Rendered here (not
// redirected) so ?buy / ?purchase / auth query params survive on the home URL.
export default function AppHomePage() {
  return <PlanView />;
}
