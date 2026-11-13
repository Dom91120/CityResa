/**
 * Vocabulaire et formats français : dates et heures (toujours en heure de Paris),
 * montants, délais, pluriels. Tout ce qui s'affiche à un humain passe par ici.
 */
import { PARIS_TZ, toParisWall } from "@/lib/paris-time";

export const STATUS_LABELS: Record<string, string> = {
  danger: "Critique",
  warning: "Urgent",
  info: "À prévoir",
  success: "OK",
};

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const JOURS_COURTS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];
const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const MOIS_COURTS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function parts(d: Date) {
  const w = toParisWall(d);
  const dow = (new Date(Date.UTC(w.y, w.mo - 1, w.da)).getUTCDay() + 6) % 7;
  return { ...w, dow, h: Math.floor(w.min / 60), m: w.min % 60 };
}

/** « 08/11/2026 » (heure de Paris). */
export function dateCourte(d: Date | null | undefined): string {
  if (!d) return "";
  const p = parts(d);
  return `${String(p.da).padStart(2, "0")}/${String(p.mo).padStart(2, "0")}/${p.y}`;
}

/** « mardi 8 novembre 2026 ». */
export function dateLongue(d: Date | null | undefined): string {
  if (!d) return "";
  const p = parts(d);
  return `${JOURS[p.dow]} ${p.da} ${MOIS[p.mo - 1]} ${p.y}`;
}

/** « Mar. 08 nov. 2026 » : la forme compacte des listes et cartes. */
export function dateMoyenne(d: Date | null | undefined): string {
  if (!d) return "";
  const p = parts(d);
  return `${JOURS_COURTS[p.dow]} ${String(p.da).padStart(2, "0")} ${MOIS_COURTS[p.mo - 1]} ${p.y}`;
}

/**
 * Dans un texte, « 06 déc. 2026 » devient « 06/12/2026 » : la forme la plus courte, celle du
 * libellé des factures, qui s'affiche dans des colonnes étroites.
 */
export function datesEnChiffres(texte: string): string {
  return texte.replace(/\b(\d{1,2}) (\S+) (\d{4})\b/g, (tout, jour: string, mois: string, an) => {
    const i = MOIS_COURTS.indexOf(mois);
    if (i < 0) return tout;
    return `${jour.padStart(2, "0")}/${String(i + 1).padStart(2, "0")}/${an}`;
  });
}

/** « 8 nov. » */
export function dateJourMois(d: Date | null | undefined): string {
  if (!d) return "";
  const p = parts(d);
  return `${p.da} ${MOIS_COURTS[p.mo - 1]}`;
}

/** « 8h30 », « 19h00 ». */
export function heure(d: Date | null | undefined): string {
  if (!d) return "";
  const p = parts(d);
  return `${p.h}h${String(p.m).padStart(2, "0")}`;
}

/** « 08/11/2026 à 8h30 ». */
export function dateHeure(d: Date | null | undefined): string {
  if (!d) return "";
  return `${dateCourte(d)} à ${heure(d)}`;
}

/** « 8h30 – 19h00 ». */
export function plageHoraire(debut: Date, fin: Date): string {
  return `${heure(debut)} – ${heure(fin)}`;
}

/** « Mar. 08 nov. 2026 · 8h30 – 19h00 », ou sur deux jours « du Sam. 12 nov. 2026 à 9h00 au Dim. 13 nov. 2026 à 18h00 ». */
export function plage(debut: Date, fin: Date): string {
  const a = parts(debut);
  const b = parts(fin);
  if (a.y === b.y && a.mo === b.mo && a.da === b.da)
    return `${dateMoyenne(debut)} · ${plageHoraire(debut, fin)}`;
  return `du ${dateMoyenne(debut)} à ${heure(debut)} au ${dateMoyenne(fin)} à ${heure(fin)}`;
}

