/**
 * Statistiques du back-office : la période (PERIODES ou bornes libres ?de=&a=), les
 * indicateurs, les séries des graphiques, les classements et la grille jour × tranche
 * horaire. Le chargement est regroupé dans `chargerStatistiques` ; les calculs sont des
 * fonctions pures sur les lignes chargées.
 */
import type { Prisma } from "@/generated/prisma/client";
import {
  ORGANISATION_TYPES,
  RESERVATION_SOURCES,
  RESERVATION_STATUS,
  STATUTS_FERMES,
} from "@/lib/constantes";
import { dateCourte, dateHeure, NOMS_JOURS_COURTS } from "@/lib/libelles";
import {
  addParisDays,
  ENTRE_HEURES,
  parisMidnight,
  parisParts,
  toParisWall,
} from "@/lib/paris-time";
import { type Periode, periode, precedente } from "@/lib/periodes";
import { type ResumePresences, resumePresences } from "@/lib/presences";
import {
  indicateurs,
  occupationParEspace,
  repartitionUsagers,
  revenusParMois,
} from "@/server/dashboard";
import { prisma } from "@/server/db";
import { type Params, param } from "@/server/paging";
import { STATUTS_CONSTATABLES } from "@/server/presences";
import { deviser } from "@/server/reservations";

/** Statuts comptés comme « réservation effective » (l'espace a été ou sera occupé). */
export const STATUTS_EFFECTIFS: string[] = [...STATUTS_FERMES, "terminee"];
/** Statuts d'une demande acceptée (pour le taux d'acceptation). */
const STATUTS_ACCEPTES: string[] = ["acceptee", "signee", "confirmee", "terminee", "archivee"];

// ── Période ──

/** ?periode=mois|trimestre|… ou bornes libres ?de=YYYY-MM-DD&a=YYYY-MM-DD (incluses). */
export function periodeDepuisParams(params: Params, now = new Date()): Periode {
  const de = (param(params, "de") ?? "").trim();
  const a = (param(params, "a") ?? "").trim();
  const ok = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (ok(de) && ok(a)) {
    let debut = parisMidnight(de);
    let fin = addParisDays(parisMidnight(a), 1);
    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime()))
      return periode(param(params, "periode"), now);
    if (fin <= debut) [debut, fin] = [fin, debut];
    return {
      de: debut,
      a: fin,
      label: `du ${dateCourte(debut)} au ${dateCourte(new Date(fin.getTime() - 1))}`,
      cle: "libre",
    };
  }
  return periode(param(params, "periode"), now);
}

/** « YYYY-MM-DD » des bornes (pour préremplir les champs de dates). */
export function bornesIso(p: Periode): { de: string; a: string } {
  const w1 = toParisWall(p.de);
  const w2 = toParisWall(new Date(p.a.getTime() - 1));
  const f = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { de: f(w1.y, w1.mo, w1.da), a: f(w2.y, w2.mo, w2.da) };
}

// ── Chargement ──

export const INCLUDE_STATS = {
  espace: { select: { id: true, name: true, color: true, site: { select: { name: true } } } },
  organisation: { select: { id: true, name: true, type: true, profilId: true } },
  user: { select: { firstName: true, lastName: true } },
  nature: { select: { label: true } },
  creneaux: {
    select: {
      startAt: true,
      endAt: true,
      status: true,
      presence: true,
      realStartAt: true,
      realEndAt: true,
    },
  },
  options: { select: { optionId: true, quantite: true } },
  materiels: { select: { materielId: true, quantite: true } },
} satisfies Prisma.ReservationInclude;

export type ResaStat = Prisma.ReservationGetPayload<{ include: typeof INCLUDE_STATS }>;

export type PaiementStat = {
  montant: number;
  paidAt: Date;
  facture: {
    organisationId: number | null;
    reservation: { espaceId: number; organisationId: number | null } | null;
  };
};

export async function chargerStatistiques(p: Periode, now = new Date()) {
  const prec = precedente(p);
  const [kpi, occupation, usagers, mois, reservations, paiements, presences] = await Promise.all([
    indicateurs(p, prec),
    occupationParEspace(p),
    repartitionUsagers(p),
    revenusParMois(p.a > now ? now : p.a),
    prisma.reservation.findMany({
      where: { startAt: { gte: p.de, lt: p.a } },
      include: INCLUDE_STATS,
      orderBy: { startAt: "asc" },
    }),
    prisma.paiement.findMany({
      where: { paidAt: { gte: p.de, lt: p.a }, facture: { type: { not: "caution" } } },
      select: {
        montant: true,
        paidAt: true,
        facture: {
          select: {
            organisationId: true,
            reservation: { select: { espaceId: true, organisationId: true } },
          },
        },
      },
    }),
    chargerPresences(p, now),
  ]);
  const gracieux = await valeurGracieuse(reservations);
  return { p, prec, kpi, occupation, usagers, mois, reservations, paiements, gracieux, presences };
}

