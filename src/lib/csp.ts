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

export function buildCsp(nonce: string, dev = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
