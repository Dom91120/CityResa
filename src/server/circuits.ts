/**
 * Processus et circuits : la partie qui touche la base.
 *
 * - le référentiel (services, délégations, rôles) et les personnes derrière un intervenant ;
 * - les « faits » d'un dossier de réservation, sur lesquels les règles s'évaluent ;
 * - l'aiguillage d'un dossier à sa création (service et version de circuit) ;
 * - les étapes de contrôle : ouverture, réponse, et le verrou posé avant l'acceptation.
 *
 * Les règles elles-mêmes sont pures et vivent dans src/lib/circuits.ts.
 */
import type { Prisma } from "@/generated/prisma/client";
import {
  type Aiguillage,
  aiguiller,
  type CircuitPublie,
  type Definition,
  type Etape,
  type EtatEtape,
  etapesApplicables,
  etapesRetenant,
  etatEtape,
  type Faits,
  type Intervenant,
  issueReunion,
  type Libelles,
  libelleIntervenant,
  lireDefinition,
  type Moment,
  NATURES,
  type Objet,
  REUNIONS,
  type Referentiel,
  repartirEtapes,
  restantARepondre,
  STATUTS_DU_MOMENT,
} from "@/lib/circuits";
import { dateCourte, plage, pluriel } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { suppleanceEnCours } from "@/lib/services";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { enabledIn } from "@/server/features";
import type { CurrentUser } from "@/server/guards";
import { notifier } from "@/server/notifications";
import { chargerReservation, historiser, type ReservationComplete } from "@/server/reservations";

const JOUR = 86_400_000;

export type Personne = { id: string; name: string; email: string };

const SELECT_PERSONNE = { id: true, firstName: true, lastName: true, email: true } as const;
const personne = (u: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}): Personne => ({
  id: u.id,
  name: `${u.firstName} ${u.lastName}`.trim() || u.email,
  email: u.email,
});
const AGENT_ACTIF = { isActive: true, kind: "agent" } as const;

/** Le module est-il en service ? Coupé, rien n'est aiguillé ni retenu. */
export async function processusActif(): Promise<boolean> {
  return enabledIn(await getSettings(), "processus");
}

// ── Référentiel ──

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Les personnes qui agissent pour un service : membres, responsable, et suppléant en cours. */
export async function personnesDuService(serviceId: number): Promise<Personne[]> {
  const s = await prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      responsable: { select: { ...SELECT_PERSONNE, isActive: true } },
      membres: { include: { user: { select: { ...SELECT_PERSONNE, isActive: true } } } },
      suppleant: {
        include: {
          responsable: { select: { ...SELECT_PERSONNE, isActive: true } },
          membres: { include: { user: { select: { ...SELECT_PERSONNE, isActive: true } } } },
        },
      },
    },
  });
  if (!s?.isActive) return [];
  const tous = [
    ...s.membres.map((m) => m.user),
    ...(s.responsable ? [s.responsable] : []),
    ...(suppleanceEnCours(
      {
        suppleantId: s.suppleantId,
        suppleanceDu: ymd(s.suppleanceDu),
        suppleanceAu: ymd(s.suppleanceAu),
      },
      todayParisISO(),
    ) && s.suppleant?.isActive
      ? [
          ...s.suppleant.membres.map((m) => m.user),
          ...(s.suppleant.responsable ? [s.suppleant.responsable] : []),
        ]
      : []),
  ].filter((u) => u.isActive);
  return [...new Map(tous.map((u) => [u.id, personne(u)])).values()];
}

/** Services, délégations et rôles, avec le nombre de personnes derrière chacun. */
export async function referentiel(): Promise<Referentiel> {
  const [services, delegations, roles, comptes] = await Promise.all([
    prisma.service.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.delegation.findMany({
      where: { isActive: true },
      include: {
        user: { select: { isActive: true } },
        suppleant: { select: { isActive: true } },
      },
    }),
    prisma.role.findMany({ where: { isUsager: false } }),
    prisma.user.groupBy({ by: ["role"], where: AGENT_ACTIF, _count: { _all: true } }),
  ]);
  const parRole = new Map(comptes.map((c) => [c.role, c._count._all]));
  const ref: Referentiel = { services: new Map(), delegations: new Map(), roles: new Map() };
  for (const s of services) {
    const [gens, brut] = await Promise.all([
      personnesDuService(s.id),
      prisma.service.findUnique({
        where: { id: s.id },
        select: { responsable: { select: { isActive: true } } },
      }),
    ]);
    ref.services.set(s.id, {
      name: s.name,
      personnes: gens.length,
      responsable: Boolean(brut?.responsable?.isActive),
    });
  }
  for (const d of delegations)
    ref.delegations.set(d.id, {
      label: d.label,
      personnes: Number(Boolean(d.user?.isActive)) + Number(Boolean(d.suppleant?.isActive)),
    });
  for (const r of roles)
    ref.roles.set(r.name, { label: r.label, personnes: parRole.get(r.name) ?? 0 });
  return ref;
}

/** Les listes proposées par les critères « espace », « site » et « profil ». */
export async function optionsCriteres(): Promise<Record<string, [string, string][]>> {
  const [espaces, sites, profils, secteurs] = await Promise.all([
    prisma.espace.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.site.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.referential.findMany({
      where: { kind: "profil", isActive: true },
      select: { id: true, label: true },
      orderBy: { position: "asc" },
    }),
    prisma.referential.findMany({
      where: { kind: "subvention_secteur", isActive: true },
      select: { id: true, label: true },
      orderBy: { position: "asc" },
    }),
  ]);
  return {
    secteur_instruction: secteurs.map((s) => [String(s.id), s.label]),
    espace: espaces.map((e) => [String(e.id), e.name]),
    site: sites.map((s) => [String(s.id), s.name]),
    profil: profils.map((p) => [String(p.id), p.label]),
  };
}

