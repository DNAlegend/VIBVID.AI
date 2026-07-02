import { redirect } from "next/navigation";

// Studio merged into Make — one creation surface. Preserve old links.
export default function StudioPage() {
  redirect("/app");
}
