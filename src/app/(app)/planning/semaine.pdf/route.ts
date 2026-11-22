import { lundiDe } from "@/lib/editions";
import { lireFiltresEvts, resumeFiltres } from "@/lib/planning-vues";
import { espacesPlanning, lireDate, lireFiltresPlanning } from "@/modules/planning/server";
import { saisonActive, saisons } from "@/server/calendrier";
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
import { optionsServices } from "@/server/services";

/**
 * GET /planning/semaine.pdf?date=&site=…&espace=…&secteur=&statut=…&type=…&q=&format=A4|A3
 * Le planning hebdomadaire des espaces choisis (une page par espace), noir et blanc,
 * paysage, avec les filtres de l'écran (statut, type d'usager, recherche) rappelés en
 * sous-titre. `type` porte les types d'usager retenus ; sa seule valeur « type » édite la
 * semaine type de la saison `saison` (à défaut, la saison active), qui ignore ces filtres de
 * créneaux.
 */
export async function GET(req: Request) {
  const user = await requireView("planning");
  const url = new URL(req.url);
  const filtres = lireFiltresPlanning({
    site: url.searchParams.getAll("site"),
    espace: url.searchParams.getAll("espace"),
    secteur: url.searchParams.get("secteur") ?? undefined,
  });
  const filtresEvts = lireFiltresEvts({
    statut: url.searchParams.getAll("statut"),
    type: url.searchParams.getAll("type"),
    q: url.searchParams.get("q") ?? undefined,
    service: url.searchParams.getAll("service"),
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
    // La saison demandée (celle de l'écran) ; à défaut, la saison active.
    const demandee = Number(url.searchParams.get("saison")) || null;
    const saison =
      (demandee ? (await saisons()).find((s) => s.id === demandee) : null) ??
      (await saisonActive());
    if (!saison) return pasTrouve();
    evts = evtsDeSeries(await seriesSemaineType(ids, saison));
    jours = libellesJoursType();
    sousTitre = `Semaine type · saison ${saison.label}`;
    fichier = `semaine-type-${saison.label}.pdf`;
  } else {
    const lundi = lundiDe(lireDate(url.searchParams.get("date") ?? undefined));
    evts = await occupationsSemaine(ids, lundi, filtresEvts);
    jours = libellesJours(lundi);
    const resume = resumeFiltres(filtresEvts, "", await optionsServices());
    sousTitre = `Semaine du ${jours[0]} au ${jours[6]}${resume ? ` · ${resume}` : ""}`;
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
