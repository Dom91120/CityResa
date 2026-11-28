import { ModalAction } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { ScriptDiffere } from "@/components/scripts";
import { contexteAdmin } from "@/modules/admin/server";
import { ONGLETS } from "@/modules/parametres/server";
import {
  VoletApparence,
  VoletCollectivite,
  VoletConvention,
  VoletMessagerie,
  VoletModules,
  VoletPieces,
  VoletPortail,
  VoletReservations,
  VoletRgpd,
  VoletSauvegardes,
  VoletSms,
} from "@/modules/parametres/vues";
import { ChampsInvitation } from "@/modules/usagers/invitations";
import { getSettings, invalidateSettings } from "@/server/config-store";
import { apercuInvitations } from "@/server/invitations";

export const metadata = { title: "Paramètres - CityRésa" };

export default async function ParametresPage() {
  const page = await contexteAdmin();
  invalidateSettings();
  const cfg = await getSettings();
  // Portail fermé : ce que créerait son ouverture, pour la fenêtre de confirmation.
  const apercu = cfg.PORTAIL_ENABLED ? null : await apercuInvitations();
  const volets: Record<string, React.ReactNode> = {
    collectivite: <VoletCollectivite cfg={cfg} />,
    portail: <VoletPortail cfg={cfg} />,
    reservations: <VoletReservations cfg={cfg} />,
    convention: <VoletConvention cfg={cfg} />,
    messagerie: <VoletMessagerie cfg={cfg} emailTest={page.user.email} />,
    sms: <VoletSms cfg={cfg} />,
    modules: <VoletModules cfg={cfg} cles={ONGLETS.find((o) => o.cle === "modules")?.cles ?? []} />,
    pieces: <VoletPieces cfg={cfg} />,
    apparence: <VoletApparence cfg={cfg} />,
    rgpd: <VoletRgpd cfg={cfg} />,
    sauvegardes: <VoletSauvegardes cfg={cfg} />,
  };
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
          <p className="page-subtitle">
            La configuration de CityRésa : chaque onglet s'enregistre séparément.
          </p>
        </div>
      </div>

      <ul className="nav nav-onglets" role="tablist" data-onglets>
        {ONGLETS.map((o, i) => (
          <li key={o.cle} className="nav-item" role="presentation">
            <button
              type="button"
              className={`nav-link${i === 0 ? " active" : ""}`}
              id={`ong-${o.cle}`}
              data-bs-toggle="tab"
              data-bs-target={`#vol-${o.cle}`}
              role="tab"
              aria-controls={`vol-${o.cle}`}
              aria-selected={i === 0 ? "true" : "false"}
            >
              <Icone nom={o.icone} taille={14} /> {o.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="tab-content">
        {ONGLETS.map((o, i) => (
          <div
            key={o.cle}
            className={`tab-pane fade${i === 0 ? " show active" : ""}`}
            id={`vol-${o.cle}`}
            role="tabpanel"
            aria-labelledby={`ong-${o.cle}`}
          >
            <form
              method="POST"
              action="/parametres"
              className="form-seul"
              encType="multipart/form-data"
              data-double-envoi
            >
              <input type="hidden" name="csrf_token" value={page.csrf} />
              <input type="hidden" name="action" value={o.cle} />
              <fieldset className="form-section">
                <legend className="form-section-titre">
                  <Icone nom={o.icone} taille={14} />
                  {o.label}
                </legend>
                {volets[o.cle]}
              </fieldset>
              <div className="form-pied">
                <button type="submit" className="btn btn-primary">
                  <Icone nom="check" taille={14} /> Enregistrer
                </button>
              </div>
            </form>
          </div>
        ))}
      </div>
      {/* Hors des formulaires d'onglet : ouvrir ou fermer le portail a sa propre confirmation. */}
      {apercu ? (
        <ModalAction
          id="modal-portail-ouvrir"
          titre="Ouvrir le portail aux usagers"
          action="/parametres/portail"
          csrf={page.csrf}
          bouton="Ouvrir le portail"
          icone="lock-open"
          danger
          taille="lg"
          aide="Le catalogue des espaces devient public et les usagers qui ont un compte peuvent se connecter. Les organisations créées pendant la fermeture n'ont pas de compte : décidez maintenant si vous les créez."
        >
          <input type="hidden" name="geste" value="ouvrir" />
          <div className="alert alert-danger small">
            <strong>Attention :</strong> créer les comptes envoie aussitôt un courriel à chaque
            organisation. Cet envoi ne se rattrape pas.
          </div>
          {!cfg.PORTAIL_CONDITIONS.trim() ? (
            <div className="alert alert-warning small">
              <strong>Aucune condition d'utilisation n'est saisie.</strong> Les usagers entreront
              sans rien avoir à accepter. Fermez cette fenêtre, saisissez le texte dans cet onglet
              et enregistrez avant d'ouvrir le portail.
            </div>
          ) : null}
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="radio"
              name="comptes"
              value="creer"
              id="po-creer"
              required
            />
            <label className="form-check-label" htmlFor="po-creer">
              <strong>Créer les comptes des usagers et leur envoyer l'invitation</strong>
            </label>
          </div>
          <div className="ms-4 mb-3">
            <ChampsInvitation apercu={apercu} prefixe="po" />
          </div>
          <div className="form-check">
            <input
              className="form-check-input"
              type="radio"
              name="comptes"
              value="aucun"
              id="po-aucun"
              required
            />
            <label className="form-check-label" htmlFor="po-aucun">
              <strong>Ouvrir le portail sans créer de compte</strong>
              <div className="small text-muted">
                Aucun courriel ne part. Vous pourrez inviter les usagers plus tard, depuis Usagers ›
                « Inviter les usagers sans compte ».
              </div>
            </label>
          </div>
        </ModalAction>
      ) : (
        <ModalAction
          id="modal-portail-fermer"
          titre="Fermer le portail aux usagers"
          action="/parametres/portail"
          csrf={page.csrf}
          bouton="Fermer le portail"
          icone="lock"
          danger
          aide="Le catalogue public disparaît et plus aucun usager ne peut se connecter : les usagers connectés sont déconnectés aussitôt. Leurs comptes et leurs dossiers sont conservés."
        >
          <input type="hidden" name="geste" value="fermer" />
          <ul className="small mb-0">
            <li>
              Les <strong>agents et les administrateurs</strong> ne sont pas concernés : ils se
              connectent et travaillent normalement.
            </li>
            <li>
              Les agents saisissent à la place des usagers : réservations, vœux de campagne,
              dossiers de subvention, signature reçue sur papier.
            </li>
            <li>
              Les courriels aux usagers ne renvoient plus vers leur espace en ligne ; la convention
              part en pièce jointe, à retourner signée.
            </li>
            <li>Les pages réglementaires (accessibilité, mentions légales) restent lisibles.</li>
          </ul>
        </ModalAction>
      )}
      <ScriptDiffere src="/js/parametres.js" nonce={page.nonce} />
    </>
  );
}
