/**
 * Présences et heures réalisées : après coup, un agent constate pour chaque créneau prévu si
 * l'usager est venu (et combien de temps) ou s'il a manqué sans prévenir. Les heures
 * effectives nourrissent la valorisation et les statistiques d'occupation réelle.
 * Logique PURE : testée dans presences.test.ts.
 */
import { dureeMinutes, type Intervalle } from "@/lib/creneaux";
import { duree } from "@/lib/libelles";

export const PRESENCES: Record<string, string> = {
  presente: "Présent",
  absente: "Absent sans prévenir",
};

export type CreneauPresence = Intervalle & {
  status: string;
  presence?: string | null;
  realStartAt?: Date | null;
  realEndAt?: Date | null;
};

/** Le créneau est passé (donc constatable). */
export function estPasse(c: Intervalle, now = new Date()): boolean {
  return c.endAt <= now;
}

/** Les heures réellement occupées : si l'usager est venu, ses heures constatées (sinon celles prévues) ; absent, rien. */
export function intervalleEffectif(c: CreneauPresence): Intervalle | null {
  if (c.status !== "prevu" || c.presence === "absente") return null;
  if (c.presence === "presente" && c.realStartAt && c.realEndAt)
    return { startAt: c.realStartAt, endAt: c.realEndAt };
  return { startAt: c.startAt, endAt: c.endAt };
}

export function heuresEffectives(c: CreneauPresence): number {
  const i = intervalleEffectif(c);
  return i ? dureeMinutes(i) / 60 : 0;
}

/** Ce qu'un agent saisit pour un créneau. */
export type SaisiePresence = {
  presence: "presente" | "absente";
  realStartAt: Date | null;
  realEndAt: Date | null;
  note: string | null;
};

/** Les manquements d'une saisie (vide = valide). Les heures réelles restent autour du créneau prévu. */
export function verifierSaisie(c: Intervalle, s: SaisiePresence): string[] {
  const erreurs: string[] = [];
  if (s.presence === "absente") return erreurs;
  if ((s.realStartAt === null) !== (s.realEndAt === null))
    erreurs.push("Indiquez l'heure d'arrivée et l'heure de départ, ou aucune des deux.");
  if (s.realStartAt && s.realEndAt) {
    if (s.realEndAt <= s.realStartAt) erreurs.push("Le départ doit être après l'arrivée.");
    const douzeHeures = 12 * 3_600_000;
    if (Math.abs(s.realStartAt.getTime() - c.startAt.getTime()) > douzeHeures)
      erreurs.push("Les heures constatées doivent rester autour du créneau prévu.");
    if (s.realEndAt.getTime() - s.realStartAt.getTime() > 24 * 3_600_000)
      erreurs.push("Une occupation constatée ne dépasse pas 24 h.");
  }
  return erreurs;
}

/** Les heures réelles ne sont gardées que si elles diffèrent du créneau prévu. */
export function heuresAConserver(
  c: Intervalle,
  s: SaisiePresence,
): { realStartAt: Date | null; realEndAt: Date | null } {
  if (s.presence !== "presente" || !s.realStartAt || !s.realEndAt)
    return { realStartAt: null, realEndAt: null };
  const identiques =
    s.realStartAt.getTime() === c.startAt.getTime() && s.realEndAt.getTime() === c.endAt.getTime();
  return identiques
    ? { realStartAt: null, realEndAt: null }
    : { realStartAt: s.realStartAt, realEndAt: s.realEndAt };
}

export type ResumePresences = {
  /** Créneaux prévus déjà passés. */
  passes: number;
  renseignes: number;
  presents: number;
  absents: number;
  heuresPrevues: number;
  heuresReelles: number;
  /** Présents / renseignés, en % ; null sans constat. */
  tauxPresence: number | null;
};

const arrondi = (n: number) => Math.round(n * 10) / 10;

/** Le bilan des créneaux passés d'un ensemble (dossier, organisation, période). */
export function resumePresences(
  creneaux: readonly CreneauPresence[],
  now = new Date(),
): ResumePresences {
  const passes = creneaux.filter((c) => c.status === "prevu" && estPasse(c, now));
  const renseignes = passes.filter((c) => c.presence === "presente" || c.presence === "absente");
  const presents = renseignes.filter((c) => c.presence === "presente");
  const absents = renseignes.filter((c) => c.presence === "absente");
  const heuresPrevues = renseignes.reduce((s, c) => s + dureeMinutes(c) / 60, 0);
  const heuresReelles = renseignes.reduce((s, c) => s + heuresEffectives(c), 0);
  return {
    passes: passes.length,
    renseignes: renseignes.length,
    presents: presents.length,
    absents: absents.length,
    heuresPrevues: arrondi(heuresPrevues),
    heuresReelles: arrondi(heuresReelles),
    tauxPresence: renseignes.length
      ? Math.round((presents.length / renseignes.length) * 1000) / 10
      : null,
  };
}

/** « Présent · 2 h 10 constatées » / « Absent sans prévenir » / « » (non renseigné). */
export function decrirePresence(c: CreneauPresence): string {
  if (c.presence === "absente") return PRESENCES.absente;
  if (c.presence === "presente") {
    const reel =
      c.realStartAt && c.realEndAt
        ? dureeMinutes({ startAt: c.realStartAt, endAt: c.realEndAt })
        : null;
    return reel !== null && reel !== dureeMinutes(c)
      ? `${PRESENCES.presente} · ${duree(reel)} constatées`
      : PRESENCES.presente;
  }
  return "";
}

/** Les absences non signalées par organisation, les plus nombreuses d'abord. */
export function absencesParOrganisation<
  T extends {
    organisation: { id: number; name: string } | null;
    creneaux: readonly CreneauPresence[];
  },
>(dossiers: readonly T[], n = 5): { id: number; name: string; absences: number; passes: number }[] {
  const par = new Map<number, { id: number; name: string; absences: number; passes: number }>();
  for (const d of dossiers) {
    if (!d.organisation) continue;
    const r = resumePresences(d.creneaux, new Date(8.64e15));
    if (!r.renseignes) continue;
    const l = par.get(d.organisation.id) ?? { ...d.organisation, absences: 0, passes: 0 };
    l.absences += r.absents;
    l.passes += r.renseignes;
    par.set(d.organisation.id, l);
  }
  return [...par.values()]
    .filter((l) => l.absences > 0)
    .sort((a, b) => b.absences - a.absences || a.name.localeCompare(b.name))
    .slice(0, n);
}
