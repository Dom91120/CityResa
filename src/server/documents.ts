/**
 * Pièces jointes : règles de dépôt, vignettes des photos (sharp), lecture et droits.
 * Les octets vivent dans document_content, à part de la fiche.
 */
import type { Document, Referential } from "@/generated/prisma/client";
import { DOCUMENT_PARENTS, type PermissionCategory } from "@/lib/constantes";
import type { AppSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import type { CurrentUser } from "@/server/guards";

export const DEFAULT_MAX_MB = 10;

export const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "odt",
  "rtf",
  "txt",
  "md",
  "xls",
  "xlsx",
  "ods",
  "csv",
  "ppt",
  "pptx",
  "odp",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "zip",
  "7z",
  "eml",
  "msg",
]);

export const INLINE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

export function documentsEnabled(cfg: AppSettings): boolean {
  return Boolean(cfg.DOCUMENTS_ENABLED ?? true);
}

export function extension(nom: string): string {
  return nom.includes(".") ? (nom.split(".").pop()?.toLowerCase() ?? "") : "";
}

export function estImage(doc: { filename: string; mimeType?: string }): boolean {
  return (
    IMAGE_EXTENSIONS.has(extension(doc.filename)) || Boolean(doc.mimeType?.startsWith("image/"))
  );
}

export function viewable(doc: { filename: string }): boolean {
  return extension(doc.filename || "") in INLINE_TYPES;
}

export function maxBytes(cfg: AppSettings): number {
  const mo = Number.parseInt(String(cfg.DOCUMENT_MAX_MB || DEFAULT_MAX_MB), 10);
  return Math.max(1, Number.isFinite(mo) ? mo : DEFAULT_MAX_MB) * 1024 * 1024;
}

export type DocumentAvecCategorie = Document & { category: Referential | null };

/** Les pièces d'une fiche, dans l'ordre (position puis date). */
export async function forParent(
  kind: string,
  parentId: number,
  opts: { kinds?: string[] } = {},
): Promise<DocumentAvecCategorie[]> {
  const parent = DOCUMENT_PARENTS[kind];
  if (!parent) return [];
  return prisma.document.findMany({
    where: { [parent[0]]: parentId, ...(opts.kinds ? { kind: { in: opts.kinds } } : {}) },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    include: { category: true },
  });
}

/** Le type de parent auquel une pièce est accrochée. */
export function parentKind(doc: Document): string | null {
  for (const [kind, [col]] of Object.entries(DOCUMENT_PARENTS)) {
    if ((doc as unknown as Record<string, unknown>)[col]) return kind;
  }
  return null;
}

export function parentId(doc: Document): number | null {
  const kind = parentKind(doc);
  if (!kind) return null;
  return (doc as unknown as Record<string, number | null>)[DOCUMENT_PARENTS[kind][0]];
}

/** La catégorie de droits à exiger pour lire ou retirer une pièce. */
export function permissionCategoryOf(doc: Document): PermissionCategory {
  const kind = parentKind(doc);
  return kind ? DOCUMENT_PARENTS[kind][1] : "reservations";
}

const ECRANS: Record<string, string> = {
  site: "/sites",
  espace: "/espaces",
  materiel: "/materiel",
  organisation: "/usagers",
  reservation: "/reservations",
  subvention: "/subventions",
};

/** Là d'où l'on vient. */
export function retour(kind: string | null, pid: number | null): string {
  const base = kind ? ECRANS[kind] : undefined;
  return base && pid ? `${base}/${pid}` : "/";
}

/** Le nom qu'on donne à une pièce : libre, mais jamais un chemin ni un caractère de contrôle. */
export function nomAffiche(valeur: unknown): string {
  let nom = String(valeur ?? "").trim();
  nom = [...nom].filter((ch) => ch !== "/" && ch !== "\\" && ch.charCodeAt(0) >= 32).join("");
  nom = nom.replace(/^[ .]+|[ .]+$/g, "");
  return nom.slice(0, 250);
}

