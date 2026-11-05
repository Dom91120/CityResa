import { Bloc, PageReglementaire, TexteLibre } from "@/modules/portail/reglementaire";
import { getSettings } from "@/server/config-store";

export const metadata = { title: "Mentions légales - CityRésa" };

export default async function MentionsLegalesPage() {
  const cfg = await getSettings();
  const directeur = [cfg.COLLECTIVITE_SIGNATAIRE, cfg.COLLECTIVITE_SIGNATAIRE_QUALITE]
    .filter(Boolean)
    .join(", ");
  return (
    <PageReglementaire titre="Mentions légales">
      <Bloc titre="Éditeur du service">
        <p>
          <strong>{cfg.COLLECTIVITE_NOM}</strong>
          {cfg.COLLECTIVITE_ADRESSE ? (
            <>
              <br />
              {cfg.COLLECTIVITE_ADRESSE}
            </>
          ) : null}
          {cfg.COLLECTIVITE_TELEPHONE ? (
            <>
              <br />
              {cfg.COLLECTIVITE_TELEPHONE}
            </>
          ) : null}
          {cfg.COLLECTIVITE_EMAIL ? (
            <>
              <br />
              <a href={`mailto:${cfg.COLLECTIVITE_EMAIL}`}>{cfg.COLLECTIVITE_EMAIL}</a>
            </>
          ) : null}
          {cfg.COLLECTIVITE_SITE_WEB ? (
            <>
              <br />
              <a href={cfg.COLLECTIVITE_SITE_WEB} target="_blank" rel="noopener">
                {cfg.COLLECTIVITE_SITE_WEB}
              </a>
            </>
          ) : null}
        </p>
        {directeur ? <p>Directeur de la publication : {directeur}.</p> : null}
      </Bloc>
      {cfg.MENTIONS_LEGALES_TEXTE.trim() ? (
        <Bloc titre="Hébergement et autres mentions">
          <TexteLibre texte={cfg.MENTIONS_LEGALES_TEXTE} />
        </Bloc>
      ) : (
        <Bloc titre="Hébergement">
          <p className="text-muted">
            Mention à compléter par la collectivité dans Paramètres › Portail.
          </p>
        </Bloc>
      )}
      <Bloc titre="Propriété intellectuelle">
        <p>
          Le contenu de ce service (textes, photographies des espaces, documents) est la propriété
          de {cfg.COLLECTIVITE_NOM} ou de ses partenaires ; toute reproduction est soumise à son
          autorisation. Le logiciel CityRésa est un outil de gestion des réservations d'espaces
          municipaux.
        </p>
      </Bloc>
    </PageReglementaire>
  );
}
