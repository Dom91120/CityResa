/**
 * Éditions au format calendrier : planning hebdomadaire d'un ou plusieurs espaces (A4 ou A3,
 * paysage, noir et blanc), feuille de salle avec QR code vers la version en ligne, semaine
 * type d'une saison. Règles pures dans src/lib/editions.ts, rendu HTML → PDF ici.
 */
import QRCode from "qrcode";
import { Prisma } from "@/generated/prisma/client";
import { STATUTS_OCCUPANTS } from "@/lib/constantes";
import {
  couloirs,
  type EvtSemaine,
  joursDeLaSemaine,
  plageAffichee,
  plageMinutes,
  projeter,
  type SerieHebdo,
  semaineType,
} from "@/lib/editions";
import { dateCourte, dateHeure, dateMoyenne, NOMS_JOURS_COURTS } from "@/lib/libelles";
import { parisMidnight } from "@/lib/paris-time";
import { fenetre, occupationsPlanning } from "@/modules/planning/server";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { escapeHtml } from "@/server/email-templates";
import { htmlVersPdf } from "@/server/pdf";

const p = (s: string | null | undefined) => escapeHtml(s ?? "");

export type EspaceEdition = { id: number; name: string; site: string };

/** Les occupations d'une semaine (créneaux vivants et blocages) projetées sur ses jours. */
export async function occupationsSemaine(
  espaceIds: number[],
  lundi: string,
): Promise<EvtSemaine[]> {
  const jours = joursDeLaSemaine(lundi);
  const { creneaux, blocages } = await occupationsPlanning(espaceIds, fenetre("semaine", lundi));
  return projeter(
    [
      ...creneaux.map((c) => ({
        startAt: c.startAt,
        endAt: c.endAt,
        titre: c.titre,
        sousTitre: c.qui,
        genre: "reservation" as const,
        espaceId: c.espaceId,
      })),
      ...blocages.map((b) => ({
        startAt: b.startAt,
        endAt: b.endAt,
        titre: b.motif ? `Fermé · ${b.motif}` : "Fermé",
        sousTitre: "",
        genre: "blocage" as const,
        espaceId: b.espaceId,
      })),
    ],
    jours,
  );
}

/** Les séries hebdomadaires vivantes des espaces sur une saison, ramenées sur une semaine. */
export async function seriesSemaineType(
  espaceIds: number[],
  saison: { debut: string; fin: string },
): Promise<SerieHebdo[]> {
  if (!espaceIds.length) return [];
  const de = parisMidnight(saison.debut);
  const a = new Date(parisMidnight(saison.fin).getTime() + 86_400_000);
  const dossiers = await prisma.reservation.findMany({
    where: {
      espaceId: { in: espaceIds },
      status: { in: STATUTS_OCCUPANTS },
      recurrence: { not: Prisma.DbNull },
      creneaux: { some: { status: "prevu", startAt: { gte: de, lt: a } } },
    },
    include: {
      organisation: { select: { name: true } },
      user: { select: { firstName: true, lastName: true } },
      creneaux: { where: { status: "prevu", startAt: { gte: de, lt: a } } },
    },
  });
  return semaineType(
    dossiers.map((d) => ({
      id: d.id,
      numero: d.numero,
      title: d.title,
      qui: d.organisation?.name ?? (d.user ? `${d.user.firstName} ${d.user.lastName}`.trim() : ""),
      espaceId: d.espaceId,
      recurrence: d.recurrence,
      creneaux: d.creneaux,
    })),
  );
}

/** Les séries d'une semaine type, au format des événements d'une grille (jour = rang ISO). */
export function evtsDeSeries(series: readonly SerieHebdo[]): EvtSemaine[] {
  return series.map((s) => ({
    jour: s.jour,
    debutMin: s.debutMin,
    finMin: s.finMin,
    titre: s.titre,
    sousTitre: `${s.qui} · ${s.nb} séance${s.nb > 1 ? "s" : ""}${s.horsVacances ? " · hors vacances" : ""}`,
    genre: "reservation" as const,
    espaceId: s.espaceId,
  }));
}

/** Un QR code SVG (sans marge) vers une adresse. */
export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
}

