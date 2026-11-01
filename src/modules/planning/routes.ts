/**
 * Les gestes du planning : bloquer un créneau d'un espace (indisponibilité) et lever un
 * blocage. Réservés aux agents qui ont la main sur l'espace.
 */
import { champ, champOuNull, idOuNull } from "@/lib/forms-util";
import { isoParis, plage } from "@/lib/libelles";
import { lireCreneau } from "@/modules/reservations/formulaire";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import { requireEdit } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, suite } from "@/server/http";
import { verifierDisponibilite } from "@/server/reservations";

export async function bloquer(form: FormData): Promise<Response> {
  const user = await requireEdit("reservations");
  const retour = suite(form, "/planning");
  try {
    const espaceId = idOuNull(form, "espace_id");
    if (!espaceId) throw new UserFacingError("Choisissez l'espace à bloquer.");
    if (!user.gereEspace(espaceId))
      throw new UserFacingError("Cet espace n'est pas dans votre périmètre.");
    const espace = await prisma.espace.findUnique({ where: { id: espaceId } });
    if (!espace) return pasTrouve();
    const i = lireCreneau(form);
    const motif = champOuNull(form, "motif");
    const conflits = await verifierDisponibilite(espace, [i]);
    await prisma.indisponibilite.create({
      data: {
        espaceId,
        startAt: i.startAt,
        endAt: i.endAt,
        motif: motif?.slice(0, 200) ?? null,
        createdBy: user.email,
      },
    });
    await auditRecord(
      "blocage espace",
      `${espace.name} · ${plage(i.startAt, i.endAt)}${motif ? ` · ${motif}` : ""}`,
      "planning",
      user.email,
    );
    const ou = `/planning?espace=${espaceId}&date=${isoParis(i.startAt).date}${champ(form, "vue") ? `&vue=${champ(form, "vue")}` : ""}`;
    const resas = conflits.filter((c) => c.existant.genre === "reservation");
    if (resas.length)
      return redirigerAvecMessage(
        ou,
        `Blocage posé sur ${espace.name} (${plage(i.startAt, i.endAt)}). Attention : ${resas.length} réservation${resas.length > 1 ? "s" : ""} déjà en place sur ce créneau (${[...new Set(resas.map((c) => c.existant.libelle))].slice(0, 3).join(" ; ")}).`,
        "warning",
      );
    return redirigerAvecMessage(
      ou,
      `Blocage posé sur ${espace.name} : ${plage(i.startAt, i.endAt)}.`,
      "success",
    );
  } catch (e) {
    if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger");
    throw e;
  }
}

export async function supprimerBlocage(id: number, form: FormData): Promise<Response> {
  const user = await requireEdit("reservations");
  const retour = suite(form, "/planning");
  const b = await prisma.indisponibilite.findUnique({ where: { id }, include: { espace: true } });
  if (!b) return pasTrouve();
  if (!user.gereEspace(b.espaceId))
    return redirigerAvecMessage(retour, "Cet espace n'est pas dans votre périmètre.", "danger");
  await prisma.indisponibilite.delete({ where: { id } });
  await auditRecord(
    "levee blocage espace",
    `${b.espace.name} · ${plage(b.startAt, b.endAt)}`,
    "planning",
    user.email,
  );
  return redirigerAvecMessage(retour, `Blocage levé sur ${b.espace.name}.`, "success");
}
