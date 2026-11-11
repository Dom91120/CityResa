import { EnteteForm } from "@/components/formulaire";
import { referentielsEspaces } from "@/modules/espaces/server";
import { FormulaireEspace } from "@/modules/espaces/vues";
import { sitesPourSelect } from "@/modules/sites/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { saisonsPourFormulaire } from "@/server/horaires";
import { contexteModule } from "@/server/module";
import { type Params, param } from "@/server/paging";

export const metadata = { title: "Nouvel espace - CityRésa" };

export default async function NouvelEspacePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const page = await contexteModule("espaces");
  await requireEdit("espaces");
  const params = await searchParams;
  const siteParDefaut = Number.parseInt(param(params, "site") ?? "", 10) || null;
  const [sites, refs, tousParents, saisons] = await Promise.all([
    sitesPourSelect(),
    referentielsEspaces(),
    prisma.espace.findMany({
      where: { parentId: null, isActive: true },
      orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, site: { select: { name: true } } },
    }),
    saisonsPourFormulaire(null),
  ]);
  const parents = tousParents.filter((p) => page.user.voitEspace(p.id));
  return (
    <>
      <EnteteForm
        titre="Nouvel espace"
        retour={siteParDefaut ? `/sites/${siteParDefaut}` : "/espaces"}
        sousTitre="Identité, visibilité et règles de réservation. Photos, tarifs et équipements se complètent ensuite sur la fiche."
        libelle="Créer l'espace"
      />
      <FormulaireEspace
        espace={null}
        action="/espaces/nouveau"
        csrf={page.csrf}
        secteurImpose={page.user.secteur}
        sites={sites}
        parents={parents.map((p) => ({ id: p.id, name: p.name, siteName: p.site.name }))}
        natures={refs.natures}
        profils={refs.profils}
        siteParDefaut={siteParDefaut}
        saisons={saisons}
      />
    </>
  );
}
