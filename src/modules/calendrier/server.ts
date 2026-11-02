/**
 * Calendrier des saisons : lecture des formulaires de l'écran Administration › Calendrier.
 *
 *   saison  : label · debut · fin · is_active
 *   periode : kind (vacances|ferie) · label · debut · fin
 *   import  : zone (Zone A|B|C) · fichier (export JSON facultatif)
 */
import {
  labelSaisonValide,
  type PeriodeKind,
  RE_YMD,
  ZONE_PAR_DEFAUT,
  ZONES_VACANCES,
} from "@/lib/calendrier";
import { champ, coche } from "@/lib/forms-util";
import type { PeriodeEntree, SaisonEntree } from "@/server/calendrier";
import { UserFacingError } from "@/server/errors";

function date(form: FormData, name: string, libelle: string): string {
  const v = champ(form, name);
  if (!RE_YMD.test(v)) throw new UserFacingError(`Indiquez ${libelle}.`);
  return v;
}

export function lireSaison(form: FormData): SaisonEntree {
  const label = champ(form, "label").trim().slice(0, 40);
  if (!labelSaisonValide(label))
    throw new UserFacingError(
      "Le nom d'une saison s'écrit « 2026-2027 » (deux années qui se suivent).",
    );
  return {
    label,
    debut: date(form, "debut", "la date de début"),
    fin: date(form, "fin", "la date de fin"),
    isActive: coche(form, "is_active"),
  };
}

export function lirePeriode(form: FormData): PeriodeEntree {
  const kind = champ(form, "kind");
  if (kind !== "vacances" && kind !== "ferie")
    throw new UserFacingError("Type de période inconnu.");
  const label = champ(form, "label").trim().slice(0, 120);
  if (!label) throw new UserFacingError("Indiquez le libellé de la période.");
  const debut = date(form, "debut", "la date de début");
  const fin = champ(form, "fin");
  return { kind: kind as PeriodeKind, label, debut, fin: RE_YMD.test(fin) ? fin : debut };
}

export function lireZone(form: FormData): string {
  const zone = champ(form, "zone") || ZONE_PAR_DEFAUT;
  if (!(ZONES_VACANCES as readonly string[]).includes(zone))
    throw new UserFacingError("Zone de vacances inconnue.");
  return zone;
}

/** Le fichier JSON déposé avec l'import, déjà lu, ou undefined s'il n'y en a pas. */
export async function lireFichierCalendrier(form: FormData): Promise<unknown> {
  const f = form.get("fichier");
  if (!(f instanceof File) || !f.size) return undefined;
  if (f.size > 2_000_000) throw new UserFacingError("Le fichier dépasse 2 Mo.");
  try {
    return JSON.parse(await f.text());
  } catch {
    throw new UserFacingError(
      "Le fichier n'est pas un export JSON du calendrier scolaire (champs description, start_date, end_date attendus).",
    );
  }
}
