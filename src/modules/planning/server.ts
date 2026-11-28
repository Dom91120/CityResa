/**
 * Le planning : fenêtre affichée (semaine, mois, jour) en heure de Paris, espaces du
 * périmètre, créneaux vivants et blocages sur la fenêtre, répartition par jour.
 */
import type { Prisma } from "@/generated/prisma/client";
import { STATUTS_OCCUPANTS } from "@/lib/constantes";
import { chevauche } from "@/lib/creneaux";
import { parseInt_ } from "@/lib/forms-util";
import { dateJourEntier, dateJourMois, dateLongue, moisAnnee } from "@/lib/libelles";
import { addParisDays, parisMidnight, parisParts, todayParisISO } from "@/lib/paris-time";
import { lireSecteur } from "@/lib/planning-vues";
import { prisma } from "@/server/db";
import type { CurrentUser } from "@/server/guards";
import { type Params, param } from "@/server/paging";

export type Vue = "semaine" | "mois" | "jour" | "liste";

export type Fenetre = {
  vue: Vue;
  /** La date d'ancrage « YYYY-MM-DD ». */
  date: string;
  /** Les jours affichés (clés « YYYY-MM-DD »). */
  jours: string[];
  de: Date;
  a: Date;
  label: string;
  precedent: string;
  suivant: string;
  /** Pour la vue mois : le mois « YYYY-MM » affiché. */
  mois: string;
  /** Vue liste : l'étendue choisie (« » = la semaine). */
  etendue?: Etendue;
  /** Vue liste en dates libres : le dernier jour affiché, puis celui des périodes voisines. */
  au?: string;
  precedentAu?: string;
  suivantAu?: string;
};

/** Les étendues de la vue liste : la semaine de la date, N jours à partir d'elle, son mois, ou deux dates. */
export const ETENDUES: [string, string][] = [
  ["", "Semaine"],
  ["7j", "7 jours"],
  ["15j", "15 jours"],
  ["30j", "30 jours"],
  ["mois", "Mois"],
  ["libre", "Dates libres"],
];
export type Etendue = "" | "7j" | "15j" | "30j" | "mois" | "libre";

/** La plus longue période libre affichée par la liste (jours). */
export const MAX_JOURS_LISTE = 92;

export function lireEtendue(v: string | undefined): Etendue {
  return ETENDUES.some(([k]) => k === v) ? (v as Etendue) : "";
}

export const HEURE_DEBUT_JOUR = 7;
export const HEURE_FIN_JOUR = 23;

function cle(d: Date): string {
  return parisParts(d).dateKey;
}

export function lireVue(v: string | undefined): Vue {
  return v === "mois" || v === "jour" || v === "liste" ? v : "semaine";
}

export function lireDate(v: string | undefined): string {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parisMidnight(v).getTime())
    ? v
    : todayParisISO();
}

/** La fenêtre d'une vue ancrée sur une date. */
export function fenetre(vue: Vue, date: string): Fenetre {
  const ancre = parisMidnight(date);
  if (vue === "jour") {
    return {
      vue,
      date,
      jours: [date],
      de: ancre,
      a: addParisDays(ancre, 1),
      label: dateLongue(ancre).replace(/^./, (c) => c.toUpperCase()),
      precedent: cle(addParisDays(ancre, -1)),
      suivant: cle(addParisDays(ancre, 1)),
      mois: date.slice(0, 7),
    };
  }
  if (vue === "mois") {
    const premier = parisMidnight(`${date.slice(0, 7)}-01`);
    const [y, m] = date.split("-").map(Number);
    const moisSuivant = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const moisPrecedent = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
    const debutGrille = addParisDays(premier, -(parisParts(premier).weekday - 1));
    const finMois = parisMidnight(moisSuivant);
    const jours: string[] = [];
    let cur = debutGrille;
    // Des semaines entières jusqu'à couvrir la fin du mois.
    while (cur < finMois || jours.length % 7 !== 0) {
      jours.push(cle(cur));
      cur = addParisDays(cur, 1);
      if (jours.length >= 42) break;
    }
    return {
      vue,
      date,
      jours,
      de: debutGrille,
      a: cur,
      label: moisAnnee(premier),
      precedent: moisPrecedent,
      suivant: moisSuivant,
      mois: date.slice(0, 7),
    };
  }
  const lundi = addParisDays(ancre, -(parisParts(ancre).weekday - 1));
  const jours = Array.from({ length: 7 }, (_, i) => cle(addParisDays(lundi, i)));
  const dimanche = addParisDays(lundi, 6);
  return {
    vue,
    date,
    jours,
    de: lundi,
    a: addParisDays(lundi, 7),
    label: `Semaine du ${dateJourMois(lundi)} au ${dateJourMois(dimanche)}/${parisParts(dimanche).dateKey.slice(0, 4)}`,
    precedent: cle(addParisDays(lundi, -7)),
    suivant: cle(addParisDays(lundi, 7)),
    mois: date.slice(0, 7),
  };
}

