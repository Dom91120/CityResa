/**
 * Espaces : lecture du formulaire (identité, visibilité, règles, horaires), chargement
 * d'une fiche, vignettes, règles lisibles, suppression, sous-ressources (équipements,
 * tarifs, options, gestionnaires, indisponibilités, flux ICS).
 *
 *   name · short_name · slug · site_id · parent_id · nature_id · secteur · description · capacity_standing ·
 *   capacity_seated · surface · floor · color · is_public · profil (codes, multiple) ·
 *   requires_validation · ferme_<j> / ouv_<j> / ferm_<j> (j = 1..7) · slot_step_min ·
 *   min_duration_min · max_duration_min · delay_min_days · horizon_max_days ·
 *   buffer_before_min · buffer_after_min · caution_amount · status · rules · instructions
 */
import type { Prisma } from "@/generated/prisma/client";
import {
  COULEURS_ESPACE,
  ESPACE_SECTEURS,
  ESPACE_STATUS,
  JOURS_ISO,
  OPTION_UNITES,
  STATUTS_OCCUPANTS,
  TARIF_UNITES,
} from "@/lib/constantes";
import { type Horaires, lireHoraires } from "@/lib/creneaux";
import {
  champ,
  champOuNull,
  coche,
  idOuNull,
  parseDate,
  parseFloat_,
  parseInt_,
  slugifier,
} from "@/lib/forms-util";
import { duree, montant } from "@/lib/libelles";
import { minutesDe, parisDateTimeToInstant } from "@/lib/paris-time";
import { agentsHorsSecteur, libelleSecteur, rattachable } from "@/lib/secteurs";
import { occupationParEspace } from "@/server/dashboard";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";

// ── Lecture du formulaire ──

export type EspaceEntree = {
  name: string;
  shortName: string | null;
  slug: string;
  siteId: number;
  parentId: number | null;
  natureId: number | null;
  secteur: string;
  description: string | null;
  capacityStanding: number | null;
  capacitySeated: number | null;
  surface: number | null;
  floor: string | null;
  color: string;
  isPublic: boolean;
  allowedProfiles: string[];
  requiresValidation: boolean;
  openHours: Prisma.InputJsonValue | typeof Prisma.DbNull;
  slotStepMin: number;
  minDurationMin: number;
  maxDurationMin: number | null;
  delayMinDays: number;
  horizonMaxDays: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  cautionAmount: number;
  capaciteSimultanee: number;
  valorisationHoraire: number | null;
  status: string;
  isActive: boolean;
  rules: string | null;
  instructions: string | null;
};

/** La grille des horaires saisie : une plage par jour, « Fermé » = pas de plage. `prefixe` : grille d'une saison. */
export function lireHorairesForm(form: FormData, prefixe = ""): Horaires {
  const out: Horaires = {};
  for (const j of JOURS_ISO) {
    if (coche(form, `${prefixe}ferme_${j.iso}`)) {
      out[String(j.iso)] = [];
      continue;
    }
    const ouv = champ(form, `${prefixe}ouv_${j.iso}`);
    const ferm = champ(form, `${prefixe}ferm_${j.iso}`);
    const o = minutesDe(ouv);
    const f = minutesDe(ferm);
    if (o === null || f === null)
      throw new UserFacingError(
        `${j.long} : indiquez l'heure d'ouverture et de fermeture, ou cochez « Fermé ».`,
      );
    if (f !== 0 && f <= o)
      throw new UserFacingError(`${j.long} : la fermeture doit être après l'ouverture.`);
    out[String(j.iso)] = [[ouv, ferm]];
  }
  return out;
}

/** Les horaires particuliers par saison : la grille de chaque saison dont la case est cochée, null sinon. */
export function lireHorairesSaisonsForm(
  form: FormData,
  saisons: { id: number; label: string }[],
): { saisonId: number; openHours: Horaires | null }[] {
  return saisons.map((s) => {
    if (!coche(form, `saison_${s.id}_actif`)) return { saisonId: s.id, openHours: null };
    try {
      return { saisonId: s.id, openHours: lireHorairesForm(form, `s${s.id}_`) };
    } catch (e) {
      if (e instanceof UserFacingError)
        throw new UserFacingError(`Saison ${s.label} · ${e.message}`);
      throw e;
    }
  });
}