export function libellesDe(options: Record<string, [string, string][]>): Libelles {
  return Object.fromEntries(Object.entries(options).map(([k, v]) => [k, Object.fromEntries(v)]));
}

/** Les personnes derrière un intervenant, pour un dossier confié à `serviceId`. */
export async function personnesDe(i: Intervenant, serviceId: number | null): Promise<Personne[]> {
  switch (i.type) {
    case "service":
      return personnesDuService(i.id);
    case "service_dossier":
      return serviceId ? personnesDuService(serviceId) : [];
    case "responsable_dossier": {
      if (!serviceId) return [];
      const s = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { responsable: { select: { ...SELECT_PERSONNE, isActive: true } } },
      });
      return s?.responsable?.isActive ? [personne(s.responsable)] : [];
    }
    case "delegation": {
      const d = await prisma.delegation.findUnique({
        where: { id: i.id },
        include: {
          user: { select: { ...SELECT_PERSONNE, isActive: true } },
          suppleant: { select: { ...SELECT_PERSONNE, isActive: true } },
        },
      });
      if (!d?.isActive) return [];
      return [d.user, d.suppleant]
        .filter((u): u is NonNullable<typeof u> => Boolean(u?.isActive))
        .map(personne);
    }
    case "role": {
      const us = await prisma.user.findMany({
        where: { ...AGENT_ACTIF, role: i.role },
        select: SELECT_PERSONNE,
      });
      return us.map(personne);
    }
  }
}

// ── Circuits en service ──

/**
 * Les circuits d'un type de dossier avec leur version en service. `brouillons` : la version
 * en cours de rédaction remplace la version publiée (simulation avant publication).
 */
export async function circuitsEnService(
  objet = "reservation",
  brouillons = false,
): Promise<CircuitPublie[]> {
  const circuits = await prisma.circuit.findMany({
    where: { objet, isActive: true },
    include: {
      versions: {
        where: { status: { in: brouillons ? ["publiee", "brouillon"] : ["publiee"] } },
        orderBy: { numero: "desc" },
      },
    },
  });
  const out: CircuitPublie[] = [];
  for (const c of circuits) {
    const v =
      (brouillons ? c.versions.find((x) => x.status === "brouillon") : null) ??
      c.versions.find((x) => x.status === "publiee");
    if (!v) continue;
    out.push({
      id: c.id,
      versionId: v.id,
      name: c.name,
      position: c.position,
      parDefaut: c.parDefaut,
      definition: lireDefinition(v.definition),
    });
  }
  return out;
}

// ── Faits d'un dossier de réservation ──

/** Ce qu'il faut d'un dossier (existant ou en cours de création) pour évaluer les règles. */
export type DossierFaits = {
  espaceId: number;
  espace: { secteur: string; siteId: number; delayMinDays: number };
  organisation: {
    type: string;
    profilId: number | null;
    sportive: boolean;
    conventionnee: boolean;
    validatedAt: Date | null;
  } | null;
  gratuit: boolean;
  isPublicEvent: boolean;
  recurrence: unknown;
  materiels: readonly unknown[];
  source: string;
  montantTtc: number;
  participants: number | null;
  startAt: Date;
  createdAt: Date;
};

/**
 * Le circuit qui recevra un dossier en cours de création, et ses étapes bloquantes
 * applicables : un dossier que son circuit soumet à un visa ne naît pas accepté.
 */
export async function circuitPour(d: DossierFaits): Promise<{
  versionId: number;
  serviceId: number | null;
  name: string;
  bloquantes: Etape[];
} | null> {
  if (!(await processusActif())) return null;
  const faits = faitsReservation(d);
  const retenu = aiguiller(await circuitsEnService("reservation"), faits).retenu;
  if (!retenu) return null;
  return {
    versionId: retenu.versionId,
    serviceId: retenu.definition.serviceId,
    name: retenu.name,
    bloquantes: etapesApplicables(retenu.definition, faits, "avant_acceptation").filter(
      (e) => NATURES[e.nature].bloquante,
    ),
  };
}

/** Ce que les règles peuvent lire d'un dossier de réservation. */
export function faitsReservation(r: DossierFaits, now = new Date()): Faits {
  const o = r.organisation;
  return {
    secteur: r.espace.secteur,
    site: String(r.espace.siteId),
    espace: String(r.espaceId),
    type_demandeur: o?.type ?? null,
    profil: o?.profilId ? String(o.profilId) : null,
    sportive: o ? o.sportive : null,
    conventionnee: o ? o.conventionnee : null,
    fiche_validee: o ? Boolean(o.validatedAt) : null,
    gratuite_accordee: r.gratuit,
    derogation_delai: r.startAt.getTime() - r.createdAt.getTime() < r.espace.delayMinDays * JOUR,
    public: r.isPublicEvent,
    recurrent: Boolean(r.recurrence),
    materiel: r.materiels.length > 0,
    origine: r.source,
    montant: r.montantTtc,
    participants: r.participants,
    jours_avant: Math.floor((r.startAt.getTime() - now.getTime()) / JOUR),
  };
}

/**
 * Confie un dossier à un circuit et à un service. Appelé à la création ; un dossier déjà
 * aiguillé garde sa version, sauf `forcer` (bascule décidée par un administrateur).
 */
