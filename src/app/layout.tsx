import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mighty Studio — Your AI Production Studio",
  description:
    "Organize your brand assets, generate video and images with best-in-class AI models, and manage every output — one simple studio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
