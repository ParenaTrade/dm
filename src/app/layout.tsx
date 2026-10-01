import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dampingvar.com"),
  title: {
    default: "DampingVar — Alışveriş yapmadan önce DampingVar'a bak.",
    template: "%s · DampingVar",
  },
  description:
    "DampingVar, fiziksel işletmeler için dijital vitrin, kampanya, QR doğrulama, Damping Hane ve AI destekli pazarlama platformudur. Yakınındaki Damping Noktalarını keşfet, gerçek indirimi kasada kullan.",
  keywords: [
    "damping",
    "indirim",
    "kampanya",
    "yakınımdaki fırsatlar",
    "Damping Noktası",
    "QR kampanya",
    "işletme vitrini",
    "yerel işletme",
  ],
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "DampingVar",
    title: "DampingVar — Alışveriş yapmadan önce DampingVar'a bak.",
    description: "Yakınındaki Damping Noktaları, gerçek QR kampanyaları ve doğrulanmış müşteri avantajları.",
  },
  twitter: { card: "summary_large_image", title: "DampingVar", description: "Alışveriş yapmadan önce DampingVar'a bak." },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="paper-grain min-h-screen text-murekkep antialiased">{children}</body>
    </html>
  );
}
