/**
 * Envoi de SMS (code de signature, rappels). Deux fournisseurs :
 *  - `console` : le message est journalisé, rien n'est envoyé (développement, démo) ;
 *  - `http`    : POST JSON {to, from, text} sur SMS_API_URL avec `Authorization: Bearer
 *                SMS_API_KEY` (passerelle générique, à adapter à l'opérateur retenu).
 */
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { journal } from "@/server/log";

/** Un numéro français plausible, normalisé en +33. null sinon. */
export function normaliserMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let n = raw.replace(/[\s.\-()]/g, "");
  if (n.startsWith("0033")) n = `+33${n.slice(4)}`;
  else if (n.startsWith("0")) n = `+33${n.slice(1)}`;
  if (!/^\+33[67]\d{8}$/.test(n)) return null;
  return n;
}

async function tracer(to: string, text: string, status: string, error?: string): Promise<void> {
  try {
    await prisma.mailLog.create({
      data: {
        channel: "sms",
        recipient: to,
        subject: text.slice(0, 200),
        status,
        error: error ?? null,
      },
    });
  } catch {
    // best-effort
  }
}

/** Envoie un SMS. Renvoie vrai si parti (ou simulé). */
export async function envoyerSms(to: string, text: string): Promise<boolean> {
  const cfg = await getSettings();
  if (!cfg.SMS_ENABLED) return false;
  if (cfg.SMS_PROVIDER !== "http" || !cfg.SMS_API_URL) {
    journal.info("sms", "SMS simulé", { to, texte: text });
    if (process.env.NODE_ENV !== "production")
      console.log(`\n── SMS (simulé) → ${to}\n   ${text}\n`);
    await tracer(to, text, "simule");
    return true;
  }
  try {
    const r = await fetch(cfg.SMS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.SMS_API_KEY}`,
      },
      body: JSON.stringify({ to, from: cfg.SMS_SENDER, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await tracer(to, text, "sent");
    return true;
  } catch (e) {
    journal.erreur("sms", "envoi échoué", { to, erreur: e });
    await tracer(to, text, "erreur", e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** Le SMS est-il réellement envoyable (module actif ET numéro valide) ? */
export async function smsDisponible(numero: string | null | undefined): Promise<boolean> {
  const cfg = await getSettings();
  return Boolean(cfg.SMS_ENABLED && normaliserMobile(numero));
}
