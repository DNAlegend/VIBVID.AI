import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://mightymak.vercel.app"),
  title: "MightyMak — AI Video & Image Generation Studio",
  description:
    "MightyMak is your AI production studio — organize your brand assets, generate video and images with best-in-class AI models, and manage every output in one place.",
  openGraph: {
    title: "MightyMak — AI Video & Image Generation Studio",
    description:
      "Organize your brand's characters, wardrobe, scenes and audio — then generate on-brand video and images in seconds.",
    url: "/",
    siteName: "MightyMak",
    images: [{ url: "/generated/hero-neon-city.png", width: 1280, height: 720 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MightyMak — AI Video & Image Generation Studio",
    description:
      "Your AI video & image studio, one prompt away.",
    images: ["/generated/hero-neon-city.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
