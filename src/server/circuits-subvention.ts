/**
 * Processus et circuits, côté subventions.
 *
 * Le circuit d'un dossier de subvention dit deux choses :
 * - quel SERVICE l'instruit (les associations sportives au Service des sports, par exemple) ;
 * - à quels ÉLUS l'avis est demandé quand le dossier leur est soumis (étapes du moment
 *   « avis des élus », adressées à une délégation, un service ou un rôle).
 *
 * Le cycle du dossier (déposé, instruction, avis des élus, voté, versé) ne change pas.
 */
import {
  aiguiller,
  etapesApplicables,
  type Faits,
  libelleIntervenant,
  lireDefinition,
} from "@/lib/circuits";
import { montant } from "@/lib/libelles";
import {
  circuitsEnService,
  type Personne,
  type Porteur,
  personnesDe,
  processusActif,
  referentiel,
} from "@/server/circuits";
import { prisma } from "@/server/db";
import type { CurrentUser } from "@/server/guards";
import { notifier } from "@/server/notifications";

type DossierFaits = {
  type: string;
  nature: string;
  montantDemande: number;
  secteurId: number | null;
  organisation: { sportive: boolean; conventionnee: boolean };
};

/** Ce que les règles peuvent lire d'un dossier de subvention. */
export function faitsSubvention(s: DossierFaits): Faits {
  return {
    sportive: s.organisation.sportive,
    conventionnee: s.organisation.conventionnee,
    type_subvention: s.type,
    nature_demande: s.nature,
    secteur_instruction: s.secteurId ? String(s.secteurId) : null,
    montant_demande: s.montantDemande,
  };
}

/** Tant que le dossier n'est pas soumis aux élus, son circuit peut encore changer. */
const AIGUILLABLE = ["brouillon", "deposee", "instruction"];

/**
 * Confie un dossier à un circuit et à un service instructeur : au dépôt, puis de nouveau si
 * le secteur d'instruction change avant la soumission aux élus. `acteur` : trace dans
 * l'historique quand le circuit ou le service change.
 */
export async function aiguillerSubvention(id: number, acteur: string | null = null): Promise<void> {
  if (!(await processusActif())) return;
  const s = await prisma.subvention.findUnique({
    where: { id },
    include: { organisation: { select: { sportive: true, conventionnee: true } } },
  });
  if (!s || !AIGUILLABLE.includes(s.status)) return;
  const retenu = aiguiller(await circuitsEnService("subvention"), faitsSubvention(s)).retenu;
  const circuitVersionId = retenu?.versionId ?? null;
  const serviceId = retenu?.definition.serviceId ?? null;
  if (circuitVersionId === s.circuitVersionId && serviceId === s.serviceId) return;
  await prisma.subvention.update({ where: { id }, data: { circuitVersionId, serviceId } });
  if (acteur && (s.circuitVersionId || s.serviceId)) {
    const service = serviceId
      ? await prisma.service.findUnique({ where: { id: serviceId }, select: { name: true } })
      : null;
    await prisma.subventionHistory.create({
      data: {
        subventionId: id,
        action: "Circuit modifié",
        comment: `${retenu?.name ?? "Aucun circuit"}${service ? ` · instruction par ${service.name}` : ""}`,
        performedBy: acteur,
      },
    });
  }
}

export type Consultation = {
  circuit: { id: number; name: string; numero: number } | null;
  service: { id: number; name: string; email: string | null; phone: string | null } | null;
  /** Les avis que le circuit demande pour ce dossier. */
  etapes: {
    cle: string;
    libelle: string;
    libelleIntervenant: string;
    attendus: Personne[];
    delaiJours: number;
  }[];
  /** Toutes les personnes consultées. */
  consultes: Personne[];
  /** Le circuit nomme les personnes consultées : l'avis leur est réservé. */
  restreinte: boolean;
};

/** Le circuit d'un dossier de subvention : service instructeur et élus consultés. */
export async function consultation(s: {
  serviceId: number | null;
  circuitVersionId: number | null;
  type: string;
  nature: string;
  montantDemande: number;
  secteurId: number | null;
  organisation: { sportive: boolean; conventionnee: boolean };
}): Promise<Consultation | null> {
  if (!(await processusActif())) return null;
  if (!s.circuitVersionId && !s.serviceId) return null;
  const [v, service, ref] = await Promise.all([
    s.circuitVersionId
      ? prisma.circuitVersion.findUnique({
          where: { id: s.circuitVersionId },
          include: { circuit: true },
        })
      : null,
    s.serviceId
      ? prisma.service.findUnique({
          where: { id: s.serviceId },
          select: { id: true, name: true, email: true, phone: true },
        })
      : null,
    referentiel(),
  ]);
  const applicables = v
    ? etapesApplicables(lireDefinition(v.definition), faitsSubvention(s), "avis_elus")
    : [];
  const etapes: Consultation["etapes"] = [];
  for (const e of applicables)
    etapes.push({
      cle: e.cle,
      libelle: e.libelle,
      libelleIntervenant: libelleIntervenant(e.intervenant, ref),
      attendus: await personnesDe(e.intervenant, s.serviceId),
      delaiJours: e.delaiJours,
    });
  const consultes = [...new Map(etapes.flatMap((e) => e.attendus).map((p) => [p.id, p])).values()];
  return {
    circuit: v ? { id: v.circuit.id, name: v.circuit.name, numero: v.numero } : null,
    service,
    etapes,
    consultes,
    restreinte: etapes.length > 0,
  };
}