export type Stats = Awaited<ReturnType<typeof chargerStatistiques>>;

/**
 * La valeur des mises à disposition gracieuses : ce qu'auraient coûté, au tarif de
 * l'usager, les réservations accordées gratuitement (indicateur « aide en nature aux
 * associations » du cahier des charges).
 */
export async function valeurGracieuse(rows: ResaStat[]): Promise<{
  total: number;
  nb: number;
  parOrganisation: { nom: string; id: number | null; valeur: number }[];
}> {
  const gratuites = rows.filter((r) => r.gratuit && STATUTS_EFFECTIFS.includes(r.status));
  let total = 0;
  const parOrg = new Map<string, { nom: string; id: number | null; valeur: number }>();
  for (const r of gratuites) {
    const creneaux = r.creneaux.filter((c) => c.status === "prevu");
    if (!creneaux.length) continue;
    try {
      const d = await deviser(
        r.espaceId,
        r.organisation?.profilId ?? null,
        creneaux,
        r.options.map((o) => ({ optionId: o.optionId, quantite: o.quantite })),
        r.materiels.map((m) => ({ materielId: m.materielId, quantite: m.quantite })),
        false,
      );
      total += d.ttc;
      const cle = r.organisation ? `o${r.organisation.id}` : "particuliers";
      const e = parOrg.get(cle) ?? {
        nom: r.organisation?.name ?? "Particuliers",
        id: r.organisation?.id ?? null,
        valeur: 0,
      };
      e.valeur += d.ttc;
      parOrg.set(cle, e);
    } catch (e) {
      console.error("[statistiques] devis théorique impossible :", r.numero, e);
    }
  }
  return {
    total: Math.round(total * 100) / 100,
    nb: gratuites.length,
    parOrganisation: [...parOrg.values()]
      .map((x) => ({ ...x, valeur: Math.round(x.valeur * 100) / 100 }))
      .sort((a, b) => b.valeur - a.valeur),
  };
}

// ── Calculs purs ──

function heuresDans(c: { startAt: Date; endAt: Date }, p: Periode): number {
  const d =
    Math.min(c.endAt.getTime(), p.a.getTime()) - Math.max(c.startAt.getTime(), p.de.getTime());
  return d > 0 ? d / 36e5 : 0;
}

/** Heures d'un dossier (créneaux prévus), bornées à la période. */
export function heuresDossier(r: ResaStat, p: Periode): number {
  return r.creneaux.filter((c) => c.status === "prevu").reduce((s, c) => s + heuresDans(c, p), 0);
}

/** Taux d'acceptation : acceptées / (acceptées + refusées), en %. null si rien à décider. */
export function tauxAcceptation(rows: { status: string }[]): number | null {
  const acc = rows.filter((r) => STATUTS_ACCEPTES.includes(r.status)).length;
  const ref = rows.filter((r) => r.status === "refusee").length;
  return acc + ref ? Math.round((acc / (acc + ref)) * 1000) / 10 : null;
}

/** Délai moyen de traitement (jours entre la demande et la décision). */
export function delaiMoyen(
  rows: { createdAt: Date; decisionAt: Date | null; decisionBy: string | null }[],
): number | null {
  const d = rows.filter((r) => r.decisionAt && r.decisionBy !== "automatique");
  if (!d.length) return null;
  const total = d.reduce(
    (s, r) => s + ((r.decisionAt as Date).getTime() - r.createdAt.getTime()) / 86_400_000,
    0,
  );
  return Math.round((total / d.length) * 10) / 10;
}

/** Le bilan des présences constatées sur les créneaux passés de la période (dossiers acquis). */
export async function chargerPresences(p: Periode, now = new Date()): Promise<ResumePresences> {
  const creneaux = await prisma.creneau.findMany({
    where: {
      status: "prevu",
      startAt: { gte: p.de, lt: p.a },
      reservation: { status: { in: STATUTS_CONSTATABLES } },
    },
    select: {
      startAt: true,
      endAt: true,
      status: true,
      presence: true,
      realStartAt: true,
      realEndAt: true,
    },
  });
  return resumePresences(creneaux, now);
}

