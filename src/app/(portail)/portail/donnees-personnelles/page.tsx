import { decrireConservation, reglesDe } from "@/lib/rgpd";
import { Bloc, PageReglementaire, TexteLibre } from "@/modules/portail/reglementaire";
import { getSettings } from "@/server/config-store";

export const metadata = { title: "Données personnelles - CityRésa" };

/** Information des usagers (articles 13 et 14 du RGPD), tirée des réglages de conservation. */
export default async function DonneesPersonnellesPage() {
  const cfg = await getSettings();
  const regles = reglesDe(cfg);
  return (
    <PageReglementaire
      titre="Données personnelles"
      sousTitre="Ce que nous faisons des informations que vous nous confiez, et vos droits."
    >
      <Bloc titre="Responsable du traitement">
        <p>
          {cfg.COLLECTIVITE_NOM}
          {cfg.COLLECTIVITE_ADRESSE ? `, ${cfg.COLLECTIVITE_ADRESSE}` : ""}
          {cfg.COLLECTIVITE_EMAIL ? (
            <>
              {" · "}
              <a href={`mailto:${cfg.COLLECTIVITE_EMAIL}`}>{cfg.COLLECTIVITE_EMAIL}</a>
            </>
          ) : null}
          .
        </p>
      </Bloc>
      <Bloc titre="Finalités">
        <p>
          Les données saisies sur ce service (identité et coordonnées des usagers, organisation,
          demandes de réservation, échanges, pièces justificatives, factures, demandes de
          subvention) servent à instruire les demandes de mise à disposition des espaces municipaux,
          à établir les conventions et les factures, à vous informer du suivi de vos dossiers et à
          produire les statistiques d'occupation. Elles ne sont ni cédées ni transmises à des tiers
          autres que les services de la collectivité et ses prestataires techniques.
        </p>
      </Bloc>
      <Bloc titre="Durées de conservation">
        <p>{decrireConservation(regles)}</p>
        <p>
          Les traces de courriels sont gardées un an et les notifications lues trois mois. Les
          pièces comptables suivent les délais légaux de la comptabilité publique.
        </p>
      </Bloc>
      <Bloc titre="Vos droits">
        <p>
          Vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos
          données. Depuis votre compte, vous pouvez corriger vos coordonnées, télécharger l'ensemble
          de vos données et demander la suppression de votre compte (« Mon compte »). Pour toute
          autre demande, écrivez à{" "}
          {cfg.COLLECTIVITE_EMAIL ? (
            <a href={`mailto:${cfg.COLLECTIVITE_EMAIL}`}>{cfg.COLLECTIVITE_EMAIL}</a>
          ) : (
            cfg.COLLECTIVITE_NOM
          )}
          . Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (
          <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener">
            cnil.fr
          </a>
          ).
        </p>
      </Bloc>
      {cfg.DONNEES_PERSONNELLES_TEXTE.trim() ? (
        <Bloc titre="Informations complémentaires">
          <TexteLibre texte={cfg.DONNEES_PERSONNELLES_TEXTE} />
        </Bloc>
      ) : null}
    </PageReglementaire>
  );
}
