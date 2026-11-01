/**
 * Le logo (blason) de la collectivité : une image déposée dans Paramètres, conservée en
 * configuration sous forme d'URL de données (`COLLECTIVITE_LOGO`), servie par GET /logo
 * avec une version dans l'adresse pour le cache, et incorporée telle quelle dans les PDF.
 */
import { createHash } from "node:crypto";
import { UserFacingError } from "@/server/errors";

const RASTER = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const TAILLE_MAX = 2 * 1024 * 1024;
/** Côté maximal d'un logo matriciel après redimensionnement. */
const COTE_MAX = 512;

/** Prépare le fichier déposé : redimensionné en PNG, ou SVG conservé tel quel. Renvoie l'URL de données. */
export async function preparerLogo(fichier: File): Promise<string> {
  if (fichier.size > TAILLE_MAX) throw new UserFacingError("Le logo ne doit pas dépasser 2 Mo.");
  const octets = Buffer.from(await fichier.arrayBuffer());
  const type = fichier.type || "";
  const texte = octets.subarray(0, 512).toString("utf8");
  if (
    type === "image/svg+xml" ||
    /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(texte)
  ) {
    if (/<script|on\w+\s*=|javascript:/i.test(octets.toString("utf8")))
      throw new UserFacingError("Le SVG contient du script : il est refusé.");
    return `data:image/svg+xml;base64,${octets.toString("base64")}`;
  }
  if (!RASTER.has(type)) throw new UserFacingError("Format accepté : PNG, JPEG, WebP, GIF ou SVG.");
  const sharp = (await import("sharp")).default;
  const png = await sharp(octets)
    .resize({ width: COTE_MAX, height: COTE_MAX, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** L'adresse à utiliser dans un `<img>` (avec version pour le cache), ou null sans logo. */
export function urlLogo(cfg: { COLLECTIVITE_LOGO: string }): string | null {
  const v = cfg.COLLECTIVITE_LOGO;
  if (!v) return null;
  return `/logo?v=${createHash("sha1").update(v).digest("hex").slice(0, 10)}`;
}

/** Décode l'URL de données en type MIME et octets. */
export function decoderLogo(dataUrl: string): { mime: string; octets: Buffer } | null {
  const m = /^data:([a-z0-9/+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], octets: Buffer.from(m[2], "base64") };
}
