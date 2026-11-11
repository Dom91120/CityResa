/**
 * Les fils de discussion d'un dossier : une conversation est « en attente de réponse » quand
 * son dernier message échangé avec l'usager vient de l'usager. Lire le message ne suffit pas :
 * seule une réponse d'un agent à l'usager la sort de l'attente. Les notes internes entre
 * agents et les messages automatiques (système) ne comptent pas.
 * Logique PURE : testée dans messages.test.ts.
 */

export type MessageFil = { authorKind: string; isInternal: boolean; createdAt: Date };

/** Le message qui compte pour savoir qui doit répondre : échangé entre usager et agent. */
export function compteDansLeFil(m: Pick<MessageFil, "authorKind" | "isInternal">): boolean {
  return !m.isInternal && (m.authorKind === "usager" || m.authorKind === "agent");
}

/** La conversation attend-elle une réponse d'un agent ? (messages dans n'importe quel ordre) */
export function attendReponse(messages: readonly MessageFil[]): boolean {
  let dernier: MessageFil | null = null;
  for (const m of messages) {
    if (!compteDansLeFil(m)) continue;
    if (!dernier || m.createdAt > dernier.createdAt) dernier = m;
  }
  return dernier?.authorKind === "usager";
}

/** « 3 conversations à répondre » ; vide si aucune. */
export function libelleARepondre(n: number): string {
  if (!n) return "";
  return `${n} conversation${n > 1 ? "s" : ""} à répondre`;
}
