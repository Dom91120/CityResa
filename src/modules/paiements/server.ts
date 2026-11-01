/**
 * Module PAIEMENTS : lecture des factures et de leurs règlements, filtres de la liste,
 * cartes de synthèse, facture libre (hors réservation). La création des factures d'un
 * dossier, l'encaissement et l'annulation vivent dans src/server/factures.ts.
 */
import type { Prisma } from "@/generated/prisma/client";
import { FACTURE_STATUS, FACTURE_TYPES, PAIEMENT_MODES } from "@/lib/constantes";
import { parseYmdUtc } from "@/lib/date-utc";
import { champ, champOuNull, coche, idOuNull, parseDate, parseFloat_ } from "@/lib/forms-util";
import { dateCourte, montant } from "@/lib/libelles";
import { parisDateTimeToInstant, todayParisISO } from "@/lib/paris-time";
import { type Periode, periode } from "@/lib/periodes";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { pdfFacture } from "@/server/factures";
import type { CurrentUser } from "@/server/guards";
import { envoyerDepuisModele } from "@/server/mailer";
import { invalidateNavCounts } from "@/server/nav";
import { prochainNumero } from "@/server/numerotation";
import { normaliser, type Params, param } from "@/server/paging";
import { variablesDossier } from "@/server/reservations";

