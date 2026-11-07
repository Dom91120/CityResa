/**
 * Les pièces à joindre au dossier de demande de subvention (fiche « Pièces à joindre » du
 * dossier de la Ville), avec la condition de chacune. Logique PURE : testée dans
 * pieces-subvention.test.ts.
 */

export type ConditionPiece =
  | "toutes"
  | "renouvellement"
  | "premiere"
  | "changement"
  | "commissaire"
  | "mandataire"
  | "action";

export type Piece = {
  /** Le `kind` du document (DOCUMENT_KINDS). */
  kind: string;
  libelle: string;
  condition: ConditionPiece;
  aide?: string;
};

export const PIECES: Piece[] = [
  {
    kind: "pv_ag",
    libelle: "Dernier procès-verbal d'assemblée générale",
    condition: "toutes",
    aide: "Avec le rapport moral, le rapport d'activité et le rapport financier, documents comptables inclus.",
  },
  {
    kind: "comptes",
    libelle: "Comptes approuvés du dernier exercice clos",
    condition: "toutes",
  },
  {
    kind: "rib",
    libelle: "Relevé d'identité bancaire ou postal de l'association",
    condition: "toutes",
    aide: "Récent, à l'adresse à jour du siège.",
  },
  {
    kind: "compte_rendu",
    libelle: "Compte rendu financier et qualitatif des actions subventionnées l'an dernier",
    condition: "renouvellement",
    aide: "Arrêté du 24 mai 2005 : pour chaque action spécifique subventionnée.",
  },
  {
    kind: "rapport_cac",
    libelle: "Rapport du commissaire aux comptes",
    condition: "commissaire",
    aide: "Obligatoire au-delà de 153 000 € de dons ou de subventions par an.",
  },
  {
    kind: "statuts",
    libelle: "Statuts déclarés et récépissé de déclaration en préfecture",
    condition: "premiere",
  },
  {
    kind: "composition_ca",
    libelle: "Liste des membres élus (conseil d'administration ou bureau)",
    condition: "premiere",
  },
  {
    kind: "statuts",
    libelle: "Statuts modifiés depuis la dernière demande",
    condition: "changement",
  },
  {
    kind: "composition_ca",
    libelle: "Nouvelle composition du conseil d'administration",
    condition: "changement",
  },
  {
    kind: "pouvoir",
    libelle: "Pouvoir du représentant légal au signataire",
    condition: "mandataire",
    aide: "Portant les deux signatures.",
  },
  {
    kind: "projet_action",
    libelle: "Projet financier des actions spécifiques",
    condition: "action",
    aide: "Pour une demande de subvention d'action.",
  },
];

export type ContextePieces = {
  nature: "premiere" | "renouvellement";
  commissaireAuxComptes: boolean;
  mandataire: boolean;
  /** Statuts ou conseil d'administration modifiés depuis la dernière demande. */
  changement: boolean;
  /** Le dossier décrit au moins une action spécifique. */
  actions: boolean;
};

function sapplique(c: ConditionPiece, ctx: ContextePieces): boolean {
  switch (c) {
    case "toutes":
      return true;
    case "renouvellement":
      return ctx.nature === "renouvellement";
    case "premiere":
      return ctx.nature === "premiere";
    case "changement":
      return ctx.nature === "renouvellement" && ctx.changement;
    case "commissaire":
      return ctx.commissaireAuxComptes;
    case "mandataire":
      return ctx.mandataire;
    case "action":
      return ctx.actions;
  }
}

/** Les pièces attendues dans ce cas, sans doublon de `kind`. */
export function piecesRequises(ctx: ContextePieces): Piece[] {
  const vues = new Set<string>();
  const out: Piece[] = [];
  for (const piece of PIECES) {
    if (!sapplique(piece.condition, ctx) || vues.has(piece.kind)) continue;
    vues.add(piece.kind);
    out.push(piece);
  }
  return out;
}

/** Les pièces attendues dont aucun document du `kind` n'est fourni. */
export function piecesManquantes(ctx: ContextePieces, kindsFournis: readonly string[]): Piece[] {
  const fournis = new Set(kindsFournis);
  return piecesRequises(ctx).filter((p) => !fournis.has(p.kind));
}
