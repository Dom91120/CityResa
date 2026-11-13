import { BoutonOuvrir, ModalAction } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Barre, PaginationBar, SegTabs, Th, trier, urlAvec, Vide } from "@/components/liste";
import { Avatar, Chip } from "@/components/macros";
import { ROLE_LABELS, SECTEURS } from "@/lib/constantes";
import { depuis } from "@/lib/libelles";
import { collegue, libelleSecteur, rattachable } from "@/lib/secteurs";
import { nomComplet } from "@/modules/utilisateurs/server";
import { prisma } from "@/server/db";
import type { Page } from "@/server/page";
import { paginate, param, resolvePerPage, textSearch } from "@/server/paging";

const ROLES_ESPACE: [string, string][] = [
  ["gestionnaire", "Gestionnaire : décide sur les demandes"],
  ["lecteur", "Lecteur : consulte seulement"],
  ["notifie", "Notifié : reçoit les alertes"],
];

/**
 * La liste des comptes du back-office, sous deux formes :
 * - « Comptes » (Administration) : tous les comptes, la sécurité, la fiche et la création ;
 * - « Mon équipe » (Général) : les collègues du même secteur et les transversaux, sans les
 *   administrateurs, pour répartir les espaces.
 */
export async function ListeComptes({
  page,
  params,
  admin,
}: {
  page: Page;
  params: Record<string, string | string[] | undefined>;
  admin: boolean;
}) {
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
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
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
  // Un administrateur voit tous les agents. Les autres voient leur équipe : les collègues du
  // même secteur et les agents transversaux, sans les administrateurs.
  const equipe = admin
    ? agents
    : agents.filter((a) => !rolesAdmin.has(a.role) && collegue(moi, a.secteur));
  const vue = param(params, "vue") === "inactifs" ? "inactifs" : "actifs";
  const actifs = equipe.filter((a) => a.isActive);
  const inactifs = equipe.filter((a) => !a.isActive);
  const enrichis = (vue === "inactifs" ? inactifs : actifs).map((a) => ({
    ...a,
    nom: nomComplet(a),
    roleNom: libelleRole[a.role] ?? ROLE_LABELS[a.role] ?? a.role,
    secteurNom: libelleSecteur(a.secteur),
  }));
  const filtres = textSearch(enrichis, q, ["nom", "email", "fonction", "roleNom", "secteurNom"]);
  const tries = trier(
    filtres,
    page.search,
    {
      nom: (a) => `${a.lastName} ${a.firstName}`,
      role: (a) => a.roleNom,
      secteur: (a) => a.secteurNom,
      connexion: (a) => a.lastLoginAt,
    },
    "nom",
  );
  const perPage = await resolvePerPage(params, page.user, "equipe.list");
  const [rows, p] = paginate(tries, params, perPage);
  const peutEditer = page.user.canEdit("equipe");
  const colonnes = 6 + (admin ? 1 : 0) + (peutEditer ? 1 : 0);
  const tabs = (
    [
      ["actifs", "Actifs", actifs.length],
      ["inactifs", "Inactifs", inactifs.length],
    ] as const
  ).map(([k, label, n]) => ({
    href: urlAvec(page.pathname, page.search, { vue: k === "actifs" ? null : k, page: null }),
    label,
    count: n,
    teinte: "muted",
    active: vue === k,
  }));
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
            {admin ? "Comptes" : "Mon équipe"} <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">
            {admin
              ? "Les comptes du back-office : rôle, secteur, sécurité et espaces dont chacun a la charge. Les comptes des usagers se gèrent depuis la fiche de leur organisation."
              : moi
                ? `Les agents du secteur ${libelleSecteur(moi)} et les agents transversaux, avec les espaces dont chacun a la charge.`
                : "Les agents de la collectivité et les espaces dont chacun a la charge."}
          </p>
        </div>
        <div className="page-actions">
          {admin ? (
            <>
              <a href="/roles" className="btn btn-outline-secondary">
                <Icone nom="shield" taille={14} /> Rôles
              </a>
              <a href="/utilisateurs/nouveau" className="btn btn-primary">
                <Icone nom="user-plus" taille={14} /> Nouveau compte
              </a>
            </>
          ) : null}
        </div>
      </div>
      {inactifs.length || vue === "inactifs" ? <SegTabs tabs={tabs} /> : null}
      <Barre
        q={q}
        pathname={page.pathname}
        search={page.search}
        hidden={{ vue: vue === "inactifs" ? vue : null }}
        placeholder="Nom, courriel, rôle, secteur…"
      />
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 table-compacte">
            <thead>
              <tr>
                <Th col="nom" label="Nom" pathname={page.pathname} search={page.search} />
                <Th col="role" label="Rôle" pathname={page.pathname} search={page.search} />
                <Th col="secteur" label="Secteur" pathname={page.pathname} search={page.search} />
                <th>Espaces gérés</th>
                <th>Contact</th>
                {admin ? <th>Sécurité</th> : null}
                <Th
                  col="connexion"
                  label="Dernière connexion"
                  pathname={page.pathname}
                  search={page.search}
                />
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
                            {admin ? (
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
                        <Chip teinte={rolesAdmin.has(a.role) ? "rose" : "sky"}>{a.roleNom}</Chip>
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
                      {admin ? (
                        <td>
                          {a.twoFactorEnabled ? (
                            <Chip teinte="emerald" titre="Double authentification activée">
                              <Icone nom="shield-check" taille={12} /> 2FA
                            </Chip>
                          ) : (
                            <span className="text-faint small">—</span>
                          )}
                        </td>
                      ) : null}
                      <td className="small text-muted">
                        {a.lastLoginAt ? depuis(a.lastLoginAt) : "Jamais"}
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
                  colonnes={colonnes}
                  icone="contact-round"
                  message={
                    q
                      ? "Aucun compte ne correspond."
                      : vue === "inactifs"
                        ? "Aucun compte inactif."
                        : "Aucun compte pour le moment."
                  }
                  urlAjout={admin && !q && vue === "actifs" ? "/utilisateurs/nouveau" : null}
                  libelleAjout="Créer un compte"
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationBar p={p} pathname={page.pathname} search={page.search} />

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
