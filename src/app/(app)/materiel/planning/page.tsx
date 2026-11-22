import { Icone } from "@/components/icones";
import { urlAvec, VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import { JOURS_ISO, RESERVATION_STATUS, STATUTS_OCCUPANTS } from "@/lib/constantes";
import {
  chargeSurFenetre,
  libelleRattachement,
  NIVEAUX_CHARGE,
  type NiveauCharge,
  niveauCharge,
  stockUtilisable,
} from "@/lib/materiel-stock";
import { parisMidnight, parisParts, todayParisISO, toParisWall } from "@/lib/paris-time";
import {
  categoriesMateriel,
  type MobilisationDossier,
  mobilisationsPeriode,
} from "@/modules/materiel/server";
import { FiltreCases, FiltreChoix, SelecteurPeriode } from "@/modules/planning/filtres";
import {
  bornesJour,
  estWeekend,
  fenetreListe,
  lireDate,
  lireEtendue,
  periodeAffichee,
} from "@/modules/planning/server";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";
import { type Params, param } from "@/server/paging";

export const metadata = { title: "Planning du matériel - CityRésa" };

/** Les étendues proposées : N jours à partir de la date, ou son mois (15 jours par défaut). */
const ETENDUES_MATERIEL: [string, string][] = [
  ["7j", "7 jours"],
  ["", "15 jours"],
  ["30j", "30 jours"],
  ["mois", "Mois"],
];

function valeurs(brut: string | string[] | undefined): string[] {
  const liste = Array.isArray(brut) ? brut : brut ? [brut] : [];
  return [...new Set(liste.map((v) => v.trim()).filter(Boolean))];
}

function enteteJour(jour: string): [string, string] {
  const d = parisMidnight(jour);
  const w = toParisWall(d);
  return [
    JOURS_ISO[parisParts(d).weekday - 1].court,
    `${String(w.da).padStart(2, "0")}/${String(w.mo).padStart(2, "0")}`,
  ];
}

/** « 12 sur 40 retenus · R260003 Judo Club (12) » : le détail d'une case, en infobulle. */
function detail(charge: number, utilisable: number, dossiers: MobilisationDossier[]): string {
  const reste = utilisable - charge;
  const bilan =
    reste < 0
      ? `il en manque ${-reste}`
      : reste === 0
        ? "plus rien de disponible"
        : `reste ${reste}`;
  return [
    `${charge} sur ${utilisable} retenu${charge > 1 ? "s" : ""}, ${bilan}`,
    ...dossiers.map((d) => `${d.numero} ${d.qui || d.titre} (${d.quantite})`),
  ].join("\n");
}

export default async function PlanningMaterielPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const page = await contexteModule("materiel", "materiel");
  const params = await searchParams;
  const etendueLue = lireEtendue(param(params, "etendue"));
  const etendue = etendueLue === "" || etendueLue === "libre" ? "15j" : etendueLue;
  const fen = fenetreListe(lireDate(param(params, "date")), etendue);
  const q = (param(params, "q") ?? "").trim().slice(0, 80);
  const seulementRetenu = param(params, "retenu") === "1";
  const categories = await categoriesMateriel();
  const categoriesChoisies = valeurs(params.categorie).filter((c) =>
    categories.some((x) => String(x.id) === c),
  );
  const sites = await prisma.site.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
  // « commun » retient le stock commun ; un site, le matériel rattaché à ce site ou à l'un de ses espaces.
  const lieuxChoisis = valeurs(params.lieu).filter(
    (l) => l === "commun" || sites.some((s) => String(s.id) === l),
  );
  const sitesChoisis = lieuxChoisis.filter((l) => l !== "commun").map(Number);
  const statutsChoisis = STATUTS_OCCUPANTS.filter((s) => valeurs(params.statut).includes(s));
  const statuts = statutsChoisis.length ? statutsChoisis : STATUTS_OCCUPANTS;

  const [materiels, mobilisations] = await Promise.all([
    prisma.materiel.findMany({
      where: {
        isActive: true,
        ...(categoriesChoisies.length
          ? { categorieId: { in: categoriesChoisies.map(Number) } }
          : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        ...(lieuxChoisis.length
          ? {
              OR: [
                ...(sitesChoisis.length ? [{ siteId: { in: sitesChoisis } }] : []),
                ...(lieuxChoisis.includes("commun") ? [{ siteId: null, espaceId: null }] : []),
              ],
            }
          : {}),
      },
      include: { categorie: true, site: true, espace: true },
      orderBy: [{ categorie: { position: "asc" } }, { name: "asc" }],
    }),
    mobilisationsPeriode(fen.de, fen.a, statuts),
  ]);

  const parMateriel = new Map<number, MobilisationDossier[]>();
  for (const m of mobilisations) {
    const liste = parMateriel.get(m.materielId) ?? [];
    liste.push(m);
    parMateriel.set(m.materielId, liste);
  }
  const jours = fen.jours.map((j) => ({ cle: j, ...bornesJour(j), entete: enteteJour(j) }));
  const lignes = materiels
    .map((m) => {
      const dossiers = parMateriel.get(m.id) ?? [];
      const utilisable = stockUtilisable(m);
      const cases = jours.map((j) => {
        const duJour = dossiers.filter((d) => d.debut < j.endAt && d.fin > j.startAt);
        const charge = chargeSurFenetre(duJour, j.startAt, j.endAt);
        return { charge, niveau: niveauCharge(charge, utilisable), dossiers: duJour };
      });
      return { m, utilisable, cases, retenu: dossiers.length > 0 };
    })
    .filter((l) => !seulementRetenu || l.retenu);

  // Les matériels regroupés par catégorie, dans l'ordre du référentiel ; « Sans catégorie » à la fin.
  const groupes = new Map<string, typeof lignes>();
  for (const l of lignes) {
    const nom = l.m.categorie?.label ?? "Sans catégorie";
    groupes.set(nom, [...(groupes.get(nom) ?? []), l]);
  }
  const depassements = lignes.reduce(
    (n, l) => n + l.cases.filter((c) => c.niveau === "depasse").length,
    0,
  );
  const aujourdhui = todayParisISO();
  const lien = (modifs: Record<string, string | null>) =>
    urlAvec(page.pathname, page.search, modifs);
  const filtresActifs = Boolean(
    q ||
      seulementRetenu ||
      categoriesChoisies.length ||
      statutsChoisis.length ||
      lieuxChoisis.length,
  );
  const legende: NiveauCharge[] = ["partiel", "complet", "depasse"];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Planning du matériel <span className="page-count">{fen.label}</span>
          </h1>
          <p className="page-subtitle">
            {lignes.length} matériel{lignes.length > 1 ? "s" : ""} · unités retenues chaque jour par
            les dossiers, face au stock utilisable.
            {depassements ? (
              <>
                <br />
                <strong className="text-danger">
                  <Icone nom="triangle-alert" taille={13} /> {depassements} jour
                  {depassements > 1 ? "s" : ""} en dépassement de stock.
                </strong>
              </>
            ) : null}
          </p>
        </div>
        <div className="page-actions">
          <a href="/materiel" className="btn btn-outline-secondary btn-sm">
            <Icone nom="list" taille={14} /> Liste du matériel
          </a>
        </div>
      </div>

      <div className="planning-barre">
        <SelecteurPeriode
          texte={periodeAffichee(fen)}
          hrefPrecedent={lien({ date: fen.precedent })}
          hrefSuivant={lien({ date: fen.suivant })}
          hrefAujourdhui={lien({ date: null })}
          date={fen.date}
          formulaire="filtres-materiel"
        />
        <form
          id="filtres-materiel"
          method="GET"
          className="d-flex align-items-center gap-2 flex-wrap"
          data-auto-submit
          data-auto-submit-natif
        >
          <FiltreChoix
            name="etendue"
            icone="calendar-range"
            titre="Période affichée"
            options={ETENDUES_MATERIEL}
            choisi={etendue === "15j" ? "" : etendue}
          />
          <FiltreCases
            name="categorie"
            icone="boxes"
            options={categories.map((c) => [String(c.id), c.label])}
            choisis={categoriesChoisies}
            tous="Toutes les catégories"
            plusieurs={(n) => `${n} catégories`}
            hrefTous={lien({ categorie: null })}
          />
          <FiltreCases
            name="lieu"
            icone="map-pin"
            options={[
              ["commun", "Stock commun de la ville"],
              ...sites.map((s): [string, string] => [String(s.id), s.name]),
            ]}
            choisis={lieuxChoisis}
            tous="Tous les rattachements"
            plusieurs={(n) => `${n} rattachements`}
            hrefTous={lien({ lieu: null })}
          />
          <FiltreCases
            name="statut"
            icone="circle-check"
            options={STATUTS_OCCUPANTS.map((s) => [s, RESERVATION_STATUS[s].label])}
            choisis={statutsChoisis}
            tous="Tous les dossiers"
            plusieurs={(n) => `${n} statuts`}
            hrefTous={lien({ statut: null })}
          />
          <label
            className="d-flex align-items-center gap-1 small mb-0"
            style={{ cursor: "pointer" }}
          >
            <input
              type="checkbox"
              className="form-check-input m-0"
              name="retenu"
              value="1"
              defaultChecked={seulementRetenu}
            />
            Retenu seulement
          </label>
          <span className="d-flex gap-1">
            <input
              type="search"
              name="q"
              className="form-control form-control-sm"
              defaultValue={q}
              placeholder="Nom du matériel…"
              aria-label="Rechercher un matériel par son nom"
              maxLength={80}
              style={{ width: 170 }}
            />
            <button
              type="submit"
              className="btn btn-outline-secondary btn-sm btn-icone"
              title="Rechercher"
              aria-label="Rechercher"
            >
              <Icone nom="search" taille={14} />
            </button>
          </span>
        </form>
      </div>
      <ul className="list-inline small text-muted mb-2" aria-label="Légende">
        {legende.map((n) => (
          <li key={n} className="list-inline-item me-3">
            <Chip teinte={NIVEAUX_CHARGE[n].teinte}>n</Chip> {NIVEAUX_CHARGE[n].label}
          </li>
        ))}
        {filtresActifs ? (
          <li className="list-inline-item">
            ·{" "}
            <a href={lien({ q: null, retenu: null, categorie: null, statut: null, lieu: null })}>
              Retirer les filtres
            </a>
          </li>
        ) : null}
      </ul>

      {!lignes.length ? (
        <div className="data-card">
          <VideBloc
            icone="package"
            titre={
              filtresActifs
                ? "Aucun matériel ne correspond à ces critères"
                : "Aucun matériel actif pour l'instant"
            }
            texte={
              seulementRetenu
                ? "Aucun dossier ne retient de matériel sur cette période."
                : "Le matériel se gère depuis la liste du matériel."
            }
            action={
              <a href="/materiel" className="btn btn-outline-secondary btn-sm">
                Liste du matériel
              </a>
            }
          />
        </div>
      ) : (
        <div className="planning planning--materiel">
          <table>
            <caption className="visually-hidden">
              Unités de matériel retenues par jour ; chaque nombre est à comparer au stock
              utilisable indiqué sous le nom du matériel.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="col-espace">
                  Matériel
                </th>
                {jours.map((j) => (
                  <th
                    key={j.cle}
                    scope="col"
                    className={j.cle === aujourdhui ? "aujourdhui" : undefined}
                  >
                    {j.entete[0]}
                    <span className="d-block fw-normal">{j.entete[1]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...groupes].flatMap(([nom, liste]) => [
                <tr key={`g-${nom}`} className="groupe">
                  <th scope="colgroup" colSpan={jours.length + 1}>
                    {nom}
                  </th>
                </tr>,
                ...liste.map((l) => (
                  <tr key={l.m.id}>
                    <th scope="row" className="col-espace fw-normal">
                      <span className="cell2">
                        <a
                          href={`/materiel/${l.m.id}`}
                          className="fw-medium"
                          style={{ color: "var(--strong)" }}
                        >
                          {l.m.name}
                        </a>
                        <small>
                          {l.utilisable} utilisable{l.utilisable > 1 ? "s" : ""}
                          {l.m.horsService ? ` · ${l.m.horsService} hors service` : ""}
                          {l.m.siteId || l.m.espaceId ? ` · ${libelleRattachement(l.m)}` : ""}
                        </small>
                      </span>
                    </th>
                    {l.cases.map((c, i) => {
                      const j = jours[i];
                      const seul = c.dossiers.length === 1 ? c.dossiers[0] : null;
                      return (
                        <td key={j.cle} className={estWeekend(j.cle) ? "weekend" : undefined}>
                          {c.charge > 0 ? (
                            <a
                              href={
                                seul ? `/reservations/${seul.reservationId}` : `/materiel/${l.m.id}`
                              }
                              title={detail(c.charge, l.utilisable, c.dossiers)}
                            >
                              <Chip teinte={NIVEAUX_CHARGE[c.niveau].teinte}>
                                {c.charge}
                                <span className="visually-hidden">
                                  {" "}
                                  sur {l.utilisable}, {NIVEAUX_CHARGE[c.niveau].label.toLowerCase()}
                                </span>
                              </Chip>
                            </a>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
