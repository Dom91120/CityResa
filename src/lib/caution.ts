/**
 * Cycle de la caution : attendue → encaissée → restituée ou retenue (en tout ou partie), la
 * restitution n'intervenant qu'après l'état des lieux de sortie ; une retenue au-delà d'un seuil
 * attend une seconde validation ; une caution encaissée trop longtemps après l'événement est en
 * alerte. Logique PURE : testée dans caution.test.ts.
 */
import { montant } from "@/lib/libelles";

export type CautionStatus =
  | "aucune"
  | "attendue"
  | "encaissee"
  | "restituee"
  | "retenue"
  | "retenue_a_valider";

export const CAUTION_STATUS: Record<
  CautionStatus,
  { label: string; teinte: string; aide: string }
> = {
  aucune: { label: "Sans caution", teinte: "slate", aide: "Aucune caution demandée." },
  attendue: { label: "Attendue", teinte: "amber", aide: "Demandée, pas encore reçue." },
  encaissee: {
    label: "Encaissée",
    teinte: "sky",
    aide: "Reçue ; restituée ou retenue après l'état des lieux de sortie.",
  },
  restituee: { label: "Restituée", teinte: "emerald", aide: "Rendue en totalité à l'usager." },
  retenue: { label: "Retenue", teinte: "red", aide: "Conservée en tout ou partie." },
  retenue_a_valider: {
    label: "Retenue à valider",
    teinte: "violet",
    aide: "Retenue décidée, en attente de la validation d'un administrateur.",
  },
};

export function lireStatutCaution(v: unknown): CautionStatus {
  return typeof v === "string" && v in CAUTION_STATUS ? (v as CautionStatus) : "aucune";
}

/** Pourquoi la caution ne peut pas être clôturée maintenant (null = possible). */
export function obstacleCloture(
  r: { cautionStatus: string; caution: number },
  edlSortie: boolean,
): string | null {
  if (r.caution <= 0 || r.cautionStatus === "aucune") return "Ce dossier n'a pas de caution.";
  if (r.cautionStatus === "attendue") return "La caution n'a pas été encaissée.";
  if (r.cautionStatus !== "encaissee") return "La caution est déjà clôturée.";
  if (!edlSortie) return "L'état des lieux de sortie n'a pas été fait.";
  return null;
}

/** Une retenue au-delà du seuil attend un second regard (seuil 0 = jamais). */
export function retenueAValider(montantRetenu: number, seuil: number): boolean {
  return seuil > 0 && montantRetenu > seuil;
}

/** Les manquements d'une retenue (vide = acceptable). */
export function verifierRetenue(
  montantRetenu: number,
  caution: number,
  motif: string | null,
  edl: { degats: boolean; observations: string | null; photos: number } | null,
): string[] {
  const erreurs: string[] = [];
  if (!(montantRetenu > 0)) erreurs.push("Indiquez le montant retenu.");
  if (montantRetenu > caution + 0.005)
    erreurs.push(`La retenue ne peut pas dépasser la caution (${montant(caution)}).`);
  if (!motif?.trim()) erreurs.push("Indiquez le motif de la retenue : il est transmis à l'usager.");
  if (!edl) erreurs.push("L'état des lieux de sortie n'a pas été fait.");
  else if (!edl.degats && !edl.observations?.trim() && !edl.photos)
    erreurs.push(
      "L'état des lieux de sortie ne constate rien (ni dégâts, ni observation, ni photo).",
    );
  return erreurs;
}

/** Caution encaissée ni restituée ni retenue plus de `delaiJours` après la fin de l'événement. */
export function cautionEnRetard(
  r: { cautionStatus: string; endAt: Date },
  now: Date,
  delaiJours: number,
): boolean {
  if (r.cautionStatus !== "encaissee") return false;
  return now.getTime() - r.endAt.getTime() > delaiJours * 86_400_000;
}

/** « Caution de 300,00 € retenue à hauteur de 120,00 € » */
export function decrireCaution(r: {
  caution: number;
  cautionStatus: string;
  cautionRetenue: number;
}): string {
  const s = lireStatutCaution(r.cautionStatus);
  if (s === "aucune" || r.caution <= 0) return "Aucune caution";
  const base = `Caution de ${montant(r.caution)}`;
  if (s === "retenue" || s === "retenue_a_valider") {
    const totale = r.cautionRetenue + 0.005 >= r.caution;
    return `${base} ${totale ? "retenue en totalité" : `retenue à hauteur de ${montant(r.cautionRetenue)}`}${s === "retenue_a_valider" ? " (validation en attente)" : ""}`;
  }
  return `${base} ${CAUTION_STATUS[s].label.toLowerCase()}`;
}
