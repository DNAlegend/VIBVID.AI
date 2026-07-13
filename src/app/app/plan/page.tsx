import { redirect } from "next/navigation";

// Plan is the app home now (/app). Preserve old /app/plan links.
export default function PlanPage() {
  redirect("/app");
}
