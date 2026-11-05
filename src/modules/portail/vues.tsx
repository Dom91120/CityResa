/**
 * Sous-composants du portail : carte d'un espace du catalogue, indicateur d'étapes,
 * calendrier de disponibilité, encart « prochaine étape », carte d'une réservation,
 * fil de discussion, tableau des montants, bloc vide.
 */
import { Icone } from "@/components/icones";
import { Avatar, Chip, Frise, StatutResa } from "@/components/macros";
import { JOURS_ISO } from "@/lib/constantes";
import {
  dateCourte,
  dateHeure,
  dateMoyenne,
  depuis,
  montant,
  NOMS_MOIS,
  nomCourt,
  plage,
  pluriel,
} from "@/lib/libelles";
import type { Devis } from "@/lib/tarification";
import { aPartirDe } from "@/lib/tarification";
import type { EspacePortail, MoisDispo } from "@/modules/portail/catalogue";
import { libelleReserveA, photoPrincipale, profilAutorise } from "@/modules/portail/catalogue";
import { type Etape, prochaineEtape, type ReservationUsager } from "@/modules/portail/suivi";
import type { AppSettings } from "@/server/config-store";

/** Une carte du catalogue. */
export function EspaceCarte({
  espace,
  profil,
  profils,
  afficherTarifs,
}: {
  espace: EspacePortail;
  profil: { id: number; code: string | null } | null;
  profils: { code: string | null; label: string }[];
  afficherTarifs: boolean;
}) {
  const photo = photoPrincipale(espace);
  const autorise = profilAutorise(espace.allowedProfiles, profil?.code ?? null);
  const capacite = espace.capacityStanding ?? espace.capacitySeated;
  return (
    <a href={`/portail/espaces/${espace.slug}`} className="espace-carte">
      <div className="img">
        {photo ? (
          <img src={`/documents/${photo.id}/thumb`} alt={espace.name} loading="lazy" />
        ) : (
          <Icone nom={espace.nature?.icon || "door-open"} taille={40} />
        )}
        {espace.nature ? <Chip>{espace.nature.label}</Chip> : null}
      </div>
      <div className="corps">
        <div className="nom">{nomCourt(espace)}</div>
        <div className="lieu">
          {espace.site.name}
          {espace.site.city ? ` · ${espace.site.city}` : ""}
        </div>
        <div className="caracs">
          {capacite ? (
            <span>
              <Icone nom="users" taille={13} /> {capacite} pers.
            </span>
          ) : null}
          {espace.surface ? (
            <span>
              <Icone nom="maximize-2" taille={13} /> {espace.surface} m²
            </span>
          ) : null}
          {espace.requiresValidation ? null : (
            <span>
              <Icone nom="check" taille={13} /> Réservation immédiate
            </span>
          )}
        </div>
        {afficherTarifs ? (
          <div className="prix">{aPartirDe(espace.tarifs, profil?.id ?? null)}</div>
        ) : null}
        {!autorise ? (
          <div className="small text-muted mt-1">
            <Icone nom="lock" taille={12} /> {libelleReserveA(espace.allowedProfiles, profils)}
          </div>
        ) : null}
      </div>
    </a>
  );
}

/** L'indicateur d'étapes d'un parcours (1 Créneau · 2 Événement · …). */
export function Etapes({ etapes, courante }: { etapes: string[]; courante: number }) {
  return (
    <div className="etapes">
      {etapes.map((e, i) => (
        <div
          key={e}
          className={`etape${i + 1 < courante ? " faite" : i + 1 === courante ? " courante" : ""}`}
        >
          <div className="num">{i + 1}</div>
          <div>{e}</div>
        </div>
      ))}
    </div>
  );
}

