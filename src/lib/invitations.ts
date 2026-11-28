/**
 * Ouverture du portail : quelles organisations reçoivent un compte et une invitation. PUR.
 *
 * Tant que le portail est fermé, les agents tiennent les fiches des usagers sans compte d'accès.
 * À l'ouverture (ou plus tard), on crée un compte par organisation qui n'en a pas, à l'adresse
 * de l'organisation et au nom de son représentant, et on lui écrit pour qu'elle choisisse son
 * mot de passe. Une organisation qui a déjà un compte n'est jamais invitée une seconde fois.
 */

export type OrganisationAInviter = {
  id: number;
  name: string;
  type: string;
  email: string | null;
  legalFirstName: string | null;
  legalLastName: string | null;
  /** Nombre de comptes usagers déjà rattachés (actifs ou non). */
  comptes: number;
};

export type Invitation = {
  organisationId: number;
  organisation: string;
  /** Type de l'organisation (pour le décompte par type de la fenêtre de confirmation). */
  type: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type Ecartee = { id: number; name: string; motif: string };

export type TriInvitations = {
  /** Les comptes à créer, un par organisation. */
  invitations: Invitation[];
  /** Les organisations laissées de côté, avec la raison : à corriger sur leur fiche. */
  ecartees: Ecartee[];
  /** Celles qui ont déjà un compte : rien à faire. */
  dejaPourvues: number;
};

const normaliser = (email: string | null) => (email ?? "").trim().toLowerCase();

/** Une adresse plausible (le contrôle fin est celui du formulaire de la fiche). */
function plausible(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Le prénom et le nom du compte : le représentant ; à défaut, le nom de l'organisation. */
export function identiteDuCompte(o: OrganisationAInviter): { firstName: string; lastName: string } {
  const prenom = (o.legalFirstName ?? "").trim();
  const nom = (o.legalLastName ?? "").trim();
  if (prenom || nom) return { firstName: prenom.slice(0, 80), lastName: nom.slice(0, 80) };
  // Un particulier sans représentant saisi : « Prénom Nom » est le nom de sa fiche.
  if (o.type === "particulier") {
    const [premier, ...reste] = o.name.trim().split(/\s+/);
    if (reste.length)
      return { firstName: premier.slice(0, 80), lastName: reste.join(" ").slice(0, 80) };
  }
  return { firstName: "", lastName: o.name.trim().slice(0, 80) };
}

/**
 * Répartit les organisations actives : à inviter, écartées (sans courriel, courriel invalide,
 * courriel déjà pris par un autre compte ou par une organisation mieux placée dans la liste),
 * déjà pourvues. `types` limite l'invitation à certains types d'organisation (null = tous) ;
 * une organisation d'un autre type n'est ni invitée ni signalée.
 */
export function trierInvitations(
  organisations: readonly OrganisationAInviter[],
  emailsPris: ReadonlySet<string>,
  types: readonly string[] | null = null,
): TriInvitations {
  const pris = new Set([...emailsPris].map((e) => e.toLowerCase()));
  const retenus = new Map<string, string>();
  const tri: TriInvitations = { invitations: [], ecartees: [], dejaPourvues: 0 };
  for (const o of organisations) {
    if (types && !types.includes(o.type)) continue;
    if (o.comptes > 0) {
      tri.dejaPourvues += 1;
      continue;
    }
    const email = normaliser(o.email);
    if (!email) {
      tri.ecartees.push({ id: o.id, name: o.name, motif: "aucun courriel sur la fiche" });
      continue;
    }
    if (!plausible(email)) {
      tri.ecartees.push({ id: o.id, name: o.name, motif: `courriel invalide (${email})` });
      continue;
    }
    if (pris.has(email)) {
      tri.ecartees.push({
        id: o.id,
        name: o.name,
        motif: `${email} est déjà l'identifiant d'un autre compte`,
      });
      continue;
    }
    const autre = retenus.get(email);
    if (autre) {
      tri.ecartees.push({
        id: o.id,
        name: o.name,
        motif: `${email} est aussi le courriel de ${autre}, invitée à cette adresse`,
      });
      continue;
    }
    retenus.set(email, o.name);
    tri.invitations.push({
      organisationId: o.id,
      organisation: o.name,
      type: o.type,
      email,
      ...identiteDuCompte(o),
    });
  }
  return tri;
}

/** La durée de validité du lien d'activation, en clair. */
export function validiteEnClair(jours: number): string {
  return jours <= 1 ? "24 heures" : `${jours} jours`;
}

/** Le bilan d'un envoi, en une phrase pour le message de retour. */
export function phraseBilan(b: { invites: number; echecs: number; ecartees: number }): string {
  const morceaux = [
    b.invites
      ? `${b.invites} compte${b.invites > 1 ? "s" : ""} créé${b.invites > 1 ? "s" : ""} et invité${b.invites > 1 ? "s" : ""}`
      : "Aucun compte à créer",
  ];
  if (b.echecs) morceaux.push(`${b.echecs} envoi${b.echecs > 1 ? "s" : ""} en échec`);
  if (b.ecartees)
    morceaux.push(
      `${b.ecartees} organisation${b.ecartees > 1 ? "s" : ""} laissée${b.ecartees > 1 ? "s" : ""} de côté`,
    );
  return `${morceaux.join(", ")}.`;
}
