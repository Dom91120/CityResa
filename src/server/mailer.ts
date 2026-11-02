/**
 * Envoi des courriels (SMTP via Nodemailer) depuis les modèles en base. Hors
 * configuration SMTP ou MAIL_ENABLED à faux, le courriel est seulement journalisé (mail_log
 * avec le statut « simule ») : le développement ne perd rien et n'envoie rien.
 */
import nodemailer from "nodemailer";
import { type AppSettings, getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { EMAIL_TEMPLATE_SEEDS, escapeHtml, rendre, versTexte } from "@/server/email-templates";
import { journal } from "@/server/log";

export type Attachment = { filename: string; content: Buffer; contentType?: string };

export type Courriel = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  templateKey?: string;
  reservationId?: number | null;
  attachments?: Attachment[];
};

/** Habillage commun : en-tête à la couleur de la collectivité, pied de page. */
export function habiller(cfg: AppSettings, corps: string): string {
  const couleur = cfg.UI_PRIMARY_COLOR || "#006e46";
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f6f6f8;font-family:Poppins,Segoe UI,Arial,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.06)">
<tr><td style="background:${couleur};color:#fff;padding:18px 24px;font-size:18px;font-weight:600">${escapeHtml(cfg.COLLECTIVITE_NOM)} · Réservation d'espaces</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">${corps}</td></tr>
<tr><td style="padding:14px 24px;background:#fafafa;color:#6b7280;font-size:12px">${escapeHtml(cfg.COLLECTIVITE_NOM)}${cfg.COLLECTIVITE_ADRESSE ? ` · ${escapeHtml(cfg.COLLECTIVITE_ADRESSE)}` : ""}${cfg.COLLECTIVITE_EMAIL ? ` · ${escapeHtml(cfg.COLLECTIVITE_EMAIL)}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
}

function transporteur(cfg: AppSettings) {
  return nodemailer.createTransport({
    host: cfg.MAIL_SERVER,
    port: cfg.MAIL_PORT,
    secure: cfg.MAIL_PORT === 465,
    requireTLS: cfg.MAIL_USE_TLS && cfg.MAIL_PORT !== 465,
    auth: cfg.MAIL_USERNAME ? { user: cfg.MAIL_USERNAME, pass: cfg.MAIL_PASSWORD } : undefined,
    connectionTimeout: 15_000,
  });
}

async function tracer(
  c: Courriel,
  status: "sent" | "simule" | "erreur",
  error?: string,
): Promise<void> {
  try {
    const to = Array.isArray(c.to) ? c.to.join(", ") : c.to;
    await prisma.mailLog.create({
      data: {
        channel: "email",
        recipient: to.slice(0, 200),
        subject: c.subject.slice(0, 200),
        templateKey: c.templateKey ?? null,
        status,
        error: error ?? null,
        reservationId: c.reservationId ?? null,
      },
    });
  } catch (e) {
    journal.avert("mailer", "trace impossible", { erreur: e });
  }
}

/** Envoie un courriel (ou le simule). Ne lève jamais : renvoie vrai si parti. */
export async function envoyerMail(c: Courriel): Promise<boolean> {
  const cfg = await getSettings();
  const to = Array.isArray(c.to) ? c.to.filter(Boolean) : [c.to].filter(Boolean);
  if (!to.length) return false;
  const html = habiller(cfg, c.html);
  const text = c.text ?? versTexte(c.html);
  const simule = !cfg.MAIL_ENABLED || !cfg.MAIL_SERVER || cfg.MAIL_SERVER === "localhost";
  if (simule) {
    journal.info("mailer", "courriel simulé", { to, sujet: c.subject, modele: c.templateKey });
    if (process.env.NODE_ENV !== "production")
      console.log(
        `\n── Courriel (simulé) → ${to.join(", ")}\n   ${c.subject}\n${text
          .split("\n")
          .map((l) => `   ${l}`)
          .join("\n")}\n`,
      );
    await tracer(c, "simule");
    return true;
  }
  try {
    await transporteur(cfg).sendMail({
      from: cfg.MAIL_DEFAULT_SENDER,
      to,
      subject: c.subject,
      html,
      text,
      attachments: c.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    await tracer(c, "sent");
    return true;
  } catch (e) {
    journal.erreur("mailer", "envoi échoué", { to, sujet: c.subject, erreur: e });
    await tracer(c, "erreur", e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** Le modèle `key` tel qu'il est en base (ou sa valeur de départ). */
export async function modele(
  key: string,
): Promise<{ subject: string; body: string; actif: boolean }> {
  const row = await prisma.emailTemplate.findUnique({ where: { key } });
  if (row) return { subject: row.subject, body: row.body, actif: row.isActive };
  const seed = EMAIL_TEMPLATE_SEEDS.find((s) => s.key === key);
  if (!seed) throw new Error(`Modèle de courriel inconnu : ${key}`);
  return { subject: seed.subject, body: seed.body, actif: true };
}

/** Variables communes à tous les modèles. */
export async function variablesCommunes(): Promise<Record<string, string>> {
  const cfg = await getSettings();
  return {
    collectivite: cfg.COLLECTIVITE_NOM,
    base_url: cfg.APP_BASE_URL,
  };
}

/** Envoie un courriel depuis un modèle. Un modèle désactivé n'envoie rien. */
export async function envoyerDepuisModele(
  key: string,
  to: string | string[],
  vars: Record<string, string | number | null | undefined>,
  opts: { reservationId?: number | null; attachments?: Attachment[] } = {},
): Promise<boolean> {
  const m = await modele(key);
  if (!m.actif) return false;
  const toutes = { ...(await variablesCommunes()), ...vars };
  return envoyerMail({
    to,
    subject: rendre(m.subject, toutes)
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&"),
    html: rendre(m.body, toutes),
    templateKey: key,
    reservationId: opts.reservationId,
    attachments: opts.attachments,
  });
}

/** Lien de réinitialisation du mot de passe (appelé par Better Auth). */
export async function envoyerReinitialisation(
  email: string,
  nom: string,
  url: string,
): Promise<void> {
  await envoyerDepuisModele("mot_de_passe", email, { prenom: nom, lien: url });
}

/** Test de la configuration SMTP depuis Paramètres. */
export async function testerSmtp(to: string): Promise<{ ok: boolean; message: string }> {
  const cfg = await getSettings();
  if (!cfg.MAIL_SERVER || cfg.MAIL_SERVER === "localhost")
    return { ok: false, message: "Aucun serveur SMTP configuré (les courriels sont simulés)." };
  try {
    await transporteur(cfg).sendMail({
      from: cfg.MAIL_DEFAULT_SENDER,
      to,
      subject: "CityRésa : test d'envoi",
      text: "Ce message confirme que la configuration SMTP de CityRésa fonctionne.",
    });
    return { ok: true, message: `Courriel de test envoyé à ${to}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
