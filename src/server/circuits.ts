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
  type Libelles,
  libelleIntervenant,
  lireDefinition,
  NATURES,
  type Referentiel,
} from "@/lib/circuits";
import { plage } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { enabledIn } from "@/server/features";
import type { CurrentUser } from "@/server/guards";
import { notifier } from "@/server/notifications";
import { historiser, type ReservationComplete } from "@/server/reservations";

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

/** Un service est-il suppléé aujourd'hui ? */
function suppleanceEnCours(
  s: { suppleantId: number | null; suppleanceDu: Date | null; suppleanceAu: Date | null },
  jour: string,
): boolean {
  if (!s.suppleantId) return false;
  const du = s.suppleanceDu ? s.suppleanceDu.toISOString().slice(0, 10) : null;
  const au = s.suppleanceAu ? s.suppleanceAu.toISOString().slice(0, 10) : null;
  return (!du || du <= jour) && (!au || jour <= au);
}

/** Les personnes qui agissent pour un service : membres, responsable, et suppléant en cours. */
export async function personnesDuService(serviceId: number): Promise<Personne[]> {
  const s = await prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      responsable: { select: { ...SELECT_PERSONNE, isActive: true } },
      membres: { include: { user: { select: { ...SELECT_PERSONNE, isActive: true } } } },
      suppleant: {
        include: {
          membres: { include: { user: { select: { ...SELECT_PERSONNE, isActive: true } } } },
        },
      },
    },
  });
  if (!s?.isActive) return [];
  const tous = [
    ...s.membres.map((m) => m.user),
    ...(s.responsable ? [s.responsable] : []),
    ...(suppleanceEnCours(s, todayParisISO()) && s.suppleant?.isActive
      ? s.suppleant.membres.map((m) => m.user)
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
  const [espaces, sites, profils] = await Promise.all([
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
  ]);
  return {
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
  } | null;
};

export type EtatCircuit = {
  circuit: { id: number; name: string } | null;
  version: { id: number; numero: number; status: string } | null;
  service: { id: number; name: string; email: string | null; phone: string | null } | null;
  etapes: EtapeDossier[];
  /** Les étapes qui retiennent encore l'acceptation. */
  retenues: EtapeDossier[];
};

/** Le circuit d'un dossier et l'état de ses étapes applicables. */
export async function etatCircuit(r: ReservationComplete): Promise<EtatCircuit | null> {
  if (!r.circuitVersionId || !(await processusActif())) return null;
  const [v, service, ouvertures, ref] = await Promise.all([
    prisma.circuitVersion.findUnique({
      where: { id: r.circuitVersionId },
      include: { circuit: true },
    }),
    r.serviceId
      ? prisma.service.findUnique({
          where: { id: r.serviceId },
          select: { id: true, name: true, email: true, phone: true },
        })
      : null,
    prisma.dossierEtape.findMany({
      where: { objet: "reservation", objetId: r.id },
      orderBy: { id: "desc" },
    }),
    referentiel(),
  ]);
  if (!v) return null;
  const def = lireDefinition(v.definition);
  const faits = faitsReservation(r);
  const etapes: EtapeDossier[] = [];
  for (const e of def.etapes) {
    const derniere = ouvertures.find((o) => o.cle === e.cle && o.circuitVersionId === v.id) ?? null;
    // Une étape déjà ouverte reste affichée même si sa condition n'est plus vraie.
    const applicable = etapesApplicables({ ...def, etapes: [e] }, faits).length > 0;
    if (!applicable && (!derniere || derniere.status === "annulee")) continue;
    etapes.push({
      ...e,
      etat: etatEtape(derniere),
      bloquante: NATURES[e.nature].bloquante && applicable,
      attendus: await personnesDe(e.intervenant, r.serviceId),
      libelleIntervenant: libelleIntervenant(e.intervenant, ref),
      derniere,
    });
  }
  return {
    circuit: { id: v.circuit.id, name: v.circuit.name },
    version: { id: v.id, numero: v.numero, status: v.status },
    service,
    etapes,
    retenues: etapesRetenant(etapes.filter((e) => e.bloquante)),
  };
}

/** Ouvre une étape sur un dossier et prévient les personnes attendues. */
export async function ouvrirEtape(
  r: ReservationComplete,
  e: EtapeDossier,
  acteur: string,
  contexte: string | null,
): Promise<void> {
  if (!r.circuitVersionId) return;
  if (!e.attendus.length)
    throw new UserFacingError(
      `Personne ne peut répondre à l'étape « ${e.libelle} » (${e.libelleIntervenant}) : prévenez un administrateur.`,
    );
  await prisma.dossierEtape.updateMany({
    where: { objet: "reservation", objetId: r.id, cle: e.cle, status: "ouverte" },
    data: { status: "annulee", closAt: new Date(), closPar: acteur },
  });
  await prisma.dossierEtape.create({
    data: {
      objet: "reservation",
      objetId: r.id,
      circuitVersionId: r.circuitVersionId,
      cle: e.cle,
      libelle: e.libelle,
      nature: e.nature,
      intervenant: { libelle: e.libelleIntervenant } as Prisma.InputJsonValue,
      contexte: contexte?.trim() || null,
      ouvertPar: acteur,
      echeanceAt: e.delaiJours ? new Date(Date.now() + e.delaiJours * JOUR) : null,
    },
  });
  await historiser(
    r.id,
    `${NATURES[e.nature].label} demandé${e.nature === "relecture" ? "e" : ""}`,
    `${e.libelle} · ${e.libelleIntervenant}${contexte?.trim() ? ` · ${contexte.trim()}` : ""}`,
    acteur,
  );
  await Promise.all(
    e.attendus.map((p) =>
      notifier(
        p.id,
        "reservation",
        `${NATURES[e.nature].label} attendu${e.nature === "relecture" ? "e" : ""} · ${r.numero}`,
        `${e.libelle} · ${r.title} · ${plage(r.startAt, r.endAt)}`,
        `/reservations/${r.id}#circuit`,
      ),
    ),
  );
}

/** Ouvre les étapes applicables pas encore demandées ; renvoie celles qui viennent de l'être. */
export async function ouvrirEtapesPrealables(
  r: ReservationComplete,
  etat: EtatCircuit,
  acteur: string,
  contexte: string | null = null,
): Promise<EtapeDossier[]> {
  const aOuvrir = etat.etapes.filter(
    (e) => e.etat === "a_demander" && e.moment === "avant_acceptation",
  );
  for (const e of aOuvrir) await ouvrirEtape(r, e, acteur, contexte);
  return aOuvrir;
}

/** Un dossier refusé ou annulé n'attend plus personne : ses étapes ouvertes sont closes. */
export async function cloreEtapesOuvertes(reservationId: number, acteur: string): Promise<void> {
  await prisma.dossierEtape.updateMany({
    where: { objet: "reservation", objetId: reservationId, status: "ouverte" },
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
  const etat = await etatCircuit(r);
  if (!etat) return;
  // Les avis applicables partent avec la première tentative, sans rien retenir.
  const aOuvrir = await ouvrirEtapesPrealables(r, etat, acteur.name, contexte);
  if (!etat.retenues.length) return;
  const refusees = etat.retenues.filter((e) => e.etat === "refusee");
  if (refusees.length)
    throw new UserFacingError(
      `Acceptation impossible : ${refusees.map((e) => `« ${e.libelle} » a été refusé${e.nature === "relecture" ? "e" : ""}`).join(" ; ")}. Modifiez le dossier puis redemandez l'étape, ou déclinez la demande.`,
    );
  const nouvelles = etat.retenues.filter((e) => aOuvrir.some((o) => o.cle === e.cle));
  const enCours = etat.retenues.filter((e) => !nouvelles.includes(e));
  const dire = (es: EtapeDossier[]) =>
    es.map((e) => `« ${e.libelle} » (${e.libelleIntervenant})`).join(", ");
  throw new UserFacingError(
    [
      "Le dossier n'est pas encore accepté : son circuit demande une étape préalable.",
      nouvelles.length ? `Demandé à l'instant : ${dire(nouvelles)}.` : "",
      enCours.length ? `En attente de réponse : ${dire(enCours)}.` : "",
      "Vous serez prévenu de la réponse ; il restera à approuver.",
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
  r: ReservationComplete,
  etapeId: number,
  user: CurrentUser,
  accord: boolean,
  commentaire: string | null,
): Promise<string> {
  const etat = await etatCircuit(r);
  const e = etat?.etapes.find((x) => x.derniere?.id === etapeId);
  const ouverture = e?.derniere;
  if (!e || ouverture?.status !== "ouverte")
    throw new UserFacingError("Cette étape n'attend plus de réponse.");
  if (!(await peutRepondre(user, r, e)))
    throw new UserFacingError(`Cette étape s'adresse à : ${e.libelleIntervenant}.`);
  const texte = commentaire?.trim() || null;
  if (!accord && !texte)
    throw new UserFacingError("Indiquez le motif : il est lu par le service qui instruit.");
  await prisma.dossierEtape.update({
    where: { id: etapeId },
    data: {
      status: accord ? "validee" : "refusee",
      closAt: new Date(),
      closPar: user.name,
      commentaire: texte,
    },
  });
  const issue = NATURES[e.nature].issues[accord ? 0 : 1];
  await historiser(r.id, issue, `${e.libelle}${texte ? ` · ${texte}` : ""}`, user.name);
  await auditRecord(
    `etape ${accord ? "validee" : "refusee"}`,
    `${r.numero} · ${e.libelle}`,
    "reservations",
    user.email,
  );
  // Le demandeur de l'étape et l'agent assigné sont prévenus de la réponse.
  const aPrevenir = new Set<string>();
  if (r.agentId) aPrevenir.add(r.agentId);
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
        "reservation",
        `${issue} · ${r.numero}`,
        `${e.libelle} · ${user.name}${texte ? ` · ${texte}` : ""}`,
        `/reservations/${r.id}#circuit`,
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
    id: number;
    numero: string;
    title: string;
    startAt: Date;
    endAt: Date;
    espace: string;
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
): Promise<EtapeEnAttente[]> {
  if (!user.isAgent || !(await processusActif())) return [];
  const ouvertes = await prisma.dossierEtape.findMany({
    where: { objet: "reservation", status: "ouverte" },
    include: { circuitVersion: true },
    orderBy: { ouvertAt: "asc" },
  });
  if (!ouvertes.length) return [];
  const dossiers = await prisma.reservation.findMany({
    where: { id: { in: ouvertes.map((o) => o.objetId) } },
    select: {
      id: true,
      numero: true,
      title: true,
      startAt: true,
      endAt: true,
      serviceId: true,
      status: true,
      espace: { select: { name: true } },
      organisation: { select: { name: true } },
      service: { select: { name: true } },
    },
  });
  const parId = new Map(dossiers.map((d) => [d.id, d]));
  const out: EtapeEnAttente[] = [];
  for (const o of ouvertes) {
    const d = parId.get(o.objetId);
    // Une étape ne s'attend plus sur un dossier déjà décidé ou clos.
    if (!d || !["a_traiter", "en_traitement"].includes(d.status)) continue;
    const def = lireDefinition(o.circuitVersion.definition).etapes.find((e) => e.cle === o.cle);
    if (!def) continue;
    const pourMoi = (await personnesDe(def.intervenant, d.serviceId)).some((p) => p.id === user.id);
    if (!pourMoi && !toutes) continue;
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
        id: d.id,
        numero: d.numero,
        title: d.title,
        startAt: d.startAt,
        endAt: d.endAt,
        espace: d.espace.name,
        demandeur: d.organisation?.name ?? "—",
        service: d.service?.name ?? null,
      },
      pourMoi,
    });
  }
  return out;
}

/** L'utilisateur est-il attendu sur une étape ouverte de ce dossier ? (accès à la fiche) */
export async function attenduSur(user: CurrentUser, reservationId: number): Promise<boolean> {
  return (await etapesEnAttente(user)).some((e) => e.dossier.id === reservationId);
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
