/**
 * La convention de mise à disposition : rendue en HTML puis en PDF, enregistrée comme
 * pièce du dossier (kind « convention »). Régénérée avec la mention de signature une
 * fois signée.
 */

import { ORGANISATION_TYPES, TARIF_UNITES } from "@/lib/constantes";
import { nomRepresentant, qualiteRepresentant } from "@/lib/dossier-usager";
import { dateCourte, dateHeure, montant, plage } from "@/lib/libelles";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { enregistrerPdf } from "@/server/documents";
import { escapeHtml } from "@/server/email-templates";
import { CSS_EDITION, htmlVersPdf } from "@/server/pdf";
import { chargerReservation, deviser, type ReservationComplete } from "@/server/reservations";

function p(s: string | null | undefined): string {
  return escapeHtml(s ?? "");
}

/** Le HTML complet de la convention d'un dossier. */
export async function htmlConvention(r: ReservationComplete): Promise<string> {
  const cfg = await getSettings();
  const devis = await deviser(
    r.espaceId,
    r.organisation?.profilId ?? null,
    r.creneaux.filter((c) => c.status === "prevu"),
    r.options.map((o) => ({ optionId: o.optionId, quantite: o.quantite })),
    r.materiels.map((m) => ({ materielId: m.materielId, quantite: m.quantite })),
    r.gratuit,
  );
  const creneaux = r.creneaux.filter((c) => c.status === "prevu");
  const occupant = r.organisation
    ? `${p(r.organisation.name)} (${ORGANISATION_TYPES[r.organisation.type] ?? r.organisation.type})${nomRepresentant(r.organisation) ? `, représentée par ${p(nomRepresentant(r.organisation))}, ${p(qualiteRepresentant(r.organisation.type).toLowerCase())}` : ""}`
    : r.user
      ? `${p(r.user.firstName)} ${p(r.user.lastName)}`
      : "—";
  const adresse = r.organisation
    ? [
        r.organisation.address,
        [r.organisation.postalCode, r.organisation.city].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ")
    : "";
  const tarifs = await prisma.tarif.findMany({
    where: { espaceId: r.espaceId },
    include: { profil: true },
  });
  const grille = tarifs.filter((t) =>
    r.organisation?.profilId ? t.profilId === r.organisation.profilId : t.profilId === null,
  );
  const signature = r.signedAt
    ? `<div class="signature"><strong>L'occupant</strong><br><span class="cachet">Signé électroniquement</span><br><small>par ${p(r.signerName)} le ${dateHeure(r.signedAt)}${r.signerIp ? ` (IP ${p(r.signerIp)})` : ""}</small></div>`
    : `<div class="signature"><strong>L'occupant</strong><br><small class="muted">Signature électronique en attente</small></div>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS_EDITION}</style></head><body>
<div class="entete"><div>${cfg.COLLECTIVITE_LOGO ? `<img class="logo" src="${cfg.COLLECTIVITE_LOGO}" alt="">` : ""}<div class="coll">${p(cfg.COLLECTIVITE_NOM)}</div><div class="muted">${p(cfg.COLLECTIVITE_ADRESSE)}</div>${cfg.COLLECTIVITE_EMAIL ? `<div class="muted">${p(cfg.COLLECTIVITE_EMAIL)}${cfg.COLLECTIVITE_TELEPHONE ? ` · ${p(cfg.COLLECTIVITE_TELEPHONE)}` : ""}</div>` : ""}</div>
<div class="doc"><strong>Convention de mise à disposition</strong><br>N° ${p(r.numero)}<br>Éditée le ${dateCourte(new Date())}</div></div>
<h1>Convention de mise à disposition</h1>
<p class="muted">${p(r.espace.name)} · ${p(r.espace.site.name)}</p>

<h2>Entre</h2>
<p><strong>${p(cfg.COLLECTIVITE_NOM)}</strong>, représentée par ${p(cfg.COLLECTIVITE_SIGNATAIRE || cfg.COLLECTIVITE_SIGNATAIRE_QUALITE)}${cfg.COLLECTIVITE_SIGNATAIRE ? `, ${p(cfg.COLLECTIVITE_SIGNATAIRE_QUALITE)}` : ""}, ci-après « la collectivité »,</p>
<p>et <strong>${occupant}</strong>${adresse ? `, ${p(adresse)}` : ""}${r.user?.email ? ` (${p(r.user.email)})` : ""}, ci-après « l'occupant ».</p>

<h2>Objet</h2>
<div class="grille">
<div><span class="muted">Espace</span><br><strong>${p(r.espace.name)}</strong>, ${p(r.espace.site.name)}${r.espace.site.address ? `<br>${p(r.espace.site.address)}, ${p(r.espace.site.postalCode)} ${p(r.espace.site.city)}` : ""}</div>
<div><span class="muted">Événement</span><br><strong>${p(r.title)}</strong>${r.nature ? `<br>${p(r.nature.label)}` : ""}${r.participants ? `<br>${r.participants} participant(s) attendu(s)` : ""}</div>
</div>
<h3>Créneaux (${creneaux.length})</h3>
<table><thead><tr><th>Date et horaires</th><th class="num">Durée</th></tr></thead><tbody>
${creneaux.map((c) => `<tr><td>${plage(c.startAt, c.endAt)}</td><td class="num">${Math.round(((c.endAt.getTime() - c.startAt.getTime()) / 36e5) * 10) / 10} h</td></tr>`).join("")}
</tbody></table>

<h2>Conditions financières</h2>
${r.gratuit ? `<p><strong>Mise à disposition à titre gracieux.</strong>${r.gratuitMotif ? ` Fondement : ${p(r.gratuitMotif)}.` : ""}</p>` : ""}
<table><thead><tr><th>Désignation</th><th class="num">Qté</th><th class="num">Prix unitaire</th><th class="num">Montant</th></tr></thead><tbody>
${devis.lignes.map((l) => `<tr><td>${p(l.libelle)}</td><td class="num">${l.quantite}</td><td class="num">${montant(l.unitaire)}</td><td class="num">${montant(l.montant)}</td></tr>`).join("")}
${devis.lignes.length ? "" : `<tr><td colspan="4" class="muted">Aucune redevance.</td></tr>`}
<tr><td colspan="3" class="num">Total HT</td><td class="num">${montant(devis.ht)}</td></tr>
${devis.tva ? `<tr><td colspan="3" class="num">TVA (${cfg.TVA_TAUX} %)</td><td class="num">${montant(devis.tva)}</td></tr>` : ""}
<tr class="total"><td colspan="3" class="num">Total TTC</td><td class="num">${montant(devis.ttc)}</td></tr>
${devis.acompte ? `<tr><td colspan="3" class="num">dont acompte à la confirmation</td><td class="num">${montant(devis.acompte)}</td></tr>` : ""}
${devis.caution ? `<tr><td colspan="3" class="num">Caution (restituée après état des lieux)</td><td class="num">${montant(devis.caution)}</td></tr>` : ""}
</tbody></table>
${grille.length ? `<p class="muted" style="margin-top:6px;font-size:9.5pt">Grille appliquée${r.organisation?.profil ? ` (${p(r.organisation.profil.label)})` : ""} : ${grille.map((t) => `${TARIF_UNITES[t.unite] ?? t.unite} ${montant(t.montant)}`).join(" · ")}</p>` : ""}

<h2>Conditions de mise à disposition</h2>
<div class="pre">${p(cfg.CONVENTION_TEXTE)}</div>
${r.espace.rules ? `<h3>Règlement propre à l'espace</h3><div class="pre">${p(r.espace.rules)}</div>` : ""}
${r.espace.instructions ? `<h3>Consignes d'accès</h3><div class="pre">${p(r.espace.instructions)}</div>` : ""}

<div class="signatures">
<div class="signature"><strong>Pour la collectivité</strong><br>${p(cfg.COLLECTIVITE_SIGNATAIRE_QUALITE)}${cfg.COLLECTIVITE_SIGNATAIRE ? `<br>${p(cfg.COLLECTIVITE_SIGNATAIRE)}` : ""}<br><small class="muted">Accepté le ${r.decisionAt ? dateCourte(r.decisionAt) : dateCourte(new Date())}${r.decisionBy ? ` par ${p(r.decisionBy)}` : ""}</small></div>
${signature}
</div>
<div class="pied">${p(cfg.COLLECTIVITE_NOM)} · Convention ${p(r.numero)} · CityRésa</div>
</body></html>`;
}

/** Génère (ou régénère) le PDF de la convention et l'accroche au dossier. */
export async function genererConvention(r: ReservationComplete, acteur: string): Promise<number> {
  const html = await htmlConvention(r);
  const pdf = await htmlVersPdf(html);
  if (r.conventionDocumentId) {
    await prisma.document.delete({ where: { id: r.conventionDocumentId } }).catch(() => {});
  }
  const doc = await enregistrerPdf(
    "reservation",
    r.id,
    `convention-${r.numero}${r.signedAt ? "-signee" : ""}.pdf`,
    pdf,
    "convention",
    r.signedAt ? "Convention signée" : "Convention à signer",
  );
  await prisma.reservation.update({ where: { id: r.id }, data: { conventionDocumentId: doc.id } });
  await prisma.reservationHistory.create({
    data: {
      reservationId: r.id,
      action: r.signedAt ? "Convention signée éditée" : "Convention éditée",
      performedBy: acteur,
    },
  });
  return doc.id;
}

/** Le PDF de la convention d'un dossier (à la volée, sans l'enregistrer). */
export async function pdfConvention(id: number): Promise<Buffer | null> {
  const r = await chargerReservation(id);
  if (!r) return null;
  return htmlVersPdf(await htmlConvention(r));
}
