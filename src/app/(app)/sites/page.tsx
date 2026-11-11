import { Vignette } from "@/components/documents";
import { Icone } from "@/components/icones";
import { Barre, Filtre, PaginationBar, Th, trier, Vide } from "@/components/liste";
import { Chip } from "@/components/macros";
import { siteVisible } from "@/lib/secteurs";
import { adresseComplete, premieresPhotosSites } from "@/modules/sites/server";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";
import { type Params, paginate, param, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Sites - CityRésa" };

export default async function SitesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const page = await contexteModule("espaces");
  const params = await searchParams;
  const q = String(param(params, "q") ?? "").trim();
  const etat = String(param(params, "etat") ?? "");
  const tous = await prisma.site.findMany({
    include: { espaces: { select: { id: true } } },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  // Un agent voit les sites qui portent au moins un espace de son périmètre (ou aucun espace),
  // et n'y compte que ses espaces.
  const perimetre = page.user.espacesGeres;
  let items = tous
    .filter((s) =>
      siteVisible(
        perimetre,
        s.espaces.map((e) => e.id),
      ),
    )
    .map((s) => ({
      ...s,
      adresse: adresseComplete(s),
      nbEspaces: s.espaces.filter((e) => page.user.voitEspace(e.id)).length,
    }));
  if (etat === "actifs") items = items.filter((s) => s.isActive);
  if (etat === "inactifs") items = items.filter((s) => !s.isActive);
  items = textSearch(items, q, ["name", "adresse", "city", "slug"]);
  items = trier(
    items,
    page.search,
    {
      nom: (s) => s.name,
      ville: (s) => s.city,
      espaces: (s) => s.nbEspaces,
      position: (s) => s.position,
      actif: (s) => (s.isActive ? 0 : 1),
    },
    "position",
  );
  const perPage = await resolvePerPage(params, page.user, "sites.list");
  const [rows, p] = paginate(items, params, perPage);
  const vignettes = await premieresPhotosSites(rows.map((s) => s.id));
  const peutEditer = page.user.canEdit("espaces");
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Sites <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">
            Les lieux (bâtiments, complexes, parcs) qui regroupent les espaces.
          </p>
        </div>
        <div className="page-actions">
          {peutEditer ? (
            <a href="/sites/nouveau" className="btn btn-primary">
              <Icone nom="plus" taille={14} /> Nouveau site
            </a>
          ) : null}
        </div>
      </div>
      <Barre
        q={q}
        pathname={page.pathname}
        search={page.search}
        placeholder="Nom, adresse, ville…"
        filtres={
          <Filtre
            name="etat"
            value={etat}
            ariaLabel="État"
            blank="Tous les états"
            options={[
              ["actifs", "Actifs"],
              ["inactifs", "Inactifs"],
            ]}
          />
        }
      />
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th />
                <Th col="nom" label="Site" pathname={page.pathname} search={page.search} />
                <Th col="ville" label="Adresse" pathname={page.pathname} search={page.search} />
                <Th
                  col="espaces"
                  label="Espaces"
                  pathname={page.pathname}
                  search={page.search}
                  classes="text-end"
                />
                <Th col="actif" label="État" pathname={page.pathname} search={page.search} />
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((s) => (
                  <tr key={s.id}>
                    <td style={{ width: 56 }}>
                      <Vignette
                        photo={vignettes.has(s.id) ? { id: vignettes.get(s.id) as number } : null}
                        alt={s.name}
                      />
                    </td>
                    <td>
                      <span className="cell2">
                        <a
                          href={`/sites/${s.id}`}
                          className="fw-medium"
                          style={{ color: "var(--strong)" }}
                        >
                          {s.name}
                        </a>
                        <small>{s.slug}</small>
                      </span>
                    </td>
                    <td>
                      <span className="cell2">
                        <span>{s.address ?? <span className="text-faint">—</span>}</span>
                        <small>{[s.postalCode, s.city].filter(Boolean).join(" ")}</small>
                      </span>
                    </td>
                    <td className="text-end tabular">
                      <a href={`/espaces?site=${s.id}`}>{s.nbEspaces}</a>
                    </td>
                    <td>
                      {s.isActive ? (
                        <Chip teinte="emerald">Actif</Chip>
                      ) : (
                        <Chip teinte="slate">Inactif</Chip>
                      )}
                    </td>
                    <td className="actions">
                      <div className="row-actions">
                        <a
                          href={`/sites/${s.id}`}
                          className="btn btn-ghost btn-icone btn-sm"
                          title="Voir la fiche"
                          aria-label="Voir la fiche"
                        >
                          <Icone nom="eye" taille={14} />
                        </a>
                        {peutEditer ? (
                          <a
                            href={`/sites/${s.id}/modifier`}
                            className="btn btn-ghost btn-icone btn-sm"
                            title="Modifier"
                            aria-label="Modifier"
                          >
                            <Icone nom="pencil" taille={14} />
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <Vide
                  colonnes={6}
                  message={
                    q || etat
                      ? "Aucun site ne correspond à cette recherche."
                      : "Aucun site pour l'instant : créez le premier lieu, puis ses espaces."
                  }
                  urlAjout={peutEditer && !q && !etat ? "/sites/nouveau" : null}
                  libelleAjout="Créer un site"
                  icone="map-pin"
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
