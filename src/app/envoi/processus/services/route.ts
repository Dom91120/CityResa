import { ORGANISATION_TYPES } from "@/lib/constantes";
import { champ, champOuNull, coche, emailValide, idOuNull, parseDate } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import * as features from "@/server/features";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/processus?onglet=services";

/** POST /processus/services : création ou modification d'un service et de ses membres. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireEdit("processus");
      await features.require("processus");
      const id = idOuNull(form, "id");
      const name = champ(form, "name").slice(0, 120);
      if (!name) return redirigerAvecMessage(RETOUR, "Indiquez le nom du service.", "danger");
      const email = champOuNull(form, "email");
      if (email && !emailValide(email))
        return redirigerAvecMessage(RETOUR, "L'adresse de courriel est invalide.", "danger");
      const homonyme = await prisma.service.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) },
      });
      if (homonyme) return redirigerAvecMessage(RETOUR, "Un service porte déjà ce nom.", "danger");
      const agents = await prisma.user.findMany({
        where: { kind: "agent", isActive: true },
        select: { id: true },
      });
      const connus = new Set(agents.map((a) => a.id));
      const membres = [...new Set(form.getAll("membres").map(String))].filter((m) => connus.has(m));
      const responsableId = champOuNull(form, "responsable_id");
      const suppleantId = idOuNull(form, "suppleant_id");
      const du = parseDate(form.get("suppleance_du"));
      const au = parseDate(form.get("suppleance_au"));
      if (du && au && au < du)
        return redirigerAvecMessage(
          RETOUR,
          "La suppléance se termine avant de commencer.",
          "danger",
        );
      const sportifs = champ(form, "usagers_sportifs");
      const data = {
        name,
        description: champOuNull(form, "description")?.slice(0, 300) ?? null,
        email,
        phone: champOuNull(form, "phone")?.slice(0, 40) ?? null,
        signataire: champOuNull(form, "signataire")?.slice(0, 120) ?? null,
        signataireQualite: champOuNull(form, "signataire_qualite")?.slice(0, 160) ?? null,
        responsableId: responsableId && connus.has(responsableId) ? responsableId : null,
        suppleantId: suppleantId && suppleantId !== id ? suppleantId : null,
        suppleanceDu: suppleantId ? du : null,
        suppleanceAu: suppleantId ? au : null,
        usagerTypes: [...new Set(form.getAll("usager_types").map(String))].filter(
          (t) => t in ORGANISATION_TYPES,
        ),
        usagersSportifs: sportifs === "1" ? true : sportifs === "0" ? false : null,
        voitTousEspaces: coche(form, "voit_tous_espaces"),
        isActive: coche(form, "is_active"),
      };
      const s = id
        ? await prisma.service.update({ where: { id }, data })
        : await prisma.service.create({ data });
      await prisma.serviceMembre.deleteMany({ where: { serviceId: s.id } });
      if (membres.length)
        await prisma.serviceMembre.createMany({
          data: membres.map((userId) => ({ serviceId: s.id, userId })),
        });
      await auditRecord(
        id ? "modification service" : "creation service",
        `${name} · ${membres.length} membre(s)`,
        "processus",
        admin.email,
      );
      return redirigerAvecMessage(
        RETOUR,
        id ? `Service « ${name} » modifié.` : `Service « ${name} » créé.`,
        "success",
      );
    },
    RETOUR,
  );
}
