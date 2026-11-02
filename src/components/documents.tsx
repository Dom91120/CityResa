/**
 * Pièces jointes d'une fiche : la liste (icône, nom, catégorie, taille, date, actions)
 * et le formulaire de dépôt ; la galerie de photos d'un espace ou d'un site.
 */
import { Icone } from "@/components/icones";
import type { Document, Referential } from "@/generated/prisma/client";
import { DOCUMENT_KINDS } from "@/lib/constantes";
import { ymdUtc } from "@/lib/date-utc";
import { dateCourte, tailleLabel } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { etatPiecesAttendues, etatValidite, libelleValidite, type PieceJugee } from "@/lib/pieces";
import { estImage, viewable } from "@/server/documents";

export type DocLigne = Document & {
  category?: Referential | null;
  uploadedBy?: { firstName: string; lastName: string } | null;
};

/** La pastille de validité d'une pièce datée (rien si elle n'a pas de date). */
export function ChipValidite({
  validUntil,
  seuilJours = 30,
}: {
  validUntil: Date | null | undefined;
  seuilJours?: number;
}) {
  if (!validUntil) return null;
  const today = todayParisISO();
  const etat = etatValidite(validUntil, today, seuilJours);
  const teinte = etat === "expiree" ? "red" : etat === "bientot" ? "amber" : "emerald";
  return (
    <span className={`chip chip-${teinte}`}>{libelleValidite(validUntil, today, seuilJours)}</span>
  );
}

function icone(d: DocLigne): string {
  if (d.kind === "convention") return "file-signature";
  if (d.kind === "facture") return "receipt";
  if (estImage(d)) return "image";
  if (d.filename.toLowerCase().endsWith(".pdf")) return "file-text";
  return "paperclip";
}

