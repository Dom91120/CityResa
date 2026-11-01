import { notFound } from "next/navigation";
import { Champ, EnteteForm, Grille, PiedForm, SectionForm, Select } from "@/components/formulaire";
import { contexteAdmin } from "@/modules/admin/server";
import { nomComplet, rolesAgents } from "@/modules/utilisateurs/server";
import { prisma } from "@/server/db";

export const metadata = { title: "Modifier un compte - CityRésa" };

export default async function ModifierUtilisateurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const page = await contexteAdmin();
  const { id } = await params;
  const u = await prisma.user.findUnique({
    where: { id },
    include: { organisation: { select: { id: true, name: true } } },
  });
  if (!u) notFound();
  const roles = u.kind === "agent" ? await rolesAgents() : [];
  const retour = `/utilisateurs/${id}`;
  const soiMeme = u.id === page.user.id;
  return (
    <>
      <EnteteForm titre={nomComplet(u)} retour={retour} sousTitre="Modifier le compte" />
      <form
        method="POST"
        action={`/utilisateurs/${id}/modifier`}
        id="form-principal"
        className="form-seul"
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <SectionForm titre="Identité" icone="circle-user">
          <Grille colonnes={3}>
            <Champ
              label="Courriel (identifiant)"
              name="email"
              type="email"
              valeur={u.email}
              requis
              pleine
            />
            <Champ label="Prénom" name="first_name" valeur={u.firstName} requis />
            <Champ label="Nom" name="last_name" valeur={u.lastName} requis />
            <Champ label="Fonction" name="fonction" valeur={u.fonction} />
            <Champ label="Téléphone" name="phone" type="tel" valeur={u.phone} />
          </Grille>
        </SectionForm>
        {u.kind === "agent" ? (
          <SectionForm
            titre="Rôle"
            icone="shield"
            aide={
              soiMeme
                ? "Vous ne pouvez pas changer votre propre rôle."
                : "Le rôle fixe les droits de l'agent dans le back-office."
            }
          >
            <Grille colonnes={2}>
              <Select
                label="Rôle"
                name="role"
                options={roles.map((r) => [r.name, r.label])}
                valeur={u.role}
                requis
                attrs={soiMeme ? { disabled: true } : undefined}
              />
            </Grille>
          </SectionForm>
        ) : (
          <SectionForm titre="Organisation" icone="building-2">
            <p className="small mb-2">
              Compte usager rattaché à{" "}
              {u.organisation ? (
                <a href={`/usagers/${u.organisation.id}`}>{u.organisation.name}</a>
              ) : (
                "aucune organisation"
              )}
              .
            </p>
          </SectionForm>
        )}
        <PiedForm retour={retour} />
      </form>
    </>
  );
}
