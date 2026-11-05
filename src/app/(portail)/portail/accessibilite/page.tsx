import { ETATS_ACCESSIBILITE, phraseConformite } from "@/lib/accessibilite";
import { Bloc, PageReglementaire, TexteLibre } from "@/modules/portail/reglementaire";
import { getSettings } from "@/server/config-store";

export const metadata = { title: "Déclaration d'accessibilité - CityRésa" };

/** Déclaration d'accessibilité (article 47 de la loi du 11 février 2005, RGAA 4.1). */
export default async function AccessibilitePage() {
  const cfg = await getSettings();
  const etat =
    cfg.ACCESSIBILITE_ETAT in ETATS_ACCESSIBILITE ? cfg.ACCESSIBILITE_ETAT : "non_evalue";
  const taux = cfg.ACCESSIBILITE_TAUX >= 0 ? cfg.ACCESSIBILITE_TAUX : null;
  const contact = cfg.COLLECTIVITE_EMAIL;
  return (
    <PageReglementaire
      titre="Déclaration d'accessibilité"
      sousTitre={`${cfg.COLLECTIVITE_NOM} s'engage à rendre ce service accessible, conformément à l'article 47 de la loi n° 2005-102 du 11 février 2005.`}
    >
      <Bloc titre="État de conformité">
        <p>
          <strong>{phraseConformite(etat, taux)}</strong>
        </p>
        {cfg.ACCESSIBILITE_DATE ? (
          <p>
            Audit réalisé le {cfg.ACCESSIBILITE_DATE}, selon le référentiel général d'amélioration
            de l'accessibilité (RGAA) version 4.1.
          </p>
        ) : null}
        {etat === "non_evalue" ? (
          <p className="text-muted">
            En attendant l'audit, l'application est contrôlée automatiquement sur les points
            vérifiables par un programme : langue et titre des pages, structure des titres, zones de
            contenu, alternatives des images, étiquettes des champs, intitulés des liens et des
            boutons, contrastes.
          </p>
        ) : null}
      </Bloc>
      {cfg.ACCESSIBILITE_TEXTE.trim() ? (
        <Bloc titre="Contenus non accessibles, dérogations et plan d'amélioration">
          <TexteLibre texte={cfg.ACCESSIBILITE_TEXTE} />
        </Bloc>
      ) : null}
      <Bloc titre="Amélioration et contact">
        <p>
          Si vous ne parvenez pas à accéder à un contenu ou à un service, vous pouvez contacter{" "}
          {cfg.COLLECTIVITE_NOM} pour être orienté vers une alternative accessible ou obtenir le
          contenu sous une autre forme
          {contact ? (
            <>
              {" "}
              : <a href={`mailto:${contact}`}>{contact}</a>
            </>
          ) : (
            ""
          )}
          {cfg.COLLECTIVITE_TELEPHONE ? ` · ${cfg.COLLECTIVITE_TELEPHONE}` : ""}
          {cfg.COLLECTIVITE_ADRESSE ? ` · ${cfg.COLLECTIVITE_ADRESSE}` : ""}.
        </p>
      </Bloc>
      <Bloc titre="Voies de recours">
        <p>
          Si vous constatez un défaut d'accessibilité vous empêchant d'accéder à un contenu ou à une
          fonctionnalité, que vous nous le signalez et que vous ne parvenez pas à obtenir une
          réponse satisfaisante, vous pouvez :
        </p>
        <ul>
          <li>
            écrire un message au Défenseur des droits (
            <a href="https://formulaire.defenseurdesdroits.fr/" target="_blank" rel="noopener">
              formulaire.defenseurdesdroits.fr
            </a>
            ) ;
          </li>
          <li>contacter le délégué du Défenseur des droits de votre département ;</li>
          <li>
            envoyer un courrier par la poste (gratuit, ne pas mettre de timbre) : Défenseur des
            droits, Libre réponse 71120, 75342 Paris CEDEX 07.
          </li>
        </ul>
      </Bloc>
    </PageReglementaire>
  );
}