export async function aiguillerReservation(
  r: ReservationComplete,
  opts: { forcer?: boolean; acteur?: string } = {},
): Promise<Aiguillage | null> {
  if (!(await processusActif())) return null;
  if (r.circuitVersionId && !opts.forcer) return null;
  const a = aiguiller(await circuitsEnService("reservation"), faitsReservation(r));
  if (!a.retenu) return a;
  const serviceId = a.retenu.definition.serviceId;
  await prisma.reservation.update({
    where: { id: r.id },
    data: { circuitVersionId: a.retenu.versionId, serviceId },
  });
  if (opts.forcer && opts.acteur)
    await historiser(
      r.id,
      "Circuit modifié",
      `Dossier basculé sur « ${a.retenu.name} »`,
      opts.acteur,
    );
  return a;
}

// ── Étapes d'un dossier ──

export type EtapeDossier = Etape & {
  etat: EtatEtape;
  bloquante: boolean;
  attendus: Personne[];
  libelleIntervenant: string;
  /** Les personnes mises en copie, hors celles qui répondent. */
  enCopie: Personne[];
  /** Dernière ouverture de l'étape sur ce dossier. */
  derniere: {
    id: number;
    status: string;
    contexte: string | null;
    ouvertAt: Date;
    ouvertPar: string | null;
    echeanceAt: Date | null;
    closAt: Date | null;
    closPar: string | null;
    commentaire: string | null;
    /** Les réponses reçues, dans l'ordre. */
    reponses: {
      userId: string;
      userName: string;
      accord: boolean;
      commentaire: string | null;
      createdAt: Date;
    }[];
  } | null;
};

export type EtatCircuit = {
  circuit: { id: number; name: string } | null;
  version: { id: number; numero: number; status: string } | null;
  /** La version en service du circuit, quand le dossier en suit une autre. */
  enService: { id: number; numero: number } | null;
  service: { id: number; name: string; email: string | null; phone: string | null } | null;
  etapes: EtapeDossier[];
  /** Les étapes qui retiennent encore l'acceptation. */
  retenues: EtapeDossier[];
};

/**
 * Le dossier qui porte des étapes, quel que soit son type : le moteur d'étapes ne connaît
 * que cela. Une réservation et une demande de subvention s'y ramènent chacune.
 */
export type Porteur = {
  objet: Objet;
  id: number;
  numero: string;
  titre: string;
  /** Une ligne qui situe le dossier (créneau, association et montant…). */
  detail: string;
  /** Sa fiche dans le back-office. */
  lien: string;
  demandeur: string;
  status: string;
  serviceId: number | null;
  circuitVersionId: number | null;
  /** Les comptes à prévenir d'une réponse, en plus de celui qui a demandé l'étape. */
  suiveurs: string[];
  faits: Faits;
  historiser: (action: string, comment: string | null, acteur: string) => Promise<void>;
};

export function porteurReservation(r: ReservationComplete): Porteur {
  return {
    objet: "reservation",
    id: r.id,
    numero: r.numero,
    titre: r.title,
    detail: `${r.espace.name} · ${plage(r.startAt, r.endAt)}`,
    lien: `/reservations/${r.id}`,
    demandeur: r.organisation?.name ?? "—",
    status: r.status,
    serviceId: r.serviceId,
    circuitVersionId: r.circuitVersionId,
    suiveurs: r.agentId ? [r.agentId] : [],
    faits: faitsReservation(r),
    historiser: (action, comment, acteur) => historiser(r.id, action, comment, acteur),
  };
}

/** La cloche range une étape de campagne avec les réservations. */
function typeNotif(p: Porteur): "reservation" | "subvention" {
  return p.objet === "subvention" ? "subvention" : "reservation";
}

/** Un dossier tel que le moteur l'accepte : une réservation complète, ou un porteur. */
export type Dossier = ReservationComplete | Porteur;

function porteur(d: Dossier): Porteur {
  return "objet" in d ? d : porteurReservation(d);
}

/** Charge le porteur d'une étape d'après son type et son identifiant. */
export async function chargerPorteur(objet: string, id: number): Promise<Porteur | null> {
  if (objet === "subvention") {
    const { porteurSubventionParId } = await import("@/server/circuits-subvention");
    return porteurSubventionParId(id);
  }
  if (objet === "campagne") {
    const { porteurCampagneParId } = await import("@/server/circuits-campagne");
    return porteurCampagneParId(id);
  }
  const r = await chargerReservation(id);
  return r ? porteurReservation(r) : null;
}

/** Le circuit d'un dossier et l'état de ses étapes applicables. */
export async function etatCircuit(d: Dossier): Promise<EtatCircuit | null> {
  const p = porteur(d);
  if (!p.circuitVersionId || !(await processusActif())) return null;
  const [v, service, ouvertures, ref] = await Promise.all([
    prisma.circuitVersion.findUnique({
      where: { id: p.circuitVersionId },
      include: { circuit: true },
    }),
    p.serviceId
      ? prisma.service.findUnique({
          where: { id: p.serviceId },
          select: { id: true, name: true, email: true, phone: true },
        })
      : null,
    prisma.dossierEtape.findMany({
      where: { objet: p.objet, objetId: p.id },
      include: { reponses: { orderBy: { id: "asc" } } },
      orderBy: { id: "desc" },
    }),
    referentiel(),
  ]);
  if (!v) return null;
  const def = lireDefinition(v.definition);
  const etapes: EtapeDossier[] = [];
  for (const e of def.etapes) {
    // L'avis des élus sur une subvention a son propre circuit (avis donnés sur le dossier).
    if (e.moment === "avis_elus") continue;
    const derniere = ouvertures.find((o) => o.cle === e.cle && o.circuitVersionId === v.id) ?? null;
    // Une étape déjà ouverte reste affichée même si sa condition n'est plus vraie.
    const applicable = etapesApplicables({ ...def, etapes: [e] }, p.faits).length > 0;
    if (!applicable && (!derniere || derniere.status === "annulee")) continue;
    const attendus = await personnesDe(e.intervenant, p.serviceId);
    const enCopie = e.copie
      ? (await personnesDe(e.copie, p.serviceId)).filter(
          (c) => !attendus.some((a) => a.id === c.id),
        )
      : [];
    etapes.push({
      ...e,
      etat: etatEtape(derniere),
      bloquante: NATURES[e.nature].bloquante && applicable,
      attendus,
      enCopie,
      libelleIntervenant: libelleIntervenant(e.intervenant, ref),
      derniere,
    });
  }
  const publiee =
    v.status === "publiee"
      ? null
      : await prisma.circuitVersion.findFirst({
          where: { circuitId: v.circuitId, status: "publiee" },
          select: { id: true, numero: true },
        });
  return {
    circuit: { id: v.circuit.id, name: v.circuit.name },
    version: { id: v.id, numero: v.numero, status: v.status },
    enService: publiee,
    service,
    etapes,
    retenues: etapesRetenant(etapes.filter((e) => e.bloquante)),
  };
}

