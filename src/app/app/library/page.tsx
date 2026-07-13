import { redirect } from "next/navigation";

// The videos surface is /app/videos now (matches the "My Videos" label).
// Preserve old /app/library links (incl. ?open=<jobId> deep links).
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const open = typeof sp.open === "string" ? sp.open : undefined;
  redirect(open ? `/app/videos?open=${open}` : "/app/videos");
}
