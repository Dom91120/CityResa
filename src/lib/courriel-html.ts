/**
 * Le HTML d'un corps de courriel : seules quelques balises de mise en forme sont admises
 * (paragraphe, gras, italique, lien, listes, citation, retour à la ligne). `normaliserCorps`
 * ramène ce que produit l'éditeur (ou un collage) à ces balises, sans attribut hormis `href`.
 * Logique PURE : testée dans courriel-html.test.ts.
 */

export const BALISES_COURRIEL = ["p", "strong", "em", "a", "ul", "ol", "li", "blockquote", "br"];

const RENOMMAGES: Record<string, string> = {
  b: "strong",
  i: "em",
  div: "p",
  h1: "p",
  h2: "p",
  h3: "p",
  h4: "p",
};
/** Balises dont le contenu entier est supprimé. */
const SUPPRIMEES = new Set(["script", "style", "head", "title", "iframe", "object", "embed"]);

function attributHref(attrs: string): string {
  const m = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
  const href = (m?.[2] ?? m?.[3] ?? m?.[4] ?? "").trim();
  if (!href) return "";
  if (!/^(https?:\/\/|mailto:|\{\{\{?\s*\w+\s*\}?\}\})/i.test(href)) return "";
  return ` href="${href.replace(/"/g, "&quot;")}"`;
}

/** Ne garde que les balises admises, sans attribut (sauf `href` sur les liens). */
export function normaliserCorps(html: string): string {
  let s = html.replace(/\r\n?/g, "\n");
  for (const b of SUPPRIMEES)
    s = s.replace(new RegExp(`<${b}\\b[^>]*>[\\s\\S]*?<\\/${b}>`, "gi"), "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(
    /<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi,
    (_, fin: string, nomBrut: string, attrs: string) => {
      const nom = RENOMMAGES[nomBrut.toLowerCase()] ?? nomBrut.toLowerCase();
      if (!BALISES_COURRIEL.includes(nom)) return "";
      if (nom === "br") return "<br>";
      if (fin) return `</${nom}>`;
      return nom === "a" ? `<a${attributHref(attrs)}>` : `<${nom}>`;
    },
  );
  // Les espaces insécables de l'éditeur et les paragraphes vides en trop.
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "");
  s = s.replace(/<p>(\s|<br>)*<\/p>/g, "");
  s = s.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ");
  s = s
    .replace(/<\/(p|ul|ol|li|blockquote)>\s*/g, "</$1>")
    .replace(/\s*<(p|ul|ol|li|blockquote)>/g, "<$1>");
  return s.trim();
}

/** Le corps est-il vide une fois les balises retirées ? */
export function corpsVide(html: string): boolean {
  return !html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, "")
    .trim();
}
