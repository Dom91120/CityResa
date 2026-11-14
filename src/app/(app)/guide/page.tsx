import { VideBloc } from "@/components/liste";
import { guideVersHtml } from "@/lib/guide";
import { CorpsGuide, LienPdfGuide, SommaireGuide } from "@/modules/guide/vues";
import { ADRESSES_GUIDE, chapitresGuide, introGuide } from "@/server/guide";
import { contextePage } from "@/server/page";

export const metadata = { title: "Guide utilisateur - CityRésa" };

/** La page d'accueil du guide : sa présentation et le sommaire des chapitres. */
export default async function GuidePage() {
  await contextePage();
  const [chapitres, intro] = await Promise.all([chapitresGuide(), introGuide()]);
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Guide utilisateur</h1>
          <p className="page-subtitle">
            L'application expliquée écran par écran, puis le parcours de chaque profil.
          </p>
        </div>
        <div className="page-actions">{chapitres.length ? <LienPdfGuide /> : null}</div>
      </div>
      {chapitres.length ? (
        <div className="guide-page">
          <SommaireGuide chapitres={chapitres} />
          <article className="data-card guide-article">
            {intro ? (
              <CorpsGuide html={guideVersHtml(intro.replace(/^# .+\r?\n?/m, ""), ADRESSES_GUIDE)} />
            ) : null}
            <h2 className="guide-titre-chapitres">Les chapitres</h2>
            <ol className="guide-chapitres list-unstyled mb-0">
              {chapitres.map((c) => (
                <li key={c.slug}>
                  <a href={`/guide/${c.slug}`}>
                    <span className="guide-numero">{c.numero}</span>
                    {c.titre}
                  </a>
                </li>
              ))}
            </ol>
          </article>
        </div>
      ) : (
        <div className="data-card">
          <VideBloc
            icone="book-open"
            titre="Guide indisponible"
            texte="Le guide utilisateur n'est pas installé sur ce serveur."
          />
        </div>
      )}
    </>
  );
}
