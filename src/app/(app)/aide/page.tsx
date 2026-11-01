import { Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip, Frise } from "@/components/macros";
import { RESERVATION_STATUS, ROLE_SEEDS } from "@/lib/constantes";
import { contextePage } from "@/server/page";

export const metadata = { title: "Astuces - CityRésa" };

const ETAPES_DEMANDE: { statut: keyof typeof RESERVATION_STATUS; qui: string; quoi: string }[] = [
  {
    statut: "a_traiter",
    qui: "L'usager (portail) ou un agent",
    quoi: "dépose la demande : espace, créneau(x), objet, options, matériel. Le devis se calcule en direct.",
  },
  {
    statut: "en_traitement",
    qui: "L'agent de l'espace",
    quoi: "demande des précisions par le fil de discussion ; l'usager répond depuis son espace.",
  },
  {
    statut: "acceptee",
    qui: "L'agent",
    quoi: "accepte : la convention est générée et envoyée pour signature électronique (code par SMS ou courriel).",
  },
  {
    statut: "signee",
    qui: "L'usager",
    quoi: "signe la convention ; l'acompte éventuel est facturé.",
  },
  {
    statut: "confirmee",
    qui: "Le système ou l'agent",
    quoi: "confirme : l'espace est réservé, les rappels J-7 et J-1 partent automatiquement.",
  },
  {
    statut: "terminee",
    qui: "Le système",
    quoi: "clôture après l'événement ; le solde est facturé, puis le dossier est archivé.",
  },
];

const FAQ: { q: string; r: React.ReactNode; lien?: [string, string] }[] = [
  {
    q: "Comment approuver une demande ?",
    r: "Ouvrez la demande depuis Réservations (onglet À traiter) ou la notification, vérifiez le créneau (les conflits sont signalés), ajustez les montants si besoin puis cliquez sur Accepter. Vous pouvez aussi Confirmer directement quand aucune signature n'est nécessaire.",
    lien: ["/reservations?statut=a_traiter", "Demandes à traiter"],
  },
  {
    q: "Comment fonctionne la signature électronique ?",
    r: "À l'acceptation, la convention PDF est générée et l'usager reçoit un lien. Il saisit un code à usage unique reçu par SMS (ou courriel). La convention signée, horodatée avec l'adresse IP, est jointe au dossier. Relance automatique après quelques jours sans signature.",
    lien: ["/parametres#reservations", "Délais et relances"],
  },
  {
    q: "Quand les factures sont-elles émises ?",
    r: "L'acompte à la signature, le solde à la clôture, la caution à la demande. Depuis Paiements, enregistrez un règlement (régie, virement, chèque, mandat) : l'usager reçoit un accusé. Une facture peut être annulée par un avoir.",
    lien: ["/paiements", "Paiements"],
  },
  {
    q: "Comment lire le planning ?",
    r: "Une couleur par espace, les demandes en attente hachurées, les indisponibilités (travaux, fermetures) grisées. Filtrez par site ou par espace, passez en vue jour, semaine ou mois, et créez une réservation en cliquant sur un créneau libre.",
    lien: ["/planning", "Planning"],
  },
  {
    q: "Comment gérer le matériel ?",
    r: "Chaque matériel a un stock total ; une demande réserve une quantité sur ses créneaux et la disponibilité restante est vérifiée automatiquement. Le matériel se facture gratuitement, au forfait, à l'unité ou par jour.",
    lien: ["/materiel", "Matériel"],
  },
  {
    q: "Et les demandes de subvention ?",
    r: "Les associations déposent leur demande depuis le portail (module ASSO). Les instructeurs complètent, les élus donnent un avis, puis la décision (votée, refusée) et le versement sont enregistrés et notifiés.",
    lien: ["/subventions", "Subventions"],
  },
  {
    q: "Comment valider un nouvel usager ?",
    r: "Les organisations inscrites depuis le portail apparaissent dans Usagers › À valider. Vérifiez les pièces (statuts, assurance) puis cliquez sur Valider : les membres sont prévenus et bénéficient des tarifs de leur profil.",
    lien: ["/usagers?type=a_valider", "Usagers à valider"],
  },
  {
    q: "Un raccourci pour tout retrouver ?",
    r: (
      <>
        <kbd>Ctrl</kbd> + <kbd>K</kbd> ouvre la recherche globale : numéro de dossier, nom d'usager,
        courriel, espace, matériel. Les listes gardent vos filtres et votre taille de page.
      </>
    ),
    lien: ["/recherche", "Recherche"],
  },
];

