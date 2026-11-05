/**
 * Module ASSO : demandes de subvention des associations. Lecture des formulaires, cycle
 * de vie (déposée → instruction → avis → votée / refusée → versée), avis des élus,
 * filtres de la liste, synthèse par exercice, export.
 */
import type { Prisma } from "@/generated/prisma/client";
import { AVIS_LABELS, SUBVENTION_STATUS, SUBVENTION_TYPES } from "@/lib/constantes";
import { champ, champOuNull, idOuNull, parseDate, parseFloat_, parseInt_ } from "@/lib/forms-util";
import { dateCourte, montant } from "@/lib/libelles";
import { toParisWall } from "@/lib/paris-time";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import type { CurrentUser } from "@/server/guards";
import { envoyerDepuisModele } from "@/server/mailer";
import { invalidateNavCounts } from "@/server/nav";
import { notifier } from "@/server/notifications";
import { prochainNumero } from "@/server/numerotation";
import { normaliser, type Params, param } from "@/server/paging";

export const INCLUDE_SUBVENTION_LISTE = {
  organisation: { select: { id: true, name: true, type: true } },
  avis: { select: { avis: true } },
} satisfies Prisma.SubventionInclude;

export type SubventionLigne = Prisma.SubventionGetPayload<{
  include: typeof INCLUDE_SUBVENTION_LISTE;
}>;

