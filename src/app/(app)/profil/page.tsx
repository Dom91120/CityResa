import QRCode from "qrcode";
import { Section } from "@/components/fiche";
import { Champ, Grille, Interrupteur } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Avatar, Chip } from "@/components/macros";
import { ROLE_LABELS } from "@/lib/constantes";
import { dateCourte, dateHeure, nomCourt } from "@/lib/libelles";
import { espacesGeresPar } from "@/modules/utilisateurs/server";
import { contextePage } from "@/server/page";
import { pendingEnrolement } from "@/server/two-factor";

export const metadata = { title: "Mon profil - CityRésa" };

/** QR code TOTP en <img> data-URI (sans script inline). */
async function qrDataUri(uri: string): Promise<string> {
  const svg = await QRCode.toString(uri, { type: "svg", margin: 1 });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export default async function ProfilPage() {
  const page = await contextePage();
  const { user, csrf } = page;
  const [pending, espaces] = await Promise.all([
    user.hasTwoFactor ? null : pendingEnrolement(user.id, user.email),
    espacesGeresPar(user.id),
  ]);
  const qr = pending ? await qrDataUri(pending.uri) : null;
  const urlIcs = user.icsToken ? `${user.settings.APP_BASE_URL}/ics/usager/${user.icsToken}` : null;
  const min = user.settings.PASSWORD_MIN_LENGTH;
  return (
    <>
      <div className="page-header">
        <div className="d-flex align-items-center gap-3">
          <Avatar nom={user.name} taille="lg" agent />
          <div>
            <h1 className="page-title">{user.name}</h1>
            <p className="page-subtitle">
              {user.email} ·{" "}
              <Chip teinte={user.isAdmin ? "rose" : "sky"}>
                {user.roleObj?.label ?? ROLE_LABELS[user.role] ?? user.role}
              </Chip>
              {user.fonction ? ` · ${user.fonction}` : ""} · compte créé le{" "}
              {dateCourte(user.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="fiche-colonnes">
        <div>
          <Section titre="Identité" icone="circle-user">
            <form method="POST" action="/profil" data-double-envoi>
              <input type="hidden" name="csrf_token" value={csrf} />
              <input type="hidden" name="action" value="identite" />
              <Grille colonnes={2}>
                <Champ label="Prénom" name="first_name" valeur={user.firstName} requis />
                <Champ label="Nom" name="last_name" valeur={user.lastName} requis />
                <Champ label="Téléphone" name="phone" type="tel" valeur={user.phone} />
                <Champ
                  label="Fonction"
                  name="fonction"
                  valeur={user.fonction}
                  placeholder="Responsable des salles…"
                />
              </Grille>
              <p className="small text-muted mt-2 mb-2">
                L'adresse de courriel ({user.email}) est votre identifiant : demandez à un
                administrateur pour la changer.
              </p>
              <button type="submit" className="btn btn-primary btn-sm">
                <Icone nom="check" taille={14} /> Enregistrer
              </button>
            </form>
          </Section>

          <Section titre="Notifications" icone="bell">
            <form method="POST" action="/profil" data-double-envoi>
              <input type="hidden" name="csrf_token" value={csrf} />
              <input type="hidden" name="action" value="notifications" />
              <Interrupteur
                label="Recevoir les notifications par courriel"
                name="notif_email"
                coche={user.notifEmail}
                aide="Nouvelles demandes sur vos espaces, messages, récapitulatif quotidien. La cloche de l'application reste active quoi qu'il arrive."
              />
              <button type="submit" className="btn btn-outline-primary btn-sm mt-2">
                <Icone nom="check" taille={14} /> Enregistrer
              </button>
            </form>
          </Section>

          <Section titre="Mon agenda (lien ICS)" icone="calendar-days">
            <p className="small text-muted">
              Abonnez votre agenda (Outlook, Google Agenda, Apple Calendar) aux réservations
              confirmées. Le lien est personnel : quiconque le connaît peut lire l'agenda.
              Révoquez-le en cas de doute.
            </p>
            {urlIcs ? (
              <>
                <div className="d-flex gap-2 align-items-center flex-wrap mb-2">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    readOnly
                    value={urlIcs}
                    aria-label="Adresse du flux ICS"
                    style={{ maxWidth: 520 }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    data-copier={urlIcs}
                  >
                    <Icone nom="copy" taille={13} /> Copier
                  </button>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <form method="POST" action="/profil">
                    <input type="hidden" name="csrf_token" value={csrf} />
                    <input type="hidden" name="action" value="ics_generer" />
                    <button
                      type="submit"
                      className="btn btn-ghost btn-sm"
                      data-confirm="Générer un nouveau lien ? L'ancien cessera de fonctionner."
                    >
                      <Icone nom="refresh-cw" taille={13} /> Régénérer
                    </button>
                  </form>
                  <form method="POST" action="/profil">
                    <input type="hidden" name="csrf_token" value={csrf} />
                    <input type="hidden" name="action" value="ics_revoquer" />
                    <button
                      type="submit"
                      className="btn btn-ghost btn-ghost-danger btn-sm"
                      data-confirm="Révoquer le lien ICS ? Les agendas abonnés ne se mettront plus à jour."
                    >
                      <Icone nom="ban" taille={13} /> Révoquer
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <form method="POST" action="/profil">
                <input type="hidden" name="csrf_token" value={csrf} />
                <input type="hidden" name="action" value="ics_generer" />
                <button type="submit" className="btn btn-outline-primary btn-sm">
                  <Icone nom="link" taille={13} /> Générer mon lien ICS
                </button>
              </form>
            )}
          </Section>

          {espaces.length ? (
            <Section
              titre="Mes espaces en charge"
              icone="door-open"
              nb={espaces.length}
              ouverte={false}
            >
              <div className="coches">
                {espaces.map((g) => (
                  <a key={g.espaceId} href={`/espaces/${g.espaceId}`} className="chip chip-violet">
                    {nomCourt(g.espace)} · {g.espace.site.name}
                  </a>
                ))}
              </div>
            </Section>
          ) : null}
        </div>

        <div id="securite">
          <Section titre="Mot de passe" icone="lock">
            <form method="POST" action="/profil" data-double-envoi>
              <input type="hidden" name="csrf_token" value={csrf} />
              <input type="hidden" name="action" value="mot_de_passe" />
              <div className="mb-3">
                <label className="form-label" htmlFor="f-old">
                  Mot de passe actuel
                </label>
                <input
                  type="password"
                  name="old_password"
                  id="f-old"
                  className="form-control"
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="f-new">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  name="new_password"
                  id="f-new"
                  className="form-control"
                  required
                  minLength={min}
                  autoComplete="new-password"
                />
                <div className="form-text">
                  Au moins {min} caractères, avec des lettres et des chiffres.
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="f-confirm">
                  Confirmation
                </label>
                <input
                  type="password"
                  name="confirm_password"
                  id="f-confirm"
                  className="form-control"
                  required
                  minLength={min}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm">
                <Icone nom="key-round" taille={14} /> Changer le mot de passe
              </button>
            </form>
          </Section>

          <Section titre="Double authentification" icone="shield-check">
            {pending && qr ? (
              <>
                <p className="small text-muted">
                  1. Scannez ce QR code avec votre application (Microsoft Authenticator, Google
                  Authenticator, FreeOTP…).
                  <br />
                  2. Saisissez le code à 6 chiffres affiché pour activer.
                </p>
                <div className="d-flex gap-3 align-items-start flex-wrap mb-3">
                  <img
                    src={qr}
                    alt="QR code d'enrôlement"
                    width={168}
                    height={168}
                    style={{
                      borderRadius: 12,
                      border: "1px solid var(--line)",
                      background: "#fff",
                    }}
                  />
                  <div className="small">
                    <div className="text-muted mb-1">Ou saisissez la clé manuellement :</div>
                    <code style={{ wordBreak: "break-all" }}>{pending.cleManuelle}</code>
                    <div className="mt-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        data-copier={pending.cleManuelle}
                      >
                        <Icone nom="copy" taille={13} /> Copier la clé
                      </button>
                    </div>
                  </div>
                </div>
                <form
                  method="POST"
                  action="/profil"
                  className="d-flex gap-2 align-items-end flex-wrap"
                  data-double-envoi
                >
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <input type="hidden" name="action" value="confirm_2fa" />
                  <div>
                    <label className="form-label" htmlFor="f-code">
                      Code de vérification
                    </label>
                    <input
                      type="text"
                      name="code"
                      id="f-code"
                      className="form-control"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={7}
                      placeholder="000000"
                      required
                      style={{ width: 160, letterSpacing: ".2em" }}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    <Icone nom="shield-check" taille={14} /> Activer
                  </button>
                </form>
                <form method="POST" action="/profil" className="mt-2">
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <input type="hidden" name="action" value="cancel_2fa" />
                  <button type="submit" className="btn btn-link btn-sm text-muted p-0">
                    Annuler l'activation
                  </button>
                </form>
              </>
            ) : user.hasTwoFactor ? (
              <>
                <p className="mb-3 d-flex align-items-center gap-2">
                  <Chip teinte="emerald">
                    <Icone nom="shield-check" taille={12} /> Activée
                  </Chip>
                  <span className="small text-muted">
                    Un code à usage unique vous est demandé à chaque connexion.
                  </span>
                </p>
                <form
                  method="POST"
                  action="/profil"
                  className="d-flex gap-2 align-items-end flex-wrap"
                  data-double-envoi
                >
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <input type="hidden" name="action" value="disable_2fa" />
                  <div>
                    <label className="form-label" htmlFor="f-pwd2fa">
                      Mot de passe pour confirmer
                    </label>
                    <input
                      type="password"
                      name="password"
                      id="f-pwd2fa"
                      className="form-control"
                      required
                      autoComplete="current-password"
                      style={{ width: 240 }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-outline-danger"
                    data-confirm="Désactiver la double authentification ?"
                    {...(user.settings.REQUIRE_2FA_ADMIN && user.isAdmin
                      ? { disabled: true, title: "Obligatoire pour les administrateurs" }
                      : {})}
                  >
                    Désactiver
                  </button>
                </form>
                {user.settings.REQUIRE_2FA_ADMIN && user.isAdmin ? (
                  <p className="small text-muted mt-2 mb-0">
                    La double authentification est obligatoire pour les comptes administrateur.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="small text-muted">
                  Renforcez la sécurité de votre compte : en plus du mot de passe, un code à 6
                  chiffres généré par une application sur votre téléphone sera demandé à chaque
                  connexion.
                </p>
                <form method="POST" action="/profil">
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <input type="hidden" name="action" value="init_2fa" />
                  <button type="submit" className="btn btn-outline-primary">
                    <Icone nom="qr-code" taille={14} /> Activer la double authentification
                  </button>
                </form>
              </>
            )}
            {user.totpLockedUntil && user.totpLockedUntil > new Date() ? (
              <p className="small text-danger mt-2 mb-0">
                Saisie du code bloquée jusqu'au {dateHeure(user.totpLockedUntil)} après trop
                d'échecs.
              </p>
            ) : null}
          </Section>
        </div>
      </div>
    </>
  );
}
