import { PERMISSION_CATEGORIES } from "@/lib/constantes";
import { champ, champOuNull } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /roles : création d'un rôle (lecture seule partout au départ). */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      const name = champ(form, "name").toLowerCase();
      const label = champ(form, "label").slice(0, 80);
      if (!/^[a-z0-9_-]{2,40}$/.test(name))
        return redirigerAvecMessage(
          "/roles",
          "Nom technique invalide (minuscules, chiffres, tirets).",
          "danger",
        );
      if (!label) return redirigerAvecMessage("/roles", "Indiquez un libellé.", "danger");
      if (await prisma.role.findUnique({ where: { name } }))
        return redirigerAvecMessage("/roles", "Un rôle porte déjà ce nom technique.", "danger");
      await prisma.role.create({
        data: {
          name,
          label,
          description: champOuNull(form, "description")?.slice(0, 200) ?? null,
          isAdmin: false,
          isUsager: false,
          permissions: Object.fromEntries(PERMISSION_CATEGORIES.map((c) => [c, 1])),
        },
      });
      await auditRecord("creation role", `${label} (${name})`, "roles", admin.email);
      return redirigerAvecMessage(
        "/roles",
        `Rôle « ${label} » créé : réglez maintenant ses permissions.`,
        "success",
      );
    },
    "/roles",
  );
}
