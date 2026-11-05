/**
 * Les volets de la page Paramètres : un composant par onglet, qui rend les champs d'après
 * la configuration vivante. Les noms des champs sont les clés de configuration.
 */

import { Blason } from "@/components/blason";
import { Champ, Grille, Interrupteur, Select, Zone } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { decrireBareme, lireBareme } from "@/lib/annulation";
import { lireReglePieces, REGLES_PIECES } from "@/lib/pieces";
import { colorMix, contraste, normalizeColor } from "@/lib/theming";
import type { AppSettings } from "@/server/config-store";
import { FEATURES, type FeatureName } from "@/server/features";
import { urlLogo } from "@/server/logo";

export function VoletCollectivite({ cfg }: { cfg: AppSettings }) {
  return (
    <Grille colonnes={2}>
      <Champ
        label="Nom de la collectivité"
        name="COLLECTIVITE_NOM"
        valeur={cfg.COLLECTIVITE_NOM}
        requis
      />
      <Champ
        label="Adresse"
        name="COLLECTIVITE_ADRESSE"
        valeur={cfg.COLLECTIVITE_ADRESSE}
        aide="Le code postal qu'elle contient sert à reconnaître les usagers « de la commune »."
      />
      <Champ
        label="Courriel de contact"
        name="COLLECTIVITE_EMAIL"
        type="email"
        valeur={cfg.COLLECTIVITE_EMAIL}
      />
      <Champ
        label="Téléphone"
        name="COLLECTIVITE_TELEPHONE"
        type="tel"
        valeur={cfg.COLLECTIVITE_TELEPHONE}
      />
      <Champ
        label="Site web"
        name="COLLECTIVITE_SITE_WEB"
        type="url"
        valeur={cfg.COLLECTIVITE_SITE_WEB}
      />
      <Champ
        label="Signataire des conventions"
        name="COLLECTIVITE_SIGNATAIRE"
        valeur={cfg.COLLECTIVITE_SIGNATAIRE}
        placeholder="Prénom Nom"
      />
      <Champ
        label="Qualité du signataire"
        name="COLLECTIVITE_SIGNATAIRE_QUALITE"
        valeur={cfg.COLLECTIVITE_SIGNATAIRE_QUALITE}
        placeholder="Le Maire"
      />
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="form-label" htmlFor="f-logo">
          Logo ou blason
        </label>
        <div className="logo-apercu mb-2">
          <Blason logo={urlLogo(cfg)} taille={56} nom={cfg.COLLECTIVITE_NOM} />
          <div className="small text-muted">
            {cfg.COLLECTIVITE_LOGO
              ? "Affiché dans la barre latérale, sur le portail, les pages de connexion et en en-tête des conventions et factures."
              : "Aucun logo : un pictogramme générique est affiché. Déposez une image PNG, JPEG, WebP ou SVG (2 Mo maximum, fond transparent conseillé)."}
          </div>
        </div>
        <input
          type="file"
          name="logo"
          id="f-logo"
          className="form-control"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        />
        {cfg.COLLECTIVITE_LOGO ? (
          <div className="form-check mt-2">
            <input
              className="form-check-input"
              type="checkbox"
              name="logo_supprimer"
              id="f-logo_supprimer"
            />
            <label className="form-check-label" htmlFor="f-logo_supprimer">
              Retirer le logo actuel
            </label>
          </div>
        ) : null}
      </div>
    </Grille>
  );
}

