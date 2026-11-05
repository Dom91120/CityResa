import { notFound } from "next/navigation";
import { Entete, MenuLien, MenuPost, MenuSep } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { StatutResa } from "@/components/macros";
import { ScriptDiffere } from "@/components/scripts";
import { isoParis, nomCourt, plage } from "@/lib/libelles";
import {
  CarteDecision,
  FilDiscussion,
  ModalesDecision,
  PanneauApprobation,
  SectionConvention,
  SectionDemandeur,
  SectionDocuments,
  SectionEvenement,
  SectionFactures,
  SectionHistorique,
  SectionMontants,
} from "@/modules/reservations/fiche";
import { voitEspace } from "@/modules/reservations/requetes";
import { agentsActifs, materielsPour, optionsPour } from "@/modules/reservations/saisie";
import { prisma } from "@/server/db";
import { docCategories, forParent } from "@/server/documents";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";
import { invalidateNavCounts } from "@/server/nav";
import { chargerReservation, deviser } from "@/server/reservations";

export const metadata = { title: "Réservation - CityRésa" };

export default async function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("reservations");
  const id = idDeRoute((await params).id);
  const r = await chargerReservation(id);
  if (!r) notFound();
  if (!voitEspace(page.user, r.espaceId))
    redirigerAvecFlashDepuisRendu(
      "/reservations",
      "Ce dossier ne relève pas des espaces dont vous avez la charge.",
      "danger",
    );
  const { user, csrf, features } = page;
  const peutEditer = user.canEdit("reservations");
  const peutDecider = user.gereEspace(r.espaceId);
  const aTraiter = r.status === "a_traiter" || r.status === "en_traitement";

  const [
    messages,
    histories,
    documents,
    documentsUsager,
    agents,
    categories,
    options,
    materiels,
    devis,
  ] = await Promise.all([
    prisma.message.findMany({
      where: { reservationId: id },
      include: { author: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.reservationHistory.findMany({
      where: { reservationId: id },
      orderBy: { performedAt: "desc" },
    }),
    features.documents ? forParent("reservation", id) : [],
    features.documents && r.organisationId ? forParent("organisation", r.organisationId) : [],
    agentsActifs(),
    features.documents ? docCategories() : [],
    aTraiter && peutDecider
      ? optionsPour(
          r.espaceId,
          r.options.map((o) => o.optionId),
        )
      : [],
    aTraiter && peutDecider
      ? materielsPour(
          user,
          { de: r.startAt, a: r.endAt },
          r.id,
          r.materiels.map((m) => m.materielId),
        )
      : [],
    deviser(
      r.espaceId,
      r.organisation?.profilId ?? null,
      r.creneaux.filter((c) => c.status === "prevu"),
      r.options.map((o) => ({ optionId: o.optionId, quantite: o.quantite })),
      r.materiels.map((m) => ({ materielId: m.materielId, quantite: m.quantite })),
      r.gratuit,
    ),
  ]);

  // Les messages de l'usager sont lus dès que l'agent ouvre le dossier.
  if (messages.some((m) => m.authorKind === "usager" && !m.readAt)) {
    await prisma.message.updateMany({
      where: { reservationId: id, authorKind: "usager", readAt: null },
      data: { readAt: new Date() },
    });
    invalidateNavCounts();
  }

  const nb = r.creneaux.filter((c) => c.status === "prevu").length;
  const supprimable = user.isAdmin && ["brouillon", "annulee", "refusee"].includes(r.status);
  const datePlanning = isoParis(r.startAt).date;

  return (
    <>
      <Entete
        retour="/reservations"
        titre={<>Réservation N°{r.numero}</>}
        badges={
          <span className="ms-2">
            <StatutResa status={r.status} lg />
          </span>
        }
        sousTitre={
          <>
            <Icone nom="door-open" taille={13} /> {nomCourt(r.espace)} · {r.espace.site.name} ·{" "}
            <Icone nom="calendar-days" taille={13} /> {plage(r.startAt, r.endAt)}
            {nb > 1 ? ` (${nb} créneaux)` : ""} · {r.title}
          </>
        }
        actions={
          peutEditer ? (
            <a
              href="#discussion"
              className="btn btn-outline-secondary"
              data-cible-ancre="#fil-saisie-texte"
            >
              <Icone nom="message-circle" taille={14} /> Envoyer un message
            </a>
          ) : null
        }
        menu={[
          peutEditer ? (
            <MenuLien
              key="modifier"
              url={`/reservations/${r.id}/modifier`}
              libelle="Modifier le dossier"
              icone="pencil"
            />
          ) : null,
          <MenuLien
            key="pdf"
            url={`/reservations/${r.id}/convention.pdf`}
            libelle="Convention (PDF)"
            icone="file-signature"
            cible="_blank"
          />,
          <MenuLien
            key="planning"
            url={`/planning?espace=${r.espaceId}&date=${datePlanning}`}
            libelle="Planning de l'espace"
            icone="calendar-days"
          />,
          <MenuLien
            key="usager"
            url={r.organisationId ? `/usagers/${r.organisationId}` : "/usagers"}
            libelle="Fiche de l'usager"
            icone="users"
          />,
          supprimable ? <MenuSep key="sep" /> : null,
          supprimable ? (
            <MenuPost
              key="supprimer"
              url={`/reservations/${r.id}/supprimer`}
              libelle="Supprimer le dossier"
              icone="trash-2"
              csrf={csrf}
              danger
              confirm={`Supprimer définitivement le dossier ${r.numero} ? Les créneaux, messages et pièces sont effacés.`}
            />
          ) : null,
        ]}
      />

      <div className="fiche-colonnes">
        <div className="d-flex flex-column gap-3">
          <CarteDecision r={r} csrf={csrf} peutDecider={peutDecider} features={features} />
          <FilDiscussion r={r} messages={messages} csrf={csrf} peutEcrire={peutEditer} />
        </div>
        <div className="data-card">
          <SectionEvenement
            r={r}
            csrf={csrf}
            agents={agents}
            peutEditer={peutEditer}
            peutDecider={peutDecider}
          />
          <SectionDemandeur r={r} />
          <SectionMontants
            r={r}
            devis={devis}
            csrf={csrf}
            peutEditer={peutDecider}
            tvaTaux={user.settings.TVA_TAUX}
          />
          {features.documents ? (
            <SectionDocuments
              r={r}
              documents={documents}
              documentsUsager={documentsUsager}
              categories={categories}
              csrf={csrf}
              peutEditer={peutEditer}
              peutSupprimer={user.canDelete("reservations")}
            />
          ) : null}
          <SectionConvention r={r} features={features} csrf={csrf} peutDecider={peutDecider} />
          {features.paiements && user.canView("paiements") ? (
            <SectionFactures
              r={r}
              csrf={csrf}
              peutFacturer={peutDecider && user.canEdit("paiements")}
            />
          ) : null}
          <SectionHistorique histories={histories} />
        </div>
      </div>

      {peutDecider ? <ModalesDecision r={r} csrf={csrf} /> : null}
      {peutDecider && aTraiter ? (
        <PanneauApprobation
          r={r}
          csrf={csrf}
          options={options}
          materiels={materiels}
          features={features}
        />
      ) : null}
      <ScriptDiffere src="/js/reservations.js" nonce={page.nonce} />
    </>
  );
}
