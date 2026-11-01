import { Icone } from "@/components/icones";
import {
  Barre,
  Filtre,
  PaginationBar,
  SegTabs,
  Th,
  trier,
  urlAvec,
  Vide,
} from "@/components/liste";
import { StatutSubvention } from "@/components/macros";
import { SUBVENTION_TYPES } from "@/lib/constantes";
import { dateCourte, montant } from "@/lib/libelles";
import {
  chargerSubventions,
  compterOnglets,
  estModifiable,
  exercicesDe,
  filtrerSubventions,
  lireFiltres,
  ONGLETS_SUBVENTIONS,
  organisationsDe,
  syntheseExercice,
} from "@/modules/subventions/server";
import { CartesExercice, CompteurAvis, TypeSubvention } from "@/modules/subventions/vues";
import { contexteModule } from "@/server/module";
import { type Params, paginate, resolvePerPage } from "@/server/paging";

export const metadata = { title: "Subventions - CityRésa" };

export default async function SubventionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const page = await contexteModule("subventions", "subventions");
  const params = await searchParams;
  const fl = lireFiltres(params);
  const toutes = await chargerSubventions();
  const exercices = exercicesDe(toutes);
  // Les cartes portent sur l'exercice choisi, sinon le plus récent qui a des dossiers.
  const exerciceCartes =
    fl.exercice ?? (toutes.length ? Math.max(...toutes.map((s) => s.exercice)) : exercices[0]);
  const synth = syntheseExercice(toutes, exerciceCartes);
  const onglets = compterOnglets(toutes, fl);
  const filtrees = filtrerSubventions(toutes, fl);
  const triees = trier(
    filtrees,
    page.search,
    {
      numero: (s) => s.numero,
      organisation: (s) => s.organisation.name,
      exercice: (s) => s.exercice,
      type: (s) => SUBVENTION_TYPES[s.type] ?? s.type,
      objet: (s) => s.objet,
      demande: (s) => s.montantDemande,
      accorde: (s) => s.montantAccorde,
      statut: (s) => s.status,
      date: (s) => s.createdAt,
    },
    "date",
    "desc",
  );
  const perPage = await resolvePerPage(params, page.user, "subventions.list");
  const [rows, pg] = paginate(triees, params, perPage);
  const peutEditer = page.user.canEdit("subventions");
  const th = (col: string, label: string, classes = "") => (
    <Th col={col} label={label} pathname={page.pathname} search={page.search} classes={classes} />
  );
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Subventions <span className="page-count">{pg.total}</span>
          </h1>
          <p className="page-subtitle">
            Demandes de subvention des associations : instruction, avis des élus, vote, versement.
          </p>
        </div>
        <div className="page-actions">
          <a
            href={`/subventions/export.csv?exercice=${exerciceCartes}`}
            className="btn btn-outline-secondary btn-sm"
          >
            <Icone nom="download" taille={14} /> Export {exerciceCartes}
          </a>
          {peutEditer ? (
            <a href="/subventions/nouvelle" className="btn btn-primary btn-sm">
              <Icone nom="plus" taille={14} /> Déposer une demande
            </a>
          ) : null}
        </div>
      </div>

      <CartesExercice s={synth} base="/subventions" />

      <SegTabs
        tabs={ONGLETS_SUBVENTIONS.map(([cle, label]) => ({
          href: urlAvec(page.pathname, page.search, { statut: cle || null, page: null }),
          label,
          count: onglets[cle],
          active: fl.statut === cle,
          teinte: ["deposee", "instruction", "avis"].includes(cle) ? undefined : "muted",
        }))}
      />

      <Barre
        q={fl.q}
        pathname={page.pathname}
        search={page.search}
        placeholder="Numéro, association, objet…"
        hidden={{
          statut: fl.statut,
          exercice: fl.exercice ? String(fl.exercice) : null,
          type: fl.type,
          organisation: fl.organisation ? String(fl.organisation) : null,
        }}
        filtres={
          <>
            {fl.statut ? <input type="hidden" name="statut" value={fl.statut} /> : null}
            <Filtre
              name="exercice"
              value={fl.exercice ? String(fl.exercice) : ""}
              options={exercices.map((e) => [String(e), `Exercice ${e}`])}
              blank="Tous les exercices"
              ariaLabel="Exercice"
            />
            <Filtre
              name="type"
              value={fl.type}
              options={Object.entries(SUBVENTION_TYPES)}
              blank="Tous les types"
              ariaLabel="Type de subvention"
            />
            <Filtre
              name="organisation"
              value={fl.organisation ? String(fl.organisation) : ""}
              options={organisationsDe(toutes)}
              blank="Toutes les associations"
              ariaLabel="Association"
            />
            <button type="submit" className="btn btn-outline-secondary btn-sm">
              <Icone nom="filter" taille={14} /> Filtrer
            </button>
          </>
        }
      />

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                {th("numero", "Numéro")}
                {th("organisation", "Association")}
                {th("exercice", "Exercice")}
                {th("type", "Type")}
                {th("objet", "Objet")}
                {th("demande", "Demandé", "text-end")}
                {th("accorde", "Accordé", "text-end")}
                {th("statut", "Statut")}
                <th>Avis</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="cell2">
                        <a
                          href={`/subventions/${s.id}`}
                          className="fw-medium"
                          style={{ color: "var(--strong)" }}
                        >
                          {s.numero}
                        </a>
                        <small>déposée le {dateCourte(s.createdAt)}</small>
                      </span>
                    </td>
                    <td>
                      <a href={`/usagers/${s.organisation.id}`}>{s.organisation.name}</a>
                    </td>
                    <td className="tabular">{s.exercice}</td>
                    <td>
                      <TypeSubvention type={s.type} />
                    </td>
                    <td>
                      <span className="cell2" style={{ maxWidth: 280 }}>
                        <span title={s.objet}>{s.objet}</span>
                        {s.beneficiaires ? <small>{s.beneficiaires} bénéficiaires</small> : null}
                      </span>
                    </td>
                    <td className="text-end tabular">{montant(s.montantDemande)}</td>
                    <td className="text-end tabular fw-medium">
                      {s.montantAccorde !== null ? (
                        montant(s.montantAccorde)
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td>
                      <StatutSubvention status={s.status} />
                    </td>
                    <td>
                      <CompteurAvis avis={s.avis} />
                    </td>
                    <td className="actions">
                      <span className="row-actions">
                        <a
                          href={`/subventions/${s.id}`}
                          className="btn btn-ghost btn-icone btn-sm"
                          title="Ouvrir"
                          aria-label="Ouvrir"
                        >
                          <Icone nom="eye" taille={14} />
                        </a>
                        {peutEditer && estModifiable(s) ? (
                          <a
                            href={`/subventions/${s.id}/modifier`}
                            className="btn btn-ghost btn-icone btn-sm"
                            title="Modifier"
                            aria-label="Modifier"
                          >
                            <Icone nom="pencil" taille={14} />
                          </a>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <Vide
                  colonnes={10}
                  icone="hand-coins"
                  message={
                    fl.q || fl.type || fl.organisation || fl.exercice
                      ? "Aucune demande ne correspond à ces critères."
                      : fl.statut
                        ? "Aucune demande dans cet état."
                        : "Aucune demande de subvention : déposez la première pour une association."
                  }
                  urlAjout={peutEditer && !fl.q ? "/subventions/nouvelle" : null}
                  libelleAjout="Déposer une demande"
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationBar p={pg} pathname={page.pathname} search={page.search} />
    </>
  );
}
