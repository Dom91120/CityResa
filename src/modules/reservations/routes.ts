/**
 * Les gestes d'écriture sur un dossier de réservation (back-office) : création,
 * modification, décision (statut), fil, assignation, créneaux, convention, signature
 * papier, factures, montants, suppression. Chaque geste vérifie le périmètre de l'agent
 * (`user.gereEspace`) et transforme toute UserFacingError en message flash.
 */
import { RESERVATION_STATUS, type ReservationStatus } from "@/lib/constantes";
import { reglesAuCreneau, verifierRegles } from "@/lib/creneaux";
import { champ, champOuNull, coche, idOuNull, parseFloat_, parseInt_ } from "@/lib/forms-util";
import { montant, plage } from "@/lib/libelles";
import { lirePortee, phraseDeplacement } from "@/lib/serie";
import { lireChoix, lireCreneau, lireDemande } from "@/modules/reservations/formulaire";
import { auditRecord } from "@/server/audit";
import { courrielAvenantASigner, libelleAvenant, signerAvenantPapier } from "@/server/avenant";
import {
  enregistrerEtatDesLieux,
  marquerCautionEncaissee,
  restituerCaution,
  retenirCaution,
  validerRetenue,
} from "@/server/caution";
import { genererConvention } from "@/server/convention";
import { prisma } from "@/server/db";
import { type FichierLu, lireFichier } from "@/server/documents";
import { UserFacingError } from "@/server/errors";
import { creerFacture } from "@/server/factures";
import { enabledIn } from "@/server/features";
import { type CurrentUser, requireAdmin, requireEdit } from "@/server/guards";
import { horairesSaisonDe } from "@/server/horaires";
import { pasTrouve, redirigerAvecMessage } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";
import { notifier } from "@/server/notifications";
import {
  ajouterMessage,
  changerStatut,
  chargerReservation,
  courrielUsager,
  creerReservation,
  historiser,
  majBornes,
  type ReservationComplete,
  recalculerMontants,
  stockDisponible,
  verifierDisponibilite,
} from "@/server/reservations";
import { deplacerSerie } from "@/server/serie";

// ── Création ──

/** L'adresse de retour vers le formulaire de saisie, avec ce qui peut être conservé. */
function retourSaisie(form: FormData): string {
  const p = new URLSearchParams();
  for (const k of [
    "espace_id",
    "date",
    "heure_debut",
    "heure_fin",
    "organisation_id",
    "title",
    "participants",
  ]) {
    const v = champ(form, k);
    if (v) p.set(k === "espace_id" ? "espace" : k, v);
  }
  const s = p.toString();
  return `/reservations/nouvelle${s ? `?${s}` : ""}`;
}

export async function creer(form: FormData): Promise<Response> {
  const user = await requireEdit("reservations");
  const retour = retourSaisie(form);
  try {
    const entree = lireDemande(form, {
      organisationId: null,
      userId: user.id,
      source: "backoffice",
      agent: true,
    });
    if (!user.gereEspace(entree.espaceId))
      return redirigerAvecMessage(retour, "Cet espace n'est pas dans votre périmètre.", "danger");
    if (!entree.organisationId)
      return redirigerAvecMessage(
        retour,
        "Choisissez l'usager pour lequel vous réservez.",
        "danger",
      );
    const r = await creerReservation(entree, user.name);
    const n = r.creneaux.length;
    return redirigerAvecMessage(
      `/reservations/${r.id}`,
      `Réservation ${r.numero} créée · ${RESERVATION_STATUS[r.status as ReservationStatus].label}${n > 1 ? ` · ${n} créneaux` : ""}.`,
      "success",
    );
  } catch (e) {
    if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
    throw e;
  }
}

// ── Gestes sur un dossier ──

type Contexte = { user: CurrentUser; r: ReservationComplete; fiche: string };