/**
 * Le courriel qui double la cloche d'une étape : une demande (`etape_demandee`) ou une relance
 * (`etape_relance`). Un échec d'envoi ne retient rien ; un modèle désactivé n'envoie rien.
 */
export async function courrielEtape(
  modele: "etape_demandee" | "etape_relance",
  personnes: readonly Personne[],
  v: {
    nature: string;
    etape: string;
    numero: string;
    titre: string;
    detail: string;
    lien: string;
    demandePar?: string | null;
    contexte?: string | null;
    echeance?: Date | null;
  },
): Promise<void> {
  if (!personnes.length) return;
  try {
    const { envoyerDepuisModele } = await import("@/server/mailer");
    const cfg = await getSettings();
    const echeance = v.echeance ? dateCourte(v.echeance) : "";
    for (const a of personnes) {
      if (!a.email) continue;
      await envoyerDepuisModele(modele, a.email, {
        prenom: a.name,
        nature: v.nature,
        etape: v.etape,
        numero: v.numero,
        titre: v.titre,
        detail: v.detail,
        demande_par: v.demandePar?.trim() || "Le service instructeur",
        contexte: v.contexte?.trim() ?? "",
        echeance:
          modele === "etape_relance"
            ? echeance
            : echeance
              ? `Réponse attendue le ${echeance}.`
              : "",
        lien: `${cfg.APP_BASE_URL}${v.lien}`,
      });
    }
  } catch (e) {
    console.error("[circuit] courriel d'étape :", e);
  }
}

/** Ouvre une étape sur un dossier et prévient les personnes attendues. */
export async function ouvrirEtape(
  d: Dossier,
  e: EtapeDossier,
  acteur: string,
  contexte: string | null,
): Promise<void> {
  const p = porteur(d);
  if (!p.circuitVersionId) return;
  if (!e.attendus.length)
    throw new UserFacingError(
      `Personne ne peut répondre à l'étape « ${e.libelle} » (${e.libelleIntervenant}) : prévenez un administrateur.`,
    );
  await prisma.dossierEtape.updateMany({
    where: { objet: p.objet, objetId: p.id, cle: e.cle, status: "ouverte" },
    data: { status: "annulee", closAt: new Date(), closPar: acteur },
  });
  await prisma.dossierEtape.create({
    data: {
      objet: p.objet,
      objetId: p.id,
      circuitVersionId: p.circuitVersionId,
      cle: e.cle,
      libelle: e.libelle,
      nature: e.nature,
      intervenant: { libelle: e.libelleIntervenant } as Prisma.InputJsonValue,
      contexte: contexte?.trim() || null,
      ouvertPar: acteur,
      echeanceAt: e.delaiJours ? new Date(Date.now() + e.delaiJours * JOUR) : null,
    },
  });
  await p.historiser(
    `${NATURES[e.nature].label} demandé${e.nature === "relecture" ? "e" : ""}`,
    `${e.libelle} · ${e.libelleIntervenant}${contexte?.trim() ? ` · ${contexte.trim()}` : ""}`,
    acteur,
  );
  await Promise.all(
    e.attendus.map((a) =>
      notifier(
        a.id,
        typeNotif(p),
        `${NATURES[e.nature].label} attendu${e.nature === "relecture" ? "e" : ""} · ${p.numero}`,
        `${e.libelle} · ${p.titre} · ${p.detail}`,
        `${p.lien}#circuit`,
      ),
    ),
  );
  // Les personnes en copie sont informées par la cloche, sans courriel ni réponse attendue.
  await Promise.all(
    e.enCopie.map((a) =>
      notifier(
        a.id,
        typeNotif(p),
        `Pour information · ${e.libelle} · ${p.numero}`,
        `${NATURES[e.nature].label} demandé${e.nature === "relecture" ? "e" : ""} à ${e.libelleIntervenant} · ${p.titre}`,
        `${p.lien}#circuit`,
      ),
    ),
  );
  await courrielEtape("etape_demandee", e.attendus, {
    nature: NATURES[e.nature].label,
    etape: e.libelle,
    numero: p.numero,
    titre: p.titre,
    detail: p.detail,
    lien: `${p.lien}#circuit`,
    demandePar: acteur,
    contexte,
    echeance: e.delaiJours ? new Date(Date.now() + e.delaiJours * JOUR) : null,
  });
}

/**
 * Fait passer un dossier en cours sur la version en service de son circuit : les étapes déjà
 * demandées qui existent encore le suivent avec leur réponse, les étapes ouvertes disparues
 * sont annulées, et le dossier prend le service que désigne la nouvelle version.
 */
