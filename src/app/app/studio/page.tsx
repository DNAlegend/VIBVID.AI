import { redirect } from "next/navigation";

// Studio merged into Make (/app/make) — one creation surface. Preserve old links.
export default function StudioPage() {
  redirect("/app/make");
}
