/**
 * Personnel de service (gardiens, agents d'accueil, vacataires) : vacations sur un site,
 * couverture des créneaux réservés, chevauchements d'une même personne, répétition
 * hebdomadaire d'une vacation, projection pour l'édition PDF et résumé du courriel.
 * Logique PURE : testée dans personnel.test.ts.
 */
import {
  chevauche,
  conflits,
  developperRecurrence,
  type Intervalle,
  type Recurrence,
} from "@/lib/creneaux";
import { type EvtSemaine, projeter } from "@/lib/editions";
import { dateMoyenne, plage } from "@/lib/libelles";
import { hm, parisParts } from "@/lib/paris-time";

export type PersonneRef = {
  id: number;
  firstName: string;
  lastName: string;
  fonction?: string | null;
  color?: string | null;
};

export type VacationRef = Intervalle & {
  id: number;
  personnelId: number;
  siteId: number;
  serieId?: string | null;
  note?: string | null;
};

/** Un créneau réservé à couvrir : son site, et la personne épinglée s'il y en a une. */
export type CreneauACouvrir = Intervalle & {
  id: number;
  reservationId: number;
  numero: string;
  titre: string;
  espaceId: number;
  espaceNom: string;
  siteId: number;
  siteNom: string;
  personnelId: number | null;
};

export type EtatCouverture = "couvert" | "partiel" | "non_couvert";

export const ETATS_COUVERTURE: Record<EtatCouverture, { label: string; teinte: string }> = {
  couvert: { label: "Couvert", teinte: "emerald" },
  partiel: { label: "Partiel", teinte: "amber" },
  non_couvert: { label: "À couvrir", teinte: "red" },
};

export type Couverture = {
  etat: EtatCouverture;
  /** Les personnes de service sur ce créneau (épinglée d'abord, puis celles dont la vacation le touche). */
  personnelIds: number[];
  /** Le créneau est couvert par une personne épinglée (indépendamment des vacations). */
  epingle: boolean;
};