export function lireEspace(form: FormData, profilsConnus: string[]): EspaceEntree {
  const name = champ(form, "name").slice(0, 120);
  if (!name) throw new UserFacingError("Indiquez le nom de l'espace.");
  const slug = (slugifier(champ(form, "slug")) || slugifier(name)).slice(0, 140);
  if (!slug) throw new UserFacingError("L'adresse (slug) de l'espace est vide.");
  const siteId = idOuNull(form, "site_id");
  if (!siteId) throw new UserFacingError("Choisissez le site de l'espace.");
  const color = champ(form, "color");
  const status = champ(form, "status");
  if (!(status in ESPACE_STATUS)) throw new UserFacingError("Statut inconnu.");
  const secteur = champ(form, "secteur");
  if (!(secteur in ESPACE_SECTEURS))
    throw new UserFacingError("Indiquez le secteur de l'espace : salles ou sports.");
  const connus = new Set(profilsConnus);
  const allowedProfiles = form
    .getAll("profil")
    .map(String)
    .filter((c) => connus.has(c));
  const slotStepMin = parseInt_(form.get("slot_step_min"), 30, 5) ?? 30;
  const minDurationMin = parseInt_(form.get("min_duration_min"), 60, 0) ?? 60;
  const maxDurationMin = parseInt_(form.get("max_duration_min"), null, 0);
  if (maxDurationMin !== null && maxDurationMin > 0 && maxDurationMin < minDurationMin)
    throw new UserFacingError("La durée maximale doit être supérieure à la durée minimale.");
  const delayMinDays = parseInt_(form.get("delay_min_days"), 7, 0) ?? 7;
  const horizonMaxDays = parseInt_(form.get("horizon_max_days"), 365, 1) ?? 365;
  if (horizonMaxDays < delayMinDays)
    throw new UserFacingError("L'horizon de réservation doit dépasser le délai minimal.");
  return {
    name,
    shortName: champOuNull(form, "short_name")?.slice(0, 60) ?? null,
    slug,
    siteId,
    parentId: idOuNull(form, "parent_id"),
    natureId: idOuNull(form, "nature_id"),
    secteur,
    description: champOuNull(form, "description"),
    capacityStanding: parseInt_(form.get("capacity_standing"), null, 0),
    capacitySeated: parseInt_(form.get("capacity_seated"), null, 0),
    surface: parseFloat_(form.get("surface"), null),
    floor: champOuNull(form, "floor")?.slice(0, 40) ?? null,
    color: /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : COULEURS_ESPACE[0],
    isPublic: coche(form, "is_public"),
    allowedProfiles,
    requiresValidation: coche(form, "requires_validation"),
    openHours: lireHorairesForm(form) as Prisma.InputJsonValue,
    slotStepMin,
    minDurationMin,
    maxDurationMin: maxDurationMin && maxDurationMin > 0 ? maxDurationMin : null,
    delayMinDays,
    horizonMaxDays,
    bufferBeforeMin: parseInt_(form.get("buffer_before_min"), 0, 0) ?? 0,
    bufferAfterMin: parseInt_(form.get("buffer_after_min"), 0, 0) ?? 0,
    cautionAmount: Math.max(0, parseFloat_(form.get("caution_amount"), 0) ?? 0),
    capaciteSimultanee: parseInt_(form.get("capacite_simultanee"), 1, 1) ?? 1,
    valorisationHoraire: parseFloat_(form.get("valorisation_horaire"), null),
    status,
    isActive: status !== "inactif",
    rules: champOuNull(form, "rules"),
    instructions: champOuNull(form, "instructions"),
  };
}

export async function verifierSlugEspace(slug: string, excludeId: number | null): Promise<void> {
  const autre = await prisma.espace.findUnique({ where: { slug }, select: { id: true } });
  if (autre && autre.id !== excludeId)
    throw new UserFacingError(`L'adresse « ${slug} » est déjà utilisée par un autre espace.`);
}

