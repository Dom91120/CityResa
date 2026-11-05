/**
 * Les gestes POST d'un espace : création, modification, suppression et sous-ressources
 * (équipements, tarifs, options, gestionnaires, indisponibilités, flux ICS). Chaque
 * sous-ressource lit le champ `faire` (ajouter par défaut · modifier · supprimer).
 */
import { champ, idOuNull, ids } from "@/lib/forms-util";
import {
  ajouterGestionnaire,
  ajouterIndisponibilite,
  ajouterTarif,
  enregistrerEquipements,
  enregistrerOption,
  lireEspace,
  lireHorairesSaisonsForm,
  lireIndisponibilite,
  lireOption,
  retirerGestionnaire,
  supprimerEspace,
  supprimerIndisponibilite,
  supprimerOption,
  supprimerTarif,
  verifierParent,
  verifierSlugEspace,
} from "@/modules/espaces/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { apercuFermeture, urlApercuFermeture } from "@/server/fermetures";
import { type CurrentUser, requireDelete, requireEdit } from "@/server/guards";
import { enregistrerHorairesSaisons, saisonsPourFormulaire } from "@/server/horaires";
import { pasTrouve, redirection, redirigerAvecMessage } from "@/server/http";
import { nouveauJeton } from "@/server/ics";

export const ACTIONS_ESPACE = [
  "modifier",
  "supprimer",
  "equipements",
  "tarifs",
  "options",
  "gestionnaires",
  "indisponibilites",
  "ics",
] as const;
export type ActionEspace = (typeof ACTIONS_ESPACE)[number];

async function codesProfils(): Promise<string[]> {
  const rows = await prisma.referential.findMany({
    where: { kind: "profil", code: { not: null } },
    select: { code: true },
  });
  return rows.map((r) => r.code as string);
}

export async function creer(form: FormData): Promise<Response> {
  const user = await requireEdit("espaces");
  try {
    const data = lireEspace(form, await codesProfils());
    await verifierSlugEspace(data.slug, null);
    await verifierParent(data.parentId, null);
    const site = await prisma.site.findUnique({ where: { id: data.siteId }, select: { id: true } });
    if (!site) throw new UserFacingError("Site introuvable.");
    const saisons = await saisonsPourFormulaire(null);
    const horairesSaisons = lireHorairesSaisonsForm(form, saisons);
    const e = await prisma.espace.create({ data });
    await enregistrerHorairesSaisons(e.id, horairesSaisons);
    await auditRecord("creation espace", e.name, "espaces", user.email);
    return redirigerAvecMessage(
      `/espaces/${e.id}`,
      `Espace « ${e.name} » créé. Ajoutez maintenant ses photos, équipements et tarifs.`,
      "success",
    );
  } catch (e) {
    if (e instanceof UserFacingError)
      return redirigerAvecMessage("/espaces/nouveau", e.message, "danger");
    throw e;
  }
}

async function modifier(user: CurrentUser, id: number, form: FormData): Promise<Response> {
  const data = lireEspace(form, await codesProfils());
  await verifierSlugEspace(data.slug, id);
  await verifierParent(data.parentId, id);
  const horairesSaisons = lireHorairesSaisonsForm(form, await saisonsPourFormulaire(id));
  const e = await prisma.espace.update({ where: { id }, data });
  await enregistrerHorairesSaisons(id, horairesSaisons);
  await auditRecord("modification espace", e.name, "espaces", user.email);
  return redirigerAvecMessage(`/espaces/${id}`, "Espace modifié.", "success");
}

