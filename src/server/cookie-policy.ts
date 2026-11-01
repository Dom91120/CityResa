/**
 * Politique du cookie de session. `Secure` est posé en production sauf échappatoire
 * EXPLICITE (ALLOW_INSECURE_COOKIES=true, pour un accès LAN en HTTP), et jamais déduit
 * du schéma d'une URL : une variable mal renseignée ne doit pas retirer la protection
 * en silence.
 */
export function cookiesSecurises(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && env.ALLOW_INSECURE_COOKIES !== "true";
}

/** Vrai lorsque la protection est levée alors qu'on est en production : à signaler. */
export function alerteCookiesNonSecurises(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && !cookiesSecurises(env);
}

/** Attributs figés du cookie de session. `lax` : les liens reçus par courriel doivent passer. */
export const ATTRIBUTS_COOKIE = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
} as const;