/** Un espace ne peut pas être son propre parent, ni le sous-espace d'un sous-espace. */
export async function verifierParent(parentId: number | null, id: number | null): Promise<void> {
  if (!parentId) return;
  if (id && parentId === id)
    throw new UserFacingError("Un espace ne peut pas être son propre espace parent.");
  const parent = await prisma.espace.findUnique({
    where: { id: parentId },
    select: { parentId: true, siteId: true },
  });
  if (!parent) throw new UserFacingError("Espace parent introuvable.");
  if (parent.parentId)
    throw new UserFacingError(
      "L'espace parent est déjà un sous-espace : un seul niveau est admis.",
    );
  if (id) {
    const enfants = await prisma.espace.count({ where: { parentId: id } });
    if (enfants)
      throw new UserFacingError(
        "Cet espace a déjà des sous-espaces : il ne peut pas devenir lui-même un sous-espace.",
      );
  }
}

// ── Chargement ──

export const INCLUDE_ESPACE = {
  site: true,
  horairesSaisons: {
    include: { saison: true },
    orderBy: { saison: { startDate: "asc" as const } },
  },
  parent: { select: { id: true, name: true } },
  enfants: { select: { id: true, name: true, color: true, status: true, isActive: true } },
  nature: true,
  equipements: { include: { equipement: true } },
  tarifs: {
    include: { profil: true },
    orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
  },
  options: { orderBy: [{ position: "asc" as const }, { id: "asc" as const }] },
  gestionnaires: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, fonction: true } },
    },
  },
  _count: { select: { reservations: true, creneaux: true } },
} satisfies Prisma.EspaceInclude;

export type EspaceComplet = Prisma.EspaceGetPayload<{ include: typeof INCLUDE_ESPACE }>;

export async function chargerEspace(id: number): Promise<EspaceComplet | null> {
  return prisma.espace.findUnique({ where: { id }, include: INCLUDE_ESPACE });
}

/** La première photo (id de document) de chaque espace demandé. */
export async function premieresPhotos(espaceIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!espaceIds.length) return out;
  const docs = await prisma.document.findMany({
    where: { espaceId: { in: espaceIds }, kind: "photo" },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    select: { id: true, espaceId: true },
  });
  for (const d of docs) {
    if (d.espaceId && !out.has(d.espaceId)) out.set(d.espaceId, d.id);
  }
  return out;
}

/** Les référentiels dont le module a besoin (actifs, dans l'ordre). */
export async function referentielsEspaces() {
  const rows = await prisma.referential.findMany({
    where: { kind: { in: ["espace_nature", "equipement", "profil"] }, isActive: true },
    orderBy: [{ position: "asc" }, { label: "asc" }],
  });
  return {
    natures: rows.filter((r) => r.kind === "espace_nature"),
    equipements: rows.filter((r) => r.kind === "equipement"),
    profils: rows.filter((r) => r.kind === "profil"),
  };
}

/** Libellé d'un code de profil (code → libellé), pour les pastilles. */
export function libellesProfils(profils: { code: string | null; label: string }[]) {
  return new Map(profils.filter((p) => p.code).map((p) => [p.code as string, p.label]));
}

// ── Règles lisibles ──

export type EspaceRegles = {
  slotStepMin: number;
  minDurationMin: number;
  maxDurationMin: number | null;
  delayMinDays: number;
  horizonMaxDays: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  cautionAmount: number;
  capaciteSimultanee?: number;
  requiresValidation: boolean;
};

/** Les règles de réservation en phrases courtes. */
export function decrireRegles(e: EspaceRegles): string[] {
  const out: string[] = [];
  out.push(`Créneaux par pas de ${e.slotStepMin} min`);
  out.push(
    `Durée minimale ${duree(e.minDurationMin)}${e.maxDurationMin ? `, maximale ${duree(e.maxDurationMin)}` : ""}`,
  );
  out.push(
    e.delayMinDays
      ? `Demande au moins ${e.delayMinDays} jour${e.delayMinDays > 1 ? "s" : ""} à l'avance`
      : "Pas de délai minimal",
  );
  out.push(`Réservable jusqu'à ${e.horizonMaxDays} jours à l'avance`);
  if (e.bufferBeforeMin || e.bufferAfterMin)
    out.push(
      `Montage ${e.bufferBeforeMin} min avant, démontage ${e.bufferAfterMin} min après chaque créneau`,
    );
  out.push(e.cautionAmount ? `Caution de ${montant(e.cautionAmount)}` : "Aucune caution");
  if ((e.capaciteSimultanee ?? 1) > 1)
    out.push(
      `Espace partageable : jusqu'à ${e.capaciteSimultanee} réservations en même temps (pistes, bassin, terrain partagé)`,
    );
  out.push(
    e.requiresValidation
      ? "Chaque demande est validée par un agent"
      : "Les demandes sont confirmées automatiquement",
  );
  return out;
}

