/**
 * Fermeture exceptionnelle d'un espace : quelles occurrences des dossiers en place elle touche,
 * lesquelles peuvent être annulées d'office. Un dossier dont la fermeture couvre tous les
 * créneaux prévus n'est pas vidé : il reste à annuler ou à reporter depuis sa fiche.
 */
import type { Intervalle } from "@/lib/creneaux";

export type OccurrenceTouchee = Intervalle & { creneauId: number; reservationId: number };

export type DossierTouche = {
  reservationId: number;
  occurrences: OccurrenceTouchee[];
  /** La fermeture couvre tous ses créneaux prévus : aucune annulation d'office. */
  entier: boolean;
};

/**
 * Regroupe les occurrences touchées par dossier, dans l'ordre chronologique.
 * `prevus` donne, pour chaque dossier, son nombre de créneaux prévus (touchés compris).
 */
export function dossiersTouches(
  occurrences: OccurrenceTouchee[],
  prevus: ReadonlyMap<number, number>,
): DossierTouche[] {
  const parDossier = new Map<number, OccurrenceTouchee[]>();
  const vus = new Set<number>();
  for (const o of [...occurrences].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())) {
    if (vus.has(o.creneauId)) continue;
    vus.add(o.creneauId);
    const liste = parDossier.get(o.reservationId) ?? [];
    liste.push(o);
    parDossier.set(o.reservationId, liste);
  }
  return [...parDossier].map(([reservationId, occ]) => ({
    reservationId,
    occurrences: occ,
    entier: occ.length >= (prevus.get(reservationId) ?? occ.length),
  }));
}

/** L'aperçu vu par l'agent est-il toujours exact ? (mêmes créneaux touchés, ni plus ni moins) */
export function apercuInchange(vus: readonly number[], touches: readonly DossierTouche[]): boolean {
  const actuels = new Set(touches.flatMap((t) => t.occurrences.map((o) => o.creneauId)));
  const attendus = new Set(vus);
  return actuels.size === attendus.size && [...actuels].every((id) => attendus.has(id));
}

export type BilanFermeture = {
  dossiers: number;
  annulees: number;
  prevenus: number;
  /** Dossiers entièrement couverts, laissés à annuler ou reporter depuis leur fiche. */
  entiers: number;
  /** Dossiers d'un autre service : non annulés, laissés à sa décision. */
  laisses?: number;
  /** Dossiers dont le circuit demande une étape avant l'annulation : non annulés, en attente. */
  retenus?: number;
};

/** Ce que la fermeture va faire : créneaux à annuler, dossiers annulés en partie, bilan. */
export function planFermeture(
  touches: readonly DossierTouche[],
  opts: {
    annuler: boolean;
    prevenir: boolean;
    /** Les dossiers d'un autre service que celui de l'agent : il n'en annule rien. */
    horsService?: ReadonlySet<number>;
    /** Les dossiers dont le circuit retient l'annulation (visa, relecture en attente). */
    enAttente?: ReadonlySet<number>;
  },
): { creneauxAAnnuler: number[]; dossiersAnnules: Set<number>; bilan: BilanFermeture } {
  const hors = opts.horsService ?? new Set<number>();
  const attente = opts.enAttente ?? new Set<number>();
  const annules = touches.filter(
    (t) => opts.annuler && !t.entier && !hors.has(t.reservationId) && !attente.has(t.reservationId),
  );
  const creneauxAAnnuler = annules.flatMap((t) => t.occurrences.map((o) => o.creneauId));
  return {
    creneauxAAnnuler,
    dossiersAnnules: new Set(annules.map((t) => t.reservationId)),
    bilan: {
      dossiers: touches.length,
      annulees: creneauxAAnnuler.length,
      prevenus: opts.prevenir ? touches.length : 0,
      entiers: touches.filter((t) => t.entier).length,
      laisses: touches.filter((t) => hors.has(t.reservationId)).length,
      retenus: touches.filter((t) => attente.has(t.reservationId)).length,
    },
  };
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Le message rendu à l'agent après la fermeture. */
export function phraseBilan(b: BilanFermeture, espace: string, periode: string): string {
  const details = [
    pluriel(b.dossiers, "dossier concerné", "dossiers concernés"),
    b.annulees ? pluriel(b.annulees, "créneau annulé", "créneaux annulés") : null,
    b.prevenus ? pluriel(b.prevenus, "usager prévenu", "usagers prévenus") : null,
  ].filter(Boolean);
  const retenus = b.retenus
    ? ` ${pluriel(b.retenus, "dossier attend", "dossiers attendent")} une étape de son circuit avant l'annulation : créneaux laissés en place, l'étape est demandée.`
    : "";
  const laisses = b.laisses
    ? ` ${pluriel(b.laisses, "dossier d'un autre service", "dossiers d'un autre service")} : non annulé${b.laisses > 1 ? "s" : ""}, son service est prévenu.`
    : "";
  const aSuivre = b.entiers
    ? ` ${pluriel(b.entiers, "dossier entièrement couvert", "dossiers entièrement couverts")} : à annuler ou reporter depuis sa fiche.`
    : "";
  return `Fermeture posée sur ${espace} (${periode}) : ${details.join(", ")}.${aSuivre}${laisses}${retenus}`;
}
