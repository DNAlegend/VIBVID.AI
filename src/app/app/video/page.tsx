import { redirect } from "next/navigation";

// The video generator is Make now (/app/make). Preserve old links.
export default function VideoPage() {
  redirect("/app/make");
}
