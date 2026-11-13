import type { Metadata } from "next";
import { LiveStudio } from "@/components/studio/LiveStudio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Berkbey — Canlı Yayın Stüdyosu",
  description: "Yayıncı, konuk ve izleyici olarak katıl. WebRTC canlı yayın + moderatörlü sohbet.",
};

export default function CanliPage() {
  return (
    <main className="min-h-screen">
      <LiveStudio />
    </main>
  );
}
