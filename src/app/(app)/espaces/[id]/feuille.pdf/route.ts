import { lundiDe } from "@/lib/editions";
import { lireDate } from "@/modules/planning/server";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { occupationsSemaine, pdfFeuilleSalle, qrSvg, urlPublique } from "@/server/editions";
import { requireView } from "@/server/guards";
import { idDe, interdit, pasTrouve } from "@/server/http";
import { reponsePdf } from "@/server/pdf";

/** GET /espaces/<id>/feuille.pdf?date= : la feuille de salle de la semaine, avec QR code vers la version en ligne. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireView("planning");
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  if (!user.gereEspace(id)) return interdit();
  const e = await prisma.espace.findUnique({ where: { id }, include: { site: true } });
  if (!e) return pasTrouve();
  const url = new URL(req.url);
  const lundi = lundiDe(lireDate(url.searchParams.get("date") ?? undefined));
  const cfg = await getSettings();
  const lien = await urlPublique(e.slug);
  const pdf = await pdfFeuilleSalle({
    espace: {
      name: e.name,
      site: e.site.name,
      adresse: [e.site.address, [e.site.postalCode, e.site.city].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", "),
      instructions: e.instructions,
      rules: e.rules,
    },
    lundi,
    evts: await occupationsSemaine([e.id], lundi),
    url: lien,
    qr: await qrSvg(lien),
    collectivite: cfg.COLLECTIVITE_NOM,
  });
  return reponsePdf(pdf, `feuille-${e.slug}-${lundi}.pdf`);
}
