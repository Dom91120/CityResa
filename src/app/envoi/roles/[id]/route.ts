import { PERMISSION_CATEGORIES, PERMISSION_LEVELS } from "@/lib/constantes";
import { champ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /roles/[id] : action=enregistrer (permissions) ou action=supprimer. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      const role = await prisma.role.findUnique({ where: { id } });
      if (!role) return pasTrouve();
      if (role.isAdmin || role.isUsager)
        return redirigerAvecMessage("/roles", "Ce rôle n'est pas modifiable.", "warning");
      const action = champ(form, "action");

      if (action === "supprimer") {
        const n = await prisma.user.count({ where: { role: role.name } });
        if (n)
          return redirigerAvecMessage(
            "/roles",
            `Impossible : ${n} compte(s) portent encore le rôle « ${role.label} ».`,
            "danger",
          );
        await prisma.role.delete({ where: { id } });
        await auditRecord("suppression role", `${role.label} (${role.name})`, "roles", admin.email);
        return redirigerAvecMessage("/roles", `Rôle « ${role.label} » supprimé.`, "success");
      }

      const perms: Record<string, number> = {};
      for (const c of PERMISSION_CATEGORIES) {
        const n = Number.parseInt(champ(form, `perm_${c}`), 10);
        perms[c] = Number.isInteger(n) && n in PERMISSION_LEVELS ? n : 0;
      }
      await prisma.role.update({ where: { id }, data: { permissions: perms } });
      await auditRecord(
        "modification role",
        `${role.label} : ${PERMISSION_CATEGORIES.map((c) => `${c}=${perms[c]}`).join(" ")}`,
        "roles",
        admin.email,
      );
      return redirigerAvecMessage(
        "/roles",
        `Permissions du rôle « ${role.label} » enregistrées.`,
        "success",
      );
    },
    "/roles",
  );
}
