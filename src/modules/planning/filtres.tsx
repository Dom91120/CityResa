import { Icone } from "@/components/icones";
import { nomCourt } from "@/lib/libelles";
import { COULEURS, type Couleur } from "@/lib/planning-vues";
import type { espacesDuPerimetre } from "@/modules/planning/server";

type EspaceDuPerimetre = Awaited<ReturnType<typeof espacesDuPerimetre>>[number];

/**
 * Le filtre des sites d'un formulaire GET de planning : un bouton qui ouvre des cases à cocher
 * (`site`, répété dans l'URL), sur le modèle du filtre des espaces. Aucune case cochée = tous.
 */
export function FiltreSites({
  sites,
  choisis,
  hrefTous,
  classes = "",
}: {
  sites: { id: number; name: string }[];
  choisis: number[];
  /** Le lien qui efface le filtre (la page sans `site`). */
  hrefTous: string;
  /** Classes du conteneur (« ms-auto » cale ce filtre et les suivants à droite de la barre). */
  classes?: string;
}) {
  const retenus = sites.filter((s) => choisis.includes(s.id));
  const libelle =
    retenus.length === 0
      ? "Tous les sites"
      : retenus.length === 1
        ? retenus[0]?.name
        : `${retenus.length} sites`;
  return (
    <div className={`dropdown ${classes}`.trim()}>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        data-bs-toggle="dropdown"
        data-bs-auto-close="outside"
        aria-expanded="false"
        title={retenus.length > 1 ? retenus.map((s) => s.name).join("\n") : undefined}
      >
        <Icone nom="map-pin" taille={14} />
        <span className="filtre-libelle">{libelle}</span>
        <Icone nom="chevron-down" taille={12} />
      </button>
      <div
        className="dropdown-menu p-2"
        style={{ minWidth: 260, maxHeight: 360, overflowY: "auto" }}
      >
        {sites.map((s) => (
          <label
            key={s.id}
            className="dropdown-item d-flex align-items-center gap-2"
            style={{ cursor: "pointer" }}
          >
            <input
              type="checkbox"
              className="form-check-input m-0"
              name="site"
              value={s.id}
              defaultChecked={choisis.includes(s.id)}
            />
            <span>{s.name}</span>
          </label>
        ))}
        {retenus.length ? (
          <a href={hrefTous} className="dropdown-item text-muted small">
            <Icone nom="x" taille={12} /> Tous les sites
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Le filtre des espaces d'un formulaire GET de planning : un bouton qui ouvre des cases à cocher
 * (`espace`, répété dans l'URL). Seuls les espaces des sites retenus sont proposés.
 */
export function FiltreEspaces({
  espaces,
  sites,
  choisis,
  hrefTous,
}: {
  espaces: EspaceDuPerimetre[];
  /** Les sites cochés dans le filtre voisin (aucun = tous). */
  sites: number[];
  choisis: number[];
  /** Le lien qui efface le filtre (la page sans `espace`). */
  hrefTous: string;
}) {
  return (
    <div className="dropdown">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        data-bs-toggle="dropdown"
        data-bs-auto-close="outside"
        aria-expanded="false"
      >
        <Icone nom="door-open" taille={14} />
        {choisis.length
          ? `${choisis.length} espace${choisis.length > 1 ? "s" : ""}`
          : "Tous les espaces"}
        <Icone nom="chevron-down" taille={12} />
      </button>
      <div
        className="dropdown-menu p-2"
        style={{ minWidth: 280, maxHeight: 360, overflowY: "auto" }}
      >
        {espaces
          .filter((e) => !sites.length || sites.includes(e.siteId))
          .map((e) => (
            <label
              key={e.id}
              className="dropdown-item d-flex align-items-center gap-2"
              style={{ cursor: "pointer" }}
            >
              <input
                type="checkbox"
                className="form-check-input m-0"
                name="espace"
                value={e.id}
                defaultChecked={choisis.includes(e.id)}
              />
              <span className="pastille-espace" style={{ background: e.color }} />
              <span className="cell2">
                <span>{nomCourt(e)}</span>
                <small>{e.site.name}</small>
              </span>
            </label>
          ))}
        {choisis.length ? (
          <a href={hrefTous} className="dropdown-item text-muted small">
            <Icone nom="x" taille={12} /> Tous les espaces
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Le choix de la couleur des créneaux (`couleur`, vide = par espace) : un bouton réduit à son
 * icône, pour tenir sur la ligne des filtres ; le mode en cours est coché dans le menu et rappelé
 * dans l'infobulle.
 */
export function FiltreCouleur({ choisie }: { choisie: Couleur }) {
  const libelle = `Couleur des créneaux : ${(COULEURS[choisie] ?? "").toLowerCase()}`;
  return (
    <div className="dropdown">
      <button
        type="button"
        className={`btn btn-outline-secondary btn-sm${choisie === "espace" ? "" : " filtre-actif"}`}
        data-bs-toggle="dropdown"
        data-bs-auto-close="outside"
        aria-expanded="false"
        aria-label={libelle}
        title={libelle}
      >
        <Icone nom="palette" taille={14} />
        <Icone nom="chevron-down" taille={12} />
      </button>
      <div className="dropdown-menu dropdown-menu-end p-2" style={{ minWidth: 220 }}>
        <div className="dropdown-header px-2 pt-0">Couleur des créneaux</div>
        {Object.entries(COULEURS).map(([k, l]) => (
          <label
            key={k}
            className="dropdown-item d-flex align-items-center gap-2"
            style={{ cursor: "pointer" }}
          >
            <input
              type="radio"
              className="form-check-input m-0"
              name="couleur"
              value={k === "espace" ? "" : k}
              defaultChecked={k === choisie}
            />
            <span>{l}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * Le sélecteur de période d'une barre de planning : les flèches « précédent » et « suivant »
 * logées dans le cadre de la période, avec l'icône d'agenda qui ouvre le calendrier du navigateur
 * (champ `date` rattaché au formulaire des filtres, envoyé dès qu'une date est choisie), puis le
 * retour à aujourd'hui, réduit à son icône.
 */
export function SelecteurPeriode({
  texte,
  hrefPrecedent,
  hrefSuivant,
  hrefAujourdhui,
  date,
  formulaire,
  avant,
  classes = "",
}: {
  texte: string;
  /** Un élément placé devant la période, dans le même groupe centré (bascule Semaine / Jour). */
  avant?: React.ReactNode;
  /** La date d'ancrage « YYYY-MM-DD » affichée, et l'id du formulaire GET des filtres. */
  date: string;
  formulaire: string;
  hrefPrecedent: string;
  hrefSuivant: string;
  hrefAujourdhui: string;
  classes?: string;
}) {
  return (
    <div className={`d-flex align-items-center gap-1 ${classes}`.trim()}>
      {avant}
      <span className="periode">
        <a
          href={hrefPrecedent}
          className="periode-fleche"
          title="Période précédente"
          aria-label="Période précédente"
        >
          <Icone nom="chevron-left" taille={14} />
        </a>
        <span className="periode-texte">{texte}</span>
        <label className="periode-date" title="Aller à une date">
          <Icone nom="calendar-days" taille={15} />
          <input
            type="date"
            name="date"
            form={formulaire}
            defaultValue={date}
            aria-label="Aller à la date"
            data-date-aller
          />
        </label>
        <a
          href={hrefSuivant}
          className="periode-fleche"
          title="Période suivante"
          aria-label="Période suivante"
        >
          <Icone nom="chevron-right" taille={14} />
        </a>
      </span>
      <a
        href={hrefAujourdhui}
        className="btn btn-ghost btn-icone btn-sm"
        title="Aujourd'hui"
        aria-label="Aujourd'hui"
      >
        <Icone nom="calendar-aujourdhui" taille={17} />
      </a>
    </div>
  );
}

/**
 * Le filtre des personnes du planning de service : un bouton qui ouvre des cases à cocher
 * (`personne`, répété dans l'URL), sur le modèle des filtres de sites et d'espaces.
 */
export function FiltrePersonnes({
  personnes,
  choisies,
  hrefToutes,
}: {
  personnes: { id: number; nom: string; couleur: string | null }[];
  choisies: number[];
  /** Le lien qui efface le filtre (la page sans `personne`). */
  hrefToutes: string;
}) {
  const retenues = personnes.filter((p) => choisies.includes(p.id));
  const libelle =
    retenues.length === 0
      ? "Toutes les personnes"
      : retenues.length === 1
        ? retenues[0]?.nom
        : `${retenues.length} personnes`;
  return (
    <div className="dropdown">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        data-bs-toggle="dropdown"
        data-bs-auto-close="outside"
        aria-expanded="false"
        title={retenues.length > 1 ? retenues.map((p) => p.nom).join(", ") : undefined}
      >
        <Icone nom="users" taille={14} />
        <span className="filtre-libelle">{libelle}</span>
        <Icone nom="chevron-down" taille={12} />
      </button>
      <div
        className="dropdown-menu dropdown-menu-end p-2"
        style={{ minWidth: 240, maxHeight: 360, overflowY: "auto" }}
      >
        {personnes.map((p) => (
          <label
            key={p.id}
            className="dropdown-item d-flex align-items-center gap-2"
            style={{ cursor: "pointer" }}
          >
            <input
              type="checkbox"
              className="form-check-input m-0"
              name="personne"
              value={p.id}
              defaultChecked={choisies.includes(p.id)}
            />
            <span className="pastille-espace" style={{ background: p.couleur ?? "var(--faint)" }} />
            <span>{p.nom}</span>
          </label>
        ))}
        {retenues.length ? (
          <a href={hrefToutes} className="dropdown-item text-muted small">
            <Icone nom="x" taille={12} /> Toutes les personnes
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Une bascule à deux positions ou plus (« Semaine | Jour ») : des liens accolés dont un seul est
 * actif. Ce n'est pas un champ de formulaire : la page reporte le choix dans ses filtres.
 */
export function Bascule({
  libelle,
  choix,
}: {
  /** Le nom du groupe pour les lecteurs d'écran (« Vue »). */
  libelle: string;
  choix: { href: string; texte: string; actif: boolean }[];
}) {
  return (
    <div className="btn-group bascule" role="group" aria-label={libelle}>
      {choix.map((c) => (
        <a
          key={c.texte}
          href={c.href}
          className={`btn btn-sm btn-outline-secondary${c.actif ? " active" : ""}`}
          aria-current={c.actif ? "true" : undefined}
        >
          {c.texte}
        </a>
      ))}
    </div>
  );
}
