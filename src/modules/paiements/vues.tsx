/**
 * Sous-composants du module PAIEMENTS : pastille de type, échéance, débiteur, cartes de
 * synthèse.
 */
import { Icone, IconePastille } from "@/components/icones";
import { Chip } from "@/components/macros";
import { FACTURE_TYPES } from "@/lib/constantes";
import { dateCourte, delai, montant, pluriel } from "@/lib/libelles";
import {
  debiteur,
  enRetard,
  FACTURE_TYPE_TEINTES,
  type FactureLigne,
  type SyntheseFactures,
} from "@/modules/paiements/server";

export function TypeFacture({ type }: { type: string }) {
  return <Chip teinte={FACTURE_TYPE_TEINTES[type] ?? "slate"}>{FACTURE_TYPES[type] ?? type}</Chip>;
}

/** L'échéance, en rouge quand elle est dépassée et que la facture reste due. */
export function Echeance({
  f,
  aujourdhui,
}: {
  f: { status: string; dueAt: Date | null };
  aujourdhui: Date;
}) {
  if (!f.dueAt) return <span className="text-faint">—</span>;
  const retard = enRetard(f, aujourdhui);
  return (
    <span className={`cell2${retard ? " text-danger" : ""}`}>
      <span className={retard ? "fw-medium" : undefined}>{dateCourte(f.dueAt)}</span>
      {f.status === "a_payer" ? (
        <small>
          {retard ? "dépassée · " : ""}
          {delai(f.dueAt)}
        </small>
      ) : null}
    </span>
  );
}

export function Debiteur({ f }: { f: FactureLigne }) {
  const d = debiteur(f);
  return (
    <span className="cell2">
      {d.href ? (
        <a href={d.href} className="fw-medium" style={{ color: "var(--strong)" }}>
          {d.nom}
        </a>
      ) : (
        <span className="fw-medium">{d.nom}</span>
      )}
      {d.detail ? <small>{d.detail}</small> : null}
    </span>
  );
}

/** Les quatre cartes du haut de la liste des factures. */
export function CartesFactures({
  s,
  libellePeriode,
  base,
}: {
  s: SyntheseFactures;
  libellePeriode: string;
  base: string;
}) {
  const cartes = [
    {
      href: `${base}?statut=a_payer`,
      icone: "wallet",
      teinte: "amber",
      label: "À encaisser",
      valeur: montant(s.aEncaisser),
      detail: pluriel(s.nbAEncaisser, "facture"),
    },
    {
      href: `${base}?statut=retard`,
      icone: "triangle-alert",
      teinte: s.nbRetard ? "red" : "slate",
      label: "En retard",
      valeur: montant(s.retard),
      detail: s.nbRetard ? pluriel(s.nbRetard, "facture") : "aucune échéance dépassée",
    },
    {
      href: `${base}?statut=payee`,
      icone: "banknote",
      teinte: "emerald",
      label: `Encaissé · ${libellePeriode}`,
      valeur: montant(s.encaisse),
      detail: pluriel(s.nbPaiements, "règlement"),
    },
    {
      href: base,
      icone: "receipt",
      teinte: "sky",
      label: "Factures émises",
      valeur: String(s.nb),
      detail: "toutes périodes",
    },
  ];
  return (
    <div className="stat-grid">
      {cartes.map((c) => (
        <a key={c.label} href={c.href} className="stat-card">
          <div className="d-flex align-items-center justify-content-between">
            <IconePastille nom={c.icone} teinte={c.teinte} />
            <Icone nom="arrow-right" taille={14} classes="text-faint" />
          </div>
          <div>
            <div className="stat-label">{c.label}</div>
            <div className="stat-number">{c.valeur}</div>
            <div className="text-muted small mt-1">{c.detail}</div>
          </div>
        </a>
      ))}
    </div>
  );
}