/** Prévient les personnes consultées qu'un dossier attend leur avis. */
export async function notifierConsultes(s: {
  id: number;
  numero: string;
  objet: string;
  serviceId: number | null;
  circuitVersionId: number | null;
  type: string;
  nature: string;
  montantDemande: number;
  secteurId: number | null;
  organisation: { name: string; sportive: boolean; conventionnee: boolean };
}): Promise<number> {
  const c = await consultation(s);
  if (!c?.consultes.length) return 0;
  await Promise.all(
    c.consultes.map((p) =>
      notifier(
        p.id,
        "subvention",
        `Avis attendu · ${s.numero}`,
        `${s.organisation.name} · ${s.objet}`,
        `/subventions/${s.id}#avis`,
      ),
    ),
  );
  const { courrielEtape } = await import("@/server/circuits");
  await courrielEtape("etape_demandee", c.consultes, {
    nature: "Avis",
    etape: "Avis sur la demande de subvention",
    numero: s.numero,
    titre: s.objet,
    detail: `${s.organisation.name} · ${montant(s.montantDemande)} demandés`,
    lien: `/subventions/${s.id}#avis`,
  });
  return c.consultes.length;
}

export type AvisAttendu = {
  id: number;
  numero: string;
  objet: string;
  association: string;
  montantDemande: number;
  exercice: number;
  libelle: string;
  intervenant: string;
  service: string | null;
  depuis: Date;
  /** L'utilisateur est consulté et n'a pas encore donné son avis. */
  pourMoi: boolean;
};

/** Les dossiers soumis aux élus dont un avis nommé par le circuit manque encore. */
export async function avisAttendus(user: CurrentUser, tous = false): Promise<AvisAttendu[]> {
  if (!user.isAgent || !(await processusActif())) return [];
  const dossiers = await prisma.subvention.findMany({
    where: { status: "avis", circuitVersionId: { not: null } },
    include: {
      organisation: { select: { name: true, sportive: true, conventionnee: true } },
      avis: { select: { authorId: true } },
      service: { select: { name: true } },
      histories: { where: { action: "Avis des élus" }, orderBy: { performedAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "asc" },
  });
  const out: AvisAttendu[] = [];
  for (const s of dossiers) {
    const c = await consultation(s);
    if (!c?.restreinte) continue;
    const donnes = new Set(s.avis.map((a) => a.authorId));
    for (const e of c.etapes) {
      // Une étape est satisfaite dès qu'une des personnes attendues a donné son avis.
      if (e.attendus.some((p) => donnes.has(p.id))) continue;
      const pourMoi = e.attendus.some((p) => p.id === user.id);
      if (!pourMoi && !tous) continue;
      out.push({
        id: s.id,
        numero: s.numero,
        objet: s.objet,
        association: s.organisation.name,
        montantDemande: s.montantDemande,
        exercice: s.exercice,
        libelle: e.libelle,
        intervenant: e.libelleIntervenant,
        service: s.service?.name ?? null,
        depuis: s.histories[0]?.performedAt ?? s.updatedAt,
        pourMoi,
      });
    }
  }
  return out;
}

// ── Étapes du moteur (visa, relecture avant le vote) ──

type SubventionPorteur = {
  id: number;
  numero: string;
  objet: string;
  status: string;
  exercice: number;
  type: string;
  nature: string;
  montantDemande: number;
  secteurId: number | null;
  serviceId: number | null;
  circuitVersionId: number | null;
  organisation: { name: string; sportive: boolean; conventionnee: boolean };
};

/** Une demande de subvention vue par le moteur d'étapes. */
export function porteurSubvention(s: SubventionPorteur): Porteur {
  return {
    objet: "subvention",
    id: s.id,
    numero: s.numero,
    titre: s.objet,
    detail: `${s.organisation.name} · exercice ${s.exercice} · ${montant(s.montantDemande)} demandés`,
    lien: `/subventions/${s.id}`,
    demandeur: s.organisation.name,
    status: s.status,
    serviceId: s.serviceId,
    circuitVersionId: s.circuitVersionId,
    suiveurs: [],
    faits: faitsSubvention(s),
    historiser: async (action, comment, acteur) => {
      await prisma.subventionHistory.create({
        data: { subventionId: s.id, action, comment, performedBy: acteur },
      });
    },
  };
}

export async function porteurSubventionParId(id: number): Promise<Porteur | null> {
  const s = await prisma.subvention.findUnique({
    where: { id },
    include: { organisation: { select: { name: true, sportive: true, conventionnee: true } } },
  });
  return s ? porteurSubvention(s) : null;
}
