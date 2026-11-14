/**
 * Le gabarit de fiche : en-tête avec retour, sections dépliables (accordéon),
 * grille intitulé / valeur, menu ⋯, modale d'action, panneau latéral.
 */
import { Icone } from "@/components/icones";
import { libelleRetour } from "@/lib/url";

export function Entete({
  titre,
  sousTitre,
  retour,
  badges,
  actions,
  menu,
}: {
  titre: React.ReactNode;
  sousTitre?: React.ReactNode;
  retour?: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  menu?: React.ReactNode[];
}) {
  const entrees = (menu ?? []).filter(Boolean);
  return (
    <div className="page-header fiche-entete">
      <div className="d-flex align-items-center gap-12" style={{ gap: 12, minWidth: 0 }}>
        {retour ? (
          <a
            href={retour}
            className="fiche-retour"
            title={libelleRetour(retour)}
            aria-label={libelleRetour(retour)}
          >
            <Icone nom="arrow-left" taille={16} />
          </a>
        ) : null}
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">
            {titre}
            {badges}
          </h1>
          {sousTitre ? <p className="page-subtitle">{sousTitre}</p> : null}
        </div>
      </div>
      <div className="page-actions">
        {actions}
        {entrees.length ? (
          <div className="dropdown">
            <button
              className="btn btn-outline-secondary btn-icone"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              title="Autres actions"
              aria-label="Autres actions"
            >
              <Icone nom="ellipsis" taille={16} />
            </button>
            <ul className="dropdown-menu dropdown-menu-end">{entrees}</ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MenuLien({
  url,
  libelle,
  icone,
  cible,
  danger = false,
}: {
  url: string;
  libelle: string;
  icone: string;
  cible?: string;
  danger?: boolean;
}) {
  return (
    <li>
      <a
        className={`dropdown-item${danger ? " text-danger" : ""}`}
        href={url}
        target={cible}
        rel={cible ? "noopener" : undefined}
      >
        <Icone nom={icone} taille={14} />
        {libelle}
      </a>
    </li>
  );
}

export function MenuPost({
  url,
  libelle,
  icone,
  csrf,
  confirm,
  danger = false,
  champs,
}: {
  url: string;
  libelle: string;
  icone: string;
  csrf: string;
  confirm?: string;
  danger?: boolean;
  champs?: Record<string, string>;
}) {
  return (
    <li>
      <form method="POST" action={url}>
        <input type="hidden" name="csrf_token" value={csrf} />
        {champs
          ? Object.entries(champs).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))
          : null}
        <button
          type="submit"
          className={`dropdown-item${danger ? " text-danger" : ""}`}
          data-confirm={confirm}
        >
          <Icone nom={icone} taille={14} />
          {libelle}
        </button>
      </form>
    </li>
  );
}

export function MenuSep() {
  return (
    <li>
      <hr className="dropdown-divider" />
    </li>
  );
}

/** Une section dépliable d'une carte (Événement, Contact, Documents…). */
export function Section({
  titre,
  icone,
  ouverte = true,
  nb,
  droite,
  children,
  id,
}: {
  titre: string;
  icone?: string;
  ouverte?: boolean;
  nb?: number | null;
  droite?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <details className="section" open={ouverte || undefined} id={id}>
      <summary>
        <Icone nom="chevron-down" taille={16} classes="chevron" />
        {icone ? <Icone nom={icone} taille={16} classes="text-muted" /> : null}
        {titre}
        {nb !== undefined && nb !== null ? <span className="nb">{nb}</span> : null}
        {droite ? <span className="droite">{droite}</span> : null}
      </summary>
      <div className="section-corps">{children}</div>
    </details>
  );
}

/** La grille intitulé / valeur. */
export function Lus({
  colonnes = 2,
  children,
  intitule,
}: {
  colonnes?: 1 | 2 | 3;
  children: React.ReactNode;
  intitule?: string;
}) {
  return (
    <div
      className={`lu-grille${colonnes !== 2 ? ` lu-grille--${colonnes}` : ""}`}
      style={intitule ? ({ "--lu-intitule": intitule } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

function vide(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.every(vide);
  return false;
}

/** Un intitulé et sa valeur ; rien si la valeur est vide (sauf `tiret`). */
export function Lu({
  label,
  valeur,
  pleine = false,
  pre = false,
  tiret = false,
}: {
  label: string;
  valeur: React.ReactNode;
  pleine?: boolean;
  pre?: boolean;
  tiret?: boolean;
}) {
  if (vide(valeur) && !tiret) return null;
  return (
    <div className={`lu${pleine ? " lu--pleine" : ""}`}>
      <span className="lu-label">{label}</span>
      <span className={`lu-valeur${pre ? " pre" : ""}`}>
        {vide(valeur) ? <span className="text-faint">—</span> : valeur}
      </span>
    </div>
  );
}

/** La fenêtre d'action : un formulaire POST, ses champs en children. */
export function ModalAction({
  id,
  titre,
  action,
  csrf,
  bouton = "Enregistrer",
  aide,
  icone = "check",
  children,
  multipart,
  danger = false,
  taille,
  formAttrs,
}: {
  id: string;
  titre: string;
  action: string;
  csrf: string;
  bouton?: string;
  aide?: string;
  icone?: string;
  children: React.ReactNode;
  multipart?: boolean;
  danger?: boolean;
  taille?: "lg" | "xl";
  /** Attributs ajoutés au formulaire (ex. data-sur-place). */
  formAttrs?: Record<string, string>;
}) {
  return (
    <div
      className="modal fade"
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-titre`}
      aria-hidden="true"
    >
      <div className={`modal-dialog modal-dialog-centered${taille ? ` modal-${taille}` : ""}`}>
        <form
          method="POST"
          action={action}
          className="modal-content"
          encType={multipart ? "multipart/form-data" : undefined}
          data-double-envoi
          {...formAttrs}
        >
          <input type="hidden" name="csrf_token" value={csrf} />
          <div className="modal-header">
            <h5 className="modal-title" id={`${id}-titre`}>
              {titre}
            </h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Fermer"
            />
          </div>
          <div className="modal-body">
            {aide ? <p className="text-muted small mb-3">{aide}</p> : null}
            {children}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
              Annuler
            </button>
            <button type="submit" className={`btn ${danger ? "btn-danger" : "btn-primary"}`}>
              <Icone nom={icone} taille={14} /> {bouton}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Un panneau latéral (offcanvas) portant un formulaire. */
export function Panneau({
  id,
  titre,
  action,
  csrf,
  bouton = "Enregistrer",
  icone = "check",
  children,
  multipart,
  pied,
}: {
  id: string;
  titre: string;
  action: string;
  csrf: string;
  bouton?: string;
  icone?: string;
  children: React.ReactNode;
  multipart?: boolean;
  pied?: React.ReactNode;
}) {
  return (
    <div className="offcanvas offcanvas-end" tabIndex={-1} id={id} aria-labelledby={`${id}-titre`}>
      <form
        method="POST"
        action={action}
        className="d-flex flex-column h-100"
        encType={multipart ? "multipart/form-data" : undefined}
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={csrf} />
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id={`${id}-titre`}>
            {titre}
          </h5>
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="offcanvas"
            aria-label="Fermer"
          />
        </div>
        <div className="offcanvas-body flex-grow-1">{children}</div>
        <div
          className="p-3 border-top d-flex justify-content-end gap-2"
          style={{ borderColor: "var(--line)" }}
        >
          {pied}
          <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="offcanvas">
            Annuler
          </button>
          <button type="submit" className="btn btn-primary">
            <Icone nom={icone} taille={14} /> {bouton}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Le bouton qui ouvre une modale ou un panneau. */
export function BoutonOuvrir({
  cible,
  libelle,
  icone,
  classe = "btn-primary",
  panneau = false,
  sansTexte = false,
}: {
  cible: string;
  libelle: string;
  icone?: string;
  classe?: string;
  panneau?: boolean;
  sansTexte?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn ${classe}${sansTexte ? " btn-icone" : ""}`}
      data-bs-toggle={panneau ? "offcanvas" : "modal"}
      data-bs-target={`#${cible}`}
      title={sansTexte ? libelle : undefined}
      aria-label={sansTexte ? libelle : undefined}
    >
      {icone ? <Icone nom={icone} taille={14} /> : null}
      {sansTexte ? null : libelle}
    </button>
  );
}
