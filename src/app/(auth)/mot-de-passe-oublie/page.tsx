import { Blason } from "@/components/blason";
import { Icone } from "@/components/icones";
import { ScriptsPage } from "@/components/scripts";
import { getSettings } from "@/server/config-store";
import { urlLogo } from "@/server/logo";
import { contexteAnonyme } from "@/server/page";

export const metadata = { title: "Mot de passe oublié - CityRésa" };

export default async function MotDePasseOubliePage() {
  const { nonce, csrf, flashes } = await contexteAnonyme();
  const cfg = await getSettings();
  return (
    <>
      <div className="login-page">
        <div className="login-panel">
          <a href="/connexion" className="login-brand">
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
          <div className="login-form">
            <h1>Mot de passe oublié</h1>
            <p className="text-muted">
              Indiquez votre adresse : si un compte lui correspond, vous recevrez un lien pour
              choisir un nouveau mot de passe.
            </p>
            {flashes.map(([category, message], i) => (
              <div key={i} className={`alert alert-${category} py-2 small mb-3`}>
                {message}
              </div>
            ))}
            {flashes.length ? <script src="/js/flash-clear.js" nonce={nonce} /> : null}
            <form method="POST" action="/mot-de-passe-oublie" data-double-envoi>
              <input type="hidden" name="csrf_token" value={csrf} />
              <div className="mb-3">
                <label className="form-label" htmlFor="email">
                  Adresse de courriel
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-control form-control-lg"
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg w-100">
                Envoyer le lien
              </button>
            </form>
            <div className="text-center mt-3">
              <a href="/connexion" className="small text-muted">
                Retour à la connexion
              </a>
            </div>
          </div>
        </div>
        <div className="login-visuel" />
      </div>
      <ScriptsPage nonce={nonce} />
    </>
  );
}
