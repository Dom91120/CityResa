import { lundiDe } from "@/lib/editions";
import { espacesPlanning, lireDate, lireFiltresPlanning } from "@/modules/planning/server";
import { saisonActive } from "@/server/calendrier";
import { getSettings } from "@/server/config-store";
import {
  evtsDeSeries,
  libellesJours,
  libellesJoursType,
  occupationsSemaine,
  pdfPlanningSemaine,
  seriesSemaineType,
} from "@/server/editions";
import { requireView } from "@/server/guards";
import { pasTrouve } from "@/server/http";
import { reponsePdf } from "@/server/pdf";

/**
 * GET /planning/semaine.pdf?date=&site=…&espace=…&format=A4|A3&type=semaine|type
 * Le planning hebdomadaire des espaces choisis (une page par espace), noir et blanc,
 * paysage ; `type=type` édite la semaine type de la saison active.
 */
export async function GET(req: Request) {
  const user = await requireView("planning");
  const url = new URL(req.url);
  const filtres = lireFiltresPlanning({
    site: url.searchParams.getAll("site"),
    espace: url.searchParams.getAll("espace"),
  });
  const espaces = await espacesPlanning(user, filtres);
  if (!espaces.length) return pasTrouve();
  const format = url.searchParams.get("format") === "A3" ? "A3" : "A4";
  const cfg = await getSettings();
  const type = url.searchParams.get("type") === "type";
  const ids = espaces.map((e) => e.id);
  let evts: Awaited<ReturnType<typeof occupationsSemaine>>;
  let jours: string[];
  let sousTitre: string;
  let fichier: string;
  if (type) {
    const saison = await saisonActive();
    if (!saison) return pasTrouve();
    evts = evtsDeSeries(await seriesSemaineType(ids, saison));
    jours = libellesJoursType();
    sousTitre = `Semaine type · saison ${saison.label}`;
    fichier = `semaine-type-${saison.label}.pdf`;
  } else {
    const lundi = lundiDe(lireDate(url.searchParams.get("date") ?? undefined));
    evts = await occupationsSemaine(ids, lundi);
    jours = libellesJours(lundi);
    sousTitre = `Semaine du ${jours[0]} au ${jours[6]}`;
    fichier = `planning-${lundi}.pdf`;
  }
  const pdf = await pdfPlanningSemaine({
    titre: type ? sousTitre : "Planning hebdomadaire",
    sousTitre,
    format,
    collectivite: cfg.COLLECTIVITE_NOM,
    legende: type
      ? "Séries hebdomadaires des dossiers acceptés, signés ou confirmés de la saison, aux heures de leur premier créneau."
      : "Réservations acceptées, signées ou confirmées, demandes en cours et fermetures (hachurées).",
    grilles: espaces.map((e) => ({
      espace: { id: e.id, name: e.name, site: e.site.name },
      jours,
      evts: evts.filter((x) => x.espaceId === e.id),
    })),
  });
  return reponsePdf(pdf, fichier);
}
