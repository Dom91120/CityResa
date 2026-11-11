import { Vignette } from "@/components/documents";
import { MenuLien, MenuPost, MenuSep } from "@/components/fiche";
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
import { PastilleEspace } from "@/components/macros";
import { ESPACE_SECTEURS } from "@/lib/constantes";
import { aPartirDe } from "@/lib/tarification";
import { libellesProfils, premieresPhotos, referentielsEspaces } from "@/modules/espaces/server";
import {
  OuvertA,
  PastilleVisibilite,
  PileGestionnaires,
  StatutEspace,
} from "@/modules/espaces/vues";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";
import { type Params, paginate, param, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Espaces - CityRésa" };

function etatDe(e: { status: string; isActive: boolean }): string {
  if (!e.isActive || e.status === "inactif") return "inactifs";
  if (e.status === "maintenance") return "travaux";
  return "actifs";
}

export default async function EspacesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const page = await contexteModule("espaces");
  const params = await searchParams;
  const q = String(param(params, "q") ?? "").trim();
  const onglet = String(param(params, "etat") ?? "");
  const siteF = String(param(params, "site") ?? "");
  const natureF = String(param(params, "nature") ?? "");
  const secteurF = String(param(params, "secteur") ?? "");
  const [espaces, refs, sites] = await Promise.all([
    prisma.espace.findMany({
      include: {
        site: { select: { id: true, name: true } },
        nature: true,
        tarifs: true,
        gestionnaires: { include: { user: { select: { firstName: true, lastName: true } } } },
        parent: { select: { name: true } },
      },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    referentielsEspaces(),
    prisma.site.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  const libelles = libellesProfils(refs.profils);
  const compteurs = { tous: espaces.length, actifs: 0, travaux: 0, inactifs: 0 };
  for (const e of espaces) compteurs[etatDe(e) as "actifs" | "travaux" | "inactifs"] += 1;

  let items = espaces.map((e) => ({
    ...e,
    etat: etatDe(e),
    siteNom: e.site.name,
    natureNom: e.nature?.label ?? "",
    secteurNom: ESPACE_SECTEURS[e.secteur]?.label ?? e.secteur,
    capacite: e.capacityStanding ?? e.capacitySeated ?? null,
  }));
  if (onglet) items = items.filter((e) => e.etat === onglet);
  if (siteF) items = items.filter((e) => String(e.siteId) === siteF);
  if (natureF) items = items.filter((e) => String(e.natureId ?? "") === natureF);
  if (secteurF) items = items.filter((e) => e.secteur === secteurF);
  items = textSearch(items, q, ["name", "slug", "siteNom", "natureNom", "secteurNom", "floor"]);
  items = trier(
    items,
    page.search,
    {
      nom: (e) => e.name,
      nature: (e) => e.natureNom,
      capacite: (e) => e.capacite,
      site: (e) => e.siteNom,
      statut: (e) => e.etat,
      position: (e) => e.position,
    },
    "position",
  );
  const perPage = await resolvePerPage(params, page.user, "espaces.list");
  const [rows, p] = paginate(items, params, perPage);
  const vignettes = await premieresPhotos(rows.map((e) => e.id));
  const peutEditer = page.user.canEdit("espaces");
  const peutSupprimer = page.user.canDelete("espaces");
  const tab = (etat: string) =>
    urlAvec(page.pathname, page.search, { etat: etat || null, page: null });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Espaces <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">Salles, terrains, gymnases… tout ce qui se réserve.</p>
        </div>
        <div className="page-actions">
          <a href="/planning" className="btn btn-outline-secondary">
            <Icone nom="calendar-days" taille={14} /> Planning
          </a>
          {peutEditer ? (
            <a href="/espaces/nouveau" className="btn btn-primary">
              <Icone nom="plus" taille={14} /> Nouvel espace
            </a>
          ) : null}
        </div>
      </div>
      <SegTabs
        tabs={[
          { href: tab(""), label: "Tous", count: compteurs.tous, active: onglet === "" },
          {
            href: tab("actifs"),
            label: "Actifs",
            count: compteurs.actifs,
            active: onglet === "actifs",
          },
          {
            href: tab("travaux"),
            label: "En travaux",
            count: compteurs.travaux,
            active: onglet === "travaux",
            teinte: compteurs.travaux ? undefined : "muted",
          },
          {
            href: tab("inactifs"),
            label: "Inactifs",
            count: compteurs.inactifs,
            active: onglet === "inactifs",
            teinte: "muted",
          },
        ]}
      />
      <Barre
        q={q}
        pathname={page.pathname}
        search={page.search}
        hidden={{ etat: onglet, site: siteF, nature: natureF, secteur: secteurF }}
        placeholder="Nom, site, nature…"
        filtres={
          <>
            {onglet ? <input type="hidden" name="etat" value={onglet} /> : null}
            <Filtre
              name="site"
              value={siteF}
              ariaLabel="Site"
              blank="Tous les sites"
              options={sites.map((s) => [String(s.id), s.name])}
            />
            <Filtre
              name="nature"
              value={natureF}
              ariaLabel="Nature"
              blank="Toutes les natures"
              options={refs.natures.map((n) => [String(n.id), n.label])}
            />
            <Filtre
              name="secteur"
              value={secteurF}
              ariaLabel="Secteur"
              blank="Salles et sports"
              options={Object.entries(ESPACE_SECTEURS).map(([k, v]) => [k, v.label])}
            />
          </>
        }
      />
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 table-compacte">
            <thead>
              <tr>
                <th style={{ width: 56 }} />
                <Th col="nom" label="Espace" pathname={page.pathname} search={page.search} />
                <Th col="nature" label="Nature" pathname={page.pathname} search={page.search} />
                <Th
                  col="capacite"
                  label="Capacité"
                  pathname={page.pathname}
                  search={page.search}
                  classes="text-center"
                />
                <Th col="site" label="Site" pathname={page.pathname} search={page.search} />
                <th>Visibilité</th>
                <th>Ouvert à</th>
                <Th col="statut" label="Statut" pathname={page.pathname} search={page.search} />
                <th>
                  <abbr title="Gestionnaires" style={{ textDecoration: "none" }}>
                    Gest.
                  </abbr>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((e) => {
                  const photo = vignettes.get(e.id);
                  return (
                    <tr key={e.id}>
                      <td>
                        <Vignette photo={photo ? { id: photo } : null} alt={e.name} />
                      </td>
                      <td>
                        <span className="d-flex align-items-center gap-2 min-w-0">
                          <PastilleEspace couleur={e.color} />
                          <span className="cell2">
                            <a
                              href={`/espaces/${e.id}`}
                              className="fw-medium"
                              style={{ color: "var(--strong)" }}
                            >
                              {e.name}
                            </a>
                            <small>
                              {[
                                e.parent ? `sous-espace de ${e.parent.name}` : null,
                                aPartirDe(e.tarifs),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </span>
                        </span>
                      </td>
                      <td className="text-nowrap">
                        <span className="cell2">
                          {e.natureNom || <span className="text-faint">—</span>}
                          <small>{e.secteurNom}</small>
                        </span>
                      </td>
                      <td className="text-center tabular">
                        {e.capacite !== null ? (
                          <span title="Debout / assis">
                            {e.capacityStanding ?? "—"} / {e.capacitySeated ?? "—"}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="text-nowrap">
                        <a href={`/sites/${e.siteId}`}>{e.siteNom}</a>
                      </td>
                      <td>
                        <PastilleVisibilite isPublic={e.isPublic} />
                      </td>
                      <td className="text-nowrap">
                        <OuvertA allowedProfiles={e.allowedProfiles} libelles={libelles} resume />
                      </td>
                      <td>
                        <StatutEspace status={e.status} isActive={e.isActive} />
                      </td>
                      <td>
                        <PileGestionnaires gestionnaires={e.gestionnaires} />
                      </td>
                      <td className="actions">
                        <div className="dropdown">
                          <button
                            type="button"
                            className="menu-points"
                            data-bs-toggle="dropdown"
                            aria-expanded="false"
                            title="Actions"
                            aria-label={`Actions sur ${e.name}`}
                          >
                            <Icone nom="ellipsis" taille={16} />
                          </button>
                          <ul className="dropdown-menu dropdown-menu-end">
                            <MenuLien
                              url={`/espaces/${e.id}`}
                              libelle="Voir la fiche"
                              icone="eye"
                            />
                            <MenuLien
                              url={`/planning?espace=${e.id}`}
                              libelle="Voir au planning"
                              icone="calendar-days"
                            />
                            {peutEditer ? (
                              <MenuLien
                                url={`/espaces/${e.id}/modifier`}
                                libelle="Modifier"
                                icone="pencil"
                              />
                            ) : null}
                            {peutEditer ? (
                              <MenuLien
                                url={`/reservations/nouveau?espace=${e.id}`}
                                libelle="Nouvelle réservation"
                                icone="calendar-plus"
                              />
                            ) : null}
                            {peutSupprimer ? <MenuSep /> : null}
                            {peutSupprimer ? (
                              <MenuPost
                                url={`/espaces/${e.id}/supprimer`}
                                libelle="Supprimer"
                                icone="trash-2"
                                csrf={page.csrf}
                                danger
                                confirm={`Supprimer l'espace « ${e.name} » ? S'il a des réservations, il sera seulement désactivé.`}
                              />
                            ) : null}
                          </ul>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <Vide
                  colonnes={10}
                  message={
                    q || onglet || siteF || natureF || secteurF
                      ? "Aucun espace ne correspond à ces critères."
                      : "Aucun espace pour l'instant : créez le premier."
                  }
                  urlAjout={
                    peutEditer && !q && !onglet && !siteF && !natureF && !secteurF
                      ? "/espaces/nouveau"
                      : null
                  }
                  libelleAjout="Créer un espace"
                  icone="door-open"
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationBar p={p} pathname={page.pathname} search={page.search} />
    </>
  );
}
