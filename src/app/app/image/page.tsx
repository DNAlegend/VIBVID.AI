import { redirect } from "next/navigation";

// The standalone image generator was retired — video is the product;
// stills come from the Character Studio. Preserve old links.
export default function ImagePage() {
  redirect("/app/make");
}
