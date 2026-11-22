/**
 * Jeu de démonstration du module Processus et circuits : les services de la Ville, une
 * délégation d'élu et un circuit par service, puis l'aiguillage des dossiers déjà créés.
 *
 * Appelé en fin de `prisma/seed-demo.ts` ; se lance aussi seul sur une base de démonstration
 * existante (rien n'est recréé si les services sont déjà là) :
 *
 *   pnpm tsx prisma/seed-processus.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Prisma } from "@/generated/prisma/client";
import {
  aiguiller,
  type Condition,
  type Definition,
  type Etape,
  lireDefinition,
} from "@/lib/circuits";
import { poserMotDePasse, seedCircuitStandard } from "@/server/amorcage";
import { circuitsEnService, faitsReservation } from "@/server/circuits";
import { faitsSubvention } from "@/server/circuits-subvention";
import { prisma } from "@/server/db";

const AUTEUR = "Jeu de démonstration";

/** Le visa de l'élu quand un agent accorde la gratuité hors grille. */
const visaGratuite = (delegationId: number): Etape => ({
  cle: "visa-gratuite",
  libelle: "Visa de l'élu sur la gratuité",
  libelleUsager: "Votre demande est en cours de validation",
  nature: "visa",
  moment: "avant_acceptation",
  intervenant: { type: "delegation", id: delegationId },
  condition: { mode: "tous", tests: [{ champ: "gratuite_accordee", op: "est", valeur: true }] },
  delaiJours: 10,
});

const regle = (...tests: Condition["tests"]): Condition => ({ mode: "tous", tests });

/** Le dossier de démonstration sur lequel un visa attend l'élu. */
const DOSSIER_VISA = "R260008";
const FONDEMENT = "Manifestation caritative ouverte aux Châtillonnais";

/**
 * Une étape en attente, pour que « Mes étapes » ne soit pas vide : la gestionnaire a voulu
 * accorder la gratuité à une association extérieure, son circuit a demandé le visa de l'élu.
 */
async function creerEtapeDemo(): Promise<number> {
  if ((await prisma.dossierEtape.count()) > 0) return 0;
  const r = await prisma.reservation.findUnique({
    where: { numero: DOSSIER_VISA },
    include: { circuitVersion: true },
  });
  if (!r?.circuitVersion || r.status !== "a_traiter") return 0;
  const etape = lireDefinition(r.circuitVersion.definition).etapes.find(
    (e) => e.cle === "visa-gratuite",
  );
  const delegation =
    etape?.intervenant.type === "delegation"
      ? await prisma.delegation.findUnique({ where: { id: etape.intervenant.id } })
      : null;
  if (!etape || !delegation) return 0;
  const quand = new Date(Date.now() - 2 * 86_400_000);
  const contexte = `Gratuité demandée : ${FONDEMENT}`;
  await prisma.reservation.update({
    where: { id: r.id },
    data: {
      gratuit: true,
      gratuitMotif: FONDEMENT,
      montantHt: 0,
      montantTtc: 0,
      acompte: 0,
      caution: 0,
    },
  });
  await prisma.dossierEtape.create({
    data: {
      objet: "reservation",
      objetId: r.id,
      circuitVersionId: r.circuitVersion.id,
      cle: etape.cle,
      libelle: etape.libelle,
      nature: etape.nature,
      intervenant: { libelle: `Élu · ${delegation.label}` },
      contexte,
      ouvertAt: quand,
      ouvertPar: "Sophie Martin",
      echeanceAt: new Date(quand.getTime() + etape.delaiJours * 86_400_000),
    },
  });
  await prisma.reservationHistory.create({
    data: {
      reservationId: r.id,
      action: "Visa demandé",
      comment: `${etape.libelle} · Élu · ${delegation.label} · ${contexte}`,
      performedBy: "Sophie Martin",
      performedAt: quand,
    },
  });
  if (delegation.userId)
    await prisma.notification.create({
      data: {
        userId: delegation.userId,
        type: "reservation",
        title: `Visa attendu · ${r.numero}`,
        body: `${etape.libelle} · ${r.title}`,
        link: `/reservations/${r.id}#circuit`,
        createdAt: quand,
      },
    });
  return 1;
}

