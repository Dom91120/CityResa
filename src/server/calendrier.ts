/**
 * Calendrier des saisons : saisons (années scolaires), vacances scolaires de la zone C et
 * jours fériés. Les récurrences « hors vacances » / « hors jours fériés » lisent ici les
 * jours à sauter ; l'écran Administration › Calendrier gère les saisons et les périodes.
 *
 * Vacances : jeu open data national « fr-en-calendrier-scolaire » (data.education.gouv.fr,
 * API Explore v2.1), filtré sur l'année scolaire et la zone. Jours fériés : calculés
 * (lib/calendrier.ts) et inscrits comme périodes modifiables.
 */
import type { PeriodeCalendrier, Saison } from "@/generated/prisma/client";
import {
  anneeScolaire,
  joursDesPeriodes,
  joursFeriesEntre,
  lireCalendrierScolaire,
  type PeriodeJours,
  type PeriodeKind,
  periodesSeRecouvrent,
  saisonDe,
} from "@/lib/calendrier";
import {
  bornesRecurrence,
  type Intervalle,
  type Recurrence,
  utiliseCalendrier,
} from "@/lib/creneaux";
import { parseYmdUtc, ymdUtc } from "@/lib/date-utc";
import { todayParisISO } from "@/lib/paris-time";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";

export const URL_CALENDRIER_SCOLAIRE =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records";

/** Une période lue en base, avec ses bornes « YYYY-MM-DD ». */
export type PeriodeLue = PeriodeCalendrier & PeriodeJours;

export function periodeLue(p: PeriodeCalendrier): PeriodeLue {
  return { ...p, debut: ymdUtc(p.startDate), fin: ymdUtc(p.endDate) };
}

export function saisonLue(s: Saison): Saison & PeriodeJours {
  return { ...s, debut: ymdUtc(s.startDate), fin: ymdUtc(s.endDate) };
}

// ── Lecture ──

export async function saisons(): Promise<(Saison & PeriodeJours)[]> {
  const rows = await prisma.saison.findMany({ orderBy: { startDate: "desc" } });
  return rows.map(saisonLue);
}

/** La saison active, sinon celle qui contient aujourd'hui, sinon null. */
export async function saisonActive(now = new Date()): Promise<(Saison & PeriodeJours) | null> {
  const active = await prisma.saison.findFirst({ where: { isActive: true } });
  if (active) return saisonLue(active);
  const jour = parseYmdUtc(todayParisISO(now));
  const courante = await prisma.saison.findFirst({
    where: { startDate: { lte: jour }, endDate: { gte: jour } },
    orderBy: { startDate: "desc" },
  });
  return courante ? saisonLue(courante) : null;
}

/** Les périodes qui touchent un intervalle de jours (bornes incluses), par date. */
export async function periodesEntre(
  debut: string,
  fin: string,
  kinds?: PeriodeKind[],
): Promise<PeriodeLue[]> {
  const rows = await prisma.periodeCalendrier.findMany({
    where: {
      startDate: { lte: parseYmdUtc(fin) },
      endDate: { gte: parseYmdUtc(debut) },
      ...(kinds ? { kind: { in: kinds } } : {}),
    },
    orderBy: [{ startDate: "asc" }, { kind: "asc" }],
  });
  return rows.map(periodeLue);
}

/**
 * Les jours « YYYY-MM-DD » qu'une récurrence doit sauter : les vacances scolaires et / ou
 * les jours fériés inscrits au calendrier (plus les fériés légaux calculés, au cas où la
 * saison n'aurait pas été créée). Vide si la récurrence ne s'appuie pas sur le calendrier.
 */
export async function joursExclus(
  premier: Intervalle,
  rec: Recurrence | null,
): Promise<Set<string>> {
  if (!rec || !utiliseCalendrier(rec)) return new Set();
  const b = bornesRecurrence(premier, rec);
  const kinds: PeriodeKind[] = [];
  if (rec.horsVacances) kinds.push("vacances");
  if (rec.horsFeries) kinds.push("ferie");
  const periodes = await periodesEntre(b.debut, b.fin, kinds);
  const jours = joursDesPeriodes(periodes);
  if (rec.horsFeries) for (const f of joursFeriesEntre(b.debut, b.fin)) jours.add(f.date);
  return jours;
}

