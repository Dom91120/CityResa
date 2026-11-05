import { Icone } from "@/components/icones";
import { Barre, Filtre, PaginationBar, Vide } from "@/components/liste";
import { Chip } from "@/components/macros";
import type { Prisma } from "@/generated/prisma/client";
import { parseDate } from "@/lib/forms-util";
import { dateHeure, libelleAction } from "@/lib/libelles";
import { CATEGORIES_AUDIT, contexteAdmin, pageBase } from "@/modules/admin/server";
import { prisma } from "@/server/db";
import { param, resolvePerPage } from "@/server/paging";

export const metadata = { title: "Journal d'audit - CityRésa" };

const TEINTES: Record<string, string> = {
  securite: "red",
  utilisateurs: "violet",
  roles: "violet",
  parametres: "slate",
  usagers: "amber",
  reservations: "rose",
  paiements: "emerald",
  subventions: "lime",
  espaces: "sky",
  equipe: "sky",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteAdmin();
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const utilisateur = param(params, "utilisateur") ?? "";
  const categorie = param(params, "categorie") ?? "";
  const du = parseDate(param(params, "du"));
  const au = parseDate(param(params, "au"));
  const where: Prisma.ActionLogWhereInput = {
    ...(utilisateur ? { username: utilisateur } : {}),
    ...(categorie ? { category: categorie } : {}),
    ...(du || au
      ? {
          createdAt: {
            ...(du ? { gte: du } : {}),
            ...(au ? { lt: new Date(au.getTime() + 86_400_000) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" } },
            { detail: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const perPage = await resolvePerPage(params, page.user, "audit.list", 50);
  const total = await prisma.actionLog.count({ where });
  const { skip, take, p } = pageBase(params, total, perPage);
  const [rows, utilisateurs, categories] = await Promise.all([
    prisma.actionLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.actionLog.groupBy({ by: ["username"], orderBy: { username: "asc" } }),
    prisma.actionLog.groupBy({ by: ["category"], orderBy: { category: "asc" } }),
  ]);
  const hidden = { utilisateur, categorie, du: param(params, "du"), au: param(params, "au") };
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Journal d'audit <span className="page-count">{total}</span>
          </h1>
          <p className="page-subtitle">
            Qui a fait quoi, et quand. Les actions restent même après suppression de l'élément.
          </p>
        </div>
      </div>
      <Barre
        q={q}
        pathname={page.pathname}
        search={page.search}
        hidden={hidden}
        placeholder="Action, détail, utilisateur…"
        filtres={
          <>
            <Filtre
              name="utilisateur"
              value={utilisateur}
              options={utilisateurs.map((u) => [u.username, u.username])}
              blank="Tous les utilisateurs"
              ariaLabel="Utilisateur"
            />
            <Filtre
              name="categorie"
              value={categorie}
              options={categories
                .filter((c) => c.category)
                .map((c) => [
                  c.category as string,
                  CATEGORIES_AUDIT[c.category as string] ?? (c.category as string),
                ])}
              blank="Toutes les catégories"
              ariaLabel="Catégorie"
            />
            <input
              type="date"
              name="du"
              className="form-control form-control-sm"
              defaultValue={param(params, "du") ?? ""}
              aria-label="Du"
              style={{ width: 150 }}
            />
            <input
              type="date"
              name="au"
              className="form-control form-control-sm"
              defaultValue={param(params, "au") ?? ""}
              aria-label="Au"
              style={{ width: 150 }}
            />
            <button type="submit" className="btn btn-outline-secondary btn-sm">
              <Icone nom="filter" taille={13} /> Filtrer
            </button>
          </>
        }
      />
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Quand</th>
                <th>Utilisateur</th>
                <th>Catégorie</th>
                <th>Action</th>
                <th>Détail</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((l) => (
                  <tr key={l.id}>
                    <td className="small text-muted text-nowrap tabular">
                      {dateHeure(l.createdAt)}
                    </td>
                    <td className="small">{l.username}</td>
                    <td>
                      {l.category ? (
                        <Chip teinte={TEINTES[l.category] ?? "slate"}>
                          {CATEGORIES_AUDIT[l.category] ?? l.category}
                        </Chip>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="small fw-medium">{libelleAction(l.action)}</td>
                    <td
                      className="small text-muted"
                      style={{ maxWidth: 480, overflowWrap: "anywhere" }}
                    >
                      {l.detail ?? ""}
                    </td>
                  </tr>
                ))
              ) : (
                <Vide
                  colonnes={5}
                  icone="notebook-text"
                  message="Aucune action ne correspond à ces critères."
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
