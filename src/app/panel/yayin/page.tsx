import type { Metadata } from "next";
import { LiveStudio } from "@/components/studio/LiveStudio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Berkbey — Moderatör Yayın Paneli",
  description: "Moderatör: sponsor seçimi, ekran paylaşımı, kamera ve sohbet yönetimi.",
};

export default function ModeratorLivePage() {
  return (
    <main className="min-h-screen">
      <LiveStudio mode="moderator" />
    </main>
  );
}