export async function basculerVersion(
  d: Dossier,
  acteur: string,
): Promise<{ numero: number; reportees: number; annulees: number }> {
  const p = porteur(d);
  const etat = await etatCircuit(p);
  if (!etat?.version || !p.circuitVersionId)
    throw new UserFacingError("Ce dossier ne suit aucun circuit.");
  if (!etat.enService) throw new UserFacingError("Ce dossier suit déjà la version en service.");
  const cible = await prisma.circuitVersion.findUnique({ where: { id: etat.enService.id } });
  if (!cible) throw new UserFacingError("La version en service est introuvable.");
  const def = lireDefinition(cible.definition);
  const rows = await prisma.dossierEtape.findMany({
    where: { objet: p.objet, objetId: p.id, circuitVersionId: p.circuitVersionId },
    select: { id: true, cle: true, status: true },
  });
  const { reportees, annulees } = repartirEtapes(rows, def);
  const suivi = { circuitVersionId: cible.id };
  // Une campagne garde le service qui la conduit ; les autres dossiers suivent le circuit.
  const avecService = def.serviceId ? { ...suivi, serviceId: def.serviceId } : suivi;
  await prisma.$transaction([
    prisma.dossierEtape.updateMany({
      where: { id: { in: reportees } },
      data: { circuitVersionId: cible.id },
    }),
    prisma.dossierEtape.updateMany({
      where: { id: { in: annulees } },
      data: { status: "annulee", closAt: new Date(), closPar: acteur },
    }),
    p.objet === "subvention"
      ? prisma.subvention.update({ where: { id: p.id }, data: avecService })
      : p.objet === "campagne"
        ? prisma.campagne.update({ where: { id: p.id }, data: suivi })
        : prisma.reservation.update({ where: { id: p.id }, data: avecService }),
  ]);
  await p.historiser(
    `Circuit : passage à la version ${cible.numero}`,
    `${etat.circuit?.name ?? ""} · depuis la version ${etat.version.numero}${annulees.length ? ` · ${annulees.length} étape(s) en attente annulée(s)` : ""}`,
    acteur,
  );
  return { numero: cible.numero, reportees: reportees.length, annulees: annulees.length };
}

/** Ouvre les étapes applicables pas encore demandées ; renvoie celles qui viennent de l'être. */
export async function ouvrirEtapesPrealables(
  r: Dossier,
  etat: EtatCircuit,
  acteur: string,
  contexte: string | null = null,
  moment: Moment = "avant_acceptation",
): Promise<EtapeDossier[]> {
  const aOuvrir = etat.etapes.filter((e) => e.etat === "a_demander" && e.moment === moment);
  for (const e of aOuvrir) await ouvrirEtape(r, e, acteur, contexte);
  return aOuvrir;
}

/** Un dossier refusé ou annulé n'attend plus personne : ses étapes ouvertes sont closes. */
export async function cloreEtapesOuvertes(
  id: number,
  acteur: string,
  objet: Objet = "reservation",
): Promise<void> {
  await prisma.dossierEtape.updateMany({
    where: { objet, objetId: id, status: "ouverte" },
    data: { status: "annulee", closAt: new Date(), closPar: acteur },
  });
}

/**
 * Le verrou posé avant l'acceptation : tant qu'une étape bloquante applicable n'est pas
 * validée, le dossier ne s'accepte pas. Les étapes pas encore demandées sont ouvertes au
 * passage, pour que l'agent n'ait pas à y revenir.
 */
export async function verifierAvantAcceptation(
  r: ReservationComplete,
  acteur: CurrentUser,
  contexte: string | null = null,
): Promise<void> {
  return verifierAvant(r, "avant_acceptation", acteur, contexte);
}

/** Ce que disent les verrous, moment par moment. */
const VERROUS: Record<Moment, { fait: string; impossible: string; reste: string; sinon: string }> =
  {
    avant_acceptation: {
      fait: "Le dossier n'est pas encore accepté",
      impossible: "Acceptation impossible",
      reste: "il restera à approuver",
      sinon: "Modifiez le dossier puis redemandez l'étape, ou déclinez la demande.",
    },
    avant_refus: {
      fait: "La demande n'est pas encore refusée",
      impossible: "Refus impossible",
      reste: "il restera à décliner",
      sinon: "Revoyez votre décision, ou redemandez l'étape.",
    },
    avant_annulation: {
      fait: "La réservation n'est pas encore annulée",
      impossible: "Annulation impossible",
      reste: "il restera à annuler",
      sinon: "Revoyez votre décision, ou redemandez l'étape.",
    },
    avant_requisition: {
      fait: "Le créneau n'est pas encore réquisitionné",
      impossible: "Réquisition impossible",
      reste: "il restera à réquisitionner",
      sinon: "Revoyez votre décision, ou redemandez l'étape.",
    },
    avant_retenue: {
      fait: "La caution n'est pas encore retenue",
      impossible: "Retenue impossible",
      reste: "il restera à enregistrer la retenue",
      sinon: "Revoyez le montant ou restituez la caution, puis redemandez l'étape au besoin.",
    },
    avant_facture: {
      fait: "La facture n'est pas encore émise",
      impossible: "Émission impossible",
      reste: "il restera à émettre la facture",
      sinon: "Revoyez les montants du dossier, puis redemandez l'étape.",
    },
    avis_elus: { fait: "", impossible: "", reste: "", sinon: "" },
    avant_notification: {
      fait: "Les décisions de la campagne ne sont pas encore envoyées",
      impossible: "Envoi impossible",
      reste: "il restera à prévenir les demandeurs",
      sinon: "Revoyez l'arbitrage puis redemandez l'étape.",
    },
    avant_vote: {
      fait: "La subvention n'est pas encore votée",
      impossible: "Vote impossible",
      reste: "il restera à voter",
      sinon: "Revoyez le dossier puis redemandez l'étape, ou refusez la demande.",
    },
    avant_versement: {
      fait: "La subvention n'est pas encore versée",
      impossible: "Versement impossible",
      reste: "il restera à enregistrer le versement",
      sinon: "Voyez avec la personne qui a répondu, puis redemandez l'étape.",
    },
  };

