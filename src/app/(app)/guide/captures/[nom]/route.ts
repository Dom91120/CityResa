import { requireAgent } from "@/server/guards";
import { lireCaptureGuide } from "@/server/guide";
import { pasTrouve } from "@/server/http";

/** GET /guide/captures/[nom].webp : une capture d'écran du guide, réservée aux agents connectés. */
export async function GET(_req: Request, { params }: { params: Promise<{ nom: string }> }) {
  await requireAgent();
  const image = await lireCaptureGuide((await params).nom);
  if (!image) return pasTrouve();
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(image.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