/**
 * Les circuits des subventions : les associations sportives sont instruites par le Service des
 * sports, les autres par la Vie associative ; l'avis est demandé à l'élu de la délégation.
 * Les dossiers déjà déposés rejoignent leur circuit, sans trace dans leur historique.
 */
async function creerCircuitsSubventionDemo(): Promise<number> {
  if ((await prisma.circuit.count({ where: { objet: "subvention" } })) > 0) return 0;
  const [sports, vieAsso, delegation] = await Promise.all([
    prisma.service.findUnique({ where: { name: "Service des sports" } }),
    prisma.service.findUnique({ where: { name: "Vie associative" } }),
    prisma.delegation.findFirst({ orderBy: { id: "asc" } }),
  ]);
  if (!sports || !vieAsso || !delegation) return 0;
  const avisElu: Etape = {
    cle: "avis-elu",
    libelle: "Avis de l'élu délégué",
    libelleUsager: "",
    nature: "avis",
    moment: "avis_elus",
    intervenant: { type: "delegation", id: delegation.id },
    condition: null,
    delaiJours: 15,
  };
  const circuit = (
    position: number,
    name: string,
    description: string,
    parDefaut: boolean,
    def: Definition,
  ) =>
    prisma.circuit.create({
      data: {
        objet: "subvention",
        name,
        description,
        position,
        parDefaut,
        versions: {
          create: {
            numero: 1,
            status: "publiee",
            definition: def as unknown as Prisma.InputJsonValue,
            createdBy: AUTEUR,
            publiePar: AUTEUR,
            publieAt: new Date(),
            note: "Version initiale",
          },
        },
      },
    });
  await circuit(
    10,
    "Subventions · associations sportives",
    "Les demandes des associations sportives, instruites par le Service des sports",
    false,
    {
      condition: regle({ champ: "sportive", op: "est", valeur: true }),
      serviceId: sports.id,
      etapes: [avisElu],
    },
  );
  await circuit(
    0,
    "Subventions · autres associations",
    "Toute autre demande de subvention, instruite par la Vie associative",
    true,
    { condition: null, serviceId: vieAsso.id, etapes: [avisElu] },
  );
  const circuits = await circuitsEnService("subvention");
  const dossiers = await prisma.subvention.findMany({
    where: { status: { not: "brouillon" } },
    include: { organisation: { select: { sportive: true, conventionnee: true } } },
    orderBy: { id: "asc" },
  });
  for (const s of dossiers) {
    const retenu = aiguiller(circuits, faitsSubvention(s)).retenu;
    if (retenu)
      await prisma.subvention.update({
        where: { id: s.id },
        data: { circuitVersionId: retenu.versionId, serviceId: retenu.definition.serviceId },
      });
  }
  return 2;
}

/**
 * Le rôle « Agent instructeur » : celui de l'agent, avec l'écriture sur les subventions. Il
 * est donné à Karim Benali, qui instruit les dossiers des associations sportives : le service
 * désigne ses dossiers, le rôle lui donne le droit de les instruire.
 */
async function creerRoleInstructeur(): Promise<void> {
  const agent = await prisma.role.findUnique({ where: { name: "agent" } });
  if (!agent) return;
  const permissions = {
    ...((agent.permissions as Record<string, number> | null) ?? {}),
    subventions: 2,
  };
  const role = {
    label: "Agent instructeur",
    description: "Comme l'agent, et instruit les demandes de subvention de son service.",
    permissions,
  };
  await prisma.role.upsert({
    where: { name: "agent-instructeur" },
    create: { name: "agent-instructeur", isAdmin: false, isUsager: false, ...role },
    update: role,
  });
  await prisma.user.updateMany({
    where: { email: "karim.benali@exemple.fr" },
    data: { role: "agent-instructeur" },
  });
}

/**
 * Un compte par service, pour dérouler les scénarios à plusieurs mains sans passer par
 * l'administration : un agent du Service des fêtes, une chargée de communication, une
 * régisseuse (sans service : elle encaisse pour tous). Créés en fin de jeu, sans tirage
 * aléatoire, ils ne décalent aucune autre donnée.
 */
