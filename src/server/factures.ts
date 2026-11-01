/**
 * Facturation : factures d'acompte, de solde, de caution ; paiements ; PDF.
 */
import { FACTURE_TYPES, PAIEMENT_MODES } from "@/lib/constantes";
import { dateCourte, montant, plage } from "@/lib/libelles";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { enregistrerPdf } from "@/server/documents";
import { escapeHtml } from "@/server/email-templates";
import { UserFacingError } from "@/server/errors";
import { notifier } from "@/server/notifications";
import { prochainNumero } from "@/server/numerotation";
import { CSS_EDITION, htmlVersPdf } from "@/server/pdf";
import {
  chargerReservation,
  courrielUsager,
  type ReservationComplete,
} from "@/server/reservations";

export type FactureComplete = NonNullable<Awaited<ReturnType<typeof chargerFacture>>>;

export async function chargerFacture(id: number) {
  return prisma.facture.findUnique({
    where: { id },
    include: {
      paiements: { include: { recordedBy: true }, orderBy: { paidAt: "asc" } },
      reservation: {
        include: { espace: { include: { site: true } }, user: true, organisation: true },
      },
      organisation: true,
    },
  });
}

/** Crée une facture pour un dossier (acompte, solde ou caution) et l'envoie à l'usager. */
export async function creerFacture(
  r: ReservationComplete,
  type: "acompte" | "solde" | "caution",
  acteur: string,
  dueDays = 30,
) {
  const cfg = await getSettings();
  let ttc: number;
  if (type === "acompte") ttc = r.acompte;
  else if (type === "caution") ttc = r.caution;
  else {
    const dejaAcompte = r.factures
      .filter((f) => f.type === "acompte" && f.status !== "annulee")
      .reduce((s, f) => s + f.montantTtc, 0);
    ttc = Math.round((r.montantTtc - dejaAcompte) * 100) / 100;
  }
  if (ttc <= 0) throw new UserFacingError("Rien à facturer.");
  const taux = cfg.TVA_TAUX || 0;
  const ht = type === "caution" ? ttc : Math.round((ttc / (1 + taux / 100)) * 100) / 100;
  const numero = await prochainNumero("FAC");
  const f = await prisma.facture.create({
    data: {
      numero,
      reservationId: r.id,
      organisationId: r.organisationId,
      type,
      libelle: `${FACTURE_TYPES[type]} · ${r.espace.name} · ${plage(r.startAt, r.endAt)}`,
      montantHt: ht,
      tva: type === "caution" ? 0 : Math.round((ttc - ht) * 100) / 100,
      montantTtc: ttc,
      dueAt: new Date(Date.now() + dueDays * 86_400_000),
      createdBy: acteur,
    },
  });
  await prisma.reservationHistory.create({
    data: {
      reservationId: r.id,
      action: `${FACTURE_TYPES[type]} ${numero} émise`,
      comment: montant(ttc),
      performedBy: acteur,
    },
  });
  await auditRecord("emission facture", `${numero} · ${montant(ttc)}`, "paiements", acteur);
  try {
    const pdf = await pdfFacture(f.id);
    if (pdf) {
      const doc = await enregistrerPdf(
        "reservation",
        r.id,
        `${numero}.pdf`,
        pdf,
        "facture",
        `${FACTURE_TYPES[type]} ${numero}`,
      );
      await prisma.facture.update({ where: { id: f.id }, data: { pdfDocumentId: doc.id } });
    }
  } catch (e) {
    console.error("[facture] PDF impossible :", e);
  }
  await courrielUsager(r, "facture_emise", {
    type_facture: FACTURE_TYPES[type].toLowerCase(),
    numero_facture: numero,
    montant: montant(ttc),
    echeance: f.dueAt ? dateCourte(f.dueAt) : "—",
    modalites:
      "règlement en régie, par chèque à l'ordre du Trésor public ou par virement (coordonnées sur la facture).",
  });
  return f;
}

