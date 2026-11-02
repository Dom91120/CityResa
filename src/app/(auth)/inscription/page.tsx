import { notFound, redirect } from "next/navigation";
import { Blason } from "@/components/blason";
import { Champ, Select } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { ScriptsPage } from "@/components/scripts";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import { getSettings } from "@/server/config-store";
import { getCurrentUser } from "@/server/guards";
import { urlLogo } from "@/server/logo";
import { contexteAnonyme } from "@/server/page";

export const metadata = { title: "Créer mon espace - CityRésa" };

export default async function InscriptionPage() {
  const cfg = await getSettings();
  if (!cfg.INSCRIPTION_ENABLED || !cfg.PORTAIL_ENABLED) notFound();
  const user = await getCurrentUser();
  if (user) redirect(user.isAgent ? "/" : "/portail/mes-reservations");
  const { nonce, csrf, flashes } = await contexteAnonyme();
  const types = Object.entries(ORGANISATION_TYPES).filter(
    ([k]) => !["service_interne", "collectivite"].includes(k),
  ) as [string, string][];
  return (
    <>
      <div className="login-page" style={{ gridTemplateColumns: "minmax(360px, 640px) 1fr" }}>
        <div className="login-panel">
          <a href="/portail" className="login-brand">
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
                  label="Téléphone mobile"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  aide="Pour la signature par SMS"
                />
                <Select
                  label="Vous êtes"
                  name="type"
                  options={types}
                  valeur="association"
                  requis
                  attrs={{ "data-type-org": "" }}
                />
                <Champ
                  label="Nom de l'organisation"
                  name="org_name"
                  placeholder="Association, entreprise…"
                  aide="Sans objet pour un particulier"
                />
                <Champ label="Adresse" name="address" pleine autoComplete="street-address" />
                <Champ label="Code postal" name="postal_code" autoComplete="postal-code" />
                <Champ label="Ville" name="city" autoComplete="address-level2" />
                <Champ label="SIRET" name="siret" aide="Entreprises et associations employeuses" />
                <Champ label="N° RNA" name="rna" aide="Associations (W…)" />
                <Champ
                  label="Prénom du président ou dirigeant"
                  name="legal_first_name"
                  aide="Associations et entreprises : exigé avant toute demande"
                  autoComplete="off"
                />
                <Champ
                  label="Nom du président ou dirigeant"
                  name="legal_last_name"
                  autoComplete="off"
                />
                <Champ
                  label="Date de l'AG de nomination"
                  name="legal_appointed_at"
                  type="date"
                  aide="Associations : l'assemblée générale qui a élu le président"
                  pleine
                />
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
              <div className="form-check mb-3">
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
            <div className="text-center mt-4 small text-muted">
              Déjà inscrit ? <a href="/connexion">Se connecter</a>
            </div>
          </div>
        </div>
        <div className="login-visuel">
          <div className="accroche">
            <h2>Un compte, toutes vos demandes</h2>
            <p>
              Déposez vos demandes en ligne, échangez avec les services, signez vos conventions et
              retrouvez vos documents au même endroit.
            </p>
          </div>
        </div>
      </div>
      <ScriptsPage nonce={nonce} />
    </>
  );
}
