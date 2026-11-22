/**
 * La carte « Circuit » de la fiche d'un dossier : le service auquel il est confié, les
 * étapes que son circuit lui impose, où elles en sont, et les boutons de qui doit agir.
 */
import { ModalAction } from "@/components/fiche";
import { Zone } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { NATURES } from "@/lib/circuits";
import { dateCourte, dateHeure } from "@/lib/libelles";
import { PastilleEtat, PastilleNature } from "@/modules/processus/vues";
import type { EtatCircuit } from "@/server/circuits";

export function CarteCircuit({
  etat,
  dossier,
  csrf,
  peutDecider,
  userId,
}: {
  etat: EtatCircuit;
  dossier: { id: number; numero: string; status: string };
  csrf: string;
  /** L'agent instruit ce dossier : il demande les étapes. */
  peutDecider: boolean;
  userId: string;
}) {
  const aLEtude = dossier.status === "a_traiter" || dossier.status === "en_traitement";
  const fiche = `/reservations/${dossier.id}`;
  const maintenant = Date.now();
  // Un dossier sans service ni étape n'a rien à montrer.
  if (!etat.service && !etat.etapes.length) return null;
  return (
    <div className="data-card circuit" id="circuit">
      <h5>
        <Icone nom="workflow" taille={16} /> Circuit
        <small>
          {etat.circuit?.name}
          {etat.version ? ` · v${etat.version.numero}` : ""}
        </small>
      </h5>
      {etat.service ? (
        <p className="circuit-service">
          Dossier confié à <strong>{etat.service.name}</strong>
          {etat.service.email || etat.service.phone
            ? ` (${[etat.service.email, etat.service.phone].filter(Boolean).join(" · ")})`
            : ""}
        </p>
      ) : null}
      {aLEtude && etat.retenues.length ? (
        <p className="circuit-verrou">
          <Icone nom="lock" taille={14} /> L'acceptation attend :{" "}
          {etat.retenues.map((e) => e.libelle).join(", ")}.
        </p>
      ) : null}
      {etat.etapes.length ? (
        <ul className="circuit-etapes">
          {etat.etapes.map((e) => {
            const d = e.derniere;
            const attendu = e.attendus.some((p) => p.id === userId);
            const retard =
              e.etat === "ouverte" && d?.echeanceAt && d.echeanceAt.getTime() < maintenant;
            return (
              <li key={e.cle}>
                <div className="circuit-etape-titre">
                  <strong>{e.libelle}</strong>
                  <PastilleNature nature={e.nature} />
                  <PastilleEtat etat={e.etat} nature={e.nature} />
                </div>
                <div className="circuit-etape-qui">
                  {e.libelleIntervenant}
                  {e.attendus.length ? ` : ${e.attendus.map((p) => p.name).join(", ")}` : ""}
                  {e.bloquante ? "" : " · ne retient pas l'acceptation"}
                </div>
                {d && e.etat !== "a_demander" ? (
                  <div className="circuit-etape-suivi">
                    Demandé le {dateHeure(d.ouvertAt)} par {d.ouvertPar ?? "—"}
                    {d.contexte ? ` · ${d.contexte}` : ""}
                    {e.etat === "ouverte" && d.echeanceAt ? (
                      <span className={retard ? "text-danger" : ""}>
                        {" "}
                        · {retard ? "en retard depuis le" : "attendu le"} {dateCourte(d.echeanceAt)}
                      </span>
                    ) : null}
                    {d.closAt && e.etat !== "ouverte" ? (
                      <div>
                        <strong>{NATURES[e.nature].issues[e.etat === "validee" ? 0 : 1]}</strong> le{" "}
                        {dateHeure(d.closAt)} par {d.closPar ?? "—"}
                        {d.commentaire ? ` : ${d.commentaire}` : ""}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="circuit-etape-actions">
                  {e.etat === "ouverte" && attendu ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        data-bs-toggle="modal"
                        data-bs-target={`#modal-etape-accord-${d?.id}`}
                      >
                        <Icone nom="check" taille={13} /> {NATURES[e.nature].issues[0]}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        data-bs-toggle="modal"
                        data-bs-target={`#modal-etape-refus-${d?.id}`}
                      >
                        {NATURES[e.nature].issues[1]}
                      </button>
                    </>
                  ) : null}
                  {aLEtude && peutDecider && (e.etat === "a_demander" || e.etat === "refusee") ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      data-bs-toggle="modal"
                      data-bs-target={`#modal-etape-demander-${e.cle}`}
                    >
                      <Icone nom="send" taille={13} />{" "}
                      {e.etat === "refusee" ? "Redemander" : "Demander"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted small mb-0">Ce circuit n'impose aucune étape à ce dossier.</p>
      )}

      {etat.etapes.map((e) => {
        const d = e.derniere;
        const attendu = e.attendus.some((p) => p.id === userId);
        return (
          <div key={e.cle}>
            {aLEtude && peutDecider && (e.etat === "a_demander" || e.etat === "refusee") ? (
              <ModalAction
                id={`modal-etape-demander-${e.cle}`}
                titre={`Demander : ${e.libelle}`}
                action={`${fiche}/etapes/demander`}
                csrf={csrf}
                bouton="Demander"
                icone="send"
                aide={`${e.libelleIntervenant} sera prévenu. ${NATURES[e.nature].aide}`}
              >
                <input type="hidden" name="cle" value={e.cle} />
                <Zone
                  label="Ce que vous soumettez"
                  name="contexte"
                  id={`dem-${e.cle}`}
                  rows={3}
                  placeholder="La décision envisagée, ce qu'il faut regarder"
                />
              </ModalAction>
            ) : null}
            {e.etat === "ouverte" && attendu && d ? (
              <>
                <ModalAction
                  id={`modal-etape-accord-${d.id}`}
                  titre={`${NATURES[e.nature].issues[0]} · ${dossier.numero}`}
                  action={`/etapes/${d.id}`}
                  csrf={csrf}
                  bouton={NATURES[e.nature].issues[0]}
                >
                  <input type="hidden" name="reponse" value="accord" />
                  <input type="hidden" name="next" value={`${fiche}#circuit`} />
                  <Zone
                    label="Commentaire (facultatif)"
                    name="commentaire"
                    id={`acc-${d.id}`}
                    rows={3}
                  />
                </ModalAction>
                <ModalAction
                  id={`modal-etape-refus-${d.id}`}
                  titre={`${NATURES[e.nature].issues[1]} · ${dossier.numero}`}
                  action={`/etapes/${d.id}`}
                  csrf={csrf}
                  bouton={NATURES[e.nature].issues[1]}
                  danger
                >
                  <input type="hidden" name="reponse" value="refus" />
                  <input type="hidden" name="next" value={`${fiche}#circuit`} />
                  <Zone
                    label="Motif"
                    name="commentaire"
                    id={`ref-${d.id}`}
                    rows={3}
                    requis
                    placeholder="Ce qui doit être revu"
                  />
                </ModalAction>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
