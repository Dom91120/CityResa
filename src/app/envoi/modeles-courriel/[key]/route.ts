import { champ, coche } from "@/lib/forms-util";
import { exemplesVariables, variablesDe } from "@/modules/admin/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { EMAIL_TEMPLATE_SEEDS } from "@/server/email-templates";
import { requireAdmin } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { envoyerDepuisModele } from "@/server/mailer";

/** POST /modeles-courriel/[key] : action=enregistrer | retablir | test */
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      const seed = EMAIL_TEMPLATE_SEEDS.find((s) => s.key === key);
      const row = await prisma.emailTemplate.findUnique({ where: { key } });
      if (!seed && !row) return pasTrouve();
      const ici = `/modeles-courriel/${key}`;
      const label = row?.label ?? seed?.label ?? key;
      const action = champ(form, "action");

      if (action === "retablir") {
        if (!seed)
          return redirigerAvecMessage(ici, "Ce modèle n'a pas de texte d'origine.", "warning");
        await prisma.emailTemplate.upsert({
          where: { key },
          update: { subject: seed.subject, body: seed.body, label: seed.label },
          create: { key, label: seed.label, subject: seed.subject, body: seed.body },
        });
        await auditRecord("retablissement modele courriel", key, "parametres", admin.email);
        return redirigerAvecMessage(ici, `Modèle « ${label} » rétabli.`, "success");
      }

      if (action === "test") {
        const m = row ?? seed;
        if (!m) return pasTrouve();
        const vars = exemplesVariables(
          admin.settings.APP_BASE_URL,
          admin.settings.COLLECTIVITE_NOM,
        );
        const exemples: Record<string, string> = {};
        for (const v of variablesDe(m.subject, m.body)) exemples[v] = vars[v] ?? `[${v}]`;
        if (row && !row.isActive)
          return redirigerAvecMessage(
            ici,
            "Ce modèle est désactivé : activez-le pour tester l'envoi.",
            "warning",
          );
        const ok = await envoyerDepuisModele(key, admin.email, exemples);
        return redirigerAvecMessage(
          ici,
          ok
            ? `Courriel de test envoyé à ${admin.email} (ou simulé si la messagerie n'est pas configurée).`
            : "L'envoi du test a échoué : vérifiez la messagerie dans Paramètres.",
          ok ? "success" : "danger",
        );
      }

      const subject = champ(form, "subject").slice(0, 200);
      const body = String(form.get("body") ?? "").trim();
      if (!subject || !body)
        return redirigerAvecMessage(ici, "Le sujet et le corps sont obligatoires.", "danger");
      await prisma.emailTemplate.upsert({
        where: { key },
        update: { subject, body, isActive: coche(form, "is_active") },
        create: { key, label, subject, body, isActive: coche(form, "is_active") },
      });
      await auditRecord("modification modele courriel", key, "parametres", admin.email);
      return redirigerAvecMessage(ici, `Modèle « ${label} » enregistré.`, "success");
    },
    `/modeles-courriel/${key}`,
  );
}
