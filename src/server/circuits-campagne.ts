/**
 * Processus et circuits, côté campagnes de créneaux.
 *
 * Une campagne suit un circuit à partir de la clôture du dépôt : ses étapes (visa d'un élu,
 * relecture) précèdent l'envoi des décisions aux demandeurs. Les dossiers des créneaux
 * attribués existent déjà à ce moment-là ; c'est la communication des décisions qui attend.
 */
import { aiguiller, type Faits } from "@/lib/circuits";
import { pluriel } from "@/lib/libelles";
import { auditRecord } from "@/server/audit";
import { circuitsEnService, type Porteur, processusActif } from "@/server/circuits";
import { prisma } from "@/server/db";

const INCLUDE = {
  saison: { select: { label: true } },
  service: { select: { name: true } },
  espaces: { select: { espace: { select: { secteur: true } } } },
  voeux: { select: { status: true, organisationId: true } },
} as const;

/** Le secteur d'une campagne : celui de ses espaces s'ils sont tous du même, sinon aucun. */
export function secteurDe(secteurs: readonly string[]): string | null {
  const uniques = [...new Set(secteurs)];
  return uniques.length === 1 ? uniques[0] : null;
}

type CampagnePorteur = {
  id: number;
  label: string;
  status: string;
  serviceId: number | null;
  circuitVersionId: number | null;
  saison: { label: string };
  service: { name: string } | null;
  espaces: { espace: { secteur: string } }[];
  voeux: { status: string; organisationId: number }[];
};

export function faitsCampagne(c: Pick<CampagnePorteur, "espaces">): Faits {
  return { secteur: secteurDe(c.espaces.map((e) => e.espace.secteur)) };
}

/** Une campagne de créneaux vue par le moteur d'étapes. */
export function porteurCampagne(c: CampagnePorteur): Porteur {
  const nb = (s: string) => c.voeux.filter((v) => v.status === s).length;
  return {
    objet: "campagne",
    id: c.id,
    numero: `Campagne ${c.saison.label}`,
    titre: c.label,
    detail: `${pluriel(nb("attribue"), "vœu attribué", "vœux attribués")}, ${pluriel(nb("refuse"), "refusé", "refusés")}, ${nb("en_attente")} en attente`,
    lien: `/campagnes/${c.id}`,
    demandeur: pluriel(
      new Set(c.voeux.map((v) => v.organisationId)).size,
      "organisation",
      "organisations",
    ),
    status: c.status,
    serviceId: c.serviceId,
    circuitVersionId: c.circuitVersionId,
    suiveurs: [],
    faits: faitsCampagne(c),
    // Une campagne n'a pas d'historique propre : la trace va au journal d'audit.
    historiser: (action, comment, acteur) =>
      auditRecord(
        `campagne · ${action}`,
        `${c.label}${comment ? ` · ${comment}` : ""}`,
        "reservations",
        acteur,
      ),
  };
}

export async function porteurCampagneParId(id: number): Promise<Porteur | null> {
  const c = await prisma.campagne.findUnique({ where: { id }, include: INCLUDE });
  return c ? porteurCampagne(c) : null;
}

/**
 * Confie la campagne à un circuit, quand le dépôt se clôt (et, par rattrapage, la première
 * fois qu'on en a besoin). Le service reste celui qui conduit la campagne.
 */
export async function aiguillerCampagne(id: number): Promise<void> {
  if (!(await processusActif())) return;
  const c = await prisma.campagne.findUnique({ where: { id }, include: INCLUDE });
  if (!c || c.circuitVersionId || c.status !== "instruction") return;
  const retenu = aiguiller(await circuitsEnService("campagne"), faitsCampagne(c)).retenu;
  if (retenu)
    await prisma.campagne.update({ where: { id }, data: { circuitVersionId: retenu.versionId } });
}
