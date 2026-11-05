/**
 * Avenant à une convention signée : quand les créneaux d'un dossier changent après la
 * signature, un avenant (PDF accroché au dossier) rappelle la convention, énonce la
 * modification et la nouvelle liste des créneaux, puis est signé à son tour par l'usager
 * (code à usage unique, comme la convention) ou sur papier par un agent.
 */
import type { Avenant } from "@/generated/prisma/client";
import { ORGANISATION_TYPES } from "@/lib/constantes";
import { nomRepresentant, qualiteRepresentant } from "@/lib/dossier-usager";
import { dateCourte, dateHeure, montant, plage } from "@/lib/libelles";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { codeNumerique, hmacSign, timingSafeEqualStr } from "@/server/crypto";
import { prisma } from "@/server/db";
import { enregistrerPdf } from "@/server/documents";
import { escapeHtml } from "@/server/email-templates";
import { UserFacingError } from "@/server/errors";
import { enabledIn } from "@/server/features";
import { type Attachment, envoyerDepuisModele } from "@/server/mailer";
import { notifierAgents } from "@/server/notifications";
import { CSS_EDITION, htmlVersPdf } from "@/server/pdf";
import {
  chargerReservation,
  courrielUsager,
  deviser,
  type ReservationComplete,
  variablesDossier,
} from "@/server/reservations";
import { envoyerSms, normaliserMobile } from "@/server/sms";

const MAX_ESSAIS = 5;

function p(s: string | null | undefined): string {
  return escapeHtml(s ?? "");
}

function empreinte(avenantId: number, code: string): string {
  return hmacSign("signature-avenant", `${avenantId}:${code}`);
}

/** « n°2 » */
export function libelleAvenant(a: { numero: number }): string {
  return `n°${a.numero}`;
}

/** Le HTML complet d'un avenant : parties, convention de référence, objet, créneaux, montant. */
export async function htmlAvenant(r: ReservationComplete, a: Avenant): Promise<string> {
  const cfg = await getSettings();
  const creneaux = r.creneaux.filter((c) => c.status === "prevu");
  const devis = await deviser(
    r.espaceId,
    r.organisation?.profilId ?? null,
    creneaux,
    r.options.map((o) => ({ optionId: o.optionId, quantite: o.quantite })),
    r.materiels.map((m) => ({ materielId: m.materielId, quantite: m.quantite })),
    r.gratuit,
  );
  const occupant = r.organisation
    ? `${p(r.organisation.name)} (${ORGANISATION_TYPES[r.organisation.type] ?? r.organisation.type})${nomRepresentant(r.organisation) ? `, représentée par ${p(nomRepresentant(r.organisation))}, ${p(qualiteRepresentant(r.organisation.type).toLowerCase())}` : ""}`
    : r.user
      ? `${p(r.user.firstName)} ${p(r.user.lastName)}`
      : "—";
  const lignesObjet = a.objet
    .replace(/^Créneaux modifiés\s*:\s*/, "")
    .split(" ; ")
    .filter(Boolean);
  const signature = a.signedAt
    ? `<div class="signature"><strong>L'occupant</strong><br><span class="cachet">Signé électroniquement</span><br><small>par ${p(a.signerName)} le ${dateHeure(a.signedAt)}${a.signerIp ? ` (IP ${p(a.signerIp)})` : ""}</small></div>`
    : `<div class="signature"><strong>L'occupant</strong><br><small class="muted">Signature en attente</small></div>`;
  const titre = `Avenant ${libelleAvenant(a)} à la convention de mise à disposition`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS_EDITION}</style></head><body>
<div class="entete"><div>${cfg.COLLECTIVITE_LOGO ? `<img class="logo" src="${cfg.COLLECTIVITE_LOGO}" alt="">` : ""}<div class="coll">${p(cfg.COLLECTIVITE_NOM)}</div><div class="muted">${p(cfg.COLLECTIVITE_ADRESSE)}</div></div>
<div class="doc"><strong>Avenant ${libelleAvenant(a)}</strong><br>Convention N° ${p(r.numero)}<br>Édité le ${dateCourte(a.createdAt)}</div></div>
<h1>${titre}</h1>
<p class="muted">${p(r.espace.name)} · ${p(r.espace.site.name)} · convention N° ${p(r.numero)}${r.signedAt ? ` signée le ${dateCourte(r.signedAt)}${r.signerName ? ` par ${p(r.signerName)}` : ""}` : ""}</p>

