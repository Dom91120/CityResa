import { voitEspace } from "@/modules/reservations/requetes";
import { pdfConvention } from "@/server/convention";
import { prisma } from "@/server/db";
import { requireView } from "@/server/guards";
import { idDe, interdit, pasTrouve } from "@/server/http";
import { reponsePdf } from "@/server/pdf";

/** GET /reservations/<id>/convention.pdf : la convention à jour, rendue à la volée. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireView("reservations");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  const r = await prisma.reservation.findUnique({
    where: { id },
    select: { numero: true, espaceId: true },
  });
  if (!r) return pasTrouve();
  if (!voitEspace(user, r.espaceId)) return interdit();
  const pdf = await pdfConvention(id);
  if (!pdf) return pasTrouve();
  return reponsePdf(pdf, `convention-${r.numero}.pdf`);
}
