import { redirect } from "next/navigation";

// The Character Studio surface was retired. Preserve old links.
export default function CharactersPage() {
  redirect("/app");
}
