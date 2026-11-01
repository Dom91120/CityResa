import { BoutonOuvrir, ModalAction } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Barre, Vide } from "@/components/liste";
import { Avatar, Chip } from "@/components/macros";
import { ROLE_LABELS } from "@/lib/constantes";
import { depuis } from "@/lib/libelles";
import { nomComplet } from "@/modules/utilisateurs/server";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";
import { textSearch } from "@/server/paging";

export const metadata = { title: "Mon équipe - CityRésa" };

const ROLES_ESPACE: [string, string][] = [
  ["gestionnaire", "Gestionnaire : décide sur les demandes"],
  ["lecteur", "Lecteur : consulte seulement"],
  ["notifie", "Notifié : reçoit les alertes"],
];

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteModule("equipe");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const [agents, roles, espaces] = await Promise.all([
    prisma.user.findMany({
      where: { kind: "agent" },
      include: {
        espaces: {
          include: {
            espace: {
              select: { id: true, name: true, shortName: true, site: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.role.findMany({ where: { isUsager: false } }),
    prisma.espace.findMany({
      where: { isActive: true },
      select: { id: true, name: true, site: { select: { id: true, name: true, position: true } } },
      orderBy: [
        { site: { position: "asc" } },
        { site: { name: "asc" } },
        { position: "asc" },
        { name: "asc" },
      ],
    }),
  ]);
  const libelleRole = Object.fromEntries(roles.map((r) => [r.name, r.label]));
  const enrichis = agents.map((a) => ({ ...a, nom: nomComplet(a) }));
  const rows = textSearch(enrichis, q, ["nom", "email", "fonction", "role"]);
  const peutEditer = page.user.canEdit("equipe");
  const parSite = new Map<string, typeof espaces>();
  for (const e of espaces) {
    const liste = parSite.get(e.site.name) ?? [];
    liste.push(e);
    parSite.set(e.site.name, liste);
  }
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Mon équipe <span className="page-count">{agents.length}</span>
          </h1>
          <p className="page-subtitle">
            Les agents de la collectivité et les espaces dont chacun a la charge.
          </p>
        </div>
        <div className="page-actions">
          {page.user.isAdmin ? (
            <a href="/utilisateurs/nouveau" className="btn btn-primary">
              <Icone nom="user-plus" taille={14} /> Inviter un agent
            </a>
          ) : null}
        </div>
      </div>
      <Barre
        q={q}
        pathname={page.pathname}
        search={page.search}
        placeholder="Nom, courriel, fonction…"
      />
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Rôle</th>
                <th>Espaces gérés</th>
                <th>Contact</th>
                <th>Dernière connexion</th>
                <th>Statut</th>
                {peutEditer ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((a) => {
                  const noms = a.espaces.map(
                    (g) => `${g.espace.name} (${g.espace.site.name}) · ${g.role}`,
                  );
                  return (
                    <tr key={a.id}>
                      <td>
                        <span className="d-flex align-items-center gap-2">
                          <Avatar nom={a.nom} taille="sm" agent />
                          <span className="cell2">
                            {page.user.isAdmin ? (
                              <a href={`/utilisateurs/${a.id}`}>
                                <strong>{a.nom}</strong>
                              </a>
                            ) : (
                              <strong>{a.nom}</strong>
                            )}
                            <small>{a.fonction ?? ""}</small>
                          </span>
                        </span>
                      </td>
                      <td>
                        <Chip teinte={a.role === "admin" ? "rose" : "sky"}>
                          {libelleRole[a.role] ?? ROLE_LABELS[a.role] ?? a.role}
                        </Chip>
                      </td>
                      <td>
                        {a.espaces.length ? (
                          <span className="chip chip-violet" title={noms.join("\n")}>
                            <Icone nom="door-open" taille={12} /> {a.espaces.length} espace
                            {a.espaces.length > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span
                            className="text-faint small"
                            title="Aucun périmètre : tous les espaces"
                          >
                            Tous
                          </span>
                        )}
                      </td>
                      <td className="small">
                        <span className="cell2">
                          <a href={`mailto:${a.email}`}>{a.email}</a>
                          {a.phone ? <small>{a.phone}</small> : null}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {a.lastLoginAt ? depuis(a.lastLoginAt) : "Jamais"}
                      </td>
                      <td>
                        {a.isActive ? (
                          <Chip teinte="emerald">Actif</Chip>
                        ) : (
                          <Chip teinte="slate">Inactif</Chip>
                        )}
                      </td>
                      {peutEditer ? (
                        <td>
                          <div className="row-actions">
                            <BoutonOuvrir
                              cible={`modal-espaces-${a.id}`}
                              libelle="Espaces gérés"
                              icone="door-open"
                              classe="btn-outline-secondary btn-sm"
                            />
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <Vide
                  colonnes={peutEditer ? 7 : 6}
                  icone="contact-round"
                  message={q ? "Aucun agent ne correspond." : "Aucun agent pour le moment."}
                  urlAjout={page.user.isAdmin && !q ? "/utilisateurs/nouveau" : null}
                  libelleAjout="Inviter un agent"
                />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {peutEditer
        ? rows.map((a) => {
            const coches = new Set(a.espaces.map((g) => g.espace.id));
            const roleActuel = a.espaces[0]?.role ?? "gestionnaire";
            return (
              <ModalAction
                key={a.id}
                id={`modal-espaces-${a.id}`}
                titre={`Espaces gérés par ${a.nom}`}
                action={`/equipe/${a.id}/espaces`}
                csrf={page.csrf}
                taille="lg"
                aide="Aucune case cochée = l'agent voit et traite tous les espaces (selon son rôle). Cochez des espaces pour restreindre son périmètre ou le notifier."
              >
                <div className="mb-3">
                  <label className="form-label" htmlFor={`role-${a.id}`}>
                    Rôle sur ces espaces
                  </label>
                  <select
                    name="role"
                    id={`role-${a.id}`}
                    className="form-select"
                    defaultValue={roleActuel}
                  >
                    {ROLES_ESPACE.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                {espaces.length ? (
                  [...parSite.entries()].map(([site, liste]) => (
                    <div key={site} className="mb-3">
                      <div className="form-label">{site}</div>
                      <div className="coches">
                        {liste.map((e) => (
                          <label key={e.id}>
                            <input
                              type="checkbox"
                              name="espace_id"
                              value={e.id}
                              defaultChecked={coches.has(e.id)}
                            />
                            {e.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted small">Aucun espace actif.</p>
                )}
              </ModalAction>
            );
          })
        : null}
    </>
  );
}
