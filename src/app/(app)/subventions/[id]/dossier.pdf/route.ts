import { prisma } from "@/server/db";
import { requireView } from "@/server/guards";
import { idDe, pasTrouve } from "@/server/http";
import { reponsePdf } from "@/server/pdf";
import { pdfDossier } from "@/server/subventions-dossier";

/** GET /subventions/<id>/dossier.pdf : le dossier de demande à jour, rendu à la volée. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireView("subventions");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  const s = await prisma.subvention.findUnique({ where: { id }, select: { numero: true } });
  if (!s) return pasTrouve();
  const pdf = await pdfDossier(id);
  if (!pdf) return pasTrouve();
  return reponsePdf(pdf, `dossier-subvention-${s.numero}.pdf`);
}
