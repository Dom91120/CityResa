import { exporterCircuit } from "@/lib/circuits";
import { chargerCircuit } from "@/modules/processus/server";
import { referentiel } from "@/server/circuits";
import * as features from "@/server/features";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve } from "@/server/http";

/**
 * GET /processus/circuits/<id>/export.json : le circuit tel qu'il s'affiche (le brouillon
 * s'il y en a un, sinon la version en service), en fichier à conserver ou à réimporter.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  await features.require("processus");
  const id = idDe((await params).id);
  const c = id ? await chargerCircuit(id) : null;
  if (!c) return pasTrouve();
  const fichier = exporterCircuit(c, c.definition, await referentiel());
  const nom = c.name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return new Response(JSON.stringify(fichier, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="circuit-${nom || c.id}.json"`,
    },
  });
}