/**
 * La fenêtre de la vue liste : la semaine de la date (par défaut), 7, 15 ou 30 jours à partir de
 * la date, son mois calendaire, ou des dates libres de `date` à `au` inclus (une semaine si `au`
 * manque ou précède `date` ; au plus MAX_JOURS_LISTE jours). Les flèches décalent d'une période.
 */
export function fenetreListe(date: string, etendue: Etendue, au?: string): Fenetre {
  if (etendue === "") return { ...fenetre("liste", date), etendue };
  const ancre = parisMidnight(date);
  if (etendue === "mois") {
    const m = fenetre("mois", date);
    const de = parisMidnight(`${m.mois}-01`);
    const a = parisMidnight(m.suivant);
    const jours: string[] = [];
    for (let cur = de; cur < a; cur = addParisDays(cur, 1)) jours.push(cle(cur));
    return { ...m, vue: "liste", jours, de, a, etendue };
  }
  let nb = etendue === "7j" ? 7 : etendue === "15j" ? 15 : 30;
  if (etendue === "libre") {
    const fin = au && /^\d{4}-\d{2}-\d{2}$/.test(au) ? parisMidnight(au).getTime() : Number.NaN;
    const ecart = Math.round((fin - ancre.getTime()) / 86_400_000) + 1;
    nb = Number.isNaN(ecart) || ecart < 1 ? 7 : Math.min(ecart, MAX_JOURS_LISTE);
  }
  const jours = Array.from({ length: nb }, (_, i) => cle(addParisDays(ancre, i)));
  const dernier = addParisDays(ancre, nb - 1);
  const f: Fenetre = {
    vue: "liste",
    date,
    jours,
    de: ancre,
    a: addParisDays(ancre, nb),
    label: `Du ${dateJourMois(ancre)} au ${dateJourMois(dernier)}/${cle(dernier).slice(0, 4)}`,
    precedent: cle(addParisDays(ancre, -nb)),
    suivant: cle(addParisDays(ancre, nb)),
    mois: date.slice(0, 7),
    etendue,
  };
  if (etendue === "libre") {
    f.au = cle(dernier);
    f.precedentAu = cle(addParisDays(ancre, -1));
    f.suivantAu = cle(addParisDays(ancre, 2 * nb - 1));
  }
  return f;
}

/** La fenêtre demandée par l'URL (?vue=&date=&etendue=&au=) : écran et export partagent la règle. */
export function fenetreDemandee(params: Params): Fenetre {
  const vue = lireVue(param(params, "vue"));
  const date = lireDate(param(params, "date"));
  return vue === "liste"
    ? fenetreListe(date, lireEtendue(param(params, "etendue")), param(params, "au"))
    : fenetre(vue, date);
}

/**
 * La période dans le sélecteur d'une barre de planning, en version courte : en vue Semaine,
 * l'onglet dit déjà « Semaine », on écrit donc « Du 9/11 au 15/11/2026 » ; en vue Jour, la date
 * est en chiffres, « Samedi 14/11/2026 ».
 */
export function periodeAffichee(fen: Fenetre): string {
  if (fen.vue === "semaine" || fen.vue === "liste") return fen.label.replace(/^Semaine du /, "Du ");
  if (fen.vue === "jour") return dateJourEntier(fen.de);
  return fen.label;
}

/** Les filtres du planning : aucun site, aucun espace coché ou aucun secteur choisi = tous. */
export type FiltresPlanning = { sites: number[]; espaces: number[]; secteur?: string };

/** Les identifiants d'un paramètre répété (?site=1&site=3), sans doublon ni valeur invalide. */
export function identifiants(brut: string | string[] | undefined): number[] {
  const liste = Array.isArray(brut) ? brut : brut ? [brut] : [];
  return [
    ...new Set(liste.map((v) => parseInt_(v, null, 1)).filter((n): n is number => n !== null)),
  ];
}

export function lireFiltresPlanning(params: Params): FiltresPlanning {
  return {
    sites: identifiants(params.site),
    espaces: identifiants(params.espace),
    secteur: lireSecteur(params.secteur),
  };
}

export const INCLUDE_ESPACE_PLANNING = {
  site: true,
  nature: true,
  documents: { where: { kind: "photo" }, orderBy: { position: "asc" as const }, take: 1 },
  // Les horaires d'ouverture particuliers d'une saison (fond de la frise de la vue Jour).
  horairesSaisons: { include: { saison: { select: { startDate: true, endDate: true } } } },
} satisfies Prisma.EspaceInclude;

export type EspacePlanning = Prisma.EspaceGetPayload<{
  include: typeof INCLUDE_ESPACE_PLANNING;
}> & {
  /** L'agent consulte cet espace sans le gérer : ni réservation, ni déplacement, ni blocage. */
  lectureSeule?: boolean;
};

