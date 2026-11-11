import { ModalAction } from "@/components/fiche";
import { Champ, Grille } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import { CATEGORY_LABELS, PERMISSION_CATEGORIES, PERMISSION_LEVELS } from "@/lib/constantes";
import { contexteAdmin } from "@/modules/admin/server";
import { prisma } from "@/server/db";

export const metadata = { title: "Rôles et permissions - CityRésa" };

const TEINTES_NIVEAU: Record<number, string> = { 0: "slate", 1: "sky", 2: "emerald", 3: "rose" };

export default async function RolesPage() {
  const page = await contexteAdmin();
  const [roles, comptes] = await Promise.all([
    prisma.role.findMany({ orderBy: { id: "asc" } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);
  const nbParRole = Object.fromEntries(comptes.map((c) => [c.role, c._count._all]));
  const niveaux = Object.entries(PERMISSION_LEVELS).map(([v, l]) => [v, l] as [string, string]);
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Rôles &amp; permissions <span className="page-count">{roles.length}</span>
          </h1>
          <p className="page-subtitle">
            Pour chaque rôle, le niveau d'accès par domaine : aucun, lecture, écriture ou
            suppression (les niveaux sont cumulatifs).
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            data-bs-toggle="modal"
            data-bs-target="#modal-role"
          >
            <Icone nom="plus" taille={14} /> Nouveau rôle
          </button>
        </div>
      </div>

      <div className="astuce mb-3">
        <Icone nom="info" taille={16} />
        <span>
          Les rôles <strong>Administrateur</strong> (accès total, Paramètres et Utilisateurs
          compris) et <strong>Usager</strong> (portail) sont fixes. Un agent perd un domaine entier
          quand le module correspondant est désactivé dans Paramètres.
        </span>
      </div>

      <div className="data-card">
        <div className="table-responsive">
          <table className="table align-middle mb-0 table-compacte table-roles">
            <thead>
              <tr>
                <th>Rôle</th>
                {PERMISSION_CATEGORIES.map((c) => (
                  <th key={c} className="text-center small col-niveau">
                    {CATEGORY_LABELS[c]}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const perms = (r.permissions as Record<string, number> | null) ?? {};
                const fige = r.isAdmin || r.isUsager;
                const formId = `form-role-${r.id}`;
                const nb = nbParRole[r.name] ?? 0;
                return (
                  <tr key={r.id}>
                    <td className="col-role">
                      <span className="cell2">
                        <strong>
                          {r.label}
                          {r.isAdmin ? (
                            <Chip teinte="rose" classes="ms-2">
                              Admin
                            </Chip>
                          ) : r.isUsager ? (
                            <Chip teinte="amber" classes="ms-2">
                              Portail
                            </Chip>
                          ) : null}
                        </strong>
                        <small title={r.description ?? undefined}>
                          {nb} compte{nb > 1 ? "s" : ""}
                          {r.description ? ` · ${r.description}` : ""}
                        </small>
                      </span>
                    </td>
                    {PERMISSION_CATEGORIES.map((c) => {
                      const niveau = r.isAdmin ? 3 : r.isUsager ? 0 : Number(perms[c] ?? 0) || 0;
                      return (
                        <td key={c} className="text-center col-niveau">
                          {fige ? (
                            <Chip teinte={TEINTES_NIVEAU[niveau]}>{PERMISSION_LEVELS[niveau]}</Chip>
                          ) : (
                            <select
                              name={`perm_${c}`}
                              form={formId}
                              className="form-select form-select-sm"
                              defaultValue={String(niveau)}
                              aria-label={`${r.label} · ${CATEGORY_LABELS[c]}`}
                            >
                              {niveaux.map(([v, l]) => (
                                <option key={v} value={v}>
                                  {l}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      {fige ? null : (
                        <div className="row-actions">
                          <button
                            type="submit"
                            form={formId}
                            name="action"
                            value="enregistrer"
                            className="btn btn-ghost btn-icone btn-sm"
                            title={`Enregistrer les droits du rôle ${r.label}`}
                            aria-label={`Enregistrer les droits du rôle ${r.label}`}
                          >
                            <Icone nom="check" taille={16} />
                          </button>
                          {nb === 0 ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                              title="Supprimer ce rôle"
                              aria-label="Supprimer ce rôle"
                              data-confirm={`Supprimer le rôle « ${r.label} » ?`}
                              data-confirm-form={`#form-role-sup-${r.id}`}
                            >
                              <Icone nom="trash-2" taille={13} />
                            </button>
                          ) : (
                            // Même place que la corbeille : les boutons d'enregistrement restent alignés.
                            <span
                              className="btn btn-ghost btn-icone btn-sm invisible"
                              aria-hidden="true"
                            >
                              <Icone nom="trash-2" taille={13} />
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {roles
        .filter((r) => !r.isAdmin && !r.isUsager)
        .map((r) => (
          <div key={r.id}>
            <form
              method="POST"
              action={`/roles/${r.id}`}
              id={`form-role-${r.id}`}
              className="d-none"
              aria-hidden="true"
            >
              <input type="hidden" name="csrf_token" value={page.csrf} />
            </form>
            <form
              method="POST"
              action={`/roles/${r.id}`}
              id={`form-role-sup-${r.id}`}
              className="d-none"
              aria-hidden="true"
            >
              <input type="hidden" name="csrf_token" value={page.csrf} />
              <input type="hidden" name="action" value="supprimer" />
            </form>
          </div>
        ))}

      <ModalAction
        id="modal-role"
        titre="Nouveau rôle"
        action="/roles"
        csrf={page.csrf}
        bouton="Créer le rôle"
        icone="plus"
        aide="Le nom technique est unique et sans espace (ex. « accueil ») ; le libellé est celui affiché. Les permissions se règlent ensuite dans le tableau."
      >
        <input type="hidden" name="action" value="creer" />
        <Grille colonnes={2}>
          <Champ
            label="Nom technique"
            name="name"
            id="r-name"
            requis
            placeholder="accueil"
            attrs={{ pattern: "[a-z0-9_-]{2,40}", maxLength: 40 }}
            aide="Minuscules, chiffres, tirets."
          />
          <Champ label="Libellé" name="label" id="r-label" requis placeholder="Agent d'accueil" />
          <Champ
            label="Description"
            name="description"
            id="r-desc"
            pleine
            placeholder="Ce que ce rôle peut faire"
          />
        </Grille>
      </ModalAction>
    </>
  );
}
