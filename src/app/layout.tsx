import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import Shell from "@/components/Shell";
import { getUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { flag, setting } from "@/lib/platform";

export const metadata: Metadata = {
  title: "Cenkbey – Yayıncı Topluluk Platformu",
  description: "Canlı yayın, topluluk sohbeti, görevler, turnuvalar ve sanal coin oyunları.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await ensureSeed();
  const [user, c, storeOn, supportUrl] = await Promise.all([getUser(), cookies(), flag("store_enabled"), setting("support_url", "#")]);
  const ageOk = !!user?.ageConfirmedAt || c.get("age_ok")?.value === "1";
  return (
    <html lang="tr">
      <body className="antialiased">
        <Shell
          initialUser={user ? { id: user.id, username: user.username, level: user.level, xp: user.xp, coinBalance: user.coinBalance, role: user.role } : null}
          ageOk={ageOk} storeOn={storeOn} supportUrl={supportUrl}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