export type EvtResa = {
  id: number;
  reservationId: number;
  numero: string;
  titre: string;
  status: string;
  qui: string;
  /** Type de l'organisation demandeuse ; null = particulier sans organisation. */
  typeUsager: string | null;
  serviceId: number | null;
  espaceId: number;
  startAt: Date;
  endAt: Date;
};

export type Blocage = {
  id: number;
  espaceId: number;
  startAt: Date;
  endAt: Date;
  motif: string | null;
};

/**
 * Les espaces visibles par l'agent (périmètre, site, sélection). Le planning se LIT sur le
 * périmètre de consultation : un espace que l'agent consulte sans le gérer porte
 * `lectureSeule`, et les vues n'y proposent ni réservation, ni déplacement, ni blocage.
 */
export async function espacesPlanning(
  user: CurrentUser,
  f: FiltresPlanning,
): Promise<EspacePlanning[]> {
  const and: Prisma.EspaceWhereInput[] = [{ isActive: true }];
  if (user.espacesVus.length) and.push({ id: { in: user.espacesVus } });
  if (f.sites.length) and.push({ siteId: { in: f.sites } });
  if (f.espaces.length) and.push({ id: { in: f.espaces } });
  if (f.secteur) and.push({ secteur: f.secteur });
  const espaces = await prisma.espace.findMany({
    where: { AND: and },
    include: INCLUDE_ESPACE_PLANNING,
    orderBy: [{ site: { position: "asc" } }, { position: "asc" }, { name: "asc" }],
  });
  return espaces.map((e) => ({ ...e, lectureSeule: !user.voitEspace(e.id) }));
}

/**
 * Tous les espaces du périmètre (pour le filtre), sans tenir compte de la sélection.
 * `consultation` : le périmètre de lecture (planning, liste des dossiers) plutôt que celui de
 * gestion (présences, saisie).
 */
export async function espacesDuPerimetre(user: CurrentUser, consultation = false) {
  const perimetre = consultation ? user.espacesVus : user.espacesGeres;
  return prisma.espace.findMany({
    where: {
      isActive: true,
      ...(perimetre.length ? { id: { in: perimetre } } : {}),
    },
    include: { site: true },
    orderBy: [{ site: { position: "asc" } }, { position: "asc" }, { name: "asc" }],
  });
}

/** Créneaux vivants et blocages des espaces sur la fenêtre. */
export async function occupationsPlanning(
  espaceIds: number[],
  fen: Fenetre,
): Promise<{ creneaux: EvtResa[]; blocages: Blocage[] }> {
  if (!espaceIds.length) return { creneaux: [], blocages: [] };
  const [creneaux, blocages] = await Promise.all([
    prisma.creneau.findMany({
      where: {
        espaceId: { in: espaceIds },
        status: "prevu",
        startAt: { lt: fen.a },
        endAt: { gt: fen.de },
        reservation: { status: { in: STATUTS_OCCUPANTS } },
      },
      include: {
        reservation: {
          select: {
            id: true,
            numero: true,
            title: true,
            status: true,
            serviceId: true,
            organisation: { select: { name: true, type: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.indisponibilite.findMany({
      where: { espaceId: { in: espaceIds }, startAt: { lt: fen.a }, endAt: { gt: fen.de } },
      orderBy: { startAt: "asc" },
    }),
  ]);
  return {
    creneaux: creneaux.map((c) => ({
      id: c.id,
      reservationId: c.reservation.id,
      numero: c.reservation.numero,
      titre: c.reservation.title,
      status: c.reservation.status,
      qui:
        c.reservation.organisation?.name ??
        (c.reservation.user
          ? `${c.reservation.user.firstName} ${c.reservation.user.lastName}`.trim()
          : ""),
      typeUsager: c.reservation.organisation?.type ?? null,
      serviceId: c.reservation.serviceId,
      espaceId: c.espaceId,
      startAt: c.startAt,
      endAt: c.endAt,
    })),
    blocages: blocages.map((b) => ({
      id: b.id,
      espaceId: b.espaceId,
      startAt: b.startAt,
      endAt: b.endAt,
      motif: b.motif,
    })),
  };
}

/** Les bornes d'un jour calendaire de Paris. */
export function bornesJour(jour: string): { startAt: Date; endAt: Date } {
  const startAt = parisMidnight(jour);
  return { startAt, endAt: addParisDays(startAt, 1) };
}

/** Les éléments qui touchent un jour (un créneau sur plusieurs jours apparaît chaque jour). */
export function duJour<T extends { startAt: Date; endAt: Date }>(items: T[], jour: string): T[] {
  const b = bornesJour(jour);
  return items.filter((i) => chevauche(i, b));
}

export function estWeekend(jour: string): boolean {
  const w = parisParts(parisMidnight(jour)).weekday;
  return w === 6 || w === 7;
}
