import { decrireRecurrence, developperRecurrence, verifierRegles } from "@/lib/creneaux";
import { plage } from "@/lib/libelles";
import { lireDemande } from "@/modules/reservations/formulaire";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { getCurrentUser } from "@/server/guards";
import { json, verifierCsrf } from "@/server/http";
import { deviser, verifierDisponibilite } from "@/server/reservations";

/**
 * POST /api/devis : le devis en direct d'une demande (formulaire urlencodé, mêmes champs
 * que la demande). Renvoie { devis, erreurs, conflits, nbCreneaux, recurrence }.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Authentification requise." }, 401);
  if (!(await verifierCsrf(req))) return json({ error: "CSRF" }, 400);
  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "Formulaire illisible." }, 400);
  try {
    const d = lireDemande(form, {
      organisationId: user.organisationId,
      userId: user.id,
      source: user.isAgent ? "backoffice" : "portail",
      agent: user.isAgent,
    });
    const espace = await prisma.espace.findUnique({ where: { id: d.espaceId } });
    if (!espace) return json({ error: "Espace inconnu." }, 404);
    const creneaux = developperRecurrence(d.premier, d.recurrence);
    const erreurs = new Set<string>();
    for (const c of creneaux.slice(0, 50))
      for (const e of verifierRegles(espace, c, new Date(), { ignorerDelai: d.ignorerDelai }))
        erreurs.add(e);
    const excl = Number(form.get("reservation_id")) || null;
    const conflits = (await verifierDisponibilite(espace, creneaux, excl))
      .slice(0, 5)
      .map((c) => `${plage(c.demande.startAt, c.demande.endAt)} (${c.existant.libelle})`);
    const org = d.organisationId
      ? await prisma.organisation.findUnique({
          where: { id: d.organisationId },
          select: { profilId: true },
        })
      : null;
    const devis = await deviser(
      d.espaceId,
      org?.profilId ?? null,
      creneaux,
      d.options,
      d.materiels,
      d.gratuit ?? false,
    );
    return json({
      devis,
      erreurs: [...erreurs],
      conflits,
      nbCreneaux: creneaux.length,
      recurrence: decrireRecurrence(d.recurrence),
    });
  } catch (e) {
    if (e instanceof UserFacingError)
      return json({ devis: null, erreurs: [e.message], conflits: [], nbCreneaux: 0 });
    throw e;
  }
}
