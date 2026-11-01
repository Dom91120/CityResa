/**
 * Signature électronique de la convention : un code à usage unique envoyé par SMS (ou
 * par courriel à défaut), saisi par l'usager depuis son espace. Le code n'est stocké
 * qu'en empreinte ; cinq essais, validité SIGNATURE_VALIDITE_HEURES.
 */
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { codeNumerique, hmacSign, timingSafeEqualStr } from "@/server/crypto";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { enabledIn } from "@/server/features";
import { envoyerDepuisModele } from "@/server/mailer";
import { notifierAgents } from "@/server/notifications";
import {
  changerStatut,
  chargerReservation,
  courrielUsager,
  variablesDossier,
} from "@/server/reservations";
import { envoyerSms, normaliserMobile } from "@/server/sms";

const MAX_ESSAIS = 5;

function empreinte(reservationId: number, code: string): string {
  return hmacSign("signature-convention", `${reservationId}:${code}`);
}

/** Envoie un code de signature. Renvoie le canal utilisé. */
export async function demanderCode(
  reservationId: number,
  telephone: string | null,
): Promise<"sms" | "email"> {
  const cfg = await getSettings();
  if (!enabledIn(cfg, "signature"))
    throw new UserFacingError("La signature électronique est désactivée.");
  const r = await chargerReservation(reservationId);
  if (!r) throw new UserFacingError("Réservation introuvable.");
  if (r.status !== "acceptee")
    throw new UserFacingError("Cette convention n'est pas en attente de signature.");
  const code = codeNumerique(6);
  const validite = cfg.SIGNATURE_VALIDITE_HEURES || 72;
  const expires = new Date(Date.now() + validite * 3_600_000);
  const mobile = normaliserMobile(telephone ?? r.user?.phone ?? r.organisation?.phone);
  if (mobile && r.userId && telephone && !r.user?.phone) {
    await prisma.user.update({ where: { id: r.userId }, data: { phone: mobile } });
  }
  let canal: "sms" | "email" = "email";
  if (cfg.SMS_ENABLED && mobile) {
    const ok = await envoyerSms(
      mobile,
      `${cfg.COLLECTIVITE_NOM} : votre code de signature de la convention ${r.numero} est ${code} (valable ${validite} h).`,
    );
    if (ok) canal = "sms";
  }
  if (canal === "email") {
    const vars = await variablesDossier(r);
    await envoyerDepuisModele(
      "signature_code",
      r.user?.email ?? r.organisation?.email ?? "",
      { ...vars, code, validite: `${validite} h` },
      { reservationId: r.id },
    );
  }
  await prisma.reservation.update({
    where: { id: r.id },
    data: {
      signatureChannel: canal,
      signatureSentAt: new Date(),
      signatureCodeHash: empreinte(r.id, code),
      signatureExpiresAt: expires,
      signatureAttempts: 0,
    },
  });
  await prisma.reservationHistory.create({
    data: {
      reservationId: r.id,
      action: "Code de signature envoyé",
      comment: canal === "sms" ? `par SMS au ${mobile}` : "par courriel",
      performedBy: "système",
    },
  });
  return canal;
}

/** Vérifie le code et signe la convention. */
export async function signer(
  reservationId: number,
  code: string,
  signerName: string,
  ip: string,
): Promise<void> {
  const r = await chargerReservation(reservationId);
  if (!r) throw new UserFacingError("Réservation introuvable.");
  if (r.status !== "acceptee" || !r.signatureCodeHash)
    throw new UserFacingError("Aucune signature en attente sur ce dossier.");
  if (r.signatureExpiresAt && r.signatureExpiresAt < new Date())
    throw new UserFacingError("Le code a expiré : demandez-en un nouveau.");
  if (r.signatureAttempts >= MAX_ESSAIS)
    throw new UserFacingError("Trop d'essais : demandez un nouveau code.");
  const nom = signerName.trim();
  if (nom.length < 3) throw new UserFacingError("Indiquez votre nom complet pour signer.");
  const saisi = code.replace(/\s+/g, "");
  if (!timingSafeEqualStr(empreinte(r.id, saisi), r.signatureCodeHash)) {
    await prisma.reservation.update({
      where: { id: r.id },
      data: { signatureAttempts: { increment: 1 } },
    });
    throw new UserFacingError(
      `Code incorrect (${MAX_ESSAIS - r.signatureAttempts - 1} essai(s) restant(s)).`,
    );
  }
  await prisma.reservation.update({
    where: { id: r.id },
    data: {
      signedAt: new Date(),
      signerName: nom,
      signerIp: ip.slice(0, 64),
      signatureCodeHash: null,
    },
  });
  const signee = (await chargerReservation(r.id)) ?? r;
  const { genererConvention } = await import("@/server/convention");
  await genererConvention(signee, nom).catch((e) => console.error("[convention signée]", e));
  await auditRecord(
    "signature convention",
    `${r.numero} par ${nom}`,
    "reservations",
    r.user?.email ?? nom,
  );
  const cfg = await getSettings();
  const suite =
    enabledIn(cfg, "paiements") && r.montantTtc > 0 && r.acompte > 0
      ? "Votre réservation sera confirmée à réception de l'acompte."
      : "Votre réservation est confirmée.";
  await courrielUsager(signee, "reservation_signee", {
    date_signature: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
    suite,
  });
  await notifierAgents(
    r.espaceId,
    "signature",
    `Convention ${r.numero} signée`,
    `par ${nom}`,
    `/reservations/${r.id}`,
  );
  // Sans acompte attendu, le dossier est confirmé d'office.
  const attendAcompte = enabledIn(cfg, "paiements") && r.montantTtc > 0 && r.acompte > 0;
  await changerStatut(
    r.id,
    attendAcompte ? "signee" : "confirmee",
    { name: nom, isAgent: false },
    { parSysteme: true },
  );
}
