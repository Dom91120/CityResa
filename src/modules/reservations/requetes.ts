/**
 * Requêtes de la liste des réservations (page et export CSV) : onglets de statut,
 * périmètre de l'agent (ses espaces), filtres, recherche, tri, lignes CSV.
 */

import { trier } from "@/components/liste";
import type { Prisma } from "@/generated/prisma/client";
import {
  ORGANISATION_TYPES,
  RESERVATION_SOURCES,
  RESERVATION_STATUS,
  type ReservationStatus,
} from "@/lib/constantes";
import { nomRepresentant } from "@/lib/dossier-usager";
import { parseInt_ } from "@/lib/forms-util";
import { dateHeure, nomCourt } from "@/lib/libelles";
import { PERIODES, periode } from "@/lib/periodes";
import { prisma } from "@/server/db";
import type { CurrentUser } from "@/server/guards";
import { normaliser, type Params, param } from "@/server/paging";

// ── Périmètre ──

/** Un agent rattaché à des espaces ne voit que ceux-là ; vide = tous. */
export function perimetre(user: CurrentUser): Prisma.ReservationWhereInput {
  return user.espacesGeres.length ? { espaceId: { in: user.espacesGeres } } : {};
}

export function voitEspace(user: CurrentUser, espaceId: number): boolean {
  return user.espacesGeres.length === 0 || user.espacesGeres.includes(espaceId);
}

// ── Onglets ──

export type Onglet = {
  cle: string;
  label: string;
  statuts: ReservationStatus[];
  compteur: boolean;
};

const TOUS_SAUF_ARCHIVES = (Object.keys(RESERVATION_STATUS) as ReservationStatus[]).filter(
  (s) => s !== "archivee",
);

export const ONGLETS: Onglet[] = [
  { cle: "", label: "Toutes", statuts: TOUS_SAUF_ARCHIVES, compteur: false },
  { cle: "a_traiter", label: "À traiter", statuts: ["a_traiter", "en_traitement"], compteur: true },
  { cle: "signature", label: "Signature", statuts: ["acceptee", "signee"], compteur: true },
  { cle: "confirmee", label: "Confirmées", statuts: ["confirmee"], compteur: false },
  { cle: "terminee", label: "Terminées", statuts: ["terminee"], compteur: false },
  {
    cle: "refusee",
    label: "Refusées / annulées",
    statuts: ["refusee", "annulee"],
    compteur: false,
  },
  { cle: "archivee", label: "Archivées", statuts: ["archivee"], compteur: false },
];

/** L'onglet d'une clé ; un statut brut (?statut=annulee, liens du tableau de bord) est admis. */
export function ongletDe(cle: string): { onglet: Onglet; statuts: ReservationStatus[] } {
  const o = ONGLETS.find((x) => x.cle === cle);
  if (o) return { onglet: o, statuts: o.statuts };
  if (cle in RESERVATION_STATUS) {
    const s = cle as ReservationStatus;
    const parent = ONGLETS.find((x) => x.cle && x.statuts.includes(s)) ?? ONGLETS[0];
    return { onglet: parent, statuts: [s] };
  }
  return { onglet: ONGLETS[0], statuts: ONGLETS[0].statuts };
}

// ── Filtres ──

export type Filtres = {
  statut: string;
  site: number | null;
  espace: number | null;
  type: string;
  agent: string;
  periode: string;
  /** « retard » : cautions encaissées non clôturées après le délai ; « a_valider » : retenues à valider. */
  caution: string;
  q: string;
  vue: "cartes" | "table";
  tri: string;
  sens: "asc" | "desc" | "";
};

export function lireFiltres(params: Params): Filtres {
  const type = param(params, "type") ?? "";
  const per = param(params, "periode") ?? "";
  let tri = (param(params, "tri") ?? "").trim();
  let sens = (param(params, "sens") ?? "").trim();
  // Le sélecteur de tri des cartes envoie « colonne:sens » en une seule valeur.
  if (tri.includes(":")) [tri, sens] = tri.split(":");
  return {
    statut: (param(params, "statut") ?? "").trim(),
    site: parseInt_(param(params, "site"), null, 1),
    espace: parseInt_(param(params, "espace"), null, 1),
    type: type in ORGANISATION_TYPES ? type : "",
    agent: (param(params, "agent") ?? "").trim(),
    periode: PERIODES.some(([k]) => k === per) ? per : "",
    caution: ["retard", "a_valider"].includes(param(params, "caution") ?? "")
      ? (param(params, "caution") as string)
      : "",
    q: (param(params, "q") ?? "").trim(),
    vue: param(params, "vue") === "table" ? "table" : "cartes",
    tri,
    sens: sens === "asc" || sens === "desc" ? sens : "",
  };
}

