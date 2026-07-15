import type { MetadataRoute } from "next";
import { USE_CASES } from "@/lib/use-cases";

const BASE = "https://www.vibvid.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", priority: 1.0 },
    { path: "/pricing", priority: 0.9 },
    { path: "/use-cases", priority: 0.8 },
    ...USE_CASES.map((u) => ({ path: `/use-cases/${u.slug}`, priority: 0.7 })),
    { path: "/contact", priority: 0.5 },
    { path: "/terms", priority: 0.3 },
    { path: "/privacy", priority: 0.3 },
    { path: "/cookies", priority: 0.3 },
    { path: "/refunds", priority: 0.3 },
    { path: "/acceptable-use", priority: 0.3 },
  ];
  return pages.map((p) => ({
    url: `${BASE}${p.path}`,
    changeFrequency: "weekly" as const,
    priority: p.priority,
  }));
}
