import { Blason } from "@/components/blason";
import { Icone } from "@/components/icones";
import { ScriptsPage } from "@/components/scripts";
import { getSettings } from "@/server/config-store";
import { urlLogo } from "@/server/logo";
import { contexteAnonyme } from "@/server/page";

export const metadata = { title: "Nouveau mot de passe - CityRésa" };

export default async function ReinitialiserPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { nonce, csrf, flashes } = await contexteAnonyme();
  const cfg = await getSettings();
  const sp = await searchParams;
  const token = sp.token ?? "";
  return (
    <>
      <a href="#main-content" className="skip-link">
        Aller au contenu
      </a>
      <main id="main-content" className="login-page">
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
            <h1>Choisir un nouveau mot de passe</h1>
            {flashes.map(([category, message], i) => (
              <div key={i} className={`alert alert-${category} py-2 small mb-3`}>
                {message}
              </div>
            ))}
            {flashes.length ? <script src="/js/flash-clear.js" nonce={nonce} /> : null}
            {!token || sp.error ? (
              <div className="alert alert-danger">
                Ce lien est invalide ou a expiré.{" "}
                <a href="/mot-de-passe-oublie">Demander un nouveau lien</a>.
              </div>
            ) : (
              <form method="POST" action="/reinitialiser" data-double-envoi>
                <input type="hidden" name="csrf_token" value={csrf} />
                <input type="hidden" name="token" value={token} />
                <div className="mb-3">
                  <label className="form-label" htmlFor="password">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className="form-control form-control-lg"
                    required
                    autoFocus
                    autoComplete="new-password"
                    minLength={cfg.PASSWORD_MIN_LENGTH}
                  />
                  <div className="form-text">
                    {cfg.PASSWORD_MIN_LENGTH} caractères minimum, lettres et chiffres.
                  </div>
                </div>
                <div className="mb-4">
                  <label className="form-label" htmlFor="password2">
                    Confirmer
                  </label>
                  <input
                    type="password"
                    id="password2"
                    name="password2"
                    className="form-control form-control-lg"
                    required
                    autoComplete="new-password"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-lg w-100">
                  Enregistrer
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="login-visuel" />
      </main>
      <ScriptsPage nonce={nonce} />
    </>
  );
}
