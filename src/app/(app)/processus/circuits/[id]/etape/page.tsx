import { notFound } from "next/navigation";
import { Champ, EnteteForm, Grille, PiedForm, SectionForm, Select } from "@/components/formulaire";
import { A_ECHEANCE, INSERTION, MOMENTS, NATURES, REUNIONS } from "@/lib/circuits";
import { chargerCircuit, choixIntervenants, valeurIntervenant } from "@/modules/processus/server";
import { ChampsCondition } from "@/modules/processus/vues";
import { optionsCriteres } from "@/server/circuits";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Étape du circuit - CityRésa" };

export default async function EtapePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cle?: string }>;
}) {
  const page = await contexteModule("processus", "processus");
  if (!page.user.canEdit("processus"))
    redirigerAvecFlashDepuisRendu(
      "/processus",
      "Vous consultez les circuits : les modifier demande l'écriture sur « Processus et circuits ».",
      "danger",
    );
  if (!page.features.processus) notFound();
  const c = await chargerCircuit(idDeRoute((await params).id));
  if (!c) notFound();
  const cle = (await searchParams).cle ?? "";
  const e = c.definition.etapes.find((x) => x.cle === cle) ?? null;
  if (cle && !e) notFound();
  const [options, intervenants] = await Promise.all([optionsCriteres(), choixIntervenants()]);
  const retour = `/processus/circuits/${c.id}`;
  const actuel = e ? valeurIntervenant(e.intervenant) : "";
  return (
    <>
      <EnteteForm
        titre={e ? `Étape · ${e.libelle}` : "Nouvelle étape"}
        retour={retour}
        sousTitre={c.name}
      />
      <form method="POST" action={retour} id="form-principal" data-double-envoi>
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <input type="hidden" name="action" value="etape" />
        <input type="hidden" name="cle" value={e?.cle ?? ""} />
        <div className="data-card">
          <SectionForm titre="L'étape" icone="list-checks">
            <Grille colonnes={2}>
              <Champ
                label="Libellé"
                name="libelle"
                requis
                valeur={e?.libelle}
                placeholder="Visa de l'élu"
                aide="Ce que lisent les agents sur le dossier."
              />
              <Select
                label="Nature"
                name="nature"
                requis
                options={INSERTION[c.objet].natures
                  .map((k) => [k, NATURES[k]] as const)
                  .map(([k, n]) => [
                    k,
                    `${n.label} — ${n.bloquante ? "retient le geste" : "ne retient rien"}`,
                  ])}
                valeur={e?.nature ?? (c.objet === "subvention" ? "avis" : "visa")}
                aide="Relecture et visa retiennent le geste tant qu'ils ne sont pas accordés ; un avis éclaire sans retenir."
              />
              <div>
                <label className="form-label" htmlFor="f-intervenant">
                  Qui répond <span className="req"> *</span>
                </label>
                <select
                  name="intervenant"
                  id="f-intervenant"
                  className="form-select"
                  defaultValue={actuel}
                  required
                >
                  <option value="">— choisir —</option>
                  {intervenants.map((g) => (
                    <optgroup key={g.groupe} label={g.groupe}>
                      {g.options.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="form-text">
                  Un service ou un rôle désigne plusieurs personnes : la règle ci-contre dit combien
                  doivent répondre.
                </div>
              </div>
              <Select
                label="Réponses attendues"
                name="reunion"
                requis
                options={Object.entries(REUNIONS).map(([k, r]) => [k, r.label])}
                valeur={e?.reunion ?? "un"}
                aide="Tous : chacun doit accorder, un refus suffit à refuser. Majorité : plus de la moitié des personnes désignées. Sans effet sur l'avis des élus d'une subvention, donné par chacun."
              />
              <Select
                label="Moment"
                name="moment"
                requis
                options={INSERTION[c.objet].moments.map((m) => [m, MOMENTS[m]])}
                valeur={e?.moment ?? INSERTION[c.objet].moments[0]}
                aide={
                  c.objet === "subvention"
                    ? "Les élus nommés sont consultés quand le dossier leur est soumis."
                    : "Le geste que l'étape précède : une relecture ou un visa le retient tant qu'il n'est pas accordé."
                }
              />
              <Champ
                label="Délai indicatif (jours)"
                name="delai_jours"
                type="number"
                min={0}
                max={365}
                valeur={e?.delaiJours ?? 0}
                aide="0 = sans échéance. Passé le délai, l'étape est signalée en retard."
              />
              <Select
                label="À l'échéance, sans réponse"
                name="a_echeance"
                requis
                options={Object.entries(A_ECHEANCE).map(([k, v]) => [k, v.label])}
                valeur={e?.aEcheance ?? "relance"}
                aide="Relancer : l'étape continue d'attendre. Tenir pour accordée : le silence vaut accord, l'étape est validée d'office et le demandeur est prévenu ; demande un délai."
              />
              <Champ
                label="Ce que lit l'usager pendant l'étape"
                name="libelle_usager"
                pleine
                valeur={e?.libelleUsager}
                placeholder="Votre demande est en cours de validation"
                aide="Laissez vide pour une étape invisible de l'usager."
              />
            </Grille>
          </SectionForm>
          <SectionForm
            titre="Quand l'étape s'applique"
            icone="filter"
            aide="Sans aucun critère, l'étape s'applique à tous les dossiers du circuit."
          >
            <ChampsCondition condition={e?.condition ?? null} options={options} objet={c.objet} />
          </SectionForm>
        </div>
        <PiedForm retour={retour} libelle={e ? "Enregistrer" : "Ajouter l'étape"} />
      </form>
    </>
  );
}
