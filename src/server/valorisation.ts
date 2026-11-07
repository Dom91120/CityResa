/**
 * Valorisation des avantages en nature : calcul d'un exercice (dossiers acquis dont des
 * créneaux tombent dans l'année civile, au tarif de référence « tous profils » ou à la valeur
 * horaire de l'espace, subventions votées ou versées), clôture qui fige les montants et dépose
 * l'attestation annuelle sur la fiche de chaque organisation. Règles pures dans src/lib/valorisation.ts.
 */
import type { Valorisation } from "@/generated/prisma/client";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import { dateCourte, montant } from "@/lib/libelles";
import { parisMidnight, todayParisISO } from "@/lib/paris-time";
import {
  avantage,
  cumuler,
  type DossierValorise,
  type LigneValorisation,
  partExercice,
  type Seuils,
  sansConvention,
  valeurReference,
} from "@/lib/valorisation";
import { auditRecord } from "@/server/audit";
import { type AppSettings, getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { enregistrerPdf } from "@/server/documents";
import { escapeHtml } from "@/server/email-templates";
import { CSS_EDITION, htmlVersPdf } from "@/server/pdf";
import { deviser } from "@/server/reservations";

const STATUTS_VALORISES = ["acceptee", "signee", "confirmee", "terminee", "archivee"];
const arrondi = (n: number) => Math.round(n * 100) / 100;
const p = (s: string | null | undefined) => escapeHtml(s ?? "");

export function seuilsDe(
  cfg: Pick<AppSettings, "VALORISATION_SEUIL_CONVENTION" | "VALORISATION_SEUIL_CERTIFICATION">,
): Seuils {
  return {
    convention: cfg.VALORISATION_SEUIL_CONVENTION,
    certification: cfg.VALORISATION_SEUIL_CERTIFICATION,
  };
}

export function exerciceCourant(): number {
  return Number(todayParisISO().slice(0, 4));
}

/** Les exercices qui ont des créneaux, du plus récent au plus ancien, l'exercice courant compris. */
export async function exercicesDisponibles(): Promise<number[]> {
  const [min, max] = await Promise.all([
    prisma.creneau.aggregate({ _min: { startAt: true } }),
    prisma.creneau.aggregate({ _max: { startAt: true } }),
  ]);
  const courant = exerciceCourant();
  const de = min._min.startAt ? min._min.startAt.getUTCFullYear() : courant;
  const a = Math.max(courant, max._max.startAt ? max._max.startAt.getUTCFullYear() : courant);
  const out: number[] = [];
  for (let y = a; y >= de; y--) out.push(y);
  return out;
}

export type ValorisationExercice = {
  exercice: number;
  lignes: LigneValorisation[];
  figees: Map<number, Valorisation>;
};

/** Le calcul en direct d'un exercice : une ligne par organisation aidée. */
export async function calculerValorisation(exercice: number): Promise<LigneValorisation[]> {
  const de = parisMidnight(`${exercice}-01-01`);
  const a = parisMidnight(`${exercice + 1}-01-01`);
  const dossiers = await prisma.reservation.findMany({
    where: {
      organisationId: { not: null },
      status: { in: STATUTS_VALORISES },
      creneaux: { some: { status: "prevu", startAt: { gte: de, lt: a } } },
    },
    include: {
      organisation: { select: { id: true, name: true, type: true, conventionnee: true } },
      espace: { select: { id: true, name: true, valorisationHoraire: true } },
      creneaux: { where: { status: "prevu" } },
      options: true,
      materiels: true,
    },
  });
  const valorises: (DossierValorise & {
    organisation: { id: number; name: string; type: string; conventionnee: boolean };
  })[] = [];
  for (const r of dossiers) {
    if (!r.organisation) continue;
    const part = partExercice(r.creneaux, exercice);
    if (!part.dedans.length) continue;
    let devisRef = 0;
    if (r.espace.valorisationHoraire === null) {
      try {
        devisRef = (
          await deviser(
            r.espaceId,
            null,
            part.dedans,
            r.options.map((o) => ({ optionId: o.optionId, quantite: o.quantite })),
            r.materiels.map((m) => ({ materielId: m.materielId, quantite: m.quantite })),
            false,
          )
        ).ttc;
      } catch (e) {
        console.error("[valorisation] devis de référence impossible :", r.numero, e);
      }
    }
    const valeurRef = valeurReference(part.heures, r.espace.valorisationHoraire, devisRef);
    const redevance = r.gratuit ? 0 : arrondi(r.montantTtc * part.part);
    valorises.push({
      reservationId: r.id,
      numero: r.numero,
      titre: r.title,
      espace: r.espace.name,
      heures: part.heures,
      valeurReference: valeurRef,
      redevance,
      avantage: avantage(valeurRef, redevance),
      organisation: r.organisation,
    });
  }
  const subv = await prisma.subvention.groupBy({
    by: ["organisationId"],
    where: { exercice, status: { in: ["votee", "versee"] } },
    _sum: { montantAccorde: true },
  });
  const subventions = new Map(subv.map((s) => [s.organisationId, s._sum.montantAccorde ?? 0]));
  const orgsSubv = subv.length
    ? await prisma.organisation.findMany({
        where: { id: { in: subv.map((s) => s.organisationId) } },
        select: { id: true, name: true, type: true, conventionnee: true },
      })
    : [];
  return cumuler(valorises, subventions, orgsSubv);
}

export async function valorisationsFigees(exercice: number): Promise<Map<number, Valorisation>> {
  const rows = await prisma.valorisation.findMany({ where: { exercice } });
  return new Map(rows.map((v) => [v.organisationId, v]));
}

// ── Attestation ──

/** Le HTML de l'attestation annuelle d'une organisation. */
export async function htmlAttestation(
  ligne: LigneValorisation,
  exercice: number,
  figee: Valorisation | null,
): Promise<string> {
  const cfg = await getSettings();
  const org = await prisma.organisation.findUniqueOrThrow({ where: { id: ligne.organisationId } });
  const adresse = [org.address, [org.postalCode, org.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const lignes = ligne.dossiers
    .sort((a, b) => a.numero.localeCompare(b.numero))
    .map(
      (d) =>
        `<tr><td>${p(d.numero)}</td><td>${p(d.titre)}<br><span class="muted">${p(d.espace)}</span></td><td class="num">${d.heures.toLocaleString("fr-FR")} h</td><td class="num">${montant(d.valeurReference)}</td><td class="num">${montant(d.redevance)}</td><td class="num">${montant(d.avantage)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS_EDITION}</style></head><body>
<div class="entete"><div>${cfg.COLLECTIVITE_LOGO ? `<img class="logo" src="${cfg.COLLECTIVITE_LOGO}" alt="">` : ""}<div class="coll">${p(cfg.COLLECTIVITE_NOM)}</div><div class="muted">${p(cfg.COLLECTIVITE_ADRESSE)}</div></div>
<div class="doc"><strong>Attestation de mise à disposition</strong><br>Exercice ${exercice}<br>Éditée le ${dateCourte(new Date())}</div></div>
<h1>Attestation de valorisation des avantages en nature</h1>
<p class="muted">Exercice ${exercice}${figee ? ` · montants arrêtés le ${dateCourte(figee.figeeAt)}` : " · montants provisoires"}</p>
<p>${p(cfg.COLLECTIVITE_NOM)}, représentée par ${p(cfg.COLLECTIVITE_SIGNATAIRE || cfg.COLLECTIVITE_SIGNATAIRE_QUALITE)}, atteste avoir mis à disposition de <strong>${p(org.name)}</strong> (${ORGANISATION_TYPES[org.type] ?? org.type}${adresse ? `, ${p(adresse)}` : ""}) les équipements municipaux ci-dessous au cours de l'exercice ${exercice}.</p>
<h2>Mises à disposition</h2>
<table><thead><tr><th>Dossier</th><th>Objet et espace</th><th class="num">Heures</th><th class="num">Valeur de référence</th><th class="num">Redevance due</th><th class="num">Avantage en nature</th></tr></thead><tbody>
${lignes || `<tr><td colspan="6" class="muted">Aucune mise à disposition sur l'exercice.</td></tr>`}
<tr class="total"><td colspan="2">Total · ${ligne.nbDossiers} dossier${ligne.nbDossiers > 1 ? "s" : ""}</td><td class="num">${ligne.heures.toLocaleString("fr-FR")} h</td><td class="num">${montant(ligne.valeurReference)}</td><td class="num">${montant(ligne.redevance)}</td><td class="num">${montant(ligne.avantage)}</td></tr>
</tbody></table>
<h2>Récapitulatif des aides</h2>
<table><tbody>
<tr><td>Avantages en nature (mises à disposition)</td><td class="num">${montant(ligne.avantage)}</td></tr>
<tr><td>Subventions en numéraire votées ou versées</td><td class="num">${montant(ligne.subventions)}</td></tr>
<tr class="total"><td>Total des aides de l'exercice</td><td class="num">${montant(ligne.total)}</td></tr>
</tbody></table>
<p class="muted" style="font-size:9.5pt">La valeur de référence correspond à la grille tarifaire « tous profils » de chaque espace, ou à sa valeur horaire de valorisation. L'avantage en nature est la différence entre cette valeur et la redevance due. Ces montants sont à faire figurer dans les comptes de l'association au titre des contributions volontaires en nature.</p>
<div class="signatures"><div class="signature"><strong>Pour la collectivité</strong><br>${p(cfg.COLLECTIVITE_SIGNATAIRE_QUALITE)}${cfg.COLLECTIVITE_SIGNATAIRE ? `<br>${p(cfg.COLLECTIVITE_SIGNATAIRE)}` : ""}</div><div></div></div>
<div class="pied">${p(cfg.COLLECTIVITE_NOM)} · Attestation de valorisation ${exercice} · ${p(org.name)} · CityRésa</div>
</body></html>`;
}

export async function pdfAttestation(
  ligne: LigneValorisation,
  exercice: number,
  figee: Valorisation | null,
): Promise<Buffer> {
  return htmlVersPdf(await htmlAttestation(ligne, exercice, figee));
}

/** Dépose (ou remplace) l'attestation d'une organisation sur sa fiche ; renvoie l'identifiant du document. */
export async function deposerAttestation(
  ligne: LigneValorisation,
  exercice: number,
  acteur: { name: string; email: string },
): Promise<number> {
  const figee = (await prisma.valorisation.findUnique({
    where: { organisationId_exercice: { organisationId: ligne.organisationId, exercice } },
  })) as Valorisation | null;
  const pdf = await pdfAttestation(ligne, exercice, figee);
  const org = await prisma.organisation.findUniqueOrThrow({ where: { id: ligne.organisationId } });
  if (figee?.documentId)
    await prisma.document.delete({ where: { id: figee.documentId } }).catch(() => {});
  const doc = await enregistrerPdf(
    "organisation",
    ligne.organisationId,
    `attestation-valorisation-${exercice}-${org.name.replace(/[^\w-]+/g, "-").toLowerCase()}.pdf`,
    pdf,
    "attestation",
    `Attestation de valorisation ${exercice}`,
  );
  if (figee)
    await prisma.valorisation.update({ where: { id: figee.id }, data: { documentId: doc.id } });
  await auditRecord(
    "attestation valorisation",
    `${org.name} · ${exercice} · ${montant(ligne.total)}`,
    "subventions",
    acteur.email,
  );
  return doc.id;
}

/**
 * Clôture d'un exercice : fige les montants de chaque organisation (une ligne par
 * organisation, remplacée si elle existait) et dépose les attestations. Renvoie le nombre
 * d'organisations traitées.
 */
export async function figerExercice(
  exercice: number,
  acteur: { name: string; email: string },
): Promise<number> {
  const lignes = await calculerValorisation(exercice);
  for (const l of lignes) {
    await prisma.valorisation.upsert({
      where: { organisationId_exercice: { organisationId: l.organisationId, exercice } },
      create: {
        organisationId: l.organisationId,
        exercice,
        nbDossiers: l.nbDossiers,
        heures: l.heures,
        valeurReference: l.valeurReference,
        redevance: l.redevance,
        avantage: l.avantage,
        subventions: l.subventions,
        total: l.total,
        figeePar: acteur.name,
      },
      update: {
        nbDossiers: l.nbDossiers,
        heures: l.heures,
        valeurReference: l.valeurReference,
        redevance: l.redevance,
        avantage: l.avantage,
        subventions: l.subventions,
        total: l.total,
        figeeAt: new Date(),
        figeePar: acteur.name,
      },
    });
    await deposerAttestation(l, exercice, acteur);
  }
  await auditRecord(
    "cloture valorisation",
    `exercice ${exercice} · ${lignes.length} organisation(s)`,
    "subventions",
    acteur.email,
  );
  return lignes.length;
}

// ── Alerte ──

type CacheAlerte = { at: number; exercice: number; sans: number };
const partage = globalThis as unknown as { __cityresaValo?: { cache: CacheAlerte | null } };
partage.__cityresaValo ??= { cache: null };

/** Le nombre d'organisations au-delà du seuil de convention sans convention (calcul mis en cache 10 min). */
export async function organisationsSansConvention(cfg: AppSettings): Promise<number> {
  const exercice = exerciceCourant();
  const c = partage.__cityresaValo?.cache;
  if (c && c.exercice === exercice && Date.now() - c.at < 10 * 60_000) return c.sans;
  const sans = sansConvention(await calculerValorisation(exercice), seuilsDe(cfg)).length;
  if (partage.__cityresaValo) partage.__cityresaValo.cache = { at: Date.now(), exercice, sans };
  return sans;
}

export function invaliderCacheValorisation(): void {
  if (partage.__cityresaValo) partage.__cityresaValo.cache = null;
}

// ── Par organisation ──

/**
 * Les locaux municipaux mis à disposition d'une organisation sur un exercice : heures par
 * espace (créneaux prévus des dossiers acquis). Sert à pré-remplir le dossier de subvention.
 */
export async function locauxMisADisposition(
  organisationId: number,
  exercice: number,
): Promise<{ espace: string; heures: number }[]> {
  const de = parisMidnight(`${exercice}-01-01`);
  const a = parisMidnight(`${exercice + 1}-01-01`);
  const dossiers = await prisma.reservation.findMany({
    where: {
      organisationId,
      status: { in: STATUTS_VALORISES },
      creneaux: { some: { status: "prevu", startAt: { gte: de, lt: a } } },
    },
    select: {
      espace: { select: { name: true, site: { select: { name: true } } } },
      creneaux: { where: { status: "prevu" }, select: { startAt: true, endAt: true } },
    },
  });
  const heures = new Map<string, number>();
  for (const r of dossiers) {
    const part = partExercice(r.creneaux, exercice);
    if (!part.heures) continue;
    const cle = `${r.espace.name} (${r.espace.site.name})`;
    heures.set(cle, (heures.get(cle) ?? 0) + part.heures);
  }
  return [...heures.entries()]
    .map(([espace, h]) => ({ espace, heures: Math.round(h * 10) / 10 }))
    .sort((x, y) => y.heures - x.heures);
}