// ── Saisons ──

export type SaisonEntree = { label: string; debut: string; fin: string; isActive: boolean };

async function verifierSaison(e: SaisonEntree, saufId?: number): Promise<void> {
  if (e.fin <= e.debut) throw new UserFacingError("La fin de la saison doit suivre son début.");
  const doublon = await prisma.saison.findFirst({
    where: { label: e.label, ...(saufId ? { id: { not: saufId } } : {}) },
  });
  if (doublon) throw new UserFacingError(`La saison « ${e.label} » existe déjà.`);
  const chevauche = await prisma.saison.findFirst({
    where: {
      startDate: { lte: parseYmdUtc(e.fin) },
      endDate: { gte: parseYmdUtc(e.debut) },
      ...(saufId ? { id: { not: saufId } } : {}),
    },
  });
  if (chevauche)
    throw new UserFacingError(`Ces dates chevauchent la saison « ${chevauche.label} ».`);
}

/** Crée une saison et inscrit ses jours fériés ; la rend active si demandé. */
export async function creerSaison(e: SaisonEntree): Promise<Saison> {
  await verifierSaison(e);
  const s = await prisma.saison.create({
    data: {
      label: e.label,
      startDate: parseYmdUtc(e.debut),
      endDate: parseYmdUtc(e.fin),
      isActive: false,
    },
  });
  await inscrireFeries(e.debut, e.fin);
  if (e.isActive) await activerSaison(s.id);
  return s;
}

export async function modifierSaison(id: number, e: SaisonEntree): Promise<Saison> {
  await verifierSaison(e, id);
  const s = await prisma.saison.update({
    where: { id },
    data: { label: e.label, startDate: parseYmdUtc(e.debut), endDate: parseYmdUtc(e.fin) },
  });
  await inscrireFeries(e.debut, e.fin);
  if (e.isActive) await activerSaison(id);
  return s;
}

/** Une seule saison active à la fois. */
export async function activerSaison(id: number): Promise<void> {
  await prisma.$transaction([
    prisma.saison.updateMany({
      where: { isActive: true, id: { not: id } },
      data: { isActive: false },
    }),
    prisma.saison.update({ where: { id }, data: { isActive: true } }),
  ]);
}

/** Supprime la saison et les périodes importées ou calculées qui lui appartiennent (les saisies restent). */
export async function supprimerSaison(id: number): Promise<number> {
  const s = await prisma.saison.findUnique({ where: { id } });
  if (!s) throw new UserFacingError("Saison introuvable.");
  if (s.isActive) throw new UserFacingError("Activez d'abord une autre saison.");
  const { count } = await prisma.periodeCalendrier.deleteMany({
    where: {
      source: { in: ["import", "calcul"] },
      startDate: { gte: s.startDate },
      endDate: { lte: s.endDate },
    },
  });
  await prisma.saison.delete({ where: { id } });
  return count;
}

/** Inscrit les jours fériés légaux d'une plage comme périodes « calcul », sans doublonner un jour déjà férié. */
export async function inscrireFeries(debut: string, fin: string): Promise<number> {
  const existants = new Set(joursDesPeriodes(await periodesEntre(debut, fin, ["ferie"])));
  let n = 0;
  for (const f of joursFeriesEntre(debut, fin)) {
    if (existants.has(f.date)) continue;
    await prisma.periodeCalendrier.create({
      data: {
        kind: "ferie",
        label: f.label,
        startDate: parseYmdUtc(f.date),
        endDate: parseYmdUtc(f.date),
        source: "calcul",
      },
    });
    n++;
  }
  return n;
}

/** La saison qui contient aujourd'hui, créée si elle manque (amorçage), avec ses jours fériés. */
export async function seedSaison(now = new Date()): Promise<Saison | null> {
  const existe = await prisma.saison.findFirst({ select: { id: true } });
  if (existe) return null;
  const p = saisonDe(todayParisISO(now));
  return creerSaison({ ...p, isActive: true });
}

// ── Vacances scolaires ──

export type ClientCalendrier = (url: string) => Promise<unknown>;

