import { notFound } from "next/navigation";
import { Galerie } from "@/components/documents";
import { Entete, Lu, Lus, MenuLien, MenuPost, MenuSep, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { VideBloc } from "@/components/liste";
import { Chip, PastilleEspace } from "@/components/macros";
import { ESPACE_STATUS } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import { premieresPhotos } from "@/modules/espaces/server";
import { adresseComplete, chargerSite, lienCarte } from "@/modules/sites/server";
import { forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Site - CityRésa" };

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("espaces");
  const id = idDeRoute((await params).id);
  const site = await chargerSite(id);
  if (!site) notFound();
  const [photos, vignettes] = await Promise.all([
    forParent("site", id, { kinds: ["photo"] }),
    premieresPhotos(site.espaces.map((e) => e.id)),
  ]);
  const peutEditer = page.user.canEdit("espaces");
  const peutSupprimer = page.user.canDelete("espaces");
  const carte = lienCarte(site);
  const adresse = adresseComplete(site);
  const retour = `/sites/${id}`;
  return (
    <>
      <Entete
        titre={site.name}
        sousTitre={adresse || site.slug}
        retour="/sites"
        badges={
          site.isActive ? null : (
            <Chip teinte="slate" classes="ms-2">
              Inactif
            </Chip>
          )
        }
        actions={
          peutEditer ? (
            <a href={`/sites/${id}/modifier`} className="btn btn-primary js-modifier">
              <Icone nom="pencil" taille={14} /> Modifier
            </a>
          ) : null
        }
        menu={[
          peutEditer ? (
            <MenuLien
              key="espace"
              url={`/espaces/nouveau?site=${id}`}
              libelle="Ajouter un espace"
              icone="plus"
            />
          ) : null,
          carte ? (
            <MenuLien
              key="carte"
              url={carte}
              libelle="Voir sur la carte"
              icone="map"
              cible="_blank"
            />
          ) : null,
          peutSupprimer ? <MenuSep key="sep" /> : null,
          peutSupprimer ? (
            <MenuPost
              key="suppr"
              url={`/sites/${id}/supprimer`}
              libelle={site.espaces.length ? "Désactiver le site" : "Supprimer le site"}
              icone="trash-2"
              csrf={page.csrf}
              danger
              confirm={
                site.espaces.length
                  ? `Ce site compte ${site.espaces.length} espace(s) : il sera désactivé, pas supprimé. Continuer ?`
                  : "Supprimer définitivement ce site ?"
              }
            />
          ) : null,
        ]}
      />

      <div className="fiche-colonnes fiche-colonnes--50-50">
        <div className="data-card overflow-visible">
          <Section titre="Synthèse" icone="map-pin">
            <Lus>
              <Lu label="Adresse" valeur={adresse} />
              <Lu
                label="Carte"
                valeur={
                  carte ? (
                    <a href={carte} target="_blank" rel="noopener">
                      Ouvrir dans OpenStreetMap <Icone nom="external-link" taille={12} />
                    </a>
                  ) : null
                }
              />
              <Lu
                label="Téléphone"
                valeur={site.phone ? <a href={`tel:${site.phone}`}>{site.phone}</a> : null}
              />
              <Lu
                label="Courriel"
                valeur={site.email ? <a href={`mailto:${site.email}`}>{site.email}</a> : null}
              />
              <Lu label="Description" valeur={site.description} pleine pre />
              <Lu label="Accès et transports" valeur={site.accessInfo} pleine pre />
              <Lu label="Position" valeur={String(site.position)} />
              <Lu label="Créé le" valeur={dateCourte(site.createdAt)} />
            </Lus>
          </Section>
          <Section titre="Photos" icone="image" nb={photos.length} ouverte={photos.length > 0}>
            <Galerie
              photos={photos}
              parentKind="site"
              parentId={id}
              csrf={page.csrf}
              next={`${retour}#photos`}
              peutEditer={peutEditer && page.features.documents}
            />
          </Section>
        </div>
        <div className="data-card overflow-visible">
          <Section
            titre="Espaces du site"
            icone="door-open"
            nb={site.espaces.length}
            droite={
              peutEditer ? (
                <a href={`/espaces/nouveau?site=${id}`} className="btn btn-sm btn-outline-primary">
                  <Icone nom="plus" taille={13} /> Ajouter
                </a>
              ) : null
            }
          >
            {site.espaces.length ? (
              <div className="table-responsive">
                <table className="table table-hover table-serree">
                  <thead>
                    <tr>
                      <th />
                      <th>Espace</th>
                      <th>Nature</th>
                      <th className="text-end">
                        <abbr title="Capacité (personnes)">Cap.</abbr>
                      </th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {site.espaces.map((e) => {
                      const st = ESPACE_STATUS[e.status] ?? { label: e.status, teinte: "slate" };
                      const photo = vignettes.get(e.id);
                      return (
                        <tr key={e.id}>
                          <td style={{ width: 56 }}>
                            {photo ? (
                              <img
                                src={`/documents/${photo}/thumb`}
                                alt=""
                                className="vignette"
                                loading="lazy"
                              />
                            ) : (
                              <span className="vignette vignette-vide">
                                <Icone nom="door-open" taille={18} />
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="d-flex align-items-center gap-2 min-w-0">
                              <PastilleEspace couleur={e.color} />
                              <span className="cell2">
                                <a
                                  href={`/espaces/${e.id}`}
                                  className="fw-medium"
                                  style={{ color: "var(--strong)" }}
                                  title={e.name}
                                >
                                  {/* Le site est le titre de la page : le libellé court suffit. */}
                                  {e.shortName || e.name}
                                </a>
                                <small>
                                  {e._count.reservations} réservation
                                  {e._count.reservations > 1 ? "s" : ""}
                                  {e.parentId ? " · sous-espace" : ""}
                                </small>
                              </span>
                            </span>
                          </td>
                          <td className="text-nowrap">
                            {e.nature?.label ?? <span className="text-faint">—</span>}
                          </td>
                          <td className="text-end tabular">
                            {e.capacityStanding ?? e.capacitySeated ?? (
                              <span className="text-faint">—</span>
                            )}
                          </td>
                          <td>
                            <Chip teinte={e.isActive ? st.teinte : "slate"}>
                              {e.isActive ? st.label : "Inactif"}
                            </Chip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <VideBloc
                icone="door-open"
                titre="Aucun espace"
                texte="Ce site n'a pas encore d'espace réservable."
                action={
                  peutEditer ? (
                    <a href={`/espaces/nouveau?site=${id}`} className="btn btn-sm btn-primary">
                      <Icone nom="plus" taille={14} /> Créer un espace
                    </a>
                  ) : null
                }
              />
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
