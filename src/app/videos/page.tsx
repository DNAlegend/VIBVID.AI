import { redirect } from "next/navigation";

// "My Videos" became the medium-agnostic Library. Preserve old links.
export default function VideosPage() {
  redirect("/library");
}