export function VoletPortail({ cfg }: { cfg: AppSettings }) {
  return (
    <>
      <div className="mb-3 d-flex flex-column gap-2">
        <Interrupteur
          label="Portail public actif"
          name="PORTAIL_ENABLED"
          coche={cfg.PORTAIL_ENABLED}
          aide="Le catalogue des espaces et le dépôt de demandes en ligne."
        />
        <Interrupteur
          label="Inscription libre des usagers"
          name="INSCRIPTION_ENABLED"
          coche={cfg.INSCRIPTION_ENABLED}
          aide="Désactivée, seuls les agents créent les comptes usagers."
        />
        <Interrupteur
          label="Validation des nouvelles organisations par un agent"
          name="VALIDATION_COMPTE_USAGER"
          coche={cfg.VALIDATION_COMPTE_USAGER}
          aide="Tant qu'elle n'est pas validée, une organisation n'a pas accès aux tarifs de son profil."
        />
        <Interrupteur
          label="Afficher les tarifs sur le portail"
          name="PORTAIL_AFFICHER_TARIFS"
          coche={cfg.PORTAIL_AFFICHER_TARIFS}
        />
      </div>
      <Grille colonnes={2}>
        <Champ
          label="Titre de la page d'accueil"
          name="PORTAIL_TITRE"
          valeur={cfg.PORTAIL_TITRE}
          pleine
        />
        <Zone label="Accroche" name="PORTAIL_ACCROCHE" valeur={cfg.PORTAIL_ACCROCHE} rows={2} />
        <Zone
          label="Conditions d'utilisation"
          name="PORTAIL_CONDITIONS"
          valeur={cfg.PORTAIL_CONDITIONS}
          rows={6}
          aide="Texte affiché à l'inscription (CGU). Vide : aucune condition particulière."
        />
      </Grille>
    </>
  );
}

export function VoletReservations({ cfg }: { cfg: AppSettings }) {
  return (
    <>
      <Grille colonnes={3}>
        <Champ
          label="Délai d'annulation par l'usager (jours)"
          name="DELAI_ANNULATION_JOURS"
          type="number"
          min={0}
          valeur={cfg.DELAI_ANNULATION_JOURS}
          aide="Au-delà, l'usager ne peut plus annuler seul."
        />
        <Champ
          label="Acompte (% du montant)"
          name="ACOMPTE_PCT"
          type="number"
          min={0}
          max={100}
          step="0.5"
          valeur={cfg.ACOMPTE_PCT}
        />
        <Champ
          label="Taux de TVA (%)"
          name="TVA_TAUX"
          type="number"
          min={0}
          max={100}
          step="0.1"
          valeur={cfg.TVA_TAUX}
          aide="0 pour une mise à disposition hors champ de la TVA."
        />
        <Champ
          label="Archivage automatique (jours)"
          name="ARCHIVAGE_AUTO_JOURS"
          type="number"
          min={1}
          valeur={cfg.ARCHIVAGE_AUTO_JOURS}
          aide="Après ce délai, un dossier terminé, refusé ou annulé est archivé."
        />
        <Champ
          label="Relance de signature après (jours)"
          name="RELANCE_SIGNATURE_JOURS"
          type="number"
          min={1}
          valeur={cfg.RELANCE_SIGNATURE_JOURS}
        />
        <Champ
          label="Validité d'un code de signature (heures)"
          name="SIGNATURE_VALIDITE_HEURES"
          type="number"
          min={1}
          valeur={cfg.SIGNATURE_VALIDITE_HEURES}
        />
        <Champ
          label="Alerte d'expiration des pièces (jours avant)"
          name="ALERTE_PIECES_JOURS"
          type="number"
          min={0}
          valeur={cfg.ALERTE_PIECES_JOURS}
          aide="Une pièce datée (assurance…) qui expire dans ce délai apparaît dans les alertes et l'usager est prévenu par courriel."
        />
        <Select
          label="Pièces attendues manquantes ou expirées"
          name="PIECES_REGLE"
          valeur={lireReglePieces(cfg.PIECES_REGLE)}
          options={REGLES_PIECES.map((o) => [o.value, o.label])}
          aide="Statuts et assurance pour une association, assurance pour une entreprise ou un particulier. Un dossier déjà accepté n'est jamais remis en cause."
          pleine
        />
        <Champ
          label="Barème de frais d'annulation"
          name="ANNULATION_BAREME"
          valeur={cfg.ANNULATION_BAREME}
          placeholder="30:20;7:50;2:100"
          pleine
          aide={`Tranches « à moins de N jours du début : % du montant TTC », séparées par des points-virgules ; au-delà de la plus large, aucun frais. Actuellement : ${decrireBareme(lireBareme(cfg.ANNULATION_BAREME))} Facturés à l'annulation d'un dossier accepté, signé ou confirmé ; un agent peut annuler sans frais.`}
        />
        <Champ
          label="Retenue sur caution : seuil de double validation (€)"
          name="CAUTION_SEUIL_VALIDATION"
          type="number"
          min={0}
          step="0.01"
          valeur={cfg.CAUTION_SEUIL_VALIDATION}
          aide="Au-delà, la retenue décidée par un agent attend la validation d'un administrateur."
        />
        <Champ
          label="Restitution de la caution : délai d'alerte (jours)"
          name="CAUTION_DELAI_RESTITUTION_JOURS"
          type="number"
          min={0}
          valeur={cfg.CAUTION_DELAI_RESTITUTION_JOURS}
          aide="Passé ce délai après la fin de l'événement, une caution encaissée ni restituée ni retenue apparaît dans les alertes."
        />
      </Grille>
      <div className="d-flex flex-column gap-2 mt-2 mb-3">
        <Interrupteur
          label="Rappel aux usagers 7 jours avant"
          name="RAPPEL_J7"
          coche={cfg.RAPPEL_J7}
        />
        <Interrupteur label="Rappel aux usagers la veille" name="RAPPEL_J1" coche={cfg.RAPPEL_J1} />
      </div>
      <Grille colonnes={2}>
        <Champ
          label="Adresses supplémentaires à notifier"
          name="AGENTS_NOTIFIES"
          valeur={cfg.AGENTS_NOTIFIES}
          pleine
          placeholder="salles@ville.fr, sports@ville.fr"
          aide="Séparées par des virgules : reçoivent les nouvelles demandes en plus des gestionnaires des espaces."
        />
      </Grille>
    </>
  );
}

