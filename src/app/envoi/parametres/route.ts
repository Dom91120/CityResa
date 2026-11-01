import { champ, emailValide } from "@/lib/forms-util";
import { lireOnglet, onglet } from "@/modules/parametres/server";
import { auditRecord } from "@/server/audit";
import { CONVENTION_TEXTE_DEFAUT, SECRET_KEYS, saveSettings } from "@/server/config-store";
import { UserFacingError } from "@/server/errors";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { preparerLogo } from "@/server/logo";
import { testerSmtp } from "@/server/mailer";
import { invalidateNavCounts } from "@/server/nav";

/** POST /parametres : enregistre les clés de l'onglet `action` seulement. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      const o = onglet(champ(form, "action"));
      if (!o) return redirigerAvecMessage("/parametres", "Onglet inconnu.", "danger");
      const retour = `/parametres#${o.cle}`;
      const maj = lireOnglet(form, o);

      if (o.cle === "convention" && form.get("retablir"))
        maj.CONVENTION_TEXTE = CONVENTION_TEXTE_DEFAUT;
      if (o.cle === "apparence" && form.get("reinitialiser")) maj.UI_PRIMARY_COLOR = "";
      if (o.cle === "collectivite") {
        const fichier = form.get("logo");
        if (form.get("logo_supprimer")) maj.COLLECTIVITE_LOGO = "";
        else if (fichier instanceof File && fichier.size > 0) {
          try {
            maj.COLLECTIVITE_LOGO = await preparerLogo(fichier);
          } catch (e) {
            if (e instanceof UserFacingError)
              return redirigerAvecMessage(retour, e.message, "danger");
            throw e;
          }
        }
      }

      await saveSettings(maj);
      invalidateNavCounts();
      await auditRecord(
        "modification parametres",
        `${o.label} : ${Object.keys(maj)
          .map((k) => (SECRET_KEYS.has(k) ? `${k}=••••` : `${k}=${maj[k].slice(0, 40)}`))
          .join(", ")}`,
        "parametres",
        admin.email,
      );

      if (o.cle === "messagerie" && form.get("tester")) {
        const to = champ(form, "test_email") || admin.email;
        if (!emailValide(to))
          return redirigerAvecMessage(
            retour,
            "Réglages enregistrés, mais l'adresse de test est invalide.",
            "warning",
          );
        const res = await testerSmtp(to);
        return redirigerAvecMessage(
          retour,
          res.ok
            ? `Réglages enregistrés. ${res.message}`
            : `Réglages enregistrés, mais le test a échoué : ${res.message}`,
          res.ok ? "success" : "danger",
        );
      }

      const message =
        o.cle === "convention" && form.get("retablir")
          ? "Texte de la convention rétabli."
          : o.cle === "apparence" && form.get("reinitialiser")
            ? "Couleur réinitialisée."
            : `Réglages « ${o.label} » enregistrés.`;
      return redirigerAvecMessage(retour, message, "success");
    },
    "/parametres",
  );
}
