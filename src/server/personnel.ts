/**
 * Personnel de service : personnes, vacations (avec répétition hebdomadaire et refus des
 * chevauchements d'une même personne), couverture des créneaux réservés, envoi hebdomadaire
 * du planning de service par courriel (PDF joint). Règles pures dans src/lib/personnel.ts.
 */
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import {
  type AbsenceRef,
  controleManuel,
  horsAbsences,
  MOTIFS_INDISPONIBLE,
  type MotifIndisponible,
  type OccupationRef,
  type PersonneAffectable,
} from "@/lib/affectation";
import { RE_YMD } from "@/lib/calendrier";
import { COULEURS_ESPACE, JOURS_ISO, STATUTS_FERMES } from "@/lib/constantes";
import { type Horaires, type Intervalle, lireHoraires } from "@/lib/creneaux";
import { parseYmdUtc, ymdUtc } from "@/lib/date-utc";
import { joursDeLaSemaine } from "@/lib/editions";
import {
  champ,
  champOuNull,
  coche,
  emailValide,
  idOuNull,
  ids,
  parseFloat_,
  parseInt_,
} from "@/lib/forms-util";
import { dateMoyenne, nomCourt, plage } from "@/lib/libelles";
import {
  addParisDays,
  minutesDe,
  parisDateTimeToInstant,
  parisMidnight,
  todayParisISO,
} from "@/lib/paris-time";
import {
  type CreneauACouvrir,
  type CreneauCouvert,
  chevauchementsPersonne,
  couverture,
  developperVacations,
  type EtatCouverture,
  etatsCouverture,
  evtsVacations,
  libelleAbsence,
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

// ── Disponibilité : personne affectable, absences ──

export const INCLUDE_PERSONNE_AFFECTABLE = { sites: true } satisfies Prisma.PersonnelInclude;

export function versPersonneAffectable(
  p: Prisma.PersonnelGetPayload<{ include: typeof INCLUDE_PERSONNE_AFFECTABLE }>,
): PersonneAffectable {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    isActive: p.isActive,
    quotite: p.quotite,
    heuresHebdo: p.heuresHebdo === null ? null : Number(p.heuresHebdo),
    contratDebut: p.contratDebut ? ymdUtc(p.contratDebut) : null,
    contratFin: p.contratFin ? ymdUtc(p.contratFin) : null,
    horaires: lireHoraires(p.horaires),
    sites: p.sites.map((s) => ({ siteId: s.siteId, principal: s.principal })),
  };
}

/** Les absences qui touchent [de, a[, avec le libellé du motif. */
export async function absencesEntre(
  de: Date,
  a: Date,
  personnelId?: number,
): Promise<AbsenceRef[]> {
  const rows = await prisma.absence.findMany({
    where: {
      startAt: { lt: a },
      endAt: { gt: de },
      ...(personnelId ? { personnelId } : {}),
    },
    include: { motif: { select: { label: true } } },
    orderBy: { startAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    personnelId: r.personnelId,
    startAt: r.startAt,
    endAt: r.endAt,
    motif: r.motif?.label ?? null,
  }));
}

/** Le résultat d'une écriture : son message et le niveau du flash (avertissement = à relire). */
export type Issue = { message: string; niveau: "success" | "warning" };

