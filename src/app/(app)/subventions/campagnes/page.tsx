import { BoutonOuvrir, ModalAction } from "@/components/fiche";
import { Champ, Grille, Zone } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Vide } from "@/components/liste";
import type { CampagneSubvention } from "@/generated/prisma/client";
import { TRANSITIONS_CAMPAGNE_SUBVENTION } from "@/lib/campagne-subvention";
import { isoDate } from "@/lib/forms-util";
import { dateCourte, pluriel } from "@/lib/libelles";
import { ChipCampagne } from "@/modules/subventions/dossier-vues";
import { peutDecider } from "@/modules/subventions/server";
import {
  type CampagneEntree,
  campagneProposee,
  chargerCampagnes,
} from "@/server/campagnes-subvention";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Campagnes de subventions - CityRésa" };

function ChampsCampagne({ v, prefixe }: { v: CampagneEntree; prefixe: string }) {
  return (
    <Grille colonnes={2}>
      <Champ
        label="Exercice"
        name="exercice"
        type="number"
        min={2000}
        max={2100}
        valeur={v.exercice}
        requis
        id={`${prefixe}-exercice`}
      />
      <Champ label="Intitulé" name="label" valeur={v.label} requis id={`${prefixe}-label`} />
      <Champ
        label="Ouverture du dépôt"
        name="ouverture"
        type="date"
        valeur={isoDate(v.ouverture)}
        requis
        id={`${prefixe}-ouverture`}
      />
      <Champ
        label="Clôture du dépôt"
        name="cloture"
        type="date"
        valeur={isoDate(v.cloture)}
        requis
        id={`${prefixe}-cloture`}
        aide="Jour inclus. Un dossier déposé après n'est pas instruit."
      />
      <Zone
        label="Consignes affichées aux associations"
        name="consignes"
        valeur={v.consignes}
        rows={3}
        id={`${prefixe}-consignes`}
      />
    </Grille>
  );
}

export default async function CampagnesSubventionPage() {
  const page = await contexteModule("subventions", "subventions");
  const decide = peutDecider(page.user);
  const liste = await chargerCampagnes();
  const proposee = campagneProposee();
  const entree = (c: CampagneSubvention): CampagneEntree => ({
    exercice: c.exercice,
    label: c.label,
    ouverture: c.ouvertureDate,
    cloture: c.clotureDate,
    consignes: c.consignes,
  });
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Campagnes de subventions <span className="page-count">{liste.length}</span>
          </h1>
          <p className="page-subtitle">
            Une campagne par exercice : les associations déposent leur dossier sur le portail entre
            l'ouverture et la clôture (en général du 1er octobre au 20 novembre).
          </p>
        </div>
        <div className="page-actions">
          <a href="/subventions" className="btn btn-outline-secondary btn-sm">
            <Icone nom="arrow-left" taille={14} /> Dossiers
          </a>
          {decide ? (
            <BoutonOuvrir
              cible="modal-nouvelle"
              libelle="Nouvelle campagne"
              icone="plus"
              classe="btn-primary btn-sm"
            />
          ) : null}
        </div>
      </div>

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Campagne</th>
                <th>Dépôt</th>
                <th>État</th>
                <th className="text-end">Dossiers</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liste.length ? (
                liste.map((c) => {
                  const transitions = decide
                    ? (TRANSITIONS_CAMPAGNE_SUBVENTION[c.status] ?? [])
                    : [];
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="cell2">
                          <a
                            href={`/subventions?campagne=${c.id}`}
                            className="fw-medium"
                            style={{ color: "var(--strong)" }}
                          >
                            {c.label}
                          </a>
                          <small>
                            Exercice {c.exercice}
                            {c.consignes ? " · consignes affichées" : ""}
                          </small>
                        </span>
                      </td>
                      <td className="text-nowrap">
                        du {dateCourte(c.ouvertureDate)} au {dateCourte(c.clotureDate)}
                      </td>
                      <td>
                        <ChipCampagne c={c} />
                      </td>
                      <td className="text-end tabular">{c._count.subventions}</td>
                      <td className="actions">
                        <span className="row-actions">
                          {transitions.map((t) => {
                            const action =
                              t === "ouverte"
                                ? "ouvrir"
                                : t === "cloturee"
                                  ? "cloturer"
                                  : "reprendre";
                            const lib =
                              t === "ouverte"
                                ? "Ouvrir"
                                : t === "cloturee"
                                  ? "Clôturer"
                                  : "Remettre en préparation";
                            const icone =
                              t === "ouverte"
                                ? "lock-open"
                                : t === "cloturee"
                                  ? "lock"
                                  : "rotate-ccw";
                            return (
                              <form
                                key={t}
                                method="POST"
                                action={`/subventions/campagnes/${c.id}/${action}`}
                              >
                                <input type="hidden" name="csrf_token" value={page.csrf} />
                                <button
                                  type="submit"
                                  className="btn btn-ghost btn-icone btn-sm"
                                  title={lib}
                                  aria-label={lib}
                                  data-confirm={`${lib} la campagne ${c.exercice} ?`}
                                >
                                  <Icone nom={icone} taille={14} />
                                </button>
                              </form>
                            );
                          })}
                          {decide ? (
                            <BoutonOuvrir
                              cible={`modal-modifier-${c.id}`}
                              libelle="Modifier"
                              icone="pencil"
                              classe="btn-ghost btn-sm"
                              sansTexte
                            />
                          ) : null}
                          {decide && !c._count.subventions ? (
                            <form method="POST" action={`/subventions/campagnes/${c.id}/supprimer`}>
                              <input type="hidden" name="csrf_token" value={page.csrf} />
                              <button
                                type="submit"
                                className="btn btn-ghost btn-icone btn-sm text-danger"
                                title="Supprimer"
                                aria-label="Supprimer"
                                data-confirm={`Supprimer la campagne ${c.exercice} ?`}
                              >
                                <Icone nom="trash-2" taille={14} />
                              </button>
                            </form>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <Vide
                  colonnes={5}
                  icone="calendar"
                  message="Aucune campagne : créez celle du prochain exercice pour ouvrir le dépôt des dossiers."
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-muted small mt-2">
        {pluriel(
          liste.filter((c) => c.status === "ouverte").length,
          "campagne ouverte",
          "campagnes ouvertes",
        )}
        . Hors période, un agent peut toujours déposer un dossier avec un motif de dérogation.
      </p>

      {decide ? (
        <ModalAction
          id="modal-nouvelle"
          titre="Nouvelle campagne de subventions"
          action="/subventions/campagnes/nouvelle"
          csrf={page.csrf}
          bouton="Créer"
          icone="plus"
          taille="lg"
          aide="Créée en préparation : ouvrez-la pour permettre le dépôt pendant la période."
        >
          <ChampsCampagne v={proposee} prefixe="n" />
        </ModalAction>
      ) : null}
      {decide
        ? liste.map((c) => (
            <ModalAction
              key={c.id}
              id={`modal-modifier-${c.id}`}
              titre={`Modifier ${c.label}`}
              action={`/subventions/campagnes/${c.id}/modifier`}
              csrf={page.csrf}
              bouton="Enregistrer"
              taille="lg"
            >
              <ChampsCampagne v={entree(c)} prefixe={`m${c.id}`} />
            </ModalAction>
          ))
        : null}
    </>
  );
}