export function VoletConvention({ cfg }: { cfg: AppSettings }) {
  return (
    <>
      <p className="form-section-aide">
        Le corps de la convention de mise à disposition, imprimé entre l'identification des parties
        et le récapitulatif des créneaux et des montants. Un paragraphe par ligne vide.
      </p>
      <Grille colonnes={2}>
        <Zone
          label="Texte de la convention"
          name="CONVENTION_TEXTE"
          valeur={cfg.CONVENTION_TEXTE}
          rows={14}
        />
      </Grille>
      <button type="submit" name="retablir" value="1" className="btn btn-outline-secondary btn-sm">
        <Icone nom="rotate-ccw" taille={14} /> Rétablir le texte par défaut
      </button>
    </>
  );
}

export function VoletMessagerie({ cfg, emailTest }: { cfg: AppSettings; emailTest: string }) {
  const simule = !cfg.MAIL_ENABLED || !cfg.MAIL_SERVER || cfg.MAIL_SERVER === "localhost";
  return (
    <>
      {simule ? (
        <div className="astuce mb-3">
          <Icone nom="info" taille={16} />
          <span>
            Les courriels sont actuellement <strong>simulés</strong> (journalisés, pas envoyés) :
            activez l'envoi et renseignez un serveur SMTP.
          </span>
        </div>
      ) : null}
      <div className="mb-3 d-flex flex-column gap-2">
        <Interrupteur
          label="Envoi des courriels activé"
          name="MAIL_ENABLED"
          coche={cfg.MAIL_ENABLED}
        />
        <Interrupteur
          label="Connexion chiffrée (STARTTLS)"
          name="MAIL_USE_TLS"
          coche={cfg.MAIL_USE_TLS}
          aide="Le port 465 utilise toujours TLS implicite."
        />
      </div>
      <Grille colonnes={3}>
        <Champ
          label="Serveur SMTP"
          name="MAIL_SERVER"
          valeur={cfg.MAIL_SERVER}
          placeholder="smtp.ville.fr"
        />
        <Champ
          label="Port"
          name="MAIL_PORT"
          type="number"
          min={1}
          max={65535}
          valeur={cfg.MAIL_PORT}
        />
        <Champ
          label="Expéditeur"
          name="MAIL_DEFAULT_SENDER"
          valeur={cfg.MAIL_DEFAULT_SENDER}
          placeholder="reservations@ville.fr"
        />
        <Champ
          label="Identifiant"
          name="MAIL_USERNAME"
          valeur={cfg.MAIL_USERNAME}
          autoComplete="off"
        />
        <Champ
          label="Mot de passe"
          name="MAIL_PASSWORD"
          type="password"
          valeur=""
          autoComplete="new-password"
          placeholder={cfg.MAIL_PASSWORD ? "•••••••• (inchangé si vide)" : ""}
          aide="Laissez vide pour conserver le mot de passe enregistré."
        />
      </Grille>
      <div className="d-flex align-items-end gap-2 flex-wrap mt-2">
        <div style={{ minWidth: 260 }}>
          <label className="form-label" htmlFor="f-test_email">
            Envoyer un courriel de test à
          </label>
          <input
            type="email"
            name="test_email"
            id="f-test_email"
            className="form-control"
            defaultValue={emailTest}
          />
        </div>
        <button type="submit" name="tester" value="1" className="btn btn-outline-primary">
          <Icone nom="send" taille={14} /> Enregistrer et envoyer un test
        </button>
      </div>
    </>
  );
}

