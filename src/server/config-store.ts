/**
 * Configuration applicative persistée en base (table app_config).
 *
 * - Le `.env` ne sert que pour l'amorçage et comme repli.
 * - Les valeurs sensibles (mots de passe, clés) sont chiffrées (server/secret-crypto.ts).
 * - Toute clé MANAGED est modifiable depuis Paramètres.
 */
import { prisma } from "@/server/db";
import { decryptSecret, encryptSecret } from "@/server/secret-crypto";

export const SECRET_KEYS = new Set(["MAIL_PASSWORD", "SMS_API_KEY"]);

export const BOOL_KEYS = new Set([
  "MAIL_ENABLED",
  "MAIL_USE_TLS",
  "SMS_ENABLED",
  "PORTAIL_ENABLED",
  "INSCRIPTION_ENABLED",
  "PAIEMENTS_ENABLED",
  "SIGNATURE_ENABLED",
  "MATERIEL_ENABLED",
  "SUBVENTIONS_ENABLED",
  "DOCUMENTS_ENABLED",
  "CAMPAGNES_ENABLED",
  "RAPPEL_J7",
  "RAPPEL_J1",
  "VALIDATION_COMPTE_USAGER",
  "PORTAIL_AFFICHER_TARIFS",
]);
export const INT_KEYS = new Set([
  "MAIL_PORT",
  "DOCUMENT_MAX_MB",
  "BACKUP_DB_KEEP",
  "RELANCE_SIGNATURE_JOURS",
  "ARCHIVAGE_AUTO_JOURS",
  "DELAI_ANNULATION_JOURS",
  "SIGNATURE_VALIDITE_HEURES",
  "ALERTE_PIECES_JOURS",
  "CAUTION_DELAI_RESTITUTION_JOURS",
  "OPTION_RELANCE_JOURS",
]);
export const FLOAT_KEYS = new Set([
  "TVA_TAUX",
  "ACOMPTE_PCT",
  "CAUTION_SEUIL_VALIDATION",
  "VALORISATION_SEUIL_CONVENTION",
  "VALORISATION_SEUIL_CERTIFICATION",
]);

/** Ensemble des clés gérées en base (= celles écrites par la page Paramètres). */
export const MANAGED = new Set<string>([
  ...BOOL_KEYS,
  ...INT_KEYS,
  ...FLOAT_KEYS,
  "COLLECTIVITE_NOM",
  "COLLECTIVITE_ADRESSE",
  "COLLECTIVITE_EMAIL",
  "PIECES_REGLE",
  "ANNULATION_BAREME",
  "COLLECTIVITE_TELEPHONE",
  "COLLECTIVITE_SITE_WEB",
  "COLLECTIVITE_SIGNATAIRE",
  "COLLECTIVITE_SIGNATAIRE_QUALITE",
  "COLLECTIVITE_LOGO",
  "UI_PRIMARY_COLOR",
  "PORTAIL_TITRE",
  "PORTAIL_ACCROCHE",
  "PORTAIL_CONDITIONS",
  "MAIL_SERVER",
  "MAIL_USERNAME",
  "MAIL_PASSWORD",
  "MAIL_DEFAULT_SENDER",
  "SMS_PROVIDER",
  "SMS_API_URL",
  "SMS_API_KEY",
  "SMS_SENDER",
  "CONVENTION_TEXTE",
  "AGENTS_NOTIFIES",
]);

/** Réglages NON gérés en base (amorçage et sécurité), lus dans l'environnement seul. */
export type EnvOnly = {
  SESSION_LIFETIME_MINUTES: number;
  PASSWORD_MIN_LENGTH: number;
  LOGIN_MAX_ATTEMPTS: number;
  LOGIN_LOCKOUT_MINUTES: number;
  REQUIRE_2FA_ADMIN: boolean;
  TRUST_PROXY: boolean;
  APP_BASE_URL: string;
  BACKUP_DB_DIR: string;
  ADMIN_EMAIL: string;
};

