import { notFound } from "next/navigation";
import { ModalAction, Section } from "@/components/fiche";
import { Zone } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { SegTabs, VideBloc } from "@/components/liste";
import { Chip } from "@/components/macros";
import { NATURES, OBJETS } from "@/lib/circuits";
import { dateCourte, depuis, montant } from "@/lib/libelles";
import { Logigramme, PastilleNature } from "@/modules/processus/vues";
import {
  circuitsEnService,
  etapesEnAttente,
  libellesDe,
  optionsCriteres,
  referentiel,
} from "@/server/circuits";
import { avisAttendus } from "@/server/circuits-subvention";
import { contextePage } from "@/server/page";

export const metadata = { title: "Mes étapes - CityRésa" };

export default async function EtapesPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const page = await contextePage();
  if (!page.features.processus) notFound();
  const vue = (await searchParams).vue ?? "miennes";
  const toutes = await etapesEnAttente(page.user, true);
  const miennes = toutes.filter((e) => e.pourMoi);
  const liste = vue === "toutes" ? toutes : miennes;
  // Les avis que les circuits des subventions demandent aux élus.
  const tousAvis = page.features.subventions ? await avisAttendus(page.user, true) : [];
  const mesAvis = tousAvis.filter((a) => a.pourMoi);
  const avis = vue === "toutes" ? tousAvis : mesAvis;
  const nbPourMoi = miennes.length + mesAvis.length;
  const circuits =
    vue === "circuits"
      ? [
          ...(await circuitsEnService("reservation")).map((c) => ({
            ...c,
            objet: "reservation" as const,
          })),
          ...(await circuitsEnService("subvention")).map((c) => ({
            ...c,
            objet: "subvention" as const,
          })),
        ]
      : [];
  const [ref, options] =
    vue === "circuits" ? await Promise.all([referentiel(), optionsCriteres()]) : [null, null];
  const maintenant = Date.now();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Mes étapes <span className="page-count">{nbPourMoi}</span>
          </h1>
          <p className="page-subtitle">
            Les relectures, avis et visas que les circuits vous demandent avant qu'une demande soit
            acceptée.
          </p>
        </div>
      </div>

      <SegTabs
        tabs={[
          { href: "/etapes", label: "Pour moi", count: nbPourMoi, active: vue === "miennes" },
          {
            href: "/etapes?vue=toutes",
            label: "Toutes les étapes en attente",
            count: toutes.length + tousAvis.length,
            active: vue === "toutes",
            teinte: "muted",
          },
          {
            href: "/etapes?vue=circuits",
            label: "Circuits en service",
            active: vue === "circuits",
          },
        ]}
      />

      {vue === "circuits" && ref && options ? (
        <div className="data-card">
          {[...circuits]
            .sort(
              (a, b) =>
                a.objet.localeCompare(b.objet) ||
                Number(a.parDefaut) - Number(b.parDefaut) ||
                a.position - b.position,
            )
            .map((c) => (
              <Section
                key={c.id}
                titre={`${OBJETS[c.objet]} · ${c.name}`}
                icone="workflow"
                ouverte={circuits.length <= 3}
              >
                <Logigramme
                  definition={c.definition}
                  referentiel={ref}
                  libelles={libellesDe(options)}
                  parDefaut={c.parDefaut}
                  objet={c.objet}
                />
              </Section>
            ))}
        </div>
      ) : (
        <div className="data-card">
          {liste.length ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Étape</th>
                    <th>Dossier</th>
                    <th>Ce qui est soumis</th>
                    <th>Demandée</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {liste.map((e) => {
                    const retard = e.echeanceAt && e.echeanceAt.getTime() < maintenant;
                    return (
                      <tr key={e.id}>
                        <td>
                          <span className="cell2">
                            <span>
                              <strong>{e.libelle}</strong> <PastilleNature nature={e.nature} />
                            </span>
                            <small>{e.intervenant}</small>
                          </span>
                        </td>
                        <td className="col-souple col-souple--large">
                          <span className="cell2" style={{ whiteSpace: "normal" }}>
                            <a href={`${e.dossier.lien}#circuit`} className="fw-semibold">
                              {e.dossier.numero} · {e.dossier.title}
                            </a>
                            <small>
                              {e.dossier.objet === "subvention"
                                ? e.dossier.detail
                                : `${e.dossier.demandeur} · ${e.dossier.detail}`}
                            </small>
                          </span>
                        </td>
                        <td className="col-souple">
                          {e.contexte ?? <span className="text-faint">—</span>}
                        </td>
                        <td>
                          <span className="cell2">
                            <span>{depuis(e.ouvertAt)}</span>
                            <small>
                              par {e.ouvertPar ?? "—"}
                              {e.dossier.service ? ` · ${e.dossier.service}` : ""}
                            </small>
                            {e.echeanceAt ? (
                              <Chip teinte={retard ? "red" : "slate"}>
                                {retard ? "En retard · " : "Attendue le "}
                                {dateCourte(e.echeanceAt)}
                              </Chip>
                            ) : null}
                          </span>
                        </td>
                        <td className="text-end text-nowrap">
                          {e.pourMoi ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                data-bs-toggle="modal"
                                data-bs-target={`#modal-accord-${e.id}`}
                              >
                                <Icone nom="check" taille={13} /> {NATURES[e.nature].issues[0]}
                              </button>{" "}
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                data-bs-toggle="modal"
                                data-bs-target={`#modal-refus-${e.id}`}
                              >
                                {NATURES[e.nature].issues[1]}
                              </button>
                            </>
                          ) : (
                            <a
                              href={`${e.dossier.lien}#circuit`}
                              className="btn btn-sm btn-outline-secondary"
                            >
                              Voir
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : avis.length ? null : (
            <VideBloc
              icone="list-checks"
              titre={vue === "toutes" ? "Aucune étape en attente" : "Rien ne vous attend"}
              texte="Quand le circuit d'une demande prévoit une relecture, un avis ou un visa qui vous revient, il apparaît ici et vous êtes prévenu par la cloche."
            />
          )}
          {avis.length ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Avis sur une subvention</th>
                    <th>Dossier</th>
                    <th className="text-end">Demandé</th>
                    <th>Soumis aux élus</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {avis.map((a) => (
                    <tr key={`${a.id}-${a.libelle}`}>
                      <td>
                        <span className="cell2">
                          <span>
                            <strong>{a.libelle}</strong> <PastilleNature nature="avis" />
                          </span>
                          <small>{a.intervenant}</small>
                        </span>
                      </td>
                      <td className="col-souple col-souple--large">
                        <span className="cell2" style={{ whiteSpace: "normal" }}>
                          <a href={`/subventions/${a.id}#avis`} className="fw-semibold">
                            {a.numero} · {a.objet}
                          </a>
                          <small>
                            {a.association} · exercice {a.exercice}
                            {a.service ? ` · instruit par ${a.service}` : ""}
                          </small>
                        </span>
                      </td>
                      <td className="text-end tabular">{montant(a.montantDemande)}</td>
                      <td>{depuis(a.depuis)}</td>
                      <td className="text-end text-nowrap">
                        <a
                          href={`/subventions/${a.id}#avis`}
                          className={`btn btn-sm ${a.pourMoi ? "btn-primary" : "btn-outline-secondary"}`}
                        >
                          {a.pourMoi ? "Donner mon avis" : "Voir"}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}

      {miennes.map((e) => (
        <div key={e.id}>
          <ModalAction
            id={`modal-accord-${e.id}`}
            titre={`${NATURES[e.nature].issues[0]} · ${e.dossier.numero}`}
            action={`/etapes/${e.id}`}
            csrf={page.csrf}
            bouton={NATURES[e.nature].issues[0]}
          >
            <input type="hidden" name="reponse" value="accord" />
            <input type="hidden" name="next" value="/etapes" />
            <Zone
              label="Commentaire (facultatif)"
              name="commentaire"
              id={`acc-${e.id}`}
              rows={3}
              placeholder="Conditions, précisions pour le service"
            />
          </ModalAction>
          <ModalAction
            id={`modal-refus-${e.id}`}
            titre={`${NATURES[e.nature].issues[1]} · ${e.dossier.numero}`}
            action={`/etapes/${e.id}`}
            csrf={page.csrf}
            bouton={NATURES[e.nature].issues[1]}
            danger
          >
            <input type="hidden" name="reponse" value="refus" />
            <input type="hidden" name="next" value="/etapes" />
            <Zone
              label="Motif"
              name="commentaire"
              id={`ref-${e.id}`}
              rows={3}
              requis
              placeholder="Ce qui doit être revu : le service le lira sur le dossier"
            />
          </ModalAction>
        </div>
      ))}
    </>
  );
}
