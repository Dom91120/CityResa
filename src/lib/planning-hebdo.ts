/**
 * Envoi programmé des plannings : chaque semaine, les gestionnaires reçoivent par courriel le
 * planning hebdomadaire (PDF) des espaces dont ils ont la charge, avec un résumé en texte.
 * Logique PURE : testée dans planning-hebdo.test.ts.
 */
import { addDaysUtc, parseYmdUtc, ymdUtc } from "@/lib/date-utc";
import { type EvtSemaine, lundiDe } from "@/lib/editions";
import { hm, parisParts, todayParisISO } from "@/lib/paris-time";

/** Le jour ISO configuré (1 = lundi … 7 = dimanche) est-il aujourd'hui (heure de Paris) ? */
export function estJourEnvoi(jour: number, now = new Date()): boolean {
  return parisParts(now).weekday === jour;
}

/**
 * Le lundi de la semaine à éditer : la semaine en cours quand l'envoi part en début de semaine
 * (lundi à jeudi), la semaine suivante quand il part en fin de semaine (vendredi à dimanche).
 */
export function lundiAEditer(now = new Date()): string {
  const aujourdhui = todayParisISO(now);
  const lundi = lundiDe(aujourdhui);
  return parisParts(now).weekday >= 5 ? ymdUtc(addDaysUtc(parseYmdUtc(lundi), 7)) : lundi;
}

export type LienGestion = { userId: string; espaceId: number; role: string };
export type AgentHebdo = {
  id: string;
  email: string;
  firstName: string;
  isActive: boolean;
  notifEmail: boolean;
};
export type EspaceHebdo = { id: number; name: string; site: string; isActive: boolean };

/** Les rôles sur un espace qui valent abonnement au planning (le lecteur consulte, sans courriel). */
export const ROLES_ABONNES = ["gestionnaire", "notifie"];

/** Par agent actif qui accepte les courriels, les espaces actifs dont il a la charge (site puis nom). */
export function destinataires(
  liens: readonly LienGestion[],
  agents: readonly AgentHebdo[],
  espaces: readonly EspaceHebdo[],
): { agent: AgentHebdo; espaces: EspaceHebdo[] }[] {
  const parEspace = new Map(espaces.filter((e) => e.isActive).map((e) => [e.id, e]));
  const parAgent = new Map(agents.filter((a) => a.isActive && a.notifEmail).map((a) => [a.id, a]));
  const out = new Map<string, EspaceHebdo[]>();
  for (const l of liens) {
    if (!ROLES_ABONNES.includes(l.role)) continue;
    const e = parEspace.get(l.espaceId);
    if (!e || !parAgent.has(l.userId)) continue;
    const liste = out.get(l.userId) ?? [];
    if (!liste.some((x) => x.id === e.id)) liste.push(e);
    out.set(l.userId, liste);
  }
  return [...out]
    .map(([userId, liste]) => ({
      agent: parAgent.get(userId) as AgentHebdo,
      espaces: liste.sort((a, b) => a.site.localeCompare(b.site) || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.agent.email.localeCompare(b.agent.email));
}

/** Le résumé en texte du planning d'un agent : par espace, ses créneaux de la semaine. */
export function resumeSemaine(
  espaces: readonly EspaceHebdo[],
  evts: readonly EvtSemaine[],
  jours: readonly string[],
): string {
  return espaces
    .map((e) => {
      const miens = evts
        .filter((x) => x.espaceId === e.id)
        .sort((a, b) => a.jour - b.jour || a.debutMin - b.debutMin);
      const resas = miens.filter((x) => x.genre === "reservation").length;
      const entete = `${e.name} (${e.site}) : ${resas ? `${resas} créneau${resas > 1 ? "x" : ""}` : "aucun créneau"}`;
      const lignes = miens.map(
        (x) =>
          `  – ${jours[x.jour - 1] ?? ""} ${hm(x.debutMin)}–${hm(x.finMin)} · ${x.genre === "blocage" ? "fermé : " : ""}${x.titre}${x.sousTitre ? ` (${x.sousTitre})` : ""}`,
      );
      return [entete, ...lignes].join("\n");
    })
    .join("\n\n");
}

export function nomFichierPlanning(lundi: string): string {
  return `planning-semaine-${lundi}.pdf`;
}
