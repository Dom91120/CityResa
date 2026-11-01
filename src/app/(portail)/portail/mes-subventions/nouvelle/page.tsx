import { notFound, redirect } from "next/navigation";
import { Champ, Select, Zone } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { SUBVENTION_TYPES } from "@/lib/constantes";
import { organisationDe } from "@/modules/portail/catalogue";
import { contexteUsager } from "@/server/page";

export const metadata = { title: "Nouvelle demande de subvention - CityRésa" };

export default async function NouvelleSubventionPage() {
  const page = await contexteUsager();
  if (!page.features.subventions) notFound();
  const org = await organisationDe(page.user);
  if (org?.type !== "association") redirect("/portail/mes-subventions");
  const annee = new Date().getFullYear();
  const retour = "/portail/mes-subventions";
  return (
    <>
      <div className="page-header">
        <div className="d-flex align-items-center" style={{ gap: 12 }}>
          <a href={retour} className="fiche-retour" title="Retour" aria-label="Retour">
            <Icone nom="arrow-left" taille={16} />
          </a>
          <div>
            <h1 className="page-title">Nouvelle demande de subvention</h1>
            <p className="page-subtitle">Au nom de {org.name}.</p>
          </div>
        </div>
      </div>
      <div className="astuce mb-3">
        <Icone nom="lightbulb" taille={18} />
        <div>
          Décrivez clairement le projet ou l'activité à financer. Après l'envoi, vous pourrez
          joindre vos pièces (budget prévisionnel, bilan, RIB…) depuis la fiche de la demande.
        </div>
      </div>
      <form
        method="POST"
        action="/portail/mes-subventions/nouvelle"
        id="form-principal"
        className="data-card p-4"
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <div className="grille grille-3">
          <Champ
            label="Exercice"
            name="exercice"
            type="number"
            valeur={annee}
            min={annee - 1}
            max={annee + 2}
            requis
          />
          <Select
            label="Type de subvention"
            name="type"
            options={Object.entries(SUBVENTION_TYPES)}
            valeur="fonctionnement"
            requis
          />
          <Champ
            label="Montant demandé (€)"
            name="montant_demande"
            type="number"
            min={0}
            step="0.01"
            requis
          />
          <Champ
            label="Objet de la demande"
            name="objet"
            requis
            pleine
            placeholder="Ex. : Fonctionnement 2026, tournoi de printemps…"
          />
          <Zone
            label="Description du projet ou de l'activité"
            name="description"
            rows={6}
            placeholder="Objectifs, public visé, calendrier, partenaires…"
          />
          <Champ
            label="Budget total du projet (€)"
            name="budget_total"
            type="number"
            min={0}
            step="0.01"
          />
          <Champ label="Nombre de bénéficiaires" name="beneficiaires" type="number" min={0} />
        </div>
        <div className="form-check mb-3">
          <input className="form-check-input" type="checkbox" name="exact" id="f-exact" required />
          <label className="form-check-label" htmlFor="f-exact">
            Je certifie l'exactitude des informations fournies <span className="req">*</span>
          </label>
        </div>
        <div className="d-flex justify-content-end gap-2">
          <a href={retour} className="btn btn-outline-secondary">
            Annuler
          </a>
          <button type="submit" className="btn btn-primary">
            <Icone nom="send" taille={14} /> Déposer la demande
          </button>
        </div>
      </form>
    </>
  );
}