export const COMPTES_SERVICES = [
  {
    email: "nadia.lefevre@exemple.fr",
    prenom: "Nadia",
    nom: "Lefèvre",
    role: "agent",
    secteur: "salle",
    fonction: "Chargée de la location de salles",
    phone: "01 46 57 03 35",
    service: "Service des fêtes",
    responsable: false,
  },
  {
    email: "camille.roche@exemple.fr",
    prenom: "Camille",
    nom: "Roche",
    role: "agent",
    secteur: "salle",
    fonction: "Chargée de communication",
    phone: "01 46 57 03 12",
    service: "Communication",
    responsable: true,
  },
  {
    email: "helene.petit@exemple.fr",
    prenom: "Hélène",
    nom: "Petit",
    role: "financier",
    secteur: null,
    fonction: "Régisseuse de recettes",
    phone: "01 46 57 03 08",
    service: null,
    responsable: false,
  },
] as const;

/** Le mot de passe commun des comptes de démonstration, tel que le README l'annonce. */
function motDePasseDemo(): string {
  const lu = /mot de passe commun \*\*`([^`]+)`\*\*/.exec(readFileSync("README.md", "utf8"))?.[1];
  if (!lu) throw new Error("Mot de passe de démonstration introuvable dans le README.");
  return lu;
}

async function creerComptesServices(motDePasse?: string): Promise<number> {
  let crees = 0;
  for (const c of COMPTES_SERVICES) {
    let u = await prisma.user.findUnique({ where: { email: c.email }, select: { id: true } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          email: c.email,
          name: `${c.prenom} ${c.nom}`,
          firstName: c.prenom,
          lastName: c.nom,
          phone: c.phone,
          fonction: c.fonction,
          kind: "agent",
          role: c.role,
          secteur: c.secteur,
        },
        select: { id: true },
      });
      await poserMotDePasse(u.id, motDePasse ?? motDePasseDemo());
      crees += 1;
    }
    if (!c.service) continue;
    const s = await prisma.service.findUnique({ where: { name: c.service } });
    if (!s) continue;
    await prisma.serviceMembre.createMany({
      data: [{ serviceId: s.id, userId: u.id }],
      skipDuplicates: true,
    });
    if (c.responsable && !s.responsableId)
      await prisma.service.update({ where: { id: s.id }, data: { responsableId: u.id } });
  }
  return crees;
}

export async function creerProcessusDemo(motDePasse?: string): Promise<Record<string, number>> {
  await seedCircuitStandard();
  await creerRoleInstructeur();
  if ((await prisma.service.count()) > 0)
    return {
      services: 0,
      comptes: await creerComptesServices(motDePasse),
      circuits: await creerCircuitsSubventionDemo(),
      dossiers: 0,
      etapes: await creerEtapeDemo(),
    };
  const compte = async (email: string) =>
    (await prisma.user.findUnique({ where: { email }, select: { id: true } }))?.id ?? null;
  const [sophie, karim, pierre] = await Promise.all([
    compte("sophie.martin@exemple.fr"),
    compte("karim.benali@exemple.fr"),
    compte("pierre.durand@exemple.fr"),
  ]);

  const service = async (
    position: number,
    name: string,
    description: string,
    email: string,
    membre: string | null,
    usagerTypes: string[] = [],
    usagersSportifs: boolean | null = null,
  ) =>
    prisma.service.create({
      data: {
        name,
        description,
        email,
        position,
        usagerTypes,
        usagersSportifs,
        responsableId: membre,
        membres: membre ? { create: { userId: membre } } : undefined,
      },
    });
  const sports = await service(
    1,
    "Service des sports",
    "Équipements sportifs et créneaux des associations sportives, personnel de service",
    "sports@exemple.fr",
    karim,
    ["association"],
    true,
  );
  const vieAsso = await service(
    2,
    "Vie associative",
    "Salles municipales mises à disposition des associations, subventions",
    "vie.associative@exemple.fr",
    sophie,
    ["association"],
    false,
  );
  const fetes = await service(
    3,
    "Service des fêtes",
    "Location des salles municipales aux particuliers et aux entreprises",
    "fetes@exemple.fr",
    sophie,
    ["particulier", "entreprise"],
  );
  await service(
    4,
    "Communication",
    "Suit et relit les dossiers de la Vie associative et du Service des fêtes, les remplace au besoin",
    "communication@exemple.fr",
    null,
  );
  const delegation = await prisma.delegation.create({
    data: { label: "Sports, vie associative et fêtes", userId: pierre },
  });

  const circuit = async (position: number, name: string, description: string, def: Definition) =>
    prisma.circuit.create({
      data: {
        objet: "reservation",
        name,
        description,
        position,
        versions: {
          create: {
            numero: 1,
            status: "publiee",
            definition: def as unknown as Prisma.InputJsonValue,
            createdBy: AUTEUR,
            publiePar: AUTEUR,
            publieAt: new Date(),
            note: "Version initiale",
          },
        },
      },
    });
  const etapes = [visaGratuite(delegation.id)];
  // Réquisitionner le créneau d'une association pour la Ville demande le visa de l'élu.
  const visaRequisition: Etape = {
    cle: "visa-requisition",
    libelle: "Visa de l'élu sur la réquisition",
    libelleUsager: "",
    nature: "visa",
    moment: "avant_requisition",
    intervenant: { type: "delegation", id: delegation.id },
    condition: null,
    delaiJours: 3,
  };
  // Refuser une location passe par le responsable du service.
  const visaRefus: Etape = {
    cle: "visa-refus",
    libelle: "Visa du responsable sur le refus",
    libelleUsager: "",
    nature: "visa",
    moment: "avant_refus",
    intervenant: { type: "responsable_dossier" },
    condition: null,
    delaiJours: 2,
  };
  await circuit(
    10,
    "Équipements sportifs",
    "Toute demande d'un gymnase, d'un stade, d'un terrain",
    {
      condition: regle({ champ: "secteur", op: "parmi", valeur: ["sport"] }),
      serviceId: sports.id,
      etapes,
    },
  );
  await circuit(
    20,
    "Salles · associations",
    "Les salles municipales demandées par une association",
    {
      condition: regle(
        { champ: "secteur", op: "parmi", valeur: ["salle"] },
        { champ: "type_demandeur", op: "parmi", valeur: ["association"] },
      ),
      serviceId: vieAsso.id,
      etapes: [...etapes, visaRequisition],
    },
  );
  await circuit(
    30,
    "Salles · particuliers et entreprises",
    "Les salles municipales louées pour un événement privé ou professionnel",
    {
      condition: regle(
        { champ: "secteur", op: "parmi", valeur: ["salle"] },
        { champ: "type_demandeur", op: "parmi", valeur: ["particulier", "entreprise"] },
      ),
      serviceId: fetes.id,
      etapes: [...etapes, visaRefus],
    },
  );

  await prisma.campagne.updateMany({ where: { serviceId: null }, data: { serviceId: vieAsso.id } });
  // Les dossiers déjà créés rejoignent leur circuit et leur service, sans trace dans leur historique.
  const circuits = await circuitsEnService("reservation");
  const dossiers = await prisma.reservation.findMany({
    include: { espace: true, organisation: true, materiels: true },
    orderBy: { id: "asc" },
  });
  for (const r of dossiers) {
    const retenu = aiguiller(circuits, faitsReservation(r, r.createdAt)).retenu;
    if (retenu)
      await prisma.reservation.update({
        where: { id: r.id },
        data: { circuitVersionId: retenu.versionId, serviceId: retenu.definition.serviceId },
      });
  }
  return {
    services: 4,
    comptes: await creerComptesServices(motDePasse),
    circuits: 3 + (await creerCircuitsSubventionDemo()),
    dossiers: dossiers.length,
    etapes: await creerEtapeDemo(),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  creerProcessusDemo()
    .then((n) => console.log("Processus de démonstration :", n))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
      process.exit(process.exitCode ?? 0);
    });
}
