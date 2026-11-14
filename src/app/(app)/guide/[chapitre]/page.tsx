import { notFound } from "next/navigation";
import { Icone } from "@/components/icones";
import { guideVersHtml, sansTitre, sectionsGuide } from "@/lib/guide";
import { CorpsGuide, LienPdfGuide, SommaireGuide } from "@/modules/guide/vues";
import { ADRESSES_GUIDE, chapitresGuide, lireChapitreGuide } from "@/server/guide";
import { contextePage } from "@/server/page";

export const metadata = { title: "Guide utilisateur - CityRésa" };

/** Un chapitre du guide, avec le sommaire à gauche et les liens vers les chapitres voisins. */
export default async function ChapitreGuidePage({
  params,
}: {
  params: Promise<{ chapitre: string }>;
}) {
  await contextePage();
  const { chapitre: slug } = await params;
  const [chapitres, md] = await Promise.all([chapitresGuide(), lireChapitreGuide(slug)]);
  const rang = chapitres.findIndex((c) => c.slug === slug);
  const chapitre = chapitres[rang];
  if (!chapitre || md === null) notFound();
  const corps = sansTitre(md);
  const precedent = chapitres[rang - 1];
  const suivant = chapitres[rang + 1];
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {chapitre.titre} <span className="page-count">Chapitre {chapitre.numero}</span>
          </h1>
          <p className="page-subtitle">Guide utilisateur de CityRésa</p>
        </div>
        <div className="page-actions">
          <LienPdfGuide />
        </div>
      </div>
      <div className="guide-page">
        <SommaireGuide chapitres={chapitres} actif={slug} sections={sectionsGuide(corps)} />
        <article className="data-card guide-article">
          <CorpsGuide html={guideVersHtml(corps, ADRESSES_GUIDE)} />
          <nav className="guide-voisins" aria-label="Chapitres voisins">
            {precedent ? (
              <a href={`/guide/${precedent.slug}`} className="btn btn-outline-secondary btn-sm">
                <Icone nom="arrow-left" taille={14} /> {precedent.numero}. {precedent.titre}
              </a>
            ) : (
              <a href="/guide" className="btn btn-outline-secondary btn-sm">
                <Icone nom="arrow-left" taille={14} /> Présentation
              </a>
            )}
            {suivant ? (
              <a
                href={`/guide/${suivant.slug}`}
                className="btn btn-outline-secondary btn-sm ms-auto"
              >
                {suivant.numero}. {suivant.titre} <Icone nom="arrow-right" taille={14} />
              </a>
            ) : null}
          </nav>
        </article>
      </div>
    </>
  );
}