export const INCLUDE_FACTURE_LISTE = {
  paiements: { select: { id: true, montant: true, paidAt: true, mode: true } },
  reservation: {
    select: {
      id: true,
      numero: true,
      title: true,
      espace: { select: { name: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      organisation: { select: { id: true, name: true } },
    },
  },
  organisation: {
    select: { id: true, name: true, type: true, email: true, legalFirstName: true },
  },
} satisfies Prisma.FactureInclude;

export type FactureLigne = Prisma.FactureGetPayload<{ include: typeof INCLUDE_FACTURE_LISTE }>;

/** Teinte de la pastille d'un type de facture. */
export const FACTURE_TYPE_TEINTES: Record<string, string> = {
  acompte: "sky",
  solde: "rose",
  caution: "amber",
  avoir: "violet",
};

/** Toutes les factures (liste, synthèse et export). */
export async function chargerFactures(): Promise<FactureLigne[]> {
  return prisma.facture.findMany({
    include: INCLUDE_FACTURE_LISTE,
    orderBy: { createdAt: "desc" },
  });
}

// ── Calculs purs ──

export function payeDe(f: { paiements: { montant: number }[] }): number {
  return Math.round(f.paiements.reduce((s, p) => s + p.montant, 0) * 100) / 100;
}

/** Ce qu'il reste à régler (0 pour une facture annulée ou soldée). */
export function resteDe(f: {
  status: string;
  montantTtc: number;
  paiements: { montant: number }[];
}) {
  if (f.status === "annulee" || f.status === "remboursee") return 0;
  return Math.max(0, Math.round((f.montantTtc - payeDe(f)) * 100) / 100);
}

/** La date du jour (heure de Paris) à minuit UTC, comparable à `dueAt` (@db.Date). */
export function aujourdhuiUtc(now = new Date()): Date {
  return parseYmdUtc(todayParisISO(now));
}

export function enRetard(
  f: { status: string; dueAt: Date | null },
  aujourdhui: Date = aujourdhuiUtc(),
): boolean {
  return f.status === "a_payer" && f.dueAt !== null && f.dueAt < aujourdhui;
}

/** Qui doit payer : l'organisation (lien vers sa fiche) ou le demandeur. */
export function debiteur(f: FactureLigne): { nom: string; href: string | null; detail: string } {
  const org = f.organisation ?? f.reservation?.organisation;
  if (org) {
    const contact = f.reservation?.user;
    return {
      nom: org.name,
      href: `/usagers/${org.id}`,
      detail: contact ? `${contact.firstName} ${contact.lastName}`.trim() : "",
    };
  }
  const u = f.reservation?.user;
  if (u) return { nom: `${u.firstName} ${u.lastName}`.trim() || u.email, href: null, detail: "" };
  return { nom: "—", href: null, detail: "" };
}

export type FiltresFactures = {
  statut: string;
  type: string;
  periode: string;
  organisation: number | null;
  q: string;
};

export const ONGLETS_FACTURES: [string, string][] = [
  ["a_payer", "À payer"],
  ["retard", "En retard"],
  ["payee", "Payées"],
  ["annulee", "Annulées"],
  ["", "Toutes"],
];

export function lireFiltres(params: Params): FiltresFactures {
  const org = Number.parseInt(param(params, "organisation") ?? "", 10);
  return {
    statut: (param(params, "statut") ?? "").trim(),
    type: (param(params, "type") ?? "").trim(),
    periode: (param(params, "periode") ?? "").trim(),
    organisation: Number.isInteger(org) && org > 0 ? org : null,
    q: (param(params, "q") ?? "").trim(),
  };
}

function texteDe(f: FactureLigne): string {
  const d = debiteur(f);
  return normaliser(
    [f.numero, f.libelle, f.reservation?.numero, f.reservation?.title, d.nom, d.detail]
      .filter(Boolean)
      .join(" "),
  );
}

/** Applique l'onglet, les filtres et la recherche. */
export function filtrerFactures(
  factures: FactureLigne[],
  fl: FiltresFactures,
  now = new Date(),
): FactureLigne[] {
  const auj = aujourdhuiUtc(now);
  const p = fl.periode ? periode(fl.periode, now) : null;
  const ql = fl.q ? normaliser(fl.q) : "";
  return factures.filter((f) => {
    if (fl.statut === "retard") {
      if (!enRetard(f, auj)) return false;
    } else if (fl.statut && f.status !== fl.statut) return false;
    if (fl.type && f.type !== fl.type) return false;
    if (p && !(f.createdAt >= p.de && f.createdAt < p.a)) return false;
    if (fl.organisation) {
      const orgId = f.organisationId ?? f.reservation?.organisation?.id ?? null;
      if (orgId !== fl.organisation) return false;
    }
    if (ql && !texteDe(f).includes(ql)) return false;
    return true;
  });
}

/** Les compteurs des onglets (sans l'onglet courant ni la recherche). */
export function compterOnglets(
  factures: FactureLigne[],
  fl: FiltresFactures,
  now = new Date(),
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [cle] of ONGLETS_FACTURES)
    out[cle] = filtrerFactures(factures, { ...fl, statut: cle, q: "" }, now).length;
  return out;
}

export type SyntheseFactures = {
  aEncaisser: number;
  nbAEncaisser: number;
  retard: number;
  nbRetard: number;
  encaisse: number;
  nbPaiements: number;
  nb: number;
};

/** Les cartes du haut de la liste. */
export function synthese(factures: FactureLigne[], p: Periode, now = new Date()): SyntheseFactures {
  const auj = aujourdhuiUtc(now);
  const s: SyntheseFactures = {
    aEncaisser: 0,
    nbAEncaisser: 0,
    retard: 0,
    nbRetard: 0,
    encaisse: 0,
    nbPaiements: 0,
    nb: factures.length,
  };
  for (const f of factures) {
    if (f.status === "a_payer") {
      const reste = resteDe(f);
      s.aEncaisser += reste;
      s.nbAEncaisser += 1;
      if (enRetard(f, auj)) {
        s.retard += reste;
        s.nbRetard += 1;
      }
    }
    if (f.status === "annulee" || f.type === "caution") continue;
    for (const pm of f.paiements) {
      if (pm.paidAt >= p.de && pm.paidAt < p.a) {
        s.encaisse += pm.montant;
        s.nbPaiements += 1;
      }
    }
  }
  s.aEncaisser = Math.round(s.aEncaisser * 100) / 100;
  s.retard = Math.round(s.retard * 100) / 100;
  s.encaisse = Math.round(s.encaisse * 100) / 100;
  return s;
}

/** Les organisations qui ont au moins une facture (filtre). */
export function organisationsDe(factures: FactureLigne[]): [string, string][] {
  const m = new Map<number, string>();
  for (const f of factures) {
    const org = f.organisation ?? f.reservation?.organisation;
    if (org) m.set(org.id, org.name);
  }
  return [...m.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "fr"))
    .map(([id, nom]) => [String(id), nom]);
}

