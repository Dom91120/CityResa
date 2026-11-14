/**
 * La frise horaire d'une journée, commune au planning (une ligne par espace) et au planning de
 * service (une ligne par personne) : les heures en abscisse, chaque élément posé à ses heures.
 * Le placement (bornes, niveaux, pourcentages) vient de `lib/frise.ts`.
 */
import type { CSSProperties, ReactNode } from "react";
import { libellePlages, type PlageMinutes } from "@/lib/affectation";
import { empiler, graduations, libelleHeure, positionFrise } from "@/lib/frise";
import { hm } from "@/lib/paris-time";

/** Hauteur d'un niveau de la frise et marge qui l'entoure, en pixels. */
const FRISE_NIVEAU = 50;
const FRISE_MARGE = 6;

/** Un élément à poser sur la frise : ses minutes dans la journée et ce qu'il affiche. */
export type ElementFrise = PlageMinutes & { cle: string; rendu: ReactNode };

/** Le style du tableau : le nombre d'heures montrées, d'où le pas des traits verticaux. */
export function styleFrise(bornes: PlageMinutes): CSSProperties {
  return { "--frise-heures": graduations(bornes).length - 1 } as CSSProperties;
}

/** L'en-tête de la colonne du temps : un repère par heure pleine. */
export function EnteteFrise({ bornes, libelle }: { bornes: PlageMinutes; libelle: string }) {
  return (
    <>
      <span className="visually-hidden">{libelle}, heure par heure</span>
      <div className="frise-heures" aria-hidden="true">
        {graduations(bornes)
          .slice(1, -1)
          .map((m) => (
            <span
              key={m}
              style={{ left: `${positionFrise({ debutMin: m, finMin: m }, bornes).gauche}%` }}
            >
              {libelleHeure(m)}
            </span>
          ))}
      </div>
    </>
  );
}

/** Les cases d'une heure d'une ligne : cliquer réserve à cette heure, déposer y déplace un créneau. */
export type CasesFrise = {
  jour: string;
  espaceId: number;
  /** L'adresse de création d'une réservation à « HH:MM ». */
  creer: (heure: string) => string;
};

/**
 * Le contenu d'une case de la frise (à poser dans un `td`) : plages de fond et mention sur toute la
 * hauteur de la case, cases d'une heure si la ligne est cliquable, puis les éléments à leurs heures —
 * deux éléments simultanés s'empilent et la ligne grandit.
 */
export function PisteFrise({
  elements,
  plages = [],
  titrePlage = "Plage",
  classePlage,
  mention,
  bornes,
  cases,
}: {
  elements: ElementFrise[];
  plages?: PlageMinutes[];
  /** Ce que représente le fond (« Horaires d'ouverture »), pour l'infobulle. */
  titrePlage?: string;
  /** Une variante du fond (« frise-plage--ferme » : heures de fermeture grisées). */
  classePlage?: string;
  /** « Repos », « Fermé » : ce que dit la ligne quand rien n'y est prévu. */
  mention?: string;
  bornes: PlageMinutes;
  cases?: CasesFrise;
}) {
  const { places, niveaux } = empiler(elements);
  return (
    <>
      {plages.map((p) => {
        const pos = positionFrise(p, bornes);
        return (
          <span
            key={p.debutMin}
            className={`frise-plage${classePlage ? ` ${classePlage}` : ""}`}
            style={{ left: `${pos.gauche}%`, width: `${pos.largeur}%` }}
            title={`${titrePlage} : ${libellePlages([p])}`}
          />
        );
      })}
      {mention ? <span className="frise-mention">{mention}</span> : null}
      {cases ? (
        <div className="frise-cases">
          {graduations(bornes)
            .slice(0, -1)
            .map((m) => (
              <div
                key={m}
                className="frise-case jour-cellule"
                data-creer={cases.creer(hm(m))}
                data-jour={cases.jour}
                data-espace-id={cases.espaceId}
                data-heure={hm(m)}
                data-libelle={libelleHeure(m)}
                title={`Cliquer pour réserver à ${libelleHeure(m)}`}
              />
            ))}
        </div>
      ) : null}
      <div className="frise-piste" style={{ height: niveaux * FRISE_NIVEAU + FRISE_MARGE }}>
        {places.map(({ element, niveau }) => {
          const pos = positionFrise(element, bornes);
          return (
            <div
              key={element.cle}
              className="frise-item"
              style={{
                left: `${pos.gauche}%`,
                width: `${pos.largeur}%`,
                top: FRISE_MARGE + niveau * FRISE_NIVEAU,
              }}
            >
              {element.rendu}
            </div>
          );
        })}
      </div>
    </>
  );
}