/** Le calendrier de disponibilité d'un mois. */
export function CalendrierDispo({
  mois,
  slug,
  baseUrl,
}: {
  mois: MoisDispo;
  slug: string;
  baseUrl: string;
}) {
  const vides = Array.from({ length: mois.premierJourIso - 1 });
  const titre = `${NOMS_MOIS[mois.mois - 1].charAt(0).toUpperCase()}${NOMS_MOIS[mois.mois - 1].slice(1)} ${mois.annee}`;
  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <a
          href={`${baseUrl}?mois=${mois.precedent}#disponibilites`}
          className="btn btn-ghost btn-sm btn-icone"
          aria-label="Mois précédent"
          title="Mois précédent"
        >
          <Icone nom="chevron-left" taille={16} />
        </a>
        <strong>{titre}</strong>
        <a
          href={`${baseUrl}?mois=${mois.suivant}#disponibilites`}
          className="btn btn-ghost btn-sm btn-icone"
          aria-label="Mois suivant"
          title="Mois suivant"
        >
          <Icone nom="chevron-right" taille={16} />
        </a>
      </div>
      <div className="dispo-grille mb-1">
        {JOURS_ISO.map((j) => (
          <div key={j.iso} className="text-center text-muted" style={{ fontSize: ".68rem" }}>
            {j.court}
          </div>
        ))}
      </div>
      <div className="dispo-grille">
        {vides.map((_, i) => (
          <div key={`v${i}`} />
        ))}
        {mois.jours.map((j) => {
          if (j.etat === "libre" || j.etat === "partiel")
            return (
              <a
                key={j.date}
                href={`/portail/reserver/${slug}?date=${j.date}`}
                className={`dispo-jour ${j.etat}`}
                title={j.etat === "libre" ? "Disponible" : "Partiellement réservé"}
              >
                {j.jour}
              </a>
            );
          return (
            <div
              key={j.date}
              className="dispo-jour occupe"
              title={
                j.etat === "occupe"
                  ? "Complet"
                  : j.etat === "ferme"
                    ? "Fermé"
                    : "Hors période de réservation"
              }
              style={j.etat !== "occupe" ? { textDecoration: "none", opacity: 0.6 } : undefined}
            >
              {j.jour}
            </div>
          );
        })}
      </div>
      <div className="d-flex gap-3 mt-2 text-muted flex-wrap" style={{ fontSize: ".72rem" }}>
        <span>
          <span className="dispo-jour libre d-inline-block py-0 px-2 me-1">&nbsp;</span>Disponible
        </span>
        <span>
          <span className="dispo-jour partiel d-inline-block py-0 px-2 me-1">&nbsp;</span>
          Partiellement réservé
        </span>
        <span>
          <span className="dispo-jour occupe d-inline-block py-0 px-2 me-1">&nbsp;</span>Complet ou
          fermé
        </span>
      </div>
    </div>
  );
}

/** L'encart « Prochaine étape ». */
/**
 * Le bloc de signature en deux étapes (code reçu par SMS ou courriel, puis code + nom),
 * pour la convention comme pour un avenant.
 */
