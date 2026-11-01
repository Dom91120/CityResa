/**
 * Petits composants partagés : pastilles de statut, avatars, frise d'avancement,
 * variation d'un indicateur, pastille d'espace.
 */
import { Icone } from "@/components/icones";
import {
  ETAPES,
  FACTURE_STATUS,
  ORGANISATION_TYPE_TEINTES,
  ORGANISATION_TYPES,
  RESERVATION_STATUS,
  type ReservationStatus,
  SUBVENTION_STATUS,
} from "@/lib/constantes";
import { initiales } from "@/lib/libelles";

/** Une pastille colorée : `<Chip teinte="rose">À traiter</Chip>`. */
export function Chip({
  teinte = "slate",
  children,
  classes = "",
  dot = false,
  lg = false,
  titre,
}: {
  teinte?: string;
  children: React.ReactNode;
  classes?: string;
  dot?: boolean;
  lg?: boolean;
  titre?: string;
}) {
  return (
    <span
      className={`chip chip-${teinte}${dot ? " chip-dot" : ""}${lg ? " chip-lg" : ""}${classes ? ` ${classes}` : ""}`}
      title={titre}
    >
      {children}
    </span>
  );
}

/** Le statut d'une réservation : UN mot, UNE couleur, partout. */
export function StatutResa({ status, lg = false }: { status: string; lg?: boolean }) {
  const s = RESERVATION_STATUS[status as ReservationStatus];
  if (!s) return <Chip lg={lg}>{status}</Chip>;
  return (
    <Chip teinte={s.teinte} lg={lg} titre={s.aide}>
      {s.label}
    </Chip>
  );
}

export function StatutFacture({ status }: { status: string }) {
  const s = FACTURE_STATUS[status];
  return <Chip teinte={s?.teinte ?? "slate"}>{s?.label ?? status}</Chip>;
}

export function StatutSubvention({ status }: { status: string }) {
  const s = SUBVENTION_STATUS[status];
  return <Chip teinte={s?.teinte ?? "slate"}>{s?.label ?? status}</Chip>;
}

/** Le type d'une organisation (Association, Entreprise…). */
export function TypeOrganisation({ type }: { type: string | null | undefined }) {
  if (!type) return <Chip teinte="amber">Particulier</Chip>;
  return (
    <Chip teinte={ORGANISATION_TYPE_TEINTES[type] ?? "slate"}>
      {ORGANISATION_TYPES[type] ?? type}
    </Chip>
  );
}

/** Un avatar à initiales. */
export function Avatar({
  nom,
  taille = "md",
  agent = false,
  titre,
}: {
  nom: string;
  taille?: "sm" | "md" | "lg";
  agent?: boolean;
  titre?: string;
}) {
  return (
    <span
      className={`avatar${taille === "sm" ? " avatar-sm" : taille === "lg" ? " avatar-lg" : ""}${agent ? " avatar-agent" : ""}`}
      title={titre ?? nom}
      aria-hidden="true"
    >
      {initiales(nom)}
    </span>
  );
}

/** La frise d'avancement d'un dossier : Demande → Signature → Confirmée → Terminée. */
export function Frise({ status, grande = false }: { status: string; grande?: boolean }) {
  const st = status as ReservationStatus;
  if (["refusee", "annulee"].includes(st)) {
    return (
      <div className={`frise${grande ? " frise--grande" : ""}`}>
        <div className="frise-etape faite">
          <div className="pt" />
          Demande
        </div>
        <div className="frise-etape courante" style={{ color: "var(--danger)" }}>
          <div
            className="pt"
            style={{ background: "var(--danger)", boxShadow: "0 0 0 3px var(--danger-dim)" }}
          />
          {RESERVATION_STATUS[st].label}
        </div>
      </div>
    );
  }
  const index = ETAPES.findIndex((e) => e.statuts.includes(st));
  return (
    <div className={`frise${grande ? " frise--grande" : ""}`}>
      {ETAPES.map((e, i) => (
        <div
          key={e.cle}
          className={`frise-etape${i < index ? " faite" : i === index ? " courante" : ""}`}
        >
          <div className="pt" />
          {e.label}
        </div>
      ))}
    </div>
  );
}

/** La variation d'un indicateur par rapport à la période précédente. */
export function Delta({ valeur }: { valeur: number | null }) {
  if (valeur === null) return <span className="delta delta-flat">—</span>;
  if (valeur === 0) return <span className="delta delta-flat">=</span>;
  return (
    <span className={`delta ${valeur > 0 ? "delta-up" : "delta-down"}`}>
      {valeur > 0 ? "+" : ""}
      {String(valeur).replace(".", ",")} %
    </span>
  );
}

/** Pastille de couleur d'un espace. */
export function PastilleEspace({ couleur }: { couleur: string }) {
  return <span className="pastille-espace" style={{ background: couleur }} aria-hidden="true" />;
}

/** Oui / non en pastille. */
export function OuiNon({ v }: { v: boolean }) {
  return v ? (
    <Chip teinte="emerald">
      <Icone nom="check" taille={12} /> Oui
    </Chip>
  ) : (
    <Chip teinte="slate">Non</Chip>
  );
}