<h2>Entre</h2>
<p><strong>${p(cfg.COLLECTIVITE_NOM)}</strong>, représentée par ${p(cfg.COLLECTIVITE_SIGNATAIRE || cfg.COLLECTIVITE_SIGNATAIRE_QUALITE)}${cfg.COLLECTIVITE_SIGNATAIRE ? `, ${p(cfg.COLLECTIVITE_SIGNATAIRE_QUALITE)}` : ""}, ci-après « la collectivité »,</p>
<p>et <strong>${occupant}</strong>, ci-après « l'occupant », parties à la convention N° ${p(r.numero)} relative à « ${p(r.title)} ».</p>

<h2>Article 1 — Objet</h2>
<p>Les parties conviennent de modifier les créneaux de mise à disposition comme suit :</p>
<ul>${lignesObjet.map((l) => `<li>${p(l)}</li>`).join("")}</ul>

<h2>Article 2 — Créneaux après avenant (${creneaux.length})</h2>
<table><thead><tr><th>Date et horaires</th><th class="num">Durée</th></tr></thead><tbody>
${creneaux.map((c) => `<tr><td>${plage(c.startAt, c.endAt)}</td><td class="num">${Math.round(((c.endAt.getTime() - c.startAt.getTime()) / 36e5) * 10) / 10} h</td></tr>`).join("")}
</tbody></table>

<h2>Article 3 — Conditions financières</h2>
<p>${r.gratuit ? "La mise à disposition demeure consentie à titre gracieux." : `La redevance est portée à <strong>${montant(devis.ttc)} TTC</strong>${devis.acompte ? ` (dont acompte ${montant(devis.acompte)})` : ""}, selon la grille appliquée à la convention.`}</p>
<p>Les autres clauses de la convention demeurent inchangées.</p>