export function heuresReservees(rows: ResaStat[], p: Periode): number {
  const h = rows
    .filter((r) => STATUTS_EFFECTIFS.includes(r.status))
    .reduce((s, r) => s + heuresDossier(r, p), 0);
  return Math.round(h * 10) / 10;
}

export function revenusEncaisses(paiements: { montant: number }[]): number {
  return Math.round(paiements.reduce((s, x) => s + x.montant, 0) * 100) / 100;
}

/** Répartition par nature d'événement (réservations effectives). */
export function parNature(rows: ResaStat[]): { label: string; nb: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!STATUTS_EFFECTIFS.includes(r.status)) continue;
    const k = r.nature?.label ?? "Non précisée";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, nb]) => ({ label, nb })).sort((a, b) => b.nb - a.nb);
}

/** Réservations par statut, dans l'ordre du cycle de vie. */
export function parStatut(
  rows: { status: string }[],
): { cle: string; label: string; nb: number }[] {
  return Object.entries(RESERVATION_STATUS)
    .map(([cle, s]) => ({ cle, label: s.label, nb: rows.filter((r) => r.status === cle).length }))
    .filter((x) => x.nb > 0);
}

export type TopEspace = {
  id: number;
  nom: string;
  site: string;
  couleur: string;
  heures: number;
  nb: number;
  revenus: number;
};

export function topEspaces(rows: ResaStat[], paiements: PaiementStat[], p: Periode, n = 10) {
  const m = new Map<number, TopEspace>();
  for (const r of rows) {
    if (!STATUTS_EFFECTIFS.includes(r.status)) continue;
    const e = m.get(r.espaceId) ?? {
      id: r.espaceId,
      nom: r.espace.name,
      site: r.espace.site.name,
      couleur: r.espace.color,
      heures: 0,
      nb: 0,
      revenus: 0,
    };
    e.heures += heuresDossier(r, p);
    e.nb += 1;
    m.set(r.espaceId, e);
  }
  for (const pm of paiements) {
    const eid = pm.facture.reservation?.espaceId;
    if (!eid) continue;
    const e = m.get(eid);
    if (e) e.revenus += pm.montant;
  }
  return [...m.values()]
    .map((e) => ({
      ...e,
      heures: Math.round(e.heures * 10) / 10,
      revenus: Math.round(e.revenus * 100) / 100,
    }))
    .sort((a, b) => b.heures - a.heures || b.nb - a.nb)
    .slice(0, n);
}

export type TopOrganisation = {
  id: number | null;
  nom: string;
  type: string;
  nb: number;
  heures: number;
  montant: number;
  gratuites: number;
};

export function topOrganisations(rows: ResaStat[], p: Periode, n = 10): TopOrganisation[] {
  const m = new Map<string, TopOrganisation>();
  for (const r of rows) {
    if (!STATUTS_EFFECTIFS.includes(r.status)) continue;
    const cle = r.organisation ? `o${r.organisation.id}` : "particuliers";
    const e = m.get(cle) ?? {
      id: r.organisation?.id ?? null,
      nom: r.organisation?.name ?? "Particuliers (sans organisation)",
      type: r.organisation?.type ?? "particulier",
      nb: 0,
      heures: 0,
      montant: 0,
      gratuites: 0,
    };
    e.nb += 1;
    e.heures += heuresDossier(r, p);
    e.montant += r.montantTtc;
    if (r.gratuit) e.gratuites += 1;
    m.set(cle, e);
  }
  return [...m.values()]
    .map((e) => ({
      ...e,
      heures: Math.round(e.heures * 10) / 10,
      montant: Math.round(e.montant * 100) / 100,
    }))
    .sort((a, b) => b.nb - a.nb || b.heures - a.heures)
    .slice(0, n);
}

/** Les tranches horaires de la grille (début inclus, fin exclue, en heures). */
export const TRANCHES: [number, number][] = [
  [0, 8],
  [8, 10],
  [10, 12],
  [12, 14],
  [14, 16],
  [16, 18],
  [18, 20],
  [20, 22],
  [22, 24],
];

export type Heatmap = { jours: string[]; tranches: string[]; valeurs: number[][]; max: number };

