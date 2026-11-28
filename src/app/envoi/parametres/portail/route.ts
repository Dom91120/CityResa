import { champ } from "@/lib/forms-util";
import { phraseBilan } from "@/lib/invitations";
import { lireTypesInvites } from "@/modules/usagers/invitations";
import { auditRecord } from "@/server/audit";
import { getSettings, saveSettings } from "@/server/config-store";
import { UserFacingError } from "@/server/errors";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { fermerSessionsUsagers, inviterUsagers } from "@/server/invitations";
import { invalidateNavCounts } from "@/server/nav";

const RETOUR = "/parametres#portail";

/**
 * POST /parametres/portail : ouvre ou ferme le portail. Ce réglage ne s'enregistre pas avec
 * l'onglet : l'ouvrir peut créer les comptes des usagers et leur écrire, le fermer déconnecte
 * tous les usagers. Les agents ne sont concernés ni par l'un ni par l'autre.
 */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      const geste = champ(form, "geste");
      const ouvert = (await getSettings()).PORTAIL_ENABLED;
      try {
        if (geste === "fermer") {
          if (!ouvert) return redirigerAvecMessage(RETOUR, "Le portail est déjà fermé.", "info");
          await saveSettings({ PORTAIL_ENABLED: "false" });
          const n = await fermerSessionsUsagers();
          invalidateNavCounts();
          await auditRecord(
            "portail fermé",
            `${n} session(s) d'usager fermée(s)`,
            "parametres",
            admin.email,
          );
          return redirigerAvecMessage(
            RETOUR,
            `Portail fermé : les usagers ne peuvent plus se connecter${n ? ` (${n} session${n > 1 ? "s" : ""} fermée${n > 1 ? "s" : ""})` : ""}. Les agents ne sont pas concernés.`,
            "success",
          );
        }
        if (geste === "ouvrir") {
          if (ouvert) return redirigerAvecMessage(RETOUR, "Le portail est déjà ouvert.", "info");
          const inviter = champ(form, "comptes") === "creer";
          // Les types se lisent avant d'ouvrir : une saisie incohérente ne change rien.
          const types = inviter ? lireTypesInvites(form) : null;
          await saveSettings({ PORTAIL_ENABLED: "true" });
          invalidateNavCounts();
          await auditRecord(
            "portail ouvert",
            inviter ? "avec création des comptes" : "sans création de comptes",
            "parametres",
            admin.email,
          );
          if (!inviter)
            return redirigerAvecMessage(
              RETOUR,
              "Portail ouvert. Aucun compte créé : « Inviter les usagers sans compte », dans Usagers, le fera quand vous le voudrez.",
              "success",
            );
          const b = await inviterUsagers(types, admin.email);
          return redirigerAvecMessage(
            b.ecartees.length || b.echecs.length ? "/usagers?type=sans_compte" : RETOUR,
            `Portail ouvert. ${phraseBilan({ invites: b.invites, echecs: b.echecs.length, ecartees: b.ecartees.length })}`,
            b.ecartees.length || b.echecs.length ? "warning" : "success",
          );
        }
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(RETOUR, e.message, "danger");
        throw e;
      }
      return redirigerAvecMessage(RETOUR, "Geste inconnu.", "danger");
    },
    "/parametres",
  );
}
