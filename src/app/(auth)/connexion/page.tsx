import { redirect } from "next/navigation";
import { Blason } from "@/components/blason";
import { Icone } from "@/components/icones";
import { ScriptsPage } from "@/components/scripts";
import { VisuelConnexion } from "@/components/visuel-connexion";
import { getSettings } from "@/server/config-store";
import { getCurrentUser } from "@/server/guards";
import { urlLogo } from "@/server/logo";
import { contexteAnonyme } from "@/server/page";

export const metadata = { title: "Connexion - CityRésa" };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.isAgent ? "/" : "/portail/mes-reservations");
  const { nonce, csrf, flashes } = await contexteAnonyme();
  const cfg = await getSettings();
  const sp = await searchParams;
  const next = sp.next ?? "";
  return (
    <>
      <a href="#main-content" className="skip-link">
        Aller au contenu
      </a>
      <main id="main-content" className="login-page">
        <div className="login-panel">
          <div className="login-entete">
            <div className="login-brand">
              {urlLogo(cfg) ? (
                <Blason logo={urlLogo(cfg)} taille={48} nom={cfg.COLLECTIVITE_NOM} />
              ) : (
                <Icone nom="calendar-check" taille={40} />
              )}
              <span>
                CityRésa
                <small>{cfg.COLLECTIVITE_NOM}</small>
              </span>
            </div>
            <a href="/portail" className="login-lien-portail">
              <Icone nom="door-open" taille={15} /> Espaces
            </a>
          </div>
          <div className="login-form">
            <h1>Connexion à votre espace réservation</h1>
            {flashes.map(([category, message], i) => (
              <div
                key={i}
                className={`alert alert-${["success", "danger", "warning", "info"].includes(category) ? category : "info"}`}
              >
                {message}
              </div>
            ))}
            {flashes.length ? <script src="/js/flash-clear.js" nonce={nonce} /> : null}
            <form
              method="POST"
              action={next ? `/connexion?next=${encodeURIComponent(next)}` : "/connexion"}
              data-double-envoi
            >
              <input type="hidden" name="csrf_token" value={csrf} />
              <div className="mb-3">
                <label className="form-label" htmlFor="login-email">
                  Adresse de courriel
                </label>
                <input
                  type="email"
                  id="login-email"
                  name="email"
                  className="form-control form-control-lg"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="prenom.nom@exemple.fr"
                />
              </div>
              <div className="mb-4">
                <label className="form-label" htmlFor="login-password">
                  Mot de passe
                </label>
                <input
                  type="password"
                  id="login-password"
                  name="password"
                  className="form-control form-control-lg"
                  required
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg w-100">
                Se connecter
              </button>
            </form>
            <div className="text-center mt-3 small">
              <a href="/mot-de-passe-oublie">Mot de passe oublié ?</a>
            </div>
            {cfg.INSCRIPTION_ENABLED && cfg.PORTAIL_ENABLED ? (
              <div className="text-center mt-4 small text-muted">
                Pas encore de compte ? <a href="/inscription">Créer mon espace</a>
              </div>
            ) : null}
          </div>
          <div className="login-pied">
            CityRésa · réservation des espaces de {cfg.COLLECTIVITE_NOM}
          </div>
        </div>
        <VisuelConnexion titre={cfg.PORTAIL_TITRE} texte={cfg.PORTAIL_ACCROCHE} />
      </main>
      <ScriptsPage nonce={nonce} />
    </>
  );
}
