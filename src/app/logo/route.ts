import { createHash } from "node:crypto";
import { getSettings } from "@/server/config-store";
import { decoderLogo } from "@/server/logo";

/** GET /logo : le logo de la collectivité (public, mis en cache un jour, versionné par l'adresse). */
export async function GET(req: Request) {
  const cfg = await getSettings();
  const logo = decoderLogo(cfg.COLLECTIVITE_LOGO);
  if (!logo) return new Response(null, { status: 404 });
  const etag = `"${createHash("sha1").update(cfg.COLLECTIVITE_LOGO).digest("hex").slice(0, 16)}"`;
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304 });
  return new Response(new Uint8Array(logo.octets), {
    headers: {
      "Content-Type": logo.mime,
      "Content-Length": String(logo.octets.length),
      "Cache-Control": "public, max-age=86400",
      ETag: etag,
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
