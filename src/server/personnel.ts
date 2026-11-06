/**
 * Personnel de service : personnes, vacations (avec répétition hebdomadaire et refus des
 * chevauchements d'une même personne), couverture des créneaux réservés, envoi hebdomadaire
 * du planning de service par courriel (PDF joint). Règles pures dans src/lib/personnel.ts.
 */
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { COULEURS_ESPACE, STATUTS_FERMES } from "@/lib/constantes";
import type { Intervalle } from "@/lib/creneaux";
import { joursDeLaSemaine } from "@/lib/editions";
import { champ, champOuNull, coche, emailValide, idOuNull } from "@/lib/forms-util";
import { nomCourt, plage } from "@/lib/libelles";
import { parisMidnight, todayParisISO } from "@/lib/paris-time";
import {
  type CreneauACouvrir,
  type CreneauCouvert,
  chevauchementsPersonne,
  couverture,
  developperVacations,
  type EtatCouverture,
  etatsCouverture,
  evtsVacations,
  nomFichierPlanningPersonnel,
  nomPersonne,
  type RepetitionVacation,
  recurrenceDe,
  resumeSemainePersonne,
  type VacationDatee,
} from "@/lib/personnel";
import { estJourEnvoi, lundiAEditer } from "@/lib/planning-hebdo";
import { lireCreneau } from "@/modules/reservations/formulaire";
import { joursExclus } from "@/server/calendrier";
import { type AppSettings, getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { libellesJours, pdfPlanningSemaine } from "@/server/editions";
import { UserFacingError } from "@/server/errors";
import type { CurrentUser } from "@/server/guards";
import { envoyerDepuisModele } from "@/server/mailer";

// ── Personnes ──

export type PersonnelEntree = {
  firstName: string;
  lastName: string;
  fonction: string | null;
  phone: string | null;
  email: string | null;
  color: string | null;
  note: string | null;
};

export function lirePersonne(form: FormData): PersonnelEntree {
  const firstName = champ(form, "first_name").slice(0, 80);
  const lastName = champ(form, "last_name").slice(0, 80);
  if (!firstName || !lastName) throw new UserFacingError("Indiquez le prénom et le nom.");
  const email = champOuNull(form, "email");
  if (email && !emailValide(email))
    throw new UserFacingError("L'adresse de courriel est invalide.");
  const color = champOuNull(form, "color");
  return {
    firstName,
    lastName,
    fonction: champOuNull(form, "fonction")?.slice(0, 80) ?? null,
    phone: champOuNull(form, "phone")?.slice(0, 40) ?? null,
    email: email?.slice(0, 160) ?? null,
    color: color && /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : null,
    note: champOuNull(form, "note")?.slice(0, 400) ?? null,
  };
}

/** La couleur proposée à une nouvelle personne : la première de la palette encore libre. */
export async function couleurLibre(): Promise<string> {
  const prises = new Set(
    (await prisma.personnel.findMany({ select: { color: true } })).map((p) => p.color),
  );
  return COULEURS_ESPACE.find((c) => !prises.has(c)) ?? COULEURS_ESPACE[0];
}

export async function personnes(actifsSeulement = true) {
  return prisma.personnel.findMany({
    where: actifsSeulement ? { isActive: true } : undefined,
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
  });
}

export type PersonneRow = Prisma.PersonnelGetPayload<Record<string, never>>;

export async function chargerPersonne(id: number) {
  return prisma.personnel.findUnique({ where: { id } });
}

/** Supprime une personne ; ses vacations partent avec elle, ses épinglages se détachent. */
export async function supprimerPersonne(id: number): Promise<string> {
  const p = await prisma.personnel.findUnique({
    where: { id },
    include: { _count: { select: { vacations: true, creneaux: true } } },
  });
  if (!p) throw new UserFacingError("Personne introuvable.");
  await prisma.personnel.delete({ where: { id } });
  const nb = p._count.vacations;
  return `${nomPersonne(p)} supprimé${nb ? ` avec ${nb} vacation${nb > 1 ? "s" : ""}` : ""}.`;
}

// ── Sites du périmètre ──

export type SiteRef = { id: number; name: string };

/** Les sites actifs dont au moins un espace est dans le périmètre de l'agent. */
export async function sitesDuPerimetre(user: CurrentUser): Promise<SiteRef[]> {
  const sites = await prisma.site.findMany({
    where: {
      isActive: true,
      espaces: {
        some: {
          isActive: true,
          ...(user.espacesGeres.length ? { id: { in: user.espacesGeres } } : {}),
        },
      },
    },
    select: { id: true, name: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  return sites;
}

// ── Vacations ──

export const INCLUDE_VACATION = {
  personnel: true,
  site: { select: { id: true, name: true } },
} satisfies Prisma.VacationInclude;

export type VacationRow = Prisma.VacationGetPayload<{ include: typeof INCLUDE_VACATION }>;

/** Les vacations qui touchent [de, a[, filtrées par site(s) et personne. */
export async function vacationsEntre(
  de: Date,
  a: Date,
  f: { siteIds?: number[]; personnelId?: number | null } = {},
): Promise<VacationRow[]> {
  return prisma.vacation.findMany({
    where: {
      startAt: { lt: a },
      endAt: { gt: de },
      ...(f.siteIds ? { siteId: { in: f.siteIds } } : {}),
      ...(f.personnelId ? { personnelId: f.personnelId } : {}),
    },
    include: INCLUDE_VACATION,
    orderBy: { startAt: "asc" },
  });
}

export function versVacationDatee(v: VacationRow): VacationDatee {
  return {
    id: v.id,
    personnelId: v.personnelId,
    siteId: v.siteId,
    startAt: v.startAt,
    endAt: v.endAt,
    serieId: v.serieId,
    note: v.note,
    personne: v.personnel,
  };
}

/** Les créneaux fermes (dossier accepté, signé ou confirmé) du périmètre sur [de, a[. */
export async function creneauxACouvrir(
  user: CurrentUser,
  de: Date,
  a: Date,
  siteIds?: number[],
): Promise<CreneauACouvrir[]> {
  const rows = await prisma.creneau.findMany({
    where: {
      status: "prevu",
      startAt: { lt: a },
      endAt: { gt: de },
      reservation: { status: { in: STATUTS_FERMES } },
      espace: {
        ...(user.espacesGeres.length ? { id: { in: user.espacesGeres } } : {}),
        ...(siteIds ? { siteId: { in: siteIds } } : {}),
      },
    },
    include: {
      reservation: { select: { id: true, numero: true, title: true } },
      espace: { select: { id: true, name: true, shortName: true, siteId: true, site: true } },
    },
    orderBy: { startAt: "asc" },
  });
  return rows.map((c) => ({
    id: c.id,
    reservationId: c.reservation.id,
    numero: c.reservation.numero,
    titre: c.reservation.title,
    espaceId: c.espaceId,
    espaceNom: nomCourt(c.espace),
    siteId: c.espace.siteId,
    siteNom: c.espace.site.name,
    startAt: c.startAt,
    endAt: c.endAt,
    personnelId: c.personnelId,
  }));
}

export type EtatService = {
  vacations: VacationRow[];
  etats: CreneauCouvert[];
};

/** Vacations et couverture des créneaux du périmètre sur une fenêtre. */
export async function etatService(
  user: CurrentUser,
  de: Date,
  a: Date,
  f: { siteIds?: number[]; personnelId?: number | null } = {},
): Promise<EtatService> {
  const [vacations, creneaux] = await Promise.all([
    vacationsEntre(de, a, { siteIds: f.siteIds }),
    creneauxACouvrir(user, de, a, f.siteIds),
  ]);
  const etats = etatsCouverture(creneaux, vacations.map(versVacationDatee));
  return {
    vacations: f.personnelId ? vacations.filter((v) => v.personnelId === f.personnelId) : vacations,
    etats,
  };
}

/** Le nombre de créneaux pas entièrement couverts sur une fenêtre (tableau de bord). */
export async function nbCreneauxACouvrir(user: CurrentUser, de: Date, a: Date): Promise<number> {
  const { etats } = await etatService(user, de, a);
  return etats.filter((e) => e.couverture.etat !== "couvert").length;
}

export type VacationEntree = {
  personnelId: number;
  siteId: number;
  intervalle: Intervalle;
  note: string | null;
  repetition: RepetitionVacation | null;
};

export function lireVacation(form: FormData): VacationEntree {
  const personnelId = idOuNull(form, "personnel_id");
  if (!personnelId) throw new UserFacingError("Choisissez la personne de service.");
  const siteId = idOuNull(form, "site_id");
  if (!siteId) throw new UserFacingError("Choisissez le site.");
  const intervalle = lireCreneau(form);
  const until = champ(form, "repeter_jusquau");
  let repetition: RepetitionVacation | null = null;
  if (coche(form, "repeter")) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until))
      throw new UserFacingError("Indiquez la date de fin de la répétition.");
    if (until < champ(form, "date"))
      throw new UserFacingError("La fin de la répétition précède la première vacation.");
    repetition = {
      until,
      horsFeries: coche(form, "hors_feries"),
      horsVacances: coche(form, "hors_vacances"),
    };
  }
  return {
    personnelId,
    siteId,
    intervalle,
    note: champOuNull(form, "note")?.slice(0, 200) ?? null,
    repetition,
  };
}

async function verifierChevauchements(
  personnelId: number,
  demandees: Intervalle[],
  saufId: number | null,
): Promise<void> {
  const de = new Date(Math.min(...demandees.map((i) => i.startAt.getTime())));
  const a = new Date(Math.max(...demandees.map((i) => i.endAt.getTime())));
  const existantes = await prisma.vacation.findMany({
    where: {
      personnelId,
      startAt: { lt: a },
      endAt: { gt: de },
      ...(saufId ? { id: { not: saufId } } : {}),
    },
    include: { site: { select: { name: true } } },
  });
  const [premier] = chevauchementsPersonne(demandees, existantes);
  if (premier)
    throw new UserFacingError(
      `Cette personne est déjà de service ${plage(premier.existant.startAt, premier.existant.endAt)} (${premier.existant.site.name}) : les vacations se chevauchent.`,
    );
}

/** Crée une vacation, ou toute la série de sa répétition ; refuse les chevauchements. */
export async function creerVacations(e: VacationEntree, user: CurrentUser): Promise<string> {
  const [personne, site] = await Promise.all([
    prisma.personnel.findUnique({ where: { id: e.personnelId } }),
    prisma.site.findUnique({ where: { id: e.siteId }, select: { id: true, name: true } }),
  ]);
  if (!personne) throw new UserFacingError("Personne introuvable.");
  if (!personne.isActive) throw new UserFacingError("Cette personne n'est plus en service.");
  if (!site) throw new UserFacingError("Site introuvable.");
  const exclus = await joursExclus(e.intervalle, recurrenceDe(e.repetition));
  const occurrences = developperVacations(e.intervalle, e.repetition, exclus);
  if (!occurrences.length)
    throw new UserFacingError("Aucune vacation à créer sur cette période (jours exclus).");
  await verifierChevauchements(e.personnelId, occurrences, null);
  const serieId = occurrences.length > 1 ? randomBytes(12).toString("hex") : null;
  await prisma.vacation.createMany({
    data: occurrences.map((i) => ({
      personnelId: e.personnelId,
      siteId: e.siteId,
      startAt: i.startAt,
      endAt: i.endAt,
      serieId,
      note: e.note,
      createdBy: user.email,
    })),
  });
  const n = occurrences.length;
  return n > 1
    ? `${n} vacations créées pour ${nomPersonne(personne)} (${site.name}), chaque semaine jusqu'au ${e.repetition?.until.split("-").reverse().join("/")}.`
    : `${nomPersonne(personne)} de service ${plage(e.intervalle.startAt, e.intervalle.endAt)} (${site.name}).`;
}

export async function modifierVacation(
  id: number,
  e: Omit<VacationEntree, "repetition">,
): Promise<string> {
  const v = await prisma.vacation.findUnique({ where: { id } });
  if (!v) throw new UserFacingError("Vacation introuvable.");
  const [personne, site] = await Promise.all([
    prisma.personnel.findUnique({ where: { id: e.personnelId } }),
    prisma.site.findUnique({ where: { id: e.siteId }, select: { name: true } }),
  ]);
  if (!personne || !site) throw new UserFacingError("Personne ou site introuvable.");
  await verifierChevauchements(e.personnelId, [e.intervalle], id);
  await prisma.vacation.update({
    where: { id },
    data: {
      personnelId: e.personnelId,
      siteId: e.siteId,
      startAt: e.intervalle.startAt,
      endAt: e.intervalle.endAt,
      note: e.note,
    },
  });
  return `Vacation modifiée : ${nomPersonne(personne)}, ${plage(e.intervalle.startAt, e.intervalle.endAt)} (${site.name}).`;
}

/** Supprime une vacation, ou toute sa série à partir d'elle (`serie`). */
export async function supprimerVacation(id: number, serie: boolean): Promise<string> {
  const v = await prisma.vacation.findUnique({ where: { id }, include: INCLUDE_VACATION });
  if (!v) throw new UserFacingError("Vacation introuvable.");
  if (serie && v.serieId) {
    const { count } = await prisma.vacation.deleteMany({
      where: { serieId: v.serieId, startAt: { gte: v.startAt } },
    });
    return `${count} vacation${count > 1 ? "s" : ""} de ${nomPersonne(v.personnel)} supprimée${count > 1 ? "s" : ""} (${v.site.name}).`;
  }
  await prisma.vacation.delete({ where: { id } });
  return `Vacation de ${nomPersonne(v.personnel)} du ${plage(v.startAt, v.endAt)} supprimée.`;
}

// ── Épinglage sur un créneau ──

export async function epingler(creneauId: number, personnelId: number | null): Promise<string> {
  if (personnelId) {
    const p = await prisma.personnel.findUnique({ where: { id: personnelId } });
    if (!p) throw new UserFacingError("Personne introuvable.");
    await prisma.creneau.update({ where: { id: creneauId }, data: { personnelId } });
    return `${nomPersonne(p)} de service sur ce créneau.`;
  }
  await prisma.creneau.update({ where: { id: creneauId }, data: { personnelId: null } });
  return "Personne de service retirée du créneau.";
}

// ── Édition PDF ──

export async function pdfPlanningService(
  user: CurrentUser,
  lundi: string,
  siteIds: number[] | undefined,
  cfg: AppSettings,
  format: "A4" | "A3" = "A4",
): Promise<Buffer> {
  const jours = joursDeLaSemaine(lundi);
  const de = parisMidnight(jours[0]);
  const a = parisMidnight(jours[6]);
  const fin = new Date(a.getTime() + 86_400_000);
  const [sites, etat] = await Promise.all([
    sitesDuPerimetre(user),
    etatService(user, de, fin, { siteIds }),
  ]);
  const retenus = siteIds ? sites.filter((s) => siteIds.includes(s.id)) : sites;
  const evts = evtsVacations(etat.vacations.map(versVacationDatee), etat.etats, jours);
  const libelles = libellesJours(lundi);
  return pdfPlanningSemaine({
    titre: "Planning de service",
    sousTitre: `Semaine du ${libelles[0]} au ${libelles[6]}`,
    format,
    collectivite: cfg.COLLECTIVITE_NOM,
    legende: "Vacations du personnel de service ; créneaux réservés à couvrir hachurés.",
    grilles: retenus.map((s) => ({
      espace: { id: s.id, name: s.name, site: "Personnel de service" },
      jours: libelles,
      evts: evts.filter((x) => x.espaceId === s.id),
    })),
  });
}

// ── Courriel hebdomadaire ──

/** Envoie à une personne ses vacations de la semaine du lundi donné ; false si rien à envoyer. */
export async function envoyerPlanningPersonne(
  personne: PersonneRow,
  lundi: string,
  cfg: AppSettings,
): Promise<boolean> {
  if (!personne.email) return false;
  const jours = joursDeLaSemaine(lundi);
  const de = parisMidnight(jours[0]);
  const fin = new Date(parisMidnight(jours[6]).getTime() + 86_400_000);
  const vacations = await vacationsEntre(de, fin, { personnelId: personne.id });
  const libelles = libellesJours(lundi);
  const semaine = `${libelles[0]} au ${libelles[6]}`;
  const sites = [...new Set(vacations.map((v) => v.site.name))];
  const pdf = await pdfPlanningSemaine({
    titre: "Mon planning de service",
    sousTitre: `Semaine du ${semaine}`,
    format: "A4",
    collectivite: cfg.COLLECTIVITE_NOM,
    grilles: [
      {
        espace: {
          id: personne.id,
          name: nomPersonne(personne),
          site: personne.fonction ?? "Personnel de service",
        },
        jours: libelles,
        evts: evtsVacations(vacations.map(versVacationDatee), [], jours).map((e) => ({
          ...e,
          titre: vacations.find((v) => v.siteId === e.espaceId)?.site.name ?? e.titre,
        })),
      },
    ],
  });
  return envoyerDepuisModele(
    "planning_personnel",
    personne.email,
    {
      prenom: personne.firstName,
      semaine,
      sites: sites.join(", ") || "aucun site",
      resume: resumeSemainePersonne(
        vacations.map((v) => ({ ...versVacationDatee(v), siteNom: v.site.name })),
        jours,
        libelles,
      ),
      lien_ics: personne.icsToken ? `${cfg.APP_BASE_URL}/ics/personnel/${personne.icsToken}` : "",
    },
    { attachments: [{ filename: nomFichierPlanningPersonnel(lundi), content: pdf }] },
  );
}

/** Tâche planifiée : le jour configuré, chaque personne avec une adresse reçoit sa semaine. */
export async function envoyerPlanningsPersonnel(now = new Date()): Promise<string> {
  const cfg = await getSettings();
  if (!cfg.PERSONNEL_ENABLED || !cfg.PLANNING_PERSONNEL_ENABLED) return "envoi désactivé";
  if (!estJourEnvoi(cfg.PLANNING_HEBDO_JOUR || 1, now)) return "pas le jour d'envoi";
  const lundi = lundiAEditer(now);
  const cibles = await prisma.personnel.findMany({
    where: { isActive: true, email: { not: null } },
    orderBy: { lastName: "asc" },
  });
  if (!cibles.length) return "aucune personne avec une adresse";
  const dejaEnvoye = new Set(
    (
      await prisma.mailLog.findMany({
        where: {
          templateKey: "planning_personnel",
          sentAt: { gte: parisMidnight(todayParisISO(now)) },
        },
        select: { recipient: true },
      })
    ).map((m) => m.recipient),
  );
  let envoyes = 0;
  for (const p of cibles) {
    if (!p.email || dejaEnvoye.has(p.email)) continue;
    if (await envoyerPlanningPersonne(p, lundi, cfg)) envoyes += 1;
  }
  return `${envoyes} planning${envoyes > 1 ? "s" : ""} de service envoyé${envoyes > 1 ? "s" : ""} (semaine du ${lundi})`;
}

// ── Fiche réservation ──

export type ServiceCreneau = {
  etat: EtatCouverture;
  noms: string[];
  epingle: boolean;
};

export type ServiceDossier = {
  personnes: PersonneRow[];
  parCreneau: Map<number, ServiceCreneau>;
};

/** Pour chaque créneau d'un dossier, qui est de service (épinglé ou par vacation sur le site). */
export async function serviceDossier(r: {
  espace: { siteId: number; site: { name: string }; name: string; shortName?: string | null };
  creneaux: {
    id: number;
    startAt: Date;
    endAt: Date;
    status: string;
    personnelId: number | null;
  }[];
}): Promise<ServiceDossier> {
  const prevus = r.creneaux.filter((c) => c.status === "prevu");
  const toutes = await personnes();
  const noms = new Map(toutes.map((p) => [p.id, nomPersonne(p)]));
  const parCreneau = new Map<number, ServiceCreneau>();
  if (!prevus.length) return { personnes: toutes, parCreneau };
  const de = new Date(Math.min(...prevus.map((c) => c.startAt.getTime())));
  const a = new Date(Math.max(...prevus.map((c) => c.endAt.getTime())));
  const vacations = (await vacationsEntre(de, a, { siteIds: [r.espace.siteId] })).map(
    versVacationDatee,
  );
  for (const v of vacations)
    if (!noms.has(v.personnelId)) noms.set(v.personnelId, nomPersonne(v.personne));
  for (const c of prevus) {
    const cv = couverture(
      {
        id: c.id,
        reservationId: 0,
        numero: "",
        titre: "",
        espaceId: 0,
        espaceNom: nomCourt(r.espace),
        siteId: r.espace.siteId,
        siteNom: r.espace.site.name,
        startAt: c.startAt,
        endAt: c.endAt,
        personnelId: c.personnelId,
      },
      vacations,
    );
    parCreneau.set(c.id, {
      etat: cv.etat,
      noms: cv.personnelIds.map((id) => noms.get(id) ?? `#${id}`),
      epingle: cv.epingle,
    });
  }
  return { personnes: toutes, parCreneau };
}
