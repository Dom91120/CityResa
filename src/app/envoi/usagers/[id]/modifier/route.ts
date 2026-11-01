import { lireOrganisation } from "@/modules/usagers/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /usagers/[id]/modifier */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("usagers");
    const org = await prisma.organisation.findUnique({ where: { id } });
    if (!org) return pasTrouve();
    try {
      const e = lireOrganisation(form);
      await prisma.organisation.update({
        where: { id },
        data: {
          type: e.type,
          name: e.name || org.name,
          address: e.address,
          postalCode: e.postalCode,
          city: e.city,
          siret: e.siret,
          rna: e.rna,
          email: e.email,
          phone: e.phone,
          website: e.website,
          legalFirstName: e.legalFirstName,
          legalLastName: e.legalLastName,
          legalAppointedAt: e.legalAppointedAt,
          profilId: e.profilId,
          notes: e.notes,
        },
      });
    } catch (err) {
      if (err instanceof UserFacingError)
        return redirigerAvecMessage(`/usagers/${id}/modifier`, err.message, "danger");
      throw err;
    }
    await auditRecord("modification organisation", `${org.name} (#${id})`, "usagers", user.email);
    return redirigerAvecMessage(`/usagers/${id}`, "Organisation modifiée.", "success");
  });
}
