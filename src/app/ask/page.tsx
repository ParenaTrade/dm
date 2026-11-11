import Link from "next/link";
import { db } from "@/db";
import { profiles, questionVotes, questions } from "@/db/schema";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { Flash, Page, PageHeader } from "@/components/ui";
import { getUser, isStaff } from "@/lib/auth";
import { startOfDay } from "@/lib/platform";
import { askQuestion, markQuestion, voteQuestion } from "../actions";

export const dynamic = "force-dynamic";

export default async function Ask({ searchParams }: { searchParams: Promise<{ msg?: string; sort?: string; status?: string }> }) {
  const sp = await searchParams;
  const u = await getUser();
  const staff = isStaff(u) || u?.role === "host";
  const rows = await db.select({ q: questions, username: profiles.username }).from(questions).innerJoin(profiles, eq(profiles.id, questions.userId))
    .where(sp.status ? eq(questions.status, sp.status) : undefined)
    .orderBy(sp.sort === "new" ? desc(questions.id) : desc(questions.votes), desc(questions.id)).limit(100);
  const myVotes = u ? new Set((await db.select().from(questionVotes).where(eq(questionVotes.userId, u.id))).map((v) => v.questionId)) : new Set<number>();
  const used = u ? (await db.select({ n: count() }).from(questions).where(and(eq(questions.userId, u.id), gte(questions.createdAt, startOfDay()))))[0].n : 0;

  return (
    <Page>
      <PageHeader icon="❓" title="Cenk'e Sor" sub="Topluluk soru panosu. En çok desteklenen sorular yayında cevaplanır." />
      <Flash msg={sp.msg} />
      {u ? (
        <form action={askQuestion} className="card p-4 mb-5 space-y-2">
          <textarea name="body" maxLength={280} required className="input min-h-20" placeholder="Sorunu yaz…" />
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-muted"><input type="checkbox" name="anon" /> Anonim sor</label>
            <span className="text-xs text-muted">Bugün kalan hak: {Math.max(0, 5 - used)}/5</span>
            <div className="flex-1" /><button className="btn btn-red" disabled={used >= 5}>Gönder</button>
          </div>
        </form>
      ) : <div className="card p-4 mb-5 text-sm text-muted">Soru sormak için giriş yap.</div>}
      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        {[["", "Popüler"], ["new", "Yeni"]].map(([k, l]) => <Link key={l} href={`/ask?sort=${k}${sp.status ? `&status=${sp.status}` : ""}`} className={`btn py-1 ${(sp.sort ?? "") === k ? "btn-red" : "btn-ghost"}`}>{l}</Link>)}
        <span className="w-px bg-line mx-1" />
        {[["", "Tümü"], ["pending", "Bekleyen"], ["selected", "Seçilmiş"], ["answered", "Cevaplanan"]].map(([k, l]) => <Link key={l} href={`/ask?status=${k}${sp.sort ? `&sort=${sp.sort}` : ""}`} className={`btn py-1 ${(sp.status ?? "") === k ? "btn-red" : "btn-ghost"}`}>{l}</Link>)}
      </div>
      <div className="space-y-2">
        {rows.map(({ q, username }) => (
          <div key={q.id} className={`card p-4 flex gap-4 ${q.status === "selected" ? "border-yellow-500/60" : ""}`}>
            <form action={voteQuestion} className="text-center">
              <input type="hidden" name="id" value={q.id} />
              <button disabled={!u} className={`w-12 rounded-lg py-1 ${myVotes.has(q.id) ? "bg-accent" : "bg-white/5 hover:bg-white/10"}`}>▲<div className="text-sm font-bold">{q.votes}</div></button>
            </form>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted flex gap-2">{q.isAnonymous ? "🕶 Anonim" : username} · {q.createdAt.toLocaleDateString("tr-TR")}
                {q.status !== "pending" && <span className={`badge ${q.status === "selected" ? "bg-yellow-500/20 text-yellow-300" : "bg-green-500/20 text-green-300"}`}>{q.status === "selected" ? "⭐ Seçilmiş" : "✓ Cevaplandı"}</span>}</div>
              <p className="mt-1 break-words">{q.body}</p>
              {staff && (
                <div className="flex gap-2 mt-2">
                  {(["selected", "answered", "pending"] as const).map((s) => (
                    <form key={s} action={markQuestion}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="status" value={s} /><button className="text-xs text-muted hover:text-white underline">{s === "selected" ? "Seç" : s === "answered" ? "Cevaplandı" : "Sıfırla"}</button></form>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="card p-8 text-center text-muted">Henüz soru yok.</div>}
      </div>
    </Page>
  );
}
