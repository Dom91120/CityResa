import type { Prisma } from "@/generated/prisma/client";
import { controler, lireDefinition } from "@/lib/circuits";
import { champ, champOuNull, coche, idOuNull, parseInt_ } from "@/lib/forms-util";
import {
  chargerCircuit,
  conditionDuFormulaire,
  etapeDuFormulaire,
} from "@/modules/processus/server";
import { auditRecord } from "@/server/audit";
import { brouillonDe, enregistrerBrouillon, referentiel } from "@/server/circuits";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";
import * as features from "@/server/features";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/**
 * POST /processus/circuits/<id> : tout ce qui modifie un circuit. Les changements de contenu
 * (aiguillage, étapes) s'écrivent dans le brouillon, créé au besoin depuis la version en
 * service ; rien ne s'applique aux dossiers avant la publication.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  const fiche = `/processus/circuits/${id}`;
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      await features.require("processus");
      const c = await chargerCircuit(id);
      if (!c) return pasTrouve();
      const action = champ(form, "action");
      const cle = champ(form, "cle");
      const ok = (message: string, vers = fiche) => redirigerAvecMessage(vers, message, "success");
      try {
        switch (action) {
          case "identite": {
            const name = champ(form, "name").slice(0, 120);
            if (!name) throw new UserFacingError("Indiquez le nom du circuit.");
            const parDefaut = coche(form, "par_defaut");
            if (parDefaut && !c.parDefaut) {
              const autre = await prisma.circuit.findFirst({
                where: { objet: c.objet, parDefaut: true, id: { not: id } },
              });
              if (autre)
                throw new UserFacingError(
                  `« ${autre.name} » est déjà le circuit par défaut : retirez-lui d'abord ce rôle.`,
                );
            }
            const isActive = coche(form, "is_active");
            if (c.parDefaut && (!parDefaut || !isActive) && c.publiee)
              throw new UserFacingError(
                "Le circuit par défaut reçoit ce qu'aucune règle ne prend : désignez-en un autre avant de le retirer ou de le désactiver.",
              );
            await prisma.circuit.update({
              where: { id },
              data: {
                name,
                description: champOuNull(form, "description")?.slice(0, 400) ?? null,
                position: Math.max(0, parseInt_(form.get("position"), c.position) ?? c.position),
                parDefaut,
                isActive,
              },
            });
            await auditRecord("modification circuit", name, "processus", admin.email);
            return ok("Circuit modifié.");
          }
          case "aiguillage": {
            const condition = c.parDefaut ? null : conditionDuFormulaire(form);
            const serviceId = idOuNull(form, "service_id");
            await enregistrerBrouillon(id, admin.name, (d) => ({ ...d, condition, serviceId }));
            return ok("Aiguillage enregistré dans le brouillon.");
          }
          case "etape": {
            const b = await brouillonDe(id, admin.name);
            const e = etapeDuFormulaire(form, b.definition.etapes, c.objet);
            const existe = b.definition.etapes.some((x) => x.cle === e.cle);
            await enregistrerBrouillon(id, admin.name, (d) => ({
              ...d,
              etapes: existe ? d.etapes.map((x) => (x.cle === e.cle ? e : x)) : [...d.etapes, e],
            }));
            return ok(
              existe ? `Étape « ${e.libelle} » modifiée.` : `Étape « ${e.libelle} » ajoutée.`,
            );
          }
          case "etape-supprimer":
            await enregistrerBrouillon(id, admin.name, (d) => ({
              ...d,
              etapes: d.etapes.filter((x) => x.cle !== cle),
            }));
            return ok("Étape retirée du brouillon.");
          case "monter":
          case "descendre": {
            await enregistrerBrouillon(id, admin.name, (d) => {
              const i = d.etapes.findIndex((x) => x.cle === cle);
              const j = action === "monter" ? i - 1 : i + 1;
              if (i < 0 || j < 0 || j >= d.etapes.length) return d;
              const etapes = [...d.etapes];
              [etapes[i], etapes[j]] = [etapes[j], etapes[i]];
              return { ...d, etapes };
            });
            return ok("Ordre des étapes modifié.");
          }
          case "publier": {
            if (!c.brouillon) throw new UserFacingError("Aucun brouillon à publier.");
            const autres = await prisma.circuit.findMany({
              where: { objet: c.objet, id: { not: id }, isActive: true },
              select: { name: true, parDefaut: true },
            });
            const erreurs = controler(c, c.definition, await referentiel(), autres);
            if (erreurs.length)
              throw new UserFacingError(`Publication impossible. ${erreurs.join(" ")}`);
            await prisma.$transaction([
              prisma.circuitVersion.updateMany({
                where: { circuitId: id, status: "publiee" },
                data: { status: "archivee" },
              }),
              prisma.circuitVersion.update({
                where: { id: c.brouillon.id },
                data: {
                  status: "publiee",
                  publieAt: new Date(),
                  publiePar: admin.name,
                  note: champOuNull(form, "note")?.slice(0, 300) ?? null,
                },
              }),
            ]);
            await auditRecord(
              "publication circuit",
              `${c.name} · v${c.brouillon.numero}`,
              "processus",
              admin.email,
            );
            return ok(
              `Version ${c.brouillon.numero} publiée : elle s'applique aux nouvelles demandes.`,
            );
          }
          case "abandonner": {
            if (!c.brouillon || !c.publiee)
              throw new UserFacingError("Il n'y a pas de brouillon à abandonner.");
            await prisma.circuitVersion.delete({ where: { id: c.brouillon.id } });
            return ok("Brouillon abandonné : le circuit reste sur la version en service.");
          }
          case "reprendre": {
            if (c.brouillon)
              throw new UserFacingError("Publiez ou abandonnez d'abord le brouillon en cours.");
            const v = c.versions.find((x) => x.id === idOuNull(form, "version"));
            if (!v) throw new UserFacingError("Version introuvable.");
            await prisma.circuitVersion.create({
              data: {
                circuitId: id,
                numero: c.versions[0].numero + 1,
                status: "brouillon",
                definition: lireDefinition(v.definition) as unknown as Prisma.InputJsonValue,
                createdBy: admin.name,
                note: `Reprise de la version ${v.numero}`,
              },
            });
            return ok(`Version ${v.numero} reprise en brouillon.`);
          }
          case "supprimer": {
            const nb =
              (await prisma.reservation.count({ where: { circuitVersion: { circuitId: id } } })) +
              (await prisma.subvention.count({ where: { circuitVersion: { circuitId: id } } })) +
              (await prisma.campagne.count({ where: { circuitVersion: { circuitId: id } } }));
            if (nb)
              throw new UserFacingError(
                "Des dossiers ont suivi ce circuit : désactivez-le plutôt que de le supprimer.",
              );
            if (c.parDefaut && c.publiee)
              throw new UserFacingError("Le circuit par défaut ne se supprime pas.");
            await prisma.circuit.delete({ where: { id } });
            await auditRecord("suppression circuit", c.name, "processus", admin.email);
            return ok(`Circuit « ${c.name} » supprimé.`, "/processus");
          }
          default:
            return pasTrouve();
        }
      } catch (e) {
        if (e instanceof UserFacingError) return redirigerAvecMessage(fiche, e.message, "danger");
        throw e;
      }
    },
    fiche,
  );
}
