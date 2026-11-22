/**
 * Construction de la Content-Security-Policy, à nonce par réponse : default-src 'self',
 * scripts inline à nonce, `img-src data: blob:` pour le QR code 2FA et les vignettes,
 * `style-src 'unsafe-inline'` pour les styles par attribut (couleurs d'espace).
 */

const NONCE_BYTES = 16;

/** Nonce à usage unique. `crypto` global : disponible en runtime Edge comme en Node. */
export function generateNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Une réponse que l'application peut encadrer elle-même : les PDF qu'elle produit sans extension
 * dans leur adresse (factures) et la consultation d'une pièce, affichés par la page d'aperçu.
 */
export function encadrableParLApplication(pathname: string): boolean {
  return pathname.endsWith("/pdf") || /^\/documents\/\d+\/view$/.test(pathname);
}

export function buildCsp(nonce: string, dev = false, encadrable = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-ancestors ${encadrable ? "'self'" : "'none'"}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