/** Les lignes de l'export CSV. */
export function lignesCsv(factures: FactureLigne[], now = new Date()): (string | number)[][] {
  const auj = aujourdhuiUtc(now);
  const rows: (string | number)[][] = [
    [
      "Numéro",
      "Type",
      "Statut",
      "En retard",
      "Libellé",
      "Dossier",
      "Objet du dossier",
      "Débiteur",
      "Montant HT",
      "TVA",
      "Montant TTC",
      "Payé",
      "Reste",
      "Émise le",
      "Échéance",
      "Payée le",
      "Créée par",
    ],
  ];
  for (const f of factures) {
    rows.push([
      f.numero,
      FACTURE_TYPES[f.type] ?? f.type,
      FACTURE_STATUS[f.status]?.label ?? f.status,
      enRetard(f, auj) ? "oui" : "non",
      f.libelle,
      f.reservation?.numero ?? "",
      f.reservation?.title ?? "",
      debiteur(f).nom,
      f.montantHt,
      f.tva,
      f.montantTtc,
      payeDe(f),
      resteDe(f),
      dateCourte(f.createdAt),
      f.dueAt ? dateCourte(f.dueAt) : "",
      f.paidAt ? dateCourte(f.paidAt) : "",
      f.createdBy ?? "",
    ]);
  }
  return rows;
}

// ── Lecture des formulaires ──

export type PaiementEntree = {
  montant: number;
  mode: string;
  reference: string | null;
  paidAt: Date | null;
};

export function lirePaiement(form: FormData): PaiementEntree {
  const m = parseFloat_(form.get("montant"), null);
  if (m === null || !(m > 0)) throw new UserFacingError("Indiquez un montant supérieur à zéro.");
  const mode = champ(form, "mode");
  if (!(mode in PAIEMENT_MODES)) throw new UserFacingError("Choisissez un mode de paiement.");
  const date = champ(form, "date");
  let paidAt: Date | null = null;
  if (date && date !== todayParisISO()) {
    paidAt = parisDateTimeToInstant(date, "12:00");
    if (!paidAt) throw new UserFacingError("Date de paiement invalide.");
    if (paidAt.getTime() > Date.now() + 86_400_000)
      throw new UserFacingError("La date de paiement ne peut pas être dans le futur.");
  }
  return {
    montant: Math.round(m * 100) / 100,
    mode,
    reference: champOuNull(form, "reference")?.slice(0, 80) ?? null,
    paidAt,
  };
}

export type FactureLibreEntree = {
  organisationId: number;
  type: string;
  libelle: string;
  montantTtc: number;
  dueAt: Date | null;
  envoyer: boolean;
};

export function lireFactureLibre(form: FormData): FactureLibreEntree {
  const organisationId = idOuNull(form, "organisation_id");
  if (!organisationId) throw new UserFacingError("Choisissez l'organisation à facturer.");
  const type = champ(form, "type");
  if (!(type in FACTURE_TYPES)) throw new UserFacingError("Type de facture inconnu.");
  const libelle = champ(form, "libelle").slice(0, 200);
  if (!libelle) throw new UserFacingError("Indiquez le libellé de la facture.");
  const ttc = parseFloat_(form.get("montant_ttc"), null);
  if (ttc === null || !(ttc > 0))
    throw new UserFacingError("Indiquez un montant TTC supérieur à zéro.");
  const dueAt = parseDate(form.get("due_at"));
  return {
    organisationId,
    type,
    libelle,
    montantTtc: Math.round(ttc * 100) / 100,
    dueAt,
    envoyer: coche(form, "envoyer"),
  };
}