const CSS_PLANNING = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; color: #000; margin: 0; font-size: 9pt; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .entete { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
  .entete h1 { font-size: 15pt; margin: 0; }
  .entete .sous { font-size: 9.5pt; color: #333; }
  .entete .edite { font-size: 8pt; color: #333; text-align: right; }
  .grille { display: grid; grid-template-columns: 34px repeat(7, 1fr); border: 1px solid #000; }
  .grille .coin, .grille .jour { border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 3px 4px; font-weight: 700; font-size: 8.5pt; text-align: center; }
  .grille .jour.we { background: #eee; }
  .grille .heures, .grille .col { position: relative; border-right: 1px solid #000; }
  .grille .col.we { background: #f3f3f3; }
  .grille .heures .h, .grille .col .ligne { position: absolute; left: 0; right: 0; border-top: 1px solid #bbb; }
  .grille .heures .h { font-size: 7pt; color: #333; padding-left: 2px; line-height: 1; }
  .grille .col .ligne.pleine { border-top-color: #777; }
  .evt { position: absolute; border: 1px solid #000; background: #fff; padding: 1px 3px; overflow: hidden; font-size: 7.2pt; line-height: 1.2; }
  .evt .t { font-weight: 700; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .evt .s { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #222; }
  .evt.blocage { background: repeating-linear-gradient(45deg, #fff, #fff 3px, #999 3px, #999 5px); font-weight: 700; }
  .evt.blocage .t { background: #fff; display: inline-block; padding: 0 2px; }
  .legende { font-size: 7.5pt; color: #333; margin-top: 4px; }
  .pied { position: fixed; bottom: 0; left: 0; right: 0; font-size: 7.5pt; color: #333; text-align: center; }
`;

export type GrilleSemaine = {
  espace: EspaceEdition;
  /** Libellés des 7 colonnes. */
  jours: string[];
  evts: EvtSemaine[];
};

export type ParamsPlanning = {
  titre: string;
  sousTitre: string;
  grilles: GrilleSemaine[];
  format: "A4" | "A3";
  collectivite: string;
  legende?: string;
};

/** Le HTML d'un planning hebdomadaire noir et blanc : une page par espace. */
export function htmlPlanningSemaine(q: ParamsPlanning): string {
  const hauteur = q.format === "A3" ? 248 : 150;
  const edite = `Édité le ${dateHeure(new Date())}`;
  const pages = q.grilles.map((g) => {
    const { debutH, finH } = plageAffichee(g.evts);
    const total = (finH - debutH) * 60;
    const pct = (min: number) =>
      ((Math.min(Math.max(min, debutH * 60), finH * 60) - debutH * 60) / total) * 100;
    const heures = Array.from({ length: finH - debutH }, (_, i) => debutH + i);
    const lignes = heures
      .map(
        (h) =>
          `<div class="ligne pleine" style="top:${pct(h * 60)}%"></div><div class="ligne" style="top:${pct(h * 60 + 30)}%"></div>`,
      )
      .join("");
    const cols = g.jours
      .map((_label, i) => {
        const jour = i + 1;
        const we = jour >= 6;
        const dedans = couloirs(g.evts.filter((e) => e.jour === jour));
        const boites = dedans
          .map((e) => {
            const top = pct(e.debutMin);
            const h = Math.max(pct(e.finMin) - top, 1.2);
            const largeur = 100 / e.nbCouloirs;
            return `<div class="evt${e.genre === "blocage" ? " blocage" : ""}" style="top:${top}%;height:${h}%;left:${e.couloir * largeur}%;width:${largeur}%"><span class="t">${p(plageMinutes(e.debutMin, e.finMin))} ${p(e.titre)}</span>${e.sousTitre ? `<span class="s">${p(e.sousTitre)}</span>` : ""}</div>`;
          })
          .join("");
        return `<div class="col${we ? " we" : ""}" style="height:${hauteur}mm">${lignes}${boites}</div>`;
      })
      .join("");
    return `<div class="page">
<div class="entete"><div><h1>${p(g.espace.name)}</h1><div class="sous">${p(g.espace.site)} · ${p(q.sousTitre)}</div></div><div class="edite">${p(q.collectivite)}<br>${edite}</div></div>
<div class="grille">
<div class="coin"></div>${g.jours.map((j, i) => `<div class="jour${i >= 5 ? " we" : ""}">${p(j)}</div>`).join("")}
<div class="heures" style="height:${hauteur}mm">${heures.map((h) => `<div class="h" style="top:${pct(h * 60)}%">${h}h</div>`).join("")}</div>
${cols}
</div>
${q.legende ? `<div class="legende">${p(q.legende)}</div>` : ""}
</div>`;
  });
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${p(q.titre)}</title><style>${CSS_PLANNING}</style></head><body>${pages.join("") || `<div class="page"><div class="entete"><div><h1>${p(q.titre)}</h1></div></div><p>Aucun espace.</p></div>`}<div class="pied">${p(q.collectivite)} · ${p(q.titre)} · ${edite} · CityRésa</div></body></html>`;
}

export async function pdfPlanningSemaine(q: ParamsPlanning): Promise<Buffer> {
  return htmlVersPdf(
    htmlPlanningSemaine(q),
    { top: "10mm", right: "10mm", bottom: "12mm", left: "10mm" },
    { format: q.format, paysage: true },
  );
}

/** Les libellés des colonnes d'une semaine datée : « Lun. 16 nov. ». */
export function libellesJours(lundi: string): string[] {
  return joursDeLaSemaine(lundi).map((j) => dateMoyenne(parisMidnight(j)));
}

/** Les libellés des colonnes d'une semaine type : « Lundi »… */
export function libellesJoursType(): string[] {
  return ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
}

// ── Feuille de salle ──

const CSS_FEUILLE = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; color: #000; margin: 0; font-size: 11pt; }
  .entete { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  h1 { font-size: 24pt; margin: 0; }
  .sous { font-size: 12pt; color: #333; }
  .qr { text-align: center; font-size: 8pt; color: #333; width: 32mm; }
  .qr svg { width: 28mm; height: 28mm; display: block; margin: 0 auto 3px; }
  h2 { font-size: 13pt; margin: 14px 0 6px; border-bottom: 1px solid #000; padding-bottom: 2px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #000; padding: 5px 7px; text-align: left; vertical-align: top; font-size: 10.5pt; }
  th { background: #eee; }
  tr.jour td { background: #f6f6f6; font-weight: 700; }
  td.h { white-space: nowrap; width: 110px; }
  .vide { color: #333; font-style: italic; }
  .pre { white-space: pre-wrap; font-size: 10pt; }
  .pied { position: fixed; bottom: 0; left: 0; right: 0; font-size: 8pt; color: #333; text-align: center; }
`;

export type ParamsFeuille = {
  espace: {
    name: string;
    site: string;
    adresse: string;
    instructions: string | null;
    rules: string | null;
  };
  lundi: string;
  evts: EvtSemaine[];
  url: string;
  qr: string;
  collectivite: string;
};

/** La feuille de salle : le programme de la semaine à afficher à la porte, avec le QR code de la version en ligne. */
export function htmlFeuilleSalle(q: ParamsFeuille): string {
  const jours = joursDeLaSemaine(q.lundi);
  const lignes = jours
    .map((j, i) => {
      const du = q.evts.filter((e) => e.jour === i + 1).sort((a, b) => a.debutMin - b.debutMin);
      const date = parisMidnight(j);
      const titre = `<tr class="jour"><td colspan="3">${NOMS_JOURS_COURTS[i]} ${dateCourte(date)}</td></tr>`;
      if (!du.length) return `${titre}<tr><td colspan="3" class="vide">Libre</td></tr>`;
      return (
        titre +
        du
          .map(
            (e) =>
              `<tr><td class="h">${p(plageMinutes(e.debutMin, e.finMin))}</td><td>${e.genre === "blocage" ? `<strong>${p(e.titre)}</strong>` : p(e.titre)}</td><td>${p(e.sousTitre)}</td></tr>`,
          )
          .join("")
      );
    })
    .join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS_FEUILLE}</style></head><body>
<div class="entete"><div><h1>${p(q.espace.name)}</h1><div class="sous">${p(q.espace.site)}${q.espace.adresse ? ` · ${p(q.espace.adresse)}` : ""}</div><div class="sous">Semaine du ${dateCourte(parisMidnight(jours[0]))} au ${dateCourte(parisMidnight(jours[6]))}</div></div>
<div class="qr">${q.qr}Planning en ligne</div></div>
<table><thead><tr><th>Horaires</th><th>Événement</th><th>Organisateur</th></tr></thead><tbody>${lignes}</tbody></table>
${q.espace.instructions ? `<h2>Consignes</h2><div class="pre">${p(q.espace.instructions)}</div>` : ""}
${q.espace.rules ? `<h2>Règlement</h2><div class="pre">${p(q.espace.rules)}</div>` : ""}
<div class="pied">${p(q.collectivite)} · ${p(q.espace.name)} · édité le ${dateHeure(new Date())} · ${p(q.url)}</div>
</body></html>`;
}

export async function pdfFeuilleSalle(q: ParamsFeuille): Promise<Buffer> {
  return htmlVersPdf(htmlFeuilleSalle(q), {
    top: "12mm",
    right: "12mm",
    bottom: "14mm",
    left: "12mm",
  });
}

/** L'adresse publique d'un espace sur le portail (cible du QR code). */
export async function urlPublique(slug: string): Promise<string> {
  const cfg = await getSettings();
  return `${cfg.APP_BASE_URL}/portail/espaces/${slug}`;
}