const clientParDefaut: ClientCalendrier = async (url) => {
  const r = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

/** L'adresse de l'API open data pour une saison et une zone. */
export function urlVacances(label: string, zone: string): string {
  const where = `annee_scolaire="${label}" and zones="${zone}"`;
  const q = new URLSearchParams({
    where,
    limit: "100",
    select: "description,start_date,end_date,population",
  });
  return `${URL_CALENDRIER_SCOLAIRE}?${q.toString()}`;
}

/**
 * Remplace les vacances importées d'une saison par celles du calendrier scolaire officiel
 * de la zone. Les périodes saisies à la main sont conservées. `donnees` : un export JSON du
 * jeu déjà lu (fichier déposé) ; sinon l'API est interrogée.
 */
export async function importerVacances(
  saisonId: number,
  zone: string,
  opts: { donnees?: unknown; client?: ClientCalendrier } = {},
): Promise<{ saison: Saison; nb: number }> {
  const s = await prisma.saison.findUnique({ where: { id: saisonId } });
  if (!s) throw new UserFacingError("Saison introuvable.");
  const sl = saisonLue(s);
  const label = anneeScolaire(sl.debut);
  let json = opts.donnees;
  if (json === undefined) {
    try {
      json = await (opts.client ?? clientParDefaut)(urlVacances(label, zone));
    } catch (e) {
      throw new UserFacingError(
        `Le calendrier scolaire ${label} n'a pas pu être téléchargé (${e instanceof Error ? e.message : "erreur réseau"}). Vérifiez l'accès Internet du serveur, ou déposez l'export JSON du jeu « fr-en-calendrier-scolaire », ou saisissez les périodes à la main.`,
      );
    }
  }
  const periodes = lireCalendrierScolaire(json).filter(
    (p) => periodesSeRecouvrent(p, sl) && p.debut >= sl.debut,
  );
  if (!periodes.length)
    throw new UserFacingError(
      `Aucune période de vacances ${label} pour la ${zone} dans les données reçues : le calendrier n'est peut-être pas encore publié.`,
    );
  await prisma.$transaction(async (tx) => {
    await tx.periodeCalendrier.deleteMany({
      where: {
        kind: "vacances",
        source: "import",
        startDate: { gte: s.startDate, lte: s.endDate },
      },
    });
    // Une période est rattachée à la saison où elle commence et ne déborde pas de celle-ci :
    // les vacances d'été (jusqu'à la rentrée) s'arrêtent au 31 août.
    await tx.periodeCalendrier.createMany({
      data: periodes.map((p) => ({
        kind: "vacances",
        label: p.label,
        startDate: parseYmdUtc(p.debut),
        // biome-ignore lint/complexity/useMathMinMax: comparaison de chaînes « YYYY-MM-DD », pas de nombres.
        endDate: parseYmdUtc(p.fin > sl.fin ? sl.fin : p.fin),
        source: "import",
        zone,
      })),
    });
  });
  return { saison: s, nb: periodes.length };
}

// ── Périodes ──

export type PeriodeEntree = { kind: PeriodeKind; label: string; debut: string; fin: string };

export async function creerPeriode(e: PeriodeEntree): Promise<PeriodeCalendrier> {
  if (e.fin < e.debut) throw new UserFacingError("La fin de la période précède son début.");
  return prisma.periodeCalendrier.create({
    data: {
      kind: e.kind,
      label: e.label,
      startDate: parseYmdUtc(e.debut),
      endDate: parseYmdUtc(e.fin),
      source: "saisie",
    },
  });
}

export async function modifierPeriode(id: number, e: PeriodeEntree): Promise<PeriodeCalendrier> {
  if (e.fin < e.debut) throw new UserFacingError("La fin de la période précède son début.");
  return prisma.periodeCalendrier.update({
    where: { id },
    data: {
      kind: e.kind,
      label: e.label,
      startDate: parseYmdUtc(e.debut),
      endDate: parseYmdUtc(e.fin),
      source: "saisie",
    },
  });
}

export async function supprimerPeriode(id: number): Promise<PeriodeCalendrier> {
  return prisma.periodeCalendrier.delete({ where: { id } });
}
