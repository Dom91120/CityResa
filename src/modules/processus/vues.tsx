/**
 * Processus et circuits : éléments d'écran partagés (saisie d'une condition, logigramme,
 * pastilles d'étape).
 */
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import {
  A_ECHEANCE,
  type Condition,
  type Critere,
  CYCLES,
  criteresDe,
  type Definition,
  decrireCondition,
  type Etape,
  type EtatEtape,
  type Libelles,
  libelleIntervenant,
  MOMENTS,
  type Moment,
  NATURES,
  type Nature,
  type Objet,
  RETENU,
  REUNIONS,
  type Referentiel,
} from "@/lib/circuits";

const GROUPES: Critere["groupe"][] = ["Espace", "Demandeur", "Dossier"];

/**
 * La saisie d'une condition : un réglage par critère (indifférent par défaut), réunis par
 * « et » ou par « ou ». Sans script : chaque critère a le champ qui convient à son type.
 */
export function ChampsCondition({
  condition,
  options,
  prefixe = "",
  objet = "reservation",
}: {
  condition: Condition | null;
  options: Record<string, [string, string][]>;
  prefixe?: string;
  /** Le type de dossier : il fixe les critères proposés. */
  objet?: Objet;
}) {
  const criteres = criteresDe(objet);
  const test = (cle: string) => condition?.tests.find((t) => t.champ === cle);
  return (
    <div className="condition">
      <div className="condition-mode">
        <label>
          <input
            type="radio"
            name={`${prefixe}mode`}
            value="tous"
            defaultChecked={condition?.mode !== "un"}
          />{" "}
          Tous les critères renseignés doivent être vrais
        </label>
        <label>
          <input
            type="radio"
            name={`${prefixe}mode`}
            value="un"
            defaultChecked={condition?.mode === "un"}
          />{" "}
          Un seul suffit
        </label>
      </div>
      {GROUPES.filter((g) => criteres.some((c) => c.groupe === g)).map((g) => (
        <fieldset key={g} className="condition-groupe">
          <legend>{g}</legend>
          {criteres
            .filter((c) => c.groupe === g)
            .map((c) => {
              const t = test(c.cle);
              const nom = `${prefixe}c_${c.cle}`;
              const ident = `${prefixe}crit-${c.cle}`;
              return (
                <div key={c.cle} className="condition-ligne">
                  <label
                    className="condition-label"
                    htmlFor={c.type === "liste" ? undefined : ident}
                  >
                    {c.label}
                    {c.aide ? <small>{c.aide}</small> : null}
                  </label>
                  {c.type === "bool" ? (
                    <select
                      name={nom}
                      id={ident}
                      className="form-select form-select-sm"
                      defaultValue={t?.op === "est" ? (t.valeur ? "1" : "0") : ""}
                    >
                      <option value="">Indifférent</option>
                      <option value="1">Oui</option>
                      <option value="0">Non</option>
                    </select>
                  ) : c.type === "nombre" ? (
                    <span className="condition-nombre">
                      <select
                        name={`${prefixe}o_${c.cle}`}
                        className="form-select form-select-sm"
                        defaultValue={t && t.op !== "est" && t.op !== "parmi" ? t.op : ""}
                        aria-label={`${c.label} : comparaison`}
                      >
                        <option value="">Indifférent</option>
                        <option value="min">au moins</option>
                        <option value="max">au plus</option>
                      </select>
                      <input
                        type="number"
                        name={nom}
                        id={ident}
                        className="form-control form-control-sm"
                        defaultValue={t && typeof t.valeur === "number" ? t.valeur : ""}
                        step="any"
                      />
                      {c.unite ? <span className="text-muted small">{c.unite}</span> : null}
                    </span>
                  ) : (
                    <details className="condition-liste" open={Boolean(t) || undefined}>
                      <summary>
                        {t?.op === "parmi" ? `${t.valeur.length} retenu(s)` : "Indifférent"}
                      </summary>
                      <div className="coches">
                        {(c.options ?? options[c.cle] ?? []).map(([v, l]) => (
                          <label key={v}>
                            <input
                              type="checkbox"
                              name={nom}
                              value={v}
                              defaultChecked={t?.op === "parmi" && t.valeur.includes(v)}
                            />
                            {l}
                          </label>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
        </fieldset>
      ))}
    </div>
  );
}

export function PastilleNature({ nature }: { nature: Nature }) {
  const n = NATURES[nature];
  return (
    <Chip teinte={n.teinte}>
      <Icone nom={n.icone} taille={12} /> {n.label}
    </Chip>
  );
}

const ETATS: Record<EtatEtape, [string, string]> = {
  a_demander: ["À demander", "slate"],
  ouverte: ["En attente", "amber"],
  validee: ["Accordé", "emerald"],
  refusee: ["Refusé", "red"],
};

export function PastilleEtat({ etat, nature }: { etat: EtatEtape; nature: Nature }) {
  const [, teinte] = ETATS[etat];
  const libelle =
    etat === "validee"
      ? NATURES[nature].issues[0]
      : etat === "refusee"
        ? NATURES[nature].issues[1]
        : ETATS[etat][0];
  return (
    <Chip teinte={teinte} dot>
      {libelle}
    </Chip>
  );
}

/** Le logigramme d'un circuit : le cycle de fond, et les étapes que le circuit y insère. */
export function Logigramme({
  definition,
  referentiel,
  libelles,
  parDefaut,
  objet = "reservation",
}: {
  definition: Definition;
  referentiel: Referentiel;
  libelles: Libelles;
  parDefaut: boolean;
  objet?: Objet;
}) {
  const service = definition.serviceId ? referentiel.services.get(definition.serviceId) : null;
  const cycle = CYCLES[objet];
  // Les étapes d'une annulation ou d'une réquisition viennent après l'acceptation.
  const tardifs: readonly Moment[] = [
    "avant_annulation",
    "avant_requisition",
    "avant_retenue",
    "avant_facture",
    "avant_versement",
  ];
  const avant = definition.etapes.filter((e) => !tardifs.includes(e.moment));
  const apres = definition.etapes.filter((e) => tardifs.includes(e.moment));
  const noeud = (e: Etape) => {
    const n = NATURES[e.nature];
    return (
      <li key={e.cle} className={`logi-noeud logi-etape logi-${n.bloquante ? "bloque" : "libre"}`}>
        <Icone nom={n.icone} taille={15} />
        <div>
          <strong>
            {e.libelle} <PastilleNature nature={e.nature} />
          </strong>
          <span>
            {libelleIntervenant(e.intervenant, referentiel)}
            {e.reunion !== "un" && e.moment !== "avis_elus"
              ? ` · ${REUNIONS[e.reunion].court}`
              : ""}
            {e.delaiJours ? ` · sous ${e.delaiJours} j` : ""}
            {e.aEcheance === "accord" ? ` · ${A_ECHEANCE.accord.court}` : ""}
            {e.copie ? ` · en copie : ${libelleIntervenant(e.copie, referentiel)}` : ""}
            {e.moment === "avis_elus"
              ? " · consulté à la soumission aux élus"
              : n.bloquante
                ? ` · retient ${RETENU[e.moment]}`
                : " · ne retient rien"}
          </span>
          {e.moment === "avis_elus" ? null : <span>{MOMENTS[e.moment]}</span>}
          <span className="logi-condition">
            <Icone nom="filter" taille={12} /> {decrireCondition(e.condition, libelles)}
          </span>
        </div>
      </li>
    );
  };
  return (
    <ol className="logigramme">
      <li className="logi-noeud logi-entree">
        <Icone nom="git-fork" taille={15} />
        <div>
          <strong>Aiguillage</strong>
          <span>
            {parDefaut
              ? "Tout dossier qu'aucun autre circuit ne prend"
              : decrireCondition(definition.condition, libelles, "Aucune règle : aucun dossier")}
          </span>
        </div>
      </li>
      <li className="logi-noeud logi-socle">
        <Icone nom="inbox" taille={15} />
        <div>
          <strong>{cycle.depart.titre}</strong>
          <span>
            Instruction par {service ? service.name : cycle.sansService} : {cycle.depart.texte}
          </span>
        </div>
      </li>
      {avant.map(noeud)}
      <li className="logi-noeud logi-socle">
        <Icone nom="circle-check" taille={15} />
        <div>
          <strong>{cycle.decision.titre}</strong>
          <span>{cycle.decision.texte}</span>
        </div>
      </li>
      {apres.map(noeud)}
      <li className="logi-noeud logi-socle">
        <Icone nom="pen-line" taille={15} />
        <div>
          <strong>{cycle.fin.titre}</strong>
          <span>{cycle.fin.texte}</span>
        </div>
      </li>
    </ol>
  );
}
