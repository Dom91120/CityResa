import { BoutonOuvrir, ModalAction } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Barre, Vide } from "@/components/liste";
import { Avatar, Chip } from "@/components/macros";
import { ROLE_LABELS, SECTEURS } from "@/lib/constantes";
import { depuis } from "@/lib/libelles";
import { collegue, libelleSecteur, rattachable } from "@/lib/secteurs";
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
      select: {
        id: true,
        name: true,
        secteur: true,
        site: { select: { id: true, name: true, position: true } },
      },
      orderBy: [
        { site: { position: "asc" } },
        { site: { name: "asc" } },
        { position: "asc" },
        { name: "asc" },
      ],
    }),
  ]);
  const libelleRole = Object.fromEntries(roles.map((r) => [r.name, r.label]));
  const rolesAdmin = new Set(roles.filter((r) => r.isAdmin).map((r) => r.name));
  const moi = page.user.secteur;
  // L'équipe : les collègues du même secteur et les agents transversaux, sans les
  // administrateurs (leurs comptes se gèrent dans Administration › Utilisateurs).
  const equipe = agents.filter((a) => !rolesAdmin.has(a.role) && collegue(moi, a.secteur));
  const enrichis = equipe.map((a) => ({
    ...a,
    nom: nomComplet(a),
    secteurNom: libelleSecteur(a.secteur),
  }));
  const rows = textSearch(enrichis, q, ["nom", "email", "fonction", "role", "secteurNom"]);
  const peutEditer = page.user.canEdit("equipe");
  /** Les espaces proposables à un agent : de son secteur, et de celui de qui répartit. */
  const espacesPour = (secteurAgent: string | null) => {
    const parSite = new Map<string, typeof espaces>();
    for (const e of espaces) {
      if (!rattachable(secteurAgent, e.secteur) || !rattachable(moi, e.secteur)) continue;
      const liste = parSite.get(e.site.name) ?? [];
      liste.push(e);
      parSite.set(e.site.name, liste);
    }
    return parSite;
  };
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Mon équipe <span className="page-count">{equipe.length}</span>
          </h1>
          <p className="page-subtitle">
            {moi
              ? `Les agents du secteur ${libelleSecteur(moi)} et les agents transversaux, avec les espaces dont chacun a la charge.`
              : "Les agents de la collectivité et les espaces dont chacun a la charge."}
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
        placeholder="Nom, courriel, fonction, secteur…"
      />
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 table-compacte">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Rôle</th>
                <th>Secteur</th>
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
                            <small
                              className="text-truncate"
                              style={{ maxWidth: 360 }}
                              title={a.fonction ?? undefined}
                            >
                              {a.fonction ?? ""}
                            </small>
                          </span>
                        </span>
                      </td>
                      <td>
                        <Chip teinte={a.role === "admin" ? "rose" : "sky"}>
                          {libelleRole[a.role] ?? ROLE_LABELS[a.role] ?? a.role}
                        </Chip>
                      </td>
                      <td>
                        {a.secteur ? (
                          <Chip teinte={SECTEURS[a.secteur]?.teinte ?? "slate"}>
                            {a.secteurNom}
                          </Chip>
                        ) : (
                          <span
                            className="text-faint small"
                            title="Aucun secteur : rattachable à tous les espaces"
                          >
                            Transversal
                          </span>
                        )}
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
                            title={
                              a.secteur
                                ? `Aucun rattachement : tous les espaces du secteur ${a.secteurNom}`
                                : "Aucun périmètre : tous les espaces"
                            }
                          >
                            {a.secteur ? `Tous · ${a.secteurNom}` : "Tous"}
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
                              classe="btn-ghost btn-sm"
                              sansTexte
                            />
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <Vide
                  colonnes={peutEditer ? 8 : 7}
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
            const parSite = espacesPour(a.secteur);
            return (
              <ModalAction
                key={a.id}
                id={`modal-espaces-${a.id}`}
                titre={`Espaces gérés par ${a.nom}`}
                action={`/equipe/${a.id}/espaces`}
                csrf={page.csrf}
                taille="lg"
                aide={
                  a.secteur
                    ? `Secteur ${a.secteurNom} : seuls ses espaces sont proposés. Aucune case cochée = l'agent voit et traite tous les espaces de ce secteur (selon son rôle).`
                    : "Agent transversal. Aucune case cochée = l'agent voit et traite tous les espaces (selon son rôle). Cochez des espaces pour restreindre son périmètre ou le notifier."
                }
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
                {parSite.size ? (
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
                  <p className="text-muted small">Aucun espace actif à proposer.</p>
                )}
              </ModalAction>
            );
          })
        : null}
    </>
  );
}
