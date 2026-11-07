/**
 * Sous-composants de la fiche d'une réservation (thème Vert) : carte de décision
 * selon le statut, panneau d'approbation, modales, fil de discussion, sections de la
 * colonne droite (événement, demandeur, montants, documents, convention, factures,
 * historique).
 */

import { Fragment } from "react";
import { FormDocument, ListeDocuments } from "@/components/documents";
import { BoutonOuvrir, Lu, Lus, ModalAction, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import {
  Avatar,
  Chip,
  OuiNon,
  StatutFacture,
  StatutResa,
  TypeOrganisation,
} from "@/components/macros";
import type { Option, Prisma, Referential, ReservationHistory } from "@/generated/prisma/client";
import type { FraisPrevus } from "@/lib/annulation";
import { CAUTION_STATUS, lireStatutCaution } from "@/lib/caution";
import {
  FACTURE_STATUS,
  FACTURE_TYPES,
  RESERVATION_SOURCES,
  RESERVATION_STATUS,
  type ReservationStatus,
  STATUTS_FERMES,
} from "@/lib/constantes";
import { decrireRecurrence, lireRecurrence } from "@/lib/creneaux";
import { nomRepresentant } from "@/lib/dossier-usager";
import {
  dateCourte,
  dateHeure,
  dateLongue,
  dateMoyenne,
  duree,
  heure,
  isoParis,
  montant,
  montantOuGratuit,
  nomCourt,
  plage,
  plageHoraire,
} from "@/lib/libelles";
import { decrireOption, estOption, STATUTS_OPTION } from "@/lib/options";
import { ETATS_COUVERTURE } from "@/lib/personnel";
import { decrirePresence, resumePresences } from "@/lib/presences";
import type { Devis } from "@/lib/tarification";
import { ChoixMateriel, ChoixOptions } from "@/modules/reservations/champs";
import { contactDe } from "@/modules/reservations/requetes";
import type { MaterielDispo } from "@/modules/reservations/saisie";
import { libelleAvenant } from "@/server/avenant";
import { type DocumentAvecCategorie, estImage } from "@/server/documents";
import type { FeatureFlags } from "@/server/features";
import type { ServiceCreneau, ServiceDossier } from "@/server/personnel";
import type { ReservationComplete } from "@/server/reservations";

export type MessageAvecAuteur = Prisma.MessageGetPayload<{ include: { author: true } }>;

type Agent = { id: string; firstName: string; lastName: string; email: string };

/** La cellule « Service » d'un créneau : qui est de service, et le bouton pour épingler. */
function ServiceCreneauCell({
  s,
  aVenir,
  creneauId,
  reservationId,
  csrf,
  peutEpingler,
}: {
  s: ServiceCreneau | undefined;
  aVenir: boolean;
  creneauId: number;
  reservationId: number;
  csrf: string;
  peutEpingler: boolean;
}) {
  const etat = s ? ETATS_COUVERTURE[s.etat] : null;
  return (
    <span className="d-inline-flex align-items-center gap-1 text-nowrap">
      {s?.noms.length ? (
        <span title={s.epingle ? "Personne épinglée sur ce créneau" : "De service par vacation"}>
          {s.epingle ? <Icone nom="bookmark" taille={11} /> : null} {s.noms.join(", ")}
        </span>
      ) : null}
      {s?.propose && aVenir ? (
        <Chip teinte="amber" dot titre="Proposition d'affectation à valider">
          Proposé : {s.propose.nom}
        </Chip>
      ) : etat && aVenir && (s?.etat !== "couvert" || !s.noms.length) ? (
        <Chip teinte={etat.teinte} dot>
          {etat.label}
        </Chip>
      ) : null}
      {!aVenir && !s?.noms.length ? <span className="text-faint">—</span> : null}
      {s?.propose && aVenir && peutEpingler ? (
        <>
          <form
            method="POST"
            action={`/personnel/propositions/${creneauId}/valider`}
            className="d-inline"
            data-sur-place={`creneau-${creneauId}`}
          >
            <input type="hidden" name="csrf_token" value={csrf} />
            <input
              type="hidden"
              name="next"
              value={`/reservations/${reservationId}#creneau-${creneauId}`}
            />
            <button
              type="submit"
              className="btn btn-ghost btn-icone btn-sm"
              title={`Valider : ${s.propose.nom} de service sur ce créneau`}
              aria-label="Valider la proposition"
            >
              <Icone nom="check" taille={14} />
            </button>
          </form>
          <form
            method="POST"
            action={`/personnel/propositions/${creneauId}/ecarter`}
            className="d-inline"
            data-sur-place={`creneau-${creneauId}`}
          >
            <input type="hidden" name="csrf_token" value={csrf} />
            <input
              type="hidden"
              name="next"
              value={`/reservations/${reservationId}#creneau-${creneauId}`}
            />
            <button
              type="submit"
              className="btn btn-ghost btn-icone btn-sm"
              title="Écarter la proposition"
              aria-label="Écarter la proposition"
            >
              <Icone nom="x" taille={14} />
            </button>
          </form>
        </>
      ) : null}
      {peutEpingler && aVenir ? (
        <BoutonOuvrir
          cible={`modal-service-${creneauId}`}
          libelle="Personne de service"
          icone="shield"
          classe="btn-ghost btn-sm"
          sansTexte
        />
      ) : null}
    </span>
  );
}

// ── Boutons ──

/** Un bouton qui POSTe un nouveau statut (avec confirmation). */
function BoutonStatut({
  id,
  statut,
  libelle,
  icone,
  classe,
  csrf,
  confirm,
}: {
  id: number;
  statut: ReservationStatus;
  libelle: string;
  icone: string;
  classe: string;
  csrf: string;
  confirm?: string;
}) {
  return (
    <form method="POST" action={`/reservations/${id}/statut`} className="d-grid">
      <input type="hidden" name="csrf_token" value={csrf} />
      <input type="hidden" name="statut" value={statut} />
      <button type="submit" className={`btn ${classe}`} data-confirm={confirm}>
        <Icone nom={icone} taille={14} /> {libelle}
      </button>
    </form>
  );
}

function BoutonPost({
  action,
  libelle,
  icone,
  classe = "btn-outline-secondary",
  csrf,
  confirm,
  champs,
  sm = false,
}: {
  action: string;
  libelle: string;
  icone: string;
  classe?: string;
  csrf: string;
  confirm?: string;
  champs?: Record<string, string>;
  sm?: boolean;
}) {
  return (
    <form method="POST" action={action} className="d-inline">
      <input type="hidden" name="csrf_token" value={csrf} />
      {champs
        ? Object.entries(champs).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
        : null}
      <button
        type="submit"
        className={`btn ${classe}${sm ? " btn-sm" : ""}`}
        data-confirm={confirm}
      >
        <Icone nom={icone} taille={14} /> {libelle}
      </button>
    </form>
  );
}

// ── Carte de décision ──

export function CarteDecision({
  r,
  csrf,
  peutDecider,
  features,
}: {
  r: ReservationComplete;
  csrf: string;
  peutDecider: boolean;
  features: FeatureFlags;
}) {
  const st = r.status as ReservationStatus;
  const demandeur = contactDe(r);
  const acompteAttendu = features.paiements && r.montantTtc > 0 && r.acompte > 0;
  const factureAcompte = r.factures.find((f) => f.type === "acompte" && f.status !== "annulee");

  let titre: string;
  let texte: React.ReactNode;
  let boutons: React.ReactNode = null;
  let aide: React.ReactNode = null;

  switch (st) {
    case "brouillon":
      titre = "Brouillon";
      texte = "Cette demande n'a pas encore été déposée.";
      boutons = (
        <>
          <BoutonStatut
            id={r.id}
            statut="a_traiter"
            libelle="Déposer la demande"
            icone="send"
            classe="btn-primary"
            csrf={csrf}
          />
          <BoutonOuvrir
            cible="modal-annuler"
            libelle="Annuler"
            icone="x"
            classe="btn-outline-secondary"
          />
        </>
      );
      break;
    case "a_traiter":
    case "en_traitement":
      titre = st === "a_traiter" ? "Une décision est attendue" : "En attente de l'usager";
      texte = (
        <>
          Invitez <strong>{demandeur}</strong> à confirmer sa réservation en approuvant son
          événement, ou déclinez la demande en expliquant pourquoi.
          {st === "en_traitement" ? (
            <span className="d-block text-muted small mt-1">
              Des précisions ont été demandées à l'usager : sa réponse arrivera dans le fil de
              discussion.
            </span>
          ) : null}
        </>
      );
      boutons = (
        <>
          <BoutonOuvrir
            cible="panneau-approuver"
            libelle="Approuver"
            icone="check"
            classe="btn-primary"
            panneau
          />
          <BoutonOuvrir
            cible="modal-refuser"
            libelle="Décliner"
            icone="x"
            classe="btn-outline-danger"
          />
        </>
      );
      aide = (
        <div className="decision-aide">
          <Icone nom="message-circle" taille={14} />
          <button
            type="button"
            className="btn btn-link btn-sm p-0 align-baseline"
            data-bs-toggle="modal"
            data-bs-target="#modal-infos"
            style={{ color: "var(--body)", textDecoration: "underline" }}
          >
            J'ai besoin d'informations
          </button>
          <span>avant de décider</span>
        </div>
      );
      break;
    case "acceptee": {
      titre = "Convention à signer";
      texte = (
        <>
          La demande est acceptée : <strong>{demandeur}</strong> doit signer la convention
          {features.signature
            ? " depuis son espace, avec un code reçu par SMS ou par courriel."
            : "."}
          <EtatSignature r={r} />
        </>
      );
      boutons = (
        <>
          <BoutonPost
            action={`/reservations/${r.id}/convention/relancer`}
            libelle="Relancer l'usager"
            icone="mail"
            classe="btn-primary"
            csrf={csrf}
          />
          <BoutonOuvrir
            cible="modal-signature"
            libelle="Marquer signée (papier)"
            icone="pen-line"
            classe="btn-outline-secondary"
          />
        </>
      );
      aide = (
        <div className="decision-aide">
          <Icone nom="x" taille={14} />
          <button
            type="button"
            className="btn btn-link btn-sm p-0 align-baseline"
            data-bs-toggle="modal"
            data-bs-target="#modal-annuler"
            style={{ color: "var(--body)", textDecoration: "underline" }}
          >
            Annuler la réservation
          </button>
        </div>
      );
      break;
    }
    case "signee":
      titre = acompteAttendu ? "En attente de l'acompte" : "Convention signée";
      texte = (
        <>
          Convention signée{r.signerName ? ` par ${r.signerName}` : ""}
          {r.signedAt ? ` le ${dateHeure(r.signedAt)}` : ""}.
          {acompteAttendu ? (
            <span className="d-block mt-1">
              Acompte attendu : <strong>{montant(r.acompte)}</strong>
              {factureAcompte ? (
                <>
                  {" "}
                  · facture {factureAcompte.numero} <StatutFacture status={factureAcompte.status} />
                </>
              ) : (
                <span className="text-muted"> · aucune facture d'acompte émise pour l'instant</span>
              )}
              . Le règlement de l'acompte confirme le dossier automatiquement.
            </span>
          ) : null}
        </>
      );
      boutons = (
        <>
          <BoutonStatut
            id={r.id}
            statut="confirmee"
            libelle="Confirmer"
            icone="check"
            classe="btn-primary"
            csrf={csrf}
            confirm="Confirmer la réservation sans attendre le paiement ?"
          />
          <BoutonOuvrir
            cible="modal-annuler"
            libelle="Annuler"
            icone="x"
            classe="btn-outline-danger"
          />
        </>
      );
      if (acompteAttendu && !factureAcompte && features.paiements)
        aide = (
          <div className="decision-aide">
            <Icone nom="receipt" taille={14} />
            <BoutonPost
              action={`/reservations/${r.id}/factures/creer`}
              libelle="Facturer l'acompte"
              icone="receipt"
              classe="btn-link btn-sm p-0"
              csrf={csrf}
              champs={{ type: "acompte" }}
            />
          </div>
        );
      break;
    case "confirmee":
      titre = "Réservation confirmée";
      texte = (
        <>
          Tout est en ordre : l'espace est réservé pour <strong>{demandeur}</strong>. Une fois
          l'événement passé, terminez le dossier.
        </>
      );
      boutons = (
        <>
          <BoutonStatut
            id={r.id}
            statut="terminee"
            libelle="Terminer"
            icone="check-check"
            classe="btn-primary"
            csrf={csrf}
            confirm="Marquer cette réservation comme terminée ?"
          />
          <BoutonOuvrir
            cible="modal-annuler"
            libelle="Annuler"
            icone="x"
            classe="btn-outline-danger"
          />
        </>
      );
      break;
    case "terminee":
      titre = "Événement terminé";
      texte =
        "L'événement a eu lieu. Archivez le dossier quand les éventuels paiements et la caution sont réglés.";
      boutons = (
        <BoutonStatut
          id={r.id}
          statut="archivee"
          libelle="Archiver"
          icone="archive"
          classe="btn-outline-secondary"
          csrf={csrf}
          confirm="Archiver ce dossier ? Il ne sera plus modifiable."
        />
      );
      break;
    case "refusee":
    case "annulee":
      titre = st === "refusee" ? "Demande refusée" : "Réservation annulée";
      texte = (
        <>
          {st === "refusee" ? "Motif du refus" : "Motif de l'annulation"} :{" "}
          <em>{(st === "refusee" ? r.refusalReason : r.cancelReason) || "non précisé"}</em>
          {r.decisionAt ? (
            <span className="d-block text-muted small mt-1">
              Décision du {dateHeure(r.decisionAt)}
              {r.decisionBy ? ` par ${r.decisionBy}` : ""}
            </span>
          ) : null}
        </>
      );
      boutons = (
        <>
          <BoutonStatut
            id={r.id}
            statut="archivee"
            libelle="Archiver"
            icone="archive"
            classe="btn-outline-secondary"
            csrf={csrf}
            confirm="Archiver ce dossier ?"
          />
          {st === "refusee" ? (
            <BoutonStatut
              id={r.id}
              statut="a_traiter"
              libelle="Rouvrir"
              icone="rotate-ccw"
              classe="btn-outline-primary"
              csrf={csrf}
              confirm="Rouvrir la demande ? Elle repassera « À traiter »."
            />
          ) : null}
        </>
      );
      break;
    default:
      titre = "Dossier archivé";
      texte = `Archivé le ${r.archivedAt ? dateHeure(r.archivedAt) : "—"}. Plus aucune action possible.`;
  }

  return (
    <div className="data-card decision">
      <div className="d-flex align-items-center gap-2 mb-2">
        <StatutResa status={r.status} lg />
        <span className="text-muted small">{RESERVATION_STATUS[st]?.aide}</span>
      </div>
      <h5>{titre}</h5>
      <p className="mb-3" style={{ fontSize: ".88rem" }}>
        {texte}
      </p>
      {peutDecider ? (
        <>
          <div className="decision-boutons">{boutons}</div>
          {aide}
        </>
      ) : (
        <div className="decision-aide">
          <Icone nom="lock" taille={14} /> Vous n'avez pas la main sur cet espace : la décision
          revient à ses gestionnaires.
        </div>
      )}
    </div>
  );
}

function EtatSignature({ r }: { r: ReservationComplete }) {
  if (!r.signatureSentAt)
    return (
      <span className="d-block text-muted small mt-1">
        Aucun code de signature envoyé pour l'instant : l'usager le demande depuis son espace.
      </span>
    );
  const expire = r.signatureExpiresAt && r.signatureExpiresAt < new Date();
  return (
    <span className="d-block text-muted small mt-1">
      Code envoyé le {dateHeure(r.signatureSentAt)} par{" "}
      {r.signatureChannel === "sms" ? "SMS" : "courriel"} · {r.signatureAttempts} essai
      {r.signatureAttempts > 1 ? "s" : ""}
      {r.signatureExpiresAt ? (
        <>
          {" "}
          · {expire ? <span className="text-danger">expiré le</span> : "expire le"}{" "}
          {dateHeure(r.signatureExpiresAt)}
        </>
      ) : null}
    </span>
  );
}

// ── Panneau d'approbation (offcanvas avec devis en direct) ──

export function PanneauApprobation({
  r,
  csrf,
  options,
  materiels,
  features,
}: {
  r: ReservationComplete;
  csrf: string;
  options: Option[];
  materiels: MaterielDispo[];
  features: FeatureFlags;
}) {
  const premier = r.creneaux.find((c) => c.status === "prevu") ?? r.creneaux[0];
  const rec = lireRecurrence(r.recurrence);
  const nb = r.creneaux.filter((c) => c.status === "prevu").length;
  const id = "panneau-approuver";
  return (
    <div className="offcanvas offcanvas-end" tabIndex={-1} id={id} aria-labelledby={`${id}-titre`}>
      <form
        method="POST"
        action={`/reservations/${r.id}/statut`}
        className="d-flex flex-column h-100"
        data-double-envoi
        data-devis="#approuver-devis"
      >
        <input type="hidden" name="csrf_token" value={csrf} />
        <input type="hidden" name="statut" value="acceptee" />
        <input type="hidden" name="reservation_id" value={r.id} />
        <input type="hidden" name="espace_id" value={r.espaceId} />
        {r.organisationId ? (
          <input type="hidden" name="organisation_id" value={r.organisationId} />
        ) : null}
        <input type="hidden" name="ignorer_delai" value="1" />
        {premier ? (
          <>
            <input type="hidden" name="date" value={isoParis(premier.startAt).date} />
            <input type="hidden" name="heure_debut" value={isoParis(premier.startAt).time} />
            <input type="hidden" name="heure_fin" value={isoParis(premier.endAt).time} />
          </>
        ) : null}
        {rec ? (
          <>
            <input type="hidden" name="recurrence" value="on" />
            <input type="hidden" name="freq" value={rec.freq} />
            <input type="hidden" name="interval" value={rec.interval ?? 1} />
            {rec.until ? <input type="hidden" name="until" value={rec.until} /> : null}
            {rec.count ? <input type="hidden" name="count" value={rec.count} /> : null}
            {(rec.byWeekday ?? []).map((j) => (
              <input key={j} type="hidden" name="weekday" value={j} />
            ))}
            {(rec.except ?? []).map((d) => (
              <input key={d} type="hidden" name="except" value={d} />
            ))}
            {rec.horsVacances ? <input type="hidden" name="hors_vacances" value="on" /> : null}
            {rec.horsFeries ? <input type="hidden" name="hors_feries" value="on" /> : null}
          </>
        ) : null}
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id={`${id}-titre`}>
            Approuver la demande
          </h5>
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="offcanvas"
            aria-label="Fermer"
          />
        </div>
        <div className="offcanvas-body flex-grow-1">
          <div className="recap mb-3">
            <dl className="mb-0">
              <dt>Espace</dt>
              <dd>
                {nomCourt(r.espace)} · {r.espace.site.name}
              </dd>
              <dt>Dates</dt>
              <dd>
                {plage(r.startAt, r.endAt)}
                {nb > 1 ? ` · ${nb} créneaux` : ""}
                {rec ? (
                  <span className="d-block text-muted fw-normal">{decrireRecurrence(rec)}</span>
                ) : null}
              </dd>
              <dt>Demandeur</dt>
              <dd className="mb-0">
                {r.organisation?.name ?? contactDe(r)}
                {r.organisation?.profil ? (
                  <span className="text-muted fw-normal"> · {r.organisation.profil.label}</span>
                ) : null}
              </dd>
            </dl>
          </div>

          <div className="intertitre">Options</div>
          <ChoixOptions
            options={options}
            choisies={new Map(r.options.map((o) => [o.optionId, o.quantite]))}
            vide="Aucune option pour cet espace."
          />

          {features.materiel ? (
            <>
              <div className="intertitre">Matériel</div>
              <ChoixMateriel
                materiels={materiels}
                choisis={new Map(r.materiels.map((m) => [m.materielId, m.quantite]))}
                fenetreConnue
              />
            </>
          ) : null}

          <div className="intertitre">Tarification</div>
          <div className="form-check form-switch mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              name="gratuit"
              id="approuver-gratuit"
              defaultChecked={r.gratuit}
            />
            <label className="form-check-label" htmlFor="approuver-gratuit">
              Mise à disposition gratuite (aucune redevance ni caution)
            </label>
          </div>
          <input
            type="text"
            name="gratuit_motif"
            className="form-control form-control-sm mb-2"
            placeholder="Fondement de la gratuité : délibération, convention, intérêt général…"
            aria-label="Fondement de la gratuité"
            defaultValue={r.gratuitMotif ?? ""}
            maxLength={300}
          />
          <div className="form-text mb-2">
            Obligatoire si la gratuité est accordée ; figure sur la convention et l'attestation de
            valorisation.
          </div>
          <div id="approuver-devis" className="small">
            <p className="text-muted mb-0">Calcul du montant…</p>
          </div>

          <div className="intertitre">Message à l'usager (facultatif)</div>
          <textarea
            name="message"
            className="form-control"
            rows={3}
            placeholder="Consignes d'accès, rappel du règlement, personne à contacter…"
            aria-label="Message à l'usager"
          />
          <div className="form-text">
            {features.signature
              ? "L'usager reçoit l'acceptation, la convention à signer et ce message."
              : "Sans signature électronique, la demande passe directement « Confirmée »."}
          </div>
        </div>
        <div
          className="p-3 border-top d-flex justify-content-end gap-2"
          style={{ borderColor: "var(--line)" }}
        >
          <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="offcanvas">
            Annuler
          </button>
          <button type="submit" className="btn btn-primary">
            <Icone nom="check" taille={14} /> Approuver
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Modales ──

export function ModalesDecision({
  r,
  csrf,
  frais = null,
}: {
  r: ReservationComplete;
  csrf: string;
  /** Les frais d'annulation qu'entraînerait une annulation maintenant (barème). */
  frais?: FraisPrevus | null;
}) {
  const action = `/reservations/${r.id}/statut`;
  return (
    <>
      <ModalAction
        id="modal-refuser"
        titre="Décliner la demande"
        action={action}
        csrf={csrf}
        bouton="Décliner"
        icone="x"
        danger
        aide="Le motif est transmis à l'usager par courriel."
      >
        <input type="hidden" name="statut" value="refusee" />
        <label className="form-label" htmlFor="refus-motif">
          Motif du refus <span className="req">*</span>
        </label>
        <textarea
          name="motif"
          id="refus-motif"
          className="form-control"
          rows={4}
          required
          placeholder="Espace indisponible, usage non conforme au règlement, dossier incomplet…"
        />
      </ModalAction>

      <ModalAction
        id="modal-infos"
        titre="Demander des informations"
        action={action}
        csrf={csrf}
        bouton="Envoyer"
        icone="send"
        aide="Le message est envoyé à l'usager ; la demande passe « En traitement » jusqu'à sa réponse."
      >
        <input type="hidden" name="statut" value="en_traitement" />
        <label className="form-label" htmlFor="infos-message">
          Message à l'usager <span className="req">*</span>
        </label>
        <textarea
          name="message"
          id="infos-message"
          className="form-control"
          rows={4}
          required
          placeholder="Pouvez-vous préciser le nombre de participants et joindre votre attestation d'assurance ?"
        />
      </ModalAction>

      <ModalAction
        id="modal-option"
        titre="Poser une option"
        action={`/reservations/${r.id}/option/poser`}
        csrf={csrf}
        bouton="Poser l'option"
        icone="hourglass"
        aide="Le créneau reste bloqué jusqu'à la date limite ; l'usager est relancé peu avant, puis le dossier est libéré d'office (annulé sans frais) si rien n'a été confirmé. Les inscrits en liste d'attente sont alors prévenus."
      >
        <div className="grille grille-2">
          <div>
            <label className="form-label" htmlFor="option-date">
              Date limite <span className="req">*</span>
            </label>
            <input
              type="date"
              name="option_date"
              id="option-date"
              className="form-control"
              required
              defaultValue={r.optionExpiresAt ? isoParis(r.optionExpiresAt).date : ""}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="option-heure">
              Heure
            </label>
            <input
              type="time"
              name="option_heure"
              id="option-heure"
              className="form-control"
              defaultValue={r.optionExpiresAt ? isoParis(r.optionExpiresAt).time : "18:00"}
            />
          </div>
        </div>
      </ModalAction>

      <ModalAction
        id="modal-annuler"
        titre="Annuler la réservation"
        action={action}
        csrf={csrf}
        bouton="Annuler la réservation"
        icone="x"
        danger
        aide="Les créneaux sont libérés et l'usager est prévenu du motif."
      >
        <input type="hidden" name="statut" value="annulee" />
        <label className="form-label" htmlFor="annul-motif">
          Motif <span className="req">*</span>
        </label>
        <textarea name="motif" id="annul-motif" className="form-control" rows={3} required />
        {frais ? (
          <>
            <div className="alert alert-warning small mt-3 mb-2">
              <Icone nom="triangle-alert" taille={14} /> Annulation à {frais.jours} jour
              {frais.jours > 1 ? "s" : ""} du début : le barème prévoit des frais de{" "}
              <strong>{montant(frais.montant)}</strong> ({frais.taux} % du montant), facturés à
              l'usager.
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                name="sans_frais"
                id="annul-sans-frais"
              />
              <label className="form-check-label" htmlFor="annul-sans-frais">
                Annuler sans frais (geste commercial, annulation du fait de la Ville…)
              </label>
            </div>
          </>
        ) : null}
      </ModalAction>

      <ModalAction
        id="modal-signature"
        titre="Marquer la convention signée"
        action={`/reservations/${r.id}/signature/manuelle`}
        csrf={csrf}
        bouton="Marquer signée"
        icone="pen-line"
        aide="Pour une convention signée sur papier : la version signée est régénérée et le dossier avance (signé, ou confirmé si aucun acompte n'est attendu)."
      >
        <label className="form-label" htmlFor="sig-nom">
          Nom du signataire <span className="req">*</span>
        </label>
        <input
          type="text"
          name="signer_name"
          id="sig-nom"
          className="form-control"
          required
          minLength={3}
          defaultValue={(r.organisation ? nomRepresentant(r.organisation) : null) ?? contactDe(r)}
        />
      </ModalAction>

      <ModalAction
        id="modal-creneau"
        titre="Ajouter un créneau"
        action={`/reservations/${r.id}/creneaux/ajouter`}
        csrf={csrf}
        bouton="Ajouter"
        icone="calendar-plus"
        aide="Heures de Paris. La disponibilité de l'espace est vérifiée ; les montants sont recalculés."
      >
        <div className="grille grille-3">
          <div>
            <label className="form-label" htmlFor="cr-date">
              Date <span className="req">*</span>
            </label>
            <input type="date" name="date" id="cr-date" className="form-control" required />
          </div>
          <div>
            <label className="form-label" htmlFor="cr-debut">
              Début <span className="req">*</span>
            </label>
            <input
              type="time"
              name="heure_debut"
              id="cr-debut"
              className="form-control"
              required
              step={r.espace.slotStepMin * 60}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="cr-fin">
              Fin <span className="req">*</span>
            </label>
            <input
              type="time"
              name="heure_fin"
              id="cr-fin"
              className="form-control"
              required
              step={r.espace.slotStepMin * 60}
            />
          </div>
        </div>
      </ModalAction>
    </>
  );
}

// ── Fil de discussion ──

function nomAuteur(m: MessageAvecAuteur, r: ReservationComplete): string {
  if (m.authorKind === "systeme") return "CityRésa";
  if (m.author) return `${m.author.firstName} ${m.author.lastName}`.trim() || m.author.email;
  return m.authorKind === "agent" ? "Un agent" : contactDe(r);
}

export function FilDiscussion({
  r,
  messages,
  csrf,
  peutEcrire,
}: {
  r: ReservationComplete;
  messages: MessageAvecAuteur[];
  csrf: string;
  peutEcrire: boolean;
}) {
  let dernierJour = "";
  const nonInternes = messages.filter((m) => !m.isInternal).length;
  return (
    <div className="data-card" id="discussion">
      <div className="card-header-custom">
        <h6>
          <Icone nom="message-circle" taille={16} classes="text-primary" /> Fil de discussion
          {nonInternes ? <span className="chip chip-slate">{nonInternes}</span> : null}
        </h6>
        <span className="text-muted small">
          {r.user?.email ?? r.organisation?.email ?? "aucune adresse connue"}
        </span>
      </div>
      <div className="fil">
        <div className="fil-messages" data-defiler>
          {messages.length ? (
            messages.map((m) => {
              const jour = dateCourte(m.createdAt);
              const separateur = jour !== dernierJour;
              dernierJour = jour;
              return (
                <Fragment key={m.id}>
                  {separateur ? <div className="fil-date">{dateLongue(m.createdAt)}</div> : null}
                  <div
                    className={`msg${m.isInternal ? " msg--interne" : ""}${m.authorKind === "systeme" ? " msg--systeme" : ""}`}
                  >
                    <Avatar nom={nomAuteur(m, r)} taille="sm" agent={m.authorKind === "agent"} />
                    <div className="msg-corps">
                      <div className="msg-auteur">
                        {nomAuteur(m, r)}
                        {m.isInternal ? <Chip teinte="amber">Note interne</Chip> : null}
                        {m.authorKind === "usager" && !m.readAt ? (
                          <Chip teinte="rose">Nouveau</Chip>
                        ) : null}
                        <small>{heure(m.createdAt)}</small>
                      </div>
                      <div className="msg-texte">{m.body}</div>
                    </div>
                  </div>
                </Fragment>
              );
            })
          ) : (
            <p className="text-muted small text-center my-4">
              Aucun message pour l'instant. Écrivez à l'usager ou laissez une note interne à vos
              collègues.
            </p>
          )}
        </div>
        {peutEcrire ? (
          <form
            method="POST"
            action={`/reservations/${r.id}/message`}
            className="fil-saisie"
            data-double-envoi
          >
            <input type="hidden" name="csrf_token" value={csrf} />
            <textarea
              name="body"
              id="fil-saisie-texte"
              className="form-control"
              placeholder="Écrire à l'usager…"
              required
              aria-label="Message"
            />
            <div className="fil-saisie-actions">
              <div className="form-check mb-0">
                <input
                  type="checkbox"
                  className="form-check-input"
                  name="is_internal"
                  id="msg-interne"
                />
                <label className="form-check-label small" htmlFor="msg-interne">
                  Note interne (invisible pour l'usager)
                </label>
              </div>
              <button type="submit" className="btn btn-primary btn-sm">
                <Icone nom="send" taille={14} /> Envoyer
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

// ── Colonne droite ──

export function SectionEvenement({
  r,
  csrf,
  agents,
  peutEditer,
  peutDecider,
  service = null,
  peutEpingler = false,
}: {
  r: ReservationComplete;
  csrf: string;
  agents: Agent[];
  peutEditer: boolean;
  peutDecider: boolean;
  /** Personnel de service par créneau (module actif et droit de lecture) ; null sinon. */
  service?: ServiceDossier | null;
  peutEpingler?: boolean;
}) {
  const rec = lireRecurrence(r.recurrence);
  const prevus = r.creneaux.filter((c) => c.status === "prevu");
  const vivant = ["a_traiter", "en_traitement", "acceptee", "signee", "confirmee"].includes(
    r.status,
  );
  const arrivee = new Date(r.startAt.getTime() - r.setupMin * 60_000);
  const depart = new Date(r.endAt.getTime() + r.teardownMin * 60_000);
  return (
    <Section
      titre="Événement"
      icone="party-popper"
      nb={prevus.length}
      droite={
        peutEditer ? (
          <a href={`/reservations/${r.id}/modifier`} className="btn btn-ghost btn-sm">
            Modifier
          </a>
        ) : undefined
      }
    >
      <Lus intitule="110px">
        <Lu
          label="Créée le"
          valeur={`${dateHeure(r.createdAt)} · ${RESERVATION_SOURCES[r.source] ?? r.source}`}
        />
        <Lu label="Statut" valeur={<StatutResa status={r.status} />} />
        <Lu
          label="Espace"
          valeur={
            <a href={`/espaces/${r.espaceId}`} title={r.espace.name}>
              {/* Le site est juste à côté : le libellé court suffit. */}
              {r.espace.shortName || r.espace.name}
            </a>
          }
        />
        <Lu label="Site" valeur={r.espace.site.name} />
        <Lu label="Nature" valeur={r.nature?.label} />
        <Lu label="Participants" valeur={r.participants ? String(r.participants) : null} />
        <Lu label="Public" valeur={<OuiNon v={r.isPublicEvent} />} />
        <Lu label="Récurrence" valeur={decrireRecurrence(rec)} />
        {estOption(r) || (peutDecider && vivant && STATUTS_OPTION.includes(r.status as never)) ? (
          <Lu
            label="Option"
            valeur={
              <span className="d-flex align-items-center gap-2 flex-wrap">
                {r.optionExpiresAt ? (
                  <Chip teinte={r.optionExpiresAt < new Date() ? "red" : "amber"}>
                    {decrireOption(r)}
                  </Chip>
                ) : (
                  <span className="text-muted">Pas d'échéance</span>
                )}
                {peutDecider && vivant ? (
                  <>
                    <BoutonOuvrir
                      cible="modal-option"
                      libelle={r.optionExpiresAt ? "Modifier" : "Poser une option"}
                      icone="hourglass"
                      classe="btn-ghost btn-sm"
                    />
                    {r.optionExpiresAt ? (
                      <form
                        method="POST"
                        action={`/reservations/${r.id}/option/lever`}
                        className="d-inline"
                      >
                        <input type="hidden" name="csrf_token" value={csrf} />
                        <button type="submit" className="btn btn-ghost btn-sm">
                          <Icone nom="x" taille={14} /> Lever
                        </button>
                      </form>
                    ) : null}
                  </>
                ) : null}
              </span>
            }
            pleine
          />
        ) : null}
        <Lu
          label="Arrivée"
          valeur={
            <span className="cell2">
              <span>{dateHeure(arrivee)}</span>
              {r.setupMin ? <small>montage {r.setupMin} min compris</small> : null}
            </span>
          }
        />
        <Lu
          label="Départ"
          valeur={
            <span className="cell2">
              <span>{dateHeure(depart)}</span>
              {r.teardownMin ? <small>démontage {r.teardownMin} min compris</small> : null}
            </span>
          }
        />
        <Lu label="Description" valeur={r.description} pleine pre />
      </Lus>

      <div className="d-flex align-items-center justify-content-between mt-3 mb-1">
        <span className="form-label mb-0">Créneaux ({prevus.length})</span>
        <span className="d-flex gap-1">
          {peutDecider && resumePresences(r.creneaux).passes > 0 ? (
            <a
              href={`/planning/presences?dossier=${r.id}`}
              className="btn btn-ghost btn-sm"
              title="Constater la présence et les heures réelles des créneaux passés"
            >
              <Icone nom="calendar-check" taille={14} /> Présences
            </a>
          ) : null}
          {peutDecider && vivant ? (
            <BoutonOuvrir
              cible="modal-creneau"
              libelle="Ajouter un créneau"
              icone="calendar-plus"
              classe="btn-ghost btn-sm"
            />
          ) : null}
        </span>
      </div>
      <div data-zone-maj="creneaux">
        <table className="table table-sm mb-3 table-compacte">
          <tbody>
            {r.creneaux.map((c) => (
              <tr
                key={c.id}
                id={`creneau-${c.id}`}
                className={c.status !== "prevu" ? "text-muted" : undefined}
              >
                <td style={c.status !== "prevu" ? { textDecoration: "line-through" } : undefined}>
                  <span className="cell2">
                    <span>{dateMoyenne(c.startAt)}</span>
                    <small>
                      {isoParis(c.startAt).date === isoParis(c.endAt).date
                        ? plageHoraire(c.startAt, c.endAt)
                        : `${heure(c.startAt)} → ${dateMoyenne(c.endAt)} ${heure(c.endAt)}`}
                    </small>
                  </span>
                </td>
                <td className="text-nowrap">
                  {duree((c.endAt.getTime() - c.startAt.getTime()) / 60_000)}
                </td>
                <td>
                  {c.status !== "prevu" ? (
                    <Chip teinte="slate">Annulé</Chip>
                  ) : c.presence ? (
                    <Chip
                      teinte={c.presence === "presente" ? "emerald" : "red"}
                      titre={c.presenceNote ?? undefined}
                    >
                      {decrirePresence(c)}
                    </Chip>
                  ) : c.endAt <= new Date() ? (
                    <Chip teinte="slate">Passé</Chip>
                  ) : (
                    <Chip teinte="emerald">Prévu</Chip>
                  )}
                </td>
                {service ? (
                  <td className="small">
                    {c.status !== "prevu" ? null : (
                      <ServiceCreneauCell
                        s={service.parCreneau.get(c.id)}
                        aVenir={c.endAt > new Date()}
                        creneauId={c.id}
                        reservationId={r.id}
                        csrf={csrf}
                        peutEpingler={peutEpingler}
                      />
                    )}
                  </td>
                ) : null}
                <td className="actions text-nowrap">
                  {peutDecider && vivant && c.status === "prevu" ? (
                    <a
                      href={`/reservations/${r.id}/creneaux/${c.id}/modifier`}
                      className="btn btn-ghost btn-icone btn-sm"
                      title={
                        prevus.length > 1
                          ? "Modifier ce créneau, les suivants ou toute la série"
                          : "Modifier ce créneau"
                      }
                      aria-label="Modifier ce créneau"
                    >
                      <Icone nom="pencil" taille={14} />
                    </a>
                  ) : null}
                  {peutDecider &&
                  c.status === "prevu" &&
                  c.startAt > new Date() &&
                  STATUTS_FERMES.includes(r.status as ReservationStatus) ? (
                    <a
                      href={`/reservations/${r.id}/creneaux/${c.id}/requisition`}
                      className="btn btn-ghost btn-icone btn-sm"
                      title="Priorité municipale : réquisitionner ce créneau pour un événement de la Ville"
                      aria-label="Réquisitionner ce créneau pour la Ville"
                    >
                      <Icone nom="landmark" taille={14} />
                    </a>
                  ) : null}
                  {peutDecider && vivant && c.status === "prevu" && prevus.length > 1 ? (
                    <form
                      method="POST"
                      action={`/reservations/${r.id}/creneaux/${c.id}/annuler`}
                      className="d-inline"
                    >
                      <input type="hidden" name="csrf_token" value={csrf} />
                      <button
                        type="submit"
                        className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                        title="Annuler ce créneau"
                        aria-label="Annuler ce créneau"
                        data-confirm={`Annuler le créneau du ${plage(c.startAt, c.endAt)} ?`}
                      >
                        <Icone nom="x" taille={14} />
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {service && peutEpingler
          ? r.creneaux
              .filter((c) => c.status === "prevu")
              .map((c) => (
                <ModalAction
                  key={`service-${c.id}`}
                  id={`modal-service-${c.id}`}
                  titre={`Personne de service · ${plage(c.startAt, c.endAt)}`}
                  action={`/reservations/${r.id}/creneaux/${c.id}/service`}
                  csrf={csrf}
                  bouton="Enregistrer"
                  icone="shield"
                  formAttrs={{ "data-sur-place": `creneau-${c.id}` }}
                  aide="Épingler une personne sur ce créneau précis (état des lieux, événement) : elle est alors de service même sans vacation sur le site. Laissez vide pour s'en remettre aux vacations."
                >
                  <label className="form-label" htmlFor={`service-${c.id}-personne`}>
                    Personne
                  </label>
                  <select
                    name="personnel_id"
                    id={`service-${c.id}-personne`}
                    className="form-select"
                    defaultValue={c.personnelId ?? service.parCreneau.get(c.id)?.propose?.id ?? ""}
                  >
                    <option value="">Aucune (vacations du site)</option>
                    {service.personnes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {`${p.firstName} ${p.lastName}`.trim()}
                        {p.fonction ? ` · ${p.fonction}` : ""}
                      </option>
                    ))}
                  </select>
                </ModalAction>
              ))
          : null}
      </div>

      <Lus intitule="110px">
        <div className="lu lu--pleine">
          <span className="lu-label">Agent assigné</span>
          <span className="lu-valeur">
            {peutEditer ? (
              <form
                method="POST"
                action={`/reservations/${r.id}/assigner`}
                className="d-flex align-items-center gap-2"
              >
                <input type="hidden" name="csrf_token" value={csrf} />
                <select
                  name="agent_id"
                  className="form-select form-select-sm"
                  style={{ maxWidth: 280 }}
                  defaultValue={r.agentId ?? ""}
                  aria-label="Agent assigné"
                  data-soumettre-au-changement
                >
                  <option value="">Personne</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {`${a.firstName} ${a.lastName}`.trim() || a.email}
                    </option>
                  ))}
                </select>
                <noscript>
                  <button type="submit" className="btn btn-sm btn-outline-secondary">
                    OK
                  </button>
                </noscript>
              </form>
            ) : (
              ((r.agent ? `${r.agent.firstName} ${r.agent.lastName}`.trim() : null) ?? (
                <span className="text-faint">—</span>
              ))
            )}
          </span>
        </div>
        <Lu label="Notes internes" valeur={r.internalNotes} pleine pre />
      </Lus>
    </Section>
  );
}

export function SectionDemandeur({ r }: { r: ReservationComplete }) {
  const o = r.organisation;
  const saisiParAgent = r.source === "backoffice" && r.user?.kind === "agent";
  const contact = saisiParAgent ? null : r.user;
  return (
    <Section titre="Demandeur" icone="users">
      <Lus intitule="110px">
        <Lu
          label="Organisation"
          valeur={
            o ? (
              <span className="d-flex align-items-center gap-2 flex-wrap">
                <a href={`/usagers/${o.id}`}>{o.name}</a>
                <TypeOrganisation type={o.type} />
                {!o.validatedAt ? <Chip teinte="amber">Compte non validé</Chip> : null}
              </span>
            ) : (
              <TypeOrganisation type={null} />
            )
          }
          pleine
        />
        <Lu label="Profil tarifaire" valeur={o?.profil?.label ?? "Tous profils"} />
        <Lu
          label="Contact"
          valeur={
            contact
              ? `${contact.firstName} ${contact.lastName}`.trim()
              : o
                ? nomRepresentant(o)
                : null
          }
        />
        <Lu
          label="Courriel"
          valeur={
            (contact?.email ?? o?.email) ? (
              <a href={`mailto:${contact?.email ?? o?.email}`}>{contact?.email ?? o?.email}</a>
            ) : null
          }
        />
        <Lu label="Téléphone" valeur={contact?.phone ?? o?.phone} />
        <Lu
          label="Adresse"
          valeur={
            o
              ? [o.address, [o.postalCode, o.city].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", ")
              : null
          }
          pleine
        />
        {saisiParAgent && r.user ? (
          <Lu label="Saisie par" valeur={`${r.user.firstName} ${r.user.lastName}`.trim()} />
        ) : null}
      </Lus>
    </Section>
  );
}

export function SectionMontants({
  r,
  devis,
  csrf,
  peutEditer,
  tvaTaux,
}: {
  r: ReservationComplete;
  devis: Devis;
  csrf: string;
  peutEditer: boolean;
  tvaTaux: number;
}) {
  const ecart = Math.abs(devis.ttc - r.montantTtc) > 0.005 || devis.gratuit !== r.gratuit;
  return (
    <Section
      titre="Montants"
      icone="euro"
      droite={
        r.gratuit ? (
          <span className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
            <Chip teinte="emerald" titre={r.gratuitMotif ?? undefined}>
              Gratuité
            </Chip>
            {r.gratuitMotif ? <small className="text-muted">{r.gratuitMotif}</small> : null}
          </span>
        ) : (
          <strong>{montant(r.montantTtc)}</strong>
        )
      }
    >
      <table className="montants w-100">
        <tbody>
          {devis.lignes.map((l, i) => (
            <tr key={`${l.type}-${i}`}>
              <td>
                {l.libelle}
                {l.quantite > 1 || l.type !== "espace" ? (
                  <span className="text-muted">
                    {" "}
                    · {l.quantite} × {montant(l.unitaire)}
                  </span>
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
          <tr>
            <td>Total HT</td>
            <td className="text-end">{montant(devis.ht)}</td>
          </tr>
          {devis.tva ? (
            <tr>
              <td>TVA ({String(tvaTaux).replace(".", ",")} %)</td>
              <td className="text-end">{montant(devis.tva)}</td>
            </tr>
          ) : null}
          <tr className="total">
            <td>Total TTC</td>
            <td className="text-end">{montantOuGratuit(devis.ttc)}</td>
          </tr>
          {devis.acompte ? (
            <tr>
              <td className="text-muted">dont acompte à la confirmation</td>
              <td className="text-end text-muted">{montant(devis.acompte)}</td>
            </tr>
          ) : null}
          {devis.caution ? (
            <tr>
              <td className="text-muted">Caution (restituée après état des lieux)</td>
              <td className="text-end text-muted">{montant(devis.caution)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {ecart ? (
        <div className="alert alert-warning py-2 mt-2 mb-2 small">
          Montant enregistré sur le dossier : {montantOuGratuit(r.gratuit ? 0 : r.montantTtc)}. Les
          tarifs ou le profil ont changé depuis : recalculez pour mettre le dossier à jour.
        </div>
      ) : null}
      {peutEditer ? (
        <div className="mt-2">
          <BoutonPost
            action={`/reservations/${r.id}/recalculer`}
            libelle="Recalculer"
            icone="refresh-cw"
            csrf={csrf}
            sm
          />
        </div>
      ) : null}
    </Section>
  );
}

export function SectionDocuments({
  r,
  documents,
  documentsUsager,
  categories,
  csrf,
  peutEditer,
  peutSupprimer,
}: {
  r: ReservationComplete;
  documents: DocumentAvecCategorie[];
  documentsUsager: DocumentAvecCategorie[];
  categories: Referential[];
  csrf: string;
  peutEditer: boolean;
  peutSupprimer: boolean;
}) {
  const next = `/reservations/${r.id}`;
  const avecConvention = ["acceptee", "signee", "confirmee", "terminee"].includes(r.status);
  return (
    <Section
      titre="Documents"
      icone="paperclip"
      nb={documents.length}
      ouverte={documents.length > 0}
    >
      <ListeDocuments
        documents={documents}
        csrf={csrf}
        next={next}
        peutSupprimer={(d) =>
          peutSupprimer && !["convention", "avenant", "facture"].includes(d.kind)
        }
        vide="Aucune pièce sur ce dossier."
      />
      {documentsUsager.length ? (
        <>
          <div className="form-label mt-3 mb-1">Pièces de l'usager (organisation)</div>
          <ListeDocuments
            documents={documentsUsager}
            csrf={csrf}
            next={next}
            peutSupprimer={() => false}
          />
        </>
      ) : null}
      {peutEditer ? (
        <div className="mt-3 d-flex flex-column gap-2">
          <FormDocument
            parentKind="reservation"
            parentId={r.id}
            csrf={csrf}
            next={next}
            categories={categories}
            kinds={[
              ["piece", "Pièce justificative"],
              ["assurance", "Attestation d'assurance"],
              ["autre", "Autre"],
            ]}
            compact
          />
          {avecConvention ? (
            <div>
              <BoutonPost
                action={`/reservations/${r.id}/convention/regenerer`}
                libelle="Régénérer la convention"
                icone="file-signature"
                csrf={csrf}
                sm
                confirm="Régénérer le PDF de la convention avec les données actuelles du dossier ?"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}

/** Un état des lieux (entrée ou sortie) : constat, photos. */
function BlocEtatDesLieux({
  edl,
  kind,
  peutDecider,
  r,
}: {
  edl: ReservationComplete["etatsDesLieux"][number] | undefined;
  kind: "entree" | "sortie";
  peutDecider: boolean;
  r: ReservationComplete;
}) {
  const libelle = kind === "entree" ? "État des lieux d'entrée" : "État des lieux de sortie";
  return (
    <div className="mb-3">
      <div className="d-flex align-items-center justify-content-between mb-1">
        <span className="form-label mb-0">{libelle}</span>
        {peutDecider ? (
          <BoutonOuvrir
            cible={`modal-edl-${kind}`}
            libelle={edl ? "Compléter" : "Faire l'état des lieux"}
            icone={edl ? "pencil" : "clipboard-check"}
            classe="btn-ghost btn-sm"
          />
        ) : null}
      </div>
      {edl ? (
        <div className="small">
          <div>
            {dateHeure(edl.doneAt)} par {edl.agent}
            {edl.signataire ? ` · en présence de ${edl.signataire}` : ""}
            {" · "}
            {edl.degats ? (
              <Chip teinte="red">Dégâts constatés</Chip>
            ) : (
              <Chip teinte="emerald">Sans dégât</Chip>
            )}
          </div>
          {edl.observations ? (
            <div className="text-muted" style={{ whiteSpace: "pre-wrap" }}>
              {edl.observations}
            </div>
          ) : null}
          {edl.documents.length ? (
            <div className="d-flex flex-wrap gap-2 mt-2">
              {edl.documents.map((d) => (
                <a
                  key={d.id}
                  href={`/documents/${d.id}/view`}
                  target="_blank"
                  rel="noopener"
                  title={d.filename}
                >
                  {estImage(d) ? (
                    <img
                      src={`/documents/${d.id}/thumb`}
                      alt={d.filename}
                      className="vignette"
                      style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 6 }}
                      loading="lazy"
                    />
                  ) : (
                    <span className="btn btn-ghost btn-sm">
                      <Icone nom="paperclip" taille={14} /> {d.filename}
                    </span>
                  )}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-muted small mb-0">
          {kind === "entree"
            ? "À faire à la remise des clés : point de départ en cas de litige."
            : `Indispensable avant de restituer ou retenir la caution${r.caution > 0 ? ` (${montant(r.caution)})` : ""}.`}
        </p>
      )}
    </div>
  );
}

/** Caution et états des lieux : cycle de la caution, constats d'entrée et de sortie, décisions. */
export function SectionCaution({
  r,
  csrf,
  peutDecider,
  isAdmin,
  seuil,
}: {
  r: ReservationComplete;
  csrf: string;
  peutDecider: boolean;
  isAdmin: boolean;
  seuil: number;
}) {
  const statut = lireStatutCaution(r.cautionStatus);
  const s = CAUTION_STATUS[statut];
  const entree = r.etatsDesLieux.find((e) => e.kind === "entree");
  const sortie = r.etatsDesLieux.find((e) => e.kind === "sortie");
  const acquis = ["acceptee", "signee", "confirmee", "terminee"].includes(r.status);
  const factureCaution = r.factures.find((f) => f.type === "caution" && f.status !== "annulee");
  const peutCloturer = statut === "encaissee" && Boolean(sortie);
  const ouverte = r.caution > 0 && statut !== "restituee" && statut !== "retenue";
  const ici = `/reservations/${r.id}`;
  return (
    <Section
      titre="Caution & états des lieux"
      icone="piggy-bank"
      id="caution"
      ouverte={ouverte && acquis}
    >
      <Lus intitule="110px">
        <Lu
          label="Caution"
          valeur={
            r.caution > 0 ? (
              <span className="d-flex align-items-center gap-2 flex-wrap">
                <strong>{montant(r.caution)}</strong>
                <Chip teinte={s.teinte} titre={s.aide}>
                  {s.label}
                </Chip>
              </span>
            ) : (
              <span className="text-muted">Aucune caution demandée</span>
            )
          }
        />
        {r.caution > 0 ? (
          <Lu
            label="Facture"
            valeur={
              factureCaution ? (
                <a href={`/paiements/${factureCaution.id}`}>
                  {factureCaution.numero} ·{" "}
                  {FACTURE_STATUS[factureCaution.status]?.label ?? factureCaution.status}
                </a>
              ) : null
            }
            tiret
          />
        ) : null}
        <Lu label="Encaissée le" valeur={dateHeure(r.cautionEncaisseeAt)} tiret />
        {statut === "retenue" || statut === "retenue_a_valider" ? (
          <>
            <Lu
              label="Retenue"
              valeur={`${montant(r.cautionRetenue)} par ${r.cautionDecideePar ?? "—"}`}
            />
            <Lu label="Motif" valeur={r.cautionMotif} pleine pre />
            <Lu label="Validée par" valeur={r.cautionValideePar} tiret />
          </>
        ) : null}
        {statut === "restituee" ? (
          <Lu label="Restituée le" valeur={dateHeure(r.cautionClotureeAt)} />
        ) : null}
      </Lus>

      {acquis ? (
        <div className="mt-3">
          <BlocEtatDesLieux edl={entree} kind="entree" peutDecider={peutDecider} r={r} />
          <BlocEtatDesLieux edl={sortie} kind="sortie" peutDecider={peutDecider} r={r} />
        </div>
      ) : (
        <p className="text-muted small mt-2 mb-0">
          Les états des lieux se font une fois la réservation acquise.
        </p>
      )}

      {peutDecider && r.caution > 0 ? (
        <div className="d-flex flex-wrap gap-2 mt-2">
          {statut === "attendue" || statut === "aucune" ? (
            <form method="POST" action={`${ici}/caution/encaisser`} className="d-inline">
              <input type="hidden" name="csrf_token" value={csrf} />
              <button type="submit" className="btn btn-outline-secondary btn-sm">
                <Icone nom="banknote" taille={14} /> Marquer encaissée
              </button>
            </form>
          ) : null}
          {statut === "encaissee" ? (
            <>
              <form method="POST" action={`${ici}/caution/restituer`} className="d-inline">
                <input type="hidden" name="csrf_token" value={csrf} />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={!peutCloturer}
                  title={peutCloturer ? undefined : "Faites d'abord l'état des lieux de sortie"}
                  data-confirm={`Restituer la caution de ${montant(r.caution)} en totalité ? L'usager est prévenu par courriel.`}
                >
                  <Icone nom="check" taille={14} /> Restituer
                </button>
              </form>
              <BoutonOuvrir
                cible="modal-retenir"
                libelle="Retenir tout ou partie"
                icone="octagon-alert"
                classe="btn-outline-danger btn-sm"
              />
            </>
          ) : null}
          {statut === "retenue_a_valider" && isAdmin ? (
            <form method="POST" action={`${ici}/caution/valider`} className="d-inline">
              <input type="hidden" name="csrf_token" value={csrf} />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                data-confirm={`Valider la retenue de ${montant(r.cautionRetenue)} ? L'usager est alors prévenu.`}
              >
                <Icone nom="shield-check" taille={14} /> Valider la retenue
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {peutDecider
        ? (["entree", "sortie"] as const).map((kind) => (
            <ModalAction
              key={kind}
              id={`modal-edl-${kind}`}
              titre={kind === "entree" ? "État des lieux d'entrée" : "État des lieux de sortie"}
              action={`${ici}/etat-des-lieux/${kind}`}
              csrf={csrf}
              bouton="Enregistrer"
              icone="clipboard-check"
              multipart
              aide="Les photos sont jointes au constat et visibles par l'usager depuis son dossier."
            >
              <label className="form-label" htmlFor={`edl-${kind}-obs`}>
                Observations
              </label>
              <textarea
                name="observations"
                id={`edl-${kind}-obs`}
                className="form-control"
                rows={4}
                defaultValue={(kind === "entree" ? entree : sortie)?.observations ?? ""}
                placeholder="État des sols, du matériel, propreté, clés rendues…"
              />
              <div className="form-check mt-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="degats"
                  id={`edl-${kind}-degats`}
                  defaultChecked={(kind === "entree" ? entree : sortie)?.degats ?? false}
                />
                <label className="form-check-label" htmlFor={`edl-${kind}-degats`}>
                  Dégâts ou manquements constatés
                </label>
              </div>
              <label className="form-label mt-2" htmlFor={`edl-${kind}-sig`}>
                Usager présent (nom)
              </label>
              <input
                type="text"
                name="signataire"
                id={`edl-${kind}-sig`}
                className="form-control"
                defaultValue={(kind === "entree" ? entree : sortie)?.signataire ?? ""}
              />
              <label className="form-label mt-2" htmlFor={`edl-${kind}-photos`}>
                Photos
              </label>
              <input
                type="file"
                name="photos"
                id={`edl-${kind}-photos`}
                className="form-control"
                accept="image/*"
                multiple
              />
            </ModalAction>
          ))
        : null}

      {peutDecider && r.caution > 0 ? (
        <ModalAction
          id="modal-retenir"
          titre="Retenir tout ou partie de la caution"
          action={`${ici}/caution/retenir`}
          csrf={csrf}
          bouton="Retenir"
          icone="octagon-alert"
          danger
          aide={`Le motif et le montant sont transmis à l'usager avec les constats de l'état des lieux de sortie.${seuil > 0 ? ` Au-delà de ${montant(seuil)}, la retenue attend la validation d'un administrateur.` : ""}`}
        >
          <label className="form-label" htmlFor="ret-montant">
            Montant retenu (€) <span className="req">*</span>
          </label>
          <input
            type="number"
            name="montant"
            id="ret-montant"
            className="form-control"
            min={0.01}
            max={r.caution}
            step="0.01"
            defaultValue={r.caution}
            required
          />
          <label className="form-label mt-2" htmlFor="ret-motif">
            Motif <span className="req">*</span>
          </label>
          <textarea
            name="motif"
            id="ret-motif"
            className="form-control"
            rows={3}
            required
            placeholder="Dégradation du parquet constatée à l'état des lieux de sortie, remise en état facturée…"
          />
        </ModalAction>
      ) : null}
    </Section>
  );
}

export function SectionConvention({
  r,
  features,
  csrf,
  peutDecider,
}: {
  r: ReservationComplete;
  features: FeatureFlags;
  csrf: string;
  peutDecider: boolean;
}) {
  const sansObjet = ["brouillon", "a_traiter", "en_traitement"].includes(r.status);
  const aSigner = r.avenants.filter((a) => !a.signedAt);
  return (
    <Section titre="Convention & signature" icone="file-signature" ouverte={!sansObjet}>
      {sansObjet && !r.conventionDocumentId ? (
        <p className="text-muted small mb-0">
          La convention est générée à l'acceptation de la demande.
        </p>
      ) : (
        <Lus intitule="110px">
          <Lu
            label="Convention"
            valeur={
              r.conventionDocumentId ? (
                <span className="d-flex gap-2 flex-wrap">
                  <a
                    href={`/documents/${r.conventionDocumentId}/view`}
                    target="_blank"
                    rel="noopener"
                  >
                    Voir le PDF
                  </a>
                  <a
                    href={`/reservations/${r.id}/convention.pdf`}
                    target="_blank"
                    rel="noopener"
                    className="text-muted"
                  >
                    Version à jour
                  </a>
                </span>
              ) : (
                <a href={`/reservations/${r.id}/convention.pdf`} target="_blank" rel="noopener">
                  Aperçu PDF
                </a>
              )
            }
          />
          <Lu
            label="Signature"
            valeur={
              r.signedAt ? (
                <Chip teinte="emerald">Signée le {dateHeure(r.signedAt)}</Chip>
              ) : r.status === "acceptee" ? (
                <Chip teinte="amber">En attente</Chip>
              ) : (
                <Chip teinte="slate">Non signée</Chip>
              )
            }
          />
          <Lu label="Signataire" valeur={r.signerName} />
          <Lu
            label="Mode"
            valeur={
              r.signedAt
                ? r.signerIp
                  ? `Électronique (IP ${r.signerIp})`
                  : "Papier, enregistrée par un agent"
                : null
            }
          />
          <Lu
            label="Code envoyé"
            valeur={
              r.signatureSentAt
                ? `${dateHeure(r.signatureSentAt)} par ${r.signatureChannel === "sms" ? "SMS" : "courriel"}`
                : null
            }
          />
          <Lu
            label="Expiration"
            valeur={r.signatureExpiresAt && !r.signedAt ? dateHeure(r.signatureExpiresAt) : null}
          />
          <Lu
            label="Essais"
            valeur={r.signatureSentAt && !r.signedAt ? String(r.signatureAttempts) : null}
          />
          {!features.signature ? (
            <Lu
              label="Module"
              valeur="Signature électronique désactivée : signature sur papier."
              pleine
            />
          ) : null}
        </Lus>
      )}
      {r.avenants.length ? (
        <>
          <div className="form-label mt-3 mb-1">Avenants ({r.avenants.length})</div>
          <table className="table table-sm mb-0">
            <tbody>
              {r.avenants.map((a) => (
                <tr key={a.id}>
                  <td>
                    Avenant {libelleAvenant(a)}
                    <div className="text-muted small">{a.objet}</div>
                  </td>
                  <td className="text-nowrap">{dateCourte(a.createdAt)}</td>
                  <td>
                    {a.signedAt ? (
                      <Chip teinte="emerald">Signé le {dateCourte(a.signedAt)}</Chip>
                    ) : (
                      <Chip teinte="amber">À signer</Chip>
                    )}
                  </td>
                  <td className="actions text-nowrap">
                    {a.documentId ? (
                      <a
                        href={`/documents/${a.documentId}/view`}
                        target="_blank"
                        rel="noopener"
                        className="btn btn-ghost btn-icone btn-sm"
                        title="Voir le PDF"
                        aria-label="Voir le PDF"
                      >
                        <Icone nom="file-text" taille={14} />
                      </a>
                    ) : null}
                    {peutDecider && !a.signedAt ? (
                      <>
                        <form
                          method="POST"
                          action={`/reservations/${r.id}/avenants/${a.id}/relancer`}
                          className="d-inline"
                        >
                          <input type="hidden" name="csrf_token" value={csrf} />
                          <button
                            type="submit"
                            className="btn btn-ghost btn-icone btn-sm"
                            title="Relancer l'usager pour la signature"
                            aria-label="Relancer l'usager pour la signature"
                          >
                            <Icone nom="send" taille={14} />
                          </button>
                        </form>
                        <BoutonOuvrir
                          cible={`modal-avenant-${a.id}`}
                          libelle="Signature sur papier"
                          icone="pen-line"
                          classe="btn-ghost btn-icone btn-sm"
                          sansTexte
                        />
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {peutDecider
            ? aSigner.map((a) => (
                <ModalAction
                  key={a.id}
                  id={`modal-avenant-${a.id}`}
                  titre={`Avenant ${libelleAvenant(a)} signé sur papier`}
                  action={`/reservations/${r.id}/avenants/${a.id}/signature-manuelle`}
                  csrf={csrf}
                  bouton="Enregistrer la signature"
                  icone="pen-line"
                  aide="L'usager a retourné l'avenant signé : le PDF est réédité avec la mention de signature et l'usager reçoit une confirmation."
                >
                  <label className="form-label" htmlFor={`av-nom-${a.id}`}>
                    Nom du signataire <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    name="signer_name"
                    id={`av-nom-${a.id}`}
                    className="form-control"
                    required
                    minLength={3}
                    defaultValue={r.signerName ?? ""}
                  />
                </ModalAction>
              ))
            : null}
        </>
      ) : null}
    </Section>
  );
}

export function SectionFactures({
  r,
  csrf,
  peutFacturer,
}: {
  r: ReservationComplete;
  csrf: string;
  peutFacturer: boolean;
}) {
  const vivantes = r.factures.filter((f) => f.status !== "annulee");
  const aAcompte = vivantes.some((f) => f.type === "acompte");
  const aSolde = vivantes.some((f) => f.type === "solde");
  const aCaution = vivantes.some((f) => f.type === "caution");
  const facturable = ["signee", "confirmee", "terminee"].includes(r.status) && !r.gratuit;
  return (
    <Section
      titre="Factures"
      icone="receipt"
      nb={r.factures.length}
      ouverte={r.factures.length > 0}
    >
      {r.factures.length ? (
        <table className="table table-sm mb-2">
          <tbody>
            {r.factures.map((f) => {
              const paye = f.paiements.reduce((s, p) => s + p.montant, 0);
              return (
                <tr key={f.id}>
                  <td>
                    <span className="cell2">
                      <a
                        href={`/paiements/${f.id}`}
                        className="fw-medium"
                        style={{ color: "var(--strong)" }}
                      >
                        {f.numero}
                      </a>
                      <small>
                        {FACTURE_TYPES[f.type] ?? f.type}
                        {f.dueAt ? ` · échéance ${dateCourte(f.dueAt)}` : ""}
                      </small>
                    </span>
                  </td>
                  <td className="text-end text-nowrap">
                    {montant(f.montantTtc)}
                    {paye && paye < f.montantTtc ? (
                      <small className="d-block text-muted">réglé {montant(paye)}</small>
                    ) : null}
                  </td>
                  <td className="text-end">
                    <StatutFacture status={f.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-muted small mb-2">Aucune facture émise.</p>
      )}
      {peutFacturer && facturable ? (
        <div className="d-flex gap-2 flex-wrap">
          {!aAcompte && r.acompte > 0 ? (
            <BoutonPost
              action={`/reservations/${r.id}/factures/creer`}
              libelle={`Facturer l'acompte (${montant(r.acompte)})`}
              icone="receipt"
              csrf={csrf}
              champs={{ type: "acompte" }}
              sm
            />
          ) : null}
          {!aSolde && r.montantTtc > 0 ? (
            <BoutonPost
              action={`/reservations/${r.id}/factures/creer`}
              libelle="Facturer le solde"
              icone="receipt"
              csrf={csrf}
              champs={{ type: "solde" }}
              sm
            />
          ) : null}
          {!aCaution && r.caution > 0 ? (
            <BoutonPost
              action={`/reservations/${r.id}/factures/creer`}
              libelle={`Facturer la caution (${montant(r.caution)})`}
              icone="shield"
              csrf={csrf}
              champs={{ type: "caution" }}
              sm
            />
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}

export function SectionHistorique({ histories }: { histories: ReservationHistory[] }) {
  return (
    <Section titre="Historique" icone="history" nb={histories.length} ouverte={false}>
      {histories.length ? (
        <ul className="historique list-unstyled mb-0">
          {histories.map((h) => (
            <li key={h.id}>
              <span className="quand">{dateHeure(h.performedAt)}</span>
              <span>
                <span style={{ color: "var(--strong)" }}>{h.action}</span>
                {h.comment ? <span className="text-muted"> · {h.comment}</span> : null}
                {h.performedBy ? <span className="qui d-block">{h.performedBy}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted small mb-0">Aucun événement.</p>
      )}
    </Section>
  );
}
