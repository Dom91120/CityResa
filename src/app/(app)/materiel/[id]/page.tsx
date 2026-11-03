import { notFound } from "next/navigation";
import { Galerie } from "@/components/documents";
import { Entete, Lu, Lus, MenuPost, MenuSep, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { VideBloc } from "@/components/liste";
import { Chip, PastilleEspace, StatutResa } from "@/components/macros";
import { MATERIEL_UNITES } from "@/lib/constantes";
import { dateCourte, plage } from "@/lib/libelles";
import {
  chargerMateriel,
  reservationsAVenir,
  stockMobilise,
  tarifMateriel,
} from "@/modules/materiel/server";
import { forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Matériel - CityRésa" };

export default async function MaterielFichePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("materiel", "materiel");
  const id = idDeRoute((await params).id);
  const m = await chargerMateriel(id);
  if (!m) notFound();
  const [photos, aVenir, mobilise] = await Promise.all([
    forParent("materiel", id, { kinds: ["photo"] }),
    reservationsAVenir(id),
    stockMobilise([id]),
  ]);
  const mob = mobilise.get(id) ?? 0;
  const disponible = Math.max(0, m.stockTotal - mob);
  const peutEditer = page.user.canEdit("materiel");
  const peutSupprimer = page.user.canDelete("materiel");
  const fiche = `/materiel/${id}`;
  return (
    <>
      <Entete
        titre={m.name}
        sousTitre={[m.categorie?.label, tarifMateriel(m)].filter(Boolean).join(" · ")}
        retour="/materiel"
        badges={
          m.isActive ? null : (
            <Chip teinte="slate" classes="ms-2">
              Inactif
            </Chip>
          )
        }
        actions={
          peutEditer ? (
            <a href={`${fiche}/modifier`} className="btn btn-primary js-modifier">
              <Icone nom="pencil" taille={14} /> Modifier
            </a>
          ) : null
        }
        menu={[
          peutSupprimer ? <MenuSep key="sep" /> : null,
          peutSupprimer ? (
            <MenuPost
              key="suppr"
              url={`${fiche}/supprimer`}
              libelle={m._count.reservations ? "Désactiver" : "Supprimer"}
              icone="trash-2"
              csrf={page.csrf}
              danger
              confirm={
                m._count.reservations
                  ? `Ce matériel est utilisé par ${m._count.reservations} dossier(s) : il sera désactivé, pas supprimé. Continuer ?`
                  : "Supprimer définitivement ce matériel ?"
              }
            />
          ) : null,
        ]}
      />

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Stock total</div>
          <div className="stat-number">{m.stockTotal}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Mobilisé (dossiers en cours)</div>
          <div className="stat-number">{mob}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Disponible</div>
          <div
            className="stat-number"
            style={{ color: disponible ? "var(--success)" : "var(--danger)" }}
          >
            {disponible}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Dossiers (total)</div>
          <div className="stat-number">{m._count.reservations}</div>
        </div>
      </div>

      <div className="fiche-colonnes">
        <div className="data-card overflow-visible">
          <Section titre="Synthèse" icone="package">
            <Lus>
              <Lu label="Catégorie" valeur={m.categorie?.label} tiret />
              <Lu
                label="Tarification"
                valeur={`${MATERIEL_UNITES[m.unite] ?? m.unite} · ${tarifMateriel(m)}`}
              />
              <Lu label="Description" valeur={m.description} pleine pre />
              <Lu label="Créé le" valeur={dateCourte(m.createdAt)} />
              <Lu label="Modifié le" valeur={dateCourte(m.updatedAt)} />
            </Lus>
          </Section>
          <Section titre="Photos" icone="image" nb={photos.length} ouverte={photos.length > 0}>
            <Galerie
              photos={photos}
              parentKind="materiel"
              parentId={id}
              csrf={page.csrf}
              next={`${fiche}#photos`}
              peutEditer={peutEditer && page.features.documents}
            />
          </Section>
        </div>
        <div className="data-card overflow-visible">
          <Section
            titre="Réservations à venir qui le mobilisent"
            icone="clipboard-list"
            nb={aVenir.length}
          >
            {aVenir.length ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Dates</th>
                      <th>Dossier</th>
                      <th>Espace</th>
                      <th className="text-end">Qté</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aVenir.map((l) => (
                      <tr key={l.reservationId}>
                        <td className="text-nowrap">
                          {plage(l.reservation.startAt, l.reservation.endAt)}
                        </td>
                        <td>
                          <span className="cell2">
                            <a
                              href={`/reservations/${l.reservation.id}`}
                              className="fw-medium"
                              style={{ color: "var(--strong)" }}
                            >
                              {l.reservation.title}
                            </a>
                            <small>
                              {l.reservation.numero} ·{" "}
                              {l.reservation.organisation?.name ??
                                (l.reservation.user
                                  ? `${l.reservation.user.firstName} ${l.reservation.user.lastName}`
                                  : "—")}
                            </small>
                          </span>
                        </td>
                        <td>
                          <span className="d-flex align-items-center gap-2">
                            <PastilleEspace couleur={l.reservation.espace.color} />
                            {l.reservation.espace.name}
                          </span>
                        </td>
                        <td className="text-end tabular">{l.quantite}</td>
                        <td>
                          <StatutResa status={l.reservation.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <VideBloc
                icone="calendar-check"
                titre="Aucune mobilisation à venir"
                texte="Tout le stock est disponible."
              />
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
