/**
 * Lecture d'une demande de réservation depuis un formulaire (back-office ET portail) :
 * le même vocabulaire de champs partout.
 *
 *   espace_id · date (YYYY-MM-DD) · heure_debut / heure_fin (HH:MM)
 *   recurrence=on · freq (daily|weekly|monthly) · interval · until (YYYY-MM-DD) · weekday (1-7, multiple)
 *   · except (YYYY-MM-DD, multiple) · hors_vacances · hors_feries
 *   title · nature_id · description · participants · is_public_event
 *   option_<id> = quantité (vide / 0 = non retenue) · materiel_<id> = quantité
 *   organisation_id · gratuit · ignorer_delai · statut_initial  (back-office seulement)
 */
import type { Intervalle, Recurrence } from "@/lib/creneaux";
import { champ, champOuNull, coche, idOuNull, parseInt_ } from "@/lib/forms-util";
import { parisDateTimeToInstant } from "@/lib/paris-time";
import { UserFacingError } from "@/server/errors";
import type { DemandeEntree } from "@/server/reservations";

export function lireCreneau(form: FormData): Intervalle {
  const date = champ(form, "date");
  const debut = parisDateTimeToInstant(date, champ(form, "heure_debut"));
  const fin = parisDateTimeToInstant(date, champ(form, "heure_fin"));
  if (!debut || !fin)
    throw new UserFacingError("Indiquez la date, l'heure de début et l'heure de fin.");
  // Une fin « 00:00 » ou avant le début = le lendemain (soirée qui finit après minuit).
  const finReelle = fin <= debut ? new Date(fin.getTime() + 86_400_000) : fin;
  return { startAt: debut, endAt: finReelle };
}

export function lireRecurrenceForm(form: FormData): Recurrence | null {
  if (!coche(form, "recurrence")) return null;
  const freq = champ(form, "freq");
  if (freq !== "daily" && freq !== "weekly" && freq !== "monthly") return null;
  const rec: Recurrence = { freq };
  const interval = parseInt_(form.get("interval"), 1, 1);
  if (interval && interval > 1) rec.interval = Math.min(interval, 12);
  const until = champ(form, "until");
  if (/^\d{4}-\d{2}-\d{2}$/.test(until)) rec.until = until;
  const count = parseInt_(form.get("count"), null, 1);
  if (!rec.until && count) rec.count = Math.min(count, 200);
  if (freq === "weekly") {
    const jours = form
      .getAll("weekday")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
    if (jours.length) rec.byWeekday = jours;
  }
  const except = form
    .getAll("except")
    .map(String)
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
  if (except.length) rec.except = except;
  if (coche(form, "hors_vacances")) rec.horsVacances = true;
  if (coche(form, "hors_feries")) rec.horsFeries = true;
  if (!rec.until && !rec.count)
    throw new UserFacingError("Indiquez la date de fin de la récurrence.");
  return rec;
}

/** Les options et le matériel cochés : option_<id>=qté, materiel_<id>=qté. */
export function lireChoix(
  form: FormData,
  prefixe: "option" | "materiel",
): { id: number; quantite: number }[] {
  const out: { id: number; quantite: number }[] = [];
  for (const [k, v] of form.entries()) {
    const m = new RegExp(`^${prefixe}_(\\d+)$`).exec(k);
    if (!m || typeof v !== "string") continue;
    const q = v === "on" ? 1 : (parseInt_(v, 0, 0) ?? 0);
    if (q > 0) out.push({ id: Number(m[1]), quantite: q });
  }
  return out;
}

export type LectureDemande = {
  /** L'auteur côté portail : son organisation et son compte. */
  organisationId: number | null;
  userId: string | null;
  source: "portail" | "backoffice";
  /** Un agent peut passer outre les délais et accorder la gratuité. */
  agent: boolean;
};

export function lireDemande(form: FormData, ctx: LectureDemande): DemandeEntree {
  const espaceId = idOuNull(form, "espace_id");
  if (!espaceId) throw new UserFacingError("Choisissez un espace.");
  const premier = lireCreneau(form);
  const recurrence = lireRecurrenceForm(form);
  const statut = champ(form, "statut_initial");
  return {
    espaceId,
    title: champ(form, "title"),
    natureId: idOuNull(form, "nature_id"),
    description: champOuNull(form, "description"),
    participants: parseInt_(form.get("participants"), null, 0),
    isPublicEvent: coche(form, "is_public_event"),
    premier,
    recurrence,
    options: lireChoix(form, "option").map((o) => ({ optionId: o.id, quantite: o.quantite })),
    materiels: lireChoix(form, "materiel").map((m) => ({ materielId: m.id, quantite: m.quantite })),
    organisationId: ctx.agent
      ? (idOuNull(form, "organisation_id") ?? ctx.organisationId)
      : ctx.organisationId,
    userId: ctx.userId,
    source: ctx.source,
    gratuit: ctx.agent ? coche(form, "gratuit") : false,
    ignorerDelai: ctx.agent ? coche(form, "ignorer_delai") : false,
    statutInitial:
      ctx.agent && (statut === "confirmee" || statut === "a_traiter" || statut === "acceptee")
        ? statut
        : undefined,
  };
}
