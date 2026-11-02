import { redirect } from "next/navigation";
import { Blason } from "@/components/blason";
import { Icone } from "@/components/icones";
import { ScriptsPage } from "@/components/scripts";
import { getSettings } from "@/server/config-store";
import { getCurrentUser } from "@/server/guards";
import { urlLogo } from "@/server/logo";
import { contexteAnonyme } from "@/server/page";
import { pending2fa } from "@/server/session-2fa";

export const metadata = { title: "Vérification - CityRésa" };

export default async function TwoFactorPage() {
  if (await getCurrentUser()) redirect("/profil");
  const pending = await pending2fa();
  if (!pending) redirect("/connexion");
  const { nonce, csrf, flashes } = await contexteAnonyme();
  const cfg = await getSettings();
  return (
    <>
      <div className="login-page">
        <div className="login-panel">
          <a href="/" className="login-brand">
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
            <h1>Vérification en deux étapes</h1>
            <p className="text-muted">Saisissez le code de votre application d'authentification.</p>
            {flashes.map(([category, message], i) => (
              <div key={i} className={`alert alert-${category} py-2 small mb-3`}>
                {message}
              </div>
            ))}
            {flashes.length ? <script src="/js/flash-clear.js" nonce={nonce} /> : null}
            <form method="POST" action="/2fa">
              <input type="hidden" name="csrf_token" value={csrf} />
              <div className="mb-3">
                <input
                  type="text"
                  name="code"
                  className="form-control form-control-lg text-center"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  required
                  autoFocus
                  style={{ letterSpacing: ".3em" }}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg w-100">
                <Icone nom="shield-check" taille={16} /> Vérifier
              </button>
            </form>
            <div className="text-center mt-3">
              <a href="/connexion" className="small text-muted">
                Annuler
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
