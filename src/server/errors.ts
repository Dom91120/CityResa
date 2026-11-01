import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { journal } from "@/server/log";

/**
 * Erreurs destinées à être LUES PAR L'USAGER : leur message passe tel quel à l'écran.
 * Toute autre erreur est remplacée par un libellé générique et une référence courte,
 * journalisée avec l'erreur complète côté serveur.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

async function reference(): Promise<string> {
  try {
    const id = (await headers()).get("x-request-id");
    if (id) return id;
  } catch {
    // Hors contexte de requête.
  }
  return randomBytes(3).toString("hex").toUpperCase();
}

/** Message affichable pour une erreur interceptée. */
export async function messageClient(
  e: unknown,
  fallback: string,
  contexte: string,
): Promise<string> {
  if (e instanceof UserFacingError) return e.message;
  const ref = await reference();
  journal.erreur(contexte, fallback, { req: ref, erreur: e });
  return `${fallback} (référence ${ref})`;
}
