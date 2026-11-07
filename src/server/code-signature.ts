/**
 * La mécanique commune de signature par code à usage unique (conventions, dossiers de
 * subvention) : un code à 6 chiffres envoyé par SMS, à défaut par courriel, stocké en empreinte,
 * cinq essais, validité SIGNATURE_VALIDITE_HEURES.
 */
import { getSettings } from "@/server/config-store";
import { codeNumerique, hmacSign, timingSafeEqualStr } from "@/server/crypto";
import { UserFacingError } from "@/server/errors";
import { enabledIn } from "@/server/features";
import { envoyerSms, normaliserMobile } from "@/server/sms";

export const MAX_ESSAIS_SIGNATURE = 5;

export type CodeEmis = {
  code: string;
  hash: string;
  expiresAt: Date;
  validiteHeures: number;
  canal: "sms" | "email";
  mobile: string | null;
};

export function empreinteCode(portee: string, id: number, code: string): string {
  return hmacSign(`signature-${portee}`, `${id}:${code}`);
}

/**
 * Tire un code, tente l'envoi par SMS (si le module SMS est actif et qu'un mobile est connu) ;
 * sinon le canal est le courriel, que l'appelant envoie avec `code` et `validite`.
 */
export async function emettreCode(
  portee: string,
  id: number,
  texteSms: (code: string, validite: number) => string,
  telephone: string | null | undefined,
): Promise<CodeEmis> {
  const cfg = await getSettings();
  if (!enabledIn(cfg, "signature"))
    throw new UserFacingError("La signature électronique est désactivée.");
  const code = codeNumerique(6);
  const validiteHeures = cfg.SIGNATURE_VALIDITE_HEURES || 72;
  const expiresAt = new Date(Date.now() + validiteHeures * 3_600_000);
  const mobile = normaliserMobile(telephone);
  let canal: "sms" | "email" = "email";
  if (cfg.SMS_ENABLED && mobile) {
    const ok = await envoyerSms(mobile, texteSms(code, validiteHeures));
    if (ok) canal = "sms";
  }
  return { code, hash: empreinteCode(portee, id, code), expiresAt, validiteHeures, canal, mobile };
}

export type EtatCode = {
  signatureCodeHash: string | null;
  signatureExpiresAt: Date | null;
  signatureAttempts: number;
};

/**
 * Vérifie un code saisi. Renvoie `true` s'il est bon ; `false` s'il est faux (l'appelant
 * incrémente les essais) ; lève une erreur si aucun code n'est en attente, expiré ou épuisé.
 */
export function verifierCode(portee: string, id: number, etat: EtatCode, saisi: string): boolean {
  if (!etat.signatureCodeHash) throw new UserFacingError("Aucune signature en attente.");
  if (etat.signatureExpiresAt && etat.signatureExpiresAt < new Date())
    throw new UserFacingError("Le code a expiré : demandez-en un nouveau.");
  if (etat.signatureAttempts >= MAX_ESSAIS_SIGNATURE)
    throw new UserFacingError("Trop d'essais : demandez un nouveau code.");
  const code = saisi.replace(/\s+/g, "");
  return timingSafeEqualStr(empreinteCode(portee, id, code), etat.signatureCodeHash);
}

export function messageCodeIncorrect(essaisFaits: number): string {
  return `Code incorrect (${MAX_ESSAIS_SIGNATURE - essaisFaits - 1} essai(s) restant(s)).`;
}
