import { Icone } from "@/components/icones";
import { Barre, Filtre, PaginationBar, SegTabs, urlAvec, VideBloc } from "@/components/liste";
import { ScriptDiffere } from "@/components/scripts";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import { PERIODES } from "@/lib/periodes";
import {
  chargerListe,
  lireFiltres,
  ONGLETS,
  optionsFiltres,
  TRIS,
  triDefaut,
  trierListe,
} from "@/modules/reservations/requetes";
import { CarteResa, TableResa } from "@/modules/reservations/vues";
import { contexteModule } from "@/server/module";
import { paginate, resolvePerPage } from "@/server/paging";

export const metadata = { title: "Réservations - CityRésa" };

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteModule("reservations");
  const params = await searchParams;
  const f = lireFiltres(params);
  const [{ rows, onglet, compteurs }, options] = await Promise.all([
    chargerListe(f, page.user),
    optionsFiltres(page.user),
  ]);
  const tries = trierListe(rows, f, onglet);
  const perPage = await resolvePerPage(params, page.user, "reservations.list");
  const [lignes, p] = paginate(tries, params, perPage);
  const [triCol, triSens] = triDefaut(onglet);
  const triCourant = f.tri ? `${f.tri}:${f.sens || "asc"}` : `${triCol}:${triSens}`;
  const filtresActifs = Boolean(f.site || f.espace || f.type || f.agent || f.periode);
  const exportUrl = `/reservations/export.csv${page.search.toString() ? `?${page.search.toString()}` : ""}`;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Réservations <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">
            {page.user.espacesGeres.length
              ? "Les dossiers des espaces dont vous avez la charge."
              : "Toutes les demandes et réservations d'espaces."}
            {compteurs.a_traiter
              ? ` ${compteurs.a_traiter} demande${compteurs.a_traiter > 1 ? "s" : ""} à traiter.`
              : ""}
          </p>
        </div>
        <div className="page-actions">
          <a href={exportUrl} className="btn btn-outline-secondary btn-sm">
            <Icone nom="download" taille={14} /> Exporter
          </a>
          <a href="/planning" className="btn btn-outline-secondary btn-sm">
            <Icone nom="calendar-days" taille={14} /> Planning
          </a>
          {page.user.canEdit("reservations") ? (
            <a href="/reservations/nouvelle" className="btn btn-primary btn-sm">
              <Icone nom="plus" taille={14} /> Nouvelle réservation
            </a>
          ) : null}
        </div>
      </div>

      <SegTabs
        tabs={ONGLETS.map((o) => ({
          href: urlAvec(page.pathname, page.search, { statut: o.cle || null, page: null }),
          label: o.label,
          count: compteurs[o.cle] ?? 0,
          active: onglet.cle === o.cle,
          teinte: o.compteur ? undefined : "muted",
        }))}
      />

      <Barre
        q={f.q}
        pathname={page.pathname}
        search={page.search}
        placeholder="Numéro, titre, organisation, demandeur…"
        hidden={{
          statut: f.statut,
          site: f.site ? String(f.site) : null,
          espace: f.espace ? String(f.espace) : null,
          type: f.type,
          agent: f.agent,
          periode: f.periode,
          vue: f.vue === "table" ? "table" : null,
        }}
        filtres={
          <>
            {f.statut ? <input type="hidden" name="statut" value={f.statut} /> : null}
            {f.vue === "table" ? <input type="hidden" name="vue" value="table" /> : null}
            <Filtre
              name="site"
              value={f.site ? String(f.site) : ""}
              options={options.sites}
              blank="Tous les sites"
              ariaLabel="Site"
            />
            <Filtre
              name="espace"
              value={f.espace ? String(f.espace) : ""}
              options={options.espaces}
              blank="Tous les espaces"
              ariaLabel="Espace"
            />
            <Filtre
              name="type"
              value={f.type}
              options={Object.entries(ORGANISATION_TYPES)}
              blank="Tous les types d'usager"
              ariaLabel="Type d'organisation"
            />
            <Filtre
              name="agent"
              value={f.agent}
              options={options.agents}
              blank="Tous les agents"
              ariaLabel="Agent assigné"
            />
            <Filtre
              name="periode"
              value={f.periode}
              options={PERIODES}
              blank="Toutes les dates"
              ariaLabel="Période"
            />
            {f.vue === "cartes" ? (
              <select
                name="tri"
                className="form-select form-select-sm filtre-select"
                defaultValue={triCourant}
                aria-label="Trier par"
              >
                {TRIS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        }
        droite={
          <div className="btn-group" role="group" aria-label="Affichage">
            <a
              href={urlAvec(page.pathname, page.search, { vue: null, page: null })}
              className={`btn btn-sm btn-outline-secondary btn-icone${f.vue === "cartes" ? " active" : ""}`}
              title="Cartes"
              aria-label="Affichage en cartes"
            >
              <Icone nom="layout-dashboard" taille={14} />
            </a>
            <a
              href={urlAvec(page.pathname, page.search, { vue: "table", page: null })}
              className={`btn btn-sm btn-outline-secondary btn-icone${f.vue === "table" ? " active" : ""}`}
              title="Tableau"
              aria-label="Affichage en tableau"
            >
              <Icone nom="table" taille={14} />
            </a>
          </div>
        }
      />

      {filtresActifs ? (
        <p className="small text-muted mb-3">
          Filtres actifs ·{" "}
          <a
            href={urlAvec(page.pathname, new URLSearchParams(), {
              statut: f.statut || null,
              q: f.q || null,
              vue: f.vue === "table" ? "table" : null,
            })}
          >
            Réinitialiser
          </a>
        </p>
      ) : null}

      <div className="data-card">
        {lignes.length === 0 ? (
          <VideBloc
            icone={onglet.cle === "a_traiter" ? "circle-check" : "clipboard-list"}
            titre={
              f.q || filtresActifs
                ? "Aucun dossier ne correspond à ces critères"
                : onglet.cle === "a_traiter"
                  ? "Aucune demande en attente : tout est traité."
                  : "Aucune réservation ici pour l'instant"
            }
            texte={
              f.q || filtresActifs
                ? "Élargissez la recherche ou retirez un filtre."
                : "Les demandes déposées sur le portail et les réservations saisies par les agents apparaîtront ici."
            }
            action={
              page.user.canEdit("reservations") && !f.q && !filtresActifs ? (
                <a href="/reservations/nouvelle" className="btn btn-primary btn-sm">
                  <Icone nom="plus" taille={14} /> Saisir une réservation
                </a>
              ) : null
            }
          />
        ) : f.vue === "table" ? (
          <TableResa rows={lignes} pathname={page.pathname} search={page.search} />
        ) : (
          lignes.map((r) => <CarteResa key={r.id} r={r} />)
        )}
      </div>
      <PaginationBar p={p} pathname={page.pathname} search={page.search} />
      <ScriptDiffere src="/js/reservations.js" nonce={page.nonce} />
    </>
  );
}