/** La clause WHERE des filtres (hors statut), périmètre compris. */
export function whereListe(f: Filtres, user: CurrentUser): Prisma.ReservationWhereInput {
  const and: Prisma.ReservationWhereInput[] = [];
  const per = perimetre(user);
  if (Object.keys(per).length) and.push(per);
  if (f.espace) and.push({ espaceId: f.espace });
  if (f.site) and.push({ espace: { siteId: f.site } });
  if (f.type) {
    and.push(
      f.type === "particulier"
        ? { OR: [{ organisation: { type: "particulier" } }, { organisationId: null }] }
        : { organisation: { type: f.type } },
    );
  }
  if (f.agent) and.push(f.agent === "aucun" ? { agentId: null } : { agentId: f.agent });
  if (f.periode) {
    const p = periode(f.periode);
    and.push({ startAt: { lt: p.a }, endAt: { gt: p.de } });
  }
  if (f.caution === "retard")
    and.push({
      cautionStatus: "encaissee",
      endAt: {
        lt: new Date(
          Date.now() - (user.settings.CAUTION_DELAI_RESTITUTION_JOURS || 30) * 86_400_000,
        ),
      },
    });
  if (f.caution === "a_valider") and.push({ cautionStatus: "retenue_a_valider" });
  return and.length ? { AND: and } : {};
}

export const INCLUDE_LISTE = {
  espace: {
    include: {
      site: true,
      nature: true,
      documents: { where: { kind: "photo" }, orderBy: { position: "asc" as const }, take: 1 },
    },
  },
  organisation: true,
  user: true,
  agent: true,
  nature: true,
  _count: { select: { creneaux: { where: { status: "prevu" } } } },
} satisfies Prisma.ReservationInclude;

export type ReservationListe = Prisma.ReservationGetPayload<{ include: typeof INCLUDE_LISTE }>;

/** Le nom du demandeur : l'organisation, sinon la personne. */
export function demandeurDe(r: {
  organisation: { name: string } | null;
  user: { firstName: string; lastName: string } | null;
}): string {
  return (
    r.organisation?.name ?? (r.user ? `${r.user.firstName} ${r.user.lastName}`.trim() : "") ?? ""
  );
}

/** Le contact humain : la personne du compte, sinon le responsable de l'organisation. */
export function contactDe(r: {
  organisation: { legalFirstName: string | null; legalLastName: string | null } | null;
  user: { firstName: string; lastName: string } | null;
}): string {
  if (r.user) return `${r.user.firstName} ${r.user.lastName}`.trim();
  return (r.organisation ? nomRepresentant(r.organisation) : null) ?? "l'usager";
}

