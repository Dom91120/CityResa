/**
 * Les gestes sur une pièce jointe : dépôt et suppression, par un agent (droit de la
 * catégorie du parent) ou par un usager (ses propres dossiers, son organisation, ses
 * demandes de subvention).
 */
import { DOCUMENT_PARENTS } from "@/lib/constantes";
import { champ, coche, idOuNull, parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import {
  deposerDocument,
  documentsEnabled,
  lireFichier,
  nomAffiche,
  parentId,
  parentKind,
  permissionCategoryOf,
  retour,
} from "@/server/documents";
import type { CurrentUser } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, suite } from "@/server/http";

/** L'usager a-t-il la main sur ce parent ? */
async function usagerPossede(user: CurrentUser, kind: string, pid: number): Promise<boolean> {
  if (kind === "reservation") {
    const r = await prisma.reservation.findUnique({
      where: { id: pid },
      select: { userId: true, organisationId: true },
    });
    return Boolean(
      r &&
        (r.userId === user.id || (user.organisationId && r.organisationId === user.organisationId)),
    );
  }
  if (kind === "organisation") return pid === user.organisationId;
  if (kind === "subvention") {
    const s = await prisma.subvention.findUnique({
      where: { id: pid },
      select: { organisationId: true },
    });
    return Boolean(s && s.organisationId === user.organisationId);
  }
  return false;
}

function retourUsager(kind: string, pid: number): string {
  if (kind === "reservation") return `/portail/mes-reservations/${pid}`;
  if (kind === "subvention") return `/portail/mes-subventions/${pid}`;
  return "/portail/mon-organisation";
}

export async function deposer(user: CurrentUser, form: FormData): Promise<Response> {
  if (!documentsEnabled(user.settings)) return pasTrouve();
  const kind = champ(form, "parent_kind");
  const pid = parseInt_(form.get("parent_id"));
  if (!(kind in DOCUMENT_PARENTS) || !pid) return new Response("Bad Request", { status: 400 });
  const [, categorie] = DOCUMENT_PARENTS[kind];
  const ou = suite(form, user.isAgent ? retour(kind, pid) : retourUsager(kind, pid));
  const autorise = user.isAgent ? user.canEdit(categorie) : await usagerPossede(user, kind, pid);
  if (!autorise)
    return redirigerAvecMessage(
      ou,
      "Vous n'avez pas les droits pour déposer une pièce ici.",
      "danger",
    );
  const docKind = champ(form, "kind") || undefined;
  const lu = await lireFichier(user.settings, form.get("file"), {
    imagesSeulement: docKind === "photo",
  });
  if (typeof lu === "string") return redirigerAvecMessage(ou, lu, "danger");
  const doc = await deposerDocument({
    kind,
    parentId: pid,
    fichier: lu,
    docKind,
    title: nomAffiche(form.get("title")) || null,
    categoryId: idOuNull(form, "category_id"),
    isPublic: user.isAgent ? coche(form, "is_public") || docKind === "photo" : false,
    uploadedById: user.id,
  });
  await auditRecord("depot piece", `${doc.filename} (${kind} #${pid})`, categorie, user.email);
  if (kind === "reservation" && user.isUsager) {
    await prisma.reservationHistory.create({
      data: {
        reservationId: pid,
        action: "Pièce déposée par l'usager",
        comment: doc.filename,
        performedBy: user.name,
      },
    });
  }
  return redirigerAvecMessage(
    ou,
    docKind === "photo" ? "Photo ajoutée" : "Pièce jointe ajoutée",
    "success",
  );
}

export async function supprimer(user: CurrentUser, id: number, form: FormData): Promise<Response> {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return pasTrouve();
  const kind = parentKind(doc);
  const pid = parentId(doc);
  const ou = suite(
    form,
    kind && pid ? (user.isAgent ? retour(kind, pid) : retourUsager(kind, pid)) : "/",
  );
  const autorise = user.isAgent
    ? user.canEdit(permissionCategoryOf(doc))
    : Boolean(
        kind && pid && (await usagerPossede(user, kind, pid)) && doc.uploadedById === user.id,
      );
  if (!autorise)
    return redirigerAvecMessage(
      ou,
      "Vous n'avez pas les droits pour retirer cette pièce.",
      "danger",
    );
  if (doc.kind === "convention" || doc.kind === "facture") {
    if (!user.isAgent)
      return redirigerAvecMessage(ou, "Ce document ne peut pas être retiré.", "danger");
  }
  await prisma.document.delete({ where: { id } });
  await auditRecord("suppression piece", doc.filename, permissionCategoryOf(doc), user.email);
  return redirigerAvecMessage(ou, "Pièce supprimée", "success");
}

/** Change la position d'une photo (la première est la photo principale). */
export async function reordonner(
  user: CurrentUser,
  id: number,
  sens: "haut" | "bas",
  form: FormData,
): Promise<Response> {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return pasTrouve();
  const kind = parentKind(doc);
  const pid = parentId(doc);
  const ou = suite(form, kind && pid ? retour(kind, pid) : "/");
  if (!user.isAgent || !user.canEdit(permissionCategoryOf(doc)))
    return redirigerAvecMessage(ou, "Droits insuffisants.", "danger");
  if (!kind || !pid) return pasTrouve();
  const col = DOCUMENT_PARENTS[kind][0];
  const freres = await prisma.document.findMany({
    where: { [col]: pid, kind: doc.kind },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });
  const i = freres.findIndex((d) => d.id === id);
  const j = sens === "haut" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= freres.length)
    return redirigerAvecMessage(ou, "Rien à déplacer.", "info");
  [freres[i], freres[j]] = [freres[j], freres[i]];
  await prisma.$transaction(
    freres.map((d, k) => prisma.document.update({ where: { id: d.id }, data: { position: k } })),
  );
  return redirigerAvecMessage(ou, "Ordre modifié", "success");
}
