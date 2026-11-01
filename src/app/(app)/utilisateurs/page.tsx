import { Icone } from "@/components/icones";
import { Barre, PaginationBar, SegTabs, Th, trier, urlAvec, Vide } from "@/components/liste";
import { Avatar, Chip } from "@/components/macros";
import { ROLE_LABELS } from "@/lib/constantes";
import { dateCourte, depuis } from "@/lib/libelles";
import { contexteAdmin } from "@/modules/admin/server";
import { nomComplet } from "@/modules/utilisateurs/server";
import { prisma } from "@/server/db";
import { paginate, param, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Utilisateurs - CityRésa" };

export default async function UtilisateursPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteAdmin();
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const onglet = param(params, "vue") ?? "agents";
  const [tous, roles] = await Promise.all([
    prisma.user.findMany({
      include: { organisation: { select: { id: true, name: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.role.findMany(),
  ]);
  const libelleRole = Object.fromEntries(roles.map((r) => [r.name, r.label]));
  const agents = tous.filter((u) => u.kind === "agent" && u.isActive);
  const usagers = tous.filter((u) => u.kind === "usager" && u.isActive);
  const inactifs = tous.filter((u) => !u.isActive);
  const base = onglet === "usagers" ? usagers : onglet === "inactifs" ? inactifs : agents;
  const enrichis = base.map((u) => ({
    ...u,
    nom: nomComplet(u),
    org: u.organisation?.name ?? "",
    roleLabel: libelleRole[u.role] ?? ROLE_LABELS[u.role] ?? u.role,
  }));
  const filtres = textSearch(enrichis, q, ["nom", "email", "fonction", "org", "roleLabel"]);
  const tries = trier(
    filtres,
    page.search,
    {
      nom: (u) => u.nom,
      role: (u) => u.roleLabel,
      connexion: (u) => u.lastLoginAt,
      creation: (u) => u.createdAt,
    },
    "nom",
  );
  const perPage = await resolvePerPage(params, page.user, "utilisateurs.list");
  const [rows, p] = paginate(tries, params, perPage);
  const tabs = [
    ["agents", "Agents", agents.length],
    ["usagers", "Usagers", usagers.length],
    ["inactifs", "Inactifs", inactifs.length],
  ].map(([k, label, n]) => ({
    href: urlAvec(page.pathname, page.search, { vue: k, page: null }),
    label: String(label),
    count: Number(n),
    teinte: "muted",
    active: onglet === k,
  }));
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Utilisateurs <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">
            Tous les comptes : agents de la collectivité et usagers du portail.
          </p>
        </div>
        <div className="page-actions">
          <a href="/roles" className="btn btn-outline-secondary">
            <Icone nom="shield" taille={14} /> Rôles
          </a>
          <a href="/utilisateurs/nouveau" className="btn btn-primary">
            <Icone nom="user-plus" taille={14} /> Nouvel agent
          </a>
        </div>
      </div>
      <SegTabs tabs={tabs} />
      <Barre
        q={q}
        pathname={page.pathname}
        search={page.search}
        hidden={{ vue: onglet }}
        placeholder="Nom, courriel, organisation, rôle…"
      />
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <Th col="nom" label="Compte" pathname={page.pathname} search={page.search} />
                <Th col="role" label="Rôle" pathname={page.pathname} search={page.search} />
                <th>Organisation</th>
                <th>Sécurité</th>
                <Th
                  col="connexion"
                  label="Dernière connexion"
                  pathname={page.pathname}
                  search={page.search}
                />
                <Th col="creation" label="Créé le" pathname={page.pathname} search={page.search} />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <a href={`/utilisateurs/${u.id}`} className="d-flex align-items-center gap-2">
                        <Avatar nom={u.nom} taille="sm" agent={u.kind === "agent"} />
                        <span className="cell2">
                          <strong>{u.nom}</strong>
                          <small>
                            {u.email}
                            {u.fonction ? ` · ${u.fonction}` : ""}
                          </small>
                        </span>
                      </a>
                    </td>
                    <td>
                      <Chip
                        teinte={u.kind === "usager" ? "amber" : u.role === "admin" ? "rose" : "sky"}
                      >
                        {u.roleLabel}
                      </Chip>
                    </td>
                    <td className="small">
                      {u.organisation ? (
                        <a href={`/usagers/${u.organisation.id}`}>{u.organisation.name}</a>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td>
                      {u.twoFactorEnabled ? (
                        <Chip teinte="emerald" titre="Double authentification activée">
                          <Icone nom="shield-check" taille={12} /> 2FA
                        </Chip>
                      ) : (
                        <span className="text-faint small">—</span>
                      )}
                      {!u.isActive ? (
                        <Chip teinte="slate" classes="ms-1">
                          Inactif
                        </Chip>
                      ) : null}
                    </td>
                    <td className="small text-muted">
                      {u.lastLoginAt ? depuis(u.lastLoginAt) : "Jamais"}
                    </td>
                    <td className="small text-muted">{dateCourte(u.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <Vide
                  colonnes={6}
                  icone="user-cog"
                  message={q ? "Aucun compte ne correspond." : "Aucun compte dans cette vue."}
                  urlAjout={onglet === "agents" && !q ? "/utilisateurs/nouveau" : null}
                  libelleAjout="Créer un agent"
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
