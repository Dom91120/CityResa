import { Icone } from "@/components/icones";
import { VideBloc } from "@/components/liste";
import { Chip, TypeOrganisation } from "@/components/macros";
import { CarteStat } from "@/components/stats";
import { dateCourte, montant, pluriel } from "@/lib/libelles";
import { seuilsFranchis, totaux } from "@/lib/valorisation";
import { contexteModule } from "@/server/module";
import { param } from "@/server/paging";
import {
  calculerValorisation,
  exerciceCourant,
  exercicesDisponibles,
  seuilsDe,
  valorisationsFigees,
} from "@/server/valorisation";

export const metadata = { title: "Valorisation des avantages en nature - CityRésa" };

/** Les avantages en nature par organisation et par exercice, seuils réglementaires, clôture. */
export default async function ValorisationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteModule("subventions", "subventions");
  const { user, csrf } = page;
  const params = await searchParams;
  const exercices = await exercicesDisponibles();
  const demande = Number(param(params, "exercice"));
  const exercice = exercices.includes(demande) ? demande : exerciceCourant();
  const [lignes, figees] = await Promise.all([
    calculerValorisation(exercice),
    valorisationsFigees(exercice),
  ]);
  const seuils = seuilsDe(user.settings);
  const t = totaux(lignes);
  const peutEditer = user.canEdit("subventions");
  const cloture = figees.size > 0;
  const derniere = [...figees.values()].sort(
    (a, b) => b.figeeAt.getTime() - a.figeeAt.getTime(),
  )[0];
  const alertes = lignes.filter(
    (l) => seuilsFranchis(l.total, seuils).convention && !l.conventionnee,
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Valorisation des avantages en nature <span className="page-count">{exercice}</span>
          </h1>
          <p className="page-subtitle">
            Pour chaque organisation, la valeur de référence des mises à disposition de l'exercice,
            la redevance due, l'avantage en nature qui en résulte et les subventions en numéraire ;
            seuils de convention obligatoire ({montant(seuils.convention)}) et de certification des
            comptes ({montant(seuils.certification)}).
          </p>
        </div>
        <div className="page-actions">
          <a
            href={`/valorisation/export.csv?exercice=${exercice}`}
            className="btn btn-outline-secondary btn-sm"
          >
            <Icone nom="download" taille={14} /> Annexe (CSV)
          </a>
          {peutEditer ? (
            <form method="POST" action="/valorisation/figer" className="d-inline">
              <input type="hidden" name="csrf_token" value={csrf} />
              <input type="hidden" name="exercice" value={exercice} />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                data-confirm={`${cloture ? "Refiger" : "Figer"} l'exercice ${exercice} : les montants de ${pluriel(lignes.length, "organisation", "organisations")} sont arrêtés et une attestation est déposée sur chaque fiche. Continuer ?`}
              >
                <Icone nom="stamp" taille={14} />{" "}
                {cloture
                  ? "Refiger et rééditer les attestations"
                  : "Figer l'exercice et déposer les attestations"}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <form
        method="GET"
        className="d-flex align-items-center gap-2 flex-wrap mb-3"
        data-auto-submit
        data-auto-submit-natif
      >
        <select
          name="exercice"
          className="form-select form-select-sm filtre-select"
          defaultValue={String(exercice)}
          aria-label="Exercice"
        >
          {exercices.map((y) => (
            <option key={y} value={y}>
              Exercice {y}
            </option>
          ))}
        </select>
        {cloture ? (
          <Chip teinte="emerald" titre={`Figé par ${derniere?.figeePar ?? "—"}`}>
            Montants arrêtés le {dateCourte(derniere?.figeeAt ?? new Date())}
          </Chip>
        ) : (
          <Chip teinte="amber">Calcul en direct, exercice non figé</Chip>
        )}
        <noscript>
          <button type="submit" className="btn btn-sm btn-outline-secondary">
            Afficher
          </button>
        </noscript>
      </form>

      {/* Les mêmes cartes de synthèse que sur le tableau de bord. */}
      <div className="stat-grid">
        <CarteStat
          icone="users"
          teinte="rose"
          label="Organisations aidées"
          valeur={t.organisations}
        />
        <CarteStat
          icone="clock"
          teinte="sky"
          label="Heures mises à disposition"
          valeur={`${t.heures.toLocaleString("fr-FR")} h`}
        />
        <CarteStat
          icone="handshake"
          teinte="lime"
          label="Avantages en nature"
          valeur={montant(t.avantage)}
        />
        <CarteStat
          icone="hand-coins"
          teinte="amber"
          label="Total des aides (avec subventions)"
          valeur={montant(t.total)}
        />
      </div>

      {alertes.length ? (
        <div className="alert alert-warning d-flex gap-2 align-items-start mb-3">
          <Icone nom="triangle-alert" taille={18} />
          <div>
            <strong>
              {pluriel(alertes.length, "association dépasse", "associations dépassent")}{" "}
              {montant(seuils.convention)} d'aides sans être conventionnée
            </strong>{" "}
            : {alertes.map((l) => l.nom).join(", ")}. Une convention d'objectifs est obligatoire ;
            cochez « conventionnée » sur la fiche de l'organisation une fois signée.
          </div>
        </div>
      ) : null}

      <div className="data-card">
        {lignes.length ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th className="text-end">Dossiers</th>
                  <th className="text-end">Heures</th>
                  <th className="text-end">Valeur de référence</th>
                  <th className="text-end">Redevance due</th>
                  <th className="text-end">Avantage en nature</th>
                  <th className="text-end">Subventions</th>
                  <th className="text-end">Total des aides</th>
                  <th>Seuils</th>
                  <th className="actions" />
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const f = seuilsFranchis(l.total, seuils);
                  const fig = figees.get(l.organisationId);
                  const ecart = fig && Math.abs(fig.total - l.total) >= 0.005;
                  return (
                    <tr key={l.organisationId}>
                      <td>
                        <a href={`/usagers/${l.organisationId}`} className="fw-medium">
                          {l.nom}
                        </a>
                        <div className="d-flex gap-1 flex-wrap mt-1">
                          <TypeOrganisation type={l.type} />
                          {l.conventionnee ? <Chip teinte="emerald">Conventionnée</Chip> : null}
                        </div>
                        {l.dossiers.length ? (
                          <details className="mt-1 small">
                            <summary className="text-muted" style={{ cursor: "pointer" }}>
                              {pluriel(l.dossiers.length, "dossier", "dossiers")}
                            </summary>
                            <ul className="list-unstyled mb-0 mt-1">
                              {l.dossiers.map((d) => (
                                <li key={d.reservationId}>
                                  <a href={`/reservations/${d.reservationId}`}>{d.numero}</a> ·{" "}
                                  {d.titre} · {d.espace} · {d.heures.toLocaleString("fr-FR")} h ·{" "}
                                  {montant(d.valeurReference)}
                                  {d.redevance ? ` − ${montant(d.redevance)} dus` : ""} →{" "}
                                  {montant(d.avantage)}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                      </td>
                      <td className="text-end">{l.nbDossiers}</td>
                      <td className="text-end text-nowrap">{l.heures.toLocaleString("fr-FR")} h</td>
                      <td className="text-end text-nowrap">{montant(l.valeurReference)}</td>
                      <td className="text-end text-nowrap">{montant(l.redevance)}</td>
                      <td className="text-end text-nowrap fw-medium">{montant(l.avantage)}</td>
                      <td className="text-end text-nowrap">{montant(l.subventions)}</td>
                      <td className="text-end text-nowrap fw-semibold">
                        {montant(l.total)}
                        {fig ? (
                          <div
                            className="small fw-normal text-muted"
                            title={`Arrêté le ${dateCourte(fig.figeeAt)}`}
                          >
                            figé : {montant(fig.total)}
                            {ecart ? <Chip teinte="amber">écart</Chip> : null}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {f.certification ? (
                          <Chip teinte="red">Comptes certifiés</Chip>
                        ) : f.convention ? (
                          <Chip teinte={l.conventionnee ? "sky" : "amber"}>
                            Convention obligatoire
                          </Chip>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="actions text-nowrap">
                        <a
                          href={`/valorisation/${l.organisationId}/attestation.pdf?exercice=${exercice}`}
                          className="btn btn-ghost btn-icone btn-sm"
                          target="_blank"
                          rel="noopener"
                          title="Attestation annuelle (PDF)"
                          aria-label="Attestation annuelle (PDF)"
                        >
                          <Icone nom="file-text" taille={14} />
                        </a>
                        {peutEditer ? (
                          <form
                            method="POST"
                            action={`/valorisation/${l.organisationId}/attestation`}
                            className="d-inline"
                          >
                            <input type="hidden" name="csrf_token" value={csrf} />
                            <input type="hidden" name="exercice" value={exercice} />
                            <button
                              type="submit"
                              className="btn btn-ghost btn-icone btn-sm"
                              title={
                                fig?.documentId
                                  ? "Rééditer l'attestation sur la fiche de l'organisation"
                                  : "Déposer l'attestation sur la fiche de l'organisation (visible sur le portail)"
                              }
                              aria-label="Déposer l'attestation"
                            >
                              <Icone nom="file-up" taille={14} />
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <VideBloc
            icone="handshake"
            titre={`Aucune aide sur l'exercice ${exercice}`}
            texte="Aucune mise à disposition acquise ni subvention votée pour cet exercice."
          />
        )}
      </div>
    </>
  );
}
