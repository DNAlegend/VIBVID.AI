import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The studio and owner surfaces are app UI, not content.
        disallow: ["/app", "/admin", "/api"],
      },
    ],
    sitemap: "https://www.vibvid.ai/sitemap.xml",
  };
}
