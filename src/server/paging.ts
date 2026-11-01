/**
 * Pagination simple en mémoire pour les listes. Vingt lignes par défaut ; la taille
 * choisie est retenue par utilisateur et par liste.
 */
import { prisma } from "@/server/db";
import type { CurrentUser } from "@/server/guards";

export const PER_PAGE = 20;
export const PER_PAGE_CHOICES = [10, 20, 50, 100, 200] as const;

export type Params = Record<string, string | string[] | undefined>;

function lire(raw: unknown): number | null | false {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "all" || v === "tous") return null;
  const n = Number.parseInt(v, 10);
  if ((PER_PAGE_CHOICES as readonly number[]).includes(n)) return n;
  return false;
}

function prefs(user: CurrentUser): Record<string, number | string> {
  try {
    return user.listPrefs ? (JSON.parse(user.listPrefs) as Record<string, number | string>) : {};
  } catch {
    return {};
  }
}

export function param(params: Params, name: string): string | undefined {
  const v = params[name];
  return Array.isArray(v) ? v[0] : v;
}

/** La taille de page : ?per_page s'il est donné ; sinon celle retenue pour CETTE liste ; sinon `def`. */
export async function resolvePerPage(
  params: Params,
  user: CurrentUser | null,
  cle: string,
  def: number | null = PER_PAGE,
): Promise<number | null> {
  const demande = param(params, "per_page");
  if (demande !== undefined) {
    const v = lire(demande);
    if (v === false) return def;
    if (user && cle) {
      const p = prefs(user);
      const valeur = v === null ? "all" : v;
      if (p[cle] !== valeur) {
        p[cle] = valeur;
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { listPrefs: JSON.stringify(p) },
          });
        } catch (e) {
          console.error("[paging] mémoire de pagination impossible :", e);
        }
      }
    }
    return v;
  }
  if (user && cle) {
    const retenue = prefs(user)[cle];
    if (retenue !== undefined && retenue !== null) {
      const v = lire(retenue);
      if (v !== false) return v;
    }
  }
  return def;
}

/** Normalise un texte pour la recherche : minuscules, sans accents. */
export function normaliser(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Filtre une liste d'objets : garde ceux dont l'un des champs contient q (sans casse ni accents). */
export function textSearch<T extends object>(items: T[], q: string, fields: (keyof T)[]): T[] {
  if (!q) return items;
  const ql = normaliser(q.trim());
  return items.filter((it) =>
    fields.some((f) => {
      const v = it[f];
      return v !== null && v !== undefined && v !== "" && normaliser(String(v)).includes(ql);
    }),
  );
}

export type Pagination = { page: number; pages: number; total: number; perPage: number | null };

/** Découpe `items` selon ?page=N. perPage null = tout sur une page. */
export function paginate<T>(items: T[], params: Params, perPage: number | null): [T[], Pagination] {
  const total = items.length;
  if (perPage === null || perPage === 0)
    return [items, { page: 1, pages: 1, total, perPage: null }];
  let page = Number.parseInt(param(params, "page") ?? "1", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  const pages = Math.max(1, Math.ceil(total / perPage));
  page = Math.min(page, pages);
  const start = (page - 1) * perPage;
  return [items.slice(start, start + perPage), { page, pages, total, perPage }];
}
