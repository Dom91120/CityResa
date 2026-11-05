/**
 * Horaires d'ouverture par saison : un espace peut ouvrir différemment selon la saison
 * (période scolaire, été). Lecture pour les contrôles de créneaux, écriture depuis le
 * formulaire de l'espace. Les horaires de l'espace restent le repli.
 */
import type { Horaires, HorairesPeriode } from "@/lib/creneaux";
import { ymdUtc } from "@/lib/date-utc";
import { todayParisISO } from "@/lib/paris-time";
import { prisma } from "@/server/db";

/** Les horaires particuliers d'un espace, une période par saison qui en a. */
export async function horairesSaisonDe(espaceId: number): Promise<HorairesPeriode[]> {
  const rows = await prisma.horairesSaison.findMany({
    where: { espaceId },
    include: { saison: { select: { startDate: true, endDate: true } } },
  });
  return rows.map((h) => ({
    debut: ymdUtc(h.saison.startDate),
    fin: ymdUtc(h.saison.endDate),
    openHours: h.openHours,
  }));
}

export type SaisonHoraires = { id: number; label: string; openHours: unknown | null };

/** Les saisons en cours ou à venir, avec les horaires particuliers déjà posés pour cet espace. */
export async function saisonsPourFormulaire(espaceId: number | null): Promise<SaisonHoraires[]> {
  const aujourdhui = new Date(`${todayParisISO()}T00:00:00.000Z`);
  const [saisons, horaires] = await Promise.all([
    prisma.saison.findMany({
      where: { endDate: { gte: aujourdhui } },
      orderBy: { startDate: "asc" },
    }),
    espaceId ? prisma.horairesSaison.findMany({ where: { espaceId } }) : [],
  ]);
  return saisons.map((s) => ({
    id: s.id,
    label: s.label,
    openHours: horaires.find((h) => h.saisonId === s.id)?.openHours ?? null,
  }));
}

/** Pose, remplace ou retire les horaires particuliers d'un espace pour chaque saison lue. */
export async function enregistrerHorairesSaisons(
  espaceId: number,
  lus: { saisonId: number; openHours: Horaires | null }[],
): Promise<void> {
  for (const l of lus) {
    if (!l.openHours) {
      await prisma.horairesSaison.deleteMany({ where: { espaceId, saisonId: l.saisonId } });
      continue;
    }
    await prisma.horairesSaison.upsert({
      where: { espaceId_saisonId: { espaceId, saisonId: l.saisonId } },
      create: { espaceId, saisonId: l.saisonId, openHours: l.openHours },
      update: { openHours: l.openHours },
    });
  }
}