/** Crée une facture libre (hors dossier) pour une organisation. */
export async function creerFactureLibre(e: FactureLibreEntree, acteur: CurrentUser) {
  const org = await prisma.organisation.findUnique({ where: { id: e.organisationId } });
  if (!org) throw new UserFacingError("Organisation introuvable.");
  const cfg = await getSettings();
  const taux = e.type === "caution" || e.type === "avoir" ? 0 : cfg.TVA_TAUX || 0;
  const ht = Math.round((e.montantTtc / (1 + taux / 100)) * 100) / 100;
  const numero = await prochainNumero("FAC");
  const f = await prisma.facture.create({
    data: {
      numero,
      organisationId: org.id,
      type: e.type,
      libelle: e.libelle,
      montantHt: ht,
      tva: Math.round((e.montantTtc - ht) * 100) / 100,
      montantTtc: e.montantTtc,
      dueAt: e.dueAt ?? new Date(Date.now() + 30 * 86_400_000),
      createdBy: acteur.name,
    },
  });
  invalidateNavCounts();
  await auditRecord(
    "emission facture libre",
    `${numero} · ${org.name} · ${montant(e.montantTtc)}`,
    "paiements",
    acteur.email,
  );
  if (e.envoyer && org.email) await envoyerFacture(f.id);
  return f;
}

/**
 * (Ré)envoie une facture à l'usager : le modèle « facture_emise » avec le PDF en pièce
 * jointe, au demandeur du dossier ou au courriel de l'organisation. Vrai si un courriel
 * est parti (ou a été simulé).
 */
export async function envoyerFacture(factureId: number): Promise<boolean> {
  const f = await prisma.facture.findUnique({
    where: { id: factureId },
    include: { organisation: true, reservation: { select: { id: true } } },
  });
  if (!f) throw new UserFacingError("Facture introuvable.");
  let to: string | null = null;
  let vars: Record<string, string> = {};
  if (f.reservation) {
    const { chargerReservation } = await import("@/server/reservations");
    const r = await chargerReservation(f.reservation.id);
    if (r) {
      to = r.user?.email ?? r.organisation?.email ?? null;
      vars = await variablesDossier(r);
    }
  } else if (f.organisation) {
    const cfg = await getSettings();
    to = f.organisation.email;
    vars = {
      prenom: f.organisation.legalFirstName || "Madame, Monsieur",
      numero: f.numero,
      titre: f.libelle,
      espace: f.libelle,
      site: "",
      dates: "—",
      organisation: f.organisation.name,
      lien: `${cfg.APP_BASE_URL}/portail/mon-organisation`,
      lien_bo: `${cfg.APP_BASE_URL}/paiements/${f.id}`,
    };
  }
  if (!to) throw new UserFacingError("Aucune adresse de courriel connue pour ce débiteur.");
  let pdf: Buffer | null = null;
  try {
    pdf = await pdfFacture(f.id);
  } catch (e) {
    console.error("[paiements] PDF impossible :", e);
  }
  return envoyerDepuisModele(
    "facture_emise",
    to,
    {
      ...vars,
      type_facture: (FACTURE_TYPES[f.type] ?? "Facture").toLowerCase(),
      numero_facture: f.numero,
      montant: montant(f.montantTtc),
      echeance: f.dueAt ? dateCourte(f.dueAt) : "—",
      modalites:
        "règlement en régie, par chèque à l'ordre du Trésor public ou par virement (coordonnées sur la facture).",
    },
    {
      reservationId: f.reservationId,
      attachments: pdf
        ? [{ filename: `${f.numero}.pdf`, content: pdf, contentType: "application/pdf" }]
        : undefined,
    },
  );
}

/** Les organisations facturables (formulaire de facture libre). */
export async function organisationsFacturables(): Promise<[string, string][]> {
  const rows = await prisma.organisation.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
  return rows.map((o) => [String(o.id), o.name]);
}