export function VoletSms({ cfg }: { cfg: AppSettings }) {
  return (
    <>
      <div className="mb-3">
        <Interrupteur
          label="Envoi de SMS activé"
          name="SMS_ENABLED"
          coche={cfg.SMS_ENABLED}
          aide="Codes de signature par SMS. Désactivé, le code part par courriel."
        />
      </div>
      <Grille colonnes={2}>
        <Select
          label="Fournisseur"
          name="SMS_PROVIDER"
          options={[
            ["console", "Console (simulation, affiché dans les journaux)"],
            ["http", "Passerelle HTTP (API)"],
          ]}
          valeur={cfg.SMS_PROVIDER}
        />
        <Champ
          label="Expéditeur affiché"
          name="SMS_SENDER"
          valeur={cfg.SMS_SENDER}
          attrs={{ maxLength: 11 }}
          aide="11 caractères maximum."
        />
        <Champ
          label="URL de l'API"
          name="SMS_API_URL"
          type="url"
          valeur={cfg.SMS_API_URL}
          placeholder="https://api.fournisseur.fr/sms"
        />
        <Champ
          label="Clé d'API"
          name="SMS_API_KEY"
          type="password"
          valeur=""
          autoComplete="new-password"
          placeholder={cfg.SMS_API_KEY ? "•••••••• (inchangée si vide)" : ""}
          aide="Laissez vide pour conserver la clé enregistrée."
        />
      </Grille>
    </>
  );
}

export function VoletModules({ cfg, cles }: { cfg: AppSettings; cles: string[] }) {
  const noms = (Object.keys(FEATURES) as FeatureName[]).filter((n) =>
    cles.includes(FEATURES[n][0]),
  );
  return (
    <>
      <p className="form-section-aide">
        Un module désactivé disparaît des écrans et refuse toute écriture ; les données déjà saisies
        restent en base. Le portail, l'inscription et les pièces jointes se règlent dans leurs
        propres onglets.
      </p>
      <div className="d-flex flex-column gap-3">
        {noms.map((n) => {
          const [key, label, aide] = FEATURES[n];
          return (
            <Interrupteur
              key={key}
              label={label}
              name={key}
              coche={Boolean(cfg[key] ?? true)}
              aide={aide}
            />
          );
        })}
      </div>
    </>
  );
}

