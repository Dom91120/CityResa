import { notFound, redirect } from "next/navigation";
import { Blason } from "@/components/blason";
import { Champ, Select } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { DonneesGraphique, ScriptDiffere, ScriptsPage } from "@/components/scripts";
import { VisuelConnexion } from "@/components/visuel-connexion";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import {
  type ChampInscription,
  qualiteRepresentant,
  reglesInscription,
} from "@/lib/dossier-usager";
import { getSettings } from "@/server/config-store";
import { getCurrentUser } from "@/server/guards";
import { urlLogo } from "@/server/logo";
import { contexteAnonyme } from "@/server/page";

export const metadata = { title: "Créer mon espace - CityRésa" };

const TYPE_INITIAL = "particulier";

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
  const champ = (c: ChampInscription) => ({
    label: initial[c].libelle,
    requis: initial[c].requis,
    aide: initial[c].aide || undefined,
    masque: !initial[c].visible,
  });
  const regles = Object.fromEntries(
    types.map(([t]) => [t, { titre: qualiteRepresentant(t), champs: reglesInscription(t) }]),
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
            <form method="POST" action="/inscription" data-double-envoi>
              <input type="hidden" name="csrf_token" value={csrf} />
              <div className="grille grille-2">
                <Champ label="Prénom" name="first_name" requis autoComplete="given-name" />
                <Champ label="Nom" name="last_name" requis autoComplete="family-name" />
                <Champ label="Courriel" name="email" type="email" requis autoComplete="email" />
                <Champ
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Pour la signature par SMS"
                  {...champ("phone")}
                />
                <Select
                  label="Vous êtes"
                  name="type"
                  options={types}
                  valeur={TYPE_INITIAL}
                  requis
                  attrs={{ "data-type-org": "" }}
                />
                <Champ name="org_name" {...champ("org_name")} />
                <div className="sous-grille sous-grille-adresse">
                  <Champ name="address" autoComplete="street-address" {...champ("address")} />
                  <Champ name="postal_code" autoComplete="postal-code" {...champ("postal_code")} />
                  <Champ name="city" autoComplete="address-level2" {...champ("city")} />
                </div>
                <Champ
                  name="siret"
                  placeholder="14 chiffres"
                  attrs={{ inputMode: "numeric" }}
                  {...champ("siret")}
                />
                <Champ name="rna" placeholder="W123456789" {...champ("rna")} />
                <div
                  className="grille-pleine"
                  style={{ gridColumn: "1 / -1" }}
                  data-titre-representant=""
                  hidden={!initial.legal_first_name.visible}
                >
                  <h2 className="h6 mb-0 mt-1">
                    <Icone nom="user-check" taille={15} />{" "}
                    <span>{qualiteRepresentant(TYPE_INITIAL)}</span>
                  </h2>
                </div>
                <div className="sous-grille sous-grille-representant">
                  <Champ
                    name="legal_first_name"
                    autoComplete="off"
                    {...champ("legal_first_name")}
                  />
                  <Champ name="legal_last_name" autoComplete="off" {...champ("legal_last_name")} />
                  <Champ
                    name="legal_appointed_at"
                    type="date"
                    attrs={{
                      title: "L'assemblée générale qui a élu le président ou la présidente",
                    }}
                    {...champ("legal_appointed_at")}
                  />
                </div>
                <Champ
                  label="Mot de passe"
                  name="password"
                  type="password"
                  requis
                  autoComplete="new-password"
                  placeholder={`${cfg.PASSWORD_MIN_LENGTH} caractères, lettres et chiffres`}
                />
                <Champ
                  label="Confirmer le mot de passe"
                  name="password2"
                  type="password"
                  requis
                  autoComplete="new-password"
                />
              </div>
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" name="cgu" id="cgu" required />
                <label className="form-check-label small" htmlFor="cgu">
                  J'accepte que mes données soient utilisées par {cfg.COLLECTIVITE_NOM} pour le
                  traitement de mes demandes de réservation.
                </label>
              </div>
              <button type="submit" className="btn btn-primary btn-lg w-100">
                Créer mon compte
              </button>
            </form>
            <div className="text-center mt-2 small text-muted">
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
