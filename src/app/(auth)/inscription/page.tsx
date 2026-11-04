import { notFound, redirect } from "next/navigation";
import { Blason } from "@/components/blason";
import { Champ, Select } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { DonneesGraphique, ScriptDiffere, ScriptsPage } from "@/components/scripts";
import { VisuelConnexion } from "@/components/visuel-connexion";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import {
  type ChampInscription,
  communeDeLAdresse,
  qualiteRepresentant,
  reglesInscription,
} from "@/lib/dossier-usager";
import { getSettings } from "@/server/config-store";
import { getCurrentUser } from "@/server/guards";
import { urlLogo } from "@/server/logo";
import { contexteAnonyme } from "@/server/page";

export const metadata = { title: "Créer mon espace - CityRésa" };

const TYPE_INITIAL = "particulier";

/** Le titre de l'étape 2 par type ; un type absent (particulier) s'inscrit en une étape. */
const TITRES_ETAPE_2: Record<string, string> = {
  association: "Votre association",
  entreprise: "Votre entreprise",
  autre: "Votre organisation",
};

export default async function InscriptionPage() {
  const cfg = await getSettings();
  if (!cfg.INSCRIPTION_ENABLED || !cfg.PORTAIL_ENABLED) notFound();
  const user = await getCurrentUser();
  if (user) redirect(user.isAgent ? "/" : "/portail/mes-reservations");
  const { nonce, csrf, flashes } = await contexteAnonyme();
  const types = Object.entries(ORGANISATION_TYPES).filter(
    ([k]) => !["service_interne", "collectivite"].includes(k),
  ) as [string, string][];
  const initial = reglesInscription(TYPE_INITIAL);
  // Code postal et ville pré-remplis avec la commune de la collectivité (modifiables).
  const commune = communeDeLAdresse(cfg.COLLECTIVITE_ADRESSE);
  const champ = (c: ChampInscription) => ({
    label: initial[c].libelle,
    requis: initial[c].requis,
    aide: initial[c].aide || undefined,
    masque: !initial[c].visible,
  });
  const regles = Object.fromEntries(
    types.map(([t]) => [
      t,
      {
        titre: qualiteRepresentant(t),
        etape2: TITRES_ETAPE_2[t] ?? null,
        champs: reglesInscription(t),
      },
    ]),
  );
  return (
    <>
      <div
        className="login-page login-page--long"
        style={{ gridTemplateColumns: "minmax(360px, 640px) 1fr" }}
      >
        <div className="login-panel">
          <div className="login-entete">
            <a href="/connexion" className="login-brand" title="Retour à la connexion">
              {urlLogo(cfg) ? (
                <Blason logo={urlLogo(cfg)} taille={48} nom={cfg.COLLECTIVITE_NOM} />
              ) : (
                <Icone nom="calendar-check" taille={40} />
              )}
              <span>
                CityRésa
                <small>{cfg.COLLECTIVITE_NOM}</small>
              </span>
            </a>
            <a href="/portail" className="login-lien-portail">
              <Icone nom="door-open" taille={15} /> Espaces
            </a>
          </div>
          <div className="login-form" style={{ maxWidth: 520 }}>
            <h1>Créer mon espace réservation</h1>
            {flashes.map(([category, message], i) => (
              <div key={i} className={`alert alert-${category} py-2 small mb-3`}>
                {message}
              </div>
            ))}
            {flashes.length ? <script src="/js/flash-clear.js" nonce={nonce} /> : null}
            <form
              method="POST"
              action="/inscription"
              data-double-envoi
              data-inscription-etapes=""
              className="inscription-form"
            >
              <input type="hidden" name="csrf_token" value={csrf} />
              <div className="etape-indicateur" data-indicateur="" hidden>
                <span>
                  Étape <span data-numero="">1</span> sur 2 · <span data-titre-etape="">Vous</span>
                </span>
                <button type="button" className="btn btn-link" data-retour="" hidden>
                  <Icone nom="arrow-left" taille={13} /> Retour
                </button>
              </div>

              {/* Étape 1 : la personne et son compte. */}
              <div data-etape="1">
                <div className="grille grille-2">
                  <Select
                    label="Vous êtes"
                    name="type"
                    options={types}
                    valeur={TYPE_INITIAL}
                    requis
                    attrs={{ "data-type-org": "" }}
                  />
                  <div aria-hidden="true" />
                  <Champ label="Prénom" name="first_name" requis autoComplete="given-name" />
                  <Champ label="Nom" name="last_name" requis autoComplete="family-name" />
                  <Champ label="Courriel" name="email" type="email" requis autoComplete="email" />
                  <Champ name="phone" type="tel" autoComplete="tel" {...champ("phone")} />
                  <Champ
                    label="Mot de passe"
                    name="password"
                    type="password"
                    requis
                    autoComplete="new-password"
                    aide={`${cfg.PASSWORD_MIN_LENGTH} caractères minimum, lettres et chiffres`}
                  />
                  <Champ
                    label="Confirmer le mot de passe"
                    name="password2"
                    type="password"
                    requis
                    autoComplete="new-password"
                  />
                </div>
                {/* L'adresse : ici pour un particulier, déplacée à l'étape 2 sinon. */}
                <div data-place-adresse="1">
                  <div className="grille grille-adresse" data-bloc-adresse="">
                    <Champ name="address" autoComplete="street-address" {...champ("address")} />
                    <Champ
                      name="postal_code"
                      autoComplete="postal-code"
                      valeur={commune?.codePostal}
                      {...champ("postal_code")}
                    />
                    <Champ
                      name="city"
                      autoComplete="address-level2"
                      valeur={commune?.ville}
                      {...champ("city")}
                    />
                  </div>
                </div>
              </div>

              {/* Étape 2 : l'organisation (association, entreprise, autre). */}
              <div data-etape="2" hidden>
                <div className="grille grille-2">
                  <Champ name="org_name" pleine {...champ("org_name")} />
                  <Champ name="siret" attrs={{ inputMode: "numeric" }} {...champ("siret")} />
                  <Champ name="rna" placeholder="W…" {...champ("rna")} />
                </div>
                <div data-place-adresse="2" />
                <div className="grille grille-2">
                  <div
                    className="grille-pleine"
                    style={{ gridColumn: "1 / -1" }}
                    data-titre-representant=""
                  >
                    <h3 className="h6 mb-0 mt-1">
                      <Icone nom="user-check" taille={15} />{" "}
                      <span>{qualiteRepresentant(TYPE_INITIAL)}</span>
                    </h3>
                  </div>
                  <Champ
                    name="legal_first_name"
                    autoComplete="off"
                    {...champ("legal_first_name")}
                  />
                  <Champ name="legal_last_name" autoComplete="off" {...champ("legal_last_name")} />
                  <Champ name="legal_appointed_at" type="date" {...champ("legal_appointed_at")} />
                </div>
              </div>

              <div className="inscription-actions">
                <div className="form-check mb-2" data-cgu="">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    name="cgu"
                    id="cgu"
                    required
                  />
                  <label className="form-check-label small" htmlFor="cgu">
                    J'accepte que mes données soient utilisées par {cfg.COLLECTIVITE_NOM} pour le
                    traitement de mes demandes de réservation.
                  </label>
                </div>
                <button type="submit" className="btn btn-primary btn-lg w-100" data-creer="">
                  Créer mon compte
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-lg w-100"
                  data-continuer=""
                  hidden
                >
                  Continuer <Icone nom="arrow-right" taille={16} />
                </button>
              </div>
            </form>
            <div className="text-center mt-3 small text-muted" data-deja-inscrit="">
              Déjà inscrit ? <a href="/connexion">Se connecter</a>
            </div>
          </div>
        </div>
        <VisuelConnexion
          titre="Un compte, toutes vos demandes"
          texte="Déposez vos demandes en ligne, échangez avec les services, signez vos conventions et retrouvez vos documents au même endroit."
        />
      </div>
      <DonneesGraphique id="regles-inscription" config={regles} />
      <ScriptsPage nonce={nonce} extra={<ScriptDiffere src="/js/inscription.js" nonce={nonce} />} />
    </>
  );
}