/** Nom du mois : « Novembre 2026 ». */
export function moisAnnee(d: Date): string {
  const p = parts(d);
  const m = MOIS[p.mo - 1];
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${p.y}`;
}

export const NOMS_MOIS = MOIS;
export const NOMS_JOURS = JOURS;
export const NOMS_JOURS_COURTS = JOURS_COURTS;

/** « 2 h 30 », « 45 min », « 1 j 4 h ». */
export function duree(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const j = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mi = m % 60;
  const bouts: string[] = [];
  if (j) bouts.push(`${j} j`);
  if (h) bouts.push(`${h} h`);
  if (mi && !j) bouts.push(j || h ? `${String(mi).padStart(2, "0")}` : `${mi} min`);
  if (!bouts.length) return "0 min";
  return bouts.join(" ").replace(/ h (\d\d)$/, " h $1");
}

/** Un montant en français : « 1 191,64 € », « 32 000 € ». Les centimes ne paraissent que s'il y en a. */
export function montant(value: number | string | null | undefined, unite = "€"): string {
  if (value === null || value === undefined || value === "") return "";
  const v = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (Number.isNaN(v)) return String(value);
  const abs = Math.abs(v);
  const entier = Math.abs(abs - Math.round(abs)) < 0.005;
  const fixe = entier ? Math.round(abs).toFixed(0) : abs.toFixed(2);
  const [partieEntiere, decimales] = fixe.split(".");
  const groupes = partieEntiere.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const signe = v < 0 ? "-" : "";
  const texte = decimales !== undefined ? `${signe}${groupes},${decimales}` : `${signe}${groupes}`;
  return unite ? `${texte} ${unite}` : texte;
}

/**
 * Un montant toujours au centime : « 650,00 € », « 85,50 € ». Pour une colonne de montants,
 * où les virgules doivent tomber les unes sous les autres.
 */
export function montantAuCentime(value: number | null | undefined, unite = "€"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const [partieEntiere, decimales] = Math.abs(value).toFixed(2).split(".");
  const groupes = partieEntiere.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const texte = `${value < 0 ? "-" : ""}${groupes},${decimales}`;
  return unite ? `${texte} ${unite}` : texte;
}

/** « Gratuit » quand c'est zéro, sinon le montant. */
export function montantOuGratuit(v: number | null | undefined): string {
  if (!v) return "Gratuit";
  return montant(v);
}

/** « 1 réservation », « 2 réservations ». */
export function pluriel(n: number, singulier: string, plurielMot?: string): string {
  const mot = n > 1 ? (plurielMot ?? `${singulier}s`) : singulier;
  return `${n} ${mot}`;
}

/** Instant « maintenant ». */
export function maintenant(): Date {
  return new Date();
}

/** Nombre de jours calendaires (heure de Paris) entre `depuis` et `d`. */
export function diffJours(d: Date, depuis: Date = new Date()): number {
  const a = toParisWall(d);
  const b = toParisWall(depuis);
  return Math.round((Date.UTC(a.y, a.mo - 1, a.da) - Date.UTC(b.y, b.mo - 1, b.da)) / 86_400_000);
}

/**
 * Un délai en français, relatif, jamais un nombre signé.
 *   -5 → « il y a 5 j », 0 → « aujourd'hui », 1 → « demain », 12 → « dans 12 j ».
 */
export function delai(d: Date | null | undefined, depuis?: Date): string {
  if (!d) return "";
  const j = diffJours(d, depuis);
  if (j < 0) return j === -1 ? "hier" : `il y a ${-j} j`;
  if (j === 0) return "aujourd'hui";
  if (j === 1) return "demain";
  return `dans ${j} j`;
}

/** « il y a 10 min », « il y a 3 h », « hier », « le 08/11/2026 ». */
export function depuis(d: Date, now: Date = new Date()): string {
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  const j = diffJours(d, now);
  if (j === -1) return "hier";
  if (j > -7) return `il y a ${-j} j`;
  return `le ${dateCourte(d)}`;
}

/** La taille dans l'unité où on la lit : « 1,2 Mo » et non 1258291. */
export function tailleLabel(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v < 1024) return `${v} o`;
  if (v < 1024 * 1024) return `${Math.round(v / 1024)} Ko`;
  return `${(v / (1024 * 1024)).toFixed(1)} Mo`.replace(".", ",");
}

/** Initiales d'un nom : « Jean-Marc Hugo » → « JH ». */
export function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return "?";
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
}

/** Formatte un instant pour un attribut datetime ou une valeur de champ (heure de Paris). */
export function isoParis(d: Date): { date: string; time: string } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => f.find((x) => x.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** Le libellé court d'un espace pour le planning et les zones étroites, sinon son nom. */
export function nomCourt(e: { name: string; shortName?: string | null }): string {
  return e.shortName?.trim() || e.name;
}

/** Mots des actions du journal d'audit, enregistrées sans accents, et leur forme accentuée. */
const ACCENTS_AUDIT: Record<string, string> = {
  acceptee: "acceptée",
  annulee: "annulée",
  controle: "contrôle",
  creation: "création",
  creneaux: "créneaux",
  decisions: "décisions",
  deconnexion: "déconnexion",
  depot: "dépôt",
  donnees: "données",
  emission: "émission",
  encaissee: "encaissée",
  etat: "état",
  materiel: "matériel",
  parametres: "paramètres",
  presence: "présence",
  refusee: "refusée",
  requisition: "réquisition",
  reservation: "réservation",
  rgpd: "RGPD",
  voeu: "vœu",
};

/** Libellé lisible d'une action du journal : accents rétablis, majuscule initiale. */
export function libelleAction(action: string): string {
  const texte = action
    .split(" ")
    .map((mot) => ACCENTS_AUDIT[mot] ?? mot)
    .join(" ");
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
