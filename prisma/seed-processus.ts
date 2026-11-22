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
import { fileURLToPath } from "node:url";
import type { Prisma } from "@/generated/prisma/client";
import {
  aiguiller,
  type Condition,
  type Definition,
  type Etape,
  lireDefinition,
} from "@/lib/circuits";
import { seedCircuitStandard } from "@/server/amorcage";
import { circuitsEnService, faitsReservation } from "@/server/circuits";
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

export async function creerProcessusDemo(): Promise<Record<string, number>> {
  await seedCircuitStandard();
  if ((await prisma.service.count()) > 0)
    return { services: 0, circuits: 0, dossiers: 0, etapes: await creerEtapeDemo() };
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
  ) =>
    prisma.service.create({
      data: {
        name,
        description,
        email,
        position,
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
  );
  const vieAsso = await service(
    2,
    "Vie associative",
    "Salles municipales mises à disposition des associations, subventions",
    "vie.associative@exemple.fr",
    sophie,
  );
  const fetes = await service(
    3,
    "Service des fêtes",
    "Location des salles municipales aux particuliers et aux entreprises",
    "fetes@exemple.fr",
    sophie,
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
      etapes,
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
      etapes,
    },
  );

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
  return { services: 4, circuits: 3, dossiers: dossiers.length, etapes: await creerEtapeDemo() };
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
