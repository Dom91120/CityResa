/**
 * Barème de frais d'annulation : selon le nombre de jours entre l'annulation et le début de la
 * réservation, un pourcentage du montant TTC est facturé. Le barème se saisit en Paramètres
 * sous la forme « 30:20;7:50;2:100 » : à moins de 30 jours du début 20 %, à moins de 7 jours
 * 50 %, à moins de 2 jours 100 % ; au-delà de la plus grande tranche, rien.
 * Logique PURE : testée dans annulation.test.ts.
 */

/** « À moins de `jours` jours du début, `taux` % du montant TTC. » */
export type TrancheAnnulation = { jours: number; taux: number };

/** Lit « 30:20;7:50;2:100 » ; les tranches invalides sont ignorées, le reste est trié par jours croissants. */
export function lireBareme(texte: string | null | undefined): TrancheAnnulation[] {
  if (!texte) return [];
  const out: TrancheAnnulation[] = [];
  for (const part of texte.split(/[;,\n]/)) {
    const m = /^\s*(\d+)\s*:\s*(\d+(?:[.,]\d+)?)\s*%?\s*$/.exec(part);
    if (!m) continue;
    const jours = Number(m[1]);
    const taux = Math.min(100, Math.max(0, Number(m[2].replace(",", "."))));
    if (jours > 0 && !out.some((t) => t.jours === jours)) out.push({ jours, taux });
  }
  return out.sort((a, b) => a.jours - b.jours);
}

/** Le barème écrit, pour le réglage : « 30:20;7:50;2:100 » (de la plus large à la plus courte). */
export function ecrireBareme(b: TrancheAnnulation[]): string {
  return [...b]
    .sort((x, y) => y.jours - x.jours)
    .map((t) => `${t.jours}:${t.taux}`)
    .join(";");
}

/** Jours calendaires entiers entre l'annulation et le début (négatif = réservation commencée). */
export function joursAvant(startAt: Date, now: Date): number {
  return Math.floor((startAt.getTime() - now.getTime()) / 86_400_000);
}

/** Le taux (%) applicable : la tranche la plus courte qui contient encore le délai ; 0 au-delà de toutes. */
export function tauxAnnulation(bareme: TrancheAnnulation[], jours: number): number {
  const j = Math.max(0, jours);
  for (const t of bareme) if (j < t.jours) return t.taux;
  return 0;
}

/** Le montant des frais, arrondi au centime. */
export function fraisAnnulation(montantTtc: number, taux: number): number {
  return Math.round(montantTtc * taux) / 100;
}

export type FraisPrevus = { jours: number; taux: number; montant: number };

/**
 * Les frais qu'entraînerait l'annulation maintenant : rien pour un dossier gratuit, sans montant
 * ou pas encore acquis (accepté, signé ou confirmé).
 */
export function fraisPrevus(
  r: { status: string; startAt: Date; montantTtc: number; gratuit: boolean },
  bareme: TrancheAnnulation[],
  now = new Date(),
): FraisPrevus | null {
  if (!bareme.length || r.gratuit || r.montantTtc <= 0) return null;
  if (!["acceptee", "signee", "confirmee"].includes(r.status)) return null;
  const jours = joursAvant(r.startAt, now);
  const taux = tauxAnnulation(bareme, jours);
  if (taux <= 0) return null;
  return { jours, taux, montant: fraisAnnulation(r.montantTtc, taux) };
}

/** « 20 % à moins de 30 jours du début, 50 % à moins de 7 jours, 100 % à moins de 2 jours. » */
export function decrireBareme(bareme: TrancheAnnulation[]): string {
  if (!bareme.length) return "Aucun frais d'annulation.";
  const parts = [...bareme]
    .sort((a, b) => b.jours - a.jours)
    .map(
      (t, i) =>
        `${t.taux} % à moins de ${t.jours} jour${t.jours > 1 ? "s" : ""}${i === 0 ? " du début" : ""}`,
    );
  return `${parts.join(", ")}.`;
}
