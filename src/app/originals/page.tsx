import Originals from "@/components/Originals";
import { Page, PageHeader } from "@/components/ui";
import { flag } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function OriginalsPage() {
  const on = await flag("originals_enabled");
  return (
    <Page>
      <PageHeader icon="🎲" title="Originals" sub="Sanal coin ile oynanan, sonuçları doğrulanabilir topluluk oyunları. Çevrimin turnuva skoruna eklenir." />
      {on ? <Originals /> : <div className="card p-8 text-center text-muted">Originals şu an kapalı.</div>}
    </Page>
  );
}
