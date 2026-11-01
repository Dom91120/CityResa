import { ChargeurScripts } from "@/components/chargeur-scripts";
import { Icone } from "@/components/icones";

/**
 * Un script différé : rendu inerte (`type="text/x-differe"`), rejoué par `ChargeurScripts`
 * après l'hydratation. `rang` 1 = socle, 2 = scripts propres à la page.
 */
export function ScriptDiffere({
  src,
  code,
  nonce,
  rang = 2,
}: {
  src?: string;
  code?: string;
  nonce?: string;
  rang?: 1 | 2;
}) {
  if (src) return <script type="text/x-differe" data-src={src} data-rang={rang} nonce={nonce} />;
  return (
    <script
      type="text/x-differe"
      data-rang={rang}
      nonce={nonce}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: code inline construit côté serveur, inerte jusqu'au rejeu.
      dangerouslySetInnerHTML={{ __html: code ?? "" }}
    />
  );
}

/** Les scripts de base, dans l'ordre, avec le nonce CSP. */
export function ScriptsPage({ nonce, extra }: { nonce?: string; extra?: React.ReactNode }) {
  const fichiers = [
    "/vendor/bootstrap.bundle.min.js",
    "/js/dom-actions.js",
    "/js/theme.js",
    "/js/onglets.js",
    "/js/formulaire.js",
    "/js/texte-tronque.js",
  ];
  return (
    <>
      {fichiers.map((src) => (
        <ScriptDiffere key={src} src={src} nonce={nonce} rang={1} />
      ))}
      {extra}
      <ChargeurScripts />
    </>
  );
}

/** Modal de confirmation réutilisable (data-confirm). */
export function ConfirmModal({ csrf, nonce }: { csrf: string; nonce?: string }) {
  return (
    <>
      <form method="POST" id="form-supprimer" className="d-none" aria-hidden="true">
        <input type="hidden" name="csrf_token" value={csrf} />
      </form>
      <div
        className="modal fade"
        id="confirmModal"
        tabIndex={-1}
        aria-hidden="true"
        style={{ "--bs-modal-width": "480px" } as React.CSSProperties}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header border-0 pb-0">
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Fermer"
              />
            </div>
            <div className="modal-body d-flex align-items-center gap-3 text-start py-2 px-4">
              <span className="stat-ico chip-amber">
                <Icone nom="triangle-alert" taille={20} />
              </span>
              <p id="confirmModalText" className="mb-0" />
            </div>
            <div className="modal-footer border-0 pt-2 justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                Annuler
              </button>
              <button type="button" className="btn btn-danger" id="confirmModalOk">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      </div>
      <ScriptDiffere src="/js/confirm-modal.js" nonce={nonce} rang={1} />
    </>
  );
}

/** Un bloc JSON inerte pour un graphique (lu par graphiques.js). */
export function DonneesGraphique({ id, config }: { id: string; config: unknown }) {
  return (
    <script
      type="application/json"
      id={id}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON sérialisé côté serveur, échappé.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(config).replace(/</g, "\\u003c") }}
    />
  );
}