/** « Attention : personne non rattachée au site, hors horaires de travail. » ou rien. */
export function texteAvertissements(motifs: readonly MotifIndisponible[]): string {
  const uniques = [...new Set(motifs)];
  return uniques.length
    ? ` Attention : personne ${uniques.map((m) => MOTIFS_INDISPONIBLE[m]).join(", ")}.`
    : "";
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
  f: { siteIds?: number[]; personnelIds?: number[] } = {},
): Promise<EtatService> {
  const [vacations, creneaux, absences] = await Promise.all([
    vacationsEntre(de, a, { siteIds: f.siteIds }),
    creneauxACouvrir(user, de, a, f.siteIds),
    absencesEntre(de, a),
  ]);
  // Une personne absente ne couvre rien : ses vacations sont rognées de ses absences.
  const etats = etatsCouverture(creneaux, horsAbsences(vacations.map(versVacationDatee), absences));
  return {
    vacations: f.personnelIds?.length
      ? vacations.filter((v) => f.personnelIds?.includes(v.personnelId))
      : vacations,
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

/**
 * Contrôle des vacations demandées pour une personne sur un site : refuse hors contrat, pendant
 * une absence (une série saute seulement les jours d'absence) et quand la personne est déjà
 * affectée à un créneau d'un autre site ; avertit hors des sites de rattachement ou des horaires
 * de travail. Renvoie les vacations retenues.
 */
async function controlerVacations(
  personne: Prisma.PersonnelGetPayload<{ include: typeof INCLUDE_PERSONNE_AFFECTABLE }>,
  siteId: number,
  demandees: Intervalle[],
): Promise<{ retenues: Intervalle[]; absentes: number; avertissements: MotifIndisponible[] }> {
  const de = new Date(Math.min(...demandees.map((i) => i.startAt.getTime())));
  const a = new Date(Math.max(...demandees.map((i) => i.endAt.getTime())));
  const [absences, creneaux] = await Promise.all([
    absencesEntre(de, a, personne.id),
    prisma.creneau.findMany({
      where: {
        status: "prevu",
        startAt: { lt: a },
        endAt: { gt: de },
        OR: [
          { personnelId: personne.id },
          { personnelProposeId: personne.id, proposeAt: { not: null } },
        ],
      },
      select: { id: true, startAt: true, endAt: true, espace: { select: { siteId: true } } },
    }),
  ]);
  const occupations: OccupationRef[] = creneaux.map((c) => ({
    personnelId: personne.id,
    siteId: c.espace.siteId,
    startAt: c.startAt,
    endAt: c.endAt,
    creneauId: c.id,
  }));
  const p = versPersonneAffectable(personne);
  const nom = nomPersonne(personne);
  const retenues: Intervalle[] = [];
  const avertissements: MotifIndisponible[] = [];
  let absentes = 0;
  for (const i of demandees) {
    const controle = controleManuel(
      p,
      { id: 0, reservationId: 0, siteId, startAt: i.startAt, endAt: i.endAt },
      { absences, occupations },
    );
    if (controle.bloquant === "absente" && demandees.length > 1) {
      absentes += 1;
      continue;
    }
    if (controle.bloquant === "absente")
      throw new UserFacingError(
        `${nom} est absent(e) sur cette période (${plage(i.startAt, i.endAt)}).`,
      );
    if (controle.bloquant === "hors_contrat")
      throw new UserFacingError(
        `La vacation du ${dateMoyenne(i.startAt)} est hors de la période de contrat de ${nom}.`,
      );
    if (controle.bloquant === "occupee")
      throw new UserFacingError(
        `${nom} est déjà affecté(e) à un créneau réservé sur un autre site (${plage(i.startAt, i.endAt)}).`,
      );
    if (controle.bloquant)
      throw new UserFacingError(`${nom} : personne ${MOTIFS_INDISPONIBLE[controle.bloquant]}.`);
    avertissements.push(...controle.avertissements);
    retenues.push(i);
  }
  if (!retenues.length)
    throw new UserFacingError(`${nom} est absent(e) sur toutes les dates de la série.`);
  return { retenues, absentes, avertissements };
}

/** Crée une vacation, ou toute la série de sa répétition ; refuse les chevauchements. */
export async function creerVacations(e: VacationEntree, user: CurrentUser): Promise<Issue> {
  const [personne, site] = await Promise.all([
    prisma.personnel.findUnique({
      where: { id: e.personnelId },
      include: INCLUDE_PERSONNE_AFFECTABLE,
    }),
    prisma.site.findUnique({ where: { id: e.siteId }, select: { id: true, name: true } }),
  ]);
  if (!personne) throw new UserFacingError("Personne introuvable.");
  if (!personne.isActive) throw new UserFacingError("Cette personne n'est plus en service.");
  if (!site) throw new UserFacingError("Site introuvable.");
  const exclus = await joursExclus(e.intervalle, recurrenceDe(e.repetition));
  const demandees = developperVacations(e.intervalle, e.repetition, exclus);
  if (!demandees.length)
    throw new UserFacingError("Aucune vacation à créer sur cette période (jours exclus).");
  const {
    retenues: occurrences,
    absentes,
    avertissements,
  } = await controlerVacations(personne, e.siteId, demandees);
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
  const base =
    demandees.length > 1
      ? `${n} vacation${n > 1 ? "s" : ""} créée${n > 1 ? "s" : ""} pour ${nomPersonne(personne)} (${site.name}), chaque semaine jusqu'au ${e.repetition?.until.split("-").reverse().join("/")}.`
      : `${nomPersonne(personne)} de service ${plage(e.intervalle.startAt, e.intervalle.endAt)} (${site.name}).`;
  const sautees = absentes
    ? ` ${absentes} date${absentes > 1 ? "s" : ""} sautée${absentes > 1 ? "s" : ""} : absence.`
    : "";
  return {
    message: `${base}${sautees}${texteAvertissements(avertissements)}`,
    niveau: absentes || avertissements.length ? "warning" : "success",
  };
}

export async function modifierVacation(
  id: number,
  e: Omit<VacationEntree, "repetition">,
): Promise<Issue> {
  const v = await prisma.vacation.findUnique({ where: { id } });
  if (!v) throw new UserFacingError("Vacation introuvable.");
  const [personne, site] = await Promise.all([
    prisma.personnel.findUnique({
      where: { id: e.personnelId },
      include: INCLUDE_PERSONNE_AFFECTABLE,
    }),
    prisma.site.findUnique({ where: { id: e.siteId }, select: { name: true } }),
  ]);
  if (!personne || !site) throw new UserFacingError("Personne ou site introuvable.");
  const { avertissements } = await controlerVacations(personne, e.siteId, [e.intervalle]);
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
  return {
    message: `Vacation modifiée : ${nomPersonne(personne)}, ${plage(e.intervalle.startAt, e.intervalle.endAt)} (${site.name}).${texteAvertissements(avertissements)}`,
    niveau: avertissements.length ? "warning" : "success",
  };
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
  /** Proposition d'affectation en attente de validation. */
  propose: { id: number; nom: string } | null;
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
    personnelProposeId?: number | null;
    proposeAt?: Date | null;
  }[];
}): Promise<ServiceDossier> {
  const prevus = r.creneaux.filter((c) => c.status === "prevu");
  const toutes = await personnes();
  const noms = new Map(toutes.map((p) => [p.id, nomPersonne(p)]));
  const parCreneau = new Map<number, ServiceCreneau>();
  if (!prevus.length) return { personnes: toutes, parCreneau };
  const de = new Date(Math.min(...prevus.map((c) => c.startAt.getTime())));
  const a = new Date(Math.max(...prevus.map((c) => c.endAt.getTime())));
  const [brutes, absences] = await Promise.all([
    vacationsEntre(de, a, { siteIds: [r.espace.siteId] }),
    absencesEntre(de, a),
  ]);
  const vacations = horsAbsences(brutes.map(versVacationDatee), absences);
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
    const proposeId = c.proposeAt && c.personnelProposeId ? c.personnelProposeId : null;
    parCreneau.set(c.id, {
      etat: cv.etat,
      noms: cv.personnelIds.map((id) => noms.get(id) ?? `#${id}`),
      epingle: cv.epingle,
      propose: proposeId ? { id: proposeId, nom: noms.get(proposeId) ?? `#${proposeId}` } : null,
    });
  }
  return { personnes: toutes, parCreneau };
}

