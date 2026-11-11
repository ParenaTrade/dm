import { notFound } from "next/navigation";
import StreamClient from "@/components/live/StreamClient";
import { HttpError } from "@/lib/auth";
import { getChannelState } from "@/lib/channelState";

export const dynamic = "force-dynamic";

export default async function StreamPage({ params }: { params: Promise<{ kanal: string }> }) {
  const { kanal } = await params;
  try {
    const data = await getChannelState(kanal);
    return <StreamClient slug={kanal} initial={JSON.parse(JSON.stringify(data))} />;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
}
