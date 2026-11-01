/**
 * Pièces jointes d'une fiche : la liste (icône, nom, catégorie, taille, date, actions)
 * et le formulaire de dépôt ; la galerie de photos d'un espace ou d'un site.
 */
import { Icone } from "@/components/icones";
import type { Document, Referential } from "@/generated/prisma/client";
import { DOCUMENT_KINDS } from "@/lib/constantes";
import { dateCourte, tailleLabel } from "@/lib/libelles";
import { estImage, viewable } from "@/server/documents";

export type DocLigne = Document & {
  category?: Referential | null;
  uploadedBy?: { firstName: string; lastName: string } | null;
};

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
  vide = "Aucune pièce jointe.",
}: {
  documents: DocLigne[];
  csrf: string;
  next: string;
  peutSupprimer?: (d: DocLigne) => boolean;
  vide?: string;
}) {
  if (!documents.length) return <p className="text-muted small mb-0">{vide}</p>;
  return (
    <div className="doc-liste">
      {documents.map((d) => (
        <div key={d.id} className="doc-ligne">
          <Icone nom={icone(d)} taille={18} classes="doc-ico" />
          <span className="cell2" style={{ minWidth: 0, flex: 1 }}>
            <a
              href={viewable(d) ? `/documents/${d.id}/view` : `/documents/${d.id}/download`}
              className="nom"
              target={viewable(d) ? "_blank" : undefined}
              rel="noopener"
            >
              {d.title || d.filename}
            </a>
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
}: {
  parentKind: string;
  parentId: number;
  csrf: string;
  next: string;
  categories?: Referential[];
  kinds?: [string, string][];
  compact?: boolean;
  publicOption?: boolean;
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