/** Remplace les options et le matériel du dossier, puis recalcule montants et lignes. */
async function appliquerChoix(
  r: ReservationComplete,
  options: { id: number; quantite: number }[],
  materiels: { id: number; quantite: number }[],
  gratuit: boolean,
  gratuitMotif: string | null = null,
): Promise<void> {
  if (gratuit && !gratuitMotif?.trim())
    throw new UserFacingError(
      "Indiquez le fondement de la gratuité (délibération, convention, intérêt général…).",
    );
  const [opts, mats] = await Promise.all([
    options.length
      ? prisma.option.findMany({ where: { id: { in: options.map((o) => o.id) } } })
      : [],
    materiels.length
      ? prisma.materiel.findMany({ where: { id: { in: materiels.map((m) => m.id) } } })
      : [],
  ]);
  for (const m of materiels) {
    const mat = mats.find((x) => x.id === m.id);
    if (!mat) continue;
    const dispo = await stockDisponible(m.id, r.startAt, r.endAt, r.id);
    if (m.quantite > dispo)
      throw new UserFacingError(`Stock insuffisant pour « ${mat.name} » : ${dispo} disponible(s).`);
  }
  await prisma.$transaction([
    prisma.reservationOption.deleteMany({ where: { reservationId: r.id } }),
    prisma.reservationMateriel.deleteMany({ where: { reservationId: r.id } }),
    ...options
      .filter((o) => opts.some((x) => x.id === o.id))
      .map((o) =>
        prisma.reservationOption.create({
          data: { reservationId: r.id, optionId: o.id, quantite: o.quantite },
        }),
      ),
    ...materiels
      .filter((m) => mats.some((x) => x.id === m.id))
      .map((m) =>
        prisma.reservationMateriel.create({
          data: { reservationId: r.id, materielId: m.id, quantite: m.quantite },
        }),
      ),
  ]);
  const devis = await recalculerMontants(r.id, gratuit, gratuitMotif);
  await Promise.all([
    ...opts.map((o) =>
      prisma.reservationOption.updateMany({
        where: { reservationId: r.id, optionId: o.id },
        data: {
          montant:
            devis.lignes.find((l) => l.type === "option" && l.libelle === o.label)?.montant ?? 0,
        },
      }),
    ),
    ...mats.map((m) =>
      prisma.reservationMateriel.updateMany({
        where: { reservationId: r.id, materielId: m.id },
        data: {
          montant:
            devis.lignes.find((l) => l.type === "materiel" && l.libelle === m.name)?.montant ?? 0,
        },
      }),
    ),
  ]);
}

async function modifier({ user, r, fiche }: Contexte, form: FormData): Promise<Response> {
  const title = champ(form, "title");
  if (!title) throw new UserFacingError("Indiquez l'objet de la réservation.");
  const organisationId = idOuNull(form, "organisation_id");
  if (organisationId) {
    const org = await prisma.organisation.findUnique({ where: { id: organisationId } });
    if (!org) throw new UserFacingError("Organisation introuvable.");
  }
  const agentId = champOuNull(form, "agent_id");
  if (agentId) {
    const a = await prisma.user.findUnique({ where: { id: agentId } });
    if (a?.kind !== "agent") throw new UserFacingError("Agent introuvable.");
  }
  await prisma.reservation.update({
    where: { id: r.id },
    data: {
      title: title.slice(0, 160),
      natureId: idOuNull(form, "nature_id"),
      description: champOuNull(form, "description"),
      participants: parseInt_(form.get("participants"), null, 0),
      isPublicEvent: coche(form, "is_public_event"),
      organisationId,
      agentId,
      internalNotes: champOuNull(form, "internal_notes"),
    },
  });
  await recalculerMontants(r.id);
  await historiser(r.id, "Dossier modifié", null, user.name);
  await auditRecord("modification reservation", r.numero, "reservations", user.email);
  return redirigerAvecMessage(fiche, "Réservation modifiée.", "success");
}