export function nomPersonne(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/** Les minutes d'un créneau qu'aucune vacation du site ne couvre : 0 = couvert. */
function minutesDecouvertes(c: Intervalle, vacations: readonly Intervalle[]): number {
  const dedans = vacations
    .filter((v) => chevauche(v, c))
    .map((v) => ({
      de: Math.max(v.startAt.getTime(), c.startAt.getTime()),
      a: Math.min(v.endAt.getTime(), c.endAt.getTime()),
    }))
    .sort((x, y) => x.de - y.de);
  let curseur = c.startAt.getTime();
  let trou = 0;
  for (const d of dedans) {
    if (d.de > curseur) trou += d.de - curseur;
    curseur = Math.max(curseur, d.a);
  }
  if (curseur < c.endAt.getTime()) trou += c.endAt.getTime() - curseur;
  return Math.round(trou / 60_000);
}

/**
 * L'état de couverture d'un créneau : couvert si une personne y est épinglée ou si les
 * vacations de son site (mises bout à bout) le couvrent entièrement ; partiel si une vacation
 * le touche sans tout couvrir ; à couvrir sinon.
 */
export function couverture(c: CreneauACouvrir, vacations: readonly VacationRef[]): Couverture {
  const duSite = vacations.filter((v) => v.siteId === c.siteId && chevauche(v, c));
  const personnelIds = [...new Set(duSite.map((v) => v.personnelId))];
  if (c.personnelId) {
    return {
      etat: "couvert",
      personnelIds: [c.personnelId, ...personnelIds.filter((id) => id !== c.personnelId)],
      epingle: true,
    };
  }
  if (!duSite.length) return { etat: "non_couvert", personnelIds: [], epingle: false };
  const trou = minutesDecouvertes(c, duSite);
  return { etat: trou > 0 ? "partiel" : "couvert", personnelIds, epingle: false };
}

export type CreneauCouvert = { creneau: CreneauACouvrir; couverture: Couverture };

export function etatsCouverture(
  creneaux: readonly CreneauACouvrir[],
  vacations: readonly VacationRef[],
): CreneauCouvert[] {
  return creneaux.map((creneau) => ({ creneau, couverture: couverture(creneau, vacations) }));
}

export function creneauxNonCouverts(etats: readonly CreneauCouvert[]): CreneauCouvert[] {
  return etats.filter((e) => e.couverture.etat !== "couvert");
}

export type ResumeCouverture = Record<EtatCouverture, number> & { total: number };

export function resumeCouverture(etats: readonly CreneauCouvert[]): ResumeCouverture {
  const out: ResumeCouverture = { total: etats.length, couvert: 0, partiel: 0, non_couvert: 0 };
  for (const e of etats) out[e.couverture.etat] += 1;
  return out;
}

/** Parmi les vacations existantes d'une personne, celles qui chevauchent une des vacations demandées. */
export function chevauchementsPersonne<T extends Intervalle>(
  demandees: readonly Intervalle[],
  existantes: readonly T[],
): { demande: Intervalle; existant: T }[] {
  return conflits([...demandees], [...existantes]);
}

export type RepetitionVacation = {
  /** Dernière date incluse « YYYY-MM-DD ». */
  until: string;
  horsFeries?: boolean;
  horsVacances?: boolean;
};

/** La récurrence hebdomadaire équivalente (le jour de la première vacation). */
export function recurrenceDe(rep: RepetitionVacation | null): Recurrence | null {
  if (!rep) return null;
  return {
    freq: "weekly",
    interval: 1,
    until: rep.until,
    horsFeries: !!rep.horsFeries,
    horsVacances: !!rep.horsVacances,
  };
}

/**
 * Développe une vacation selon sa répétition hebdomadaire (première comprise), aux jours
 * exclus près (fériés, vacances, lus par l'appelant).
 */
export function developperVacations(
  premiere: Intervalle,
  rep: RepetitionVacation | null,
  exclus: Iterable<string> = [],
): Intervalle[] {
  return developperRecurrence(premiere, recurrenceDe(rep), exclus);
}

export type VacationDatee = VacationRef & { personne: PersonneRef };

/**
 * Les vacations d'une semaine projetées sur ses jours, pour la grille d'édition : la
 * « colonne » est le site, le titre le nom de la personne. Les créneaux à couvrir
 * (non couverts ou partiels) y apparaissent hachurés, comme un blocage.
 */
export function evtsVacations(
  vacations: readonly VacationDatee[],
  aCouvrir: readonly CreneauCouvert[],
  jours: readonly string[],
): EvtSemaine[] {
  return projeter(
    [
      ...vacations.map((v) => ({
        startAt: v.startAt,
        endAt: v.endAt,
        titre: nomPersonne(v.personne),
        sousTitre: v.note || v.personne.fonction || "",
        genre: "reservation" as const,
        espaceId: v.siteId,
      })),
      ...aCouvrir
        .filter((e) => e.couverture.etat !== "couvert")
        .map((e) => ({
          startAt: e.creneau.startAt,
          endAt: e.creneau.endAt,
          titre: `${ETATS_COUVERTURE[e.couverture.etat].label} · ${e.creneau.titre}`,
          sousTitre: e.creneau.espaceNom,
          genre: "blocage" as const,
          espaceId: e.creneau.siteId,
        })),
    ],
    jours,
  );
}

/**
 * Le résumé en texte des vacations d'une personne sur une semaine : une ligne par vacation.
 * `jours` : les clés « YYYY-MM-DD » de la semaine ; `libelles` : leurs libellés affichés.
 */
export function resumeSemainePersonne(
  vacations: readonly (VacationRef & { siteNom: string })[],
  jours: readonly string[],
  libelles: readonly string[] = jours,
): string {
  const evts = projeter(
    vacations.map((v) => ({
      startAt: v.startAt,
      endAt: v.endAt,
      titre: v.siteNom,
      sousTitre: v.note ?? "",
      genre: "reservation" as const,
      espaceId: v.siteId,
    })),
    jours,
  );
  if (!evts.length) return "Aucune vacation cette semaine.";
  return evts
    .map(
      (e) =>
        `– ${libelles[e.jour - 1] ?? ""} ${hm(e.debutMin)}–${hm(e.finMin)} · ${e.titre}${e.sousTitre ? ` (${e.sousTitre})` : ""}`,
    )
    .join("\n");
}

export function nomFichierPlanningPersonnel(lundi: string): string {
  return `planning-service-${lundi}.pdf`;
}

/**
 * Le libellé d'une absence : « Sam. 28/11/2026 · journée entière », « du Jeu. 12/11/2026 au
 * Dim. 15/11/2026 · journées entières », sinon la plage horaire.
 */
export function libelleAbsence(a: Intervalle): string {
  const debut = parisParts(a.startAt);
  const fin = parisParts(a.endAt);
  if (debut.min === 0 && fin.min === 0) {
    const dernier = new Date(a.endAt.getTime() - 1);
    if (parisParts(dernier).dateKey === debut.dateKey)
      return `${dateMoyenne(a.startAt)} · journée entière`;
    return `du ${dateMoyenne(a.startAt)} au ${dateMoyenne(dernier)} · journées entières`;
  }
  return plage(a.startAt, a.endAt);
}
