/**
 * Processus et circuits : lecture des formulaires d'administration et chargement des écrans.
 */
import {
  type Condition,
  CRITERES,
  cleEtape,
  type Definition,
  type Etape,
  INSERTION,
  type Intervenant,
  lireAEcheance,
  lireCondition,
  lireDefinition,
  lireMoment,
  lireObjet,
  lireReunion,
  NATURES,
  type Nature,
  type Objet,
  type Test,
} from "@/lib/circuits";
import { champ, parseFloat_, parseInt_ } from "@/lib/forms-util";
import { prisma } from "@/server/db";
import { UserFacingError } from "@/server/errors";

/** Lit une condition saisie critère par critère (champs `<prefixe>c_<cle>`). */
export function conditionDuFormulaire(form: FormData, prefixe = ""): Condition | null {
  const tests: Test[] = [];
  for (const c of CRITERES) {
    const nom = `${prefixe}c_${c.cle}`;
    if (c.type === "bool") {
      const v = champ(form, nom);
      if (v === "1" || v === "0") tests.push({ champ: c.cle, op: "est", valeur: v === "1" });
    } else if (c.type === "liste") {
      const valeur = form.getAll(nom).map(String).filter(Boolean);
      if (valeur.length) tests.push({ champ: c.cle, op: "parmi", valeur });
    } else {
      const op = champ(form, `${prefixe}o_${c.cle}`);
      const n = parseFloat_(form.get(nom));
      if ((op === "min" || op === "max") && n !== null) tests.push({ champ: c.cle, op, valeur: n });
    }
  }
  return lireCondition({ mode: champ(form, `${prefixe}mode`) === "un" ? "un" : "tous", tests });
}

/** Lit l'intervenant d'une étape : « service:3 », « delegation:1 », « role:elu », « service_dossier »… */
export function intervenantDuFormulaire(form: FormData): Intervenant {
  const [type, valeur] = champ(form, "intervenant").split(":");
  const id = Number(valeur);
  if (type === "service" && id > 0) return { type, id };
  if (type === "delegation" && id > 0) return { type, id };
  if (type === "role" && valeur) return { type, role: valeur };
  if (type === "service_dossier" || type === "responsable_dossier") return { type };
  throw new UserFacingError("Choisissez qui répond à cette étape.");
}

/** Lit la mise en copie d'une étape (même forme que « qui répond ») ; vide = personne. */
export function copieDuFormulaire(form: FormData): Intervenant | null {
  const [type, valeur] = champ(form, "copie").split(":");
  const id = Number(valeur);
  if (type === "service" && id > 0) return { type, id };
  if (type === "delegation" && id > 0) return { type, id };
  if (type === "role" && valeur) return { type, role: valeur };
  if (type === "service_dossier" || type === "responsable_dossier") return { type };
  return null;
}

export function valeurIntervenant(i: Intervenant): string {
  if (i.type === "service" || i.type === "delegation") return `${i.type}:${i.id}`;
  if (i.type === "role") return `role:${i.role}`;
  return i.type;
}

/** Lit une étape saisie ; `existantes` sert à lui donner une clé unique si elle est nouvelle. */
export function etapeDuFormulaire(
  form: FormData,
  existantes: readonly Etape[],
  objet: Objet = "reservation",
): Etape {
  const libelle = champ(form, "libelle").slice(0, 120);
  if (!libelle) throw new UserFacingError("Donnez un libellé à l'étape.");
  const nature = champ(form, "nature") as Nature;
  if (!(nature in NATURES) || !INSERTION[objet].natures.includes(nature))
    throw new UserFacingError("Choisissez la nature de l'étape.");
  if (lireMoment(champ(form, "moment"), objet) === "avis_elus" && nature !== "avis")
    throw new UserFacingError(
      "À l'avis des élus, l'étape est un avis ; un visa ou une relecture se placent avant le vote.",
    );
  const cleSaisie = champ(form, "cle");
  const connue = existantes.find((e) => e.cle === cleSaisie);
  return {
    cle: connue
      ? connue.cle
      : cleEtape(
          libelle,
          existantes.map((e) => e.cle),
        ),
    libelle,
    libelleUsager: champ(form, "libelle_usager").slice(0, 160),
    nature,
    moment: lireMoment(champ(form, "moment"), objet),
    intervenant: intervenantDuFormulaire(form),
    condition: conditionDuFormulaire(form),
    delaiJours: Math.max(0, Math.min(365, parseInt_(form.get("delai_jours"), 0) ?? 0)),
    reunion: lireReunion(champ(form, "reunion")),
    aEcheance: lireAEcheance(champ(form, "a_echeance")),
    copie: copieDuFormulaire(form),
  };
}

/** Un circuit avec ses versions, la plus récente d'abord. */
export async function chargerCircuit(id: number) {
  const c = await prisma.circuit.findUnique({
    where: { id },
    include: { versions: { orderBy: { numero: "desc" } } },
  });
  if (!c) return null;
  const objet = lireObjet(c.objet);
  const publiee = c.versions.find((v) => v.status === "publiee") ?? null;
  const brouillon = c.versions.find((v) => v.status === "brouillon") ?? null;
  const courante = brouillon ?? publiee ?? c.versions[0] ?? null;
  return {
    ...c,
    objet,
    publiee,
    brouillon,
    courante,
    definition: lireDefinition(courante?.definition) as Definition,
    definitionPubliee: publiee ? lireDefinition(publiee.definition) : null,
  };
}

export type CircuitCharge = NonNullable<Awaited<ReturnType<typeof chargerCircuit>>>;

/** Les choix d'intervenant proposés dans le formulaire d'une étape. */
export async function choixIntervenants(): Promise<
  { groupe: string; options: [string, string][] }[]
> {
  const [services, delegations, roles] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    prisma.delegation.findMany({ where: { isActive: true }, orderBy: { label: "asc" } }),
    prisma.role.findMany({ where: { isUsager: false }, orderBy: { id: "asc" } }),
  ]);
  return [
    {
      groupe: "D'après le dossier",
      options: [
        ["service_dossier", "Le service du dossier"],
        ["responsable_dossier", "Le responsable du service du dossier"],
      ],
    },
    { groupe: "Un service", options: services.map((s) => [`service:${s.id}`, s.name]) },
    {
      groupe: "L'élu d'une délégation",
      options: delegations.map((d) => [`delegation:${d.id}`, d.label]),
    },
    { groupe: "Les comptes d'un rôle", options: roles.map((r) => [`role:${r.name}`, r.label]) },
  ].filter((g) => g.options.length) as { groupe: string; options: [string, string][] }[];
}
