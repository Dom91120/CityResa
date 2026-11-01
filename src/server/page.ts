/**
 * Le contexte d'une page connectée : utilisateur, compteurs du menu, messages flash,
 * jeton CSRF, nonce CSP, chemin courant, modules actifs.
 */
import { headers } from "next/headers";
import { cache } from "react";
import { allFlagsIn, type FeatureFlags } from "@/server/features";
import { type Flash, readFlashes } from "@/server/flash";
import { type CurrentUser, requireAgent, requireUsager } from "@/server/guards";
import { csrfToken } from "@/server/http";
import { navCounts } from "@/server/nav";

export type Page = {
  user: CurrentUser;
  counts: Record<string, number>;
  flashes: Flash[];
  csrf: string;
  nonce: string | undefined;
  pathname: string;
  search: URLSearchParams;
  features: FeatureFlags;
};

/** Page du back-office (agent connecté). */
export const contextePage = cache(async (): Promise<Page> => {
  const user = await requireAgent();
  const h = await headers();
  const [counts, flashes, csrf] = await Promise.all([navCounts(user), readFlashes(), csrfToken()]);
  return {
    user,
    counts,
    flashes,
    csrf,
    nonce: h.get("x-nonce") ?? undefined,
    pathname: h.get("x-pathname") ?? "/",
    search: new URLSearchParams(h.get("x-search") ?? ""),
    features: allFlagsIn(user.settings),
  };
});

/** Page du portail (usager connecté). */
export const contexteUsager = cache(async (): Promise<Page> => {
  const user = await requireUsager();
  const h = await headers();
  const [counts, flashes, csrf] = await Promise.all([navCounts(user), readFlashes(), csrfToken()]);
  return {
    user,
    counts,
    flashes,
    csrf,
    nonce: h.get("x-nonce") ?? undefined,
    pathname: h.get("x-pathname") ?? "/",
    search: new URLSearchParams(h.get("x-search") ?? ""),
    features: allFlagsIn(user.settings),
  };
});

/** Le nonce, le jeton CSRF et les flashs d'une page sans session (connexion, portail public). */
export async function contexteAnonyme(): Promise<{
  nonce: string | undefined;
  csrf: string;
  flashes: Flash[];
  pathname: string;
  search: URLSearchParams;
}> {
  const h = await headers();
  const [csrf, flashes] = await Promise.all([csrfToken(), readFlashes()]);
  return {
    nonce: h.get("x-nonce") ?? undefined,
    csrf,
    flashes,
    pathname: h.get("x-pathname") ?? "/",
    search: new URLSearchParams(h.get("x-search") ?? ""),
  };
}
