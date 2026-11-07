/**
 * La page d'une fiche du dossier de demande, commune au portail (l'association remplit) et au
 * back-office (un agent complète un dossier papier) : navigation entre fiches, formulaire ou
 * lecture seule, pièces, signature et dépôt sur la dernière fiche.
 */
import { FormDocument, ListeDocuments } from "@/components/documents";
import { BoutonOuvrir, ModalAction } from "@/components/fiche";
import { Icone } from "@/components/icones";
import {
  contextePieces,
  etatPieces,
  FICHES,
  type FicheCle,
  ficheSuivante,
  fichesIncompletes,
} from "@/lib/dossier-subvention";
import { dateHeure } from "@/lib/libelles";
import { piecesRequises } from "@/lib/pieces-subvention";
import { planDe } from "@/lib/plan-budget";
import {
  EtatPiecesListe,
  FormFiche,
  LectureFiche,
  ListeManques,
  NavFiches,
} from "@/modules/subventions/dossier-vues";
import type { SubventionComplete } from "@/modules/subventions/server";
import { forParent } from "@/server/documents";
import type { Page } from "@/server/page";
import { dossierDe, enRedaction, manquesDe, pourManques } from "@/server/subventions-dossier";

export async function CorpsFiche({
  page,
  s,
  cle,
  base,
  portail,
  peutEditer,
}: {
  page: Page;
  s: SubventionComplete;
  cle: FicheCle;
  base: string;
  /** Côté portail : signature par code et dépôt par l'association. */
  portail: boolean;
  peutEditer: boolean;
}) {
  const d = dossierDe(s);
  const sportive = s.organisation.sportive;
  const ctx = { s, d, sportive, plan: planDe(sportive) };
  const redaction = enRedaction(s) && peutEditer;
  const [manques, documents] = await Promise.all([
    manquesDe(s, !portail),
    forParent("subvention", s.id),
  ]);
  const incompletes = fichesIncompletes(manques);
  const kinds = documents.map((x) => x.kind).filter((k) => k !== "dossier");
  const baseFiches = `${base}/${s.id}/dossier`;
  const ici = `${baseFiches}/${cle}`;
  const fiche = FICHES.find((f) => f.cle === cle) ?? FICHES[0];
  const suivante = ficheSuivante(cle);
  const pieces = documents.filter((x) => x.kind !== "dossier");
  return (
    <>
      <NavFiches base={baseFiches} courante={cle} incompletes={incompletes} lecture={!redaction} />
      <div className="d-flex align-items-center gap-2 mb-3">
        <Icone nom={fiche.icone} taille={18} classes="text-muted" />
        <h2 className="h5 mb-0">{fiche.titre}</h2>
        <span className="text-muted small">{fiche.aide}</span>
      </div>

      {cle === "pieces" ? (
        <div className="data-card p-4">
          <p className="text-muted small">
            Les pièces attendues dépendent de la nature de la demande, du commissaire aux comptes,
            d'un changement de statuts et d'une signature par mandataire. Déposez chaque pièce avec
            la nature correspondante.
          </p>
          <EtatPiecesListe etats={etatPieces(pourManques(s, d), kinds)} />
          <h3 className="h6 mt-4">Pièces déposées</h3>
          <ListeDocuments
            documents={pieces}
            csrf={page.csrf}
            next={ici}
            peutSupprimer={(doc) => redaction && (!portail || doc.uploadedById === page.user.id)}
            vide="Aucune pièce déposée."
          />
          {page.features.documents && redaction ? (
            <div className="mt-3">
              <FormDocument
                parentKind="subvention"
                parentId={s.id}
                csrf={page.csrf}
                next={ici}
                kinds={[
                  ...piecesRequises(contextePieces(pourManques(s, d))).map(
                    (p) => [p.kind, p.libelle] as [string, string],
                  ),
                  ["piece", "Autre pièce justificative"],
                ]}
              />
            </div>
          ) : null}
          <div className="form-pied mt-3">
            <a href={`${base}/${s.id}`} className="btn btn-outline-secondary">
              Retour au dossier
            </a>
            {suivante ? (
              <a href={`${baseFiches}/${suivante}`} className="btn btn-primary">
                <Icone nom="arrow-right" taille={14} /> Fiche suivante
              </a>
            ) : null}
          </div>
        </div>
      ) : redaction ? (
        <FormFiche
          cle={cle}
          ctx={ctx}
          action={ici}
          csrf={page.csrf}
          retour={`${base}/${s.id}`}
          suivante={suivante}
        />
      ) : (
        <div className="data-card p-4">
          <LectureFiche cle={cle} ctx={ctx} org={s.organisation} />
          <div className="form-pied mt-3">
            <a href={`${base}/${s.id}`} className="btn btn-outline-secondary">
              Retour au dossier
            </a>
            {suivante ? (
              <a href={`${baseFiches}/${suivante}`} className="btn btn-outline-primary">
                <Icone nom="arrow-right" taille={14} /> Fiche suivante
              </a>
            ) : null}
          </div>
        </div>
      )}

      {cle === "attestation" && redaction ? (
        <div className="mt-3">
          {portail ? <BlocSignatureDossier s={s} page={page} base={base} /> : null}
          <div className="data-card p-4 mt-3" id="depot">
            <h2 className="h5 mb-2">
              <Icone nom="send" taille={18} /> Déposer le dossier
            </h2>
            <ListeManques manques={manques} base={baseFiches} />
            {!manques.length ? (
              portail ? (
                <form
                  method="POST"
                  action={`${base}/${s.id}/deposer`}
                  className="mt-3"
                  data-double-envoi
                >
                  <input type="hidden" name="csrf_token" value={page.csrf} />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    data-confirm="Déposer le dossier ? Il ne sera plus modifiable, sauf renvoi par la Ville."
                  >
                    <Icone nom="send" taille={14} /> Déposer mon dossier
                  </button>
                </form>
              ) : (
                <div className="mt-3">
                  <BoutonOuvrir cible="modal-deposer" libelle="Déposer le dossier" icone="send" />
                </div>
              )
            ) : null}
          </div>
          {!portail && !manques.length ? (
            <ModalAction
              id="modal-deposer"
              titre={`Déposer le dossier ${s.exercice} de ${s.organisation.name}`}
              action={`${base}/${s.id}/deposer`}
              csrf={page.csrf}
              bouton="Déposer"
              icone="send"
              aide="Le dossier reçoit son numéro et la date de réception ; le PDF est généré et l'association reçoit l'accusé de réception. Hors période de campagne, indiquez le motif de la dérogation."
            >
              <label className="form-label" htmlFor="dep-derogation">
                Motif de dérogation (si hors période)
              </label>
              <textarea name="derogation" id="dep-derogation" className="form-control" rows={3} />
            </ModalAction>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function BlocSignatureDossier({
  s,
  page,
  base,
}: {
  s: SubventionComplete;
  page: Page;
  base: string;
}) {
  const codeEnCours = Boolean(
    s.signatureCodeHash && s.signatureExpiresAt && s.signatureExpiresAt > new Date(),
  );
  if (s.signeAt)
    return (
      <div className="alert alert-success d-flex align-items-start gap-2 mb-0">
        <Icone nom="circle-check" taille={18} />
        <div>
          <strong>Attestation signée</strong> par {s.signeNom}
          {s.signeQualite ? `, ${s.signeQualite}` : ""} le {dateHeure(s.signeAt)}.
          <div className="small">
            Toute modification d'une fiche annule la signature : il faudra signer à nouveau.
          </div>
        </div>
      </div>
    );
  return (
    <div className="data-card p-4">
      <h2 className="h5 mb-2">
        <Icone nom="pen-line" taille={18} /> Signer l'attestation
      </h2>
      <p className="text-muted small">
        Enregistrez d'abord la fiche ci-dessus (engagements cochés, nom du signataire). Un code à
        usage unique vous est envoyé par SMS, ou par courriel à {page.user.email} ; sa saisie vaut
        signature de l'attestation sur l'honneur et du contrat d'engagement républicain.
      </p>
      <div className="row g-3">
        <div className="col-md-6">
          <div className="form-section h-100">
            <div className="form-section-titre">
              <Icone nom="smartphone" taille={14} /> Étape 1 · Recevoir mon code
            </div>
            {codeEnCours ? (
              <div className="alert alert-success small">
                <Icone nom="check" taille={14} /> Un code vous a été envoyé{" "}
                {s.signeChannel === "sms" ? "par SMS" : "par courriel"}
                {s.signatureSentAt ? ` le ${dateHeure(s.signatureSentAt)}` : ""}. Il reste valable
                jusqu'au {s.signatureExpiresAt ? dateHeure(s.signatureExpiresAt) : ""}.
              </div>
            ) : null}
            <form method="POST" action={`${base}/${s.id}/signature/code`} data-double-envoi>
              <input type="hidden" name="csrf_token" value={page.csrf} />
              <label className="form-label" htmlFor="sig-telephone">
                Téléphone mobile (pour le SMS)
              </label>
              <input
                type="tel"
                name="telephone"
                id="sig-telephone"
                className="form-control"
                defaultValue={page.user.phone ?? s.organisation.phone ?? ""}
                autoComplete="tel"
                placeholder="06 12 34 56 78"
              />
              <div className="form-text mb-2">
                Sans numéro ou si le SMS n'est pas disponible, le code arrive par courriel.
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
            <form method="POST" action={`${base}/${s.id}/signature/signer`} data-double-envoi>
              <input type="hidden" name="csrf_token" value={page.csrf} />
              <label className="form-label" htmlFor="sig-code">
                Code reçu (6 chiffres)
              </label>
              <input
                type="text"
                name="code"
                id="sig-code"
                className="form-control form-control-lg"
                inputMode="numeric"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                required
                autoComplete="one-time-code"
                disabled={!codeEnCours}
                placeholder="123456"
              />
              <div className="form-check mt-2 mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="lu"
                  id="sig-lu"
                  required
                  disabled={!codeEnCours}
                />
                <label className="form-check-label" htmlFor="sig-lu">
                  Je signe l'attestation sur l'honneur et le contrat d'engagement républicain au nom
                  de l'association.
                </label>
              </div>
              <button type="submit" className="btn btn-primary" disabled={!codeEnCours}>
                <Icone nom="pen-line" taille={14} /> Signer
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
