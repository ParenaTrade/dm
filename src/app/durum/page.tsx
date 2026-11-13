import type { Metadata } from "next";
import { DeployStatus } from "@/components/DeployStatus";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Berkbey — Sistem & Deployment Durumu",
  description: "Supabase tabloları, Realtime bağlantısı ve Vercel deployment kontrolü.",
};

export default function DurumPage() {
  return (
    <main className="min-h-screen">
      <DeployStatus />
    </main>
  );
}
