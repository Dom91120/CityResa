/**
 * Le dossier de demande de subvention : brouillon pré-rempli, fiches enregistrées une à une,
 * signature de l'attestation par code, dépôt (numéro, réception, PDF, courriel), renvoi comme
 * incomplet. Règles pures dans src/lib/dossier-subvention.ts et src/lib/pieces-subvention.ts.
 */
import type { CampagneSubvention, Prisma } from "@/generated/prisma/client";
import { SUBVENTION_TYPES } from "@/lib/constantes";
import {
  avecFiche,
  type DossierSubvention,
  deplierFormulaire,
  estFiche,
  type FicheCle,
  lireDossier,
  type Manque,
  manquesDossier,
  preRemplir,
  type SubventionPourManques,
} from "@/lib/dossier-subvention";
import { champ, idOuNull, parseFloat_ } from "@/lib/forms-util";
import { dateCourte, montant } from "@/lib/libelles";
import {
  chargerSubvention,
  INCLUDE_SUBVENTION,
  type SubventionComplete,
} from "@/modules/subventions/server";
import { auditRecord } from "@/server/audit";
import { campagneCourante, depotPortailOuvert } from "@/server/campagnes-subvention";
import { emettreCode, messageCodeIncorrect, verifierCode } from "@/server/code-signature";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { enregistrerPdf, forParent } from "@/server/documents";
import { htmlDossierSubvention } from "@/server/dossier-subvention-pdf";
import { UserFacingError } from "@/server/errors";
import type { CurrentUser } from "@/server/guards";
import { envoyerDepuisModele } from "@/server/mailer";
import { invalidateNavCounts } from "@/server/nav";
import { notifier, notifierAgents } from "@/server/notifications";
import { prochainNumero } from "@/server/numerotation";
import { htmlVersPdf } from "@/server/pdf";
import { locauxMisADisposition } from "@/server/valorisation";

type Acteur = Pick<CurrentUser, "name" | "email">;

export async function historiser(
  subventionId: number,
  action: string,
  comment: string | null,
  performedBy: string,
): Promise<void> {
  await prisma.subventionHistory.create({
    data: { subventionId, action: action.slice(0, 64), comment, performedBy },
  });
}

// ── Lecture ──

export function dossierDe(s: SubventionComplete): DossierSubvention {
  return lireDossier(s.dossier, s.organisation.sportive);
}

export function pourManques(s: SubventionComplete, dossier = dossierDe(s)): SubventionPourManques {
  return {
    nature: s.nature === "premiere" ? "premiere" : "renouvellement",
    montantDemande: s.montantDemande,
    sportive: s.organisation.sportive,
    signeAt: s.signeAt,
    dossier,
  };
}

/** Les `kind` des pièces fournies sur la demande (hors PDF du dossier). */
export async function kindsFournis(id: number): Promise<string[]> {
  const docs = await forParent("subvention", id);
  return docs.map((d) => d.kind).filter((k) => k !== "dossier");
}

/** Les manques du dossier ; un agent dépose un dossier papier signé, sans signature en ligne. */
export async function manquesDe(s: SubventionComplete, parAgent = false): Promise<Manque[]> {
  return manquesDossier(pourManques(s), await kindsFournis(s.id), {
    signatureRequise: !parAgent,
  });
}

/** Le dossier est-il encore en rédaction (fiches modifiables) ? */
export function enRedaction(s: { status: string }): boolean {
  return s.status === "brouillon";
}