async function statut({ user, r, fiche }: Contexte, form: FormData): Promise<Response> {
  const nouveau = champ(form, "statut") as ReservationStatus;
  if (!(nouveau in RESERVATION_STATUS)) throw new UserFacingError("Statut inconnu.");
  const motif = champOuNull(form, "motif");
  const message = champOuNull(form, "message");
  if (nouveau === "refusee" && !motif)
    throw new UserFacingError("Indiquez le motif du refus : il est transmis à l'usager.");
  if (nouveau === "annulee" && !motif)
    throw new UserFacingError("Indiquez le motif de l'annulation.");
  if (nouveau === "en_traitement") {
    if (!message) throw new UserFacingError("Précisez les informations attendues de l'usager.");
    if (r.status === "en_traitement") {
      await ajouterMessage(r.id, user, message, false);
      return redirigerAvecMessage(`${fiche}#discussion`, "Message envoyé à l'usager.", "success");
    }
  }
  if (nouveau === "acceptee" || (nouveau === "confirmee" && coche(form, "appliquer_choix"))) {
    await appliquerChoix(
      r,
      lireChoix(form, "option"),
      lireChoix(form, "materiel"),
      coche(form, "gratuit"),
      champOuNull(form, "gratuit_motif"),
    );
  }
  const maj = await changerStatut(r.id, nouveau, user, {
    motif: motif ?? undefined,
    message: message ?? undefined,
    sansFrais: coche(form, "sans_frais"),
  });
  if (nouveau === "acceptee" && message) await ajouterMessage(r.id, user, message, false);
  const label = RESERVATION_STATUS[maj.status as ReservationStatus].label;
  const suite =
    maj.status === "acceptee"
      ? " La convention a été générée et l'usager invité à la signer."
      : maj.status === "confirmee"
        ? " L'espace est réservé ; l'usager est prévenu."
        : maj.status === "refusee"
          ? " L'usager est prévenu du refus."
          : "";
  return redirigerAvecMessage(fiche, `Dossier ${r.numero} : ${label}.${suite}`, "success");
}

async function message({ user, r, fiche }: Contexte, form: FormData): Promise<Response> {
  const interne = coche(form, "is_internal");
  await ajouterMessage(r.id, user, champ(form, "body"), interne);
  return redirigerAvecMessage(
    `${fiche}#discussion`,
    interne ? "Note interne enregistrée." : "Message envoyé à l'usager.",
    "success",
  );
}

async function assigner({ user, r, fiche }: Contexte, form: FormData): Promise<Response> {
  const agentId = champOuNull(form, "agent_id");
  let nom = "";
  if (agentId) {
    const a = await prisma.user.findUnique({ where: { id: agentId } });
    if (a?.kind !== "agent" || !a.isActive) throw new UserFacingError("Agent introuvable.");
    nom = `${a.firstName} ${a.lastName}`.trim() || a.email;
  }
  if ((r.agentId ?? null) === agentId)
    return redirigerAvecMessage(fiche, "Assignation inchangée.", "info");
  await prisma.reservation.update({ where: { id: r.id }, data: { agentId } });
  await historiser(r.id, agentId ? `Assigné à ${nom}` : "Assignation retirée", null, user.name);
  if (agentId && agentId !== user.id)
    await notifier(agentId, "reservation", `Dossier ${r.numero} assigné`, r.title, fiche);
  return redirigerAvecMessage(
    fiche,
    agentId ? `Dossier assigné à ${nom}.` : "Assignation retirée.",
    "success",
  );
}

async function ajouterCreneau({ user, r, fiche }: Contexte, form: FormData): Promise<Response> {
  const i = lireCreneau(form);
  const regles = reglesAuCreneau(r.espace, await horairesSaisonDe(r.espaceId), i);
  const erreurs = verifierRegles(regles, i, new Date(), { ignorerDelai: true });
  if (erreurs.length) throw new UserFacingError(erreurs.join(" "));
  const conflits = await verifierDisponibilite(r.espace, [i], r.id);
  if (conflits.length)
    throw new UserFacingError(
      `Créneau indisponible : ${plage(i.startAt, i.endAt)} chevauche « ${conflits[0].existant.libelle} ».`,
    );
  await prisma.creneau.create({
    data: { reservationId: r.id, espaceId: r.espaceId, startAt: i.startAt, endAt: i.endAt },
  });
  await majBornes(r.id);
  await recalculerMontants(r.id);
  await historiser(r.id, "Créneau ajouté", plage(i.startAt, i.endAt), user.name);
  return redirigerAvecMessage(fiche, `Créneau ajouté : ${plage(i.startAt, i.endAt)}.`, "success");
}

