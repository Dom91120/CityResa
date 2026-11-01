/**
 * Les gestes du module PAIEMENTS (routes POST sous src/app/envoi/paiements) : encaisser,
 * annuler, renvoyer une facture, créer une facture libre.
 */
import { PAIEMENT_MODES } from "@/lib/constantes";
import { montant } from "@/lib/libelles";
import {
  creerFactureLibre,
  envoyerFacture,
  lireFactureLibre,
  lirePaiement,
} from "@/modules/paiements/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { annulerFacture, chargerFacture, enregistrerPaiement } from "@/server/factures";
import type { CurrentUser } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, suite } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

function erreur(e: unknown, retour: string): Promise<Response> {
  if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
  throw e;
}

/** POST /paiements/[id]/paiement */
export async function encaisser(user: CurrentUser, id: number, form: FormData): Promise<Response> {
  const retour = suite(form, `/paiements/${id}`);
  try {
    const f = await chargerFacture(id);
    if (!f) return pasTrouve();
    const p = lirePaiement(form);
    await enregistrerPaiement(id, p.montant, p.mode, p.reference, {
      id: user.id,
      name: user.name,
    });
    // `enregistrerPaiement` date le règlement à l'instant : on pose la date saisie après coup.
    if (p.paidAt) {
      const dernier = await prisma.paiement.findFirst({
        where: { factureId: id },
        orderBy: { id: "desc" },
      });
      if (dernier)
        await prisma.paiement.update({ where: { id: dernier.id }, data: { paidAt: p.paidAt } });
    }
    invalidateNavCounts();
    const apres = await chargerFacture(id);
    const soldee = apres?.status === "payee";
    return redirigerAvecMessage(
      retour,
      `Paiement de ${montant(p.montant)} (${PAIEMENT_MODES[p.mode]}) enregistré${soldee ? " : facture soldée" : ""}.`,
      "success",
    );
  } catch (e) {
    return erreur(e, retour);
  }
}

/** POST /paiements/[id]/annuler */
export async function annuler(user: CurrentUser, id: number, form: FormData): Promise<Response> {
  const retour = suite(form, `/paiements/${id}`);
  try {
    const f = await chargerFacture(id);
    if (!f) return pasTrouve();
    if (f.status === "annulee")
      return redirigerAvecMessage(retour, "Cette facture est déjà annulée.", "info");
    if (f.paiements.length)
      throw new UserFacingError(
        "Impossible d'annuler une facture qui porte déjà un règlement : émettez un avoir.",
      );
    await annulerFacture(id, user.email);
    if (f.reservationId)
      await prisma.reservationHistory.create({
        data: {
          reservationId: f.reservationId,
          action: `Facture ${f.numero} annulée`,
          performedBy: user.name,
        },
      });
    invalidateNavCounts();
    return redirigerAvecMessage(retour, `Facture ${f.numero} annulée.`, "success");
  } catch (e) {
    return erreur(e, retour);
  }
}

/** POST /paiements/[id]/renvoyer */
export async function renvoyer(user: CurrentUser, id: number, form: FormData): Promise<Response> {
  const retour = suite(form, `/paiements/${id}`);
  try {
    const f = await chargerFacture(id);
    if (!f) return pasTrouve();
    if (f.status === "annulee") throw new UserFacingError("Cette facture est annulée.");
    const parti = await envoyerFacture(id);
    if (!parti)
      return redirigerAvecMessage(
        retour,
        "Le courriel n'a pas pu partir (modèle désactivé ou envoi en échec).",
        "warning",
      );
    await auditRecord("renvoi facture", f.numero, "paiements", user.email);
    return redirigerAvecMessage(retour, `Facture ${f.numero} renvoyée à l'usager.`, "success");
  } catch (e) {
    return erreur(e, retour);
  }
}

/** POST /paiements/nouvelle */
export async function creerLibre(user: CurrentUser, form: FormData): Promise<Response> {
  try {
    const f = await creerFactureLibre(lireFactureLibre(form), user);
    return redirigerAvecMessage(`/paiements/${f.id}`, `Facture ${f.numero} émise.`, "success");
  } catch (e) {
    return erreur(e, "/paiements/nouvelle");
  }
}
