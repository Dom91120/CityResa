/** Le gabarit de formulaire : en-tête, pied, sections, champs. */
import { Icone } from "@/components/icones";

export function EnteteForm({
  titre,
  retour,
  sousTitre,
  libelle = "Enregistrer",
  form = "form-principal",
}: {
  titre: React.ReactNode;
  retour: string;
  sousTitre?: React.ReactNode;
  libelle?: string;
  form?: string;
}) {
  return (
    <div className="page-header">
      <div className="d-flex align-items-center" style={{ gap: 12 }}>
        <a href={retour} className="fiche-retour js-retour" title="Retour" aria-label="Retour">
          <Icone nom="arrow-left" taille={16} />
        </a>
        <div>
          <h1 className="page-title">{titre}</h1>
          {sousTitre ? <p className="page-subtitle">{sousTitre}</p> : null}
        </div>
      </div>
      <div className="page-actions">
        <a href={retour} className="btn btn-outline-secondary js-retour">
          Annuler
        </a>
        <button type="submit" form={form} className="btn btn-primary">
          <Icone nom="check" taille={14} /> {libelle}
        </button>
      </div>
    </div>
  );
}

export function PiedForm({
  retour,
  libelle = "Enregistrer",
  supprimer,
  confirmation = "Supprimer cette fiche ?",
}: {
  retour: string;
  libelle?: string;
  supprimer?: string | null;
  confirmation?: string;
}) {
  return (
    <div className="form-pied">
      {supprimer ? (
        <button
          type="button"
          className="btn btn-ghost btn-ghost-danger form-pied-supprimer"
          data-confirm={confirmation}
          data-confirm-form="#form-supprimer"
          data-confirm-action={supprimer}
        >
          <Icone nom="trash-2" taille={14} /> Supprimer
        </button>
      ) : null}
      <a href={retour} className="btn btn-outline-secondary js-retour">
        Annuler
      </a>
      <button type="submit" className="btn btn-primary">
        <Icone nom="check" taille={14} /> {libelle}
      </button>
    </div>
  );
}

/** Une section de formulaire. */
export function SectionForm({
  titre,
  icone,
  aide,
  children,
}: {
  titre: string;
  icone?: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="form-section">
      <legend className="form-section-titre">
        {icone ? <Icone nom={icone} taille={14} /> : null}
        {titre}
      </legend>
      {aide ? <p className="form-section-aide">{aide}</p> : null}
      {children}
    </fieldset>
  );
}

export function Grille({
  colonnes = 2,
  children,
}: {
  colonnes?: 2 | 3 | 4;
  children: React.ReactNode;
}) {
  return <div className={`grille grille-${colonnes}`}>{children}</div>;
}

type ChampBase = {
  label: string;
  name: string;
  requis?: boolean;
  aide?: string;
  id?: string;
  pleine?: boolean;
};

/** Un champ texte / nombre / date / heure / courriel. */
export function Champ({
  label,
  name,
  valeur,
  type = "text",
  placeholder,
  requis = false,
  aide,
  id,
  pleine = false,
  min,
  max,
  step,
  autoComplete,
  attrs,
  masque = false,
}: ChampBase & {
  /** Masqué et désactivé (non envoyé) ; un script peut le réafficher. */
  masque?: boolean;
  valeur?: string | number | null;
  type?: string;
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  autoComplete?: string;
  attrs?: Record<string, string | number | boolean | undefined>;
}) {
  const ident = id ?? `f-${name}`;
  return (
    <div
      className={pleine ? "grille-pleine" : undefined}
      style={pleine ? { gridColumn: "1 / -1" } : undefined}
      hidden={masque}
    >
      <label className="form-label" htmlFor={ident}>
        {label}
        {requis ? <span className="req"> *</span> : null}
      </label>
      <input
        disabled={masque || undefined}
        type={type}
        name={name}
        id={ident}
        className="form-control"
        defaultValue={valeur ?? ""}
        placeholder={placeholder}
        required={requis}
        min={min}
        max={max}
        step={step}
        autoComplete={autoComplete}
        {...attrs}
      />
      {aide ? <div className="form-text">{aide}</div> : null}
    </div>
  );
}

export function Zone({
  label,
  name,
  valeur,
  rows = 4,
  placeholder,
  requis = false,
  aide,
  id,
  pleine = true,
  maxLength,
}: ChampBase & {
  valeur?: string | null;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
}) {
  const ident = id ?? `f-${name}`;
  return (
    <div style={pleine ? { gridColumn: "1 / -1" } : undefined}>
      <label className="form-label" htmlFor={ident}>
        {label}
        {requis ? <span className="req"> *</span> : null}
      </label>
      <textarea
        name={name}
        id={ident}
        className="form-control"
        rows={rows}
        defaultValue={valeur ?? ""}
        placeholder={placeholder}
        required={requis}
        maxLength={maxLength}
      />
      {aide ? <div className="form-text">{aide}</div> : null}
    </div>
  );
}

/** Un <select> avec options [valeur, libellé]. */
export function Select({
  label,
  name,
  options,
  valeur,
  blank,
  requis = false,
  aide,
  id,
  pleine = false,
  attrs,
}: ChampBase & {
  options: [string, string][];
  valeur?: string | number | null;
  blank?: string;
  attrs?: Record<string, string | number | boolean | undefined>;
}) {
  const ident = id ?? `f-${name}`;
  return (
    <div style={pleine ? { gridColumn: "1 / -1" } : undefined}>
      <label className="form-label" htmlFor={ident}>
        {label}
        {requis ? <span className="req"> *</span> : null}
      </label>
      <select
        name={name}
        id={ident}
        className="form-select"
        defaultValue={valeur === null || valeur === undefined ? "" : String(valeur)}
        required={requis}
        {...attrs}
      >
        {blank !== undefined ? <option value="">{blank}</option> : null}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {aide ? <div className="form-text">{aide}</div> : null}
    </div>
  );
}

/** Un interrupteur. */
export function Interrupteur({
  label,
  name,
  coche,
  aide,
  id,
  attrs,
}: {
  label: string;
  name: string;
  coche: boolean;
  aide?: string;
  id?: string;
  attrs?: Record<string, string | number | boolean | undefined>;
}) {
  const ident = id ?? `f-${name}`;
  return (
    <div className="form-check form-switch">
      <input
        className="form-check-input"
        type="checkbox"
        role="switch"
        name={name}
        id={ident}
        defaultChecked={coche}
        {...attrs}
      />
      <label className="form-check-label" htmlFor={ident}>
        {label}
      </label>
      {aide ? <div className="form-text">{aide}</div> : null}
    </div>
  );
}

/** Des cases à cocher en pastilles. */
export function Coches({
  name,
  options,
  cochees,
  label,
}: {
  name: string;
  options: { value: string | number; label: string; icone?: string }[];
  cochees: (string | number)[];
  label?: string;
}) {
  const set = new Set(cochees.map(String));
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      {label ? <div className="form-label">{label}</div> : null}
      <div className="coches">
        {options.map((o) => (
          <label key={o.value}>
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={set.has(String(o.value))}
            />
            {o.icone ? <Icone nom={o.icone} taille={13} /> : null}
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
