import { notFound } from "next/navigation";
import { EnteteForm, PiedForm } from "@/components/formulaire";
import { referentielsEspaces } from "@/modules/espaces/server";
import { FormulaireEspace } from "@/modules/espaces/vues";
import { sitesPourSelect } from "@/modules/sites/server";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { saisonsPourFormulaire } from "@/server/horaires";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un espace - CityRésa" };

export default async function ModifierEspacePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("espaces");
  await requireEdit("espaces");
  const id = idDeRoute((await params).id);
  const espace = await prisma.espace.findUnique({
    where: { id },
    include: { _count: { select: { reservations: true } } },
  });
  if (!espace) notFound();
  const [sites, refs, parents, saisons] = await Promise.all([
    sitesPourSelect(),
    referentielsEspaces(),
    prisma.espace.findMany({
      where: { parentId: null, id: { not: id } },
      orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, site: { select: { name: true } } },
    }),
    saisonsPourFormulaire(id),
  ]);
  return (
    <>
      <EnteteForm titre={espace.name} retour={`/espaces/${id}`} sousTitre="Modifier l'espace" />
      <FormulaireEspace
        espace={espace}
        action={`/espaces/${id}/modifier`}
        csrf={page.csrf}
        sites={sites}
        parents={parents.map((p) => ({ id: p.id, name: p.name, siteName: p.site.name }))}
        natures={refs.natures}
        profils={refs.profils}
        saisons={saisons}
      />
      <PiedForm
        retour={`/espaces/${id}`}
        supprimer={page.user.canDelete("espaces") ? `/espaces/${id}/supprimer` : null}
        confirmation={
          espace._count.reservations
            ? `Cet espace a ${espace._count.reservations} réservation(s) : il sera désactivé, pas supprimé. Continuer ?`
            : "Supprimer définitivement cet espace ?"
        }
      />
    </>
  );
}
