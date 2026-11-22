/**
 * L'onglet « Délais » de Mes étapes : le temps que mettent les relectures, avis et visas à
 * recevoir leur réponse, par étape et par service.
 */
import { VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import { CarteStat } from "@/components/stats";
import { type Delai, PERIODES_DELAIS } from "@/lib/circuits-delais";
import { dateCourte, duree } from "@/lib/libelles";
import { delaisEtapes } from "@/server/circuits-delais";

const temps = (minutes: number | null) =>
  minutes === null ? <span className="text-faint">—</span> : duree(minutes);

function Tableau({ titre, colonne, lignes }: { titre: string; colonne: string; lignes: Delai[] }) {
  return (
    <div className="data-card mb-3">
      <h5>{titre}</h5>
      <div className="table-responsive">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th>{colonne}</th>
              <th className="text-end">Réponses</th>
              <th className="text-end">Délai médian</th>
              <th className="text-end">Délai moyen</th>
              <th className="text-end">Le plus long</th>
              <th className="text-end">Hors délai</th>
              <th className="text-end">En attente</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((d) => (
              <tr key={d.groupe}>
                <td className="col-souple col-souple--large">
                  <span className="cell2" style={{ whiteSpace: "normal" }}>
                    <strong>{d.groupe}</strong>
                    {d.closes ? (
                      <small>
                        {d.accords} accord{d.accords > 1 ? "s" : ""}
                        {d.refus ? ` · ${d.refus} refus` : ""}
                      </small>
                    ) : null}
                  </span>
                </td>
                <td className="text-end">{d.closes}</td>
                <td className="text-end text-nowrap">{temps(d.mediane)}</td>
                <td className="text-end text-nowrap">{temps(d.moyenne)}</td>
                <td className="text-end text-nowrap">{temps(d.max)}</td>
                <td className="text-end">
                  {d.horsDelai ? <Chip teinte="amber">{d.horsDelai}</Chip> : 0}
                </td>
                <td className="text-end text-nowrap">
                  {d.ouvertes}
                  {d.enRetard ? (
                    <>
                      {" "}
                      <Chip teinte="red">{d.enRetard} en retard</Chip>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export async function VueDelais({ mois }: { mois: number }) {
  const d = await delaisEtapes(mois);
  if (!d) return null;
  const e = d.ensemble;
  return (
    <>
      <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
        <span className="text-muted small">
          Étapes demandées depuis le {dateCourte(d.depuis)} :
        </span>
        {PERIODES_DELAIS.map((m) => (
          <a
            key={m}
            href={`/etapes?vue=delais&mois=${m}`}
            className={`btn btn-sm ${m === mois ? "btn-primary" : "btn-outline-secondary"}`}
            aria-current={m === mois ? "true" : undefined}
          >
            {m} mois
          </a>
        ))}
      </div>
      {e.closes + e.ouvertes ? (
        <>
          <div className="stat-grid">
            <CarteStat
              icone="check"
              teinte="emerald"
              label="Réponses reçues"
              valeur={e.closes}
              detail={e.closes ? `${e.accords} accords · ${e.refus} refus` : undefined}
            />
            <CarteStat
              icone="hourglass"
              teinte="sky"
              label="Délai médian de réponse"
              valeur={temps(e.mediane)}
              detail={e.max === null ? undefined : `le plus long : ${duree(e.max)}`}
            />
            <CarteStat
              icone="clock"
              teinte="amber"
              label="Réponses hors délai"
              valeur={e.horsDelai}
              detail="après l'échéance indicative"
            />
            <CarteStat
              icone="list-checks"
              teinte={e.enRetard ? "red" : "slate"}
              label="En attente"
              valeur={e.ouvertes}
              detail={e.enRetard ? `dont ${e.enRetard} en retard` : undefined}
            />
          </div>
          <Tableau titre="Par étape" colonne="Étape" lignes={d.parEtape} />
          <Tableau titre="Par service du dossier" colonne="Service" lignes={d.parService} />
          <p className="text-muted small">
            Le délai court de la demande de l'étape à la réponse qui la clôt, jours non ouvrés
            compris. Une étape redemandée compte pour chaque demande ; une étape annulée ne compte
            pas.
          </p>
        </>
      ) : (
        <div className="data-card">
          <VideBloc
            icone="clock"
            titre="Aucune étape sur la période"
            texte="Les délais apparaissent dès qu'un circuit a demandé une relecture, un avis ou un visa."
          />
        </div>
      )}
    </>
  );
}
