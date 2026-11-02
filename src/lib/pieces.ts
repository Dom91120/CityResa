/**
 * Pièces justificatives : validité (attestation d'assurance datée) et pièces attendues selon
 * le type d'usager. Logique PURE : testée dans pieces.test.ts.
 *
 * Les dates de validité sont des jours « YYYY-MM-DD » (colonne @db.Date lue en UTC).
 */
import { ymdUtc } from "@/lib/date-utc";

export type EtatValidite = "valide" | "bientot" | "expiree";

/** Une pièce telle que la jugent ces règles. */
export type PieceJugee = { kind: string; validUntil: Date | null };

/** Les pièces attendues d'un usager selon son type (facultatives : rien ne bloque, on signale). */
export const PIECES_ATTENDUES: Record<string, { kind: string; libelle: string }[]> = {
  association: [
    { kind: "statuts", libelle: "Statuts de l'association" },
    { kind: "assurance", libelle: "Attestation d'assurance responsabilité civile" },
  ],
  entreprise: [{ kind: "assurance", libelle: "Attestation d'assurance responsabilité civile" }],
  particulier: [{ kind: "assurance", libelle: "Attestation d'assurance responsabilité civile" }],
};

export function piecesAttendues(type: string): { kind: string; libelle: string }[] {
  return PIECES_ATTENDUES[type] ?? [];
}

/** « YYYY-MM-DD » d'une date de validité. */
export function jourValidite(d: Date): string {
  return ymdUtc(d);
}

/** Jours restants (négatif = expirée) entre aujourd'hui et la fin de validité. */
export function joursRestants(validUntil: Date, today: string): number {
  const a = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );
  return Math.round((validUntil.getTime() - a) / 86_400_000);
}

/** L'état d'une pièce datée ; null si elle n'a pas de date de validité. */
export function etatValidite(
  validUntil: Date | null | undefined,
  today: string,
  seuilJours: number,
): EtatValidite | null {
  if (!validUntil) return null;
  const j = joursRestants(validUntil, today);
  if (j < 0) return "expiree";
  if (j <= seuilJours) return "bientot";
  return "valide";
}

/** Le libellé court d'un état : « Expirée le 12/03/2026 », « Expire dans 12 jours »… */
export function libelleValidite(validUntil: Date, today: string, seuilJours: number): string {
  const fr = `${String(validUntil.getUTCDate()).padStart(2, "0")}/${String(validUntil.getUTCMonth() + 1).padStart(2, "0")}/${validUntil.getUTCFullYear()}`;
  const etat = etatValidite(validUntil, today, seuilJours);
  const j = joursRestants(validUntil, today);
  if (etat === "expiree") return `Expirée le ${fr}`;
  if (etat === "bientot")
    return j === 0 ? "Expire aujourd'hui" : `Expire dans ${j} jour${j > 1 ? "s" : ""} (${fr})`;
  return `Valide jusqu'au ${fr}`;
}

export type EtatPieceAttendue = {
  kind: string;
  libelle: string;
  /** manquante : aucune pièce de ce type ; sinon l'état de la plus récente validité. */
  etat: "manquante" | "fournie" | EtatValidite;
  validUntil: Date | null;
};

/**
 * L'état des pièces attendues d'un usager : pour chaque type attendu, la pièce fournie la
 * plus favorable (la validité la plus lointaine ; une pièce sans date vaut « fournie »).
 */
export function etatPiecesAttendues(
  type: string,
  pieces: PieceJugee[],
  today: string,
  seuilJours: number,
): EtatPieceAttendue[] {
  return piecesAttendues(type).map((att) => {
    const fournies = pieces.filter((p) => p.kind === att.kind);
    if (!fournies.length) return { ...att, etat: "manquante", validUntil: null };
    const datees = fournies
      .filter((p): p is PieceJugee & { validUntil: Date } => p.validUntil instanceof Date)
      .sort((a, b) => b.validUntil.getTime() - a.validUntil.getTime());
    if (!datees.length) return { ...att, etat: "fournie", validUntil: null };
    const meilleure = datees[0].validUntil;
    return {
      ...att,
      etat: etatValidite(meilleure, today, seuilJours) ?? "fournie",
      validUntil: meilleure,
    };
  });
}

/** Une organisation a-t-elle au moins une pièce expirée ou sur le point d'expirer ? */
export function pireEtat(
  pieces: PieceJugee[],
  today: string,
  seuilJours: number,
): EtatValidite | null {
  let pire: EtatValidite | null = null;
  for (const p of pieces) {
    const e = etatValidite(p.validUntil, today, seuilJours);
    if (e === "expiree") return "expiree";
    if (e === "bientot") pire = "bientot";
    else if (e === "valide" && !pire) pire = "valide";
  }
  return pire;
}
