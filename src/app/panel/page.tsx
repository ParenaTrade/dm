import type { Metadata } from "next";
import { PanelClient } from "@/components/PanelClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Berkbey — Moderatör Paneli",
  description: "Moderatör kadrosu, kullanıcı yönetimi, silinen mesajlar ve olay kaydı.",
};

export default function PanelPage() {
  return (
    <main className="min-h-screen">
      <PanelClient />
    </main>
  );
}
