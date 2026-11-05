/** Le formulaire d'un matériel (création et modification). */
import { Champ, Grille, Interrupteur, SectionForm, Select, Zone } from "@/components/formulaire";
import type { Materiel, Referential } from "@/generated/prisma/client";
import { MATERIEL_UNITES } from "@/lib/constantes";

export function FormulaireMateriel({
  materiel,
  action,
  csrf,
  categories,
}: {
  materiel: Materiel | null;
  action: string;
  csrf: string;
  categories: Referential[];
}) {
  return (
    <form method="POST" id="form-principal" action={action} data-double-envoi>
      <input type="hidden" name="csrf_token" value={csrf} />
      <SectionForm titre="Identité" icone="package">
        <Grille colonnes={2}>
          <Champ label="Nom" name="name" valeur={materiel?.name} requis autoComplete="off" />
          <Select
            label="Catégorie"
            name="categorie_id"
            options={categories.map((c) => [String(c.id), c.label])}
            valeur={materiel?.categorieId}
            blank="— Non classé —"
          />
          <Zone
            label="Description"
            name="description"
            valeur={materiel?.description}
            rows={3}
            placeholder="Dimensions, état, conditions de prêt…"
          />
        </Grille>
      </SectionForm>
      <SectionForm
        titre="Stock et tarification"
        icone="boxes"
        aide="Le stock disponible est calculé à chaque demande : stock total moins les quantités mobilisées par les dossiers en cours sur la même période."
      >
        <Grille colonnes={3}>
          <Champ
            label="Stock total"
            name="stock_total"
            type="number"
            min={0}
            valeur={materiel?.stockTotal ?? 0}
            requis
          />
          <Champ
            label="Contrôle périodique (mois)"
            name="controle_mois"
            type="number"
            min={1}
            max={120}
            valeur={materiel?.controleMois ?? ""}
            aide="Vide : pas de contrôle. Sinon, une alerte signale les contrôles échus."
          />
          <Select
            label="Tarification"
            name="unite"
            options={Object.entries(MATERIEL_UNITES)}
            valeur={materiel?.unite ?? "gratuit"}
          />
          <Champ
            label="Montant (€)"
            name="montant"
            type="number"
            min={0}
            step="0.01"
            valeur={materiel?.montant ?? 0}
            aide="Ignoré si la tarification est « Gratuit »."
          />
          <Interrupteur
            label="Matériel actif"
            name="is_active"
            coche={materiel ? materiel.isActive : true}
            aide="Un matériel inactif n'est plus proposé dans les demandes."
          />
        </Grille>
      </SectionForm>
    </form>
  );
}