/** Les horaires d'ouverture à afficher : 7 lignes (jour, plages ou « Fermé »). */
export function horairesTableau(json: unknown): { jour: string; plages: string }[] {
  const h = lireHoraires(json);
  return JOURS_ISO.map((j) => {
    const plages = h ? (h[String(j.iso)] ?? []) : [["08:00", "22:00"]];
    return {
      jour: j.long,
      plages: plages.length
        ? plages.map(([o, f]) => `${o.replace(":", "h")} – ${f.replace(":", "h")}`).join(", ")
        : "Fermé",
    };
  });
}

// ── Suppression ──

/** Désactivation si des réservations existent, suppression définitive sinon. */
export async function supprimerEspace(id: number): Promise<string> {
  const e = await prisma.espace.findUnique({
    where: { id },
    include: { _count: { select: { reservations: true, enfants: true } } },
  });
  if (!e) throw new UserFacingError("Espace introuvable.");
  if (e._count.reservations > 0) {
    await prisma.espace.update({
      where: { id },
      data: { isActive: false, status: "inactif", isPublic: false },
    });
    return `L'espace « ${e.name} » a été désactivé (${e._count.reservations} réservation(s) y sont rattachées).`;
  }
  if (e._count.enfants > 0)
    throw new UserFacingError(
      "Cet espace a des sous-espaces : supprimez-les ou rattachez-les ailleurs d'abord.",
    );
  await prisma.espace.delete({ where: { id } });
  return `Espace « ${e.name} » supprimé.`;
}

// ── Activité ──

