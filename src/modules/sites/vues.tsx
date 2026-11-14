/** Sous-composants du module Sites : le formulaire (création et modification). */
import { Champ, Grille, Interrupteur, SectionForm, Zone } from "@/components/formulaire";
import type { Site } from "@/generated/prisma/client";

export function FormulaireSite({
  site,
  action,
  csrf,
}: {
  site: Site | null;
  action: string;
  csrf: string;
}) {
  return (
    <form method="POST" id="form-principal" action={action} data-double-envoi>
      <input type="hidden" name="csrf_token" value={csrf} />
      <SectionForm titre="Identité" icone="map-pin">
        <Grille colonnes={2}>
          <Champ label="Nom du site" name="name" valeur={site?.name} requis autoComplete="off" />
          <Champ
            label="Adresse courte (slug)"
            name="slug"
            valeur={site?.slug}
            aide="Proposée automatiquement d'après le nom ; sert aux adresses du portail."
            attrs={{ "data-slug-de": "#f-name", pattern: "[a-z0-9\\-]+" }}
          />
          <Zone
            label="Description"
            name="description"
            valeur={site?.description}
            rows={3}
            placeholder="Présentation du lieu, affichée sur le portail."
          />
        </Grille>
      </SectionForm>
      <SectionForm titre="Adresse et localisation" icone="map">
        <Grille colonnes={3}>
          <Champ label="Adresse" name="address" valeur={site?.address} pleine />
          <Champ label="Code postal" name="postal_code" valeur={site?.postalCode} />
          <Champ label="Ville" name="city" valeur={site?.city} />
          <div />
          <Champ
            label="Latitude"
            name="lat"
            type="number"
            step="any"
            min={-90}
            max={90}
            valeur={site?.lat}
            placeholder="48.8026"
          />
          <Champ
            label="Longitude"
            name="lng"
            type="number"
            step="any"
            min={-180}
            max={180}
            valeur={site?.lng}
            placeholder="2.2906"
            aide="Avec des coordonnées, la fiche propose un lien vers la carte."
          />
        </Grille>
      </SectionForm>
      <SectionForm titre="Contact et accès" icone="phone">
        <Grille colonnes={2}>
          <Champ label="Téléphone" name="phone" type="tel" valeur={site?.phone} />
          <Champ label="Courriel" name="email" type="email" valeur={site?.email} />
          <Zone
            label="Accès, transports, stationnement"
            name="access_info"
            valeur={site?.accessInfo}
            rows={3}
            placeholder="Bus 194 arrêt Mairie · parking gratuit · accès PMR par l'entrée nord…"
          />
        </Grille>
      </SectionForm>
      <SectionForm titre="Publication" icone="eye">
        <Grille colonnes={2}>
          <Interrupteur
            label="Site actif"
            name="is_active"
            coche={site ? site.isActive : true}
            aide="Un site inactif n'apparaît plus sur le portail ni dans les listes de choix."
          />
          <Interrupteur
            label="Affectation automatique du personnel de service"
            name="affectation_auto"
            coche={site ? site.affectationAuto : false}
            aide="Module Personnel : sur ce site, la personne disponible est affectée d'office aux créneaux réservés ; sinon elle est proposée au gestionnaire, qui valide."
          />
          <Champ
            label="Position"
            name="position"
            type="number"
            min={0}
            valeur={site?.position ?? 0}
            aide="Ordre d'affichage (le plus petit en premier)."
          />
        </Grille>
      </SectionForm>
    </form>
  );
}
