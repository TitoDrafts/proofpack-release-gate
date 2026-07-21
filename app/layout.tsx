import type { Metadata, Viewport } from "next";
import "./globals.css";

const productionUrl = "https://proofpack-release-gate.tito943366.chatgpt.site";
const releaseDescription =
  "A local, deterministic evidence compiler and fabrication release gate for commercial millwork handoffs.";

export const metadata: Metadata = {
  metadataBase: new URL(productionUrl),
  title: "ProofPack Release Gate",
  description: releaseDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "ProofPack Release Gate",
    title: "ProofPack Release Gate",
    description: releaseDescription,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "ProofPack Release Gate: raw sources flow through an evidence ledger to a fabrication HOLD.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ProofPack Release Gate",
    description: releaseDescription,
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eee4d2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