export default async function AidePage() {
  const page = await contextePage();
  const roles = ROLE_SEEDS.filter((r) => !r.isUsager);
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Astuces</h1>
          <p className="page-subtitle">
            Le parcours d'une demande, qui fait quoi, et les réponses aux questions courantes.
          </p>
        </div>
        <div className="page-actions">
          {page.user.canEdit("reservations") ? (
            <a href="/reservations/nouvelle" className="btn btn-primary">
              <Icone nom="plus" taille={14} /> Nouvelle réservation
            </a>
          ) : null}
        </div>
      </div>

      <Section titre="Le parcours d'une demande" icone="clipboard-list">
        <div className="mb-3">
          <Frise status="signee" grande />
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Étape</th>
                <th>Qui</th>
                <th>Quoi</th>
              </tr>
            </thead>
            <tbody>
              {ETAPES_DEMANDE.map((e) => (
                <tr key={e.statut}>
                  <td>
                    <Chip teinte={RESERVATION_STATUS[e.statut].teinte}>
                      {RESERVATION_STATUS[e.statut].label}
                    </Chip>
                  </td>
                  <td className="small fw-medium">{e.qui}</td>
                  <td className="small">{e.quoi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small text-muted mt-2 mb-0">
          Une demande peut être <Chip teinte="red">Refusée</Chip> ou{" "}
          <Chip teinte="red">Annulée</Chip> à tout moment avant l'événement ; l'usager est prévenu
          avec le motif.
        </p>
      </Section>

      <Section titre="Qui fait quoi" icone="contact-round">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <tbody>
              {roles.map((r) => (
                <tr key={r.name}>
                  <td style={{ width: 180 }}>
                    <Chip teinte={r.isAdmin ? "rose" : "sky"}>{r.label}</Chip>
                  </td>
                  <td className="small">{r.description}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <Chip teinte="amber">Usager</Chip>
                </td>
                <td className="small">
                  Dépose et suit ses demandes depuis le portail, signe les conventions, consulte ses
                  factures et pièces.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small text-muted mt-2 mb-0">
          Un agent peut être limité à certains espaces (Mon équipe › Espaces gérés) : il ne voit et
          ne traite que ceux-là, et reçoit leurs notifications.
          {page.user.isAdmin ? (
            <>
              {" "}
              Réglez les niveaux par domaine dans <a href="/roles">Rôles &amp; permissions</a>.
            </>
          ) : null}
        </p>
      </Section>

      <Section titre="Questions fréquentes" icone="lightbulb">
        <div className="d-flex flex-column gap-2">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="border rounded px-3 py-2"
              style={{ borderColor: "var(--line)" }}
            >
              <summary className="fw-medium" style={{ cursor: "pointer" }}>
                {f.q}
              </summary>
              <div className="small mt-2">{f.r}</div>
              {f.lien ? (
                <a href={f.lien[0]} className="small d-inline-flex align-items-center gap-1 mt-2">
                  <Icone nom="arrow-right" taille={12} /> {f.lien[1]}
                </a>
              ) : null}
            </details>
          ))}
        </div>
      </Section>

      <Section titre="Les écrans" icone="layout-dashboard" ouverte={false}>
        <div className="coches">
          {[
            ["/", "Tableau de bord", "layout-dashboard"],
            ["/reservations", "Réservations", "clipboard-list"],
            ["/planning", "Planning", "calendar-days"],
            ["/espaces", "Espaces", "door-open"],
            ["/usagers", "Usagers", "users"],
            ["/equipe", "Mon équipe", "contact-round"],
            ["/notifications", "Notifications", "bell"],
            ["/profil", "Mon profil", "circle-user"],
          ].map(([href, label, icone]) => (
            <a key={href} href={href} className="chip chip-slate">
              <Icone nom={icone} taille={12} /> {label}
            </a>
          ))}
        </div>
      </Section>
    </>
  );
}
