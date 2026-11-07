import { FormDocument, ListeDocuments, PiecesAttendues } from "@/components/documents";
import { Lu, Lus, Section } from "@/components/fiche";
import { Champ, Interrupteur } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Avatar, Chip, TypeOrganisation } from "@/components/macros";
import {
  type ExigenceCle,
  exigeSurOrganisation,
  manquesDossier,
  phraseManques,
  qualiteRepresentant,
} from "@/lib/dossier-usager";
import { isoDate } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import { BlocVide } from "@/modules/portail/vues";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { forParent } from "@/server/documents";
import { contexteUsager } from "@/server/page";

export const metadata = { title: "Mon organisation - CityRésa" };

export default async function MonOrganisationPage() {
  const page = await contexteUsager();
  const { user, csrf, features } = page;
  const cfg = await getSettings();
  const org = user.organisationId
    ? await prisma.organisation.findUnique({
        where: { id: user.organisationId },
        include: {
          profil: true,
          users: {
            where: { isActive: true },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          },
        },
      })
    : null;
  if (!org)
    return (
      <div className="data-card">
        <BlocVide
          icone="building-2"
          titre="Aucune organisation rattachée"
          texte="Votre compte n'est lié à aucune organisation. Contactez la collectivité pour corriger votre fiche."
        />
      </div>
    );
  const pieces = await forParent("organisation", org.id);
  const ici = "/portail/mon-organisation";
  const particulier = org.type === "particulier";
  const exige = (cle: ExigenceCle) => exigeSurOrganisation(org.type, cle);
  const manques = manquesDossier(org, user);
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {org.name}
            <TypeOrganisation type={org.type} />
          </h1>
          <p className="page-subtitle">
            {particulier
              ? "Vos coordonnées de demandeur."
              : "La fiche de votre organisation, ses membres et ses documents."}
          </p>
        </div>
      </div>

      {manques.length ? (
        <div className="alert alert-warning d-flex gap-2 align-items-start">
          <Icone nom="triangle-alert" taille={18} />
          <div>
            <strong>Votre dossier est incomplet pour déposer une demande.</strong>{" "}
            {phraseManques(manques)}{" "}
            {manques.some((m) => m.cible === "compte") ? (
              <>
                Les données du contact se renseignent dans{" "}
                <a href="/portail/mon-compte">Mon compte</a>.
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="fiche-colonnes">
        <div>
          <div className="data-card">
            <Section titre="Situation" icone="badge-check">
              <Lus colonnes={1}>
                <Lu
                  label="Validation"
                  valeur={
                    org.validatedAt ? (
                      <Chip teinte="emerald">
                        <Icone nom="check" taille={12} /> Validée le {dateCourte(org.validatedAt)}
                      </Chip>
                    ) : (
                      <Chip teinte="amber">
                        <Icone nom="hourglass" taille={12} /> En attente de validation
                      </Chip>
                    )
                  }
                />
                <Lu label="Profil tarifaire" valeur={org.profil?.label ?? "Non défini"} />
              </Lus>
              {!org.validatedAt ? (
                <p className="text-muted small mt-2 mb-0">
                  La collectivité vérifie votre fiche
                  {cfg.VALIDATION_COMPTE_USAGER
                    ? " avant que vous puissiez déposer une demande"
                    : ""}
                  . Déposer vos statuts et votre attestation d'assurance accélère la validation.
                </p>
              ) : (
                <p className="text-muted small mt-2 mb-0">
                  Le profil tarifaire est attribué par la collectivité ; il détermine les tarifs qui
                  vous sont appliqués.
                </p>
              )}
            </Section>

            <Section titre="Membres" icone="users" nb={org.users.length}>
              <ul className="list-unstyled mb-3">
                {org.users.map((u) => (
                  <li key={u.id} className="d-flex align-items-center gap-2 py-1">
                    <Avatar nom={`${u.firstName} ${u.lastName}`.trim() || u.email} taille="sm" />
                    <span>
                      {`${u.firstName} ${u.lastName}`.trim() || u.email}
                      {u.id === user.id ? <span className="text-muted"> (vous)</span> : null}
                      <small className="d-block text-muted">
                        {u.email}
                        {u.fonction ? ` · ${u.fonction}` : ""}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
              {!particulier ? (
                <details>
                  <summary className="fw-semibold" style={{ cursor: "pointer" }}>
                    <Icone nom="user-plus" taille={14} /> Inviter un membre
                  </summary>
                  <form method="POST" action={`${ici}/inviter`} className="mt-3" data-double-envoi>
                    <input type="hidden" name="csrf_token" value={csrf} />
                    <p className="text-muted small">
                      La personne recevra un courriel pour choisir son mot de passe et pourra suivre
                      et déposer les demandes de {org.name}.
                    </p>
                    <div className="grille grille-3">
                      <Champ label="Prénom" name="first_name" requis autoComplete="off" />
                      <Champ label="Nom" name="last_name" requis autoComplete="off" />
                      <Champ
                        label="Courriel"
                        name="email"
                        id="m-email"
                        type="email"
                        requis
                        autoComplete="off"
                      />
                    </div>
                    <button type="submit" className="btn btn-outline-primary btn-sm">
                      <Icone nom="send" taille={14} /> Envoyer l'invitation
                    </button>
                  </form>
                </details>
              ) : null}
            </Section>

            <Section titre="Documents" icone="paperclip" nb={pieces.length || null}>
              <p className="text-muted small">
                Statuts, attestation d'assurance responsabilité civile, justificatifs : ces pièces
                sont demandées pour valider votre fiche et vos réservations.
              </p>
              <PiecesAttendues
                type={org.type}
                pieces={pieces}
                seuilJours={cfg.ALERTE_PIECES_JOURS}
                usager
              />
              <ListeDocuments
                documents={pieces}
                csrf={csrf}
                next={ici}
                peutSupprimer={(d) => d.uploadedById === user.id}
                seuilJours={cfg.ALERTE_PIECES_JOURS}
                vide="Aucun document déposé."
              />
              {features.documents ? (
                <div className="mt-3">
                  <FormDocument
                    parentKind="organisation"
                    parentId={org.id}
                    csrf={csrf}
                    next={ici}
                    kinds={[
                      ["assurance", "Attestation d'assurance"],
                      ["statuts", "Statuts"],
                      ["piece", "Pièce justificative"],
                      ["autre", "Autre"],
                    ]}
                    validite
                  />
                </div>
              ) : null}
            </Section>
          </div>
        </div>

        <div>
          <form
            method="POST"
            action={ici}
            id="form-principal"
            className="data-card p-4"
            data-double-envoi
          >
            <input type="hidden" name="csrf_token" value={csrf} />
            <h2 className="h5 mb-3">
              <Icone nom="pencil" taille={16} /> Coordonnées
            </h2>
            <p className="text-muted small">
              Les champs marqués <span className="req">*</span> sont exigés avant toute demande de
              réservation.
            </p>
            <div className="grille grille-2">
              {!particulier ? (
                <Champ
                  label={
                    org.type === "association" ? "Nom de l'association" : "Nom de l'organisation"
                  }
                  name="name"
                  valeur={org.name}
                  requis
                  pleine
                />
              ) : null}
              <Champ
                label={particulier ? "Adresse" : "Adresse postale du siège social"}
                name="address"
                valeur={org.address}
                requis={exige("address")}
                pleine
                autoComplete="street-address"
              />
              <Champ
                label="Code postal"
                name="postal_code"
                valeur={org.postalCode}
                requis={exige("postal_code")}
                autoComplete="postal-code"
              />
              <Champ
                label="Ville"
                name="city"
                valeur={org.city}
                requis={exige("city")}
                autoComplete="address-level2"
              />
              <Champ label="Courriel de contact" name="email" type="email" valeur={org.email} />
              <Champ label="Téléphone" name="phone" type="tel" valeur={org.phone} />
              {!particulier ? (
                <>
                  <Champ
                    label="Site web"
                    name="website"
                    type="url"
                    valeur={org.website}
                    pleine
                    placeholder="https://"
                  />
                  <Champ label="SIRET" name="siret" valeur={org.siret} requis={exige("siret")} />
                  {org.type === "association" ? (
                    <Champ label="N° RNA" name="rna" valeur={org.rna} placeholder="W…" />
                  ) : null}
                </>
              ) : null}
            </div>
            {!particulier ? (
              <>
                <h2 className="h5 mb-3 mt-2">
                  <Icone nom="user-check" taille={16} /> {qualiteRepresentant(org.type)}
                </h2>
                <div className="grille grille-2">
                  <Champ
                    label="Prénom"
                    name="legal_first_name"
                    valeur={org.legalFirstName}
                    requis={exige("legal_first_name")}
                    autoComplete="off"
                  />
                  <Champ
                    label="Nom"
                    name="legal_last_name"
                    valeur={org.legalLastName}
                    requis={exige("legal_last_name")}
                    autoComplete="off"
                  />
                  {org.type === "association" ? (
                    <Champ
                      label="Date de l'AG de nomination"
                      name="legal_appointed_at"
                      type="date"
                      valeur={isoDate(org.legalAppointedAt)}
                      requis={exige("legal_appointed_at")}
                      aide="L'assemblée générale qui a élu le président ou la présidente."
                      pleine
                    />
                  ) : null}
                  {org.type === "association" ? (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <Interrupteur
                        label="Association sportive"
                        name="sportive"
                        coche={org.sportive}
                        aide="Détermine le dossier de demande de subvention (sportif ou non)."
                      />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
            <div className="d-flex justify-content-end">
              <button type="submit" className="btn btn-primary">
                <Icone nom="check" taille={14} /> Enregistrer
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