async function sousRessource(
  user: CurrentUser,
  id: number,
  action: ActionEspace,
  form: FormData,
): Promise<Response> {
  const faire = champ(form, "faire") || "ajouter";
  const fiche = `/espaces/${id}`;
  switch (action) {
    case "equipements": {
      await enregistrerEquipements(id, ids(form, "equipement"));
      await auditRecord("equipements espace", `#${id}`, "espaces", user.email);
      return redirigerAvecMessage(`${fiche}#equipements`, "Équipements enregistrés.", "success");
    }
    case "tarifs": {
      if (faire === "supprimer") {
        const tarifId = idOuNull(form, "tarif_id");
        if (!tarifId) return pasTrouve();
        await supprimerTarif(id, tarifId);
        await auditRecord("suppression tarif", `espace #${id}`, "espaces", user.email);
        return redirigerAvecMessage(`${fiche}#tarifs`, "Tarif supprimé.", "success");
      }
      await ajouterTarif(id, form);
      await auditRecord("ajout tarif", `espace #${id}`, "espaces", user.email);
      return redirigerAvecMessage(`${fiche}#tarifs`, "Tarif ajouté.", "success");
    }
    case "options": {
      const optionId = idOuNull(form, "option_id");
      if (faire === "supprimer") {
        if (!optionId) return pasTrouve();
        const message = await supprimerOption(id, optionId);
        await auditRecord("suppression option", `espace #${id}`, "espaces", user.email);
        return redirigerAvecMessage(`${fiche}#options`, message, "success");
      }
      const data = lireOption(form);
      await enregistrerOption(id, faire === "modifier" ? optionId : null, data);
      await auditRecord(
        faire === "modifier" ? "modification option" : "ajout option",
        `${data.label} (espace #${id})`,
        "espaces",
        user.email,
      );
      return redirigerAvecMessage(
        `${fiche}#options`,
        faire === "modifier" ? "Prestation modifiée." : "Prestation ajoutée.",
        "success",
      );
    }
    case "gestionnaires": {
      if (faire === "supprimer") {
        await retirerGestionnaire(id, champ(form, "user_id"));
        await auditRecord("retrait gestionnaire", `espace #${id}`, "espaces", user.email);
        return redirigerAvecMessage(`${fiche}#gestionnaires`, "Gestionnaire retiré.", "success");
      }
      await ajouterGestionnaire(id, form);
      await auditRecord("ajout gestionnaire", `espace #${id}`, "espaces", user.email);
      return redirigerAvecMessage(`${fiche}#gestionnaires`, "Gestionnaire ajouté.", "success");
    }
    case "indisponibilites": {
      if (faire === "supprimer") {
        const bid = idOuNull(form, "indisponibilite_id");
        if (!bid) return pasTrouve();
        await supprimerIndisponibilite(id, bid);
        await auditRecord("suppression blocage", `espace #${id}`, "espaces", user.email);
        return redirigerAvecMessage(`${fiche}#indisponibilites`, "Blocage supprimé.", "success");
      }
      const blocage = lireIndisponibilite(form);
      // Des réservations en place : on passe par l'aperçu de fermeture exceptionnelle.
      if ((await apercuFermeture(id, blocage.startAt, blocage.endAt)).length)
        return redirection(
          urlApercuFermeture({ espaceId: id, ...blocage, next: `${fiche}#indisponibilites` }),
        );
      await ajouterIndisponibilite(id, blocage, user.email);
      await auditRecord("ajout blocage", `espace #${id}`, "espaces", user.email);
      return redirigerAvecMessage(`${fiche}#indisponibilites`, "Blocage ajouté.", "success");
    }
    case "ics": {
      if (faire === "revoquer") {
        await prisma.espace.update({ where: { id }, data: { icsToken: null } });
        await auditRecord("revocation flux ics", `espace #${id}`, "espaces", user.email);
        return redirigerAvecMessage(
          `${fiche}#ics`,
          "Flux révoqué : l'ancienne adresse ne fonctionne plus.",
          "success",
        );
      }
      await prisma.espace.update({ where: { id }, data: { icsToken: nouveauJeton() } });
      await auditRecord("generation flux ics", `espace #${id}`, "espaces", user.email);
      return redirigerAvecMessage(`${fiche}#ics`, "Flux ICS généré.", "success");
    }
    default:
      return pasTrouve();
  }
}

/** POST /espaces/[id]/[action] */
export async function agir(id: number, action: ActionEspace, form: FormData): Promise<Response> {
  const retourErreur = action === "modifier" ? `/espaces/${id}/modifier` : `/espaces/${id}`;
  try {
    if (action === "supprimer") {
      const user = await requireDelete("espaces");
      const message = await supprimerEspace(id);
      await auditRecord("suppression espace", `#${id}`, "espaces", user.email);
      return redirigerAvecMessage("/espaces", message, "success");
    }
    const user = await requireEdit("espaces");
    const existant = await prisma.espace.findUnique({ where: { id }, select: { id: true } });
    if (!existant) return pasTrouve();
    if (action === "modifier") return await modifier(user, id, form);
    return await sousRessource(user, id, action, form);
  } catch (e) {
    if (e instanceof UserFacingError)
      return redirigerAvecMessage(retourErreur, e.message, "danger");
    throw e;
  }
}