// ── Contrat, horaires de travail, sites ──

export type ContratEntree = {
  contratTypeId: number | null;
  quotite: number;
  heuresHebdo: number | null;
  contratDebut: Date | null;
  contratFin: Date | null;
  horaires: Horaires | null;
};

/** Le cycle hebdomadaire d'horaires de travail : par jour, repos ou jusqu'à deux plages. */
export function lireHorairesTravail(form: FormData): Horaires | null {
  if (!coche(form, "horaires_fixes")) return null;
  const out: Horaires = {};
  for (const j of JOURS_ISO) {
    if (coche(form, `repos_${j.iso}`)) {
      out[String(j.iso)] = [];
      continue;
    }
    const plages: [string, string][] = [];
    for (const k of [1, 2]) {
      const de = champ(form, `h${k}_de_${j.iso}`);
      const a = champ(form, `h${k}_a_${j.iso}`);
      if (!de && !a) continue;
      const d = minutesDe(de);
      const f = minutesDe(a);
      if (d === null || f === null)
        throw new UserFacingError(`${j.long} : indiquez le début et la fin de chaque plage.`);
      if (f !== 0 && f <= d)
        throw new UserFacingError(`${j.long} : la fin d'une plage doit suivre son début.`);
      const finPrecedente = plages.length ? minutesDe(plages[plages.length - 1][1]) : null;
      if (finPrecedente !== null && d < finPrecedente)
        throw new UserFacingError(`${j.long} : la seconde plage doit suivre la première.`);
      plages.push([de, a]);
    }
    out[String(j.iso)] = plages;
  }
  return out;
}

export function lireContrat(form: FormData): ContratEntree {
  const quotite = parseInt_(form.get("quotite"), 100, 1) ?? 100;
  if (quotite > 100) throw new UserFacingError("La quotité ne peut pas dépasser 100 %.");
  const heures = champ(form, "heures_hebdo");
  const heuresHebdo = heures ? parseFloat_(heures.replace(",", "."), null) : null;
  if (heures && (heuresHebdo === null || heuresHebdo <= 0 || heuresHebdo > 48))
    throw new UserFacingError("La durée hebdomadaire doit être comprise entre 1 et 48 heures.");
  const debut = champ(form, "contrat_debut");
  const fin = champ(form, "contrat_fin");
  if (debut && fin && fin < debut)
    throw new UserFacingError("La fin du contrat précède son début.");
  return {
    contratTypeId: idOuNull(form, "contrat_type_id"),
    quotite,
    heuresHebdo,
    contratDebut: RE_YMD.test(debut) ? parseYmdUtc(debut) : null,
    contratFin: RE_YMD.test(fin) ? parseYmdUtc(fin) : null,
    horaires: lireHorairesTravail(form),
  };
}

