import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MightyMak — AI Video & Image Generation Studio",
  description:
    "MightyMak is your AI production studio — organize your brand assets, generate video and images with best-in-class AI models, and manage every output in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