async function annulerCreneau({ user, r, fiche }: Contexte, cid: number): Promise<Response> {
  const c = r.creneaux.find((x) => x.id === cid);
  if (!c) return pasTrouve();
  if (c.status !== "prevu") throw new UserFacingError("Ce créneau est déjà annulé.");
  const restants = r.creneaux.filter((x) => x.status === "prevu" && x.id !== cid).length;
  if (!restants)
    throw new UserFacingError(
      "C'est le dernier créneau du dossier : annulez plutôt la réservation.",
    );
  await prisma.creneau.update({ where: { id: cid }, data: { status: "annule" } });
  await majBornes(r.id);
  await recalculerMontants(r.id);
  await historiser(r.id, "Créneau annulé", plage(c.startAt, c.endAt), user.name);
  return redirigerAvecMessage(fiche, `Créneau du ${plage(c.startAt, c.endAt)} annulé.`, "success");
}

/**
 * Déplace un créneau (et, selon la portée, les suivants ou toute la série). Une erreur ramène
 * à la page de modification, pas à la fiche, pour corriger la saisie.
 */
async function modifierCreneau(
  { user, r, fiche }: Contexte,
  cid: number,
  form: FormData,
): Promise<Response> {
  const page = `${fiche}/creneaux/${cid}/modifier`;
  if (!r.creneaux.some((c) => c.id === cid)) return pasTrouve();
  try {
    const portee = lirePortee(champ(form, "portee"));
    const prevenir = coche(form, "prevenir");
    const b = await deplacerSerie({
      r,
      cibleId: cid,
      nouveau: lireCreneau(form),
      portee,
      prevenir,
      acteur: { email: user.email, name: user.name },
    });
    const suite =
      b.convention === "regeneree"
        ? " La convention a été régénérée."
        : b.convention === "avenant"
          ? " La convention était signée : un avenant a été édité et envoyé à l'usager pour signature."
          : "";
    return redirigerAvecMessage(
      fiche,
      `${phraseDeplacement(b.nb, portee, prevenir)}${suite}`,
      "success",
    );
  } catch (e) {
    if (e instanceof UserFacingError) return redirigerAvecMessage(page, e.message, "danger");
    throw e;
  }
}

/** Relance l'usager pour la signature d'un avenant (courriel, PDF joint). */
async function relancerAvenant({ user, r, fiche }: Contexte, aid: number): Promise<Response> {
  const a = r.avenants.find((x) => x.id === aid);
  if (!a) return pasTrouve();
  if (a.signedAt) throw new UserFacingError("Cet avenant est déjà signé.");
  const to = r.user?.email ?? r.organisation?.email;
  if (!to) throw new UserFacingError("Aucune adresse de courriel connue pour l'usager.");
  await courrielAvenantASigner(r, a);
  await historiser(
    r.id,
    `Relance pour signature (avenant ${libelleAvenant(a)})`,
    `courriel à ${to}`,
    user.name,
  );
  return redirigerAvecMessage(fiche, `Relance envoyée à ${to}.`, "success");
}

/** Un agent enregistre la signature papier d'un avenant. */
async function avenantPapier(
  { user, r, fiche }: Contexte,
  aid: number,
  form: FormData,
): Promise<Response> {
  const a = await signerAvenantPapier(r.id, aid, champ(form, "signer_name"), user.name);
  await auditRecord(
    "signature avenant (papier)",
    `${r.numero} avenant ${libelleAvenant(a)} par ${a.signerName}`,
    "reservations",
    user.email,
  );
  return redirigerAvecMessage(
    fiche,
    `Avenant ${libelleAvenant(a)} marqué signé par ${a.signerName}.`,
    "success",
  );
}

async function regenererConvention({ user, r, fiche }: Contexte): Promise<Response> {
  await genererConvention(r, user.name);
  return redirigerAvecMessage(fiche, "Convention régénérée.", "success");
}

async function relancerSignature({ user, r, fiche }: Contexte): Promise<Response> {
  if (r.status !== "acceptee")
    throw new UserFacingError("Ce dossier n'est pas en attente de signature.");
  const to = r.user?.email ?? r.organisation?.email;
  if (!to) throw new UserFacingError("Aucune adresse de courriel connue pour l'usager.");
  await courrielUsager(r, "convention_a_signer");
  await historiser(r.id, "Relance pour signature", `courriel à ${to}`, user.name);
  return redirigerAvecMessage(fiche, `Relance envoyée à ${to}.`, "success");
}

