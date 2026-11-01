import { Champ } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Avatar, Chip } from "@/components/macros";
import { dateCourte } from "@/lib/libelles";
import { organisationDe } from "@/modules/portail/catalogue";
import { getSettings } from "@/server/config-store";
import { contexteUsager } from "@/server/page";

export const metadata = { title: "Mon compte - CityRésa" };

export default async function MonComptePage() {
  const page = await contexteUsager();
  const { user, csrf } = page;
  const [cfg, org] = await Promise.all([getSettings(), organisationDe(user)]);
  const ics = user.icsToken ? `${cfg.APP_BASE_URL}/ics/usager/${user.icsToken}` : null;
  return (
    <>
      <div className="page-header">
        <div className="d-flex align-items-center gap-3">
          <Avatar nom={user.name} taille="lg" />
          <div>
            <h1 className="page-title">{user.name}</h1>
            <p className="page-subtitle">
              {user.email}
              {org ? (
                <>
                  {" · "}
                  <a href="/portail/mon-organisation">{org.name}</a>
                </>
              ) : null}{" "}
              <Chip teinte="slate">membre depuis le {dateCourte(user.createdAt)}</Chip>
            </p>
          </div>
        </div>
        <div className="page-actions">
          <a href="/deconnexion" className="btn btn-outline-secondary">
            <Icone nom="log-out" taille={14} /> Déconnexion
          </a>
        </div>
      </div>

      <div className="fiche-colonnes">
        <div>
          <form
            method="POST"
            action="/portail/mon-compte"
            className="data-card p-4 mb-3"
            data-double-envoi
          >
            <input type="hidden" name="csrf_token" value={csrf} />
            <h2 className="h5 mb-3">
              <Icone nom="circle-user" taille={16} /> Mon identité
            </h2>
            <div className="grille grille-2">
              <Champ
                label="Prénom"
                name="first_name"
                valeur={user.firstName}
                requis
                autoComplete="given-name"
              />
              <Champ
                label="Nom"
                name="last_name"
                valeur={user.lastName}
                requis
                autoComplete="family-name"
              />
              <Champ
                label="Téléphone mobile"
                name="phone"
                type="tel"
                valeur={user.phone}
                autoComplete="tel"
                aide="Exigé avant toute demande de réservation ; utilisé aussi pour recevoir le code de signature par SMS."
                pleine
              />
            </div>
            <div className="form-check form-switch mb-3">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                name="notif_email"
                id="f-notif_email"
                defaultChecked={user.notifEmail}
              />
              <label className="form-check-label" htmlFor="f-notif_email">
                Recevoir les notifications par courriel (réponses, messages, rappels)
              </label>
              <div className="form-text">
                Les courriels indispensables (code de signature, mot de passe) sont toujours
                envoyés.
              </div>
            </div>
            <div className="d-flex justify-content-end">
              <button type="submit" className="btn btn-primary">
                <Icone nom="check" taille={14} /> Enregistrer
              </button>
            </div>
          </form>

          <form
            method="POST"
            action="/portail/mon-compte/mot-de-passe"
            className="data-card p-4"
            data-double-envoi
          >
            <input type="hidden" name="csrf_token" value={csrf} />
            <h2 className="h5 mb-3">
              <Icone nom="lock" taille={16} /> Changer mon mot de passe
            </h2>
            <div className="grille grille-3">
              <Champ
                label="Mot de passe actuel"
                name="ancien"
                type="password"
                requis
                autoComplete="current-password"
              />
              <Champ
                label="Nouveau mot de passe"
                name="nouveau"
                type="password"
                requis
                autoComplete="new-password"
                aide={`Au moins ${cfg.PASSWORD_MIN_LENGTH} caractères, lettres et chiffres.`}
              />
              <Champ
                label="Confirmation"
                name="confirmation"
                type="password"
                requis
                autoComplete="new-password"
              />
            </div>
            <div className="d-flex justify-content-end">
              <button type="submit" className="btn btn-outline-primary">
                <Icone nom="key-round" taille={14} /> Modifier le mot de passe
              </button>
            </div>
          </form>
        </div>

        <div>
          <div className="data-card p-4">
            <h2 className="h5 mb-2">
              <Icone nom="calendar-plus" taille={16} /> Mes réservations dans mon agenda
            </h2>
            <p className="text-muted small">
              Abonnez votre agenda (Outlook, Google Agenda, Apple Calendrier…) à ce lien : vos
              réservations confirmées y apparaissent et se mettent à jour toutes seules.
            </p>
            {ics ? (
              <>
                <div className="input-group mb-2">
                  <input
                    type="text"
                    className="form-control"
                    value={ics}
                    readOnly
                    aria-label="Lien du calendrier"
                  />
                  <button type="button" className="btn btn-outline-secondary" data-copier={ics}>
                    <Icone nom="copy" taille={14} /> Copier
                  </button>
                </div>
                <p className="text-muted small">
                  Ce lien est personnel : ne le partagez pas. Vous pouvez le révoquer à tout moment.
                </p>
                <form
                  method="POST"
                  action="/portail/mon-compte/ics"
                  className="d-flex gap-2 flex-wrap"
                >
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <button
                    type="submit"
                    name="action"
                    value="generer"
                    className="btn btn-outline-secondary btn-sm"
                  >
                    <Icone nom="refresh-cw" taille={13} /> Nouveau lien
                  </button>
                  <button
                    type="submit"
                    name="action"
                    value="revoquer"
                    className="btn btn-ghost btn-ghost-danger btn-sm"
                    data-confirm="Révoquer le lien ? Les agendas abonnés ne seront plus mis à jour."
                  >
                    <Icone nom="ban" taille={13} /> Révoquer
                  </button>
                </form>
              </>
            ) : (
              <form method="POST" action="/portail/mon-compte/ics">
                <input type="hidden" name="csrf_token" value={csrf} />
                <button type="submit" name="action" value="generer" className="btn btn-primary">
                  <Icone nom="link" taille={14} /> Générer mon lien de calendrier
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
