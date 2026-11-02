import { Icone } from "@/components/icones";
import {
  espacesBloquesLe,
  espacesPublics,
  imageAccueil,
  profilDe,
} from "@/modules/portail/catalogue";
import { BlocVide, EspaceCarte } from "@/modules/portail/vues";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/guards";
import { normaliser } from "@/server/paging";

export const metadata = { title: "Catalogue des espaces - CityRésa" };

const ETAPES = [
  {
    icone: "search",
    titre: "1. Choisissez un espace",
    texte:
      "Parcourez le catalogue, consultez les photos, les équipements, les tarifs et le calendrier de disponibilité.",
  },
  {
    icone: "calendar-plus",
    titre: "2. Déposez votre demande",
    texte:
      "Indiquez la date, l'horaire et votre événement : vous voyez le devis en direct et recevez un accusé de réception.",
  },
  {
    icone: "pen-line",
    titre: "3. Signez la convention",
    texte:
      "Une fois la demande acceptée, signez la convention en ligne avec un code reçu par SMS ou courriel. C'est réservé !",
  },
];

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const lire = (k: string) => (typeof sp[k] === "string" ? String(sp[k]).trim() : "");
  const fSite = lire("site");
  const fNature = lire("nature");
  const fCapacite = Number.parseInt(lire("capacite"), 10) || 0;
  const fDate = /^\d{4}-\d{2}-\d{2}$/.test(lire("date")) ? lire("date") : "";
  const q = lire("q");

  const [cfg, user, espaces, image, profils] = await Promise.all([
    getSettings(),
    getCurrentUser(),
    espacesPublics(),
    imageAccueil(),
    prisma.referential.findMany({
      where: { kind: "profil" },
      select: { code: true, label: true },
    }),
  ]);
  const profil = await profilDe(user);

  const sites = [...new Map(espaces.map((e) => [e.site.id, e.site])).values()].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name),
  );
  const natures = [
    ...new Map(espaces.filter((e) => e.nature).map((e) => [e.nature?.id, e.nature])).values(),
  ].filter((n): n is NonNullable<typeof n> => Boolean(n));

  let liste = espaces;
  if (fSite) liste = liste.filter((e) => String(e.site.id) === fSite);
  if (fNature) liste = liste.filter((e) => String(e.natureId ?? "") === fNature);
  if (fCapacite)
    liste = liste.filter(
      (e) => Math.max(e.capacityStanding ?? 0, e.capacitySeated ?? 0) >= fCapacite,
    );
  if (q) {
    const nq = normaliser(q);
    liste = liste.filter((e) =>
      normaliser(
        [e.name, e.site.name, e.site.city ?? "", e.nature?.label ?? "", e.description ?? ""].join(
          " ",
        ),
      ).includes(nq),
    );
  }
  if (fDate) {
    const bloques = await espacesBloquesLe(liste, fDate);
    liste = liste.filter((e) => !bloques.has(e.id));
  }
  const filtreActif = Boolean(fSite || fNature || fCapacite || fDate || q);

  return (
    <>
      <section className="hero">
        {image ? <img src={`/documents/${image.id}/thumb`} alt="" /> : null}
        <div>
          <h1>{cfg.PORTAIL_TITRE}</h1>
          <p>{cfg.PORTAIL_ACCROCHE}</p>
          {!user && cfg.INSCRIPTION_ENABLED ? (
            <p className="mt-3">
              <a href="/inscription" className="btn btn-light">
                <Icone nom="user-plus" taille={14} /> Créer mon espace
              </a>{" "}
              <a href="/connexion" className="btn btn-outline-light">
                Se connecter
              </a>
            </p>
          ) : null}
        </div>
      </section>

      <form method="GET" action="/portail" className="catalogue-filtres" data-auto-submit>
        <label className="visually-hidden" htmlFor="f-q">
          Rechercher un espace
        </label>
        <input
          type="search"
          name="q"
          id="f-q"
          className="form-control"
          style={{ maxWidth: 240 }}
          placeholder="Rechercher un espace…"
          defaultValue={q}
        />
        <select
          name="site"
          className="form-select"
          style={{ width: "auto" }}
          defaultValue={fSite}
          aria-label="Site"
        >
          <option value="">Tous les sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          name="nature"
          className="form-select"
          style={{ width: "auto" }}
          defaultValue={fNature}
          aria-label="Type d'espace"
        >
          <option value="">Tous les types</option>
          {natures.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
        <div className="input-group" style={{ width: "auto" }}>
          <span className="input-group-text">
            <Icone nom="users" taille={14} />
          </span>
          <input
            type="number"
            name="capacite"
            className="form-control"
            style={{ maxWidth: 110 }}
            min={1}
            placeholder="Personnes"
            defaultValue={fCapacite || ""}
            aria-label="Nombre de personnes minimum"
          />
        </div>
        <div className="input-group" style={{ width: "auto" }}>
          <span className="input-group-text">
            <Icone nom="calendar-days" taille={14} />
          </span>
          <input
            type="date"
            name="date"
            className="form-control"
            defaultValue={fDate}
            aria-label="Date souhaitée"
          />
        </div>
        <button type="submit" className="btn btn-outline-primary">
          <Icone nom="filter" taille={14} /> Filtrer
        </button>
        {filtreActif ? (
          <a href="/portail" className="btn btn-ghost">
            <Icone nom="x" taille={14} /> Effacer
          </a>
        ) : null}
      </form>

      <p className="text-muted small">
        {liste.length ? (
          <>
            {liste.length} espace{liste.length > 1 ? "s" : ""}
            {fDate ? " disponible(s) à la date choisie" : ""}
          </>
        ) : null}
      </p>

      {liste.length ? (
        <div className="catalogue">
          {liste.map((e) => (
            <EspaceCarte
              key={e.id}
              espace={e}
              profil={profil}
              profils={profils}
              afficherTarifs={cfg.PORTAIL_AFFICHER_TARIFS}
            />
          ))}
        </div>
      ) : (
        <div className="data-card">
          <BlocVide
            icone="door-open"
            titre={filtreActif ? "Aucun espace ne correspond" : "Aucun espace en ligne"}
            texte={
              filtreActif
                ? "Essayez avec moins de critères ou une autre date."
                : "La collectivité n'a pas encore publié d'espace réservable."
            }
            action={
              filtreActif ? (
                <a href="/portail" className="btn btn-outline-primary">
                  Voir tous les espaces
                </a>
              ) : null
            }
          />
        </div>
      )}

      <section className="mt-5">
        <h2 className="h4 mb-3">Comment ça marche ?</h2>
        <div className="row g-3">
          {ETAPES.map((e) => (
            <div key={e.titre} className="col-md-4">
              <div className="data-card p-4 h-100">
                <span className="stat-ico chip-primary mb-3">
                  <Icone nom={e.icone} taille={20} />
                </span>
                <h3 className="h6">{e.titre}</h3>
                <p className="text-muted small mb-0">{e.texte}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
