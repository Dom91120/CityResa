/**
 * Sous-composants du module ASSO : pastilles de type et d'avis, compteur d'avis, cartes
 * de synthèse d'un exercice, formulaire d'une demande (création et modification).
 */
import { Champ, Grille, SectionForm, Select, Zone } from "@/components/formulaire";
import { Chip } from "@/components/macros";
import { CarteStat } from "@/components/stats";
import { AVIS_LABELS, SUBVENTION_TYPES } from "@/lib/constantes";
import { montant, pluriel } from "@/lib/libelles";
import { compterAvis, type SyntheseExercice } from "@/modules/subventions/server";

const TYPE_TEINTES: Record<string, string> = {
  fonctionnement: "sky",
  projet: "violet",
  exceptionnelle: "amber",
  investissement: "emerald",
};

export function TypeSubvention({ type }: { type: string }) {
  return <Chip teinte={TYPE_TEINTES[type] ?? "slate"}>{SUBVENTION_TYPES[type] ?? type}</Chip>;
}

export function ChipAvis({ avis }: { avis: string }) {
  const a = AVIS_LABELS[avis];
  return <Chip teinte={a?.teinte ?? "slate"}>{a?.label ?? avis}</Chip>;
}

/** « 2 · 1 · 0 » : favorables, avec réserve, défavorables. */
export function CompteurAvis({ avis }: { avis: { avis: string }[] }) {
  if (!avis.length) return <span className="text-faint small">aucun avis</span>;
  const c = compterAvis(avis);
  return (
    <span className="d-inline-flex gap-1" title="Favorables · avec réserve · défavorables">
      {(["favorable", "reserve", "defavorable"] as const).map((k) => (
        <span
          key={k}
          className={`chip chip-${c[k] ? AVIS_LABELS[k].teinte : "slate"}`}
          title={AVIS_LABELS[k].label}
        >
          {c[k]}
        </span>
      ))}
    </span>
  );
}

export function CartesExercice({ s, base }: { s: SyntheseExercice; base: string }) {
  const cartes = [
    {
      href: `${base}?exercice=${s.exercice}`,
      icone: "hand-coins",
      teinte: "sky",
      label: `Demandé · ${s.exercice}`,
      valeur: montant(s.demande),
      detail: pluriel(s.nb, "dossier"),
    },
    {
      href: `${base}?exercice=${s.exercice}&statut=votee`,
      icone: "gavel",
      teinte: "emerald",
      label: "Accordé",
      valeur: montant(s.accorde),
      detail: `${pluriel(s.nbAccordees, "subvention")} votée${s.nbAccordees > 1 ? "s" : ""}`,
    },
    {
      href: `${base}?exercice=${s.exercice}&statut=versee`,
      icone: "banknote",
      teinte: "violet",
      label: "Versé",
      valeur: montant(s.verse),
      detail: pluriel(s.nbVersees, "versement"),
    },
    {
      href: `${base}?exercice=${s.exercice}&statut=instruction`,
      icone: "hourglass",
      teinte: s.enCours ? "amber" : "slate",
      label: "En cours d'instruction",
      valeur: String(s.enCours),
      detail: s.enCours ? "à instruire, soumettre ou voter" : "rien en attente",
    },
  ];
  return (
    <div className="stat-grid">
      {cartes.map((c) => (
        <CarteStat
          key={c.label}
          href={c.href}
          icone={c.icone}
          teinte={c.teinte}
          label={c.label}
          valeur={c.valeur}
          detail={c.detail}
        />
      ))}
    </div>
  );
}

export type ValeursSubvention = {
  organisationId: number | null;
  exercice: number;
  type: string;
  objet: string;
  description: string | null;
  montantDemande: number | null;
  budgetTotal: number | null;
  beneficiaires: number | null;
};

/** Les champs d'une demande (création et modification). */
export function ChampsSubvention({
  v,
  organisations,
  exercices,
}: {
  v: ValeursSubvention;
  organisations: { id: number; name: string; validee: boolean }[];
  exercices: number[];
}) {
  return (
    <>
      <SectionForm titre="Association" icone="building-2">
        <Grille colonnes={2}>
          <Select
            label="Association demandeuse"
            name="organisation_id"
            options={organisations.map((o) => [
              String(o.id),
              o.validee ? o.name : `${o.name} (non validée)`,
            ])}
            valeur={v.organisationId}
            blank="Choisir…"
            requis
            aide="Seules les organisations de type « association » peuvent demander une subvention."
          />
          <Select
            label="Exercice"
            name="exercice"
            options={exercices.map((e) => [String(e), String(e)])}
            valeur={v.exercice}
            requis
          />
        </Grille>
      </SectionForm>
      <SectionForm titre="Demande" icone="hand-coins">
        <Grille colonnes={2}>
          <Select
            label="Type"
            name="type"
            options={Object.entries(SUBVENTION_TYPES)}
            valeur={v.type}
            requis
          />
          <Champ
            label="Objet"
            name="objet"
            valeur={v.objet}
            requis
            placeholder="Fonctionnement général, tournoi annuel, achat de matériel…"
          />
          <Zone
            label="Description"
            name="description"
            valeur={v.description}
            rows={5}
            placeholder="Projet, public visé, calendrier, partenaires…"
          />
        </Grille>
      </SectionForm>
      <SectionForm titre="Montants et public" icone="euro">
        <Grille colonnes={3}>
          <Champ
            label="Montant demandé (€)"
            name="montant_demande"
            type="number"
            step="0.01"
            min="0.01"
            valeur={v.montantDemande ?? ""}
            requis
          />
          <Champ
            label="Budget total du projet (€)"
            name="budget_total"
            type="number"
            step="0.01"
            min="0"
            valeur={v.budgetTotal ?? ""}
          />
          <Champ
            label="Bénéficiaires"
            name="beneficiaires"
            type="number"
            min="0"
            step="1"
            valeur={v.beneficiaires ?? ""}
            aide="Nombre de personnes concernées."
          />
        </Grille>
      </SectionForm>
    </>
  );
}
