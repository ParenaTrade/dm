import type { ReactNode } from "react";
import Countdown from "./Countdown";

export function PageHeader({ title, icon, sub, right }: { title: string; icon?: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">{icon && <span className="mr-2">{icon}</span>}{title}</h1>
        {sub && <p className="text-sm text-muted mt-1">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Flash({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div className="mb-4 card px-4 py-3 text-sm border-accent/40">{msg}</div>;
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="p-4 md:p-6 max-w-7xl mx-auto">{children}</div>;
}

export function VirtualNotice() {
  return <p className="text-[11px] text-muted">🪙 Coin'ler sanaldır: yalnızca aktiviteyle kazanılır, gerçek parayla satın alınamaz ve nakde çevrilemez.</p>;
}

export { Countdown };
