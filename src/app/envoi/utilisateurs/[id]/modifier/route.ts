import { champ } from "@/lib/forms-util";
import { lireEmailLibre, lireIdentite } from "@/modules/utilisateurs/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireAdmin } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /utilisateurs/[id]/modifier */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return traiterFormulaire(req, async (form) => {
    const admin = await requireAdmin();
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) return pasTrouve();
    const retour = `/utilisateurs/${id}/modifier`;
    try {
      const ident = lireIdentite(form);
      const email = await lireEmailLibre(form, id);
      let role = u.role;
      if (u.kind === "agent" && u.id !== admin.id) {
        const voulu = champ(form, "role");
        const r = await prisma.role.findUnique({ where: { name: voulu } });
        if (!r || r.isUsager) throw new UserFacingError("Choisissez un rôle valide.");
        role = r.name;
      }
      await prisma.user.update({
        where: { id },
        data: {
          email,
          name: `${ident.firstName} ${ident.lastName}`,
          firstName: ident.firstName,
          lastName: ident.lastName,
          phone: ident.phone,
          fonction: ident.fonction,
          role,
        },
      });
    } catch (e) {
      if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
      throw e;
    }
    await auditRecord("modification compte", u.email, "utilisateurs", admin.email);
    return redirigerAvecMessage(`/utilisateurs/${id}`, "Compte modifié.", "success");
  });
}
