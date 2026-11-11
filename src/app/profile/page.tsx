import { Flash, Page, PageHeader } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { requestDeletion, updateProfile } from "../actions";

export const dynamic = "force-dynamic";

export default async function Profile({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const u = await getUser();
  if (!u) return <Page><div className="card p-8 text-center text-muted">Giriş yapmalısın.</div></Page>;
  return (
    <Page>
      <PageHeader icon="👤" title="Profil & Gizlilik" sub={`${u.username} · Seviye ${u.level} · ${u.xp} XP`} />
      <Flash msg={msg} />
      <div className="grid md:grid-cols-2 gap-5">
        <form action={updateProfile} className="card p-5 space-y-3">
          <div><label className="label">Doğum yılı (18+ doğrulama)</label><input name="birthYear" type="number" className="input" defaultValue={u.birthYear ?? ""} /></div>
          <div><label className="label">Avatar URL (https)</label><input name="avatarUrl" className="input" defaultValue={u.avatarUrl ?? ""} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="hide" defaultChecked={u.hideOnLeaderboard} /> Sıralamalarda “Gizli kullanıcı” olarak görün</label>
          <div className="text-xs text-muted">Yaş onayı: {u.ageConfirmedAt ? u.ageConfirmedAt.toLocaleDateString("tr-TR") : "yok"}</div>
          <button className="btn btn-red">Kaydet</button>
        </form>
        <div className="card p-5 space-y-3">
          <h2 className="font-bold">KVKK / GDPR</h2>
          <p className="text-sm text-muted">Hesabının ve kişisel verilerinin silinmesini talep edebilirsin. Talep 30 gün içinde işlenir; yasal saklama zorunluluğu olan kayıtlar (audit) anonimleştirilir.</p>
          <form action={requestDeletion}><button className="btn btn-ghost border border-red-500 text-red-400">Veri silme talebi oluştur</button></form>
        </div>
      </div>
    </Page>
  );
}
