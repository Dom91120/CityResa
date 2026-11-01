/**
 * Référentiels (listes de valeurs administrables) : lecture du formulaire, usages d'une
 * valeur dans les autres tables, déplacement, activation, suppression.
 *
 *   kind · label · code · icon · color · is_active
 */
import { REFERENTIAL_KINDS } from "@/lib/constantes";
import { champ, champOuNull, coche, slugifier } from "@/lib/forms-util";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";

export type ReferentielEntree = {
  kind: string;
  label: string;
  code: string | null;
  icon: string | null;
  color: string | null;
  isActive: boolean;
};

export function lireReferentiel(form: FormData): ReferentielEntree {
  const kind = champ(form, "kind");
  if (!(kind in REFERENTIAL_KINDS)) throw new UserFacingError("Liste inconnue.");
  const label = champ(form, "label").slice(0, 120);
  if (!label) throw new UserFacingError("Indiquez le libellé.");
  const codeBrut = champOuNull(form, "code");
  const code = codeBrut ? slugifier(codeBrut).replace(/-/g, "_").slice(0, 40) || null : null;
  const color = champOuNull(form, "color");
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color))
    throw new UserFacingError("La couleur doit être au format #rrggbb.");
  const icon = champOuNull(form, "icon");
  if (icon && !/^[a-z0-9-]{1,40}$/.test(icon))
    throw new UserFacingError("Le nom d'icône n'est pas valide (minuscules et tirets).");
  return {
    kind,
    label,
    code,
    icon,
    color: color ? color.toLowerCase() : null,
    isActive: coche(form, "is_active"),
  };
}

/** Un libellé (et un code) ne peuvent pas être pris deux fois dans la même liste. */
export async function verifierUnicite(e: ReferentielEntree, excludeId: number | null) {
  const memeLabel = await prisma.referential.findFirst({
    where: { kind: e.kind, label: e.label, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (memeLabel) throw new UserFacingError(`« ${e.label} » existe déjà dans cette liste.`);
  if (e.code) {
    const memeCode = await prisma.referential.findFirst({
      where: { kind: e.kind, code: e.code, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (memeCode)
      throw new UserFacingError(`Le code « ${e.code} » est déjà utilisé dans cette liste.`);
  }
}

export type Usage = {
  espaces: number;
  equipements: number;
  tarifs: number;
  organisations: number;
  reservations: number;
  materiels: number;
  documents: number;
  profilsEspaces: number;
};

/** Combien d'enregistrements pointent vers chaque valeur (pour interdire la suppression). */
export async function usages(ids: number[], codes: string[]): Promise<Map<number, Usage>> {
  const out = new Map<number, Usage>();
  if (!ids.length) return out;
  const rows = await prisma.referential.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      code: true,
      _count: {
        select: {
          espacesNature: true,
          equipements: true,
          tarifs: true,
          organisations: true,
          reservations: true,
          materiels: true,
          documents: true,
        },
      },
    },
  });
  // Les profils autorisés d'un espace sont des CODES (tableau de chaînes), pas des clés.
  const parCode = new Map<string, number>();
  if (codes.length) {
    const espaces = await prisma.espace.findMany({
      where: { allowedProfiles: { hasSome: codes } },
      select: { allowedProfiles: true },
    });
    for (const e of espaces)
      for (const c of e.allowedProfiles) parCode.set(c, (parCode.get(c) ?? 0) + 1);
  }
  for (const r of rows) {
    out.set(r.id, {
      espaces: r._count.espacesNature,
      equipements: r._count.equipements,
      tarifs: r._count.tarifs,
      organisations: r._count.organisations,
      reservations: r._count.reservations,
      materiels: r._count.materiels,
      documents: r._count.documents,
      profilsEspaces: r.code ? (parCode.get(r.code) ?? 0) : 0,
    });
  }
  return out;
}

export function totalUsage(u: Usage | undefined): number {
  if (!u) return 0;
  return Object.values(u).reduce((s, n) => s + n, 0);
}

/** « 3 espaces, 2 tarifs » */
export function decrireUsage(u: Usage | undefined): string {
  if (!u) return "";
  const parts: string[] = [];
  const p = (n: number, s: string, pl = `${s}s`) => n && parts.push(`${n} ${n > 1 ? pl : s}`);
  p(u.espaces, "espace");
  p(u.profilsEspaces, "espace (profil autorisé)", "espaces (profil autorisé)");
  p(u.equipements, "équipement d'espace", "équipements d'espace");
  p(u.tarifs, "tarif");
  p(u.organisations, "organisation");
  p(u.reservations, "réservation");
  p(u.materiels, "matériel", "matériels");
  p(u.documents, "pièce");
  return parts.join(", ");
}

export async function deplacer(id: number, sens: "haut" | "bas"): Promise<void> {
  const r = await prisma.referential.findUnique({ where: { id } });
  if (!r) throw new UserFacingError("Valeur introuvable.");
  const freres = await prisma.referential.findMany({
    where: { kind: r.kind },
    orderBy: [{ position: "asc" }, { label: "asc" }],
  });
  const i = freres.findIndex((x) => x.id === id);
  const j = sens === "haut" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= freres.length) throw new UserFacingError("Rien à déplacer.");
  [freres[i], freres[j]] = [freres[j], freres[i]];
  await prisma.$transaction(
    freres.map((x, k) => prisma.referential.update({ where: { id: x.id }, data: { position: k } })),
  );
}

export async function basculer(id: number): Promise<boolean> {
  const r = await prisma.referential.findUnique({ where: { id } });
  if (!r) throw new UserFacingError("Valeur introuvable.");
  await prisma.referential.update({ where: { id }, data: { isActive: !r.isActive } });
  return !r.isActive;
}

export async function supprimer(id: number): Promise<string> {
  const r = await prisma.referential.findUnique({ where: { id } });
  if (!r) throw new UserFacingError("Valeur introuvable.");
  const u = (await usages([id], r.code ? [r.code] : [])).get(id);
  if (totalUsage(u))
    throw new UserFacingError(
      `« ${r.label} » est utilisé (${decrireUsage(u)}) : désactivez-le plutôt que de le supprimer.`,
    );
  await prisma.referential.delete({ where: { id } });
  return `« ${r.label} » supprimé.`;
}

export async function ajouter(e: ReferentielEntree): Promise<void> {
  await verifierUnicite(e, null);
  const dernier = await prisma.referential.aggregate({
    where: { kind: e.kind },
    _max: { position: true },
  });
  await prisma.referential.create({ data: { ...e, position: (dernier._max.position ?? -1) + 1 } });
}

export async function modifier(id: number, e: ReferentielEntree): Promise<void> {
  const r = await prisma.referential.findUnique({ where: { id } });
  if (!r) throw new UserFacingError("Valeur introuvable.");
  const data = { ...e, kind: r.kind }; // la liste d'appartenance ne change pas
  await verifierUnicite(data, id);
  await prisma.referential.update({ where: { id }, data });
}