export function VoletPieces({ cfg }: { cfg: AppSettings }) {
  return (
    <>
      <div className="mb-3">
        <Interrupteur
          label={FEATURES.documents[1]}
          name="DOCUMENTS_ENABLED"
          coche={cfg.DOCUMENTS_ENABLED}
          aide={FEATURES.documents[2]}
        />
      </div>
      <Grille colonnes={3}>
        <Champ
          label="Taille maximale d'une pièce (Mo)"
          name="DOCUMENT_MAX_MB"
          type="number"
          min={1}
          max={200}
          valeur={cfg.DOCUMENT_MAX_MB}
        />
      </Grille>
    </>
  );
}

export function VoletApparence({ cfg }: { cfg: AppSettings }) {
  const couleur = normalizeColor(cfg.UI_PRIMARY_COLOR) || "#006e46";
  const style = {
    "--apercu": couleur,
    "--apercu-dark": colorMix(couleur, -0.18),
    "--apercu-soft": colorMix(couleur, 0.85),
    "--apercu-texte": contraste(couleur),
  } as React.CSSProperties;
  return (
    <>
      <p className="form-section-aide">
        La couleur d'accent de l'interface, du portail et des courriels. Vide ou réinitialisée : le
        thème Vert.
      </p>
      <div className="d-flex align-items-end gap-3 flex-wrap mb-3">
        <div>
          <label className="form-label" htmlFor="f-UI_PRIMARY_COLOR">
            Couleur principale
          </label>
          <input
            type="color"
            name="UI_PRIMARY_COLOR"
            id="f-UI_PRIMARY_COLOR"
            className="form-control form-control-color"
            defaultValue={couleur}
            data-apercu-couleur="#apercu-couleur"
            style={{ width: 80, height: 42 }}
          />
        </div>
        <code className="pb-2" data-apercu-code>
          {cfg.UI_PRIMARY_COLOR ? couleur : "par défaut"}
        </code>
        <button type="submit" name="reinitialiser" value="1" className="btn btn-outline-secondary">
          <Icone nom="rotate-ccw" taille={14} /> Réinitialiser
        </button>
      </div>
      <div id="apercu-couleur" className="d-flex align-items-center gap-2 flex-wrap" style={style}>
        <span
          className="chip"
          style={{ background: "var(--apercu-soft)", color: "var(--apercu-dark)" }}
        >
          Pastille
        </span>
        <span
          className="chip"
          style={{ background: "var(--apercu)", color: "var(--apercu-texte)" }}
        >
          Pastille pleine
        </span>
        <span
          className="btn btn-sm"
          style={{
            background: "var(--apercu)",
            color: "var(--apercu-texte)",
            borderColor: "var(--apercu)",
          }}
        >
          Bouton principal
        </span>
        <span
          className="btn btn-sm"
          style={{ color: "var(--apercu)", borderColor: "var(--apercu)" }}
        >
          Bouton secondaire
        </span>
        <span
          className="avatar avatar-sm"
          style={{ background: "var(--apercu)", color: "var(--apercu-texte)" }}
        >
          CR
        </span>
      </div>
    </>
  );
}

export function VoletSauvegardes({ cfg }: { cfg: AppSettings }) {
  return (
    <>
      <p className="form-section-aide">
        La sauvegarde quotidienne (1 h) écrit un fichier pg_dump dans{" "}
        <code>{cfg.BACKUP_DB_DIR || "backups/"}</code> (BACKUP_DB_DIR dans l'environnement). Gérez
        les fichiers depuis <a href="/sauvegardes">Sauvegardes</a>.
      </p>
      <Grille colonnes={3}>
        <Champ
          label="Sauvegardes conservées"
          name="BACKUP_DB_KEEP"
          type="number"
          min={1}
          max={365}
          valeur={cfg.BACKUP_DB_KEEP}
          aide="Les plus anciennes sont supprimées au-delà."
        />
      </Grille>
    </>
  );
}