<div class="signatures">
<div class="signature"><strong>Pour la collectivité</strong><br>${p(cfg.COLLECTIVITE_SIGNATAIRE_QUALITE)}${cfg.COLLECTIVITE_SIGNATAIRE ? `<br>${p(cfg.COLLECTIVITE_SIGNATAIRE)}` : ""}<br><small class="muted">Édité le ${dateCourte(a.createdAt)}${a.createdBy ? ` par ${p(a.createdBy)}` : ""}</small></div>
${signature}
</div>
<div class="pied">${p(cfg.COLLECTIVITE_NOM)} · Avenant ${libelleAvenant(a)} · Convention ${p(r.numero)} · CityRésa</div>
</body></html>`;
}

/** (Re)produit le PDF de l'avenant et le remplace dans les pièces du dossier. */
async function ecrirePdfAvenant(r: ReservationComplete, a: Avenant): Promise<number> {
  const pdf = await htmlVersPdf(await htmlAvenant(r, a));
  if (a.documentId) await prisma.document.delete({ where: { id: a.documentId } }).catch(() => {});
  const doc = await enregistrerPdf(
    "reservation",
    r.id,
    `avenant-${a.numero}-${r.numero}${a.signedAt ? "-signe" : ""}.pdf`,
    pdf,
    "avenant",
    `Avenant ${libelleAvenant(a)} ${a.signedAt ? "signé" : "à signer"}`,
  );
  await prisma.avenant.update({ where: { id: a.id }, data: { documentId: doc.id } });
  return doc.id;
}

/** Le PDF d'un avenant, pour le joindre à un courriel. */
async function pieceJointe(a: Avenant, numero: string): Promise<Attachment[]> {
  if (!a.documentId) return [];
  const doc = await prisma.document.findUnique({
    where: { id: a.documentId },
    include: { content: true },
  });
  if (!doc?.content) return [];
  return [
    {
      filename: `avenant-${a.numero}-${numero}.pdf`,
      content: Buffer.from(doc.content.data),
      contentType: "application/pdf",
    },
  ];
}

/** Courriel « Avenant à signer » (PDF joint) et notification à l'usager. */
export async function courrielAvenantASigner(r: ReservationComplete, a: Avenant): Promise<void> {
  const cfg = await getSettings();
  await courrielUsager(
    r,
    "avenant_a_signer",
    {
      avenant: libelleAvenant(a),
      objet: a.objet,
      suite: enabledIn(cfg, "signature")
        ? "Signez-le en ligne depuis votre dossier, comme la convention : recevez un code, puis saisissez-le avec votre nom."
        : "Merci de nous le retourner signé ; nos services l'enregistreront sur votre dossier.",
    },
    await pieceJointe(a, r.numero),
  );
}

/**
 * Crée l'avenant suivant du dossier (objet : ce qui change), édite son PDF, l'historise
 * et l'envoie à l'usager pour signature.
 */
export async function genererAvenant(
  r: ReservationComplete,
  objet: string,
  acteur: string,
): Promise<Avenant> {
  const dernier = await prisma.avenant.aggregate({
    where: { reservationId: r.id },
    _max: { numero: true },
  });
  const numero = (dernier._max.numero ?? 0) + 1;
  let a = await prisma.avenant.create({
    data: { reservationId: r.id, numero, objet: objet.slice(0, 4000), createdBy: acteur },
  });
  await ecrirePdfAvenant(r, a);
  a = (await prisma.avenant.findUniqueOrThrow({ where: { id: a.id } })) as Avenant;
  await prisma.reservationHistory.create({
    data: {
      reservationId: r.id,
      action: `Avenant ${libelleAvenant(a)} édité`,
      comment: objet,
      performedBy: acteur,
    },
  });
  await courrielAvenantASigner(r, a);
  return a;
}

async function avenantDe(reservationId: number, avenantId: number): Promise<Avenant> {
  const a = await prisma.avenant.findFirst({ where: { id: avenantId, reservationId } });
  if (!a) throw new UserFacingError("Avenant introuvable.");
  return a;
}

/** Envoie un code de signature pour un avenant. Renvoie le canal utilisé. */
export async function demanderCodeAvenant(
  reservationId: number,
  avenantId: number,
  telephone: string | null,
): Promise<"sms" | "email"> {
  const cfg = await getSettings();
  if (!enabledIn(cfg, "signature"))
    throw new UserFacingError("La signature électronique est désactivée.");
  const r = await chargerReservation(reservationId);
  if (!r) throw new UserFacingError("Réservation introuvable.");
  const a = await avenantDe(r.id, avenantId);
  if (a.signedAt) throw new UserFacingError("Cet avenant est déjà signé.");
  const code = codeNumerique(6);
  const validite = cfg.SIGNATURE_VALIDITE_HEURES || 72;
  const expires = new Date(Date.now() + validite * 3_600_000);
  const mobile = normaliserMobile(telephone ?? r.user?.phone ?? r.organisation?.phone);
  if (mobile && r.userId && telephone && !r.user?.phone)
    await prisma.user.update({ where: { id: r.userId }, data: { phone: mobile } });
  let canal: "sms" | "email" = "email";
  if (cfg.SMS_ENABLED && mobile) {
    const ok = await envoyerSms(
      mobile,
      `${cfg.COLLECTIVITE_NOM} : votre code de signature de l'avenant ${libelleAvenant(a)} à la convention ${r.numero} est ${code} (valable ${validite} h).`,
    );
    if (ok) canal = "sms";
  }
  if (canal === "email") {
    await envoyerDepuisModele(
      "avenant_code",
      r.user?.email ?? r.organisation?.email ?? "",
      {
        ...(await variablesDossier(r)),
        avenant: libelleAvenant(a),
        code,
        validite: `${validite} h`,
      },
      { reservationId: r.id },
    );
  }
  await prisma.avenant.update({
    where: { id: a.id },
    data: {
      signatureChannel: canal,
      signatureSentAt: new Date(),
      signatureCodeHash: empreinte(a.id, code),
      signatureExpiresAt: expires,
      signatureAttempts: 0,
    },
  });
  await prisma.reservationHistory.create({
    data: {
      reservationId: r.id,
      action: `Code de signature envoyé (avenant ${libelleAvenant(a)})`,
      comment: canal === "sms" ? `par SMS au ${mobile}` : "par courriel",
      performedBy: "système",
    },
  });
  return canal;
}

