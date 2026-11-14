import { type NextRequest, NextResponse } from "next/server";
import { buildCsp, generateNonce } from "@/lib/csp";
import { cheminFiche, retourMemorise } from "@/lib/url";

const COOKIE_RETOUR = "cityresa_retour";

/** Le chemin de la page d'où l'on vient, lu dans l'en-tête Referer. */
function cheminReferent(request: NextRequest): string | null {
  const brut = request.headers.get("referer");
  if (!brut) return null;
  try {
    return new URL(brut).pathname;
  } catch {
    return null;
  }
}

/**
 * Middleware — trois responsabilités réunies ici parce que Next.js n'admet qu'un seul
 * middleware par application.
 *
 * 1. CSP par nonce : le nonce est transmis sur la requête (`x-nonce`, lu par le layout
 *    pour les scripts qu'il pose) et posé sur la réponse.
 *
 * 2. Formulaires POST multi-pages : un formulaire envoie son POST à l'adresse de la page
 *    (« /reservations/12/accepter »), que Next.js ne peut pas servir à la fois en page et
 *    en route. La requête est RÉÉCRITE vers `/envoi<chemin>`, où vivent les gestionnaires
 *    (route.ts), sans que l'adresse change pour le navigateur.
 *
 * 3. Jeton CSRF : un cookie `cityresa_csrf` est posé à la première visite ; les
 *    formulaires le recopient dans un champ caché, que `server/http.ts` compare.
 *
 * 4. Origine d'une fiche : la page d'où l'on a ouvert une fiche (`?retour=`) est retenue dans un
 *    cookie de session et transmise à la page (`x-retour`), pour que la flèche de retour y ramène
 *    encore après une action sur la fiche. La règle vit dans `lib/url.ts` (`retourMemorise`).
 *
 * Le chemin courant est aussi transmis (`x-pathname`, `x-search`) pour le menu, et un
 * identifiant de requête (`x-request-id`) relie journaux et écran.
 */
export default function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    const fwd = request.headers.get("x-forwarded-for");
    const trusted = fwd?.split(",").at(-1)?.trim();
    if (trusted && trusted !== fwd) headers.set("x-forwarded-for", trusted);
  }

  const requestId = generateNonce()
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 12);
  headers.set("x-request-id", requestId);
  headers.set("x-pathname", pathname);
  headers.set("x-search", request.nextUrl.search);

  // L'origine de la fiche affichée ; un `x-retour` venu du client n'est jamais repris.
  headers.delete("x-retour");
  const fiche = request.method === "GET" ? cheminFiche(pathname) : null;
  const origine = fiche
    ? retourMemorise({
        fiche,
        param: request.nextUrl.searchParams.get("retour"),
        cookie: request.cookies.get(COOKIE_RETOUR)?.value,
        referent: cheminReferent(request),
      })
    : null;
  if (origine?.retour) headers.set("x-retour", encodeURIComponent(origine.retour));

  const nonce = generateNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV !== "production");
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  let csrf = request.cookies.get("cityresa_csrf")?.value;
  let csrfNeuf = false;
  if (!csrf || csrf.length < 32) {
    csrf =
      generateNonce().replace(/[^A-Za-z0-9]/g, "") + generateNonce().replace(/[^A-Za-z0-9]/g, "");
    csrfNeuf = true;
    headers.set("x-csrf-token", csrf);
  }

  const estFormulaire =
    request.method === "POST" &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/envoi/") &&
    !request.headers.has("next-action");

  let response: NextResponse;
  if (estFormulaire) {
    const url = request.nextUrl.clone();
    url.pathname = `/envoi${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url, { request: { headers } });
  } else {
    response = NextResponse.next({ request: { headers } });
  }
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-request-id", requestId);
  const cookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIES !== "true",
  };
  if (csrfNeuf) response.cookies.set("cityresa_csrf", csrf, cookie);
  if (typeof origine?.cookie === "string")
    response.cookies.set(COOKIE_RETOUR, origine.cookie, cookie);
  else if (origine?.cookie === null) response.cookies.delete(COOKIE_RETOUR);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.[^/]+$).*)", "/api/auth/:path*"],
};