export const INCLUDE_SUBVENTION = {
  organisation: {
    include: {
      users: {
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  avis: {
    include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.SubventionInclude;

export type SubventionComplete = Prisma.SubventionGetPayload<{
  include: typeof INCLUDE_SUBVENTION;
}>;

export async function chargerSubvention(id: number): Promise<SubventionComplete | null> {
  return prisma.subvention.findUnique({ where: { id }, include: INCLUDE_SUBVENTION });
}

export async function chargerSubventions(): Promise<SubventionLigne[]> {
  return prisma.subvention.findMany({
    include: INCLUDE_SUBVENTION_LISTE,
    orderBy: [{ exercice: "desc" }, { createdAt: "desc" }],
  });
}

// ── Cycle de vie ──

/** Transitions admises depuis chaque statut. */
export const TRANSITIONS_SUBVENTION: Record<string, string[]> = {
  brouillon: ["deposee"],
  deposee: ["instruction", "refusee"],
  instruction: ["avis", "refusee"],
  avis: ["votee", "refusee"],
  votee: ["versee"],
  refusee: [],
  versee: [],
};

/** Libellé du bouton de chaque transition. */
export const TRANSITION_LIBELLES: Record<string, { label: string; icone: string; aide: string }> = {
  deposee: { label: "Déposer", icone: "send", aide: "Enregistre la demande." },
  instruction: {
    label: "Prendre en instruction",
    icone: "search",
    aide: "Vous devenez l'instructeur du dossier.",
  },
  avis: {
    label: "Soumettre aux élus",
    icone: "users",
    aide: "Le dossier est ouvert aux avis des élus.",
  },
  votee: { label: "Voter la subvention", icone: "gavel", aide: "Fixe le montant accordé." },
  refusee: { label: "Refuser", icone: "ban", aide: "Clôt la demande avec un motif." },
  versee: { label: "Marquer versée", icone: "banknote", aide: "La subvention a été payée." },
};

/** Statuts qui figent la demande (plus de modification ni d'avis). */
export const STATUTS_CLOS = ["votee", "refusee", "versee"];

export function estModifiable(s: { status: string }): boolean {
  return !STATUTS_CLOS.includes(s.status);
}

/**
 * Les élus donnent un avis ; instruire, modifier, voter, refuser et verser reviennent aux
 * agents qui ont l'écriture sur les subventions.
 */
export function peutDecider(user: Pick<CurrentUser, "canEdit" | "role">): boolean {
  return user.canEdit("subventions") && user.role !== "elu";
}

export const REFUS_ELU =
  "Les élus donnent un avis ; la décision et le suivi sont enregistrés par les agents.";

export function avisOuvert(s: { status: string }): boolean {
  return ["deposee", "instruction", "avis"].includes(s.status);
}

/** L'exercice proposé par défaut : l'année suivante dès octobre. */
export function exerciceParDefaut(now = new Date()): number {
  const w = toParisWall(now);
  return w.mo >= 10 ? w.y + 1 : w.y;
}

/** Compte les avis : favorables / avec réserve / défavorables. */
export function compterAvis(avis: { avis: string }[]): Record<string, number> {
  const out: Record<string, number> = { favorable: 0, reserve: 0, defavorable: 0 };
  for (const a of avis) out[a.avis] = (out[a.avis] ?? 0) + 1;
  return out;
}

// ── Liste ──

export type FiltresSubventions = {
  statut: string;
  exercice: number | null;
  type: string;
  organisation: number | null;
  q: string;
};

export const ONGLETS_SUBVENTIONS: [string, string][] = [
  ["deposee", "Déposées"],
  ["instruction", "En instruction"],
  ["avis", "Avis"],
  ["votee", "Votées"],
  ["refusee", "Refusées"],
  ["versee", "Versées"],
  ["", "Toutes"],
];

export function lireFiltres(params: Params): FiltresSubventions {
  const ex = Number.parseInt(param(params, "exercice") ?? "", 10);
  const org = Number.parseInt(param(params, "organisation") ?? "", 10);
  return {
    statut: (param(params, "statut") ?? "").trim(),
    exercice: Number.isInteger(ex) && ex > 2000 ? ex : null,
    type: (param(params, "type") ?? "").trim(),
    organisation: Number.isInteger(org) && org > 0 ? org : null,
    q: (param(params, "q") ?? "").trim(),
  };
}

export function filtrerSubventions(
  rows: SubventionLigne[],
  fl: FiltresSubventions,
): SubventionLigne[] {
  const ql = fl.q ? normaliser(fl.q) : "";
  return rows.filter((s) => {
    if (fl.statut && s.status !== fl.statut) return false;
    if (fl.exercice && s.exercice !== fl.exercice) return false;
    if (fl.type && s.type !== fl.type) return false;
    if (fl.organisation && s.organisationId !== fl.organisation) return false;
    if (ql && !normaliser(`${s.numero} ${s.organisation.name} ${s.objet}`).includes(ql))
      return false;
    return true;
  });
}

export function compterOnglets(
  rows: SubventionLigne[],
  fl: FiltresSubventions,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [cle] of ONGLETS_SUBVENTIONS)
    out[cle] = filtrerSubventions(rows, { ...fl, statut: cle, q: "" }).length;
  return out;
}

export function exercicesDe(rows: { exercice: number }[], now = new Date()): number[] {
  const set = new Set(rows.map((r) => r.exercice));
  set.add(exerciceParDefaut(now));
  set.add(toParisWall(now).y);
  return [...set].sort((a, b) => b - a);
}

export function organisationsDe(rows: SubventionLigne[]): [string, string][] {
  const m = new Map<number, string>();
  for (const r of rows) m.set(r.organisation.id, r.organisation.name);
  return [...m.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "fr"))
    .map(([id, nom]) => [String(id), nom]);
}

export type SyntheseExercice = {
  exercice: number;
  nb: number;
  demande: number;
  accorde: number;
  verse: number;
  nbAccordees: number;
  nbVersees: number;
  enCours: number;
};

/** Les cartes du haut : l'exercice choisi. */
export function syntheseExercice(rows: SubventionLigne[], exercice: number): SyntheseExercice {
  const s: SyntheseExercice = {
    exercice,
    nb: 0,
    demande: 0,
    accorde: 0,
    verse: 0,
    nbAccordees: 0,
    nbVersees: 0,
    enCours: 0,
  };
  for (const r of rows) {
    if (r.exercice !== exercice) continue;
    s.nb += 1;
    s.demande += r.montantDemande;
    if (r.status === "votee" || r.status === "versee") {
      s.accorde += r.montantAccorde ?? 0;
      s.nbAccordees += 1;
    }
    if (r.status === "versee") {
      s.verse += r.montantAccorde ?? 0;
      s.nbVersees += 1;
    }
    if (["deposee", "instruction", "avis"].includes(r.status)) s.enCours += 1;
  }
  s.demande = Math.round(s.demande * 100) / 100;
  s.accorde = Math.round(s.accorde * 100) / 100;
  s.verse = Math.round(s.verse * 100) / 100;
  return s;
}

export function lignesCsv(rows: SubventionLigne[]): (string | number)[][] {
  const out: (string | number)[][] = [
    [
      "Numéro",
      "Exercice",
      "Organisation",
      "Type",
      "Objet",
      "Montant demandé",
      "Montant accordé",
      "Statut",
      "Budget total",
      "Bénéficiaires",
      "Avis favorables",
      "Avis avec réserve",
      "Avis défavorables",
      "Déposée le",
      "Déposée par",
      "Instructeur",
      "Décision le",
      "Note de décision",
    ],
  ];
  for (const r of rows) {
    const c = compterAvis(r.avis);
    out.push([
      r.numero,
      r.exercice,
      r.organisation.name,
      SUBVENTION_TYPES[r.type] ?? r.type,
      r.objet,
      r.montantDemande,
      r.montantAccorde ?? "",
      SUBVENTION_STATUS[r.status]?.label ?? r.status,
      r.budgetTotal ?? "",
      r.beneficiaires ?? "",
      c.favorable,
      c.reserve,
      c.defavorable,
      dateCourte(r.createdAt),
      r.depositedBy ?? "",
      r.instructeur ?? "",
      r.decisionAt ? dateCourte(r.decisionAt) : "",
      r.decisionNote ?? "",
    ]);
  }
  return out;
}

// ── Formulaires ──

export type SubventionEntree = {
  organisationId: number;
  exercice: number;
  type: string;
  objet: string;
  description: string | null;
  montantDemande: number;
  budgetTotal: number | null;
  beneficiaires: number | null;
};

export function lireSubvention(form: FormData): SubventionEntree {
  const organisationId = idOuNull(form, "organisation_id");
  if (!organisationId) throw new UserFacingError("Choisissez l'association demandeuse.");
  const exercice = parseInt_(form.get("exercice"), null);
  if (!exercice || exercice < 2000 || exercice > 2100)
    throw new UserFacingError("Indiquez l'exercice (année) de la subvention.");
  const type = champ(form, "type");
  if (!(type in SUBVENTION_TYPES)) throw new UserFacingError("Type de subvention inconnu.");
  const objet = champ(form, "objet").slice(0, 200);
  if (!objet) throw new UserFacingError("Indiquez l'objet de la demande.");
  const demande = parseFloat_(form.get("montant_demande"), null);
  if (demande === null || !(demande > 0))
    throw new UserFacingError("Indiquez un montant demandé supérieur à zéro.");
  const budget = parseFloat_(form.get("budget_total"), null);
  const benef = parseInt_(form.get("beneficiaires"), null, 0);
  return {
    organisationId,
    exercice,
    type,
    objet,
    description: champOuNull(form, "description"),
    montantDemande: Math.round(demande * 100) / 100,
    budgetTotal: budget !== null && budget >= 0 ? Math.round(budget * 100) / 100 : null,
    beneficiaires: benef,
  };
}

/** Les associations (et autres organisations actives) qui peuvent demander. */
export async function organisationsDemandeuses(): Promise<
  { id: number; name: string; type: string; validee: boolean }[]
> {
  const rows = await prisma.organisation.findMany({
    where: { isActive: true, type: "association" },
    select: { id: true, name: true, type: true, validatedAt: true },
    orderBy: { name: "asc" },
  });
  return rows.map((o) => ({
    id: o.id,
    name: o.name,
    type: o.type,
    validee: Boolean(o.validatedAt),
  }));
}

function nomOrg(o: { legalFirstName: string | null }): string {
  return o.legalFirstName || "Madame, Monsieur";
}

/** Dépose une demande au nom d'une association (par un agent). */
export async function creerSubvention(
  e: SubventionEntree,
  acteur: CurrentUser,
): Promise<SubventionComplete> {
  const org = await prisma.organisation.findUnique({ where: { id: e.organisationId } });
  if (!org?.isActive) throw new UserFacingError("Organisation introuvable.");
  if (org.type !== "association")
    throw new UserFacingError("Seule une association peut demander une subvention.");
  const numero = await prochainNumero("SUB", e.exercice);
  const s = await prisma.subvention.create({
    data: {
      numero,
      organisationId: org.id,
      exercice: e.exercice,
      type: e.type,
      objet: e.objet,
      description: e.description,
      montantDemande: e.montantDemande,
      budgetTotal: e.budgetTotal,
      beneficiaires: e.beneficiaires,
      status: "deposee",
      depositedBy: acteur.name,
    },
    include: INCLUDE_SUBVENTION,
  });
  invalidateNavCounts();
  await auditRecord(
    "depot subvention",
    `${numero} · ${org.name} · ${montant(e.montantDemande)}`,
    "subventions",
    acteur.email,
  );
  if (org.email)
    await envoyerDepuisModele("subvention_recue", org.email, {
      prenom: nomOrg(org),
      numero,
      objet: e.objet,
      montant: montant(e.montantDemande),
      exercice: e.exercice,
    });
  for (const u of s.organisation.users)
    await notifier(
      u.id,
      "subvention",
      `Demande de subvention ${numero} enregistrée`,
      e.objet,
      `/portail/mes-subventions/${s.id}`,
    );
  return s;
}

/** Modifie une demande tant qu'elle n'est pas votée. */
export async function modifierSubvention(
  id: number,
  e: SubventionEntree,
  acteur: CurrentUser,
): Promise<void> {
  const s = await prisma.subvention.findUnique({ where: { id } });
  if (!s) throw new UserFacingError("Demande introuvable.");
  if (!estModifiable(s))
    throw new UserFacingError("Cette demande est close : elle ne peut plus être modifiée.");
  await prisma.subvention.update({
    where: { id },
    data: {
      organisationId: e.organisationId,
      exercice: e.exercice,
      type: e.type,
      objet: e.objet,
      description: e.description,
      montantDemande: e.montantDemande,
      budgetTotal: e.budgetTotal,
      beneficiaires: e.beneficiaires,
    },
  });
  await auditRecord("modification subvention", s.numero, "subventions", acteur.email);
}

export type AvisEntree = { avis: string; montant: number | null; commentaire: string | null };

export function lireAvis(form: FormData): AvisEntree {
  const avis = champ(form, "avis");
  if (!(avis in AVIS_LABELS)) throw new UserFacingError("Choisissez un avis.");
  const m = parseFloat_(form.get("montant"), null);
  return {
    avis,
    montant: m !== null && m >= 0 ? Math.round(m * 100) / 100 : null,
    commentaire: champOuNull(form, "commentaire"),
  };
}

/** Pose (ou remplace) l'avis de l'agent connecté. */
export async function donnerAvis(id: number, e: AvisEntree, acteur: CurrentUser): Promise<void> {
  const s = await prisma.subvention.findUnique({ where: { id } });
  if (!s) throw new UserFacingError("Demande introuvable.");
  if (!avisOuvert(s))
    throw new UserFacingError("Les avis ne sont plus recueillis sur cette demande.");
  const existant = await prisma.subventionAvis.findFirst({
    where: { subventionId: id, authorId: acteur.id },
  });
  if (existant)
    await prisma.subventionAvis.update({
      where: { id: existant.id },
      data: { avis: e.avis, montant: e.montant, commentaire: e.commentaire, createdAt: new Date() },
    });
  else
    await prisma.subventionAvis.create({
      data: {
        subventionId: id,
        authorId: acteur.id,
        avis: e.avis,
        montant: e.montant,
        commentaire: e.commentaire,
      },
    });
  await auditRecord(
    "avis subvention",
    `${s.numero} · ${AVIS_LABELS[e.avis].label}${e.montant !== null ? ` · ${montant(e.montant)}` : ""}`,
    "subventions",
    acteur.email,
  );
}

export type TransitionOpts = {
  montantAccorde?: number | null;
  note?: string | null;
  dateVersement?: Date | null;
};

export function lireTransition(form: FormData): { statut: string; opts: TransitionOpts } {
  return {
    statut: champ(form, "statut"),
    opts: {
      montantAccorde: parseFloat_(form.get("montant_accorde"), null),
      note: champOuNull(form, "note"),
      dateVersement: parseDate(form.get("date_versement")),
    },
  };
}

/**
 * Fait avancer une demande. Vote et refus préviennent l'association (courriel
 * « subvention_decision » + cloche de ses membres) ; le versement prévient par la cloche.
 */
export async function changerStatutSubvention(
  id: number,
  nouveau: string,
  acteur: CurrentUser,
  opts: TransitionOpts = {},
): Promise<SubventionComplete> {
  const s = await chargerSubvention(id);
  if (!s) throw new UserFacingError("Demande introuvable.");
  const admis = TRANSITIONS_SUBVENTION[s.status] ?? [];
  if (!admis.includes(nouveau))
    throw new UserFacingError(
      `Passage de « ${SUBVENTION_STATUS[s.status]?.label ?? s.status} » à « ${SUBVENTION_STATUS[nouveau]?.label ?? nouveau} » impossible.`,
    );
  const now = new Date();
  const data: Prisma.SubventionUpdateInput = { status: nouveau };
  let detail = "";
  if (nouveau === "instruction") {
    data.instructeur = acteur.name;
  } else if (nouveau === "votee") {
    const m = opts.montantAccorde;
    if (m === null || m === undefined || !(m >= 0))
      throw new UserFacingError("Indiquez le montant accordé (0 pour un vote sans attribution).");
    data.montantAccorde = Math.round(m * 100) / 100;
    data.decisionAt = now;
    data.decisionNote = opts.note ?? null;
    detail = montant(data.montantAccorde);
  } else if (nouveau === "refusee") {
    if (!opts.note) throw new UserFacingError("Indiquez le motif du refus.");
    data.decisionAt = now;
    data.decisionNote = opts.note;
    data.montantAccorde = null;
    detail = opts.note;
  } else if (nouveau === "versee") {
    const d = opts.dateVersement ?? now;
    detail = dateCourte(d);
    // Le schéma n'a pas de date de versement : elle est consignée dans la note de décision.
    data.decisionNote = `${s.decisionNote ? `${s.decisionNote}\n` : ""}Versement effectué le ${dateCourte(d)}.`;
  }
  await prisma.subvention.update({ where: { id }, data });
  invalidateNavCounts();
  await auditRecord(
    `subvention ${nouveau}`,
    `${s.numero}${detail ? ` · ${detail}` : ""}`,
    "subventions",
    acteur.email,
  );
  const maj = (await chargerSubvention(id)) as SubventionComplete;
  const org = maj.organisation;
  if (nouveau === "votee" || nouveau === "refusee") {
    const accordee = nouveau === "votee";
    const cfg = await getSettings();
    if (org.email)
      await envoyerDepuisModele("subvention_decision", org.email, {
        prenom: nomOrg(org),
        numero: maj.numero,
        objet: maj.objet,
        decision: accordee ? "subvention accordée" : "demande refusée",
        montant_accorde: accordee ? `Montant accordé : ${montant(maj.montantAccorde ?? 0)}.` : "",
        note: opts.note ?? "",
        exercice: maj.exercice,
        lien: `${cfg.APP_BASE_URL}/portail/mes-subventions/${maj.id}`,
      });
    for (const u of org.users)
      await notifier(
        u.id,
        "subvention",
        accordee
          ? `Subvention ${maj.numero} accordée · ${montant(maj.montantAccorde ?? 0)}`
          : `Demande de subvention ${maj.numero} refusée`,
        maj.objet,
        `/portail/mes-subventions/${maj.id}`,
      );
  } else if (nouveau === "versee") {
    for (const u of org.users)
      await notifier(
        u.id,
        "subvention",
        `Subvention ${maj.numero} versée · ${montant(maj.montantAccorde ?? 0)}`,
        maj.objet,
        `/portail/mes-subventions/${maj.id}`,
      );
  }
  return maj;
}

/** Supprime une demande (seulement déposée, sans avis). */
export async function supprimerSubvention(id: number, acteur: CurrentUser): Promise<string> {
  const s = await prisma.subvention.findUnique({
    where: { id },
    include: { _count: { select: { avis: true } } },
  });
  if (!s) throw new UserFacingError("Demande introuvable.");
  if (s.status !== "deposee" && s.status !== "brouillon")
    throw new UserFacingError("Seule une demande simplement déposée peut être supprimée.");
  if (s._count.avis)
    throw new UserFacingError("Cette demande a déjà reçu des avis : refusez-la plutôt.");
  await prisma.subvention.delete({ where: { id } });
  invalidateNavCounts();
  await auditRecord("suppression subvention", s.numero, "subventions", acteur.email);
  return s.numero;
}
