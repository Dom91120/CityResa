/**
 * Le contrat d'engagement républicain des associations et fondations bénéficiant de subventions
 * publiques ou d'un agrément de l'État (loi n° 2021-1109 du 24 août 2021, décret n° 2021-1947 du
 * 31 décembre 2021), tel qu'il est annexé au dossier de demande de subvention de la Ville.
 */

export const CONTRAT_PREAMBULE: readonly string[] = [
  "L'importance des associations et des fondations dans la vie de la Nation et leur contribution à l'intérêt général justifient que les autorités administratives décident de leur apporter un soutien financier ou matériel. Il en va de même pour les fédérations sportives et les ligues professionnelles. L'administration, qui doit elle-même rendre des comptes aux citoyens, justifier du bon usage des deniers publics et de la reconnaissance qu'elle peut attribuer, est fondée à s'assurer que les organismes bénéficiaires de subventions publiques ou d'un agrément respectent le pacte républicain.",
  "À cette fin, la loi n°2021-1109 du 24 août 2021 confortant le respect des principes de la République a institué le contrat d'engagement républicain.",
  "Conformément aux dispositions des articles 10-1 et 25-1 de la loi n°2000-321 du 12 avril 2000 relative aux droits des citoyens dans leurs relations avec les administrations, le présent contrat a pour objet de préciser les engagements que prend toute association ou fondation qui sollicite une subvention publique ou un agrément de l'État. Ainsi, l'association ou la fondation « s'engage (...) à respecter les principes de liberté, d'égalité, de fraternité et de dignité de la personne humaine ainsi que les symboles de la République (...) », « à ne pas remettre en cause le caractère laïc de la République » et « à s'abstenir de toute action portant atteinte à l'ordre public ».",
  "Ces engagements sont souscrits dans le respect des libertés constitutionnellement reconnues, notamment la liberté d'association et la liberté d'expression dont découlent la liberté de se réunir, de manifester et de création.",
];

export const CONTRAT_ENGAGEMENTS: readonly { titre: string; paragraphes: readonly string[] }[] = [
  {
    titre: "ENGAGEMENT N° 1 : RESPECT DES LOIS DE LA RÉPUBLIQUE",
    paragraphes: [
      "Le respect des lois de la République s'impose aux associations et aux fondations, qui ne doivent entreprendre ni inciter à aucune action manifestement contraire à la loi, violente ou susceptible d'entraîner des troubles graves à l'ordre public.",
      "L'association ou la fondation bénéficiaire s'engage à ne pas se prévaloir de convictions politiques, philosophiques ou religieuses pour s'affranchir des règles communes régissant ses relations avec les collectivités publiques.",
      "Elle s'engage notamment à ne pas remettre en cause le caractère laïc de la République.",
    ],
  },
  {
    titre: "ENGAGEMENT N° 2 : LIBERTÉ DE CONSCIENCE",
    paragraphes: [
      "L'association ou la fondation s'engage à respecter et protéger la liberté de conscience de ses membres et des tiers, notamment des bénéficiaires de ses services, et s'abstient de tout acte de prosélytisme abusif exercé notamment sous la contrainte, la menace ou la pression.",
      "Cet engagement ne fait pas obstacle à ce que les associations ou fondations dont l'objet est fondé sur des convictions, notamment religieuses, requièrent de leurs membres une adhésion loyale à l'égard des valeurs ou des croyances de l'organisation.",
    ],
  },
  {
    titre: "ENGAGEMENT N° 3 : LIBERTÉ DES MEMBRES DE L'ASSOCIATION",
    paragraphes: [
      "L'association s'engage à respecter la liberté de ses membres de s'en retirer dans les conditions prévues à l'article 4 de la loi du 1er juillet 1901 et leur droit de ne pas en être arbitrairement exclu.",
    ],
  },
  {
    titre: "ENGAGEMENT N° 4 : ÉGALITÉ ET NON-DISCRIMINATION",
    paragraphes: [
      "L'association ou la fondation s'engage à respecter l'égalité de tous devant la loi.",
      "Elle s'engage, dans son fonctionnement interne comme dans ses rapports avec les tiers, à ne pas opérer de différences de traitement fondées sur le sexe, l'orientation sexuelle, l'identité de genre, l'appartenance réelle ou supposée à une ethnie, une Nation, une prétendue race ou une religion déterminée qui ne reposeraient pas sur une différence de situation objective en rapport avec l'objet statutaire licite qu'elle poursuit, ni cautionner ou encourager de telles discriminations.",
      "Elle prend les mesures, compte tenu des moyens dont elle dispose, permettant de lutter contre toute forme de violence à caractère sexuel ou sexiste.",
    ],
  },
  {
    titre: "ENGAGEMENT N° 5 : FRATERNITÉ ET PRÉVENTION DE LA VIOLENCE",
    paragraphes: [
      "L'association ou la fondation s'engage à agir dans un esprit de fraternité et de civisme.",
      "Dans son activité, dans son fonctionnement interne comme dans ses rapports avec les tiers, l'association s'engage à ne pas provoquer à la haine ou à la violence envers quiconque et à ne pas cautionner de tels agissements. Elle s'engage à rejeter toutes formes de racisme et d'antisémitisme.",
    ],
  },
  {
    titre: "ENGAGEMENT N° 6 : RESPECT DE LA DIGNITÉ DE LA PERSONNE HUMAINE",
    paragraphes: [
      "L'association ou la fondation s'engage à n'entreprendre, ne soutenir, ni cautionner aucune action de nature à porter atteinte à la sauvegarde de la dignité de la personne humaine.",
      "Elle s'engage à respecter les lois et règlements en vigueur destinés à protéger la santé et l'intégrité physique et psychique de ses membres et des bénéficiaires de ses services et ses activités, et à ne pas mettre en danger la vie d'autrui par ses agissements ou sa négligence.",
      "Elle s'engage à ne pas créer, maintenir ou exploiter la vulnérabilité psychologique ou physique de ses membres et des personnes qui participent à ses activités à quelque titre que ce soit, notamment des personnes en situation de handicap, que ce soit par des pressions ou des tentatives d'endoctrinement.",
      "Elle s'engage en particulier à n'entreprendre aucune action de nature à compromettre le développement physique, affectif, intellectuel et social des mineurs, ainsi que leur santé et leur sécurité.",
    ],
  },
  {
    titre: "ENGAGEMENT N° 7 : RESPECT DES SYMBOLES DE LA RÉPUBLIQUE",
    paragraphes: [
      "L'association s'engage à respecter le drapeau tricolore, l'hymne national, et la devise de la République.",
    ],
  },
];
