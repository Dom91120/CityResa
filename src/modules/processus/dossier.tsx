/**
 * La carte « Circuit » de la fiche d'un dossier : le service auquel il est confié, les
 * étapes que son circuit lui impose, où elles en sont, et les boutons de qui doit agir.
 */
import { ModalAction } from "@/components/fiche";
import { Zone } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { MOMENTS, type Moment, NATURES, RETENU, REUNIONS, STATUTS_DU_MOMENT } from "@/lib/circuits";
import { dateCourte, dateHeure } from "@/lib/libelles";
import { PastilleEtat, PastilleNature } from "@/modules/processus/vues";
import type { EtatCircuit } from "@/server/circuits";

export function CarteCircuit({
  etat,
  dossier,
  csrf,
  peutDecider,
  userId,
  base,
  sansEntete = false,
}: {
  etat: EtatCircuit;
  dossier: { id: number; numero: string; status: string };
  csrf: string;
  /** L'agent instruit ce dossier : il demande les étapes. */
  peutDecider: boolean;
  userId: string;
  /** La fiche du dossier ; par défaut celle d'une réservation. */
  base?: string;
  /** Les étapes seules, sans titre ni service : la page les présente déjà. */
  sansEntete?: boolean;
}) {
  const fiche = base ?? `/reservations/${dossier.id}`;
  const maintenant = Date.now();
  /** L'étape a-t-elle encore un sens au statut actuel du dossier ? */
  const vivante = (e: { moment: Moment }) => STATUTS_DU_MOMENT[e.moment].includes(dossier.status);
  // On montre les étapes du moment présent, et celles qui ont déjà été demandées.
  const etapes = etat.etapes.filter((e) => vivante(e) || e.etat !== "a_demander");
  // Le bandeau annonce ce qui retient l'acceptation, et tout autre geste déjà tenté : un visa
  // de refus jamais demandé ne « retient » rien tant que personne ne veut refuser.
  const retenues = etat.retenues.filter(
    (e) => vivante(e) && (e.moment === "avant_acceptation" || e.etat !== "a_demander"),
  );
  // Un dossier sans service ni étape n'a rien à montrer.
  if (!etapes.length && (sansEntete || !etat.service)) return null;
  return (
    <div
      className={sansEntete ? "circuit-suite" : "data-card circuit"}
      id={sansEntete ? undefined : "circuit"}
    >
      {sansEntete ? null : (
        <h5>
          <Icone nom="workflow" taille={16} /> Circuit
          <small>
            {etat.circuit?.name}
            {etat.version ? ` · v${etat.version.numero}` : ""}
          </small>
        </h5>
      )}
      {etat.service && !sansEntete ? (
        <p className="circuit-service">
          Dossier confié à <strong>{etat.service.name}</strong>
          {etat.service.email || etat.service.phone
            ? ` (${[etat.service.email, etat.service.phone].filter(Boolean).join(" · ")})`
            : ""}
        </p>
      ) : null}
      {etat.enService && etat.version && peutDecider && !sansEntete ? (
        <form method="POST" action={`${fiche}/etapes/basculer`} className="circuit-version">
          <input type="hidden" name="csrf_token" value={csrf} />
          <span>
            Ce dossier suit la version {etat.version.numero} du circuit ; la version{" "}
            {etat.enService.numero} est en service.
          </span>{" "}
          <button
            type="submit"
            className="btn btn-sm btn-outline-secondary"
            data-confirm={`Faire passer ce dossier sur la version ${etat.enService.numero} du circuit ? Les étapes déjà demandées qui existent encore sont conservées ; celles en attente qui n'existent plus sont annulées.`}
          >
            <Icone nom="rotate-ccw" taille={13} /> Passer à la version {etat.enService.numero}
          </button>
        </form>
      ) : null}
      {retenues.length ? (
        <p className="circuit-verrou">
          <Icone nom="lock" taille={14} />{" "}
          {[...new Set(retenues.map((e) => e.moment))]
            .map(
              (m) =>
                `${RETENU[m].charAt(0).toUpperCase()}${RETENU[m].slice(1)} attend : ${retenues
                  .filter((e) => e.moment === m)
                  .map((e) => e.libelle)
                  .join(", ")}.`,
            )
            .join(" ")}
        </p>
      ) : null}
      {etapes.length ? (
        <ul className="circuit-etapes">
          {etapes.map((e) => {
            const d = e.derniere;
            const reponses = d?.reponses ?? [];
            const attendu =
              e.attendus.some((p) => p.id === userId) && !reponses.some((r) => r.userId === userId);
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
                  {e.moment === "avant_acceptation" || sansEntete ? "" : `${MOMENTS[e.moment]} · `}
                  {e.libelleIntervenant}
                  {e.attendus.length ? ` : ${e.attendus.map((p) => p.name).join(", ")}` : ""}
                  {e.reunion !== "un" && e.attendus.length > 1
                    ? ` · ${REUNIONS[e.reunion].court}`
                    : ""}
                  {e.bloquante ? "" : " · ne retient rien"}
                  {e.enCopie.length
                    ? ` · en copie : ${e.enCopie.map((p) => p.name).join(", ")}`
                    : ""}
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
                    {e.reunion !== "un" && reponses.length ? (
                      <div>
                        Réponses ({reponses.length} sur{" "}
                        {
                          new Set([
                            ...e.attendus.map((p) => p.id),
                            ...reponses.map((r) => r.userId),
                          ]).size
                        }
                        ) :{" "}
                        {reponses
                          .map(
                            (r) =>
                              `${r.userName} (${r.accord ? "accord" : "refus"}${r.commentaire ? ` : ${r.commentaire}` : ""})`,
                          )
                          .join(", ")}
                      </div>
                    ) : null}
                    {d.closAt && e.etat !== "ouverte" ? (
                      <div>
                        <strong>{NATURES[e.nature].issues[e.etat === "validee" ? 0 : 1]}</strong> le{" "}
                        {dateHeure(d.closAt)}{" "}
                        {d.closPar === "automatique" ? "d'office" : `par ${d.closPar ?? "—"}`}
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
                  {vivante(e) &&
                  peutDecider &&
                  (e.etat === "a_demander" || e.etat === "refusee") ? (
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

      {etapes.map((e) => {
        const d = e.derniere;
        const attendu =
          e.attendus.some((p) => p.id === userId) &&
          !(d?.reponses ?? []).some((r) => r.userId === userId);
        return (
          <div key={e.cle}>
            {vivante(e) && peutDecider && (e.etat === "a_demander" || e.etat === "refusee") ? (
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
