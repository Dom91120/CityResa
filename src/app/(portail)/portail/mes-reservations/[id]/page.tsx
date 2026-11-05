import { notFound } from "next/navigation";
import { FormDocument, ListeDocuments } from "@/components/documents";
import { BoutonOuvrir, Lu, Lus, ModalAction, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip, Frise, StatutFacture, StatutResa } from "@/components/macros";
import { FACTURE_TYPES, RESERVATION_SOURCES } from "@/lib/constantes";
import { decrireRecurrence, lireRecurrence } from "@/lib/creneaux";
import { dateCourte, dateHeure, montant, nomCourt, plage, pluriel } from "@/lib/libelles";
import {
  type Etape,
  historiqueVisible,
  marquerMessagesLus,
  messagesVisibles,
  peutAnnuler,
  prochaineEtape,
  reservationUsager,
} from "@/modules/portail/suivi";
import { BlocSignature, EncartEtape, FilMessages, Montants } from "@/modules/portail/vues";
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
  const avenantASigner = features.signature ? (r.avenants.find((a) => !a.signedAt) ?? null) : null;
  const etape: Etape = avenantASigner
    ? {
        texte: "Les créneaux de votre réservation ont changé : il vous reste à signer l'avenant.",
        icone: "pen-line",
        teinte: "rose",
        action: "avenant",
      }
    : prochaineEtape(r, cfg);
  const annulable = peutAnnuler(r, cfg);
  const aSigner = r.status === "acceptee" && features.signature;
  const codeEnCours = Boolean(
    r.signatureCodeHash && r.signatureExpiresAt && r.signatureExpiresAt > new Date(),
  );
  const convention = r.conventionDocumentId
    ? pieces.find((d) => d.id === r.conventionDocumentId)
    : null;
  const OFFICIELS = ["convention", "avenant", "facture"];
  const documentsUsager = pieces.filter((d) => !OFFICIELS.includes(d.kind));
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
        <BlocSignature
          id="signature"
          titre="Signer la convention"
          intro="Lisez la convention de mise à disposition, puis signez-la en deux étapes : recevez un code, saisissez-le avec votre nom. La signature vaut engagement."
          documentId={convention?.id ?? null}
          documentLibelle="Lire la convention (PDF)"
          enPreparation="La convention est en cours de préparation."
          codeEnCours={codeEnCours}
          canal={r.signatureChannel}
          sentAt={r.signatureSentAt}
          expiresAt={r.signatureExpiresAt}
          actionCode={`${ici}/signature/code`}
          actionSigner={`${ici}/signature/signer`}
          csrf={csrf}
          telephone={user.phone ?? r.organisation?.phone ?? ""}
          email={user.email}
          nom={user.name}
          libelleLu="J'ai lu la convention et j'en accepte les termes"
          libelleSigner="Signer la convention"
        />
      ) : null}

      {avenantASigner ? (
        <BlocSignature
          id="avenant"
          titre={`Signer l'avenant n°${avenantASigner.numero}`}
          intro="Les créneaux de votre réservation ont changé après la signature de la convention. Lisez l'avenant, puis signez-le en deux étapes : recevez un code, saisissez-le avec votre nom."
          documentId={avenantASigner.documentId}
          documentLibelle="Lire l'avenant (PDF)"
          enPreparation="L'avenant est en cours de préparation."
          codeEnCours={Boolean(
            avenantASigner.signatureCodeHash &&
              avenantASigner.signatureExpiresAt &&
              avenantASigner.signatureExpiresAt > new Date(),
          )}
          canal={avenantASigner.signatureChannel}
          sentAt={avenantASigner.signatureSentAt}
          expiresAt={avenantASigner.signatureExpiresAt}
          actionCode={`${ici}/avenant/${avenantASigner.id}/code`}
          actionSigner={`${ici}/avenant/${avenantASigner.id}/signer`}
          csrf={csrf}
          telephone={user.phone ?? r.organisation?.phone ?? ""}
          email={user.email}
          nom={user.name}
          libelleLu="J'ai lu l'avenant et j'en accepte les termes"
          libelleSigner="Signer l'avenant"
        />
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
          {pieces.some((d) => OFFICIELS.includes(d.kind)) ? (
            <>
              <div className="form-label">Convention, avenants et factures</div>
              <ListeDocuments
                documents={pieces.filter((d) => OFFICIELS.includes(d.kind))}
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
