"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useMe } from "./Shell";

export default function PredictionForm({ id, options }: { id: number; options: string[] }) {
  const { me, refresh, openAuth } = useMe();
  const router = useRouter();
  const [option, setOption] = useState(options[0]);
  const [amount, setAmount] = useState(50);
  const [msg, setMsg] = useState("");
  const submit = async () => {
    if (!me) return openAuth();
    try { await api("/api/predictions", { id, option, amount }); setMsg("Tahminin alındı!"); refresh(); router.refresh(); }
    catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="mt-3 flex flex-wrap gap-2 items-center">
      <select className="input !w-auto" value={option} onChange={(e) => setOption(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select>
      <input type="number" min={10} className="input !w-28" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      <button onClick={submit} className="btn btn-red">Tahmin et</button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