/** Enregistre un paiement ; solde la facture si le total est atteint. */
export async function enregistrerPaiement(
  factureId: number,
  montantPaye: number,
  mode: string,
  reference: string | null,
  acteur: { id: string; name: string },
  paidAt: Date = new Date(),
) {
  const f = await chargerFacture(factureId);
  if (!f) throw new UserFacingError("Facture introuvable.");
  if (f.status === "annulee") throw new UserFacingError("Facture annulée.");
  if (!(mode in PAIEMENT_MODES)) throw new UserFacingError("Mode de paiement inconnu.");
  if (!(montantPaye > 0)) throw new UserFacingError("Montant invalide.");
  await prisma.paiement.create({
    data: { factureId, montant: montantPaye, mode, reference, paidAt, recordedById: acteur.id },
  });
  const total = f.paiements.reduce((s, p) => s + p.montant, 0) + montantPaye;
  const soldee = total + 0.005 >= f.montantTtc;
  if (soldee)
    await prisma.facture.update({
      where: { id: factureId },
      data: { status: "payee", paidAt },
    });
  await auditRecord(
    "paiement",
    `${f.numero} · ${montant(montantPaye)} (${PAIEMENT_MODES[mode]})`,
    "paiements",
    acteur.name,
  );
  if (f.reservationId) {
    await prisma.reservationHistory.create({
      data: {
        reservationId: f.reservationId,
        action: `Paiement reçu · ${f.numero}`,
        comment: `${montant(montantPaye)} · ${PAIEMENT_MODES[mode]}${soldee ? " · facture soldée" : ""}`,
        performedBy: acteur.name,
      },
    });
    const r = await chargerReservation(f.reservationId);
    if (r) {
      await courrielUsager(r, "paiement_recu", {
        numero_facture: f.numero,
        montant: montant(montantPaye),
      });
      if (r.userId)
        await notifier(
          r.userId,
          "paiement",
          `Paiement reçu · ${f.numero}`,
          montant(montantPaye),
          `/portail/mes-reservations/${r.id}`,
        );
      // L'acompte réglé confirme un dossier signé.
      if (soldee && f.type === "acompte" && r.status === "signee") {
        const { changerStatut } = await import("@/server/reservations");
        await changerStatut(
          r.id,
          "confirmee",
          { name: acteur.name, isAgent: true },
          { parSysteme: true },
        );
      }
    }
  }
}

export async function annulerFacture(factureId: number, acteur: string): Promise<void> {
  const f = await prisma.facture.findUnique({ where: { id: factureId } });
  if (!f) throw new UserFacingError("Facture introuvable.");
  await prisma.facture.update({ where: { id: factureId }, data: { status: "annulee" } });
  await auditRecord("annulation facture", f.numero, "paiements", acteur);
}

function p(s: string | null | undefined): string {
  return escapeHtml(s ?? "");
}

/** Le PDF d'une facture. */
export async function pdfFacture(id: number): Promise<Buffer | null> {
  const f = await chargerFacture(id);
  if (!f) return null;
  const cfg = await getSettings();
  const r = f.reservation;
  const client = f.organisation ?? r?.organisation;
  const contact = r?.user;
  const paye = f.paiements.reduce((s, x) => s + x.montant, 0);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS_EDITION}</style></head><body>
<div class="entete"><div>${cfg.COLLECTIVITE_LOGO ? `<img class="logo" src="${cfg.COLLECTIVITE_LOGO}" alt="">` : ""}<div class="coll">${p(cfg.COLLECTIVITE_NOM)}</div><div class="muted">${p(cfg.COLLECTIVITE_ADRESSE)}</div></div>
<div class="doc"><strong>${FACTURE_TYPES[f.type] ?? "Facture"}</strong><br>N° ${p(f.numero)}<br>Émise le ${dateCourte(f.createdAt)}${f.dueAt ? `<br>Échéance ${dateCourte(f.dueAt)}` : ""}</div></div>
<div class="grille"><div class="bloc"><span class="muted">Débiteur</span><br><strong>${client ? p(client.name) : contact ? `${p(contact.firstName)} ${p(contact.lastName)}` : "—"}</strong>${client?.address ? `<br>${p(client.address)}<br>${p(client.postalCode)} ${p(client.city)}` : ""}${contact?.email ? `<br>${p(contact.email)}` : ""}</div>
<div class="bloc"><span class="muted">Objet</span><br>${r ? `Réservation <strong>${p(r.numero)}</strong><br>${p(r.espace.name)}, ${p(r.espace.site.name)}<br>${plage(r.startAt, r.endAt)}` : p(f.libelle)}</div></div>
<table><thead><tr><th>Désignation</th><th class="num">Montant HT</th><th class="num">TVA</th><th class="num">Montant TTC</th></tr></thead><tbody>
<tr><td>${p(f.libelle)}</td><td class="num">${montant(f.montantHt)}</td><td class="num">${montant(f.tva)}</td><td class="num">${montant(f.montantTtc)}</td></tr>
<tr class="total"><td colspan="3" class="num">Net à payer</td><td class="num">${montant(f.montantTtc)}</td></tr>
${paye ? `<tr><td colspan="3" class="num">Déjà réglé</td><td class="num">${montant(paye)}</td></tr><tr><td colspan="3" class="num">Reste dû</td><td class="num">${montant(Math.max(0, f.montantTtc - paye))}</td></tr>` : ""}
</tbody></table>
${f.status === "payee" ? `<p style="margin-top:12px"><span class="cachet">Acquittée le ${f.paidAt ? dateCourte(f.paidAt) : ""}</span></p>` : ""}
<h2>Modalités de règlement</h2>
<p>En régie auprès des services de la collectivité, par chèque à l'ordre du Trésor public, ou par virement en rappelant le numéro ${p(f.numero)}.</p>
${f.type === "caution" ? '<p class="muted">Caution restituée après état des lieux de sortie, sous réserve de dégradations.</p>' : ""}
<div class="pied">${p(cfg.COLLECTIVITE_NOM)} · ${p(f.numero)} · CityRésa</div>
</body></html>`;
  return htmlVersPdf(html);
}
