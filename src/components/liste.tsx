/**
 * Le gabarit de liste : barre de recherche et filtres, onglets-segments, ligne vide,
 * pagination, en-tête de colonne triable.
 */
import { Icone } from "@/components/icones";
import { type Pagination, PER_PAGE_CHOICES } from "@/server/paging";

/** Reconstruit une adresse avec les paramètres de la requête, modifiés. */
export function urlAvec(
  pathname: string,
  search: URLSearchParams,
  modifs: Record<string, string | number | null | undefined>,
): string {
  const p = new URLSearchParams(search);
  for (const [k, v] of Object.entries(modifs)) {
    if (v === null || v === undefined || v === "") p.delete(k);
    else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `${pathname}?${s}` : pathname;
}

/** La barre d'outils d'une liste : recherche (GET), filtres, actions à droite. */
export function Barre({
  q = "",
  hidden = {},
  filtres,
  droite,
  placeholder = "Rechercher…",
  pathname,
  search,
}: {
  q?: string;
  hidden?: Record<string, string | null | undefined>;
  filtres?: React.ReactNode;
  droite?: React.ReactNode;
  placeholder?: string;
  pathname: string;
  search: URLSearchParams;
}) {
  const keep: Record<string, string> = {};
  for (const [k, v] of Object.entries(hidden)) if (v) keep[k] = v;
  const perPage = search.get("per_page");
  if (perPage) keep.per_page = perPage;
  return (
    <div className="list-toolbar">
      <form method="GET" className="list-search" role="search">
        {Object.entries(keep).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Icone nom="search" taille={16} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          className="form-control"
          placeholder={placeholder}
          aria-label="Rechercher dans la liste"
        />
      </form>
      {filtres ? (
        <form method="GET" className="d-flex gap-2 align-items-center flex-wrap" data-auto-submit>
          {q ? <input type="hidden" name="q" value={q} /> : null}
          {Object.entries(keep)
            .filter(([k]) => k === "per_page")
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          {filtres}
        </form>
      ) : null}
      {q ? (
        <a
          href={urlAvec(pathname, search, { q: null, page: null })}
          className="btn btn-ghost btn-sm"
        >
          <Icone nom="x" taille={14} /> Effacer
        </a>
      ) : null}
      {droite ? <div className="list-toolbar-right">{droite}</div> : null}
    </div>
  );
}

/** Un <select> de filtre (soumis au changement par la barre). */
export function Filtre({
  name,
  value,
  options,
  blank = "Tous",
  ariaLabel,
}: {
  name: string;
  value: string;
  options: [string, string][];
  blank?: string;
  ariaLabel: string;
}) {
  return (
    <select
      name={name}
      className="form-select form-select-sm filtre-select"
      defaultValue={value}
      aria-label={ariaLabel}
    >
      <option value="">{blank}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

/** Onglets-segments (Toutes · À traiter · Terminées…). */
export function SegTabs({
  tabs,
}: {
  tabs: {
    href: string;
    label: React.ReactNode;
    count?: number | null;
    active: boolean;
    teinte?: string;
  }[];
}) {
  return (
    <div className="seg-tabs">
      {tabs.map((t) => (
        <a key={t.href} className={`seg-tab${t.active ? " active" : ""}`} href={t.href}>
          {t.label}
          {t.count !== undefined && t.count !== null ? (
            <span className={`seg-tab-count${t.teinte === "muted" || !t.count ? " muted" : ""}`}>
              {t.count}
            </span>
          ) : null}
        </a>
      ))}
    </div>
  );
}

/** La ligne « vide » d'une table. */
export function Vide({
  colonnes,
  message,
  urlAjout,
  libelleAjout = "Ajouter le premier",
  icone = "inbox",
}: {
  colonnes: number;
  message: string;
  urlAjout?: string | null;
  libelleAjout?: string;
  icone?: string;
}) {
  return (
    <tr>
      <td colSpan={colonnes} className="ligne-vide">
        <Icone nom={icone} taille={36} />
        <p className="mb-2">{message}</p>
        {urlAjout ? (
          <a href={urlAjout} className="btn btn-sm btn-primary">
            <Icone nom="plus" taille={14} /> {libelleAjout}
          </a>
        ) : null}
      </td>
    </tr>
  );
}

/** Un bloc vide hors table. */
export function VideBloc({
  icone = "inbox",
  titre,
  texte,
  action,
}: {
  icone?: string;
  titre: string;
  texte?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="vide-bloc">
      <span className="ico">
        <Icone nom={icone} taille={28} />
      </span>
      <h5>{titre}</h5>
      {texte ? <p className="mb-3">{texte}</p> : null}
      {action}
    </div>
  );
}

/** « 1–20 sur 48 », précédent / suivant, lignes par page. */
export function PaginationBar({
  p,
  pathname,
  search,
}: {
  p: Pagination;
  pathname: string;
  search: URLSearchParams;
}) {
  if (!p.pages) return null;
  const { page, pages, total, perPage } = p;
  const info =
    total && perPage
      ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} sur ${total}`
      : total
        ? `${total} élément${total > 1 ? "s" : ""}`
        : "";
  return (
    <nav className="pagination-bar" aria-label="Pagination">
      <span>{info}</span>
      <span className="pagination-nav">
        {page > 1 ? (
          <a
            href={urlAvec(pathname, search, { page: page - 1 })}
            className="btn btn-outline-secondary btn-icone btn-sm"
            title="Page précédente"
            aria-label="Page précédente"
          >
            <Icone nom="chevron-left" taille={14} />
          </a>
        ) : (
          <span className="btn btn-outline-secondary btn-icone btn-sm disabled" aria-hidden="true">
            <Icone nom="chevron-left" taille={14} />
          </span>
        )}
        <span>
          {page} / {pages}
        </span>
        {page < pages ? (
          <a
            href={urlAvec(pathname, search, { page: page + 1 })}
            className="btn btn-outline-secondary btn-icone btn-sm"
            title="Page suivante"
            aria-label="Page suivante"
          >
            <Icone nom="chevron-right" taille={14} />
          </a>
        ) : (
          <span className="btn btn-outline-secondary btn-icone btn-sm disabled" aria-hidden="true">
            <Icone nom="chevron-right" taille={14} />
          </span>
        )}
      </span>
      <select
        className="form-select pagination-perpage"
        data-href-select
        title="Lignes par page"
        aria-label="Lignes par page"
        defaultValue={urlAvec(pathname, search, {
          page: null,
          per_page: perPage === null ? "all" : perPage,
        })}
      >
        {PER_PAGE_CHOICES.map((n) => (
          <option key={n} value={urlAvec(pathname, search, { page: null, per_page: n })}>
            {n} / page
          </option>
        ))}
        <option value={urlAvec(pathname, search, { page: null, per_page: "all" })}>Tous</option>
      </select>
    </nav>
  );
}

/** Un en-tête de colonne triable (?tri=col&sens=asc|desc). */
export function Th({
  col,
  label,
  pathname,
  search,
  classes = "",
}: {
  col: string;
  label: string;
  pathname: string;
  search: URLSearchParams;
  classes?: string;
}) {
  const tri = search.get("tri");
  const sens = search.get("sens") === "desc" ? "desc" : "asc";
  const actif = tri === col;
  const prochain = actif && sens === "asc" ? "desc" : "asc";
  return (
    <th className={classes}>
      <a
        href={urlAvec(pathname, search, { tri: col, sens: prochain, page: null })}
        className={actif ? "actif" : ""}
      >
        {label}
        <Icone
          nom={actif ? (sens === "asc" ? "chevron-up" : "chevron-down") : "arrow-up-down"}
          taille={12}
        />
      </a>
    </th>
  );
}

/** Trie une liste selon ?tri=&sens= parmi des colonnes connues. */
export function trier<T>(
  items: T[],
  search: URLSearchParams,
  colonnes: Record<string, (x: T) => string | number | Date | null | undefined>,
  defaut: string,
  defautSens: "asc" | "desc" = "asc",
): T[] {
  const tri =
    search.get("tri") && colonnes[search.get("tri") as string]
      ? (search.get("tri") as string)
      : defaut;
  const sens = search.get("sens")
    ? search.get("sens") === "desc"
      ? -1
      : 1
    : defautSens === "desc"
      ? -1
      : 1;
  const f = colonnes[tri];
  const cmp = (a: T, b: T) => {
    const va = f(a);
    const vb = f(b);
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === "string" && typeof vb === "string")
      return va.localeCompare(vb, "fr", { sensitivity: "base" }) * sens;
    const na = va instanceof Date ? va.getTime() : Number(va);
    const nb = vb instanceof Date ? vb.getTime() : Number(vb);
    return (na < nb ? -1 : 1) * sens;
  };
  return [...items].sort(cmp);
}