/** `secure_filename`, en version simplifiée. */
export function secureFilename(nom: string): string {
  const normalise = nom.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return normalise
    .replace(/[/\\]/g, " ")
    .replace(/[^A-Za-z0-9_.-]+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");
}

export type FichierLu = { nom: string; mime: string; octets: Buffer };

/** (nom, mime, octets) du fichier envoyé, ou le message qui explique le refus. */
export async function lireFichier(
  cfg: AppSettings,
  fichier: FormDataEntryValue | null,
  opts: { imagesSeulement?: boolean } = {},
): Promise<FichierLu | string> {
  if (!fichier || typeof fichier === "string" || !(fichier.name || "").trim())
    return "Choisissez un fichier.";
  const nom = secureFilename(fichier.name) || "piece-jointe";
  const ext = extension(nom);
  if (opts.imagesSeulement ? !IMAGE_EXTENSIONS.has(ext) : !ALLOWED_EXTENSIONS.has(ext)) {
    return opts.imagesSeulement
      ? "Choisissez une image (png, jpg, webp, gif)."
      : `Type de fichier non accepté (.${ext || "?"}). Acceptés : ${[...ALLOWED_EXTENSIONS].sort().join(", ")}.`;
  }
  const octets = Buffer.from(await fichier.arrayBuffer());
  if (!octets.length) return "Le fichier est vide.";
  const max = maxBytes(cfg);
  if (octets.length > max) {
    return `Fichier trop volumineux (${Math.floor(octets.length / (1024 * 1024))} Mo) : maximum ${Math.floor(max / (1024 * 1024))} Mo.`;
  }
  return { nom, mime: (fichier.type || "").slice(0, 120), octets };
}

/** Vignette JPEG (largeur 640) d'une image ; null si sharp n'y arrive pas. */
export async function vignette(octets: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(octets)
      .rotate()
      .resize({ width: 640, height: 480, fit: "cover", withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
  } catch (e) {
    console.warn("[documents] vignette impossible :", e);
    return null;
  }
}

export type DepotEntree = {
  kind: string;
  parentId: number;
  fichier: FichierLu;
  docKind?: string;
  title?: string | null;
  categoryId?: number | null;
  isPublic?: boolean;
  uploadedById?: string | null;
  /** Fin de validité (minuit UTC d'un jour calendaire), pour une pièce datée. */
  validUntil?: Date | null;
};

/** Enregistre une pièce (et sa vignette si c'est une image). */
export async function deposerDocument(e: DepotEntree): Promise<Document> {
  const col = DOCUMENT_PARENTS[e.kind]?.[0];
  if (!col) throw new Error(`Parent de pièce inconnu : ${e.kind}`);
  const image = IMAGE_EXTENSIONS.has(extension(e.fichier.nom));
  const thumb = image ? await vignette(e.fichier.octets) : null;
  const dernier = await prisma.document.aggregate({
    where: { [col]: e.parentId },
    _max: { position: true },
  });
  return prisma.document.create({
    data: {
      filename: e.fichier.nom,
      mimeType:
        e.fichier.mime ||
        (image
          ? `image/${extension(e.fichier.nom) === "jpg" ? "jpeg" : extension(e.fichier.nom)}`
          : "application/octet-stream"),
      size: e.fichier.octets.length,
      kind: e.docKind ?? (image ? "photo" : "piece"),
      title: e.title ?? null,
      categoryId: e.categoryId ?? null,
      isPublic: e.isPublic ?? false,
      position: (dernier._max.position ?? -1) + 1,
      uploadedById: e.uploadedById ?? null,
      validUntil: e.validUntil ?? null,
      [col]: e.parentId,
      content: {
        create: {
          data: new Uint8Array(e.fichier.octets),
          thumb: thumb ? new Uint8Array(thumb) : null,
        },
      },
    },
  });
}

/** Enregistre un PDF produit par l'application (convention, facture). */
export async function enregistrerPdf(
  kind: "reservation" | "subvention",
  parentIdValue: number,
  filename: string,
  octets: Buffer,
  docKind: "convention" | "avenant" | "facture" | "autre",
  title?: string,
): Promise<Document> {
  const col = DOCUMENT_PARENTS[kind][0];
  return prisma.document.create({
    data: {
      filename,
      mimeType: "application/pdf",
      size: octets.length,
      kind: docKind,
      title: title ?? null,
      [col]: parentIdValue,
      content: { create: { data: new Uint8Array(octets) } },
    },
  });
}

/**
 * L'utilisateur peut-il lire cette pièce ? Un agent selon la catégorie de droit ; un
 * usager seulement ses propres dossiers ; n'importe qui une pièce publique d'un espace
 * ou d'un site.
 */
export async function peutLire(user: CurrentUser | null, doc: Document): Promise<boolean> {
  if (doc.isPublic && (doc.espaceId || doc.siteId || doc.materielId)) return true;
  if (!user) return false;
  if (user.isAgent) return user.canView(permissionCategoryOf(doc));
  if (doc.reservationId) {
    const r = await prisma.reservation.findUnique({
      where: { id: doc.reservationId },
      select: { userId: true, organisationId: true },
    });
    return Boolean(
      r &&
        (r.userId === user.id || (user.organisationId && r.organisationId === user.organisationId)),
    );
  }
  if (doc.organisationId) return doc.organisationId === user.organisationId;
  if (doc.etatDesLieuxId) {
    const e = await prisma.etatDesLieux.findUnique({
      where: { id: doc.etatDesLieuxId },
      select: { reservation: { select: { userId: true, organisationId: true } } },
    });
    return Boolean(
      e &&
        (e.reservation.userId === user.id ||
          (user.organisationId && e.reservation.organisationId === user.organisationId)),
    );
  }
  if (doc.subventionId) {
    const s = await prisma.subvention.findUnique({
      where: { id: doc.subventionId },
      select: { organisationId: true },
    });
    return Boolean(s && s.organisationId === user.organisationId);
  }
  return false;
}

function nomAttache(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * La réponse HTTP d'une pièce : en pièce jointe, ou en ligne quand son type s'y prête.
 * Les vignettes et affichages en ligne portent un ETag : le navigateur revalide à chaque
 * affichage (réponse 304 si la pièce n'a pas changé), ce qui évite d'afficher une image
 * périmée quand un identifiant est réutilisé ou une photo remplacée.
 */
export async function reponseDocument(
  id: number,
  mode: "download" | "view" | "thumb",
  ifNoneMatch: string | null = null,
): Promise<Response | null> {
  const doc = await prisma.document.findUnique({ where: { id }, include: { content: true } });
  if (!doc?.content) return null;
  const etag = `"${doc.id}-${doc.createdAt.getTime()}-${doc.size}-${mode}"`;
  if (mode !== "download" && ifNoneMatch === etag)
    return new Response(null, { status: 304, headers: { ETag: etag } });
  if (mode === "thumb") {
    const data = doc.content.thumb ?? doc.content.data;
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": doc.content.thumb ? "image/jpeg" : doc.mimeType,
        "Cache-Control": "private, no-cache",
        ETag: etag,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const mime = mode === "view" ? INLINE_TYPES[extension(doc.filename)] : null;
  return new Response(new Uint8Array(doc.content.data), {
    headers: {
      "Content-Type": mime ?? "application/octet-stream",
      "Content-Disposition": `${mime ? "inline" : "attachment"}; ${nomAttache(doc.filename)}`,
      "Content-Length": String(doc.content.data.byteLength),
      "X-Content-Type-Options": "nosniff",
      ...(mime ? { "Cache-Control": "private, no-cache", ETag: etag } : {}),
      ...(mime
        ? {
            "Content-Security-Policy":
              "default-src 'none'; img-src 'self'; object-src 'self'; frame-ancestors 'none'",
          }
        : {}),
    },
  });
}

/** Les catégories de pièces (Référentiels). */
export async function docCategories(): Promise<Referential[]> {
  return prisma.referential.findMany({
    where: { kind: "doc_categorie", isActive: true },
    orderBy: [{ position: "asc" }, { label: "asc" }],
  });
}
