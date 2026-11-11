/** Kanal canlı durumu (Supabase Realtime yerine istemci 4 sn'de bir sorgular). */
import { HttpError } from "@/lib/auth";
import { getChannelState } from "@/lib/channelState";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    await ensureSeed();
    const { slug } = await ctx.params;
    return Response.json(await getChannelState(slug));
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "Kanal durumu alınamadı." }, { status: 500 });
  }
}
