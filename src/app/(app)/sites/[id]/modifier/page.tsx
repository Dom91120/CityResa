import { notFound } from "next/navigation";
import { EnteteForm, PiedForm } from "@/components/formulaire";
import { siteAccessible } from "@/modules/sites/server";
import { FormulaireSite } from "@/modules/sites/vues";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un site - CityRésa" };

export default async function ModifierSitePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("espaces");
  await requireEdit("espaces");
  const id = idDeRoute((await params).id);
  const site = await prisma.site.findUnique({
    where: { id },
    include: { _count: { select: { espaces: true } } },
  });
  if (!site || !(await siteAccessible(page.user, id))) notFound();
  const peutSupprimer = page.user.canDelete("espaces");
  return (
    <>
      <EnteteForm titre={site.name} retour={`/sites/${id}`} sousTitre="Modifier le site" />
      <FormulaireSite site={site} action={`/sites/${id}/modifier`} csrf={page.csrf} />
      <PiedForm
        retour={`/sites/${id}`}
        supprimer={peutSupprimer ? `/sites/${id}/supprimer` : null}
        confirmation={
          site._count.espaces
            ? `Ce site compte ${site._count.espaces} espace(s) : il sera désactivé, pas supprimé. Continuer ?`
            : "Supprimer définitivement ce site ?"
        }
      />
    </>
  );
}
