import { Champ, EnteteForm, Grille, PiedForm, SectionForm, Select } from "@/components/formulaire";
import { SECTEURS } from "@/lib/constantes";
import { contexteAdmin } from "@/modules/admin/server";
import { rolesAgents } from "@/modules/utilisateurs/server";

export const metadata = { title: "Nouveau compte - CityRésa" };

export default async function NouvelAgentPage() {
  const page = await contexteAdmin();
  const roles = await rolesAgents();
  return (
    <>
      <EnteteForm
        titre="Nouveau compte"
        retour="/utilisateurs"
        sousTitre="Un compte du back-office. Un mot de passe provisoire sera généré et affiché une seule fois ; la personne recevra aussi un courriel de bienvenue."
        libelle="Créer le compte"
      />
      <form
        method="POST"
        action="/utilisateurs/nouveau"
        id="form-principal"
        className="form-seul"
        data-double-envoi
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <SectionForm titre="Identité" icone="circle-user">
          <Grille colonnes={3}>
            <Champ label="Courriel (identifiant)" name="email" type="email" requis pleine />
            <Champ label="Prénom" name="first_name" requis />
            <Champ label="Nom" name="last_name" requis />
            <Champ label="Fonction" name="fonction" placeholder="Responsable des salles…" />
            <Champ label="Téléphone" name="phone" type="tel" />
          </Grille>
        </SectionForm>
        <SectionForm
          titre="Rôle"
          icone="shield"
          aide="Le rôle fixe les droits par domaine (réservations, espaces, usagers…). Les permissions se règlent dans « Rôles & permissions »."
        >
          <Grille colonnes={2}>
            <Select
              label="Rôle"
              name="role"
              options={roles.map((r) => [r.name, r.label])}
              valeur={roles.find((r) => r.name === "agent")?.name ?? roles[0]?.name}
              requis
            />
            <Select
              label="Secteur"
              name="secteur"
              options={Object.entries(SECTEURS).map(([k, v]) => [k, v.label])}
              blank="— Aucun (transversal) —"
              aide="Un agent d'un secteur ne se rattache qu'aux espaces de ce secteur et, sans rattachement, les voit tous. Aucun = transversal (administrateur, financier, élu) : tous les espaces."
            />
            <div className="small text-muted align-self-end pb-2">
              {roles.map((r) => (
                <div key={r.id}>
                  <strong>{r.label}</strong>
                  {r.description ? ` — ${r.description}` : ""}
                </div>
              ))}
            </div>
          </Grille>
        </SectionForm>
        <PiedForm retour="/utilisateurs" libelle="Créer le compte" />
      </form>
    </>
  );
}
