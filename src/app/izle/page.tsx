import type { Metadata } from "next";
import { LiveStudio } from "@/components/studio/LiveStudio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Berkbey — Canlı Yayın İzle",
  description: "Canlı yayını izle, sohbete katıl, konuk isteği gönder.",
};

export default function IzlePage() {
  return (
    <main className="min-h-screen">
      <LiveStudio mode="viewer" />
    </main>
  );
}
