import { addParisDays, parisMidnight } from "@/lib/paris-time";
import { prisma } from "@/server/db";
import { json } from "@/server/http";
import { occupants } from "@/server/reservations";

/**
 * GET /api/disponibilites?espace=<id>&de=YYYY-MM-DD&a=YYYY-MM-DD : les occupations d'un
 * espace (créneaux vivants et blocages) sur la période, pour le planning et le calendrier
 * de disponibilité du portail. Public pour un espace visible sur le portail.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const espaceId = Number(url.searchParams.get("espace"));
  const de = url.searchParams.get("de") ?? "";
  const a = url.searchParams.get("a") ?? "";
  if (!espaceId || !/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(a))
    return json({ error: "Paramètres invalides." }, 400);
  const espace = await prisma.espace.findUnique({
    where: { id: espaceId },
    select: { isPublic: true, isActive: true },
  });
  if (!espace?.isActive) return json({ error: "Espace inconnu." }, 404);
  const debut = parisMidnight(de);
  const fin = addParisDays(parisMidnight(a), 1);
  if (fin.getTime() - debut.getTime() > 120 * 86_400_000)
    return json({ error: "Période trop longue (120 jours maximum)." }, 400);
  const occ = await occupants(espaceId, debut, fin);
  return json({
    occupations: occ.map((o) => ({
      debut: o.startAt.toISOString(),
      fin: o.endAt.toISOString(),
      genre: o.genre,
      libelle: espace.isPublic ? (o.genre === "blocage" ? "Indisponible" : "Réservé") : o.libelle,
    })),
  });
}
