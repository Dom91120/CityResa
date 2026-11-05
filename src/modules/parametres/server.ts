/**
 * Paramètres : les onglets, les clés que chacun enregistre, et la lecture d'un onglet
 * depuis son formulaire (booléens non cochés → "false", secret vide → inchangé).
 */
import { coche } from "@/lib/forms-util";
import { lireReglePieces } from "@/lib/pieces";
import { normalizeColor } from "@/lib/theming";
import { BOOL_KEYS, FLOAT_KEYS, INT_KEYS, SECRET_KEYS } from "@/server/config-store";
import { FEATURES, type FeatureName } from "@/server/features";

export type Onglet = { cle: string; label: string; icone: string; cles: string[] };

const MODULES_CLES = (Object.keys(FEATURES) as FeatureName[])
  .map((n) => FEATURES[n][0])
  .filter(
    (k) => k !== "PORTAIL_ENABLED" && k !== "INSCRIPTION_ENABLED" && k !== "DOCUMENTS_ENABLED",
  );

export const ONGLETS: Onglet[] = [
  {
    cle: "collectivite",
    label: "Collectivité",
    icone: "landmark",
    cles: [
      "COLLECTIVITE_NOM",
      "COLLECTIVITE_ADRESSE",
      "COLLECTIVITE_EMAIL",
      "COLLECTIVITE_TELEPHONE",
      "COLLECTIVITE_SITE_WEB",
      "COLLECTIVITE_SIGNATAIRE",
      "COLLECTIVITE_SIGNATAIRE_QUALITE",
    ],
  },
  {
    cle: "portail",
    label: "Portail",
    icone: "globe",
    cles: [
      "PORTAIL_ENABLED",
      "PORTAIL_TITRE",
      "PORTAIL_ACCROCHE",
      "PORTAIL_CONDITIONS",
      "PORTAIL_AFFICHER_TARIFS",
      "INSCRIPTION_ENABLED",
      "VALIDATION_COMPTE_USAGER",
    ],
  },
  {
    cle: "reservations",
    label: "Réservations",
    icone: "clipboard-list",
    cles: [
      "DELAI_ANNULATION_JOURS",
      "ACOMPTE_PCT",
      "TVA_TAUX",
      "ARCHIVAGE_AUTO_JOURS",
      "RELANCE_SIGNATURE_JOURS",
      "SIGNATURE_VALIDITE_HEURES",
      "ALERTE_PIECES_JOURS",
      "PIECES_REGLE",
      "RAPPEL_J7",
      "RAPPEL_J1",
      "AGENTS_NOTIFIES",
    ],
  },
  { cle: "convention", label: "Convention", icone: "file-signature", cles: ["CONVENTION_TEXTE"] },
  {
    cle: "messagerie",
    label: "Messagerie",
    icone: "mail",
    cles: [
      "MAIL_ENABLED",
      "MAIL_SERVER",
      "MAIL_PORT",
      "MAIL_USE_TLS",
      "MAIL_USERNAME",
      "MAIL_PASSWORD",
      "MAIL_DEFAULT_SENDER",
    ],
  },
  {
    cle: "sms",
    label: "SMS",
    icone: "smartphone",
    cles: ["SMS_ENABLED", "SMS_PROVIDER", "SMS_API_URL", "SMS_API_KEY", "SMS_SENDER"],
  },
  { cle: "modules", label: "Modules", icone: "puzzle", cles: MODULES_CLES },
  {
    cle: "pieces",
    label: "Pièces jointes",
    icone: "paperclip",
    cles: ["DOCUMENTS_ENABLED", "DOCUMENT_MAX_MB"],
  },
  { cle: "apparence", label: "Apparence", icone: "palette", cles: ["UI_PRIMARY_COLOR"] },
  { cle: "sauvegardes", label: "Sauvegardes", icone: "database", cles: ["BACKUP_DB_KEEP"] },
];

export function onglet(cle: string): Onglet | undefined {
  return ONGLETS.find((o) => o.cle === cle);
}

/** Les mises à jour {CLÉ: chaîne} d'un onglet, depuis son formulaire. */
export function lireOnglet(form: FormData, o: Onglet): Record<string, string> {
  const maj: Record<string, string> = {};
  for (const key of o.cles) {
    if (BOOL_KEYS.has(key)) {
      maj[key] = coche(form, key) ? "true" : "false";
      continue;
    }
    const brut = form.get(key);
    const v = typeof brut === "string" ? brut.trim() : "";
    if (SECRET_KEYS.has(key)) {
      if (v) maj[key] = v;
      continue;
    }
    if (INT_KEYS.has(key)) {
      const n = Number.parseInt(v, 10);
      maj[key] = Number.isFinite(n) && n >= 0 ? String(n) : "0";
      continue;
    }
    if (FLOAT_KEYS.has(key)) {
      const n = Number.parseFloat(v.replace(",", "."));
      maj[key] = Number.isFinite(n) && n >= 0 ? String(n) : "0";
      continue;
    }
    if (key === "UI_PRIMARY_COLOR") {
      maj[key] = normalizeColor(v);
      continue;
    }
    if (key === "SMS_PROVIDER") {
      maj[key] = v === "http" ? "http" : "console";
      continue;
    }
    if (key === "PIECES_REGLE") {
      maj[key] = lireReglePieces(v);
      continue;
    }
    maj[key] = v;
  }
  return maj;
}