export function BlocSignature({
  id,
  titre,
  intro,
  documentId,
  documentLibelle,
  enPreparation,
  codeEnCours,
  canal,
  sentAt,
  expiresAt,
  actionCode,
  actionSigner,
  csrf,
  telephone,
  email,
  nom,
  libelleLu,
  libelleSigner,
}: {
  id: string;
  titre: string;
  intro: string;
  documentId: number | null;
  documentLibelle: string;
  enPreparation: string;
  codeEnCours: boolean;
  canal: string | null;
  sentAt: Date | null;
  expiresAt: Date | null;
  actionCode: string;
  actionSigner: string;
  csrf: string;
  telephone: string;
  email: string;
  nom: string;
  libelleLu: string;
  libelleSigner: string;
}) {
  const champ = (suffixe: string) => `f-${id}-${suffixe}`;
  return (
    <div className="data-card p-4 mb-3" id={id}>
      <h2 className="h5 mb-2">
        <Icone nom="pen-line" taille={18} /> {titre}
      </h2>
      <p className="text-muted">{intro}</p>
      {documentId ? (
        <a
          href={`/documents/${documentId}/view`}
          target="_blank"
          rel="noopener"
          className="btn btn-outline-primary mb-3"
        >
          <Icone nom="file-signature" taille={14} /> {documentLibelle}
        </a>
      ) : (
        <p className="text-muted small">{enPreparation}</p>
      )}
      <div className="row g-3">
        <div className="col-md-6">
          <div className="form-section h-100">
            <div className="form-section-titre">
              <Icone nom="smartphone" taille={14} /> Étape 1 · Recevoir mon code
            </div>
            {codeEnCours ? (
              <div className="alert alert-success small">
                <Icone nom="check" taille={14} /> Un code vous a été envoyé{" "}
                {canal === "sms" ? "par SMS" : "par courriel"}
                {sentAt ? ` le ${dateHeure(sentAt)}` : ""}. Il reste valable jusqu'au{" "}
                {expiresAt ? dateHeure(expiresAt) : ""}.
              </div>
            ) : null}
            <form method="POST" action={actionCode} data-double-envoi>
              <input type="hidden" name="csrf_token" value={csrf} />
              <label className="form-label" htmlFor={champ("telephone")}>
                Téléphone mobile (pour le SMS)
              </label>
              <input
                type="tel"
                name="telephone"
                id={champ("telephone")}
                className="form-control"
                defaultValue={telephone}
                autoComplete="tel"
                placeholder="06 12 34 56 78"
              />
              <div className="form-text mb-2">
                Sans numéro ou si le SMS n'est pas disponible, le code arrive par courriel à {email}
                .
              </div>
              <button
                type="submit"
                className={`btn ${codeEnCours ? "btn-outline-secondary" : "btn-primary"}`}
              >
                <Icone nom="send" taille={14} />{" "}
                {codeEnCours ? "Renvoyer un code" : "Recevoir mon code"}
              </button>
            </form>
          </div>
        </div>
        <div className="col-md-6">
          <div className="form-section h-100">
            <div className="form-section-titre">
              <Icone nom="signature" taille={14} /> Étape 2 · Signer
            </div>
            <form method="POST" action={actionSigner} data-double-envoi>
              <input type="hidden" name="csrf_token" value={csrf} />
              <label className="form-label" htmlFor={champ("code")}>
                Code reçu (6 chiffres)
              </label>
              <input
                type="text"
                name="code"
                id={champ("code")}
                className="form-control form-control-lg"
                inputMode="numeric"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                required
                autoComplete="one-time-code"
                disabled={!codeEnCours}
                placeholder="123456"
              />
              <label className="form-label mt-2" htmlFor={champ("nom")}>
                Votre nom complet
              </label>
              <input
                type="text"
                name="nom"
                id={champ("nom")}
                className="form-control"
                defaultValue={nom}
                required
                minLength={3}
                disabled={!codeEnCours}
              />
              <div className="form-check mt-2 mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="lu"
                  id={champ("lu")}
                  required
                  disabled={!codeEnCours}
                />
                <label className="form-check-label" htmlFor={champ("lu")}>
                  {libelleLu}
                </label>
              </div>
              <button type="submit" className="btn btn-primary" disabled={!codeEnCours}>
                <Icone nom="pen-line" taille={14} /> {libelleSigner}
              </button>
              {!codeEnCours ? (
                <div className="form-text">Demandez d'abord votre code (étape 1).</div>
              ) : null}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EncartEtape({ etape, lien }: { etape: Etape; lien?: string }) {
  return (
    <div className="astuce mb-3">
      <Icone nom={etape.icone} taille={18} />
      <div className="flex-grow-1">
        <strong>Prochaine étape.</strong> {etape.texte}
        {lien && etape.action ? (
          <>
            {" "}
            <a href={lien}>Y aller</a>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Une carte de la liste « Mes réservations ». */
export function CarteReservation({ r, cfg }: { r: ReservationUsager; cfg: AppSettings }) {
  const photo = r.espace.documents[0] ?? null;
  const nb = r.creneaux.filter((c) => c.status === "prevu").length;
  const etape = prochaineEtape(r, cfg);
  return (
    <div className="resa-carte">
      {photo ? (
        <img
          src={`/documents/${photo.id}/thumb`}
          alt={r.espace.name}
          className="vignette"
          loading="lazy"
        />
      ) : (
        <span className="vignette vignette-vide">
          <Icone nom="door-open" taille={28} />
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="titre">{r.title}</span>
          <StatutResa status={r.status} />
        </div>
        <div className="meta">
          <span>
            <Icone nom="door-open" taille={13} /> {nomCourt(r.espace)} · {r.espace.site.name}
          </span>
          <span>
            <Icone nom="calendar-days" taille={13} /> {plage(r.startAt, r.endAt)}
            {nb > 1 ? ` · ${pluriel(nb, "créneau", "créneaux")}` : ""}
          </span>
          <span className={`text-${etape.teinte === "red" ? "danger" : "body"}`}>
            <Icone nom={etape.icone} taille={13} /> {etape.texte}
          </span>
        </div>
        <div className="mt-2" style={{ maxWidth: 360 }}>
          <Frise status={r.status} />
        </div>
      </div>
      <div className="droite">
        <span className="text-muted small">N° {r.numero}</span>
        <a href={`/portail/mes-reservations/${r.id}`} className="btn btn-primary">
          Voir le dossier <Icone nom="arrow-right" taille={14} />
        </a>
      </div>
    </div>
  );
}

export type MessageVisible = {
  id: number;
  authorKind: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
  author: { firstName: string; lastName: string; name: string } | null;
};

/** Le fil de discussion d'un dossier (côté usager). */
export function FilMessages({
  messages,
  action,
  csrf,
  collectivite,
}: {
  messages: MessageVisible[];
  action: string;
  csrf: string;
  collectivite: string;
}) {
  let dernierJour = "";
  return (
    <div className="fil">
      <div className="fil-messages">
        {messages.length ? (
          messages.map((m) => {
            const jour = dateCourte(m.createdAt);
            const sep = jour !== dernierJour;
            dernierJour = jour;
            const nom =
              m.authorKind === "systeme"
                ? "CityRésa"
                : m.authorKind === "agent"
                  ? collectivite
                  : m.author
                    ? `${m.author.firstName} ${m.author.lastName}`.trim() || m.author.name
                    : "Vous";
            return (
              <div key={m.id}>
                {sep ? <div className="fil-date mb-2">{dateMoyenne(m.createdAt)}</div> : null}
                <div className={`msg${m.authorKind === "systeme" ? " msg--systeme" : ""}`}>
                  <Avatar nom={nom} taille="sm" agent={m.authorKind === "agent"} />
                  <div className="msg-corps">
                    <div className="msg-auteur">
                      {nom}
                      <small>{depuis(m.createdAt)}</small>
                    </div>
                    <div className="msg-texte">{m.body}</div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-muted small mb-0 py-3">
            Aucun message pour l'instant. Une question sur votre dossier ? Écrivez ici, la
            collectivité vous répond dans ce fil.
          </p>
        )}
      </div>
      <form method="POST" action={action} className="fil-saisie" data-double-envoi>
        <input type="hidden" name="csrf_token" value={csrf} />
        <label className="visually-hidden" htmlFor="msg-texte">
          Votre message
        </label>
        <textarea
          name="texte"
          id="msg-texte"
          className="form-control"
          placeholder="Écrire un message à la collectivité…"
          required
          maxLength={4000}
        />
        <div className="fil-saisie-actions">
          <span className="text-muted small">Vous recevrez la réponse par courriel.</span>
          <button type="submit" className="btn btn-primary btn-sm">
            <Icone nom="send" taille={14} /> Envoyer
          </button>
        </div>
      </form>
    </div>
  );
}

/** Le tableau des montants d'un dossier. */
export function Montants({ devis, gratuit }: { devis: Devis; gratuit: boolean }) {
  return (
    <table className="montants w-100">
      <tbody>
        {devis.lignes.map((l, i) => (
          <tr key={i}>
            <td>
              {l.libelle}
              {l.quantite > 1 && l.type !== "espace" ? (
                <span className="text-muted"> × {l.quantite}</span>
              ) : null}
            </td>
            <td className="text-end">{montant(l.montant)}</td>
          </tr>
        ))}
        {!devis.lignes.length ? (
          <tr>
            <td className="text-muted" colSpan={2}>
              Aucune redevance.
            </td>
          </tr>
        ) : null}
        {devis.tva ? (
          <tr>
            <td>TVA</td>
            <td className="text-end">{montant(devis.tva)}</td>
          </tr>
        ) : null}
        <tr className="total">
          <td>Total{devis.tva ? " TTC" : ""}</td>
          <td className="text-end">{gratuit ? "Gratuit" : montant(devis.ttc)}</td>
        </tr>
        {devis.acompte && !gratuit ? (
          <tr>
            <td className="text-muted">dont acompte à la signature</td>
            <td className="text-end text-muted">{montant(devis.acompte)}</td>
          </tr>
        ) : null}
        {devis.caution ? (
          <tr>
            <td className="text-muted">Caution (restituée après l'événement)</td>
            <td className="text-end text-muted">{montant(devis.caution)}</td>
          </tr>
        ) : null}
        {gratuit ? (
          <tr>
            <td className="text-muted" colSpan={2}>
              Mise à disposition à titre gracieux.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

/** Un bloc vide chaleureux. */
export function BlocVide({
  icone = "inbox",
  titre,
  texte,
  action,
}: {
  icone?: string;
  titre: string;
  texte?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="vide-bloc">
      <span className="ico">
        <Icone nom={icone} taille={28} />
      </span>
      <h5>{titre}</h5>
      {texte ? <p className="mb-3">{texte}</p> : null}
      {action}
    </div>
  );
}