/** Après signature (en ligne ou papier) : PDF signé, historique, courriels, notification. */
async function apresSignature(
  r: ReservationComplete,
  a: Avenant,
  nom: string,
  mode: "en ligne" | "sur papier",
): Promise<void> {
  const signe = (await chargerReservation(r.id)) ?? r;
  await ecrirePdfAvenant(signe, a).catch((e) => console.error("[avenant signé]", e));
  await prisma.reservationHistory.create({
    data: {
      reservationId: r.id,
      action: `Avenant ${libelleAvenant(a)} signé ${mode}`,
      comment: `par ${nom}`,
      performedBy: mode === "en ligne" ? nom : (a.createdBy ?? nom),
    },
  });
  await courrielUsager(signe, "avenant_signe", {
    avenant: libelleAvenant(a),
    date_signature: dateHeure(a.signedAt ?? new Date()),
  });
}

/** Vérifie le code et signe l'avenant. */
export async function signerAvenant(
  reservationId: number,
  avenantId: number,
  code: string,
  signerName: string,
  ip: string,
): Promise<void> {
  const r = await chargerReservation(reservationId);
  if (!r) throw new UserFacingError("Réservation introuvable.");
  const a = await avenantDe(r.id, avenantId);
  if (a.signedAt) throw new UserFacingError("Cet avenant est déjà signé.");
  if (!a.signatureCodeHash)
    throw new UserFacingError("Aucune signature en attente sur cet avenant.");
  if (a.signatureExpiresAt && a.signatureExpiresAt < new Date())
    throw new UserFacingError("Le code a expiré : demandez-en un nouveau.");
  if (a.signatureAttempts >= MAX_ESSAIS)
    throw new UserFacingError("Trop d'essais : demandez un nouveau code.");
  const nom = signerName.trim();
  if (nom.length < 3) throw new UserFacingError("Indiquez votre nom complet pour signer.");
  const saisi = code.replace(/\s+/g, "");
  if (!timingSafeEqualStr(empreinte(a.id, saisi), a.signatureCodeHash)) {
    await prisma.avenant.update({
      where: { id: a.id },
      data: { signatureAttempts: { increment: 1 } },
    });
    throw new UserFacingError(
      `Code incorrect (${MAX_ESSAIS - a.signatureAttempts - 1} essai(s) restant(s)).`,
    );
  }
  const signe = await prisma.avenant.update({
    where: { id: a.id },
    data: {
      signedAt: new Date(),
      signerName: nom,
      signerIp: ip.slice(0, 64),
      signatureCodeHash: null,
    },
  });
  await apresSignature(r, signe, nom, "en ligne");
  await auditRecord(
    "signature avenant",
    `${r.numero} avenant ${libelleAvenant(a)} par ${nom}`,
    "reservations",
    r.user?.email ?? nom,
  );
  await notifierAgents(
    r.espaceId,
    "signature",
    `Avenant ${libelleAvenant(a)} de ${r.numero} signé`,
    `par ${nom}`,
    `/reservations/${r.id}`,
  );
}

/** Un agent enregistre un avenant signé sur papier. */
export async function signerAvenantPapier(
  reservationId: number,
  avenantId: number,
  signerName: string,
  acteur: string,
): Promise<Avenant> {
  const r = await chargerReservation(reservationId);
  if (!r) throw new UserFacingError("Réservation introuvable.");
  const a = await avenantDe(r.id, avenantId);
  if (a.signedAt) throw new UserFacingError("Cet avenant est déjà signé.");
  const nom = signerName.trim();
  if (nom.length < 3) throw new UserFacingError("Indiquez le nom complet du signataire.");
  const signe = await prisma.avenant.update({
    where: { id: a.id },
    data: { signedAt: new Date(), signerName: nom, signerIp: null, signatureCodeHash: null },
  });
  await apresSignature(r, { ...signe, createdBy: acteur }, nom, "sur papier");
  return signe;
}
