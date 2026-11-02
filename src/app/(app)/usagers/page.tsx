import { Icone } from "@/components/icones";
import { Barre, PaginationBar, SegTabs, Th, trier, urlAvec, Vide } from "@/components/liste";
import { Avatar, Chip, TypeOrganisation } from "@/components/macros";
import { nomRepresentant } from "@/lib/dossier-usager";
import { dateCourte } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { type EtatValidite, pireEtat } from "@/lib/pieces";
import { nomComplet } from "@/modules/utilisateurs/server";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";
import { paginate, param, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Usagers - CityRésa" };

const ONGLETS: [string, string, (t: string) => boolean][] = [
  ["", "Tous", () => true],
  ["association", "Associations", (t) => t === "association"],
  ["entreprise", "Entreprises", (t) => t === "entreprise"],
  ["particulier", "Particuliers", (t) => t === "particulier"],
  ["service", "Services", (t) => t === "service_interne" || t === "collectivite"],
];

export default async function UsagersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contexteModule("usagers");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const onglet = param(params, "type") ?? "";
  const tous = await prisma.organisation.findMany({
    include: {
      profil: true,
      users: { select: { firstName: true, lastName: true, name: true, email: true } },
      documents: { where: { validUntil: { not: null } }, select: { kind: true, validUntil: true } },
      _count: { select: { reservations: true } },
    },
  });
  const today = todayParisISO();
  const seuil = page.user.settings.ALERTE_PIECES_JOURS ?? 30;
  const etatPieces = new Map<number, EtatValidite | null>(
    tous.map((o) => [o.id, o.isActive ? pireEtat(o.documents, today, seuil) : null]),
  );
  const aVerifier = tous.filter((o) => {
    const e = etatPieces.get(o.id);
    return e === "expiree" || e === "bientot";
  });
  const aValider = tous.filter((o) => !o.validatedAt && o.isActive);
  let items = tous;
  if (onglet === "a_valider") items = aValider;
  else if (onglet === "pieces") items = aVerifier;
  else {
    const def = ONGLETS.find(([k]) => k === onglet);
    if (def) items = tous.filter((o) => def[2](o.type));
  }
  const enrichis = items.map((o) => ({
    ...o,
    membres: o.users.map((u) => nomComplet(u)).join(", "),
    representant: nomRepresentant(o) ?? "",
  }));
  const filtres = textSearch(enrichis, q, [
    "name",
    "city",
    "email",
    "representant",
    "siret",
    "rna",
    "membres",
  ]);
  const tries = trier(
    filtres,
    page.search,
    {
      nom: (o) => o.name,
      type: (o) => o.type,
      ville: (o) => o.city,
      reservations: (o) => o._count.reservations,
      creation: (o) => o.createdAt,
    },
    "nom",
  );
  const perPage = await resolvePerPage(params, page.user, "usagers.list");
  const [rows, p] = paginate(tries, params, perPage);
  const peutEditer = page.user.canEdit("usagers");
  const tabs = [
    ...ONGLETS.map(([k, label, f]) => ({
      href: urlAvec(page.pathname, page.search, { type: k || null, page: null }),
      label,
      count: k ? tous.filter((o) => f(o.type)).length : tous.length,
      teinte: "muted",
      active: onglet === k,
    })),
    {
      href: urlAvec(page.pathname, page.search, { type: "a_valider", page: null }),
      label: "À valider",
      count: aValider.length,
      active: onglet === "a_valider",
    },
    {
      href: urlAvec(page.pathname, page.search, { type: "pieces", page: null }),
      label: "Pièces à vérifier",
      count: aVerifier.length,
      teinte: aVerifier.length ? "red" : "muted",
      active: onglet === "pieces",
    },
  ];
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Usagers <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">
            Associations, entreprises, particuliers et services qui réservent les espaces.
          </p>
        </div>
        <div className="page-actions">
          {peutEditer ? (
            <a href="/usagers/nouveau" className="btn btn-primary">
              <Icone nom="plus" taille={14} /> Créer un usager
            </a>
          ) : null}
        </div>
      </div>
      <SegTabs tabs={tabs} />
      <Barre
        q={q}
        pathname={page.pathname}
        search={page.search}
        hidden={{ type: onglet }}
        placeholder="Nom, ville, courriel, SIRET, membre…"
      />
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <Th col="nom" label="Organisation" pathname={page.pathname} search={page.search} />
                <Th col="type" label="Type" pathname={page.pathname} search={page.search} />
                <Th col="ville" label="Ville" pathname={page.pathname} search={page.search} />
                <th>Membres</th>
                <Th
                  col="reservations"
                  label="Réservations"
                  pathname={page.pathname}
                  search={page.search}
                  classes="text-end"
                />
                <th>Profil tarifaire</th>
                <th>Statut</th>
                <Th col="creation" label="Créé le" pathname={page.pathname} search={page.search} />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <a href={`/usagers/${o.id}`} className="d-flex align-items-center gap-2">
                        <Avatar nom={o.name} taille="sm" />
                        <span className="cell2">
                          <strong>{o.name}</strong>
                          <small>{o.representant || o.email || ""}</small>
                        </span>
                      </a>
                    </td>
                    <td>
                      <TypeOrganisation type={o.type} />
                    </td>
                    <td>{o.city ?? <span className="text-faint">—</span>}</td>
                    <td>
                      {o.users.length ? (
                        <span className="avatar-pile" title={o.membres}>
                          {o.users.slice(0, 4).map((u) => (
                            <Avatar key={u.email} nom={nomComplet(u)} taille="sm" />
                          ))}
                          {o.users.length > 4 ? (
                            <span className="avatar avatar-sm" title={o.membres}>
                              +{o.users.length - 4}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-faint small">Aucun compte</span>
                      )}
                    </td>
                    <td className="text-end tabular">{o._count.reservations}</td>
                    <td className="small">
                      {o.profil?.label ?? <span className="text-faint">—</span>}
                    </td>
                    <td>
                      <span className="d-flex gap-1 flex-wrap">
                        {!o.isActive ? (
                          <Chip teinte="slate">Inactif</Chip>
                        ) : !o.validatedAt ? (
                          <Chip teinte="amber">À valider</Chip>
                        ) : (
                          <Chip teinte="emerald">Validé</Chip>
                        )}
                        {etatPieces.get(o.id) === "expiree" ? (
                          <Chip teinte="red">Pièce expirée</Chip>
                        ) : etatPieces.get(o.id) === "bientot" ? (
                          <Chip teinte="amber">Pièce à renouveler</Chip>
                        ) : null}
                      </span>
                    </td>
                    <td className="small text-muted">{dateCourte(o.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <Vide
                  colonnes={8}
                  icone="users"
                  message={
                    q
                      ? "Aucun usager ne correspond à cette recherche."
                      : onglet === "a_valider"
                        ? "Aucune organisation en attente de validation."
                        : onglet === "pieces"
                          ? "Aucune pièce expirée ni sur le point d'expirer."
                          : "Aucun usager pour le moment."
                  }
                  urlAjout={peutEditer && !q ? "/usagers/nouveau" : null}
                  libelleAjout="Créer le premier usager"
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