function numeroProvisoire(exercice: number, organisationId: number): string {
  return `prov-${exercice}-${organisationId}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

// ── Brouillon ──

export type NouveauBrouillon = {
  organisationId: number;
  campagne: CampagneSubvention | null;
  exercice: number;
  nature: "premiere" | "renouvellement";
  parAgent: boolean;
};

/**
 * Crée le brouillon d'une organisation pour un exercice (un seul par exercice : l'existant est
 * renvoyé), pré-rempli depuis la fiche de l'organisation, le dossier de l'exercice précédent et
 * les locaux mis à disposition l'an passé.
 */
export async function creerBrouillon(
  e: NouveauBrouillon,
  acteur: Acteur,
): Promise<SubventionComplete> {
  const org = await prisma.organisation.findUnique({ where: { id: e.organisationId } });
  if (!org?.isActive) throw new UserFacingError("Organisation introuvable.");
  if (org.type !== "association")
    throw new UserFacingError("Seule une association peut demander une subvention.");
  const existant = await prisma.subvention.findFirst({
    where: { organisationId: org.id, exercice: e.exercice, status: "brouillon" },
    include: INCLUDE_SUBVENTION,
  });
  if (existant) return existant;
  const precedente = await prisma.subvention.findFirst({
    where: { organisationId: org.id, exercice: { lt: e.exercice }, status: { not: "brouillon" } },
    orderBy: [{ exercice: "desc" }, { createdAt: "desc" }],
  });
  const nature = precedente ? e.nature : "premiere";
  const dossierPrecedent = precedente?.dossier
    ? lireDossier(precedente.dossier, org.sportive)
    : null;
  const accordee =
    precedente && ["votee", "versee"].includes(precedente.status)
      ? precedente.montantAccorde
      : null;
  const locaux = await locauxMisADisposition(org.id, e.exercice - 1).catch(() => []);
  const dossier = preRemplir(org, dossierPrecedent, accordee, locaux, org.sportive);
  const s = await prisma.subvention.create({
    data: {
      numero: numeroProvisoire(e.exercice, org.id),
      organisationId: org.id,
      campagneId: e.campagne?.id ?? null,
      exercice: e.exercice,
      nature,
      type: precedente?.type ?? "fonctionnement",
      objet: precedente?.objet ?? "Subvention de fonctionnement",
      montantDemande: precedente?.montantDemande ?? 0,
      status: "brouillon",
      depositedBy: acteur.name,
      dossier: dossier as unknown as Prisma.InputJsonValue,
    },
    include: INCLUDE_SUBVENTION,
  });
  await historiser(
    s.id,
    "Dossier commencé",
    e.parAgent ? `par ${acteur.name} (agent)` : null,
    acteur.name,
  );
  return s;
}

/** Le brouillon portail d'une organisation pour la campagne courante, s'il existe. */
export async function brouillonCourant(
  organisationId: number,
  exercice: number,
): Promise<SubventionComplete | null> {
  return prisma.subvention.findFirst({
    where: { organisationId, exercice, status: "brouillon" },
    include: INCLUDE_SUBVENTION,
  });
}

/** La campagne courante et si le portail accepte un dépôt aujourd'hui. */
export async function contexteCampagne(): Promise<{
  campagne: CampagneSubvention | null;
  depotOuvert: boolean;
}> {
  const campagne = await campagneCourante();
  return { campagne, depotOuvert: depotPortailOuvert(campagne) };
}

// ── Fiches ──

export function lireCleFiche(raw: string): Exclude<FicheCle, "pieces"> {
  if (!estFiche(raw) || raw === "pieces") throw new UserFacingError("Fiche inconnue.");
  return raw;
}

/**
 * Enregistre une fiche depuis son formulaire. La fiche « Demande et actions » porte aussi l'objet,
 * le type et le montant de la demande. Toute modification invalide la signature.
 */
export async function enregistrerFiche(
  id: number,
  cle: Exclude<FicheCle, "pieces">,
  form: FormData,
  _acteur: Acteur,
): Promise<SubventionComplete> {
  const s = await chargerSubvention(id);
  if (!s) throw new UserFacingError("Demande introuvable.");
  if (!enRedaction(s)) throw new UserFacingError("Le dossier est déposé : il ne se modifie plus.");
  const brut = deplierFormulaire(form.entries());
  const sportive = s.organisation.sportive;
  const dossier = avecFiche(dossierDe(s), cle, brut, sportive);
  const data: Prisma.SubventionUpdateInput = {
    dossier: dossier as unknown as Prisma.InputJsonValue,
  };
  if (cle === "motivation") {
    const objet = champ(form, "objet").slice(0, 200);
    if (!objet) throw new UserFacingError("Indiquez l'objet de la demande.");
    const type = champ(form, "type");
    if (!(type in SUBVENTION_TYPES)) throw new UserFacingError("Type de subvention inconnu.");
    const demande = parseFloat_(form.get("montant_demande"), null);
    if (demande === null || !(demande >= 0))
      throw new UserFacingError("Indiquez le montant demandé.");
    data.objet = objet;
    data.type = type;
    data.montantDemande = Math.round(demande * 100) / 100;
  }
  if (cle === "presentation") {
    const nature = champ(form, "nature");
    if (nature === "premiere" || nature === "renouvellement") data.nature = nature;
  }
  if (cle !== "attestation" && s.signeAt) {
    data.signeAt = null;
    data.signeNom = null;
    data.signeQualite = null;
    data.signeIp = null;
    data.signeChannel = null;
  }
  await prisma.subvention.update({ where: { id }, data });
  return (await chargerSubvention(id)) as SubventionComplete;
}

// ── Signature de l'attestation ──

const PORTEE = "dossier-subvention";

/** Envoie un code de signature à l'association (SMS si possible, sinon courriel). */
export async function demanderCodeDossier(
  id: number,
  telephone: string | null,
  courriel: string,
  prenom: string,
): Promise<"sms" | "email"> {
  const s = await chargerSubvention(id);
  if (!s) throw new UserFacingError("Demande introuvable.");
  if (!enRedaction(s)) throw new UserFacingError("Ce dossier n'attend plus de signature.");
  const d = dossierDe(s);
  const a = d.attestation;
  if (!a.obligationsAJour || !a.informationsSinceres || !a.cumulAides || !a.engagementRepublicain)
    throw new UserFacingError(
      "Cochez les quatre engagements de l'attestation avant de demander un code.",
    );
  if (a.signataireNom.trim().length < 3)
    throw new UserFacingError("Indiquez le nom du signataire.");
  const cfg = await getSettings();
  const emis = await emettreCode(
    PORTEE,
    s.id,
    (code, validite) =>
      `${cfg.COLLECTIVITE_NOM} : votre code de signature du dossier de subvention ${s.exercice} est ${code} (valable ${validite} h).`,
    telephone ?? s.organisation.phone,
  );
  if (emis.canal === "email") {
    await envoyerDepuisModele("subvention_code", courriel, {
      prenom,
      exercice: s.exercice,
      organisation: s.organisation.name,
      code: emis.code,
      validite: `${emis.validiteHeures} h`,
    });
  }
  await prisma.subvention.update({
    where: { id },
    data: {
      signeChannel: emis.canal,
      signatureSentAt: new Date(),
      signatureCodeHash: emis.hash,
      signatureExpiresAt: emis.expiresAt,
      signatureAttempts: 0,
    },
  });
  await historiser(
    id,
    "Code de signature envoyé",
    emis.canal === "sms" ? `par SMS au ${emis.mobile}` : `par courriel à ${courriel}`,
    "système",
  );
  return emis.canal;
}

/** Vérifie le code et signe l'attestation et le contrat d'engagement républicain. */
export async function signerDossier(id: number, code: string, ip: string): Promise<void> {
  const s = await chargerSubvention(id);
  if (!s) throw new UserFacingError("Demande introuvable.");
  if (!enRedaction(s)) throw new UserFacingError("Ce dossier n'attend plus de signature.");
  if (!verifierCode(PORTEE, s.id, s, code)) {
    await prisma.subvention.update({
      where: { id },
      data: { signatureAttempts: { increment: 1 } },
    });
    throw new UserFacingError(messageCodeIncorrect(s.signatureAttempts));
  }
  const a = dossierDe(s).attestation;
  await prisma.subvention.update({
    where: { id },
    data: {
      signeAt: new Date(),
      signeNom: a.signataireNom.trim().slice(0, 160),
      signeQualite: a.signataireQualite.trim().slice(0, 80) || null,
      signeMandataire: a.mandataire,
      signeIp: ip.slice(0, 64),
      signatureCodeHash: null,
    },
  });
  await historiser(id, "Attestation signée", `par ${a.signataireNom}`, a.signataireNom);
  await auditRecord(
    "signature dossier subvention",
    `${s.organisation.name} · ${s.exercice} · ${a.signataireNom}`,
    "subventions",
    s.organisation.email ?? a.signataireNom,
  );
}

// ── Dépôt ──

function texteManques(manques: Manque[]): string {
  return manques.map((m) => m.libelle).join(" · ");
}

/**
 * Dépose le dossier : vérifie la complétude (fiches, pièces, signature), la période de la
 * campagne (sauf dérogation d'un agent), numérote, date la réception, génère le PDF, prévient.
 */
export async function deposerDossier(
  id: number,
  acteur: Acteur,
  opts: { parAgent: boolean; derogation?: string | null },
): Promise<SubventionComplete> {
  const s = await chargerSubvention(id);
  if (!s) throw new UserFacingError("Demande introuvable.");
  if (!enRedaction(s)) throw new UserFacingError("Ce dossier est déjà déposé.");
  const manques = await manquesDe(s, opts.parAgent);
  if (manques.length)
    throw new UserFacingError(
      `Dossier incomplet (${manques.length}) : ${texteManques(manques.slice(0, 6))}${manques.length > 6 ? "…" : ""}`,
    );
  const campagne = s.campagne ?? (await campagneCourante());
  const horsPeriode = !depotPortailOuvert(campagne);
  if (horsPeriode && !opts.parAgent)
    throw new UserFacingError(
      "La campagne est close : le dépôt n'est plus possible sur le portail.",
    );
  // Un dossier renvoyé comme incomplet garde son numéro ; un brouillon en reçoit un au premier dépôt.
  const numero = s.numero.startsWith("prov-") ? await prochainNumero("SUB", s.exercice) : s.numero;
  const now = new Date();
  await prisma.subvention.update({
    where: { id },
    data: {
      numero,
      status: "deposee",
      recuAt: now,
      campagneId: campagne?.id ?? s.campagneId,
      depositedBy: acteur.name,
    },
  });
  await historiser(
    id,
    "Dossier déposé",
    horsPeriode
      ? `Hors période de campagne, dérogation de ${acteur.name}${opts.derogation ? ` : ${opts.derogation}` : ""}`
      : null,
    acteur.name,
  );
  const maj = (await chargerSubvention(id)) as SubventionComplete;
  await genererDossierPdf(maj, acteur.name).catch((e) => console.error("[dossier subvention]", e));
  invalidateNavCounts();
  const org = maj.organisation;
  await auditRecord(
    "depot subvention",
    `${numero} · ${org.name} · ${montant(maj.montantDemande)}${horsPeriode ? " · dérogation" : ""}`,
    "subventions",
    acteur.email,
  );
  const cfg = await getSettings();
  const destinataires = [
    ...new Set([org.email, ...org.users.map((u) => u.email)].filter(Boolean)),
  ] as string[];
  if (destinataires.length)
    await envoyerDepuisModele("subvention_recue", destinataires, {
      prenom: org.legalFirstName || "Madame, Monsieur",
      numero,
      objet: maj.objet,
      montant: montant(maj.montantDemande),
      exercice: maj.exercice,
      campagne: campagne?.label ?? `Exercice ${maj.exercice}`,
      date_limite: campagne ? `le ${dateCourte(campagne.clotureDate)}` : "date à venir",
      lien: `${cfg.APP_BASE_URL}/portail/mes-subventions/${maj.id}`,
    });
  for (const u of org.users)
    await notifier(
      u.id,
      "subvention",
      `Dossier de subvention ${numero} déposé`,
      maj.objet,
      `/portail/mes-subventions/${maj.id}`,
    );
  if (!opts.parAgent)
    await notifierAgents(
      null,
      "subvention",
      `Nouveau dossier de subvention ${numero}`,
      `${org.name} · ${maj.objet} · ${montant(maj.montantDemande)}`,
      `/subventions/${maj.id}`,
    );
  return maj;
}

/** Renvoie un dossier déposé à l'association comme incomplet : retour en brouillon, courriel. */
export async function renvoyerIncomplet(
  id: number,
  motif: string,
  acteur: Acteur,
): Promise<SubventionComplete> {
  const s = await chargerSubvention(id);
  if (!s) throw new UserFacingError("Demande introuvable.");
  if (!["deposee", "instruction"].includes(s.status))
    throw new UserFacingError("Seul un dossier déposé ou en instruction peut être renvoyé.");
  if (!motif.trim()) throw new UserFacingError("Indiquez ce qui manque ou ce qui est à corriger.");
  await prisma.subvention.update({
    where: { id },
    data: { status: "brouillon", instructeur: null },
  });
  await historiser(id, "Renvoyé comme incomplet", motif, acteur.name);
  invalidateNavCounts();
  await auditRecord("subvention incomplete", `${s.numero} · ${motif}`, "subventions", acteur.email);
  const cfg = await getSettings();
  const org = s.organisation;
  const destinataires = [
    ...new Set([org.email, ...org.users.map((u) => u.email)].filter(Boolean)),
  ] as string[];
  if (destinataires.length)
    await envoyerDepuisModele("subvention_incomplete", destinataires, {
      prenom: org.legalFirstName || "Madame, Monsieur",
      numero: s.numero,
      exercice: s.exercice,
      motif,
      date_limite: s.campagne ? dateCourte(s.campagne.clotureDate) : "la clôture de la campagne",
      lien: `${cfg.APP_BASE_URL}/portail/mes-subventions/${s.id}`,
    });
  for (const u of org.users)
    await notifier(
      u.id,
      "subvention",
      `Dossier ${s.numero} à compléter`,
      motif,
      `/portail/mes-subventions/${s.id}`,
    );
  return (await chargerSubvention(id)) as SubventionComplete;
}

/** Le cadre réservé : secteur d'instruction. */
export async function changerSecteur(id: number, form: FormData, acteur: Acteur): Promise<void> {
  const s = await prisma.subvention.findUnique({ where: { id } });
  if (!s) throw new UserFacingError("Demande introuvable.");
  const secteurId = idOuNull(form, "secteur_id");
  await prisma.subvention.update({ where: { id }, data: { secteurId } });
  await auditRecord("secteur subvention", s.numero, "subventions", acteur.email);
}

// ── PDF ──

/** Génère (ou régénère) le PDF du dossier et l'accroche à la demande. */
export async function genererDossierPdf(s: SubventionComplete, acteur: string): Promise<number> {
  const html = await htmlDossierSubvention(
    { ...s, dossierLu: dossierDe(s) },
    await kindsFournis(s.id),
  );
  const pdf = await htmlVersPdf(html);
  if (s.dossierDocumentId)
    await prisma.document.delete({ where: { id: s.dossierDocumentId } }).catch(() => {});
  const doc = await enregistrerPdf(
    "subvention",
    s.id,
    `dossier-subvention-${s.numero}.pdf`,
    pdf,
    "dossier",
    `Dossier de demande ${s.exercice}`,
  );
  await prisma.subvention.update({ where: { id: s.id }, data: { dossierDocumentId: doc.id } });
  await historiser(s.id, "Dossier édité en PDF", null, acteur);
  return doc.id;
}

/** Le PDF du dossier à la volée (brouillon compris), sans l'enregistrer. */
export async function pdfDossier(id: number): Promise<Buffer | null> {
  const s = await chargerSubvention(id);
  if (!s) return null;
  return htmlVersPdf(
    await htmlDossierSubvention({ ...s, dossierLu: dossierDe(s) }, await kindsFournis(id)),
  );
}