/** Les sites cochés et le principal (qui doit être coché, sinon le premier). */
export function lireSitesPersonne(form: FormData): { siteIds: number[]; principal: number | null } {
  const siteIds = ids(form, "site");
  const voulu = idOuNull(form, "site_principal");
  const principal = voulu && siteIds.includes(voulu) ? voulu : (siteIds[0] ?? null);
  return { siteIds, principal };
}

export async function mettreAJourSites(
  personnelId: number,
  s: { siteIds: number[]; principal: number | null },
): Promise<void> {
  await prisma.$transaction([
    prisma.personnelSite.deleteMany({ where: { personnelId } }),
    prisma.personnelSite.createMany({
      data: s.siteIds.map((siteId) => ({ personnelId, siteId, principal: siteId === s.principal })),
    }),
  ]);
}

export const INCLUDE_PERSONNE = {
  contratType: true,
  sites: { include: { site: { select: { id: true, name: true } } } },
} satisfies Prisma.PersonnelInclude;

export type PersonneComplete = Prisma.PersonnelGetPayload<{ include: typeof INCLUDE_PERSONNE }>;

export async function chargerPersonneComplete(id: number): Promise<PersonneComplete | null> {
  return prisma.personnel.findUnique({ where: { id }, include: INCLUDE_PERSONNE });
}

export async function referentiel(kind: "contrat_type" | "absence_motif") {
  return prisma.referential.findMany({
    where: { kind, isActive: true },
    orderBy: [{ position: "asc" }, { label: "asc" }],
  });
}

// ── Absences ──

export type AbsenceEntree = {
  motifId: number | null;
  intervalle: Intervalle;
  note: string | null;
};

export function lireAbsence(form: FormData): AbsenceEntree {
  const du = champ(form, "du");
  const au = champ(form, "au") || du;
  if (!RE_YMD.test(du) || !RE_YMD.test(au))
    throw new UserFacingError("Indiquez le premier et le dernier jour de l'absence.");
  if (au < du) throw new UserFacingError("Le dernier jour précède le premier.");
  let intervalle: Intervalle;
  if (coche(form, "journee")) {
    intervalle = { startAt: parisMidnight(du), endAt: addParisDays(parisMidnight(au), 1) };
  } else {
    const startAt = parisDateTimeToInstant(du, champ(form, "heure_debut"));
    const endAt = parisDateTimeToInstant(au, champ(form, "heure_fin"));
    if (!startAt || !endAt) throw new UserFacingError("Indiquez les heures de début et de fin.");
    if (endAt <= startAt) throw new UserFacingError("La fin de l'absence précède son début.");
    intervalle = { startAt, endAt };
  }
  return {
    motifId: idOuNull(form, "motif_id"),
    intervalle,
    note: champOuNull(form, "note")?.slice(0, 200) ?? null,
  };
}

export async function creerAbsence(
  personnelId: number,
  e: AbsenceEntree,
  user: CurrentUser,
): Promise<string> {
  const motif = e.motifId
    ? await prisma.referential.findUnique({ where: { id: e.motifId } })
    : null;
  await prisma.absence.create({
    data: {
      personnelId,
      motifId: motif?.id ?? null,
      startAt: e.intervalle.startAt,
      endAt: e.intervalle.endAt,
      note: e.note,
      createdBy: user.email,
    },
  });
  return `Absence enregistrée : ${motif?.label ?? "sans motif"}, ${libelleAbsence(e.intervalle)}.`;
}

export async function supprimerAbsence(id: number, personnelId: number): Promise<string> {
  const a = await prisma.absence.findUnique({ where: { id }, include: { motif: true } });
  if (!a || a.personnelId !== personnelId) throw new UserFacingError("Absence introuvable.");
  await prisma.absence.delete({ where: { id } });
  return `Absence supprimée (${a.motif?.label ?? "sans motif"}, ${libelleAbsence(a)}).`;
}

/** Les absences d'une personne qui finissent après `depuis`, avec leur motif. */
export async function absencesDe(personnelId: number, depuis: Date) {
  return prisma.absence.findMany({
    where: { personnelId, endAt: { gt: depuis } },
    include: { motif: { select: { label: true, icon: true } } },
    orderBy: { startAt: "asc" },
  });
}
