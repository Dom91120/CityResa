/**
 * Envoi programmé des plannings : le jour configuré, chaque gestionnaire (ou agent notifié)
 * d'un espace reçoit le planning hebdomadaire PDF des espaces dont il a la charge, avec un
 * résumé en texte. Un seul envoi par agent et par jour (trace mail_log).
 * Règles pures dans src/lib/planning-hebdo.ts.
 */
import { parisMidnight, todayParisISO } from "@/lib/paris-time";
import {
  destinataires,
  estJourEnvoi,
  lundiAEditer,
  nomFichierPlanning,
  resumeSemaine,
} from "@/lib/planning-hebdo";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { libellesJours, occupationsSemaine, pdfPlanningSemaine } from "@/server/editions";
import { envoyerDepuisModele } from "@/server/mailer";

export async function envoyerPlanningsHebdo(now = new Date()): Promise<string> {
  const cfg = await getSettings();
  if (!cfg.PLANNING_HEBDO_ENABLED) return "envoi désactivé";
  if (!estJourEnvoi(cfg.PLANNING_HEBDO_JOUR || 1, now)) return "pas le jour d'envoi";
  const [liens, agents, espaces] = await Promise.all([
    prisma.espaceGestionnaire.findMany({ select: { userId: true, espaceId: true, role: true } }),
    prisma.user.findMany({
      where: { kind: "agent" },
      select: { id: true, email: true, firstName: true, isActive: true, notifEmail: true },
    }),
    prisma.espace.findMany({
      select: { id: true, name: true, isActive: true, site: { select: { name: true } } },
    }),
  ]);
  const cibles = destinataires(
    liens,
    agents,
    espaces.map((e) => ({ id: e.id, name: e.name, site: e.site.name, isActive: e.isActive })),
  );
  if (!cibles.length) return "aucun gestionnaire abonné";
  const lundi = lundiAEditer(now);
  const jours = libellesJours(lundi);
  const semaine = `${jours[0]} au ${jours[6]}`;
  const dejaEnvoye = new Set(
    (
      await prisma.mailLog.findMany({
        where: {
          templateKey: "planning_hebdo",
          sentAt: { gte: parisMidnight(todayParisISO(now)) },
        },
        select: { recipient: true },
      })
    ).map((m) => m.recipient),
  );
  let envoyes = 0;
  for (const { agent, espaces: miens } of cibles) {
    if (dejaEnvoye.has(agent.email)) continue;
    const ids = miens.map((e) => e.id);
    const evts = await occupationsSemaine(ids, lundi);
    const pdf = await pdfPlanningSemaine({
      titre: "Planning hebdomadaire",
      sousTitre: `Semaine du ${semaine}`,
      format: "A4",
      collectivite: cfg.COLLECTIVITE_NOM,
      legende:
        "Réservations acceptées, signées ou confirmées, demandes en cours et fermetures (hachurées).",
      grilles: miens.map((e) => ({
        espace: { id: e.id, name: e.name, site: e.site },
        jours,
        evts: evts.filter((x) => x.espaceId === e.id),
      })),
    });
    const ok = await envoyerDepuisModele(
      "planning_hebdo",
      agent.email,
      {
        prenom: agent.firstName || "",
        semaine,
        espaces: miens.map((e) => e.name).join(", "),
        resume: resumeSemaine(miens, evts, jours),
        lien: `${cfg.APP_BASE_URL}/planning?date=${lundi}${ids.map((id) => `&espace=${id}`).join("")}`,
      },
      {
        attachments: [
          { filename: nomFichierPlanning(lundi), content: pdf, contentType: "application/pdf" },
        ],
      },
    );
    if (ok) envoyes += 1;
  }
  return `${envoyes} planning(s) envoyé(s) pour la semaine du ${semaine}`;
}
