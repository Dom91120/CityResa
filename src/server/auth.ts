import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import {
  ATTRIBUTS_COOKIE,
  alerteCookiesNonSecurises,
  cookiesSecurises,
} from "@/server/cookie-policy";
import { prisma } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/password";

/**
 * Configuration Better Auth de CityRésa.
 *
 * - connexion par ADRESSE DE COURRIEL (agents et usagers) ;
 * - mots de passe : scrypt Better Auth ;
 * - second facteur TOTP (plugin `twoFactor`) pour les agents, facultatif ;
 * - réinitialisation de mot de passe par courriel (server/mailer.ts) ;
 * - durée de session = SESSION_LIFETIME_MINUTES (inactivité), renouvelée à l'usage.
 */

const SESSION_LIFETIME_MINUTES =
  Number.parseInt(process.env.SESSION_LIFETIME_MINUTES ?? "480", 10) || 480;

if (alerteCookiesNonSecurises()) {
  console.warn(
    "[auth] ⚠️ ALLOW_INSECURE_COOKIES=true : le cookie de session part SANS l'attribut " +
      "Secure. À réserver à un accès en HTTP sur réseau de confiance.",
  );
}

export const auth = betterAuth({
  appName: "CityRésa",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: (request?: Request) => {
    const list = (process.env.TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (process.env.NODE_ENV === "development") {
      const origin = request?.headers.get("origin");
      if (origin && !list.includes(origin)) list.push(origin);
    }
    return list;
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 1,
    password: {
      hash: hashPassword,
      verify: async ({ hash, password }) => verifyPassword(hash, password),
    },
    sendResetPassword: async ({ user, url }) => {
      const { envoyerReinitialisation } = await import("@/server/mailer");
      await envoyerReinitialisation(user.email, user.name || user.email, url);
    },
    resetPasswordTokenExpiresIn: 60 * 60,
  },

  session: {
    expiresIn: SESSION_LIFETIME_MINUTES * 60,
    updateAge: 60,
    freshAge: 15 * 60,
  },

  advanced: {
    useSecureCookies: cookiesSecurises(),
    defaultCookieAttributes: ATTRIBUTS_COOKIE,
  },

  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 200,
    customRules: {
      "/sign-in/email": { window: 60, max: 20 },
      "/sign-up/email": { window: 60, max: 10 },
      "/request-password-reset": { window: 60, max: 5 },
      "/two-factor/verify-totp": { window: 60, max: 20 },
    },
  },

  user: {
    modelName: "user",
    additionalFields: {
      firstName: { type: "string", required: false, defaultValue: "", input: true },
      lastName: { type: "string", required: false, defaultValue: "", input: true },
      phone: { type: "string", required: false, input: true },
      kind: { type: "string", required: false, defaultValue: "usager", input: false },
      role: { type: "string", required: false, defaultValue: "usager", input: false },
    },
  },
  account: {
    modelName: "authAccount",
  },

  plugins: [
    twoFactor({
      issuer: "CityRésa",
      skipVerificationOnEnable: false,
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
