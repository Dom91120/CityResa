import { notFound } from "next/navigation";
import { FormDocument, ListeDocuments } from "@/components/documents";
import { BoutonOuvrir, Lu, Lus, ModalAction, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip, Frise, StatutFacture, StatutResa } from "@/components/macros";
import { FACTURE_TYPES, RESERVATION_SOURCES } from "@/lib/constantes";
import { decrireRecurrence, lireRecurrence } from "@/lib/creneaux";
import { dateCourte, dateHeure, montant, nomCourt, plage, pluriel } from "@/lib/libelles";
import {
  historiqueVisible,
  marquerMessagesLus,
  messagesVisibles,
  peutAnnuler,
  prochaineEtape,
  reservationUsager,
} from "@/modules/portail/suivi";
import { EncartEtape, FilMessages, Montants } from "@/modules/portail/vues";
import { getSettings } from "@/server/config-store";
import { forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteUsager } from "@/server/page";
import { deviser } from "@/server/reservations";

export const metadata = { title: "Ma réservation - CityRésa" };

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const id = idDeRoute((await params).id);
  const page = await contexteUsager();
  const { user, csrf, features } = page;
  const r = await reservationUsager(user, id);
  if (!r) notFound();
  const cfg = await getSettings();
  await marquerMessagesLus(r.id);
  const creneaux = r.creneaux.filter((c) => c.status === "prevu");
  const [messages, historique, pieces, devis] = await Promise.all([
    messagesVisibles(r.id),
    historiqueVisible(r.id),
    forParent("reservation", r.id),
    deviser(
      r.espaceId,
      r.organisation?.profilId ?? null,
      creneaux.length ? creneaux : r.creneaux,
      r.options.map((o) => ({ optionId: o.optionId, quantite: o.quantite })),
      r.materiels.map((m) => ({ materielId: m.materielId, quantite: m.quantite })),
      r.gratuit,
    ),
  ]);
  const ici = `/portail/mes-reservations/${r.id}`;
  const etape = prochaineEtape(r, cfg);
  const annulable = peutAnnuler(r, cfg);
  const aSigner = r.status === "acceptee" && features.signature;
  const codeEnCours = Boolean(
    r.signatureCodeHash && r.signatureExpiresAt && r.signatureExpiresAt > new Date(),
  );
  const convention = r.conventionDocumentId
    ? pieces.find((d) => d.id === r.conventionDocumentId)
    : null;
  const documentsUsager = pieces.filter((d) => d.kind !== "convention" && d.kind !== "facture");
  const recurrence = lireRecurrence(r.recurrence);
  const vivant = ["a_traiter", "en_traitement", "acceptee", "signee", "confirmee"].includes(
    r.status,
  );

  return (
    <>
      <div className="page-header fiche-entete">
        <div className="d-flex align-items-center" style={{ gap: 12, minWidth: 0 }}>
          <a
            href="/portail/mes-reservations"
            className="fiche-retour"
            title="Retour"
            aria-label="Retour"
          >
            <Icone nom="arrow-left" taille={16} />
          </a>
          <div style={{ minWidth: 0 }}>
            <h1 className="page-title">
              {r.title}
              <StatutResa status={r.status} lg />
            </h1>
            <p className="page-subtitle">
              N° {r.numero} · {nomCourt(r.espace)} · {r.espace.site.name}
            </p>
          </div>
        </div>
        <div className="page-actions">
          {annulable ? (
            <BoutonOuvrir
              cible="modal-annuler"
              libelle="Annuler ma réservation"
              icone="calendar-x"
              classe="btn-outline-danger"
            />
          ) : null}
          {r.espace.icsToken || user.icsToken ? null : null}
        </div>
      </div>

      <div className="mb-3" style={{ maxWidth: 520 }}>
        <Frise status={r.status} grande />
      </div>

      <EncartEtape etape={etape} lien={etape.action ? `#${etape.action}` : undefined} />

      {aSigner ? (
        <div className="data-card p-4 mb-3" id="signature">
          <h2 className="h5 mb-2">
            <Icone nom="pen-line" taille={18} /> Signer la convention
          </h2>
          <p className="text-muted">
            Lisez la convention de mise à disposition, puis signez-la en deux étapes : recevez un
            code, saisissez-le avec votre nom. La signature vaut engagement.
          </p>
          {convention ? (
            <a
              href={`/documents/${convention.id}/view`}
              target="_blank"
              rel="noopener"
              className="btn btn-outline-primary mb-3"
            >
              <Icone nom="file-signature" taille={14} /> Lire la convention (PDF)
            </a>
          ) : (
            <p className="text-muted small">La convention est en cours de préparation.</p>
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
                    {r.signatureChannel === "sms" ? "par SMS" : "par courriel"}
                    {r.signatureSentAt ? ` le ${dateHeure(r.signatureSentAt)}` : ""}. Il reste
                    valable jusqu'au {r.signatureExpiresAt ? dateHeure(r.signatureExpiresAt) : ""}.
                  </div>
                ) : null}
                <form method="POST" action={`${ici}/signature/code`} data-double-envoi>
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <label className="form-label" htmlFor="f-telephone">
                    Téléphone mobile (pour le SMS)
                  </label>
                  <input
                    type="tel"
                    name="telephone"
                    id="f-telephone"
                    className="form-control"
                    defaultValue={user.phone ?? r.organisation?.phone ?? ""}
                    autoComplete="tel"
                    placeholder="06 12 34 56 78"
                  />
                  <div className="form-text mb-2">
                    Sans numéro ou si le SMS n'est pas disponible, le code arrive par courriel à{" "}
                    {user.email}.
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
                <form method="POST" action={`${ici}/signature/signer`} data-double-envoi>
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <label className="form-label" htmlFor="f-code">
                    Code reçu (6 chiffres)
                  </label>
                  <input
                    type="text"
                    name="code"
                    id="f-code"
                    className="form-control form-control-lg"
                    inputMode="numeric"
                    pattern="[0-9 ]{6,7}"
                    maxLength={7}
                    required
                    autoComplete="one-time-code"
                    disabled={!codeEnCours}
                    placeholder="123456"
                  />
                  <label className="form-label mt-2" htmlFor="f-nom">
                    Votre nom complet
                  </label>
                  <input
                    type="text"
                    name="nom"
                    id="f-nom"
                    className="form-control"
                    defaultValue={user.name}
                    required
                    minLength={3}
                    disabled={!codeEnCours}
                  />
                  <div className="form-check mt-2 mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="lu"
                      id="f-lu"
                      required
                      disabled={!codeEnCours}
                    />
                    <label className="form-check-label" htmlFor="f-lu">
                      J'ai lu la convention et j'en accepte les termes
                    </label>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={!codeEnCours}>
                    <Icone nom="pen-line" taille={14} /> Signer la convention
                  </button>
                  {!codeEnCours ? (
                    <div className="form-text">Demandez d'abord votre code (étape 1).</div>
                  ) : null}
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="data-card">
        <Section titre="Événement" icone="party-popper">
          <Lus>
            <Lu label="Objet" valeur={r.title} />
            <Lu label="Type" valeur={r.nature?.label} />
            <Lu label="Espace" valeur={`${nomCourt(r.espace)} · ${r.espace.site.name}`} />
            <Lu
              label="Participants"
              valeur={r.participants ? `${r.participants} personnes` : null}
            />
            <Lu label="Public" valeur={r.isPublicEvent ? "Événement ouvert au public" : null} />
            <Lu label="Demandeur" valeur={r.organisation?.name ?? user.name} />
            <Lu
              label="Déposée le"
              valeur={`${dateHeure(r.createdAt)} (${RESERVATION_SOURCES[r.source] ?? r.source})`}
            />
            <Lu label="Précisions" valeur={r.description} pleine pre />
            {recurrence ? (
              <Lu label="Récurrence" valeur={decrireRecurrence(recurrence)} pleine />
            ) : null}
            <Lu
              label="Créneaux"
              pleine
              valeur={
                <ul className="list-unstyled mb-0">
                  {(creneaux.length ? creneaux : r.creneaux).map((c) => (
                    <li
                      key={c.id}
                      className={
                        c.status === "annule" ? "text-muted text-decoration-line-through" : ""
                      }
                    >
                      <Icone nom="calendar-days" taille={13} /> {plage(c.startAt, c.endAt)}
                    </li>
                  ))}
                </ul>
              }
            />
            {creneaux.length > 1 ? (
              <Lu label="Total" valeur={pluriel(creneaux.length, "créneau", "créneaux")} />
            ) : null}
            {r.refusalReason ? (
              <Lu label="Motif du refus" valeur={r.refusalReason} pleine pre />
            ) : null}
            {r.cancelReason ? (
              <Lu label="Motif d'annulation" valeur={r.cancelReason} pleine pre />
            ) : null}
            {r.signedAt ? (
              <Lu
                label="Signature"
                valeur={`Convention signée le ${dateHeure(r.signedAt)} par ${r.signerName ?? ""}`}
                pleine
              />
            ) : null}
          </Lus>
        </Section>

        <Section titre="Montants" icone="euro" ouverte={!aSigner}>
          <Montants devis={devis} gratuit={r.gratuit} />
          {r.espace.instructions && vivant ? (
            <div className="astuce mt-3">
              <Icone nom="info" taille={16} />
              <div>
                <strong>Consignes pour l'espace.</strong>
                <div style={{ whiteSpace: "pre-wrap" }}>{r.espace.instructions}</div>
              </div>
            </div>
          ) : null}
        </Section>

        <Section titre="Messages" icone="message-circle" id="messages" nb={messages.length || null}>
          <FilMessages
            messages={messages}
            action={`${ici}/message`}
            csrf={csrf}
            collectivite={cfg.COLLECTIVITE_NOM}
          />
        </Section>

        <Section titre="Documents" icone="paperclip" id="documents" nb={pieces.length || null}>
          {convention || pieces.some((d) => d.kind === "facture") ? (
            <>
              <div className="form-label">Convention et factures</div>
              <ListeDocuments
                documents={pieces.filter((d) => d.kind === "convention" || d.kind === "facture")}
                csrf={csrf}
                next={`${ici}#documents`}
              />
              <hr />
            </>
          ) : null}
          <div className="form-label">Vos pièces (assurance, programme, justificatifs…)</div>
          <ListeDocuments
            documents={documentsUsager}
            csrf={csrf}
            next={`${ici}#documents`}
            peutSupprimer={(d) => d.uploadedById === user.id}
            vide="Aucune pièce déposée. Une attestation d'assurance est généralement demandée avant l'événement."
          />
          {features.documents && vivant ? (
            <div className="mt-3">
              <FormDocument
                parentKind="reservation"
                parentId={r.id}
                csrf={csrf}
                next={`${ici}#documents`}
                kinds={[
                  ["assurance", "Attestation d'assurance"],
                  ["piece", "Pièce justificative"],
                  ["autre", "Autre"],
                ]}
              />
            </div>
          ) : null}
        </Section>

        {features.paiements ? (
          <Section titre="Factures" icone="receipt" id="factures" nb={r.factures.length || null}>
            {r.factures.length ? (
              <div className="table-responsive">
                <table className="table mb-0">
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Type</th>
                      <th className="text-end">Montant</th>
                      <th>Statut</th>
                      <th>Échéance</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {r.factures.map((f) => (
                      <tr key={f.id}>
                        <td className="fw-semibold">{f.numero}</td>
                        <td>{FACTURE_TYPES[f.type] ?? f.type}</td>
                        <td className="text-end">{montant(f.montantTtc)}</td>
                        <td>
                          <StatutFacture status={f.status} />
                        </td>
                        <td>{f.dueAt ? dateCourte(f.dueAt) : "—"}</td>
                        <td className="text-end">
                          <a
                            href={`${ici}/factures/${f.id}/pdf`}
                            className="btn btn-sm btn-outline-secondary"
                          >
                            <Icone nom="file-down" taille={13} /> PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-muted small mt-2 mb-0">
                  Règlement en régie auprès de la collectivité, par chèque à l'ordre du Trésor
                  public ou par virement (coordonnées sur la facture).
                </p>
              </div>
            ) : (
              <p className="text-muted small mb-0">Aucune facture pour l'instant.</p>
            )}
          </Section>
        ) : null}

        <Section titre="Historique" icone="history" ouverte={false} nb={historique.length || null}>
          <ul className="historique list-unstyled mb-0">
            {historique.map((h) => (
              <li key={h.id}>
                <span className="text-muted">{dateHeure(h.performedAt)}</span>
                <span>
                  <strong>{h.action}</strong>
                  {h.comment ? <span className="text-muted"> · {h.comment}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {vivant && !annulable ? (
        <p className="text-muted small mt-3">
          <Icone nom="info" taille={13} /> L'annulation en ligne n'est plus possible : elle doit se
          faire au moins {cfg.DELAI_ANNULATION_JOURS} jour
          {cfg.DELAI_ANNULATION_JOURS > 1 ? "s" : ""} avant l'événement. Pour une annulation
          tardive, écrivez à la collectivité dans le <a href="#messages">fil de discussion</a>.
        </p>
      ) : null}

      {annulable ? (
        <ModalAction
          id="modal-annuler"
          titre="Annuler ma réservation"
          action={`${ici}/annuler`}
          csrf={csrf}
          bouton="Confirmer l'annulation"
          icone="calendar-x"
          danger
          aide="L'annulation est définitive. La collectivité en sera informée."
        >
          <label className="form-label" htmlFor="f-motif">
            Motif (facultatif)
          </label>
          <textarea name="motif" id="f-motif" className="form-control" rows={3} maxLength={1000} />
          <p className="text-muted small mt-2 mb-0">
            <Chip teinte="slate">N° {r.numero}</Chip> {plage(r.startAt, r.endAt)}
          </p>
        </ModalAction>
      ) : null}
    </>
  );
}
