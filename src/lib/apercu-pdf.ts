/**
 * La page d'aperçu d'un PDF (/apercu) affiche, dans l'application, un PDF que celle-ci produit :
 * ces fonctions bornent ce qu'elle accepte d'encadrer et fabriquent le lien qui y mène. Logique
 * PURE : testée dans apercu-pdf.test.ts.
 */
import { cheminInterne } from "@/lib/url";

/**
 * Le PDF à afficher, s'il est bien un PDF de l'application : un chemin interne terminé par
 * « .pdf » ou « /pdf » (une édition : convention, facture, planning…) ou la consultation d'une
 * pièce déposée ; sinon null. Aucune adresse extérieure, aucun autre type de page.
 */
export function sourceApercu(v: string | null | undefined): string | null {
  const chemin = cheminInterne(v);
  if (!chemin || chemin.includes("#")) return null;
  const sansParametres = chemin.split("?")[0];
  if (!/^[A-Za-z0-9/_.-]+$/.test(sansParametres) || sansParametres.includes("..")) return null;
  if (
    /\.pdf$/.test(sansParametres) ||
    /\/pdf$/.test(sansParametres) ||
    /^\/documents\/\d+\/view$/.test(sansParametres)
  )
    return chemin;
  return null;
}

/**
 * Le lien vers l'aperçu d'un PDF, avec son titre et la page où revenir. Depuis une page du
 * portail, l'aperçu est celui du portail (/portail/apercu), sinon celui du back-office (/apercu).
 */
export function lienApercu(src: string, titre: string, retour?: string | null): string {
  const q = new URLSearchParams({ src, titre });
  if (retour) q.set("retour", retour);
  const base = retour?.startsWith("/portail") ? "/portail/apercu" : "/apercu";
  return `${base}?${q.toString()}`;
}

/** Une pièce déposée s'affiche-t-elle dans l'aperçu ? Seuls les PDF : une image s'ouvre telle quelle. */
export function estPdf(d: { filename: string }): boolean {
  return d.filename.toLowerCase().endsWith(".pdf");
}
