import { notFound } from "next/navigation";
import {
  BoutonOuvrir,
  Entete,
  Lu,
  Lus,
  MenuLien,
  MenuPost,
  ModalAction,
  Section,
} from "@/components/fiche";
import { Champ, Grille, Interrupteur } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import {
  comparer,
  controler,
  decrireCondition,
  INSERTION,
  libelleIntervenant,
  OBJETS,
} from "@/lib/circuits";
import { dateHeure } from "@/lib/libelles";
import { contexteAdmin } from "@/modules/admin/server";
import { chargerCircuit } from "@/modules/processus/server";
import { Logigramme, PastilleNature } from "@/modules/processus/vues";
import { libellesDe, optionsCriteres, referentiel } from "@/server/circuits";
import { prisma } from "@/server/db";
import { idDeRoute } from "@/server/guards";

export const metadata = { title: "Circuit - CityRésa" };

const STATUTS: Record<string, [string, string]> = {
  brouillon: ["Brouillon", "amber"],
  publiee: ["En service", "emerald"],
  archivee: ["Archivée", "slate"],
};

export default async function CircuitPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteAdmin();
  if (!page.features.processus) notFound();
  const id = idDeRoute((await params).id);
  const c = await chargerCircuit(id);
  if (!c) notFound();
  const [ref, options, autres, nbDossiers] = await Promise.all([
    referentiel(),
    optionsCriteres(),
    prisma.circuit.findMany({
      where: { objet: c.objet, id: { not: c.id }, isActive: true },
      select: { name: true, parDefaut: true },
    }),
    c.objet === "subvention"
      ? prisma.subvention.count({ where: { circuitVersion: { circuitId: c.id } } })
      : prisma.reservation.count({ where: { circuitVersion: { circuitId: c.id } } }),
  ]);
  const libelles = libellesDe(options);
  const def = c.definition;
  const ici = `/processus/circuits/${c.id}`;
  const erreurs = controler(c, def, ref, autres);
  const changements =
    c.brouillon && c.definitionPubliee ? comparer(c.definitionPubliee, def, ref) : [];
  const service = def.serviceId ? ref.services.get(def.serviceId) : null;
  const bouton = (action: string, cle: string, icone: string, titre: string, danger = false) => (
    <form method="POST" action={ici} className="d-inline">
      <input type="hidden" name="csrf_token" value={page.csrf} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="cle" value={cle} />
      <button
        type="submit"
        className={`btn btn-ghost btn-icone btn-sm${danger ? " btn-ghost-danger" : ""}`}
        title={titre}
        aria-label={titre}
        data-confirm={danger ? `${titre} ?` : undefined}
      >
        <Icone nom={icone} taille={14} />
      </button>
    </form>
  );

  return (
    <>
      <Entete
        retour="/processus"
        titre={c.name}
        badges={
          <>
            <Chip teinte={c.objet === "subvention" ? "lime" : "sky"}>{OBJETS[c.objet]}</Chip>
            {c.parDefaut ? <Chip teinte="slate">Par défaut</Chip> : null}
            {c.publiee ? (
              <Chip teinte="emerald">v{c.publiee.numero} en service</Chip>
            ) : (
              <Chip teinte="amber">Jamais publié</Chip>
            )}
            {c.brouillon ? <Chip teinte="amber">Brouillon v{c.brouillon.numero}</Chip> : null}
            {c.isActive ? null : <Chip teinte="slate">Inactif</Chip>}
          </>
        }
        sousTitre={
          c.description ??
          (c.objet === "subvention"
            ? "Circuit des demandes de subvention"
            : "Circuit des demandes de réservation")
        }
        actions={
          <>
            <BoutonOuvrir
              cible="modal-identite"
              libelle="Modifier"
              icone="pencil"
              classe="btn-outline-secondary"
            />
            {c.brouillon ? (
              <BoutonOuvrir cible="modal-publier" libelle="Publier" icone="send" />
            ) : null}
          </>
        }
        menu={[
          <MenuLien
            key="sim"
            url={`/processus/simulation?brouillons=1`}
            libelle="Simuler avec les brouillons"
            icone="flask-conical"
          />,
          c.brouillon && c.publiee ? (
            <MenuPost
              key="abandon"
              url={ici}
              champs={{ action: "abandonner" }}
              libelle="Abandonner le brouillon"
              icone="rotate-ccw"
              csrf={page.csrf}
              confirm="Abandonner les modifications en cours et revenir à la version en service ?"
            />
          ) : null,
          nbDossiers === 0 ? (
            <MenuPost
              key="sup"
              url={ici}
              champs={{ action: "supprimer" }}
              libelle="Supprimer le circuit"
              icone="trash-2"
              csrf={page.csrf}
              danger
              confirm={`Supprimer le circuit « ${c.name} » et ses versions ?`}
            />
          ) : null,
        ]}
      />

      {c.brouillon ? (
        <div className={`astuce mb-3${erreurs.length ? " astuce-alerte" : ""}`}>
          <Icone nom={erreurs.length ? "triangle-alert" : "info"} taille={16} />
          <div>
            {erreurs.length ? (
              <>
                <strong>Ce brouillon ne peut pas encore être publié.</strong>
                <ul className="mb-0 ps-3">
                  {erreurs.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <strong>Brouillon prêt à être publié.</strong>{" "}
                {c.publiee
                  ? "Les dossiers en cours gardent la version en service ; les nouvelles demandes suivront celle-ci."
                  : "Tant qu'il n'est pas publié, ce circuit ne reçoit aucun dossier."}
              </>
            )}
            {changements.length ? (
              <div className="small text-muted mt-1">
                Depuis la v{c.publiee?.numero} : {changements.join(" ")}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="fiche-colonnes">
        <div className="data-card">
          <Section
            titre="Aiguillage"
            icone="git-fork"
            droite={
              <a href={`${ici}/aiguillage`} className="btn btn-sm btn-outline-secondary">
                <Icone nom="pencil" taille={13} /> Modifier
              </a>
            }
          >
            <Lus colonnes={1} intitule="110px">
              <Lu
                label="Reçoit"
                valeur={
                  c.parDefaut
                    ? "Tout dossier qu'aucun autre circuit ne prend"
                    : decrireCondition(def.condition, libelles, "Aucune règle pour l'instant")
                }
              />
              {c.parDefaut ? null : <Lu label="Ordre d'examen" valeur={String(c.position)} />}
              <Lu
                label="Confié à"
                valeur={
                  service
                    ? service.name
                    : c.objet === "subvention"
                      ? "Aucun service : les agents qui ont l'écriture sur les subventions"
                      : "Aucun service : les agents chargés de l'espace"
                }
              />
              <Lu label="Dossiers" valeur={`${nbDossiers} dossier(s) ont suivi ce circuit`} />
            </Lus>
          </Section>

          <Section
            titre={INSERTION[c.objet].titre}
            icone="list-checks"
            nb={def.etapes.length}
            droite={
              <a href={`${ici}/etape`} className="btn btn-sm btn-outline-secondary">
                <Icone nom="plus" taille={13} /> Ajouter
              </a>
            }
          >
            {def.etapes.length ? (
              <ul className="liste-simple mb-0" style={{ margin: "0 -18px" }}>
                {def.etapes.map((e, i) => (
                  <li key={e.cle}>
                    <span className="cell2" style={{ flex: 1, whiteSpace: "normal" }}>
                      <span>
                        <a href={`${ici}/etape?cle=${e.cle}`} className="fw-semibold">
                          {e.libelle}
                        </a>{" "}
                        <PastilleNature nature={e.nature} />
                      </span>
                      <small>
                        {libelleIntervenant(e.intervenant, ref)} · si :{" "}
                        {decrireCondition(e.condition, libelles, "toujours").toLowerCase()}
                        {e.delaiJours ? ` · sous ${e.delaiJours} j` : ""}
                      </small>
                    </span>
                    <span className="row-actions">
                      {i > 0
                        ? bouton("monter", e.cle, "chevron-up", `Monter « ${e.libelle} »`)
                        : null}
                      {i < def.etapes.length - 1
                        ? bouton("descendre", e.cle, "chevron-down", `Descendre « ${e.libelle} »`)
                        : null}
                      {bouton(
                        "etape-supprimer",
                        e.cle,
                        "trash-2",
                        `Retirer « ${e.libelle} »`,
                        true,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted small mb-0">
                {c.objet === "subvention"
                  ? "Aucun élu nommé : tout compte qui a l'écriture sur les subventions peut donner un avis."
                  : "Aucune étape : une demande s'accepte comme aujourd'hui, sans relecture, avis ni visa."}
              </p>
            )}
          </Section>

          <Section titre="Versions" icone="history" nb={c.versions.length} ouverte={false}>
            <ul className="liste-simple mb-0" style={{ margin: "0 -18px" }}>
              {c.versions.map((v) => (
                <li key={v.id}>
                  <span className="cell2" style={{ flex: 1, whiteSpace: "normal" }}>
                    <span>
                      Version {v.numero}{" "}
                      <Chip teinte={STATUTS[v.status]?.[1] ?? "slate"}>
                        {STATUTS[v.status]?.[0] ?? v.status}
                      </Chip>
                    </span>
                    <small>
                      {v.publieAt
                        ? `publiée le ${dateHeure(v.publieAt)} par ${v.publiePar ?? "—"}`
                        : `créée le ${dateHeure(v.createdAt)} par ${v.createdBy ?? "—"}`}
                      {v.note ? ` · ${v.note}` : ""}
                    </small>
                  </span>
                  {v.status === "archivee" && !c.brouillon ? (
                    <form method="POST" action={ici}>
                      <input type="hidden" name="csrf_token" value={page.csrf} />
                      <input type="hidden" name="action" value="reprendre" />
                      <input type="hidden" name="version" value={v.id} />
                      <button type="submit" className="btn btn-sm btn-outline-secondary">
                        Reprendre en brouillon
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="data-card">
          <Section
            titre={c.brouillon ? `Logigramme · brouillon v${c.brouillon.numero}` : "Logigramme"}
            icone="workflow"
          >
            <Logigramme
              definition={def}
              referentiel={ref}
              libelles={libelles}
              parDefaut={c.parDefaut}
              objet={c.objet}
            />
          </Section>
        </div>
      </div>

      <ModalAction id="modal-identite" titre="Modifier le circuit" action={ici} csrf={page.csrf}>
        <input type="hidden" name="action" value="identite" />
        <Grille colonnes={2}>
          <Champ label="Nom" name="name" id="ci-name" requis pleine valeur={c.name} />
          <Champ
            label="Description"
            name="description"
            id="ci-desc"
            pleine
            valeur={c.description}
          />
          <Champ
            label="Ordre d'examen"
            name="position"
            id="ci-pos"
            type="number"
            min={0}
            valeur={c.position}
            aide="Du plus petit au plus grand ; le premier circuit dont la règle s'applique reçoit le dossier."
          />
          <div>
            <Interrupteur
              label="Circuit par défaut"
              name="par_defaut"
              id="ci-defaut"
              coche={c.parDefaut}
              aide="Reçoit ce qu'aucune règle ne prend. Un seul par type de dossier."
            />
            <Interrupteur label="Circuit actif" name="is_active" id="ci-actif" coche={c.isActive} />
          </div>
        </Grille>
      </ModalAction>

      {c.brouillon ? (
        <ModalAction
          id="modal-publier"
          titre={`Publier la version ${c.brouillon.numero}`}
          action={ici}
          csrf={page.csrf}
          bouton="Publier"
          icone="send"
          aide="La version publiée s'applique aux demandes créées à partir de maintenant. Les dossiers en cours gardent la leur."
        >
          <input type="hidden" name="action" value="publier" />
          <Champ
            label="Note de version"
            name="note"
            id="cp-note"
            placeholder="Ce qui change, et pourquoi"
          />
        </ModalAction>
      ) : null}
    </>
  );
}