/** La configuration vivante. */
export type AppSettings = EnvOnly & {
  COLLECTIVITE_NOM: string;
  COLLECTIVITE_ADRESSE: string;
  COLLECTIVITE_EMAIL: string;
  COLLECTIVITE_TELEPHONE: string;
  COLLECTIVITE_SITE_WEB: string;
  /** Logo de la collectivité en URL de données (vide = pictogramme par défaut). */
  COLLECTIVITE_LOGO: string;
  COLLECTIVITE_SIGNATAIRE: string;
  COLLECTIVITE_SIGNATAIRE_QUALITE: string;
  UI_PRIMARY_COLOR: string;
  PORTAIL_TITRE: string;
  PORTAIL_ACCROCHE: string;
  PORTAIL_CONDITIONS: string;
  MAIL_ENABLED: boolean;
  MAIL_SERVER: string;
  MAIL_PORT: number;
  MAIL_USE_TLS: boolean;
  MAIL_USERNAME: string;
  MAIL_PASSWORD: string;
  MAIL_DEFAULT_SENDER: string;
  SMS_ENABLED: boolean;
  SMS_PROVIDER: string;
  SMS_API_URL: string;
  SMS_API_KEY: string;
  SMS_SENDER: string;
  PORTAIL_ENABLED: boolean;
  INSCRIPTION_ENABLED: boolean;
  PAIEMENTS_ENABLED: boolean;
  SIGNATURE_ENABLED: boolean;
  MATERIEL_ENABLED: boolean;
  SUBVENTIONS_ENABLED: boolean;
  DOCUMENTS_ENABLED: boolean;
  CAMPAGNES_ENABLED: boolean;
  DOCUMENT_MAX_MB: number;
  TVA_TAUX: number;
  ACOMPTE_PCT: number;
  RAPPEL_J7: boolean;
  RAPPEL_J1: boolean;
  VALIDATION_COMPTE_USAGER: boolean;
  PORTAIL_AFFICHER_TARIFS: boolean;
  RELANCE_SIGNATURE_JOURS: number;
  ARCHIVAGE_AUTO_JOURS: number;
  DELAI_ANNULATION_JOURS: number;
  SIGNATURE_VALIDITE_HEURES: number;
  ALERTE_PIECES_JOURS: number;
  /** avertir | depot | acceptation : effet des pièces attendues manquantes ou expirées. */
  PIECES_REGLE: string;
  /** Barème de frais d'annulation « 30:0;7:50;0:100 » (jours avant : % du TTC) ; vide = aucun. */
  ANNULATION_BAREME: string;
  /** Au-delà de ce montant (€), une retenue sur caution attend la validation d'un administrateur. */
  CAUTION_SEUIL_VALIDATION: number;
  /** Jours après la fin de l'événement avant qu'une caution non restituée soit en alerte. */
  CAUTION_DELAI_RESTITUTION_JOURS: number;
  /** Jours avant l'échéance d'une option où l'usager est relancé. */
  OPTION_RELANCE_JOURS: number;
  /** Total d'aides (avantages en nature + subventions) à partir duquel une convention est obligatoire. */
  VALORISATION_SEUIL_CONVENTION: number;
  /** Total d'aides à partir duquel les comptes de l'association doivent être certifiés. */
  VALORISATION_SEUIL_CERTIFICATION: number;
  CONVENTION_TEXTE: string;
  AGENTS_NOTIFIES: string;
  BACKUP_DB_KEEP: number;
  [key: string]: unknown;
};