/** La liste des pièces. `peutSupprimer(d)` décide bouton par bouton. */
export function ListeDocuments({
  documents,
  csrf,
  next,
  peutSupprimer,
  peutDater,
  seuilJours = 30,
  vide = "Aucune pièce jointe.",
}: {
  documents: DocLigne[];
  csrf: string;
  next: string;
  peutSupprimer?: (d: DocLigne) => boolean;
  /** Un agent peut poser ou corriger la date de validité d'une pièce. */
  peutDater?: (d: DocLigne) => boolean;
  seuilJours?: number;
  vide?: string;
}) {
  if (!documents.length) return <p className="text-muted small mb-0">{vide}</p>;
  return (
    <div className="doc-liste">
      {documents.map((d) => (
        <div key={d.id} className="doc-ligne">
          <Icone nom={icone(d)} taille={18} classes="doc-ico" />
          <span className="cell2" style={{ minWidth: 0, flex: 1 }}>
            <span className="d-flex align-items-center gap-2 flex-wrap">
              <a
                href={viewable(d) ? `/documents/${d.id}/view` : `/documents/${d.id}/download`}
                className="nom"
                target={viewable(d) ? "_blank" : undefined}
                rel="noopener"
              >
                {d.title || d.filename}
              </a>
              <ChipValidite validUntil={d.validUntil} seuilJours={seuilJours} />
            </span>
            <small>
              {[
                DOCUMENT_KINDS[d.kind] !== "Pièce justificative" ? DOCUMENT_KINDS[d.kind] : null,
                d.category?.label,
                tailleLabel(d.size),
                dateCourte(d.createdAt),
                d.uploadedBy ? `par ${d.uploadedBy.firstName} ${d.uploadedBy.lastName}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </span>
          <span className="droite">
            {peutDater?.(d) ? (
              <form
                method="POST"
                action={`/documents/${d.id}/validite`}
                className="d-inline-flex align-items-center gap-1"
              >
                <input type="hidden" name="csrf_token" value={csrf} />
                <input type="hidden" name="next" value={next} />
                <input
                  type="date"
                  name="valid_until"
                  className="form-control form-control-sm"
                  style={{ width: 150 }}
                  defaultValue={d.validUntil ? ymdUtc(d.validUntil) : ""}
                  aria-label="Valide jusqu'au"
                  title="Valide jusqu'au"
                />
                <button
                  type="submit"
                  className="btn btn-ghost btn-icone btn-sm"
                  title="Enregistrer la date de validité"
                  aria-label="Enregistrer la date de validité"
                >
                  <Icone nom="calendar-check" taille={14} />
                </button>
              </form>
            ) : null}
            <a
              href={`/documents/${d.id}/download`}
              className="btn btn-ghost btn-icone btn-sm"
              title="Télécharger"
              aria-label="Télécharger"
            >
              <Icone nom="download" taille={14} />
            </a>
            {peutSupprimer?.(d) ? (
              <form method="POST" action={`/documents/${d.id}/delete`} className="d-inline">
                <input type="hidden" name="csrf_token" value={csrf} />
                <input type="hidden" name="next" value={next} />
                <button
                  type="submit"
                  className="btn btn-ghost btn-ghost-danger btn-icone btn-sm"
                  title="Supprimer"
                  aria-label="Supprimer"
                  data-confirm="Supprimer cette pièce ?"
                >
                  <Icone nom="trash-2" taille={14} />
                </button>
              </form>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Le formulaire de dépôt d'une pièce. */
export function FormDocument({
  parentKind,
  parentId,
  csrf,
  next,
  categories = [],
  kinds,
  compact = false,
  publicOption = false,
  validite = false,
}: {
  parentKind: string;
  parentId: number;
  csrf: string;
  next: string;
  categories?: Referential[];
  kinds?: [string, string][];
  compact?: boolean;
  publicOption?: boolean;
  /** Propose une date de fin de validité (attestation d'assurance…). */
  validite?: boolean;
}) {
  return (
    <form
      method="POST"
      action="/documents/upload"
      encType="multipart/form-data"
      className={compact ? "d-flex gap-2 align-items-end flex-wrap" : "grille grille-3"}
      data-double-envoi
    >
      <input type="hidden" name="csrf_token" value={csrf} />
      <input type="hidden" name="parent_kind" value={parentKind} />
      <input type="hidden" name="parent_id" value={parentId} />
      <input type="hidden" name="next" value={next} />
      <div style={compact ? { flex: "1 1 200px" } : undefined}>
        <label className="form-label" htmlFor={`doc-file-${parentKind}`}>
          Fichier
        </label>
        <input
          type="file"
          name="file"
          id={`doc-file-${parentKind}`}
          className="form-control form-control-sm"
          required
        />
      </div>
      {kinds?.length ? (
        <div>
          <label className="form-label" htmlFor={`doc-kind-${parentKind}`}>
            Nature
          </label>
          <select name="kind" id={`doc-kind-${parentKind}`} className="form-select form-select-sm">
            {kinds.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {categories.length ? (
        <div>
          <label className="form-label" htmlFor={`doc-cat-${parentKind}`}>
            Catégorie
          </label>
          <select
            name="category_id"
            id={`doc-cat-${parentKind}`}
            className="form-select form-select-sm"
            defaultValue=""
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {!compact ? (
        <div>
          <label className="form-label" htmlFor={`doc-title-${parentKind}`}>
            Intitulé
          </label>
          <input
            type="text"
            name="title"
            id={`doc-title-${parentKind}`}
            className="form-control form-control-sm"
            placeholder="facultatif"
          />
        </div>
      ) : null}
      {validite ? (
        <div>
          <label className="form-label" htmlFor={`doc-valid-${parentKind}`}>
            Valide jusqu'au
          </label>
          <input
            type="date"
            name="valid_until"
            id={`doc-valid-${parentKind}`}
            className="form-control form-control-sm"
            title="Date de fin de validité de la pièce (facultative)"
          />
        </div>
      ) : null}
      {publicOption ? (
        <div className="form-check align-self-center">
          <input
            className="form-check-input"
            type="checkbox"
            name="is_public"
            id={`doc-public-${parentKind}`}
          />
          <label className="form-check-label small" htmlFor={`doc-public-${parentKind}`}>
            Visible sur le portail
          </label>
        </div>
      ) : null}
      <div className="align-self-end">
        <button type="submit" className="btn btn-sm btn-outline-primary">
          <Icone nom="upload" taille={14} /> Déposer
        </button>
      </div>
    </form>
  );
}

/** La galerie de photos (espace, site) avec dépôt et réordonnancement. */
export function Galerie({
  photos,
  parentKind,
  parentId,
  csrf,
  next,
  peutEditer,
}: {
  photos: DocLigne[];
  parentKind: string;
  parentId: number;
  csrf: string;
  next: string;
  peutEditer: boolean;
}) {
  return (
    <>
      {photos.length ? (
        <div className="photos mb-3">
          {photos.map((p, i) => (
            <div key={p.id} className={`photo${i === 0 ? " photo-principale" : ""}`}>
              <a href={`/documents/${p.id}/view`} target="_blank" rel="noopener">
                <img src={`/documents/${p.id}/thumb`} alt={p.title || p.filename} loading="lazy" />
              </a>
              {peutEditer ? (
                <span className="sup d-flex gap-1">
                  {i > 0 ? (
                    <form method="POST" action={`/documents/${p.id}/haut`}>
                      <input type="hidden" name="csrf_token" value={csrf} />
                      <input type="hidden" name="next" value={next} />
                      <button
                        type="submit"
                        className="btn btn-rond btn-sm"
                        title="Mettre en avant"
                        aria-label="Mettre en avant"
                        style={{ width: 28, height: 28 }}
                      >
                        <Icone nom="star" taille={13} />
                      </button>
                    </form>
                  ) : null}
                  <form method="POST" action={`/documents/${p.id}/delete`}>
                    <input type="hidden" name="csrf_token" value={csrf} />
                    <input type="hidden" name="next" value={next} />
                    <button
                      type="submit"
                      className="btn btn-rond btn-sm"
                      title="Supprimer"
                      aria-label="Supprimer"
                      data-confirm="Supprimer cette photo ?"
                      style={{ width: 28, height: 28 }}
                    >
                      <Icone nom="trash-2" taille={13} />
                    </button>
                  </form>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted small">
          Aucune photo. La première photo sert de vignette (listes et portail).
        </p>
      )}
      {peutEditer ? (
        <form
          method="POST"
          action="/documents/upload"
          encType="multipart/form-data"
          className="d-flex gap-2 align-items-center flex-wrap"
          data-double-envoi
        >
          <input type="hidden" name="csrf_token" value={csrf} />
          <input type="hidden" name="parent_kind" value={parentKind} />
          <input type="hidden" name="parent_id" value={parentId} />
          <input type="hidden" name="kind" value="photo" />
          <input type="hidden" name="next" value={next} />
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="form-control form-control-sm"
            style={{ maxWidth: 320 }}
            required
            aria-label="Photo à ajouter"
          />
          <button type="submit" className="btn btn-sm btn-outline-primary">
            <Icone nom="image" taille={14} /> Ajouter une photo
          </button>
        </form>
      ) : null}
    </>
  );
}

/** La vignette d'une fiche (première photo) ou un pictogramme. */
export function Vignette({
  photo,
  alt,
  classes = "vignette",
  icone = "door-open",
}: {
  photo: { id: number } | null | undefined;
  alt: string;
  classes?: string;
  icone?: string;
}) {
  if (photo)
    return (
      <img src={`/documents/${photo.id}/thumb`} alt={alt} className={classes} loading="lazy" />
    );
  return (
    <span className={`${classes} vignette-vide`}>
      <Icone nom={icone} taille={18} />
    </span>
  );
}

/** L'état des pièces attendues d'un usager selon son type : manquante, fournie, valide, à renouveler. */
export function PiecesAttendues({
  type,
  pieces,
  seuilJours = 30,
  usager = false,
}: {
  type: string;
  pieces: PieceJugee[];
  seuilJours?: number;
  /** Côté portail : on s'adresse à l'usager. */
  usager?: boolean;
}) {
  const today = todayParisISO();
  const etats = etatPiecesAttendues(type, pieces, today, seuilJours);
  if (!etats.length) return null;
  const TEINTE: Record<string, string> = {
    manquante: "red",
    expiree: "red",
    bientot: "amber",
    fournie: "sky",
    valide: "emerald",
  };
  const LIBELLE: Record<string, string> = {
    manquante: "Manquante",
    expiree: "Expirée",
    bientot: "À renouveler",
    fournie: "Fournie (sans date)",
    valide: "Valide",
  };
  const aRegler = etats.filter((e) => e.etat !== "valide" && e.etat !== "fournie").length;
  return (
    <div className={`pieces-attendues mb-3${aRegler ? " a-regler" : ""}`}>
      <div className="small fw-medium mb-1" style={{ color: "var(--strong)" }}>
        Pièces attendues
        {aRegler ? (
          <span className="text-danger fw-normal">
            {" "}
            · {aRegler} à {usager ? "fournir" : "réclamer"}
          </span>
        ) : null}
      </div>
      <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
        {etats.map((e) => (
          <li key={e.kind} className="d-flex align-items-center gap-2 small">
            <span className={`chip chip-${TEINTE[e.etat]}`}>{LIBELLE[e.etat]}</span>
            <span>{e.libelle}</span>
            {e.validUntil ? (
              <span className="text-muted">
                · {libelleValidite(e.validUntil, today, seuilJours).toLowerCase()}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