/**
 * Le verrou d'un moment du cycle (acceptation, refus, annulation, réquisition) : tant qu'une
 * étape bloquante applicable à ce moment n'est pas validée, le geste est retenu. Les étapes
 * pas encore demandées sont ouvertes au passage.
 */
/** Les étapes qui retiennent encore ce geste sur le dossier (libellés), sans rien ouvrir. */
export async function retenuesAvant(d: Dossier, moment: Moment): Promise<string[]> {
  const etat = await etatCircuit(d);
  return etat ? etat.retenues.filter((e) => e.moment === moment).map((e) => e.libelle) : [];
}

/**
 * Comme `verifierAvant`, sans lever : les étapes à demander le sont au passage, et la réponse
 * dit ce qui retient encore le geste (vide = rien). Sert aux gestes groupés (fermeture).
 */
export async function retenuAvant(
  d: Dossier,
  moment: Moment,
  acteur: string,
  contexte: string | null,
): Promise<string[]> {
  const etat = await etatCircuit(d);
  if (!etat) return [];
  await ouvrirEtapesPrealables(d, etat, acteur, contexte, moment);
  return etat.retenues.filter((e) => e.moment === moment).map((e) => e.libelle);
}

export async function verifierAvant(
  r: Dossier,
  moment: Moment,
  acteur: CurrentUser,
  contexte: string | null = null,
): Promise<void> {
  const etat = await etatCircuit(r);
  if (!etat) return;
  // Les avis applicables partent avec la première tentative, sans rien retenir.
  const aOuvrir = await ouvrirEtapesPrealables(r, etat, acteur.name, contexte, moment);
  const retenues = etat.retenues.filter((e) => e.moment === moment);
  if (!retenues.length) return;
  const v = VERROUS[moment];
  const refusees = retenues.filter((e) => e.etat === "refusee");
  if (refusees.length)
    throw new UserFacingError(
      `${v.impossible} : ${refusees.map((e) => `« ${e.libelle} » a été refusé${e.nature === "relecture" ? "e" : ""}`).join(" ; ")}. ${v.sinon}`,
    );
  const nouvelles = retenues.filter((e) => aOuvrir.some((o) => o.cle === e.cle));
  const enCours = retenues.filter((e) => !nouvelles.includes(e));
  const dire = (es: EtapeDossier[]) =>
    es.map((e) => `« ${e.libelle} » (${e.libelleIntervenant})`).join(", ");
  throw new UserFacingError(
    [
      `${v.fait} : son circuit demande une étape préalable.`,
      nouvelles.length ? `Demandé à l'instant : ${dire(nouvelles)}.` : "",
      enCours.length ? `En attente de réponse : ${dire(enCours)}.` : "",
      `Vous serez prévenu de la réponse ; ${v.reste}.`,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/** L'utilisateur peut-il répondre à cette étape ouverte ? */
export async function peutRepondre(
  user: CurrentUser,
  r: { serviceId: number | null },
  e: Pick<Etape, "intervenant">,
): Promise<boolean> {
  if (!user.isAgent) return false;
  return (await personnesDe(e.intervenant, r.serviceId)).some((p) => p.id === user.id);
}

/** Répond à une étape ouverte : accord ou refus, avec un commentaire (obligatoire au refus). */
export async function repondreEtape(
  d: Dossier,
  etapeId: number,
  user: CurrentUser,
  accord: boolean,
  commentaire: string | null,
): Promise<string> {
  const p = porteur(d);
  const etat = await etatCircuit(p);
  const e = etat?.etapes.find((x) => x.derniere?.id === etapeId);
  const ouverture = e?.derniere;
  if (!e || ouverture?.status !== "ouverte")
    throw new UserFacingError("Cette étape n'attend plus de réponse.");
  if (!(await peutRepondre(user, p, e)))
    throw new UserFacingError(`Cette étape s'adresse à : ${e.libelleIntervenant}.`);
  const texte = commentaire?.trim() || null;
  if (!accord && !texte)
    throw new UserFacingError("Indiquez le motif : il est lu par le service qui instruit.");
  if (ouverture.reponses.some((r) => r.userId === user.id))
    throw new UserFacingError("Vous avez déjà répondu à cette étape.");
  await prisma.dossierEtapeReponse.create({
    data: { etapeId, userId: user.id, userName: user.name, accord, commentaire: texte },
  });
  // La règle de réunion de l'étape dit si cette réponse la clôt.
  const reponses = [...ouverture.reponses, { userId: user.id, accord }];
  const conclusion = issueReunion(
    e.reunion,
    e.attendus.map((a) => a.id),
    reponses,
  );
  const maReponse = NATURES[e.nature].issues[accord ? 0 : 1];
  const module = p.objet === "subvention" ? "subventions" : "reservations";
  await p.historiser(maReponse, `${e.libelle}${texte ? ` · ${texte}` : ""}`, user.name);
  await auditRecord(
    `etape · reponse ${accord ? "accord" : "refus"}`,
    `${p.numero} · ${e.libelle}`,
    module,
    user.email,
  );
  if (!conclusion) {
    const reste = restantARepondre(e.attendus, reponses).length;
    return `${maReponse} · ${REUNIONS[e.reunion].court} : ${pluriel(reste, "réponse encore attendue", "réponses encore attendues")}`;
  }
  await prisma.dossierEtape.update({
    where: { id: etapeId },
    data: { status: conclusion, closAt: new Date(), closPar: user.name, commentaire: texte },
  });
  const issue = NATURES[e.nature].issues[conclusion === "validee" ? 0 : 1];
  if (e.reunion !== "un")
    await p.historiser(
      `${issue} (${REUNIONS[e.reunion].court})`,
      `${e.libelle} · ${reponses.filter((r) => r.accord).length} pour, ${reponses.filter((r) => !r.accord).length} contre`,
      user.name,
    );
  await auditRecord(`etape ${conclusion}`, `${p.numero} · ${e.libelle}`, module, user.email);
  // Le demandeur de l'étape, ceux qui suivent le dossier et les personnes en copie sont
  // prévenus de la réponse.
  const aPrevenir = new Set<string>([...p.suiveurs, ...e.enCopie.map((c) => c.id)]);
  if (ouverture.ouvertPar) {
    const u = await prisma.user.findFirst({
      where: { ...AGENT_ACTIF, name: ouverture.ouvertPar },
      select: { id: true },
    });
    if (u) aPrevenir.add(u.id);
  }
  aPrevenir.delete(user.id);
  await Promise.all(
    [...aPrevenir].map((id) =>
      notifier(
        id,
        typeNotif(p),
        `${issue} · ${p.numero}`,
        `${e.libelle} · ${user.name}${texte ? ` · ${texte}` : ""}`,
        `${p.lien}#circuit`,
      ),
    ),
  );
  return issue;
}

/** Le libellé destiné à l'usager de l'étape en cours sur son dossier, s'il y en a un. */
export async function libelleUsagerEnCours(reservationId: number): Promise<string | null> {
  if (!(await processusActif())) return null;
  const ouvertes = await prisma.dossierEtape.findMany({
    where: { objet: "reservation", objetId: reservationId, status: "ouverte" },
    include: { circuitVersion: true },
    orderBy: { id: "asc" },
  });
  for (const o of ouvertes) {
    const e = lireDefinition(o.circuitVersion.definition).etapes.find((x) => x.cle === o.cle);
    if (e?.libelleUsager.trim()) return e.libelleUsager.trim();
  }
  return null;
}

/**
 * Relance, une fois, chaque étape dont l'échéance est dépassée : les personnes attendues sont
 * prévenues de nouveau, ainsi que le responsable du service du dossier et ceux qui le
 * suivent. L'échéance reste indicative : rien n'est décidé d'office.
 */
export async function relancerEtapesEnRetard(
  now = new Date(),
): Promise<{ relancees: number; accordees: number }> {
  if (!(await processusActif())) return { relancees: 0, accordees: 0 };
  const enRetard = await prisma.dossierEtape.findMany({
    where: { status: "ouverte", echeanceAt: { lt: now }, relanceAt: null },
    include: { circuitVersion: true, reponses: { select: { userId: true } } },
    orderBy: { echeanceAt: "asc" },
  });
  let relancees = 0;
  let accordees = 0;
  for (const o of enRetard) {
    const p = await chargerPorteur(o.objet, o.objetId);
    if (!p) continue;
    const def = lireDefinition(o.circuitVersion.definition).etapes.find((e) => e.cle === o.cle);
    if (!def || !STATUTS_DU_MOMENT[def.moment].includes(p.status)) continue;
    const attendus = restantARepondre(await personnesDe(def.intervenant, p.serviceId), o.reponses);
    const lien = `${p.lien}#circuit`;
    const depuis = o.echeanceAt ? dateCourte(o.echeanceAt) : "";
    // Le circuit tient l'étape pour accordée quand personne n'a répondu dans le délai.
    if (def.aEcheance === "accord") {
      const issue = NATURES[def.nature].issues[0];
      await prisma.dossierEtape.update({
        where: { id: o.id },
        data: {
          status: "validee",
          closAt: now,
          closPar: "automatique",
          commentaire: `Sans réponse à l'échéance du ${depuis} : étape tenue pour accordée.`,
        },
      });
      await p.historiser(
        `${issue} d'office`,
        `${o.libelle} · sans réponse à l'échéance du ${depuis}`,
        "automatique",
      );
      const aPrevenir = new Set<string>([...p.suiveurs, ...attendus.map((a) => a.id)]);
      if (o.ouvertPar) {
        const u = await prisma.user.findFirst({
          where: { ...AGENT_ACTIF, name: o.ouvertPar },
          select: { id: true },
        });
        if (u) aPrevenir.add(u.id);
      }
      await Promise.all(
        [...aPrevenir].map((id) =>
          notifier(
            id,
            typeNotif(p),
            `${issue} d'office · ${p.numero}`,
            `${o.libelle} · sans réponse à l'échéance du ${depuis}`,
            lien,
          ),
        ),
      );
      accordees += 1;
      continue;
    }
    await Promise.all(
      attendus.map((a) =>
        notifier(
          a.id,
          typeNotif(p),
          `En retard · ${o.libelle} · ${p.numero}`,
          `${p.titre} · attendu le ${depuis}`,
          lien,
        ),
      ),
    );
    await courrielEtape("etape_relance", attendus, {
      nature: NATURES[def.nature].label,
      etape: o.libelle,
      numero: p.numero,
      titre: p.titre,
      detail: p.detail,
      lien,
      echeance: o.echeanceAt,
    });
    // Ceux qui attendent la réponse : le responsable du service et ceux qui suivent le dossier.
    const service = p.serviceId
      ? await prisma.service.findUnique({
          where: { id: p.serviceId },
          select: { responsableId: true },
        })
      : null;
    const suiveurs = new Set(
      [service?.responsableId, ...p.suiveurs].filter((x): x is string => Boolean(x)),
    );
    for (const a of attendus) suiveurs.delete(a.id);
    await Promise.all(
      [...suiveurs].map((id) =>
        notifier(
          id,
          typeNotif(p),
          `Étape en retard · ${p.numero}`,
          `${o.libelle} · attendue le ${depuis} · ${attendus.map((a) => a.name).join(", ") || "personne n'est désigné"}`,
          lien,
        ),
      ),
    );
    await prisma.dossierEtape.update({ where: { id: o.id }, data: { relanceAt: now } });
    await p.historiser(
      "Étape en retard relancée",
      `${o.libelle} · attendue le ${depuis}`,
      "automatique",
    );
    relancees += 1;
  }
  return { relancees, accordees };
}

// ── Mes étapes en attente ──

export type EtapeEnAttente = {
  id: number;
  libelle: string;
  nature: keyof typeof NATURES;
  contexte: string | null;
  ouvertAt: Date;
  ouvertPar: string | null;
  echeanceAt: Date | null;
  intervenant: string;
  dossier: {
    objet: Objet;
    id: number;
    numero: string;
    title: string;
    /** Une ligne qui situe le dossier. */
    detail: string;
    lien: string;
    demandeur: string;
    service: string | null;
  };
  /** L'utilisateur fait-il partie des personnes attendues ? */
  pourMoi: boolean;
};

/** Les étapes ouvertes : celles qui attendent l'utilisateur, ou toutes (`toutes`). */
export async function etapesEnAttente(
  user: CurrentUser,
  toutes = false,
  /** Garde les étapes auxquelles l'utilisateur a déjà répondu (accès à la fiche). */
  avecRepondues = false,
): Promise<EtapeEnAttente[]> {
  if (!user.isAgent || !(await processusActif())) return [];
  const ouvertes = await prisma.dossierEtape.findMany({
    where: { status: "ouverte" },
    include: { circuitVersion: true, reponses: { select: { userId: true } } },
    orderBy: { ouvertAt: "asc" },
  });
  if (!ouvertes.length) return [];
  const services = new Map(
    (await prisma.service.findMany({ select: { id: true, name: true } })).map((x) => [
      x.id,
      x.name,
    ]),
  );
  const porteurs = new Map<string, Porteur | null>();
  const out: EtapeEnAttente[] = [];
  for (const o of ouvertes) {
    const cle = `${o.objet}:${o.objetId}`;
    if (!porteurs.has(cle)) porteurs.set(cle, await chargerPorteur(o.objet, o.objetId));
    const p = porteurs.get(cle);
    if (!p) continue;
    const def = lireDefinition(o.circuitVersion.definition).etapes.find((e) => e.cle === o.cle);
    // Une étape ne s'attend plus une fois passé le moment qu'elle précède.
    if (!def || !STATUTS_DU_MOMENT[def.moment].includes(p.status)) continue;
    const attendu = (await personnesDe(def.intervenant, p.serviceId)).some((a) => a.id === user.id);
    const pourMoi = attendu && !o.reponses.some((r) => r.userId === user.id);
    if (!pourMoi && !toutes && !(attendu && avecRepondues)) continue;
    out.push({
      id: o.id,
      libelle: o.libelle,
      nature: def.nature,
      contexte: o.contexte,
      ouvertAt: o.ouvertAt,
      ouvertPar: o.ouvertPar,
      echeanceAt: o.echeanceAt,
      intervenant: String((o.intervenant as { libelle?: string } | null)?.libelle ?? ""),
      dossier: {
        objet: p.objet,
        id: p.id,
        numero: p.numero,
        title: p.titre,
        detail: p.detail,
        lien: p.lien,
        demandeur: p.demandeur,
        service: p.serviceId ? (services.get(p.serviceId) ?? null) : null,
      },
      pourMoi,
    });
  }
  return out;
}

/** L'utilisateur est-il attendu sur une étape ouverte de ce dossier ? (accès à la fiche) */
export async function attenduSur(
  user: CurrentUser,
  id: number,
  objet: Objet = "reservation",
): Promise<boolean> {
  return (await etapesEnAttente(user, false, true)).some(
    (e) => e.dossier.objet === objet && e.dossier.id === id,
  );
}

// ── Versions ──

/** La version en cours de rédaction d'un circuit, créée au besoin depuis la version publiée. */
export async function brouillonDe(
  circuitId: number,
  acteur: string,
): Promise<{ id: number; numero: number; definition: Definition }> {
  const versions = await prisma.circuitVersion.findMany({
    where: { circuitId },
    orderBy: { numero: "desc" },
  });
  const brouillon = versions.find((v) => v.status === "brouillon");
  if (brouillon)
    return {
      id: brouillon.id,
      numero: brouillon.numero,
      definition: lireDefinition(brouillon.definition),
    };
  const base = versions.find((v) => v.status === "publiee") ?? versions[0];
  const definition = lireDefinition(base?.definition);
  const v = await prisma.circuitVersion.create({
    data: {
      circuitId,
      numero: (versions[0]?.numero ?? 0) + 1,
      status: "brouillon",
      definition: definition as unknown as Prisma.InputJsonValue,
      createdBy: acteur,
    },
  });
  return { id: v.id, numero: v.numero, definition };
}

export async function enregistrerBrouillon(
  circuitId: number,
  acteur: string,
  modifier: (d: Definition) => Definition,
): Promise<void> {
  const b = await brouillonDe(circuitId, acteur);
  await prisma.circuitVersion.update({
    where: { id: b.id },
    data: { definition: modifier(b.definition) as unknown as Prisma.InputJsonValue },
  });
}
