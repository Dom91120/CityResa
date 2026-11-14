/** Les éléments communs des pages du guide : sommaire latéral et corps rendu depuis le Markdown. */
import { Icone } from "@/components/icones";
import type { SectionGuide } from "@/lib/guide";
import type { ChapitreGuide } from "@/server/guide";

/** Le sommaire : les chapitres, et sous le chapitre ouvert ses sections. */
export function SommaireGuide({
  chapitres,
  actif = null,
  sections = [],
}: {
  chapitres: ChapitreGuide[];
  actif?: string | null;
  sections?: SectionGuide[];
}) {
  return (
    <nav className="guide-sommaire" aria-label="Sommaire du guide">
      <a href="/guide" className={`guide-lien${actif ? "" : " actif"}`}>
        <Icone nom="book-open" taille={14} /> Présentation
      </a>
      <ol className="list-unstyled mb-0">
        {chapitres.map((c) => (
          <li key={c.slug}>
            <a
              href={`/guide/${c.slug}`}
              className={`guide-lien${c.slug === actif ? " actif" : ""}`}
              aria-current={c.slug === actif ? "page" : undefined}
            >
              <span className="guide-numero">{c.numero}</span>
              {c.titre}
            </a>
            {c.slug === actif && sections.length ? (
              <ul className="list-unstyled guide-sections">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.titre}</a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Le corps d'une page du guide : HTML produit par guideVersHtml (texte du dépôt, échappé). */
export function CorpsGuide({ html }: { html: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML généré par src/lib/guide.ts à partir de docs/guide, texte échappé.
  return <div className="guide-contenu" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Le lien vers le PDF complet du guide. */
export function LienPdfGuide() {
  return (
    <a
      href="/guide.pdf"
      className="btn btn-outline-secondary btn-sm"
      download="CityResa-guide-utilisateur.pdf"
      title="Le guide complet en un seul fichier PDF, à imprimer ou à conserver"
    >
      <Icone nom="file-down" taille={14} /> Guide en PDF
    </a>
  );
}
