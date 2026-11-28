import { Icone } from "@/components/icones";
import { Barre, PaginationBar, SegTabs, urlAvec, VideBloc } from "@/components/liste";
import { ScriptDiffere } from "@/components/scripts";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import { PERIODES } from "@/lib/periodes";
import { FiltreCases, FiltreChoix, FiltreEspaces, FiltreSites } from "@/modules/planning/filtres";
import { espacesDuPerimetre } from "@/modules/planning/server";
import {
  chargerListe,
  lireFiltres,
  ONGLETS,
  optionsFiltres,
  servicesRetenus,
  TRIS,
  TRIS_COURTS,
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
  const [{ rows, onglet, compteurs }, options, espaces] = await Promise.all([
    chargerListe(f, page.user),
    optionsFiltres(),
    espacesDuPerimetre(page.user, true),
  ]);
  /** La page sans l'un de ses filtres (et revenue à la première page). */
  const sans = (cle: string) => urlAvec(page.pathname, page.search, { [cle]: null, page: null });
  const tries = trierListe(rows, f, onglet);
  const perPage = await resolvePerPage(params, page.user, "reservations.list");
  const [lignes, p] = paginate(tries, params, perPage);
  const [triCol, triSens] = triDefaut(onglet);
  const triCourant = f.tri ? `${f.tri}:${f.sens || "asc"}` : `${triCol}:${triSens}`;
  const filtresActifs = Boolean(
    f.sites.length ||
      f.espaces.length ||
      f.types.length ||
      f.agents.length ||
      f.services.length ||
      f.periode,
  );
  const filtreServices = page.features.processus && options.services.length > 0;
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
              ? page.user.espacesVus.length
                ? "Les dossiers des espaces dont vous avez la charge."
                : "Les dossiers des espaces dont vous avez la charge ; « Tous les services » montre aussi, en lecture, ceux des autres espaces."
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

      {/* Onglets et barre de recherche sur une même ligne quand la place le permet. */}
      <div className="liste-entete">
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
            site: f.sites.map(String),
            espace: f.espaces.map(String),
            type: f.types,
            agent: f.agents,
            service: f.services,
            periode: f.periode,
            vue: f.vue === "table" ? "table" : null,
          }}
          filtres={
            <>
              {f.statut ? <input type="hidden" name="statut" value={f.statut} /> : null}
              {f.vue === "table" ? <input type="hidden" name="vue" value="table" /> : null}
              <FiltreSites sites={options.sites} choisis={f.sites} hrefTous={sans("site")} />
              <FiltreEspaces
                espaces={espaces}
                sites={f.sites}
                choisis={f.espaces}
                hrefTous={sans("espace")}
              />
              <FiltreCases
                name="type"
                icone="users"
                options={Object.entries(ORGANISATION_TYPES)}
                choisis={f.types}
                tous="Tous les types"
                plusieurs={(n) => `${n} types`}
                hrefTous={sans("type")}
              />
              {filtreServices ? (
                <FiltreCases
                  name="service"
                  icone="building-2"
                  options={options.services}
                  choisis={servicesRetenus(f, page.user) ?? []}
                  tous="Tous les services"
                  plusieurs={(n) => (f.services.length ? `${n} services` : "Mes services")}
                  hrefTous={urlAvec(page.pathname, page.search, {
                    service: page.user.fileDeTravail ? "tous" : null,
                    page: null,
                  })}
                />
              ) : null}
              <FiltreCases
                name="agent"
                icone="user-round"
                options={options.agents}
                choisis={f.agents}
                tous="Tous les agents"
                plusieurs={(n) => `${n} agents`}
                hrefTous={sans("agent")}
              />
              <FiltreChoix
                name="periode"
                icone="calendar-range"
                titre="Période"
                options={[["", "Toutes les dates"], ...PERIODES]}
                choisi={f.periode}
              />
              {f.vue === "cartes" ? (
                <FiltreChoix
                  name="tri"
                  icone="arrow-up-down"
                  titre="Trier par"
                  options={TRIS}
                  choisi={triCourant}
                  courts={TRIS_COURTS}
                />
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
      </div>

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
