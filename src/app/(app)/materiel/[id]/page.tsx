import { notFound } from "next/navigation";
import { Galerie } from "@/components/documents";
import { BoutonOuvrir, Entete, Lu, Lus, MenuPost, MenuSep, Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { VideBloc } from "@/components/liste";
import { Chip, PastilleEspace, StatutResa } from "@/components/macros";
import { CarteStat } from "@/components/stats";
import { dateCourte, dateMoyenne, heure, plageHoraire } from "@/lib/libelles";
import { decrireControle, stockUtilisable } from "@/lib/materiel-stock";
import {
  chargerMateriel,
  reservationsAVenir,
  stockMobilise,
  tarifMateriel,
} from "@/modules/materiel/server";
import { ModalsStock, SectionJournal } from "@/modules/materiel/stock-vues";
import { forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { mouvementsDe } from "@/server/materiel-stock";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Matériel - CityRésa" };

export default async function MaterielFichePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("materiel", "materiel");
  const id = idDeRoute((await params).id);
  const m = await chargerMateriel(id);
  if (!m) notFound();
  const [photos, aVenir, mobilise, mouvements] = await Promise.all([
    forParent("materiel", id, { kinds: ["photo"] }),
    reservationsAVenir(id),
    stockMobilise([id]),
    mouvementsDe(id),
  ]);
  const mob = mobilise.get(id) ?? 0;
  const utilisable = stockUtilisable(m);
  const disponible = Math.max(0, utilisable - mob);
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
            <>
              <BoutonOuvrir
                cible="modal-controle"
                libelle="Contrôle effectué"
                icone="clipboard-check"
                classe="btn-outline-secondary"
              />
              <BoutonOuvrir
                cible="modal-panne"
                libelle="Panne / perte"
                icone="wrench"
                classe="btn-outline-danger"
              />
              {m.horsService ? (
                <BoutonOuvrir
                  cible="modal-remise"
                  libelle="Remettre en service"
                  icone="wrench"
                  classe="btn-outline-success"
                />
              ) : null}
              <a href={`${fiche}/modifier`} className="btn btn-primary js-modifier">
                <Icone nom="pencil" taille={14} /> Modifier
              </a>
            </>
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

      {/* Les mêmes cartes de synthèse que sur le tableau de bord. */}
      <div className="stat-grid stat-grid--5">
        <CarteStat icone="boxes" teinte="lime" label="Stock total" valeur={m.stockTotal} />
        <CarteStat
          icone="wrench"
          teinte={m.horsService ? "red" : "slate"}
          label="Hors service"
          valeur={
            <span style={{ color: m.horsService ? "var(--danger)" : undefined }}>
              {m.horsService}
            </span>
          }
        />
        <CarteStat
          icone="calendar-check"
          teinte="violet"
          label="Mobilisé au plus fort (à venir)"
          valeur={mob}
        />
        <CarteStat
          icone="circle-check"
          teinte={disponible ? "emerald" : "red"}
          label="Disponible"
          valeur={
            <span style={{ color: disponible ? "var(--success)" : "var(--danger)" }}>
              {disponible}
            </span>
          }
        />
        <CarteStat
          icone="clipboard-list"
          teinte="sky"
          label="Dossiers (total)"
          valeur={m._count.reservations}
        />
      </div>

      <div className="fiche-colonnes">
        <div className="data-card overflow-visible">
          <Section titre="Synthèse" icone="package">
            <Lus>
              <Lu label="Catégorie" valeur={m.categorie?.label} tiret />
              <Lu label="Tarification" valeur={tarifMateriel(m)} />
              <Lu label="Contrôle périodique" valeur={decrireControle(m, dateCourte)} pleine />
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
                <table className="table table-hover table-serree">
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
                          <DatesCreneau debut={l.reservation.startAt} fin={l.reservation.endAt} />
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
                          <span
                            className="d-flex align-items-center gap-2"
                            title={l.reservation.espace.name}
                          >
                            <PastilleEspace couleur={l.reservation.espace.color} />
                            {l.reservation.espace.shortName || l.reservation.espace.name}
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
          <SectionJournal mouvements={mouvements} />
        </div>
      </div>
      {peutEditer ? (
        <ModalsStock
          fiche={fiche}
          csrf={page.csrf}
          stockUtilisable={utilisable}
          horsService={m.horsService}
        />
      ) : null}
    </>
  );
}

/** La date sur une ligne, les horaires dessous en petit (deux dates si le créneau déborde). */
function DatesCreneau({ debut, fin }: { debut: Date; fin: Date }) {
  const memeJour = dateMoyenne(debut) === dateMoyenne(fin);
  return (
    <span className="cell2">
      <span>{memeJour ? dateMoyenne(debut) : `du ${dateMoyenne(debut)} à ${heure(debut)}`}</span>
      <small>
        {memeJour ? plageHoraire(debut, fin) : `au ${dateMoyenne(fin)} à ${heure(fin)}`}
      </small>
    </span>
  );
}
