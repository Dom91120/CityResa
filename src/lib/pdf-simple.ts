/**
 * Un PDF d'une page, composé de texte seul (un titre et des lignes), sans navigateur ni
 * bibliothèque : il sert aux pièces d'exemple du jeu de démonstration. Le résultat ne dépend que
 * du texte fourni (ni date ni identifiant), il est donc reproductible. Logique PURE : testée dans
 * pdf-simple.test.ts.
 */

/** Largeur d'une ligne de texte, en caractères, avant retour à la ligne. */
const LARGEUR = 88;

/** Ramène le texte au jeu de caractères WinAnsi du PDF et échappe ce que sa syntaxe réserve. */
function chaine(texte: string): string {
  const latin = texte
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/ | /g, " ")
    .replace(/€/g, "\u0080");
  let out = "";
  for (const c of latin) {
    const code = c.charCodeAt(0);
    if (c === "\\" || c === "(" || c === ")") out += `\\${c}`;
    else out += code <= 0xff ? c : "?";
  }
  return out;
}

/** Coupe un paragraphe en lignes d'au plus `LARGEUR` caractères, sans couper les mots. */
export function lignesPdf(paragraphe: string): string[] {
  const lignes: string[] = [];
  let courante = "";
  for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
    if (courante && courante.length + 1 + mot.length > LARGEUR) {
      lignes.push(courante);
      courante = mot;
    } else courante = courante ? `${courante} ${mot}` : mot;
  }
  lignes.push(courante);
  return lignes;
}

/** Le PDF : un titre en gras, puis les paragraphes ; une ligne vide sépare deux paragraphes. */
export function pdfSimple(titre: string, paragraphes: readonly string[]): Buffer {
  const texte = paragraphes.flatMap((p, i) => [...(i ? [""] : []), ...lignesPdf(p)]);
  const contenu = [
    "BT",
    "/F2 15 Tf",
    "72 770 Td",
    `(${chaine(titre)}) Tj`,
    "ET",
    "BT",
    "/F1 11 Tf",
    "15 TL",
    "72 736 Td",
    ...texte.map((l) => `(${chaine(l)}) Tj T*`),
    "ET",
  ].join("\n");
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(contenu, "latin1")} >>\nstream\n${contenu}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const positions: number[] = [];
  objets.forEach((o, i) => {
    positions.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const table = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (const p of positions) pdf += `${String(p).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${table}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