function envBool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  return ["true", "1", "yes", "on"].includes(v.toLowerCase());
}
function envInt(name: string, def: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) ? n : def;
}
function envFloat(name: string, def: number): number {
  const n = Number.parseFloat((process.env[name] ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : def;
}
function envStr(name: string, def = ""): string {
  return process.env[name] ?? def;
}

export const CONVENTION_TEXTE_DEFAUT = `La collectivité met à disposition de l'occupant l'espace désigné ci-dessus, aux dates et horaires indiqués, pour l'objet déclaré et pour lui seul.

L'occupant s'engage à respecter le règlement intérieur de l'espace, les consignes de sécurité, la capacité d'accueil autorisée, et à restituer les lieux dans l'état où il les a trouvés. Il est responsable des dommages causés aux locaux, au mobilier et au matériel pendant la durée de l'occupation et déclare être couvert par une assurance responsabilité civile.

Toute sous-location est interdite. La collectivité se réserve le droit d'annuler la mise à disposition pour un motif d'intérêt général.

La redevance, la caution et les éventuelles prestations complémentaires sont celles détaillées dans la présente convention ; leur règlement s'effectue selon les modalités indiquées.`;

/** Les défauts, lus dans l'environnement. */
export function envDefaults(): AppSettings {
  return {
    SESSION_LIFETIME_MINUTES: envInt("SESSION_LIFETIME_MINUTES", 480),
    PASSWORD_MIN_LENGTH: envInt("PASSWORD_MIN_LENGTH", 10),
    LOGIN_MAX_ATTEMPTS: envInt("LOGIN_MAX_ATTEMPTS", 5),
    LOGIN_LOCKOUT_MINUTES: envInt("LOGIN_LOCKOUT_MINUTES", 15),
    REQUIRE_2FA_ADMIN: envBool("REQUIRE_2FA_ADMIN", false),
    TRUST_PROXY: envBool("TRUST_PROXY", false),
    APP_BASE_URL: envStr(
      "APP_BASE_URL",
      process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    ),
    BACKUP_DB_DIR: envStr("BACKUP_DB_DIR"),
    ADMIN_EMAIL: envStr("ADMIN_EMAIL"),

    COLLECTIVITE_NOM: envStr("COLLECTIVITE_NOM", "Ville de Châtillon"),
    COLLECTIVITE_ADRESSE: envStr(
      "COLLECTIVITE_ADRESSE",
      "1 place de la Libération, 92320 Châtillon",
    ),
    COLLECTIVITE_EMAIL: envStr("COLLECTIVITE_EMAIL", "reservations@chatillon92.fr"),
    COLLECTIVITE_TELEPHONE: envStr("COLLECTIVITE_TELEPHONE", ""),
    COLLECTIVITE_SITE_WEB: envStr("COLLECTIVITE_SITE_WEB", "https://www.ville-chatillon.fr"),
    COLLECTIVITE_LOGO: envStr("COLLECTIVITE_LOGO", ""),
    COLLECTIVITE_SIGNATAIRE: envStr("COLLECTIVITE_SIGNATAIRE", ""),
    COLLECTIVITE_SIGNATAIRE_QUALITE: envStr("COLLECTIVITE_SIGNATAIRE_QUALITE", "Le Maire"),
    UI_PRIMARY_COLOR: envStr("UI_PRIMARY_COLOR"),
    PORTAIL_TITRE: envStr("PORTAIL_TITRE", "Réservez une salle ou un équipement de la ville"),
    PORTAIL_ACCROCHE: envStr(
      "PORTAIL_ACCROCHE",
      "Associations, entreprises, habitants : trouvez l'espace adapté à votre événement et déposez votre demande en ligne.",
    ),
    PORTAIL_CONDITIONS: envStr("PORTAIL_CONDITIONS", ""),
    MAIL_ENABLED: envBool("MAIL_ENABLED", true),
    MAIL_SERVER: envStr("MAIL_SERVER", "localhost"),
    MAIL_PORT: envInt("MAIL_PORT", 587),
    MAIL_USE_TLS: envBool("MAIL_USE_TLS", true),
    MAIL_USERNAME: envStr("MAIL_USERNAME"),
    MAIL_PASSWORD: envStr("MAIL_PASSWORD"),
    MAIL_DEFAULT_SENDER: envStr("MAIL_DEFAULT_SENDER", "noreply@localhost"),
    SMS_ENABLED: envBool("SMS_ENABLED", false),
    SMS_PROVIDER: envStr("SMS_PROVIDER", "console"),
    SMS_API_URL: envStr("SMS_API_URL"),
    SMS_API_KEY: envStr("SMS_API_KEY"),
    SMS_SENDER: envStr("SMS_SENDER", "CityResa"),
    PORTAIL_ENABLED: envBool("PORTAIL_ENABLED", true),
    INSCRIPTION_ENABLED: envBool("INSCRIPTION_ENABLED", true),
    PAIEMENTS_ENABLED: envBool("PAIEMENTS_ENABLED", true),
    SIGNATURE_ENABLED: envBool("SIGNATURE_ENABLED", true),
    MATERIEL_ENABLED: envBool("MATERIEL_ENABLED", true),
    SUBVENTIONS_ENABLED: envBool("SUBVENTIONS_ENABLED", true),
    CAMPAGNES_ENABLED: envBool("CAMPAGNES_ENABLED", true),
    DOCUMENTS_ENABLED: envBool("DOCUMENTS_ENABLED", true),
    DOCUMENT_MAX_MB: envInt("DOCUMENT_MAX_MB", 10),
    TVA_TAUX: envFloat("TVA_TAUX", 0),
    ACOMPTE_PCT: envFloat("ACOMPTE_PCT", 30),
    RAPPEL_J7: envBool("RAPPEL_J7", true),
    RAPPEL_J1: envBool("RAPPEL_J1", true),
    VALIDATION_COMPTE_USAGER: envBool("VALIDATION_COMPTE_USAGER", false),
    PORTAIL_AFFICHER_TARIFS: envBool("PORTAIL_AFFICHER_TARIFS", true),
    RELANCE_SIGNATURE_JOURS: envInt("RELANCE_SIGNATURE_JOURS", 3),
    ARCHIVAGE_AUTO_JOURS: envInt("ARCHIVAGE_AUTO_JOURS", 30),
    DELAI_ANNULATION_JOURS: envInt("DELAI_ANNULATION_JOURS", 7),
    SIGNATURE_VALIDITE_HEURES: envInt("SIGNATURE_VALIDITE_HEURES", 72),
    ALERTE_PIECES_JOURS: envInt("ALERTE_PIECES_JOURS", 30),
    PIECES_REGLE: envStr("PIECES_REGLE", "avertir"),
    ANNULATION_BAREME: envStr("ANNULATION_BAREME", ""),
    CAUTION_SEUIL_VALIDATION: envFloat("CAUTION_SEUIL_VALIDATION", 500),
    CAUTION_DELAI_RESTITUTION_JOURS: envInt("CAUTION_DELAI_RESTITUTION_JOURS", 30),
    OPTION_RELANCE_JOURS: envInt("OPTION_RELANCE_JOURS", 3),
    VALORISATION_SEUIL_CONVENTION: envFloat("VALORISATION_SEUIL_CONVENTION", 23000),
    VALORISATION_SEUIL_CERTIFICATION: envFloat("VALORISATION_SEUIL_CERTIFICATION", 153000),
    CONVENTION_TEXTE: envStr("CONVENTION_TEXTE", CONVENTION_TEXTE_DEFAUT),
    AGENTS_NOTIFIES: envStr("AGENTS_NOTIFIES", ""),
    BACKUP_DB_KEEP: envInt("BACKUP_DB_KEEP", 14),
  };
}

/** Convertit la chaîne stockée vers le type attendu. */
export function cast(key: string, raw: string | null | undefined): unknown {
  const r = raw ?? "";
  if (BOOL_KEYS.has(key)) return ["true", "1", "yes", "on"].includes(String(r).toLowerCase());
  if (INT_KEYS.has(key)) {
    const n = Number.parseInt(String(r), 10);
    return Number.isFinite(n) ? n : 0;
  }
  if (FLOAT_KEYS.has(key)) {
    const n = Number.parseFloat(String(r).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return r;
}

/** Convertit une valeur typée vers la chaîne à stocker. */
export function serialize(key: string, value: unknown): string {
  if (BOOL_KEYS.has(key)) return value ? "true" : "false";
  if (value === null || value === undefined) return "";
  return String(value);
}

// Cache en mémoire de processus (60 s), sur globalThis (HMR).
const CACHE_TTL_MS = process.env.CITYRESA_TEST ? 0 : 60_000;
type CacheReglages = { at: number; settings: AppSettings } | null;
const partage = globalThis as unknown as { __cityresaReglages?: { cache: CacheReglages } };
partage.__cityresaReglages ??= { cache: null };
const memo = partage.__cityresaReglages;

async function load(): Promise<AppSettings> {
  const settings = envDefaults();
  try {
    const rows = await prisma.appConfig.findMany();
    for (const row of rows) {
      if (!MANAGED.has(row.key)) continue;
      const raw = row.isSecret ? decryptSecret(row.value ?? "") : (row.value ?? "");
      settings[row.key] = cast(row.key, raw);
    }
  } catch (e) {
    console.error("[config-store] lecture de app_config impossible :", e);
  }
  return settings;
}

/** La configuration vivante (base + repli env), mémoïsée 60 s. */
export async function getSettings(): Promise<AppSettings> {
  const cache = memo.cache;
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.settings;
  const settings = await load();
  memo.cache = { at: Date.now(), settings };
  return settings;
}

/** Force la relecture au prochain appel. */
export function invalidateSettings(): void {
  memo.cache = null;
}

/** Persiste un dict {CLÉ: valeur-chaîne} en base (chiffre les secrets). */
export async function saveSettings(
  updates: Record<string, string | null | undefined>,
): Promise<void> {
  const ops = Object.entries(updates)
    .filter(([key]) => MANAGED.has(key))
    .map(([key, val]) => {
      const v = val === null || val === undefined ? "" : String(val);
      const secret = SECRET_KEYS.has(key);
      const stored = secret ? encryptSecret(v) : v;
      return prisma.appConfig.upsert({
        where: { key },
        update: { value: stored, isSecret: secret },
        create: { key, value: stored, isSecret: secret },
      });
    });
  if (ops.length) await prisma.$transaction(ops);
  invalidateSettings();
}

/** Migration initiale : si la table est vide, on y copie les valeurs du .env. */
export async function seedFromEnv(): Promise<number> {
  const first = await prisma.appConfig.findFirst({ select: { key: true } });
  if (first) return 0;
  const defaults = envDefaults();
  const rows = [...MANAGED].map((key) => {
    const secret = SECRET_KEYS.has(key);
    const s = serialize(key, defaults[key]);
    return { key, value: secret ? encryptSecret(s) : s, isSecret: secret };
  });
  await prisma.appConfig.createMany({ data: rows });
  invalidateSettings();
  return rows.length;
}
