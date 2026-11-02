import { redirect } from "next/navigation";
import { Blason } from "@/components/blason";
import { Icone } from "@/components/icones";
import { ScriptsPage } from "@/components/scripts";
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
      <div className="login-page">
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
        <div className="login-visuel">
          <div className="carte-demo">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="stat-ico chip-primary">
                <Icone nom="door-open" taille={16} />
              </span>
              <div>
                <div className="fw-medium" style={{ fontSize: ".85rem" }}>
                  Salle des fêtes
                </div>
                <div className="text-muted" style={{ fontSize: ".72rem" }}>
                  Sam. 14 mars · 18h00 – 23h30
                </div>
              </div>
            </div>
            <div className="frise">
              <div className="frise-etape faite">
                <div className="pt" />
                Demande
              </div>
              <div className="frise-etape faite">
                <div className="pt" />
                Signature
              </div>
              <div className="frise-etape courante">
                <div className="pt" />
                Confirmée
              </div>
              <div className="frise-etape">
                <div className="pt" />
                Terminée
              </div>
            </div>
          </div>
          <div className="accroche">
            <h2>{cfg.PORTAIL_TITRE}</h2>
            <p>{cfg.PORTAIL_ACCROCHE}</p>
          </div>
        </div>
      </div>
      <ScriptsPage nonce={nonce} />
    </>
  );
}
