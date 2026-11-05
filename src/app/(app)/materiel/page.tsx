import { Vignette } from "@/components/documents";
import { Icone } from "@/components/icones";
import { Barre, Filtre, PaginationBar, Th, trier, Vide } from "@/components/liste";
import { Chip } from "@/components/macros";
import { controleEnRetard } from "@/lib/materiel-stock";
import {
  categoriesMateriel,
  premieresPhotosMateriel,
  stockMobilise,
  tarifMateriel,
} from "@/modules/materiel/server";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";
import { type Params, paginate, param, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Matériel - CityRésa" };

export default async function MaterielPage({ searchParams }: { searchParams: Promise<Params> }) {
  const page = await contexteModule("materiel", "materiel");
  const params = await searchParams;
  const q = String(param(params, "q") ?? "").trim();
  const catF = String(param(params, "categorie") ?? "");
  const etat = String(param(params, "etat") ?? "");
  const [materiels, categories] = await Promise.all([
    prisma.materiel.findMany({ include: { categorie: true }, orderBy: { name: "asc" } }),
    categoriesMateriel(),
  ]);
  const mobilise = await stockMobilise(materiels.map((m) => m.id));
  let items = materiels.map((m) => {
    const mob = mobilise.get(m.id) ?? 0;
    return {
      ...m,
      categorieNom: m.categorie?.label ?? "",
      mobilise: mob,
      disponible: Math.max(0, m.stockTotal - m.horsService - mob),
      controleRetard: controleEnRetard(m),
      tarif: tarifMateriel(m),
    };
  });
  if (catF) items = items.filter((m) => String(m.categorieId ?? "") === catF);
  if (etat === "actifs") items = items.filter((m) => m.isActive);
  if (etat === "inactifs") items = items.filter((m) => !m.isActive);
  if (etat === "hors_service") items = items.filter((m) => m.horsService > 0);
  if (etat === "controle") items = items.filter((m) => m.controleRetard);
  items = textSearch(items, q, ["name", "categorieNom", "description"]);
  items = trier(
    items,
    page.search,
    {
      nom: (m) => m.name,
      categorie: (m) => m.categorieNom,
      stock: (m) => m.stockTotal,
      mobilise: (m) => m.mobilise,
      disponible: (m) => m.disponible,
      tarif: (m) => m.montant,
    },
    "nom",
  );
  const perPage = await resolvePerPage(params, page.user, "materiel.list");
  const [rows, p] = paginate(items, params, perPage);
  const vignettes = await premieresPhotosMateriel(rows.map((m) => m.id));
  const peutEditer = page.user.canEdit("materiel");
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Matériel <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">
            Tables, chaises, sono, barnums… mobilisables avec une réservation.
          </p>
        </div>
        <div className="page-actions">
          {peutEditer ? (
            <a href="/materiel/nouveau" className="btn btn-primary">
              <Icone nom="plus" taille={14} /> Nouveau matériel
            </a>
          ) : null}
        </div>
      </div>
      <Barre
        q={q}
        pathname={page.pathname}
        search={page.search}
        hidden={{ categorie: catF, etat }}
        placeholder="Nom, catégorie…"
        filtres={
          <>
            <Filtre
              name="categorie"
              value={catF}
              ariaLabel="Catégorie"
              blank="Toutes les catégories"
              options={categories.map((c) => [String(c.id), c.label])}
            />
            <Filtre
              name="etat"
              value={etat}
              ariaLabel="État"
              blank="Actifs et inactifs"
              options={[
                ["actifs", "Actifs"],
                ["inactifs", "Inactifs"],
                ["hors_service", "Avec unités hors service"],
                ["controle", "Contrôle en retard"],
              ]}
            />
          </>
        }
      />
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th style={{ width: 56 }} />
                <Th col="nom" label="Matériel" pathname={page.pathname} search={page.search} />
                <Th
                  col="categorie"
                  label="Catégorie"
                  pathname={page.pathname}
                  search={page.search}
                />
                <Th
                  col="stock"
                  label="Stock"
                  pathname={page.pathname}
                  search={page.search}
                  classes="text-end"
                />
                <Th
                  col="mobilise"
                  label="Mobilisé"
                  pathname={page.pathname}
                  search={page.search}
                  classes="text-end"
                />
                <Th
                  col="disponible"
                  label="Disponible"
                  pathname={page.pathname}
                  search={page.search}
                  classes="text-end"
                />
                <Th
                  col="tarif"
                  label="Tarification"
                  pathname={page.pathname}
                  search={page.search}
                />
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((m) => {
                  const photo = vignettes.get(m.id);
                  return (
                    <tr key={m.id} className={m.isActive ? "" : "text-muted"}>
                      <td>
                        <Vignette
                          photo={photo ? { id: photo } : null}
                          alt={m.name}
                          icone="package"
                        />
                      </td>
                      <td>
                        <span className="cell2">
                          <a
                            href={`/materiel/${m.id}`}
                            className="fw-medium"
                            style={{ color: "var(--strong)" }}
                          >
                            {m.name}
                          </a>
                          <small>{m.isActive ? (m.description ?? "") : "Inactif"}</small>
                        </span>
                      </td>
                      <td>{m.categorieNom || <span className="text-faint">—</span>}</td>
                      <td className="text-end tabular">
                        <span className="cell2">
                          <span>{m.stockTotal}</span>
                          {m.horsService ? (
                            <small className="text-danger">{m.horsService} hors service</small>
                          ) : null}
                          {m.controleRetard ? (
                            <small className="text-warning-emphasis">contrôle en retard</small>
                          ) : null}
                        </span>
                      </td>
                      <td className="text-end tabular">{m.mobilise}</td>
                      <td className="text-end tabular">
                        <Chip
                          teinte={
                            m.disponible === 0
                              ? "red"
                              : m.disponible < m.stockTotal
                                ? "amber"
                                : "emerald"
                          }
                        >
                          {m.disponible}
                        </Chip>
                      </td>
                      <td>{m.tarif}</td>
                      <td className="actions">
                        <div className="row-actions">
                          <a
                            href={`/materiel/${m.id}`}
                            className="btn btn-ghost btn-icone btn-sm"
                            title="Voir la fiche"
                            aria-label="Voir la fiche"
                          >
                            <Icone nom="eye" taille={14} />
                          </a>
                          {peutEditer ? (
                            <a
                              href={`/materiel/${m.id}/modifier`}
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
                  );
                })
              ) : (
                <Vide
                  colonnes={8}
                  message={
                    q || catF || etat
                      ? "Aucun matériel ne correspond à ces critères."
                      : "Aucun matériel pour l'instant."
                  }
                  urlAjout={peutEditer && !q && !catF && !etat ? "/materiel/nouveau" : null}
                  libelleAjout="Ajouter du matériel"
                  icone="package"
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
