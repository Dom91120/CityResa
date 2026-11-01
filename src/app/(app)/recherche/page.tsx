import { Icone } from "@/components/icones";
import { VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import { contextePage } from "@/server/page";
import { param } from "@/server/paging";
import { type Resultat, rechercher } from "@/server/recherche";

export const metadata = { title: "Recherche - CityRésa" };

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await contextePage();
  const params = await searchParams;
  const q = (param(params, "q") ?? "").trim();
  const resultats = q.length >= 2 ? await rechercher(page.user, q, 80) : [];
  const groupes = new Map<string, Resultat[]>();
  for (const r of resultats) {
    const liste = groupes.get(r.typeLabel) ?? [];
    liste.push(r);
    groupes.set(r.typeLabel, liste);
  }
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Recherche {q ? <span className="page-count">{resultats.length}</span> : null}
          </h1>
          <p className="page-subtitle">
            {q ? (
              <>
                Résultats pour « <strong>{q}</strong> » dans les réservations, espaces, usagers,
                matériel et subventions.
              </>
            ) : (
              "Tapez au moins deux caractères. Raccourci : Ctrl K depuis n'importe quelle page."
            )}
          </p>
        </div>
      </div>
      <form
        method="GET"
        action="/recherche"
        className="list-search mb-3"
        role="search"
        style={{ maxWidth: 560 }}
      >
        <Icone nom="search" taille={16} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          className="form-control"
          placeholder="Numéro de dossier, nom, courriel, espace…"
          aria-label="Rechercher"
          autoFocus
        />
      </form>

      {!q ? null : q.length < 2 ? (
        <VideBloc
          icone="search"
          titre="Recherche trop courte"
          texte="Saisissez au moins deux caractères."
        />
      ) : resultats.length ? (
        [...groupes.entries()].map(([typeLabel, liste]) => (
          <div key={typeLabel} className="mb-4">
            <h2 className="h6 text-muted mb-2 d-flex align-items-center gap-2">
              <Icone nom={liste[0].icone} taille={15} /> {typeLabel}
              <span className="page-count">{liste.length}</span>
            </h2>
            <div className="data-card">
              <ul className="liste-simple">
                {liste.map((r) => (
                  <li key={`${r.type}-${r.url}`}>
                    <span className={`notif-ico chip-${r.teinte ?? "slate"}`}>
                      <Icone nom={r.icone} taille={14} />
                    </span>
                    <span className="cell2 flex-grow-1">
                      <a href={r.url}>
                        <strong>{r.titre}</strong>
                      </a>
                      {r.sousTitre ? <small>{r.sousTitre}</small> : null}
                    </span>
                    {r.badge ? <Chip teinte={r.teinte ?? "slate"}>{r.badge}</Chip> : null}
                    <a
                      href={r.url}
                      className="btn btn-ghost btn-icone btn-sm"
                      title="Ouvrir"
                      aria-label="Ouvrir"
                    >
                      <Icone nom="arrow-right" taille={14} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))
      ) : (
        <VideBloc
          icone="search"
          titre="Aucun résultat"
          texte={`Rien ne correspond à « ${q} ». Essayez un numéro de dossier (RES-2026-0042), un nom d'organisation, un courriel ou un espace.`}
        />
      )}
    </>
  );
}
