/**
 * Accessibilité : d'une part la déclaration d'accessibilité du portail (état de conformité,
 * taux, texte de la collectivité) ; d'autre part l'audit automatisé d'une page à partir d'un
 * instantané de son DOM (règles alignées sur le RGAA 4 : langue, titre, structure, images,
 * formulaires, liens, boutons, cadres, contrastes). Logique PURE : accessibilite.test.ts.
 * L'instantané est produit dans le navigateur par src/lib/accessibilite-extracteur.ts.
 */

// ── Déclaration ──

export const ETATS_ACCESSIBILITE: Record<string, string> = {
  non_evalue: "Non évalué",
  non_conforme: "Non conforme",
  partiellement_conforme: "Partiellement conforme",
  totalement_conforme: "Totalement conforme",
};

/** « Partiellement conforme : 72 % des critères du RGAA 4 sont respectés » (ou l'état seul). */
export function phraseConformite(etat: string, taux: number | null): string {
  const cle = etat in ETATS_ACCESSIBILITE ? etat : "non_evalue";
  const libelle = ETATS_ACCESSIBILITE[cle];
  if (cle === "non_evalue")
    return "Ce service n'a pas encore fait l'objet d'un audit d'accessibilité.";
  const t =
    taux !== null && taux >= 0 && taux <= 100
      ? ` : ${taux} % des critères du RGAA 4.1 sont respectés`
      : "";
  return `${libelle}${t}.`;
}

// ── Audit ──

export type Instantane = {
  url: string;
  lang: string | null;
  titre: string;
  nbMain: number;
  skipLink: boolean;
  titres: { niveau: number; texte: string }[];
  images: { src: string; alt: string | null }[];
  champs: { desc: string; libelle: boolean }[];
  liens: { href: string; nom: string }[];
  boutons: { desc: string; nom: string }[];
  idsDoublons: string[];
  iframes: { src: string; title: string | null }[];
  tabindexPositifs: string[];
  textes: { texte: string; fg: string; bg: string; taille: number; gras: boolean }[];
};

export type Violation = {
  regle: string;
  rgaa: string;
  gravite: "majeur" | "mineur";
  elements: string[];
};

const MAX_ELEMENTS = 8;

/** Les manquements d'une page ; vide = rien à signaler. */
export function auditer(s: Instantane): Violation[] {
  const v: Violation[] = [];
  const ajouter = (
    regle: string,
    rgaa: string,
    gravite: Violation["gravite"],
    elements: string[],
  ) => {
    if (elements.length)
      v.push({ regle, rgaa, gravite, elements: elements.slice(0, MAX_ELEMENTS) });
  };
  if (!s.lang)
    ajouter("La langue de la page n'est pas déclarée (attribut lang).", "8.3", "majeur", [
      "<html>",
    ]);
  if (!s.titre.trim()) ajouter("La page n'a pas de titre.", "8.5", "majeur", ["<title>"]);
  if (s.nbMain !== 1)
    ajouter(
      `La page doit avoir une zone de contenu principal unique (${s.nbMain} trouvée(s)).`,
      "12.6",
      "majeur",
      ["<main>"],
    );
  if (!s.skipLink)
    ajouter("Pas de lien d'évitement vers le contenu principal.", "12.7", "mineur", ["skip-link"]);
  const h1 = s.titres.filter((t) => t.niveau === 1);
  if (!h1.length) ajouter("La page n'a pas de titre de niveau 1.", "9.1", "majeur", ["<h1>"]);
  const sauts: string[] = [];
  let precedent = 0;
  for (const t of s.titres) {
    if (precedent && t.niveau > precedent + 1)
      sauts.push(`h${precedent} → h${t.niveau} « ${t.texte} »`);
    precedent = t.niveau;
  }
  ajouter("La hiérarchie des titres saute un niveau.", "9.1", "mineur", sauts);
  ajouter(
    "Image sans attribut alt.",
    "1.1",
    "majeur",
    s.images.filter((i) => i.alt === null).map((i) => i.src),
  );
  ajouter(
    "Champ de formulaire sans étiquette.",
    "11.1",
    "majeur",
    s.champs.filter((c) => !c.libelle).map((c) => c.desc),
  );
  ajouter(
    "Lien sans intitulé.",
    "6.1",
    "majeur",
    s.liens.filter((l) => !l.nom.trim()).map((l) => l.href),
  );
  ajouter(
    "Bouton sans nom accessible.",
    "11.9",
    "majeur",
    s.boutons.filter((b) => !b.nom.trim()).map((b) => b.desc),
  );
  ajouter(
    "Identifiant utilisé plusieurs fois.",
    "8.2",
    "mineur",
    s.idsDoublons.map((id) => `#${id}`),
  );
  ajouter(
    "Cadre sans titre.",
    "2.1",
    "majeur",
    s.iframes.filter((i) => !i.title?.trim()).map((i) => i.src),
  );
  ajouter("Ordre de tabulation forcé (tabindex positif).", "12.1", "mineur", s.tabindexPositifs);
  ajouter(
    "Contraste de texte insuffisant.",
    "3.2",
    "majeur",
    s.textes
      .map((t) => ({ t, ratio: contraste(t.fg, t.bg) }))
      .filter(({ t, ratio }) => ratio !== null && ratio < seuilContraste(t.taille, t.gras))
      .map(
        ({ t, ratio }) =>
          `« ${t.texte.slice(0, 40)} » ${t.fg} sur ${t.bg} (${(ratio as number).toFixed(2)})`,
      ),
  );
  return v;
}

