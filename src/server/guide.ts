/**
 * Le guide utilisateur lu depuis docs/guide (copié dans l'image par le Dockerfile) : la liste des
 * chapitres, leur texte, l'introduction et les captures. Le rendu HTML est dans src/lib/guide.ts.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { titreGuide } from "@/lib/guide";

const DOSSIER = path.join(process.cwd(), "docs", "guide");

export type ChapitreGuide = {
  /** Le nom du fichier sans extension (« 03-planning-et-campagnes »), qui sert d'adresse. */
  slug: string;
  /** Le titre sans son numéro (« Planning et campagnes annuelles »). */
  titre: string;
  numero: number;
};

/** Les chapitres du guide, dans l'ordre ; liste vide si le guide n'est pas installé. */
export async function chapitresGuide(): Promise<ChapitreGuide[]> {
  let fichiers: string[];
  try {
    fichiers = await readdir(DOSSIER);
  } catch {
    return [];
  }
  const chapitres = fichiers.filter((f) => /^\d\d-[\w-]+\.md$/.test(f)).sort();
  return Promise.all(
    chapitres.map(async (f) => {
      const md = await readFile(path.join(DOSSIER, f), "utf8");
      const slug = f.replace(/\.md$/, "");
      return {
        slug,
        numero: Number(f.slice(0, 2)),
        titre: (titreGuide(md) ?? slug).replace(/^\d+\.\s*/, ""),
      };
    }),
  );
}

/** Le Markdown d'un chapitre ; null si l'adresse ne correspond à aucun chapitre. */
export async function lireChapitreGuide(slug: string): Promise<string | null> {
  if (!/^\d\d-[\w-]+$/.test(slug)) return null;
  try {
    return await readFile(path.join(DOSSIER, `${slug}.md`), "utf8");
  } catch {
    return null;
  }
}

/** L'introduction du guide : son README, sans le titre, le sommaire ni la notice de maintenance. */
export async function introGuide(): Promise<string | null> {
  try {
    const md = await readFile(path.join(DOSSIER, "README.md"), "utf8");
    return md
      .replace(/^## Mettre à jour les captures[\s\S]*$/m, "")
      .replace(/^## Sommaire[\s\S]*?(?=^## )/m, "");
  } catch {
    return null;
  }
}

/** Les octets d'une capture du guide ; null si le nom n'est pas celui d'une capture. */
export async function lireCaptureGuide(nom: string): Promise<Buffer | null> {
  if (!/^[\w-]+\.webp$/.test(nom)) return null;
  try {
    return await readFile(path.join(DOSSIER, "captures", nom));
  } catch {
    return null;
  }
}

/** Les réécritures d'adresses du guide affiché dans l'application. */
export const ADRESSES_GUIDE = {
  lien: (href: string) => {
    const m = /^(\d\d-[\w-]+)\.md(#.*)?$/.exec(href);
    if (m) return `/guide/${m[1]}${m[2] ?? ""}`;
    return href === "README.md" ? "/guide" : href;
  },
  image: (src: string) => (src.startsWith("captures/") ? `/guide/${src}` : src),
};