/** Les prochains créneaux vivants d'un espace. */
export async function prochainsCreneaux(espaceId: number, limite = 10) {
  return prisma.creneau.findMany({
    where: {
      espaceId,
      status: "prevu",
      endAt: { gte: new Date() },
      reservation: { status: { in: STATUTS_OCCUPANTS } },
    },
    include: {
      reservation: {
        select: {
          id: true,
          numero: true,
          title: true,
          status: true,
          organisation: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { startAt: "asc" },
    take: limite,
  });
}

/** Les blocages à venir (ou en cours) d'un espace. */
export async function indisponibilitesAVenir(espaceId: number) {
  return prisma.indisponibilite.findMany({
    where: { espaceId, endAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
  });
}

/** Le taux d'occupation des 30 derniers jours. */
export async function occupation30Jours(espaceId: number) {
  const a = new Date();
  const de = new Date(a.getTime() - 30 * 86_400_000);
  const tous = await occupationParEspace({ de, a, label: "30 derniers jours" });
  return tous.find((x) => x.id === espaceId) ?? null;
}

// ── Sous-ressources ──

export async function enregistrerEquipements(espaceId: number, ids: number[]): Promise<void> {
  const valides = await prisma.referential.findMany({
    where: { id: { in: ids }, kind: "equipement" },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.espaceEquipement.deleteMany({ where: { espaceId } }),
    ...(valides.length
      ? [
          prisma.espaceEquipement.createMany({
            data: valides.map((v) => ({ espaceId, equipementId: v.id })),
          }),
        ]
      : []),
  ]);
}

export async function ajouterTarif(espaceId: number, form: FormData): Promise<void> {
  const unite = champ(form, "unite");
  if (!(unite in TARIF_UNITES)) throw new UserFacingError("Unité de tarif inconnue.");
  const m = parseFloat_(form.get("montant"), null);
  if (m === null || m < 0) throw new UserFacingError("Indiquez un montant (0 pour la gratuité).");
  const profilId = idOuNull(form, "profil_id");
  if (profilId) {
    const p = await prisma.referential.findFirst({ where: { id: profilId, kind: "profil" } });
    if (!p) throw new UserFacingError("Profil introuvable.");
  }
  const validFrom = parseDate(form.get("valid_from"));
  const doublon = await prisma.tarif.findFirst({
    where: { espaceId, profilId, unite, validFrom },
  });
  if (doublon)
    throw new UserFacingError(
      "Un tarif existe déjà pour ce profil, cette unité et cette date d'effet : supprimez-le d'abord, ou donnez une date d'effet à la nouvelle ligne.",
    );
  const dernier = await prisma.tarif.aggregate({ where: { espaceId }, _max: { position: true } });
  await prisma.tarif.create({
    data: {
      espaceId,
      profilId,
      unite,
      montant: Math.round(m * 100) / 100,
      label: champOuNull(form, "label")?.slice(0, 120) ?? null,
      position: (dernier._max.position ?? -1) + 1,
      validFrom,
      deliberation: champOuNull(form, "deliberation")?.slice(0, 120) ?? null,
    },
  });
}

export async function supprimerTarif(espaceId: number, tarifId: number): Promise<void> {
  const t = await prisma.tarif.findFirst({ where: { id: tarifId, espaceId } });
  if (!t) throw new UserFacingError("Tarif introuvable.");
  await prisma.tarif.delete({ where: { id: tarifId } });
}

export type OptionEntree = {
  label: string;
  description: string | null;
  montant: number;
  unite: string;
  mandatory: boolean;
  isActive: boolean;
};

export function lireOption(form: FormData): OptionEntree {
  const label = champ(form, "label").slice(0, 120);
  if (!label) throw new UserFacingError("Indiquez le libellé de la prestation.");
  const unite = champ(form, "unite");
  if (!(unite in OPTION_UNITES)) throw new UserFacingError("Unité de prestation inconnue.");
  const m = parseFloat_(form.get("montant"), 0) ?? 0;
  if (m < 0) throw new UserFacingError("Le montant ne peut pas être négatif.");
  return {
    label,
    description: champOuNull(form, "description")?.slice(0, 300) ?? null,
    montant: Math.round(m * 100) / 100,
    unite,
    mandatory: coche(form, "mandatory"),
    isActive: coche(form, "is_active"),
  };
}

export async function enregistrerOption(
  espaceId: number,
  optionId: number | null,
  data: OptionEntree,
): Promise<void> {
  if (optionId) {
    const o = await prisma.option.findFirst({ where: { id: optionId, espaceId } });
    if (!o) throw new UserFacingError("Prestation introuvable.");
    await prisma.option.update({ where: { id: optionId }, data });
    return;
  }
  const dernier = await prisma.option.aggregate({ where: { espaceId }, _max: { position: true } });
  await prisma.option.create({
    data: { ...data, espaceId, position: (dernier._max.position ?? -1) + 1 },
  });
}

/** Une prestation déjà utilisée par des dossiers est désactivée plutôt que supprimée. */
export async function supprimerOption(espaceId: number, optionId: number): Promise<string> {
  const o = await prisma.option.findFirst({
    where: { id: optionId, espaceId },
    include: { _count: { select: { reservations: true } } },
  });
  if (!o) throw new UserFacingError("Prestation introuvable.");
  if (o._count.reservations > 0) {
    await prisma.option.update({ where: { id: optionId }, data: { isActive: false } });
    return `« ${o.label} » est utilisée par ${o._count.reservations} dossier(s) : elle a été désactivée.`;
  }
  await prisma.option.delete({ where: { id: optionId } });
  return `Prestation « ${o.label} » supprimée.`;
}

export const ROLES_GESTIONNAIRE: Record<string, { label: string; aide: string; teinte: string }> = {
  gestionnaire: {
    label: "Gestionnaire",
    aide: "Décide sur les demandes de cet espace.",
    teinte: "rose",
  },
  lecteur: { label: "Lecteur", aide: "Consulte les demandes sans décider.", teinte: "sky" },
  notifie: { label: "Notifié", aide: "Reçoit les alertes de cet espace.", teinte: "amber" },
};

export async function ajouterGestionnaire(espaceId: number, form: FormData): Promise<void> {
  const userId = champ(form, "user_id");
  const role = champ(form, "role");
  if (!userId) throw new UserFacingError("Choisissez un agent.");
  if (!(role in ROLES_GESTIONNAIRE)) throw new UserFacingError("Rôle inconnu.");
  const [u, espace] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, kind: "agent", isActive: true },
      select: { id: true, firstName: true, lastName: true, secteur: true },
    }),
    prisma.espace.findUnique({ where: { id: espaceId }, select: { secteur: true } }),
  ]);
  if (!u) throw new UserFacingError("Agent introuvable ou inactif.");
  if (espace && !rattachable(u.secteur, espace.secteur))
    throw new UserFacingError(
      `${u.firstName} ${u.lastName} est du secteur ${libelleSecteur(u.secteur)} : il ne peut pas être rattaché à un espace du secteur ${libelleSecteur(espace.secteur)}.`,
    );
  await prisma.espaceGestionnaire.upsert({
    where: { espaceId_userId: { espaceId, userId } },
    create: { espaceId, userId, role },
    update: { role },
  });
}