async function signatureManuelle({ user, r, fiche }: Contexte, form: FormData): Promise<Response> {
  if (r.status !== "acceptee")
    throw new UserFacingError("Ce dossier n'est pas en attente de signature.");
  const nom = champ(form, "signer_name");
  if (nom.length < 3) throw new UserFacingError("Indiquez le nom complet du signataire.");
  await prisma.reservation.update({
    where: { id: r.id },
    data: {
      signedAt: new Date(),
      signerName: nom.slice(0, 160),
      signerIp: null,
      signatureCodeHash: null,
    },
  });
  const signee = (await chargerReservation(r.id)) ?? r;
  await genererConvention(signee, user.name).catch((e) => console.error("[convention signée]", e));
  await historiser(r.id, "Convention signée sur papier", `par ${nom}`, user.name);
  await auditRecord(
    "signature convention (papier)",
    `${r.numero} par ${nom}`,
    "reservations",
    user.email,
  );
  const attendAcompte = enabledIn(user.settings, "paiements") && r.montantTtc > 0 && r.acompte > 0;
  const maj = await changerStatut(r.id, attendAcompte ? "signee" : "confirmee", user, {
    parSysteme: true,
  });
  return redirigerAvecMessage(
    fiche,
    `Convention marquée signée par ${nom}. Dossier ${RESERVATION_STATUS[maj.status as ReservationStatus].label.toLowerCase()}${attendAcompte ? " : en attente de l'acompte" : ""}.`,
    "success",
  );
}

async function facturer({ user, r, fiche }: Contexte, form: FormData): Promise<Response> {
  if (!enabledIn(user.settings, "paiements"))
    throw new UserFacingError("Le module Paiements est désactivé.");
  if (!user.canEdit("paiements"))
    throw new UserFacingError("Vous n'avez pas le droit d'émettre une facture.");
  const type = champ(form, "type");
  if (type !== "acompte" && type !== "solde" && type !== "caution")
    throw new UserFacingError("Type de facture inconnu.");
  const f = await creerFacture(r, type, user.name);
  return redirigerAvecMessage(
    fiche,
    `Facture ${f.numero} émise (${montant(f.montantTtc)}) et envoyée à l'usager.`,
    "success",
  );
}

async function recalculer({ user, r, fiche }: Contexte): Promise<Response> {
  const devis = await recalculerMontants(r.id);
  await historiser(r.id, "Montants recalculés", `${montant(devis.ttc)} TTC`, user.name);
  return redirigerAvecMessage(fiche, `Montants recalculés : ${montant(devis.ttc)} TTC.`, "success");
}

async function supprimer({ user, r, fiche }: Contexte): Promise<Response> {
  if (!["brouillon", "annulee", "refusee"].includes(r.status))
    throw new UserFacingError("Seul un dossier brouillon, annulé ou refusé peut être supprimé.");
  await prisma.reservation.delete({ where: { id: r.id } });
  invalidateNavCounts();
  await auditRecord(
    "suppression reservation",
    `${r.numero} · ${r.title}`,
    "reservations",
    user.email,
  );
  void fiche;
  return redirigerAvecMessage("/reservations", `Dossier ${r.numero} supprimé.`, "success");
}

