import { manquesDossier, phraseManques } from "@/lib/dossier-usager";
import { coche } from "@/lib/forms-util";
import { espacePublic, organisationDe, profilAutorise } from "@/modules/portail/catalogue";
import { lireDemande } from "@/modules/reservations/formulaire";
import { auditRecord } from "@/server/audit";
import { getSettings } from "@/server/config-store";
import { UserFacingError } from "@/server/errors";
import { require as requireFeature } from "@/server/features";
import { requireUsager } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { creerReservation } from "@/server/reservations";

/** Les champs simples qu'on rend au formulaire quand la demande est refusée. */
const CHAMPS_RENDUS = [
  "date",
  "heure_debut",
  "heure_fin",
  "recurrence",
  "freq",
  "interval",
  "until",
  "title",
  "nature_id",
  "participants",
  "description",
  "is_public_event",
];

function retourAvecSaisie(slug: string, form: FormData): string {
  const p = new URLSearchParams();
  for (const k of CHAMPS_RENDUS) {
    const v = form.get(k);
    if (typeof v === "string" && v.trim()) p.set(k, v.slice(0, 500));
  }
  for (const w of form.getAll("weekday")) if (typeof w === "string") p.append("weekday", w);
  const s = p.toString();
  return `/portail/reserver/${slug}${s ? `?${s}` : ""}`;
}

/** POST /portail/reserver/<slug> : dépôt d'une demande de réservation par un usager. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await requireFeature("portail");
  const { slug } = await params;
  const espace = await espacePublic(slug);
  if (!espace) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUsager();
      const retour = retourAvecSaisie(slug, form);
      const cfg = await getSettings();
      const org = await organisationDe(user);
      if (cfg.VALIDATION_COMPTE_USAGER && org && !org.validatedAt)
        return redirigerAvecMessage(
          `/portail/espaces/${slug}`,
          "Votre compte est en attente de validation par la collectivité.",
          "warning",
        );
      if (org && manquesDossier(org, user).length)
        return redirigerAvecMessage(
          "/portail/mon-organisation",
          `Complétez votre dossier avant de déposer une demande. ${phraseManques(manquesDossier(org, user))}`,
          "warning",
        );
      if (!profilAutorise(espace.allowedProfiles, org?.profil?.code ?? null))
        return redirigerAvecMessage(
          `/portail/espaces/${slug}`,
          "Cet espace n'est pas ouvert à votre profil.",
          "warning",
        );
      if (!coche(form, "accepte_reglement"))
        return redirigerAvecMessage(
          retour,
          "Merci de lire et d'accepter le règlement pour envoyer votre demande.",
          "danger",
        );
      try {
        const d = lireDemande(form, {
          organisationId: user.organisationId,
          userId: user.id,
          source: "portail",
          agent: false,
        });
        if (d.espaceId !== espace.id) throw new UserFacingError("Espace incohérent.");
        const r = await creerReservation(d, user.email);
        await auditRecord(
          "demande portail",
          `${r.numero} · ${r.title}`,
          "reservations",
          user.email,
        );
        return redirigerAvecMessage(
          `/portail/mes-reservations/${r.id}`,
          r.status === "confirmee"
            ? "Votre réservation est confirmée !"
            : "Demande envoyée : vous recevrez une réponse par courriel.",
          "success",
        );
      } catch (e) {
        if (e instanceof UserFacingError) {
          // Créneau occupé : la page propose l'inscription en liste d'attente.
          const attente = e.message.startsWith("Créneau indisponible")
            ? `${retour}${retour.includes("?") ? "&" : "?"}attente=1`
            : retour;
          return redirigerAvecMessage(attente, e.message, "danger");
        }
        throw e;
      }
    },
    `/portail/reserver/${slug}`,
  );
}
