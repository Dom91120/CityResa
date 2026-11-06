import { BoutonOuvrir, ModalAction } from "@/components/fiche";
import { Champ, Grille, Zone } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Barre, Filtre, Th, trier, Vide } from "@/components/liste";
import { Chip } from "@/components/macros";
import { nomPersonne } from "@/lib/personnel";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";
import { type Params, param, textSearch } from "@/server/paging";
import { couleurLibre } from "@/server/personnel";

export const metadata = { title: "Personnel de service - CityRésa" };

export default async function PersonnesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const page = await contexteModule("personnel", "personnel");
  const params = await searchParams;
  const q = String(param(params, "q") ?? "").trim();
  const etat = String(param(params, "etat") ?? "");
  const [rows, couleur] = await Promise.all([
    prisma.personnel.findMany({
      include: { _count: { select: { vacations: { where: { endAt: { gte: new Date() } } } } } },
      orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    }),
    couleurLibre(),
  ]);
  let items = rows.map((p) => ({ ...p, nom: nomPersonne(p), aVenir: p._count.vacations }));
  if (etat === "inactifs") items = items.filter((p) => !p.isActive);
  else if (etat !== "tous") items = items.filter((p) => p.isActive);
  items = textSearch(items, q, ["nom", "fonction", "email", "phone"]);
  items = trier(
    items,
    page.search,
    { nom: (p) => p.lastName, fonction: (p) => p.fonction, a_venir: (p) => p.aVenir },
    "nom",
  );
  const peutEditer = page.user.canEdit("personnel");
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Personnes <span className="page-count">{items.length}</span>
          </h1>
          <p className="page-subtitle">
            Gardiens, agents d'accueil et vacataires que l'on planifie par vacations : ils n'ont pas
            de compte dans CityRésa.
          </p>
        </div>
        <div className="page-actions">
          <a href="/personnel" className="btn btn-ghost btn-sm">
            <Icone nom="calendar-days" taille={14} /> Planning de service
          </a>
          {peutEditer ? (
            <BoutonOuvrir
              cible="modal-personne"
              libelle="Ajouter une personne"
              icone="user-plus"
              classe="btn-primary btn-sm"
            />
          ) : null}
        </div>
      </div>
      <Barre
        q={q}
        hidden={{ etat }}
        pathname={page.pathname}
        search={page.search}
        placeholder="Nom, fonction, courriel, téléphone…"
        filtres={
          <Filtre
            name="etat"
            value={etat}
            ariaLabel="État"
            blank="En service"
            options={[
              ["inactifs", "Plus en service"],
              ["tous", "Tous"],
            ]}
          />
        }
      />
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <Th col="nom" label="Personne" pathname={page.pathname} search={page.search} />
                <Th col="fonction" label="Fonction" pathname={page.pathname} search={page.search} />
                <th>Contact</th>
                <Th
                  col="a_venir"
                  label="Vacations à venir"
                  pathname={page.pathname}
                  search={page.search}
                />
                <th>Calendrier</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((p) => (
                  <tr key={p.id} className={p.isActive ? undefined : "text-muted"}>
                    <td>
                      <span className="d-flex align-items-center gap-2">
                        <span
                          className="pastille-espace"
                          style={{ background: p.color ?? "var(--faint)" }}
                        />
                        <a href={`/personnel/personnes/${p.id}`}>
                          <strong>{p.nom}</strong>
                        </a>
                      </span>
                    </td>
                    <td>{p.fonction ?? <span className="text-faint">—</span>}</td>
                    <td className="small">
                      {p.email ? <div>{p.email}</div> : null}
                      {p.phone ? <div>{p.phone}</div> : null}
                      {!p.email && !p.phone ? <span className="text-faint">—</span> : null}
                    </td>
                    <td>
                      <a href={`/personnel?personne=${p.id}`} title="Voir son planning">
                        {p.aVenir}
                      </a>
                    </td>
                    <td>
                      {p.icsToken ? (
                        <Chip teinte="sky">
                          <Icone nom="calendar" taille={12} /> ICS
                        </Chip>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td>
                      {p.isActive ? (
                        <Chip teinte="emerald" dot>
                          En service
                        </Chip>
                      ) : (
                        <Chip teinte="slate" dot>
                          Plus en service
                        </Chip>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <Vide
                  colonnes={6}
                  message={
                    q || etat
                      ? "Aucune personne ne correspond."
                      : "Aucune personne de service pour l'instant."
                  }
                  icone="shield"
                />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {peutEditer ? (
        <ModalAction
          id="modal-personne"
          titre="Ajouter une personne"
          action="/personnel/personnes/nouveau"
          csrf={page.csrf}
          bouton="Ajouter"
          icone="user-plus"
          aide="Une personne de service n'a pas de compte : elle est planifiée par les agents et peut recevoir son planning par courriel ou l'afficher dans son agenda (lien ICS)."
        >
          <ChampsPersonne couleur={couleur} />
        </ModalAction>
      ) : null}
    </>
  );
}

/** Les champs d'une personne (ajout et modification). */
export function ChampsPersonne({
  p,
  couleur,
}: {
  p?: {
    firstName: string;
    lastName: string;
    fonction: string | null;
    phone: string | null;
    email: string | null;
    color: string | null;
    note: string | null;
  };
  couleur: string;
}) {
  return (
    <Grille colonnes={2}>
      <Champ label="Prénom" name="first_name" valeur={p?.firstName} requis autoComplete="off" />
      <Champ label="Nom" name="last_name" valeur={p?.lastName} requis autoComplete="off" />
      <Champ
        label="Fonction"
        name="fonction"
        valeur={p?.fonction}
        placeholder="Gardien, agent d'accueil, vacataire…"
      />
      <Champ
        label="Couleur dans le planning"
        name="color"
        type="color"
        valeur={p?.color ?? couleur}
      />
      <Champ
        label="Courriel"
        name="email"
        type="email"
        valeur={p?.email}
        aide="Pour lui envoyer son planning."
      />
      <Champ label="Téléphone" name="phone" type="tel" valeur={p?.phone} />
      <Zone label="Note" name="note" valeur={p?.note} rows={2} maxLength={400} />
    </Grille>
  );
}