function texteRecherche(r: ReservationListe): string {
  return [
    r.numero,
    r.title,
    r.organisation?.name,
    r.user ? `${r.user.firstName} ${r.user.lastName}` : "",
    r.user?.email,
    r.espace.name,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Les dossiers de l'onglet courant (filtrés, recherchés) et le compteur de chaque onglet. */
export async function chargerListe(
  f: Filtres,
  user: CurrentUser,
): Promise<{ rows: ReservationListe[]; onglet: Onglet; compteurs: Record<string, number> }> {
  const base = whereListe(f, user);
  const { onglet, statuts } = ongletDe(f.statut);
  const [rows, groupes] = await Promise.all([
    prisma.reservation.findMany({
      where: { AND: [base, { status: { in: statuts } }] },
      include: INCLUDE_LISTE,
    }),
    prisma.reservation.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
  ]);
  const parStatut: Record<string, number> = {};
  for (const g of groupes) parStatut[g.status] = g._count._all;
  const compteurs: Record<string, number> = {};
  for (const o of ONGLETS)
    compteurs[o.cle] = o.statuts.reduce((s, st) => s + (parStatut[st] ?? 0), 0);
  const q = normaliser(f.q);
  const filtres = q ? rows.filter((r) => normaliser(texteRecherche(r)).includes(q)) : rows;
  return { rows: filtres, onglet, compteurs };
}

// ── Tri ──

const ORDRE_STATUT = Object.keys(RESERVATION_STATUS);

export const COLONNES_TRI: Record<
  string,
  (r: ReservationListe) => string | number | Date | null | undefined
> = {
  date: (r) => r.startAt,
  creee: (r) => r.createdAt,
  numero: (r) => r.numero,
  titre: (r) => r.title,
  espace: (r) => r.espace.name,
  organisation: (r) => demandeurDe(r),
  statut: (r) => ORDRE_STATUT.indexOf(r.status),
  montant: (r) => r.montantTtc,
  agent: (r) => (r.agent ? `${r.agent.firstName} ${r.agent.lastName}` : null),
};

/** Les tris proposés dans la vue cartes (« colonne:sens »). */
export const TRIS: [string, string][] = [
  ["date:desc", "Événement : le plus récent d'abord"],
  ["date:asc", "Événement : le plus proche d'abord"],
  ["creee:desc", "Dépôt : le plus récent d'abord"],
  ["creee:asc", "Dépôt : le plus ancien d'abord"],
  ["numero:desc", "Numéro de dossier"],
  ["titre:asc", "Titre"],
  ["espace:asc", "Espace"],
  ["organisation:asc", "Demandeur"],
  ["montant:desc", "Montant"],
];

/** Tri par défaut : les demandes à traiter du plus ancien dépôt au plus récent, sinon par date d'événement. */
export function triDefaut(onglet: Onglet): [string, "asc" | "desc"] {
  return onglet.cle === "a_traiter" ? ["creee", "asc"] : ["date", "desc"];
}

export function trierListe(rows: ReservationListe[], f: Filtres, onglet: Onglet) {
  const [col, sens] = triDefaut(onglet);
  const sp = new URLSearchParams();
  if (f.tri && COLONNES_TRI[f.tri]) {
    sp.set("tri", f.tri);
    sp.set("sens", f.sens || "asc");
  }
  return trier(rows, sp, COLONNES_TRI, col, sens);
}

// ── Options des filtres ──

export async function optionsFiltres(user: CurrentUser): Promise<{
  sites: [string, string][];
  espaces: [string, string][];
  agents: [string, string][];
}> {
  const [sites, espaces, agents] = await Promise.all([
    prisma.site.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    prisma.espace.findMany({
      where: {
        isActive: true,
        ...(user.espacesGeres.length ? { id: { in: user.espacesGeres } } : {}),
      },
      include: { site: true },
      orderBy: [{ site: { position: "asc" } }, { position: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { kind: "agent", isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);
  return {
    sites: sites.map((s) => [String(s.id), s.name]),
    espaces: espaces.map((e) => [String(e.id), `${nomCourt(e)} · ${e.site.name}`]),
    agents: [
      ...agents.map((a): [string, string] => [
        a.id,
        `${a.firstName} ${a.lastName}`.trim() || a.email,
      ]),
      ["aucun", "Non assignées"],
    ],
  };
}

// ── Export CSV ──

export function lignesCsv(rows: ReservationListe[]): (string | number | null)[][] {
  const entete = [
    "Numéro",
    "Titre",
    "Statut",
    "Espace",
    "Site",
    "Organisation",
    "Type",
    "Demandeur",
    "Courriel",
    "Début",
    "Fin",
    "Créneaux",
    "Participants",
    "Nature",
    "Montant HT",
    "Montant TTC",
    "Acompte",
    "Caution",
    "Gratuité",
    "Source",
    "Agent",
    "Créée le",
  ];
  return [
    entete,
    ...rows.map((r) => [
      r.numero,
      r.title,
      RESERVATION_STATUS[r.status as ReservationStatus]?.label ?? r.status,
      r.espace.name,
      r.espace.site.name,
      r.organisation?.name ?? "",
      r.organisation
        ? (ORGANISATION_TYPES[r.organisation.type] ?? r.organisation.type)
        : "Particulier",
      contactDe(r),
      r.user?.email ?? r.organisation?.email ?? "",
      dateHeure(r.startAt),
      dateHeure(r.endAt),
      r._count.creneaux,
      r.participants ?? "",
      r.nature?.label ?? "",
      r.montantHt,
      r.montantTtc,
      r.acompte,
      r.caution,
      r.gratuit ? "oui" : "non",
      RESERVATION_SOURCES[r.source] ?? r.source,
      r.agent ? `${r.agent.firstName} ${r.agent.lastName}`.trim() : "",
      dateHeure(r.createdAt),
    ]),
  ];
}