export async function retirerGestionnaire(espaceId: number, userId: string): Promise<void> {
  await prisma.espaceGestionnaire.deleteMany({ where: { espaceId, userId } });
}

/**
 * Refuse de changer le secteur d'un espace tant que des agents de l'ancien secteur y sont
 * rattachés : il faut d'abord les retirer (onglet Gestionnaires).
 */
export async function verifierSecteurEspace(espaceId: number, secteur: string): Promise<void> {
  const lies = await prisma.espaceGestionnaire.findMany({
    where: { espaceId },
    select: { user: { select: { firstName: true, lastName: true, secteur: true } } },
  });
  const genants = agentsHorsSecteur(
    secteur,
    lies.map((l) => l.user),
  );
  if (genants.length)
    throw new UserFacingError(
      `Secteur « ${libelleSecteur(secteur)} » impossible : ${genants.map((a) => `${a.firstName} ${a.lastName}`).join(", ")} ${genants.length > 1 ? "sont rattachés" : "est rattaché"} à cet espace et relève${genants.length > 1 ? "nt" : ""} d'un autre secteur. Retirez d'abord ce${genants.length > 1 ? "s" : ""} gestionnaire${genants.length > 1 ? "s" : ""}.`,
    );
}

/**
 * Les agents proposables comme gestionnaires d'un espace : actifs, non encore rattachés, du
 * secteur de l'espace ou transversaux.
 */
export async function agentsDisponibles(dejaIds: string[], secteur: string) {
  return prisma.user.findMany({
    where: {
      kind: "agent",
      isActive: true,
      id: { notIn: dejaIds },
      OR: [{ secteur: null }, { secteur }],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  });
}

/** Le blocage saisi sur la fiche d'un espace (heure de Paris). */
export function lireIndisponibilite(form: FormData): {
  startAt: Date;
  endAt: Date;
  motif: string | null;
} {
  const debut = parisDateTimeToInstant(champ(form, "date_debut"), champ(form, "heure_debut"));
  const fin = parisDateTimeToInstant(champ(form, "date_fin"), champ(form, "heure_fin"));
  if (!debut || !fin) throw new UserFacingError("Indiquez les dates et heures de début et de fin.");
  if (fin <= debut) throw new UserFacingError("La fin du blocage doit être après son début.");
  return { startAt: debut, endAt: fin, motif: champOuNull(form, "motif")?.slice(0, 200) ?? null };
}

export async function ajouterIndisponibilite(
  espaceId: number,
  b: { startAt: Date; endAt: Date; motif: string | null },
  acteur: string,
): Promise<void> {
  await prisma.indisponibilite.create({
    data: { espaceId, startAt: b.startAt, endAt: b.endAt, motif: b.motif, createdBy: acteur },
  });
}

export async function supprimerIndisponibilite(espaceId: number, id: number): Promise<void> {
  const b = await prisma.indisponibilite.findFirst({ where: { id, espaceId } });
  if (!b) throw new UserFacingError("Blocage introuvable.");
  await prisma.indisponibilite.delete({ where: { id } });
}