/** Aiguille POST /reservations/<id>/<action…> vers le geste correspondant. */
export async function actionReservation(
  id: number,
  segments: string[],
  form: FormData,
): Promise<Response> {
  const cle = segments.join("/");
  const user = cle === "supprimer" ? await requireAdmin() : await requireEdit("reservations");
  const r = await chargerReservation(id);
  if (!r) return pasTrouve();
  const fiche = `/reservations/${id}`;
  if (!user.gereEspace(r.espaceId))
    return redirigerAvecMessage(
      fiche,
      "Cet espace n'est pas dans votre périmètre : vous ne pouvez pas agir sur ce dossier.",
      "danger",
    );
  const ctx: Contexte = { user, r, fiche };
  try {
    switch (cle) {
      case "modifier":
        return await modifier(ctx, form);
      case "statut":
        return await statut(ctx, form);
      case "message":
        return await message(ctx, form);
      case "assigner":
        return await assigner(ctx, form);
      case "creneaux/ajouter":
        return await ajouterCreneau(ctx, form);
      case "convention/regenerer":
        return await regenererConvention(ctx);
      case "convention/relancer":
        return await relancerSignature(ctx);
      case "signature/manuelle":
        return await signatureManuelle(ctx, form);
      case "factures/creer":
        return await facturer(ctx, form);
      case "recalculer":
        return await recalculer(ctx);
      case "supprimer":
        return await supprimer(ctx);
      default: {
        if (segments[0] === "creneaux" && segments.length === 3) {
          const cid = parseInt_(segments[1], null, 1);
          if (!cid) return pasTrouve();
          if (segments[2] === "annuler") return await annulerCreneau(ctx, cid);
          if (segments[2] === "modifier") return await modifierCreneau(ctx, cid, form);
        }
        if (segments[0] === "etat-des-lieux" && segments.length === 2) {
          const kind = segments[1];
          if (kind !== "entree" && kind !== "sortie") return pasTrouve();
          const photos: FichierLu[] = [];
          for (const f of form.getAll("photos")) {
            if (typeof f === "string" || !(f.name || "").trim()) continue;
            const lu = await lireFichier(user.settings, f, { imagesSeulement: true });
            if (typeof lu === "string") throw new UserFacingError(lu);
            photos.push(lu);
          }
          await enregistrerEtatDesLieux(
            r,
            kind,
            {
              observations: champOuNull(form, "observations"),
              degats: coche(form, "degats"),
              signataire: champOuNull(form, "signataire"),
            },
            photos,
            { name: user.name, email: user.email, id: user.id },
          );
          return redirigerAvecMessage(
            `${fiche}#caution`,
            `État des lieux ${kind === "entree" ? "d'entrée" : "de sortie"} enregistré${photos.length ? ` avec ${photos.length} photo(s)` : ""}.`,
            "success",
          );
        }
        if (segments[0] === "caution" && segments.length === 2) {
          const acteur = { name: user.name, email: user.email };
          switch (segments[1]) {
            case "encaisser":
              await marquerCautionEncaissee(r, acteur);
              return redirigerAvecMessage(
                `${fiche}#caution`,
                "Caution marquée encaissée.",
                "success",
              );
            case "restituer":
              await restituerCaution(r, acteur);
              return redirigerAvecMessage(
                `${fiche}#caution`,
                "Caution restituée ; l'usager est prévenu.",
                "success",
              );
            case "retenir": {
              const statutCaution = await retenirCaution(
                r,
                parseFloat_(form.get("montant"), 0) ?? 0,
                champOuNull(form, "motif"),
                acteur,
                user.settings,
              );
              return redirigerAvecMessage(
                `${fiche}#caution`,
                statutCaution === "retenue"
                  ? "Retenue enregistrée ; l'usager est prévenu."
                  : "Retenue enregistrée : au-delà du seuil, elle attend la validation d'un administrateur avant l'envoi à l'usager.",
                statutCaution === "retenue" ? "success" : "warning",
              );
            }
            case "valider":
              if (!user.isAdmin)
                throw new UserFacingError(
                  "La validation d'une retenue est réservée aux administrateurs.",
                );
              await validerRetenue(r, acteur);
              return redirigerAvecMessage(
                `${fiche}#caution`,
                "Retenue validée ; l'usager est prévenu.",
                "success",
              );
            default:
              return pasTrouve();
          }
        }
        if (segments[0] === "avenants" && segments.length === 3) {
          const aid = parseInt_(segments[1], null, 1);
          if (!aid) return pasTrouve();
          if (segments[2] === "relancer") return await relancerAvenant(ctx, aid);
          if (segments[2] === "signature-manuelle") return await avenantPapier(ctx, aid, form);
        }
        return pasTrouve();
      }
    }
  } catch (e) {
    if (e instanceof UserFacingError) return redirigerAvecMessage(fiche, e.message, "danger");
    throw e;
  }
}
