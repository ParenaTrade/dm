import type { Metadata } from "next";
import { LiveStudio } from "@/components/studio/LiveStudio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Berkbey — Canlı Yayın Stüdyosu",
  description: "Yayıncı stüdyosu: yalnızca yayıncı girişiyle açılır.",
};

export default function CanliPage() {
  return (
    <main className="min-h-screen">
      <LiveStudio mode="studio" />
    </main>
  );
}