/** Heures réservées par jour de semaine (lignes) et tranche horaire (colonnes). */
export function heatmap(rows: ResaStat[], p: Periode): Heatmap {
  const valeurs = TRANCHES.map(() => Array(7).fill(0) as number[]);
  for (const r of rows) {
    if (!STATUTS_EFFECTIFS.includes(r.status)) continue;
    for (const c of r.creneaux) {
      if (c.status !== "prevu") continue;
      const debut = Math.max(c.startAt.getTime(), p.de.getTime());
      const fin = Math.min(c.endAt.getTime(), p.a.getTime());
      // On avance par pas de 30 minutes : chaque pas compte pour une demi-heure.
      for (let t = debut; t < fin; t += 1_800_000) {
        const parts = parisParts(new Date(t));
        const h = parts.min / 60;
        const ti = TRANCHES.findIndex(([a, b]) => h >= a && h < b);
        if (ti >= 0) valeurs[ti][parts.weekday - 1] += 0.5;
      }
    }
  }
  const max = Math.max(0, ...valeurs.flat());
  return {
    jours: NOMS_JOURS_COURTS,
    tranches: TRANCHES.map(([a, b]) => `${a}h${ENTRE_HEURES}${b === 24 ? "minuit" : `${b}h`}`),
    valeurs,
    max,
  };
}

/** Les colonnes de l'export (CSV et XLSX) des réservations de la période. */
export const COLONNES_EXPORT: { cle: string; label: string; largeur: number }[] = [
  { cle: "numero", label: "Numéro", largeur: 16 },
  { cle: "titre", label: "Objet", largeur: 36 },
  { cle: "statut", label: "Statut", largeur: 14 },
  { cle: "espace", label: "Espace", largeur: 24 },
  { cle: "site", label: "Site", largeur: 22 },
  { cle: "organisation", label: "Organisation", largeur: 28 },
  { cle: "typeOrganisation", label: "Type d'usager", largeur: 18 },
  { cle: "demandeur", label: "Demandeur", largeur: 22 },
  { cle: "nature", label: "Nature", largeur: 20 },
  { cle: "debut", label: "Début", largeur: 18 },
  { cle: "fin", label: "Fin", largeur: 18 },
  { cle: "creneaux", label: "Créneaux", largeur: 10 },
  { cle: "heures", label: "Heures", largeur: 10 },
  { cle: "participants", label: "Participants", largeur: 12 },
  { cle: "montantHt", label: "Montant HT", largeur: 12 },
  { cle: "montantTtc", label: "Montant TTC", largeur: 12 },
  { cle: "gratuit", label: "Gratuit", largeur: 9 },
  { cle: "source", label: "Source", largeur: 12 },
  { cle: "creeeLe", label: "Demande déposée le", largeur: 18 },
  { cle: "decisionLe", label: "Décision le", largeur: 18 },
  { cle: "delai", label: "Délai (j)", largeur: 10 },
];

export function ligneExport(r: ResaStat, p: Periode): Record<string, string | number> {
  const prevus = r.creneaux.filter((c) => c.status === "prevu").length;
  return {
    numero: r.numero,
    titre: r.title,
    statut: RESERVATION_STATUS[r.status as keyof typeof RESERVATION_STATUS]?.label ?? r.status,
    espace: r.espace.name,
    site: r.espace.site.name,
    organisation: r.organisation?.name ?? "",
    typeOrganisation: ORGANISATION_TYPES[r.organisation?.type ?? "particulier"] ?? "",
    demandeur: r.user ? `${r.user.firstName} ${r.user.lastName}`.trim() : "",
    nature: r.nature?.label ?? "",
    debut: dateHeure(r.startAt),
    fin: dateHeure(r.endAt),
    creneaux: prevus,
    heures: Math.round(heuresDossier(r, p) * 10) / 10,
    participants: r.participants ?? "",
    montantHt: r.montantHt,
    montantTtc: r.montantTtc,
    gratuit: r.gratuit ? "oui" : "non",
    source: RESERVATION_SOURCES[r.source] ?? r.source,
    creeeLe: dateCourte(r.createdAt),
    decisionLe: r.decisionAt ? dateCourte(r.decisionAt) : "",
    delai: r.decisionAt
      ? Math.round(((r.decisionAt.getTime() - r.createdAt.getTime()) / 86_400_000) * 10) / 10
      : "",
  };
}

export function lignesCsv(rows: ResaStat[], p: Periode): (string | number)[][] {
  return [
    COLONNES_EXPORT.map((c) => c.label),
    ...rows.map((r) => {
      const l = ligneExport(r, p);
      return COLONNES_EXPORT.map((c) => l[c.cle]);
    }),
  ];
}
