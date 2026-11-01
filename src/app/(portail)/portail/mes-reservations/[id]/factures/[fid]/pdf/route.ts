import { prisma } from "@/server/db";
import { pdfFacture } from "@/server/factures";
import { getCurrentUser } from "@/server/guards";
import { idDe, interdit, pasTrouve, redirection } from "@/server/http";
import { whereUsager } from "@/server/reservations";

/** GET /portail/mes-reservations/<id>/factures/<fid>/pdf : la facture d'un dossier de l'usager. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; fid: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  const fid = idDe(p.fid);
  if (!id || !fid) return pasTrouve();
  const user = await getCurrentUser();
  if (!user)
    return redirection(`/connexion?next=${encodeURIComponent(`/portail/mes-reservations/${id}`)}`);
  if (user.isAgent) return redirection(`/paiements/${fid}`);
  const r = await prisma.reservation.findFirst({
    where: { AND: [{ id }, whereUsager(user)] },
    select: { id: true },
  });
  if (!r) return interdit();
  const f = await prisma.facture.findFirst({ where: { id: fid, reservationId: id } });
  if (!f) return pasTrouve();
  const pdf = await pdfFacture(f.id);
  if (!pdf) return pasTrouve();
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${f.numero}.pdf"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
