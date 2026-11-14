/**
 * Brouillons de demande du portail : la saisie du formulaire est mise de côté telle quelle
 * (clé → valeur ou liste) pour être reprise plus tard. Logique PURE : brouillons.test.ts.
 */
import { ENTRE_HEURES } from "@/lib/paris-time";

export type DonneesBrouillon = Record<string, string | string[]>;

/** Les champs simples du formulaire de demande conservés dans un brouillon. */
export const CHAMPS_BROUILLON = [
  "date",
  "heure_debut",
  "heure_fin",
  "recurrence",
  "freq",
  "interval",
  "until",
  "except",
  "title",
  "nature_id",
  "participants",
  "description",
  "is_public_event",
] as const;

/** Les champs répétés ou dynamiques : jours cochés, options et matériel (option_<id>, materiel_<id>). */
export function champConserve(nom: string): boolean {
  return (
    (CHAMPS_BROUILLON as readonly string[]).includes(nom) ||
    nom === "weekday" ||
    /^(option|materiel)_\d+$/.test(nom)
  );
}

/** Ce qu'on garde d'un formulaire envoyé : valeurs non vides, bornées, listes pour les champs répétés. */
export function extraireBrouillon(entrees: Iterable<[string, unknown]>): DonneesBrouillon {
  const out: DonneesBrouillon = {};
  for (const [k, v] of entrees) {
    if (!champConserve(k) || typeof v !== "string") continue;
    const val = v.slice(0, 2000);
    if (!val.trim()) continue;
    if (k === "weekday") {
      const liste = Array.isArray(out[k]) ? (out[k] as string[]) : [];
      liste.push(val);
      out[k] = liste;
    } else out[k] = val;
  }
  return out;
}

/** Relit un brouillon stocké (JSON) en données sûres. */
export function lireBrouillon(json: unknown): DonneesBrouillon {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: DonneesBrouillon = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (!champConserve(k)) continue;
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[k] = v as string[];
  }
  return out;
}

/** Le brouillon a-t-il de quoi être repris (au moins une date ou un objet) ? */
export function brouillonUtile(d: DonneesBrouillon): boolean {
  return Boolean(d.date || d.title);
}

/** Résumé d'une carte de brouillon : objet, puis date et heures si elles sont là. */
export function decrireBrouillon(d: DonneesBrouillon): { titre: string; quand: string } {
  const titre = typeof d.title === "string" && d.title ? d.title : "Demande sans objet";
  const date = typeof d.date === "string" ? d.date : "";
  const [y, m, j] = date.split("-");
  const jour = y && m && j ? `${j}/${m}/${y}` : "";
  const heures =
    typeof d.heure_debut === "string" &&
    typeof d.heure_fin === "string" &&
    d.heure_debut &&
    d.heure_fin
      ? `${d.heure_debut.replace(":", "h")}${ENTRE_HEURES}${d.heure_fin.replace(":", "h")}`
      : "";
  return { titre, quand: [jour, heures].filter(Boolean).join(" · ") || "date à préciser" };
}
