/**
 * Flux iCalendar : l'agenda d'un espace (jeton public) ou les réservations d'un usager.
 */
import { randomBytes } from "node:crypto";
import { STATUTS_FERMES } from "@/lib/constantes";
import { nomCourt } from "@/lib/libelles";
import { prisma } from "@/server/db";

function icsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function echapper(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function plier(ligne: string): string {
  const out: string[] = [];
  let reste = ligne;
  while (reste.length > 74) {
    out.push(reste.slice(0, 74));
    reste = ` ${reste.slice(74)}`;
  }
  out.push(reste);
  return out.join("\r\n");
}

export type Evenement = {
  uid: string;
  debut: Date;
  fin: Date;
  titre: string;
  lieu?: string;
  description?: string;
  url?: string;
};

export function calendrier(nom: string, evenements: Evenement[]): string {
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CityResa//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${echapper(nom)}`,
    "X-WR-TIMEZONE:Europe/Paris",
  ];
  for (const e of evenements) {
    lignes.push("BEGIN:VEVENT");
    lignes.push(`UID:${e.uid}`);
    lignes.push(`DTSTAMP:${icsDate(new Date())}`);
    lignes.push(`DTSTART:${icsDate(e.debut)}`);
    lignes.push(`DTEND:${icsDate(e.fin)}`);
    lignes.push(`SUMMARY:${echapper(e.titre)}`);
    if (e.lieu) lignes.push(`LOCATION:${echapper(e.lieu)}`);
    if (e.description) lignes.push(`DESCRIPTION:${echapper(e.description)}`);
    if (e.url) lignes.push(`URL:${e.url}`);
    lignes.push("END:VEVENT");
  }
  lignes.push("END:VCALENDAR");
  return `${lignes.map(plier).join("\r\n")}\r\n`;
}

export function nouveauJeton(): string {
  return randomBytes(24).toString("base64url");
}

/** Le flux d'un espace : ses créneaux fermes, passés de 30 jours et à venir. */
export async function flusEspace(icsToken: string, baseUrl: string): Promise<string | null> {
  const espace = await prisma.espace.findUnique({ where: { icsToken }, include: { site: true } });
  if (!espace) return null;
  const depuis = new Date(Date.now() - 30 * 86_400_000);
  const creneaux = await prisma.creneau.findMany({
    where: {
      espaceId: espace.id,
      status: "prevu",
      startAt: { gte: depuis },
      reservation: { status: { in: STATUTS_FERMES } },
    },
    include: { reservation: { include: { organisation: true } } },
    orderBy: { startAt: "asc" },
  });
  return calendrier(
    `${nomCourt(espace)} · ${espace.site.name}`,
    creneaux.map((c) => ({
      uid: `creneau-${c.id}@cityresa`,
      debut: c.startAt,
      fin: c.endAt,
      titre: `${c.reservation.title}${c.reservation.organisation ? ` (${c.reservation.organisation.name})` : ""}`,
      lieu: `${espace.name}, ${espace.site.name}`,
      description: `Réservation ${c.reservation.numero}`,
      url: `${baseUrl}/reservations/${c.reservationId}`,
    })),
  );
}

/** Le flux d'un usager : toutes ses réservations fermes. */
export async function fluxUsager(icsToken: string, baseUrl: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { icsToken } });
  if (!user) return null;
  const where =
    user.kind === "agent"
      ? { status: { in: STATUTS_FERMES } }
      : {
          status: { in: STATUTS_FERMES },
          OR: [
            { userId: user.id },
            ...(user.organisationId ? [{ organisationId: user.organisationId }] : []),
          ],
        };
  const creneaux = await prisma.creneau.findMany({
    where: {
      status: "prevu",
      startAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
      reservation: where,
    },
    include: { reservation: true, espace: { include: { site: true } } },
    orderBy: { startAt: "asc" },
    take: 1000,
  });
  return calendrier(
    user.kind === "agent" ? "CityRésa · Réservations" : "Mes réservations",
    creneaux.map((c) => ({
      uid: `creneau-${c.id}@cityresa`,
      debut: c.startAt,
      fin: c.endAt,
      titre: `${c.reservation.title} · ${c.espace.name}`,
      lieu: `${c.espace.name}, ${c.espace.site.name}${c.espace.site.address ? `, ${c.espace.site.address}` : ""}`,
      description: `Réservation ${c.reservation.numero}`,
      url:
        user.kind === "agent"
          ? `${baseUrl}/reservations/${c.reservationId}`
          : `${baseUrl}/portail/mes-reservations/${c.reservationId}`,
    })),
  );
}

/** Le calendrier d'une personne de service : ses vacations et les créneaux où elle est épinglée. */
export async function fluxPersonnel(icsToken: string, baseUrl: string): Promise<string | null> {
  const personne = await prisma.personnel.findUnique({ where: { icsToken } });
  if (!personne) return null;
  const depuis = new Date(Date.now() - 30 * 86_400_000);
  const [vacations, creneaux] = await Promise.all([
    prisma.vacation.findMany({
      where: { personnelId: personne.id, startAt: { gte: depuis } },
      include: { site: true },
      orderBy: { startAt: "asc" },
      take: 1000,
    }),
    prisma.creneau.findMany({
      where: { personnelId: personne.id, status: "prevu", startAt: { gte: depuis } },
      include: { reservation: true, espace: { include: { site: true } } },
      orderBy: { startAt: "asc" },
      take: 1000,
    }),
  ]);
  const lieu = (s: { name: string; address: string | null }) =>
    `${s.name}${s.address ? `, ${s.address}` : ""}`;
  return calendrier(`Service · ${personne.firstName} ${personne.lastName}`.trim(), [
    ...vacations.map((v) => ({
      uid: `vacation-${v.id}@cityresa`,
      debut: v.startAt,
      fin: v.endAt,
      titre: `Service · ${v.site.name}`,
      lieu: lieu(v.site),
      description: v.note ?? undefined,
      url: `${baseUrl}/personnel?site=${v.siteId}`,
    })),
    ...creneaux.map((c) => ({
      uid: `service-creneau-${c.id}@cityresa`,
      debut: c.startAt,
      fin: c.endAt,
      titre: `${c.reservation.title} · ${nomCourt(c.espace)}`,
      lieu: lieu(c.espace.site),
      description: `Réservation ${c.reservation.numero} : personne de service`,
      url: `${baseUrl}/reservations/${c.reservationId}`,
    })),
  ]);
}
