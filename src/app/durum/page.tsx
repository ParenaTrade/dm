import type { Metadata } from "next";
import Link from "next/link";
import { DeployStatus } from "@/components/DeployStatus";
import { SystemStatusButton } from "@/components/SystemStatusButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Berkbey — Sistem Durumu",
  description: "Sistem durumu.",
};

async function isStaffViewer() {
  try {
    const { getCurrentUser, isStaff } = await import("@/lib/session");
    return isStaff(await getCurrentUser());
  } catch {
    return false;
  }
}

export default async function DurumPage() {
  // Ayrıntılar yalnızca admin ve moderatöre açık; izleyici sadece Aktif/Pasif düğmesini görür.
  if (await isStaffViewer()) {
    return (
      <main className="min-h-screen">
        <DeployStatus />
      </main>
    );
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <p className="font-display gold-text text-4xl">Sistem Durumu</p>
      <SystemStatusButton large />
      <Link href="/canli" className="text-sm text-white/50 hover:text-gold">
        ← Canlı yayına dön
      </Link>
    </main>
  );
}