/** 4,5 pour le texte courant, 3 pour le texte large (24 px, ou 18,66 px en gras). */
export function seuilContraste(taillePx: number, gras: boolean): number {
  return taillePx >= 24 || (gras && taillePx >= 18.66) ? 3 : 4.5;
}

/** « rgb(12, 34, 56) », « rgba(…, a) » ou « #abc » → [r, g, b, a] ; null si illisible. */
export function analyserCouleur(c: string): [number, number, number, number] | null {
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
    c.trim(),
  );
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (h) {
    const hex =
      h[1].length === 3
        ? h[1]
            .split("")
            .map((x) => x + x)
            .join("")
        : h[1];
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
      1,
    ];
  }
  return null;
}

function luminance([r, g, b]: [number, number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Le rapport de contraste WCAG entre deux couleurs opaques ; null si une couleur est illisible ou transparente. */
export function contraste(fg: string, bg: string): number | null {
  const a = analyserCouleur(fg);
  const b = analyserCouleur(bg);
  if (!a || !b || a[3] < 1 || b[3] < 1) return null;
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [clair, sombre] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return Math.round(((clair + 0.05) / (sombre + 0.05)) * 100) / 100;
}

/** Le rapport texte d'un audit : une ligne par page, les manquements en dessous. */
export function rapport(resultats: { url: string; violations: Violation[] }[]): string {
  const lignes: string[] = [];
  let majeurs = 0;
  for (const r of resultats) {
    const n = r.violations.length;
    lignes.push(`${n ? "✗" : "✓"} ${r.url}${n ? ` — ${n} manquement${n > 1 ? "s" : ""}` : ""}`);
    for (const v of r.violations) {
      if (v.gravite === "majeur") majeurs += 1;
      lignes.push(`  [${v.gravite}] RGAA ${v.rgaa} · ${v.regle}`);
      for (const e of v.elements) lignes.push(`      - ${e}`);
    }
  }
  lignes.push("", majeurs ? `${majeurs} manquement(s) majeur(s).` : "Aucun manquement majeur.");
  return lignes.join("\n");
}

export function aDesMajeurs(resultats: { violations: Violation[] }[]): boolean {
  return resultats.some((r) => r.violations.some((v) => v.gravite === "majeur"));
}
