/**
 * Jeu de démonstration : la campagne de créneaux annuels de la saison en cours, en instruction,
 * avec des vœux dans chaque état. Elle s'appuie sur ce que `seed-demo.ts` a déjà créé (espaces,
 * associations, série hebdomadaire du twirling) et se retrouve par les noms : elle peut donc
 * aussi s'ajouter à une base de démonstration existante.
 */
import { prisma } from "@/server/db";

const JOUR_MS = 86_400_000;

type VoeuDemo = {
  espace: string;
  organisation: string;
  titre: string;
  participants: number;
  /** Jour ISO (1 = lundi … 7 = dimanche). */
  jour: number;
  de: string;
  a: string;
  statut: "en_attente" | "attribue" | "refuse";
  note?: string;
  /** Objet de la réservation déjà créée pour ce vœu attribué. */
  reservation?: string;
};

const ESPACES = ["Salle de la Folie Desmares", "Salle Gabriel Péri", "Salle Henri Matisse"];

const VOEUX: VoeuDemo[] = [
  {
    espace: "Salle de la Folie Desmares",
    organisation: "Sport Gym Danse Twirling 92",
    titre: "Entraînement twirling et acrodanse",
    participants: 45,
    jour: 4,
    de: "20:00",
    a: "22:30",
    statut: "attribue",
    reservation: "Entraînement twirling et acrodanse",
  },
  {
    // Chevauche le créneau attribué au twirling : il reste en attente.
    espace: "Salle de la Folie Desmares",
    organisation: "Groupement d'Arts Martiaux et d'Aïkido - GAMA",
    titre: "Cours d'aïkido adultes",
    participants: 20,
    jour: 4,
    de: "20:30",
    a: "22:00",
    statut: "en_attente",
  },
  {
    espace: "Salle de la Folie Desmares",
    organisation: "Sport Gym Danse Twirling 92",
    titre: "Stage d'acrodanse du samedi",
    participants: 30,
    jour: 6,
    de: "14:00",
    a: "17:00",
    statut: "refuse",
    note: "La salle reste ouverte aux locations des particuliers le samedi après-midi.",
  },
  {
    espace: "Salle Gabriel Péri",
    organisation: "Around dance",
    titre: "Atelier danse parents-enfants",
    participants: 16,
    jour: 2,
    de: "17:30",
    a: "19:00",
    statut: "en_attente",
  },
];

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Crée la campagne et ses vœux ; renvoie le nombre de vœux créés (0 si elle existe déjà). */
export async function creerCampagneDemo(acteur: string): Promise<number> {
  const maintenant = new Date();
  const saison = await prisma.saison.findFirst({
    where: { startDate: { lte: maintenant }, endDate: { gte: maintenant } },
  });
  if (!saison) return 0;
  const label = `Créneaux annuels ${saison.label}`;
  if (await prisma.campagne.findFirst({ where: { label } })) return 0;

  const espaces = await prisma.espace.findMany({ where: { name: { in: ESPACES } } });
  const espaceDe = (nom: string) => espaces.find((e) => e.name === nom);
  const gestionnaire = await prisma.user.findFirst({
    where: { kind: "agent", role: "gestionnaire", isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const decidePar = gestionnaire?.email ?? acteur;

  const campagne = await prisma.campagne.create({
    data: {
      saisonId: saison.id,
      label,
      status: "instruction",
      // Le dépôt s'est clos il y a une semaine : la campagne est à l'arbitrage.
      closeDate: new Date(maintenant.getTime() - 7 * JOUR_MS),
      consignes:
        "Attestation d'assurance à jour exigée. Un vœu par créneau hebdomadaire ; indiquez le nombre habituel de participants.",
      createdBy: decidePar,
      createdAt: new Date(maintenant.getTime() - 45 * JOUR_MS),
      // Dans l'ordre de la liste : la fiche ouvre le premier espace, celui qui a le plus de vœux.
      espaces: {
        create: ESPACES.flatMap((nom) => {
          const e = espaceDe(nom);
          return e ? [{ espaceId: e.id }] : [];
        }),
      },
    },
  });

  let crees = 0;
  for (const [i, v] of VOEUX.entries()) {
    const espace = espaceDe(v.espace);
    const org = await prisma.organisation.findFirst({
      where: { name: v.organisation },
      include: { users: { where: { isActive: true }, orderBy: { createdAt: "asc" }, take: 1 } },
    });
    if (!espace || !org) continue;
    const reservation = v.reservation
      ? await prisma.reservation.findFirst({
          where: {
            organisationId: org.id,
            espaceId: espace.id,
            title: v.reservation,
            voeu: null,
          },
          select: { id: true },
        })
      : null;
    // Un vœu attribué sans son dossier n'aurait pas de sens : il reste alors en attente.
    const statut = v.statut === "attribue" && !reservation ? "en_attente" : v.statut;
    const decide = statut !== "en_attente";
    await prisma.voeu.create({
      data: {
        campagneId: campagne.id,
        organisationId: org.id,
        userId: org.users[0]?.id ?? null,
        espaceId: espace.id,
        title: v.titre,
        participants: v.participants,
        weekday: v.jour,
        startMin: minutes(v.de),
        endMin: minutes(v.a),
        horsVacances: true,
        status: statut,
        decisionNote: statut === "refuse" ? (v.note ?? null) : null,
        decidedAt: decide ? new Date(maintenant.getTime() - 3 * JOUR_MS) : null,
        decidedBy: decide ? decidePar : null,
        notifiedAt: decide ? new Date(maintenant.getTime() - 3 * JOUR_MS) : null,
        reservationId: statut === "attribue" ? (reservation?.id ?? null) : null,
        // Déposés pendant l'ouverture, dans l'ordre de la liste.
        createdAt: new Date(maintenant.getTime() - (30 - i) * JOUR_MS),
      },
    });
    crees++;
  }
  return crees;
}
