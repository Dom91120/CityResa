# CityRésa — cahier des charges fonctionnel

Gestion des réservations des espaces municipaux (salles, équipements sportifs, matériel), des
usagers (associations, entreprises, particuliers, services de la ville) et des demandes de
subvention des associations, pour la **Ville de Châtillon (Hauts-de-Seine, 92320)**.

Ce document décrit le périmètre fonctionnel livré par CityRésa, ses règles de gestion, et la
façon dont il couvre le cahier des charges d'origine (notes de cadrage, charte graphique et
présentations de solutions du marché). Les conventions techniques sont dans
`docs/CONVENTIONS.md`, le déploiement dans `docs/DEPLOY.md`.

---

## 1. Contexte

La ville met à disposition de ses habitants, de ses associations, des entreprises et de ses
propres services ses salles (Espace Maison Blanche : salle polyvalente de 600 m² et trois salles
de réunion ; salles Gabriel Péri, Henri Matisse et de la Folie Desmares ; chalet des quatre
vents) et ses équipements sportifs (gymnases les Sablons, Gambetta et République, complexes
Roland Garros et Langevin Wallon, salle sportive Marcel Doret, stade Guy Môquet, terrain
multisport), ainsi que du matériel (tables, chaises, sonorisation, barnums, grilles d'exposition).

Jusqu'ici, les demandes arrivaient par courriel, téléphone ou formulaire papier ; les plannings
étaient tenus par chaque service dans un agenda séparé ; conventions et factures étaient
rédigées à la main. Les demandes de subvention des associations suivaient un circuit papier
distinct.

CityRésa centralise l'ensemble :

- un **portail public** où l'on consulte le catalogue, les disponibilités et les tarifs, où l'on
  crée son compte et où l'on dépose et suit ses demandes ;
- un **back-office** pour les agents : traitement des demandes, planning, conventions, signature
  électronique, facturation, usagers, matériel, statistiques, paramétrage ;
- un **module ASSO** : dépôt et instruction des demandes de subvention, avis des élus, vote,
  versement.

Les règles de la collectivité (horaires, délais, tarifs par profil, caution, acompte, textes
des courriels et de la convention) sont **paramétrables** sans intervention technique.

---

## 2. Acteurs

| Acteur | Population | Ce qu'il fait |
| --- | --- | --- |
| **Usager particulier** (de la commune ou extérieur) | Portail | Consulte le catalogue, réserve pour une fête familiale, une activité ; signe sa convention ; règle ses factures ; suit ses dossiers. |
| **Association** (de la commune ou extérieure) | Portail | Idem, avec des créneaux récurrents (saison) ; souvent à titre gracieux ; dépose ses demandes de subvention (module ASSO) ; gère la fiche et les pièces de l'organisation (statuts, assurance). |
| **Entreprise** | Portail | Réserve pour séminaires, formations, événements ; tarifs entreprise ; facturation. |
| **Service interne** (service de la ville, autre collectivité) | Portail ou back-office | Réserve pour l'usage municipal (conseil, cérémonies, forum) ; gratuité ; priorité. |
| **Agent** | Back-office | Traite les demandes des espaces dont il a la charge, répond aux messages, bloque des créneaux ; pas de suppression. |
| **Gestionnaire** | Back-office | Tout le métier : espaces, tarifs, matériel, usagers, réservations, factures, subventions ; peut supprimer. |
| **Financier** | Back-office | Suit factures et paiements, consulte le reste. |
| **Élu** | Back-office | Consulte l'activité (tableaux de bord), donne un **avis** sur les demandes de subvention ; la décision (vote, refus, versement) est saisie par les agents. |
| **Administrateur** | Back-office | Paramètres, utilisateurs et rôles, référentiels, modèles de courriel, sauvegardes, audit. |
| **Lecteur** | Back-office | Lecture seule. |

Les droits se règlent **par rôle et par catégorie** (réservations, planning, sites et espaces,
matériel, usagers, messages, paiements, subventions, mon équipe, personnel de service) sur
quatre niveaux (aucun,
lecture, écriture, suppression). Un agent peut en plus être rattaché à des espaces
(gestionnaire, lecteur ou simplement notifié) : c'est la **gestion des accès par service ou
par lieu** demandée par le cahier des charges.

Chaque agent porte un **secteur** (Salles ou Sports), ou aucun : il est alors transversal
(administrateur, financier, élu). Un agent d'un secteur ne se rattache qu'aux espaces de ce
secteur ; sans aucun rattachement, son périmètre est l'ensemble des espaces de son secteur
(tous les espaces pour un agent transversal). « Mon équipe » montre à un gestionnaire ses collègues du
même secteur et les agents transversaux, sans les administrateurs, pour répartir les espaces ;
les autres rôles ne l'ont pas par défaut. L'administrateur a la même liste, complète, dans
Administration › « Comptes », où il crée et gère les comptes du back-office. Les comptes des
usagers se gèrent depuis la fiche de leur organisation (ajout, modification, réinitialisation,
désactivation, anonymisation), la double authentification et la suppression définitive restant
à l'administrateur depuis la fiche du compte. Le secteur d'un agent ou
d'un espace ne se change pas tant que des rattachements le contredisent. À défaut de
gestionnaire sur un espace, les notifications vont aux gestionnaires et administrateurs du
secteur de l'espace ou transversaux.

Le périmètre d'un agent s'applique aussi aux écrans **Espaces** et **Sites** : il ne voit, ne
modifie et ne supprime que les espaces de son périmètre, ne crée que des espaces de son
secteur, et ne voit que les sites qui portent au moins un de ses espaces (ou aucun espace).

### Organisation des services de la Ville

Les acteurs ci-dessus sont des **rôles** dans l'application. Dans l'organisation de la Ville, ils
se répartissent entre quatre services, des élus et trois populations d'usagers. Ce paragraphe
décrit l'organisation telle qu'elle est ; ce que l'application en couvre aujourd'hui, et ce
qu'elle n'en couvre pas encore, figure au § 8.

| Service | Ce qu'il gère | Pour qui | Conditions |
| --- | --- | --- | --- |
| **Service des sports** | Les **équipements sportifs** (gymnases, stade, complexes, salle sportive, terrain multisport) : créneaux de la saison et créneaux ponctuels. Il planifie le **personnel de service** (gardiens, agents d'accueil, vacataires) en regard de ces créneaux. | Les **associations sportives** | Mise à disposition, avec personnel de service sur place |
| **Vie associative** | Les **salles municipales** réservées par les associations (réunions, assemblées générales, activités, manifestations) ; le suivi des associations (fiche, pièces) ; les demandes de **subvention**. | Les **associations** | **Gratuité** |
| **Service des fêtes** | Les **salles municipales** louées pour des événements privés ou professionnels : convention, **facturation** (acompte, solde, caution), états des lieux. | Les **particuliers** et les **entreprises** | **Payant** |
| **Communication** | Le **suivi** des dossiers du Service des fêtes et de la Vie associative, leur **relecture**, et le **remplacement** de ces deux services (suppléance : le service traite à leur place). | Les deux services ci-dessus | — |

- Les **mêmes salles** servent à la Vie associative et au Service des fêtes : ce qui distingue
  les deux services n'est pas le lieu mais le **type de demandeur** (association d'un côté,
  particulier ou entreprise de l'autre) et le caractère gratuit ou payant de la mise à
  disposition.
- Le Service des sports travaille sur des lieux qui lui sont propres ; c'est le seul des quatre
  dont le périmètre se confond avec un ensemble d'espaces.
- La Communication n'a ni espaces ni usagers en propre : son périmètre est celui des deux
  services qu'elle suit.

**Les élus** interviennent dans les circuits, sans traiter eux-mêmes les dossiers : ils donnent
leur avis sur les demandes de subvention avant le vote, et sont associés aux décisions qui
engagent la Ville au-delà de la gestion courante (attribution des créneaux de la saison, gratuité
accordée hors grille, dérogation, refus ou réquisition sensibles). Le détail de ces interventions,
circuit par circuit, reste à arrêter avec la Ville (§ 8).

**Les usagers** se répartissent en trois populations (associations, entreprises, particuliers),
les associations sportives formant un cas à part ; chacune a son service de référence :

| Population | Ce qu'elle demande | Service de référence |
| --- | --- | --- |
| **Associations sportives** | Créneaux hebdomadaires de la saison et créneaux ponctuels dans les équipements sportifs ; subvention | Service des sports |
| **Associations** (sportives ou non) | Salles municipales, gratuitement ; subvention | Vie associative |
| **Entreprises** | Salles municipales pour séminaires, formations, événements ; factures | Service des fêtes |
| **Particuliers** | Salles municipales pour fêtes familiales ; factures, caution | Service des fêtes |

Une même association peut donc relever de deux services : le Service des sports pour ses
entraînements au gymnase, la Vie associative pour son assemblée générale en salle.

---

## 3. Parcours en étapes

Le parcours reprend les sept étapes du cahier des charges d'origine, transposées à CityRésa.

### Étape 1 — Paramétrage (administration)

Avant l'ouverture : sites (adresse, géolocalisation, accès), espaces (description, capacités,
surface, photos, règlement et plan joints, horaires d'ouverture, règles de réservation,
équipements, caution), sous-espaces d'une salle modulable, grilles tarifaires par profil et par
unité, options et prestations, matériel et stocks, indisponibilités (travaux, usage municipal),
agents responsables de chaque espace, modèles de courriel, texte de la convention, modules
actifs, **calendrier des saisons** (saison active, vacances scolaires de la zone C importées
du calendrier officiel, jours fériés).

### Étape 2 — Catalogue et recherche (portail)

L'usager parcourt le catalogue avec des filtres (site, nature, capacité, équipements, date
souhaitée), voit les photos, le descriptif, les équipements, les horaires, le tarif « à partir
de » de son profil, les pièces publiques (règlement), le calendrier de disponibilité de
l'espace et la carte des sites (latitude / longitude). Un flux ICS public par espace permet
d'afficher son agenda dans un calendrier externe.

### Étape 3 — Compte usager

Inscription en ligne (si le module est actif) : identité, organisation (association,
entreprise, particulier, service), adresse, SIRET / RNA, représentant légal, acceptation des
conditions. **Données exigées avant toute demande** (`src/lib/dossier-usager.ts`), selon le
type : une association châtillonnaise doit avoir renseigné son nom, le prénom, nom, téléphone
et e-mail du contact, l'adresse postale de son siège, le code postal, la ville, le prénom et
le nom du président et la date de l'AG de nomination ; une entreprise sa raison sociale, son
SIRET, son dirigeant et les mêmes coordonnées ; un particulier ses seules coordonnées. L'objet
et le nombre de participants prévus sont exigés sur la demande elle-même. Le portail bloque le
dépôt tant que le dossier est incomplet et renvoie vers « Mon organisation » ou « Mon compte ». Le
**profil tarifaire** est déduit automatiquement du type et du code postal (commune / extérieur).
La collectivité peut exiger la **validation de la fiche** avant l'accès aux tarifs réservés ;
elle peut aussi créer les comptes elle-même. Mot de passe, second facteur (TOTP) pour les
agents, réinitialisation par courriel.

### Étape 4 — Demande (pré-réservation)

Formulaire en plusieurs étapes : espace, date et horaires (par pas de l'espace), **récurrence**
(quotidienne, hebdomadaire sur plusieurs jours, une semaine sur deux, mensuelle, avec date de
fin ou nombre d'occurrences et dates exclues), objet, nature de l'événement, participants,
événement public ou non, options, matériel (stock vérifié), pièces jointes. Un **devis en
direct** affiche le détail (créneaux, options, matériel, TVA, acompte, caution). Les règles de
l'espace (horaires, durée, délai, horizon, conflits) sont vérifiées avant dépôt. Accusé de
réception par courriel.

### Étape 5 — Traitement (back-office)

Les agents concernés sont notifiés (cloche, courriel). Le dossier regroupe tout : demandeur et
organisation, créneaux, devis, pièces, **fil de discussion** avec l'usager et **notes internes**,
**historique** horodaté. L'agent peut demander des précisions (statut « en traitement »),
accepter, refuser avec motif, annuler, réaffecter le dossier à un collègue, modifier les
options ou accorder la gratuité (montants recalculés), forcer une demande hors délai. Le
**planning** (jour / semaine / mois, par site et par espace, couleur par espace) montre
créneaux et blocages ; l'acceptation revérifie la disponibilité.

### Étape 6 — Convention, signature électronique, confirmation

À l'acceptation, la **convention de mise à disposition** (PDF) est générée depuis le texte
paramétré et le devis. L'usager la lit dans son espace et la **signe électroniquement** : un code
à usage unique lui est envoyé par **SMS** (ou par courriel à défaut), il saisit son nom et le
code ; nom, date, adresse IP et empreinte sont consignés dans le dossier et la convention
signée est régénérée. Relances automatiques de signature. Sans signature attendue, le dossier
est confirmé directement.

### Étape 7 — Facturation et paiement

Factures d'**acompte** (pourcentage paramétrable), de **solde** et de **caution**, numérotées
(F260001 : F, l'année sur deux chiffres, le rang sur quatre), PDF, envoyées par courriel avec échéance. Enregistrement des règlements
(régie, chèque, virement, carte, mandat administratif, gratuité) ; l'acompte réglé confirme le
dossier signé ; relances des factures échues ; avoirs. Les services de la ville et les
mises à disposition gracieuses ne génèrent aucune facture.

### Étape 8 — Suivi et clôture

Rappels J-7 et J-1 à l'usager avec les consignes d'accès ; clôture automatique des réservations
passées (« terminée ») puis archivage après un délai paramétrable ; annulation par l'usager
tant que le délai d'annulation est respecté ; flux ICS personnel de l'usager.

### Étape 9 — Statistiques et tableaux de bord

Tableau de bord des agents (à traiter, conversations à répondre, conventions en attente,
factures à encaisser, réservations du jour), **bloc d'alertes** à compteurs cliquables vers la
liste filtrée (pièces expirées ou à renouveler, factures échues, conventions non signées
malgré la relance, demandes sans réponse depuis plus de sept jours, fiches à valider,
messages) et récapitulatif quotidien par courriel ;
statistiques par période (mois, trimestre, année, 30 / 90 jours, 12 mois) : volume de
demandes, taux d'acceptation, **taux d'occupation** par espace, recettes, valeur des mises à
disposition gracieuses accordées aux associations, top organisations ; export **Excel**.

---

## 4. Fonctionnalités par module

### Réservations

- Dossier complet : espace, demandeur, organisation, agent, objet, nature, participants, créneaux,
  options, matériel, montants, décision, convention, signature, factures, messages, pièces,
  historique.
- Numérotation R260001 (R, l'année sur deux chiffres, le rang sur quatre). Source (portail / back-office).
- Statuts et transitions (voir § 5), motif de refus ou d'annulation, notes internes.
- Création par un agent au nom d'un usager, avec dérogation au délai.
- Listes filtrables (statut, espace, site, période, organisation), recherche globale,
  pagination et tri, préférences de colonnes par utilisateur.

### Planning

- Vues jour / semaine / mois, filtrage par site et espace, couleur par espace, créneaux et
  blocages (indisponibilités), événements publics.
- Filtres des créneaux, sous un seul bouton : secteur des espaces (salles / sports), statut du
  dossier, type d'usager, recherche sur l'usager, le titre ou le numéro. Ils masquent des
  créneaux sans retirer les blocages ; les vues enregistrées et le PDF de la semaine les
  reprennent.
- Regroupement des espaces par site ou par secteur dans les vues semaine et jour (bandeau par
  groupe), mémorisé par les vues enregistrées.
- Vue liste sur une période au choix : semaine, 7, 15 ou 30 jours, mois ou dates libres (92
  jours au plus).
- Éditions : PDF de la semaine (A4 ou A3, une page par espace), feuille de salle, et export
  Excel de la période affichée (une ligne par créneau ou blocage, filtres compris).
- API de disponibilités utilisée par le portail (calendrier d'un espace).

### Personnel de service (module débrayable)

- **Personnes** : gardiens, agents d'accueil, vacataires, sans compte dans l'application
  (nom, fonction, téléphone, courriel, couleur, note, en service ou non).
- **Vacations** : une personne est de service sur un **site entier** d'un instant à un autre,
  avec une note ; répétition hebdomadaire jusqu'à une date (hors jours fériés et vacances
  scolaires au choix), chaque occurrence étant une vacation propre (suppression d'une seule ou
  de la série à partir d'elle). Une même personne ne peut pas être de service deux fois sur des
  horaires qui se recouvrent. Une vacation est refusée pendant une absence (une répétition saute
  seulement les dates d'absence), hors période de contrat, ou si la personne est déjà affectée à
  un créneau d'un autre site ; hors de ses sites de rattachement ou de ses horaires de travail,
  elle est enregistrée avec un avertissement.
- **Couverture des créneaux** : chaque créneau d'un dossier accepté, signé ou confirmé est
  « couvert » (une ou plusieurs vacations du site, mises bout à bout, l'englobent), « partiel »
  (une vacation le touche sans tout couvrir) ou « à couvrir ». Depuis la fiche d'une
  réservation, on peut **épingler** une personne sur un créneau précis (état des lieux,
  événement) : il est alors couvert même sans vacation. Une affectation décidée à la main
  (épinglage, validation d'une proposition avec un autre candidat) est refusée si la personne
  n'est plus en service, est hors contrat, absente ou déjà sur un autre site au même moment ;
  hors de ses sites ou de ses horaires de travail, elle passe avec un avertissement. Les
  vacations d'une personne absente ne comptent pas dans la couverture.
- **Planning de service** : semaine ou jour, une ligne par personne et une ligne « À couvrir »
  avec les créneaux réservés et leur état ; filtres site et personne ; onglet « À couvrir » ;
  PDF de la semaine (une page par site, créneaux à couvrir hachurés) ; alerte du tableau de bord
  sur les créneaux sans personne de service dans les 7 jours.
- **Courriel et agenda** : flux ICS personnel par jeton (vacations et créneaux épinglés) ; envoi
  hebdomadaire des vacations de la semaine à chaque personne ayant une adresse (PDF joint),
  le même jour que le planning hebdomadaire des gestionnaires, ou à la demande depuis sa fiche.
- **Contrat et temps de travail** : type de contrat (référentiel : fonctionnaire titulaire ou
  stagiaire, contractuel CDD ou CDI, vacataire, apprenti, mis à disposition), quotité (100, 90,
  80 %…), durée hebdomadaire de référence (temps non complet), dates de début et de fin, et un
  **cycle hebdomadaire d'horaires** (par jour : repos ou jusqu'à deux plages, pour la coupure
  méridienne). Sans cycle, la personne est affectable à toute heure (vacataire). La fiche compare
  les heures du cycle aux heures attendues de la quotité (information, jamais bloquant).
- **Plannings types** : un cycle d'horaires par type de contrat, saisi une fois. Chaque personne
  suit le planning type de son contrat (il change, elle suit), a des horaires personnalisés, ou
  n'a pas d'horaires fixes. Modifier un planning type revérifie les affectations à venir des
  personnes qui le suivent. Plannings types et horaires d'une personne sont représentés en
  image (un jour par ligne, une barre par plage, totaux) ; l'aperçu suit la saisie et se
  dessine à la souris (créer, déplacer, étirer, retirer une plage, recopier une journée sur
  d'autres), les champs d'heures restant la saisie de référence.
- **Planning de service, vue semaine** : fond de case selon la journée (travaillée, repos,
  absence de toute la journée), heures planifiées de la semaine face à la durée de référence,
  modification des horaires et ajout d'une absence depuis une case.
- **Absences** : périodes datées (journées entières ou plage horaire) avec un motif du référentiel
  (congés annuels, RTT, maladie, formation, récupération, autre) et une note ; une absence retire
  la personne des créneaux où elle était affectée ou proposée sur la période, qui repassent en
  affectation, de même que les créneaux que ses vacations couvraient.
- **Sites d'intervention** : chaque personne est rattachée à un ou plusieurs sites, dont un
  principal ; elle n'est jamais proposée ailleurs.
- **Disponibilité** d'une personne sur un créneau : en service, rattachée au site, en période de
  contrat, en poste d'après son cycle, pas absente, pas déjà affectée au même moment sur un autre
  site (plusieurs créneaux d'un même site sont compatibles). Les candidats sont classés : site
  principal d'abord, puis la plus faible charge déjà affectée sur la semaine entière du créneau
  (équité), puis le nom.
- **Affectation** : sur un site en **affectation automatique** (réglage de la fiche du site), la
  première personne disponible est épinglée d'office et le dossier garde la trace dans son
  historique ; sinon elle est **proposée** et le gestionnaire valide (ou choisit un autre candidat,
  ou écarte la proposition : la personne écartée n'est plus proposée sur ce créneau). Le calcul se
  fait dès qu'un dossier devient accepté, signé ou confirmé (y compris créé directement ferme par
  un agent ou une campagne), chaque matin sur les 30 prochains jours (tâche planifiée), et à la
  demande depuis le planning de service (bouton « Affecter » sur la période et le site affichés).
  Les gestionnaires du site sont notifiés ; les propositions en attente comptent dans le menu et
  dans les alertes du tableau de bord. Les créneaux déjà couverts par des vacations ne sont pas
  traités.

### Sites, espaces, sous-espaces, équipements, tarifs, options

- Site : nom, description, adresse, code postal, ville, latitude / longitude, téléphone,
  courriel, informations d'accès, photos.
- Espace : nature (référentiel), secteur (salles ou sports : sélections, statistiques et périmètre des agents), description, capacités debout / assise, surface, étage,
  couleur, visibilité publique, profils autorisés, validation requise ou confirmation
  automatique, horaires d'ouverture par jour (plusieurs plages, fermeture possible à minuit),
  pas de saisie, durée minimale / maximale, délai minimal et horizon, temps de montage et
  démontage, caution, règlement, consignes d'accès, statut (actif, inactif, en travaux), flux
  ICS, photos et pièces publiques, équipements (référentiel), agents responsables.
- **Sous-espaces** : un espace peut avoir un parent (salle modulable). Réserver le parent bloque
  les enfants, réserver un enfant bloque le parent ; les frères restent libres.
- **Grille tarifaire** : un montant par profil (ou « tous profils ») et par unité (heure,
  demi-journée, journée, soirée, week-end, forfait), avec libellé.
- **Options** : prestations d'un espace ou globales (ménage, montage / démontage, régisseur,
  tables et chaises, sono…), au forfait, à l'heure ou à l'unité, éventuellement obligatoires.
- Indisponibilités : blocage d'un espace sur une période avec motif.
- **Fermeture exceptionnelle** : un blocage qui tombe sur des réservations en place (espace,
  parent ou sous-espaces) passe par un aperçu des dossiers et créneaux touchés ; l'agent choisit
  d'annuler ces créneaux (retirés du montant dû) et de prévenir les usagers (courriel
  « Fermeture exceptionnelle » par dossier, notification, lien pour convenir d'un report). Un
  dossier dont tous les créneaux sont couverts n'est pas vidé : il reste à annuler ou reporter
  depuis sa fiche. Chaque dossier touché garde la trace dans son historique.

### Matériel

- Catalogue (catégorie, description, stock total, tarif gratuit / forfait / unité / unité et
  par jour, photos).
- Rattachement facultatif à un site ou à un espace : sans rattachement, stock commun proposé
  avec toutes les réservations ; sinon, matériel proposé et accepté pour les seuls espaces du
  site, ou pour le seul espace. Distinct des équipements d'un espace, descriptifs et non
  réservables.
- Stock disponible calculé sur la période du dossier (dossiers vivants) ; refus si insuffisant.
  La liste et la fiche affichent le **pic de mobilisation** à venir (seuls les dossiers qui se
  recouvrent s'additionnent).
- **Planning du matériel** : articles regroupés par catégorie, une colonne par jour (7, 15 ou
  30 jours, ou le mois), unités retenues chaque jour face au stock utilisable, signalement des
  jours où le stock est entièrement retenu ou dépassé ; filtres par catégorie, rattachement,
  statut des dossiers, nom, et matériel retenu seulement.

### Usagers et organisations

- Organisation : type (association, entreprise, particulier, service interne, autre
  collectivité), coordonnées, SIRET / RNA, représentant légal (président, dirigeant) et date
  de l'AG de nomination, **profil tarifaire**, notes, pièces
  (statuts, assurance, pièce d'identité…), validation par la collectivité, désactivation.
- Comptes usagers rattachés (plusieurs par organisation), téléphone mobile pour la signature
  SMS, préférences de notification, acceptation des CGU.
- Création par inscription ou par un agent ; profil par défaut selon le type et le code postal.

### Messages

- Fil de discussion par dossier, usager ↔ agents, notes internes invisibles de l'usager,
  marquage lu / non lu, notification et courriel à l'autre partie, boîte « Messages » des
  agents (conversations à répondre : l'usager a écrit en dernier, qu'un agent ait lu ou non),
  « Mes messages » côté portail.

### Documents (pièces jointes)

- Types : photo, règlement, plan, pièce justificative, convention, facture, statuts, attestation
  d'assurance, autre ; catégorie (référentiel) ; public ou privé.
- Rattachement à un site, un espace, un matériel, une organisation, une réservation, une
  subvention ; vignettes des photos ; extensions et taille maximales contrôlées ; octets
  stockés en base (sauvegarde unique).
- **Date de validité** facultative sur une pièce (attestation d'assurance…) : pastille
  « valide / à renouveler / expirée », **pièces attendues** selon le type d'usager (statuts et
  assurance pour une association, assurance pour une entreprise ou un particulier) affichées
  sur la fiche et dans « Mon organisation », onglet « Pièces à vérifier » de la liste des
  usagers, courriel et notification à J-N (paramètre, 30 jours par défaut) puis le jour de
  l'expiration.

### Signature électronique

- Code numérique à usage unique par SMS (passerelle HTTP générique ou journal en démonstration)
  ou par courriel ; validité et nombre d'essais limités ; empreinte seule conservée ; nom du
  signataire, horodatage, adresse IP ; convention régénérée avec le cartouche de signature ;
  relances.

### Paiements

- Factures d'acompte, de solde, de caution, avoirs ; statuts à payer / payée / annulée /
  remboursée ; échéance ; PDF ; paiements multiples par facture avec mode et référence ;
  relances des factures échues ; journal des paiements et export.

### Subventions (module ASSO)

- **Campagne annuelle** : une campagne par exercice (intitulé, dates d'ouverture et de clôture
  du dépôt, consignes, statut en préparation / dépôt ouvert / clôturée). Le portail accepte un
  dépôt entre les deux dates d'une campagne ouverte ; un agent peut déposer ou compléter un
  dossier hors période avec un motif de dérogation tracé dans l'historique.
- **Dossier de demande** reprenant le formulaire de la Ville, en deux variantes selon la case
  « association sportive » de l'organisation : présentation (identification, agréments, label,
  utilité publique, commissaire aux comptes), bureau et personne chargée du dossier, effectifs
  (bénévoles, salariés, adhérents sur deux exercices, licenciés et cotisations), rayonnement
  (orientations, vie locale, moyens mis à disposition), budget prévisionnel par postes (plan
  associatif 60–78 et 86/87, ou plan sportif par rubriques) avec totaux, résultat et part de la
  subvention, demande et actions (objet, type, montant, justification, actions spécifiques),
  trésorerie, bilan N-1 (subvention perçue, actions réalisées, compte de résultat budget /
  réalisé, synthèse), pièces à joindre (liste conditionnelle : PV d'AG, comptes, RIB, compte
  rendu des actions, rapport du commissaire, statuts et composition du conseil pour une première
  demande ou un changement, pouvoir du mandataire, projet financier des actions), attestation
  sur l'honneur (avec le rappel des peines pour fausse déclaration) et contrat d'engagement
  républicain. Le dossier rappelle aussi le délai de six mois pour retourner le bilan, porte la
  notice sur les données personnelles et indique le service à contacter (réglable).
- Dossier **pré-rempli** depuis la fiche de l'organisation, le dossier de l'exercice précédent
  (renouvellement) et les locaux municipaux mis à disposition l'an passé (valorisation) ; rempli
  fiche par fiche avec enregistrement et reprise ; contrôle de complétude (champs obligatoires par
  fiche, pièces attendues, signature) avant le dépôt.
- **Signature électronique** de l'attestation par code à usage unique (SMS, à défaut courriel),
  invalidée par toute modification ultérieure ; dépôt qui numérote (S270001 : S, l'exercice sur deux chiffres, le rang sur quatre), date la
  réception, génère le **PDF du dossier** (présenté comme le formulaire papier de la Ville : page de garde, cadre réservé, fiches 1-1 à 8, contrat d'engagement républicain, mentions de signature) et envoie
  l'accusé de réception. Nature première demande / renouvellement.
- **Instruction** : cadre réservé (numéro, réception, secteur d'instruction, campagne), lecture du
  dossier par fiches, état des pièces, **renvoi comme incomplet** (motif, retour en rédaction,
  courriel à l'association, numéro conservé), complément du dossier par un agent, instructeur,
  **avis des élus** (favorable, avec réserve, défavorable, montant proposé, commentaire),
  décision (votée / refusée) avec montant accordé et note, versement daté. Historique de chaque
  dossier. Courriels de réception, de renvoi, de code de signature et de décision.
- Suivi par l'association (« Mes subventions » : campagne en cours, dossier à commencer ou à
  reprendre, dossiers déposés, PDF), liste filtrable par campagne, compteurs par exercice et
  export côté collectivité.

### Notifications, courriels, SMS

- Cloche de notifications (agents et usagers) : nouvelle demande, message, signature,
  paiement, nouvel usager, subvention, rappel, système.
- Courriels depuis des **modèles modifiables** avec variables (`{{numero}}`, `{{espace}}`…),
  habillage à la couleur de la collectivité, version texte ; journal des envois (courriels et
  SMS) avec statut ; mode simulation sans SMTP.
- SMS pour le code de signature ; fournisseur `console` (journal) ou `http` (passerelle).

### Administration

- **Paramètres** : identité de la collectivité (nom, adresse, signataire, logo ou blason
  affiché dans l'application et en en-tête des conventions et factures), couleur, textes du
  portail, SMTP, SMS, modules (portail, inscription, paiements, signature, matériel,
  subventions, documents, campagnes, personnel de service), TVA, pourcentage d'acompte,
  rappels, relances, archivage, délai
  d'annulation, validité des codes, texte de la convention, agents notifiés.
- **Comptes et rôles** : comptes du back-office, rôles avec permissions par catégorie, rattachement aux
  espaces, second facteur, désactivation.
- **Référentiels** : natures d'espace, natures d'événement, équipements, profils tarifaires,
  catégories de matériel, catégories de pièces.
- **Calendrier des saisons** : saisons (années scolaires, du 1er septembre au 31 août ; une
  seule active, dont la fin pré-remplit la date de fin des récurrences), vacances scolaires
  importées du jeu open data national « fr-en-calendrier-scolaire » pour la zone choisie
  (zone C par défaut) ou déposées en JSON, jours fériés légaux calculés et modifiables, ponts
  et périodes saisis à la main.
- **Modèles de courriel**, **journal d'audit** (qui a fait quoi), **tâches planifiées** (état,
  dernière exécution, lancement manuel), **sauvegardes** (`pg_dump` quotidien, rotation,
  téléchargement, suppression), journal applicatif.

### Portail public

- Catalogue, fiche d'espace (photos, équipements, horaires, tarifs, règlement, calendrier,
  carte), demande en ligne avec devis, espace usager (mes réservations, mes messages, mes
  subventions, mon organisation, mon compte), signature de convention, consultation des
  factures, annulation dans le délai, flux ICS personnel.

### Flux ICS et exports

- ICS public par espace (jeton), ICS personnel par usager (jeton révocable), ICS par personne
  de service (jeton révocable depuis sa fiche).
- Export Excel des statistiques (réservations, espaces, usagers), export des listes.

---

## 5. Règles de gestion

### Statuts d'une réservation et transitions

| Statut | Signification | Vers |
| --- | --- | --- |
| brouillon | non envoyée | à traiter, annulée |
| **à traiter** | reçue, en attente de décision | en traitement, acceptée, confirmée, refusée, annulée |
| **en traitement** | précisions demandées à l'usager | à traiter, acceptée, confirmée, refusée, annulée |
| **acceptée** | approuvée, convention à signer | signée, confirmée, annulée, en traitement |
| **signée** | convention signée, acompte attendu | confirmée, annulée |
| **confirmée** | tout est en ordre, l'espace est réservé | terminée, annulée |
| terminée | l'événement a eu lieu | archivée |
| refusée | déclinée (motif) | archivée, à traiter |
| annulée | par l'usager ou la collectivité (motif) | archivée |
| archivée | dossier clos | — |

- Les statuts **à traiter, en traitement, acceptée, signée, confirmée** occupent l'espace
  (bloquent le créneau) ; **acceptée, signée, confirmée** sont fermes pour l'usager.
- Une acceptation (ou confirmation) revérifie la disponibilité : un autre dossier a pu être
  confirmé entre-temps.
- « Acceptée » sans module de signature devient directement « confirmée ». Une convention
  signée sans acompte attendu confirme d'office ; avec acompte, le dossier reste « signée »
  jusqu'au règlement.
- Refus et annulation passent les créneaux à « annulé » (ils libèrent le planning) ; un refus
  et une annulation portent un motif, repris dans le courriel.
- Un espace « sans validation » confirme la demande d'office à son dépôt.

### Conflits et créneaux

- Deux intervalles se chevauchent si l'un commence avant la fin de l'autre, **bornes exclues**
  (10 h-12 h et 12 h-14 h ne se gênent pas).
- Les temps de montage et de démontage de l'espace élargissent les créneaux demandés avant la
  comparaison.
- Un conflit s'apprécie sur la **famille** de l'espace : lui-même, son parent et ses
  sous-espaces (pas ses frères) ; les indisponibilités comptent comme des occupants.

### Récurrences

- Fréquence quotidienne, hebdomadaire (jours de la semaine, intervalle : « une semaine sur
  deux »), mensuelle (le même quantième, ramené au dernier jour des mois courts) ; fin par date
  incluse ou nombre d'occurrences ; 200 occurrences au plus ; un an au plus sans borne.
- **Hors vacances scolaires** et **hors jours fériés** : les occurrences qui tombent sur une
  période du calendrier des saisons (vacances de la zone C, fériés) ne sont pas créées ; des
  dates exclues peuvent s'ajouter à la main. La convention et la fiche décrivent la règle
  (« Chaque semaine le mardi, jusqu'au 30/06/2027, hors vacances scolaires et jours fériés »).
- Les occurrences se calculent en **heure murale de Paris** : « tous les mercredis 18 h-20 h »
  reste à 18 h après le passage à l'heure d'été.
- Chaque occurrence est un créneau propre (planning, conflits, annulation d'une occurrence).

### Horaires, durées et délais

- Horaires d'ouverture par jour ISO (plusieurs plages ; « 00:00 » en fermeture = minuit) ; un
  jour absent est fermé ; sans horaires déclarés, tout est ouvert ; un créneau sur plusieurs
  jours est vérifié jour par jour.
- Pas de saisie (15 / 30 / 60 min), durée minimale et maximale, délai minimal avant
  l'événement (jours), horizon maximal ; un agent peut passer outre délai et horizon.

### Tarification

- La grille applicable est celle du **profil** de l'organisation ; à défaut, la grille « tous
  profils ».
- Pour chaque créneau, parmi les unités applicables (heure facturée à la demi-heure
  supérieure ; demi-journée jusqu'à 5 h ; soirée à partir de 18 h et jusqu'à 8 h ; week-end
  le samedi et le dimanche ; journée par tranche de 24 h), on retient **la moins chère** pour
  l'usager. Un **forfait** vaut pour toute la réservation et remplace les lignes horaires s'il
  est moins cher.
- Options : forfait (une fois), à l'heure (sur la durée totale), à l'unité (quantité).
  Matériel : gratuit, forfait, par unité, par unité et par jour (nombre de créneaux).
- TVA au taux paramétré ; **acompte** en pourcentage du TTC ; **caution** de l'espace, hors
  devis, facturée à part et restituée ; **gratuité** : tout à zéro, lignes conservées pour
  mémoire (valorisation des mises à disposition).

### Facturation

- Acompte à la confirmation (ou solde directement s'il n'y a pas d'acompte), solde = TTC −
  acomptes émis, caution à part ; échéance par défaut à 30 jours ; une facture est soldée quand
  la somme des paiements atteint son montant.

### Comptes et organisations

- Le profil tarifaire par défaut se déduit du type et du code postal (codes postaux de la
  collectivité lus dans son adresse) : particulier / association de la commune ou extérieur,
  entreprise, service interne, autre collectivité.
- Une organisation non validée peut déposer ; la collectivité valide avant d'accorder les
  tarifs du profil et les espaces réservés (profils autorisés).
- Un usager ne voit que ses dossiers et ceux de son organisation ; il peut annuler lui-même
  tant que le délai d'annulation est respecté.

### Archivage et purge

- Clôture automatique des réservations passées, archivage des dossiers terminés / refusés /
  annulés après N jours, purge des vieilles notifications ; journal d'audit conservé.

---

## 6. Couverture du cahier des charges d'origine

| Exigence d'origine | Couverture CityRésa |
| --- | --- |
| Catalogue de salles avec filtres (capacité, équipements, type) | **Oui** — portail `/portail/espaces`, filtres site / nature / capacité / équipements / date. |
| Géolocalisation, descriptifs, documents joints (règlement, tarifs) | **Oui** — lat/lng et accès par site, carte, photos, pièces publiques (règlement, plan), grille tarifaire affichée selon le profil. |
| Consultation en vue liste ou carte | **Oui** — liste et carte des sites (coordonnées). |
| Créneaux récurrents (« tous les mercredis après-midi ») | **Oui** — récurrences quotidienne / hebdomadaire / mensuelle, hors vacances scolaires (zone C) et jours fériés du calendrier des saisons, exclusions à la main, développées en créneaux individuels. |
| Multisalle / multidate | **Partiel** — un dossier porte un espace et plusieurs dates (récurrence) ; plusieurs salles = plusieurs dossiers (créés en quelques clics, regroupés par organisation). |
| Salles simples, sous-salles, espaces modulables | **Oui** — espace parent / sous-espaces, blocage croisé parent ↔ enfants. |
| Scénarios par profil (particulier, association…) | **Oui** — profils tarifaires, profils autorisés par espace, validation requise ou non, gratuité, délais ; logigramme unique paramétré par les règles de l'espace et les modules. |
| Tarification dynamique selon profil, période, type (forfait, dégressif) | **Oui / partiel** — grilles par profil et par unité (heure, demi-journée, journée, soirée, week-end, forfait), unité la moins chère, options ; la dégressivité par volume n'est pas automatique (forfaits et gratuité par profil en tiennent lieu). |
| Grilles tarifaires selon profils et occurrences, forfaits préférentiels | **Oui** — forfait appliqué à toute la réservation récurrente s'il est plus avantageux. |
| Logigrammes personnalisés | **Partiel** — un circuit de statuts fixe mais ajustable : validation ou confirmation automatique par espace, signature et paiement débrayables, dérogations agent. |
| Compte usager (facultatif), retrouver toutes ses demandes | **Oui** — inscription en ligne ou création par un agent ; espace « Mes réservations », « Mes messages », « Mes subventions ». |
| Pré-réservation par formulaire en plusieurs étapes, déposée dans le back-office | **Oui** — demande en ligne avec devis en direct, accusé de réception, dossier côté agents. |
| Dossier complet et historique, pièces jointes, notes, changements d'affectation, relances | **Oui** — fiche dossier, historique, pièces, notes internes, réaffectation à un agent, relances automatiques (signature, paiement, rappels). |
| Emails modèles préenregistrés | **Oui** — 21 modèles modifiables avec variables, journal des envois. |
| Signature électronique de la convention via SMS | **Oui** — code SMS (ou courriel), empreinte, nom, IP, horodatage, convention PDF signée. |
| Paiement en ligne, réception de la facture | **Partiel** — factures PDF (acompte, solde, caution), suivi des règlements (régie, chèque, virement, CB, mandat) ; le paiement par carte **en ligne** (PayFiP, TIPI) n'est pas intégré. |
| Interopérabilité contrôle d'accès, éclairage, chauffage | **Non (évolution)** — les créneaux confirmés sont exposés par flux ICS et API de disponibilités ; pas de connecteur vers un logiciel de contrôle d'accès. |
| Accès à la salle (états des lieux, ouverture de porte) | **Partiel** — consignes d'accès par espace, rappels J-7 / J-1, caution ; pas d'état des lieux dématérialisé. |
| Gestion administrative centralisée, historique des factures | **Oui** — module Paiements, export. |
| Données clés pour responsables et élus (taux d'occupation, valeur des mises à disposition) | **Oui** — statistiques par période, taux d'occupation, recettes, valorisation des gratuités, export Excel ; rôle Élu en lecture. |
| Tableaux de bord personnalisables | **Partiel** — tableau de bord des agents avec indicateurs et préférences d'affichage ; pas de constructeur de widgets. |
| Gestion des accès par service ou lieu, tableau de bord, notifications | **Oui** — rôles par catégorie, rattachement des agents aux espaces, notifications ciblées (gestionnaires de l'espace, sinon tous). |
| Planning du personnel de service (gardiens, agents d'accueil) en regard des réservations | **Oui** — module Personnel de service : vacations par site avec répétition hebdomadaire, créneaux réservés couverts / partiels / à couvrir, épinglage sur un créneau, PDF, ICS et courriel hebdomadaire par personne. |
| Module ASSO : espace dédié, compte, dépôt de demandes de subvention | **Oui** — « Mes subventions », dépôt avec pièces, suivi. |
| Back-office collectivité et application dédiée aux élus | **Oui / partiel** — instruction côté agents, rôle Élu avec avis dans la même application (le vote est enregistré par les agents) (responsive), pas d'application mobile séparée. |
| CRM : fichier de contacts unique, filtres, segmentation, historique | **Oui** — organisations et contacts, type, profil, notes, pièces, historique des dossiers et factures ; recherche globale. |
| Planning unique imprimable, exportable Excel, récurrences, annulations, alertes | **Oui / partiel** — planning multi-espaces, flux ICS, PDF de la semaine, export Excel de la période affichée et des statistiques. |
| Devis et factures avec mise en page paramétrable | **Partiel** — devis en direct, factures et conventions PDF à l'identité de la collectivité (texte de convention paramétrable, pas d'éditeur de mise en page). |
| Modèles de documents, emailings | **Partiel** — modèles de courriel ; pas d'emailing de masse. |
| Plusieurs services et accès, droits paramétrables | **Oui** — rôles, permissions par catégorie, périmètre par espace. |
| Site internet responsive avec formulaire personnalisable | **Oui / partiel** — portail responsive aux couleurs de la ville (titre, accroche, conditions paramétrables) ; formulaire de demande fixe. |
| Charte graphique (barre latérale blanche, accent vert, cartes, pastilles)  | **Oui** — feuille `cityresa.css`, couleur d'accent paramétrable. |

---

## 7. Limites connues et évolutions envisagées

- **Contrôle d'accès physique** (badges, ouverture de porte, éclairage, chauffage) : non
  intégré ; les créneaux confirmés sont disponibles par ICS et par l'API de disponibilités pour
  un futur connecteur.
- **Paiement par carte en ligne** (PayFiP / TIPI) : non intégré ; les factures sont réglées en
  régie, par chèque, virement ou mandat, et saisies par les agents.
- **Dégressivité avancée** (remise par volume d'heures, tarifs saisonniers) : non automatique ;
  elle s'obtient aujourd'hui par les forfaits, la gratuité et les grilles par profil.
- **Multisalle dans un même dossier** : une demande porte un espace ; plusieurs salles donnent
  plusieurs dossiers.
- **États des lieux** dématérialisés (entrée / sortie, photos, restitution de caution) : non
  couverts, la caution est suivie comme une facture.
- **Logigrammes libres** : le circuit de statuts est fixe ; ses étapes sont débrayables par
  module et par espace.
- **Application mobile élus** : le rôle Élu utilise l'application web responsive.
- **Emailing de masse**, **éditeur de mise en page** des PDF : hors périmètre.
- **Hébergement et conformité** : auto-hébergement Docker (voir `docs/DEPLOY.md`), données en
  France sous la responsabilité de la collectivité ; registre RGPD, mentions légales et
  accessibilité (RGAA) à compléter par la collectivité ; sauvegardes quotidiennes incluses.
- **Organisation par service** (Service des sports, Vie associative, Service des fêtes,
  Communication, élus de délégation) : couverte en partie seulement, voir § 8.

---

## 8. Organisation des services : couverture actuelle et écarts à traiter

L'organisation décrite au § 2 (quatre services, des élus, trois populations d'usagers) a été
précisée après la construction de l'application. Cette section dit, point par point, comment
elle se traduit aujourd'hui dans CityRésa et ce qui manque. Les écarts sont numérotés pour
servir de base aux évolutions ; les scénarios de `docs/SCENARIOS.md` les signalent là où on les
rencontre.

### Ce que l'application couvre déjà

| Besoin | Traduction actuelle |
| --- | --- |
| Service des sports, sur ses équipements | Secteur **Sports** : les agents de ce secteur ne voient et ne traitent que les équipements sportifs (réservations, planning, messages, espaces, sites). |
| Créneaux de la saison des associations sportives | **Campagnes de créneaux** : vœux déposés sur le portail, arbitrage par priorité, attribution en lot, un dossier récurrent par créneau attribué. |
| Personnel de service du Service des sports | Module **Personnel de service** : vacations par site, couverture des créneaux, affectation automatique ou proposée, absences, contrats, planning PDF et courriel hebdomadaire. Le module vaut aussi pour les salles. |
| Vie associative : gratuité pour les associations | Profil tarifaire **Association de la commune** au tarif nul sur chaque espace : le devis affiche « Gratuit » et aucune facture n'est émise. La **gratuité accordée** à la main, avec son fondement, couvre les cas hors grille. Les mises à disposition gratuites sont chiffrées dans la **valorisation** annuelle. |
| Service des fêtes : location payante | Grilles tarifaires **Particulier** (commune / extérieur) et **Entreprise**, devis, convention signée par code, factures d'acompte, de solde et de caution, états des lieux, frais d'annulation. |
| Subventions des associations | Module **Subventions** : campagne, dossier en ligne, instruction, avis des élus, vote, versement. |
| Élus : avis sur les subventions | Rôle **Élu** : écriture sur les subventions (avis, montant proposé, commentaire), lecture sur tout le reste, tableau de bord. |
| Distinguer les associations sportives | Case **Association sportive** de la fiche de l'organisation (variante du dossier de subvention et du plan de budget). |
| Suivre sans traiter, ou traiter à la place d'un service | Un compte au rôle **Lecteur** (suivi) ou **Agent** / **Gestionnaire** (remplacement) du secteur Salles. |

### Écarts

| N° | Besoin de l'organisation | Aujourd'hui | Évolution à étudier |
| --- | --- | --- | --- |
| E1 | **Séparer Vie associative et Service des fêtes**, qui partagent les mêmes salles et se distinguent par le type de demandeur. | Un seul secteur **Salles** : tout agent du secteur voit et traite toutes les demandes des salles, associations comme particuliers et entreprises. Le périmètre d'un agent se règle par espace, jamais par type d'usager. Seuls le filtre « type d'usager » des listes et du planning et l'« agent assigné », choisi à la main, permettent à chacun de retrouver ses dossiers. | Notion de **service** portée par l'agent (au-delà du secteur) ; aiguillage d'une demande vers un service selon l'espace **et** le type de demandeur ; notifications, tableau de bord, compteurs et droits de décision limités au service. |
| E2 | **Communication** : suivre, relire, remplacer. | Aucun compte ni rôle prévu. Le suivi et le remplacement s'obtiennent en donnant à ses agents un compte du secteur Salles (Lecteur, Agent ou Gestionnaire). La **relecture** n'existe pas : aucune étape ne soumet un dossier, une convention ou un message à un second regard avant envoi. | Préciser avec la Ville ce qui est relu (réponse à l'usager, convention, événement ouvert au public, facture) et à quel moment ; selon la réponse, étape « à relire » dans le circuit ou simple mise en copie. Suppléance déclarée (dates, service remplacé) plutôt qu'un compte permanent. |
| E3 | **Élus dans les circuits** de réservation. | L'élu n'agit que sur les subventions. Sur les réservations, les campagnes de créneaux, la gratuité, les dérogations et les réquisitions, il lit sans pouvoir donner d'avis ni valider. | Arrêter la liste des décisions soumises à un élu ; **avis ou visa d'un élu** sur un dossier de réservation (comme l'avis de subvention), demandé par l'agent, tracé dans l'historique, bloquant ou non selon le cas. |
| E4 | **Élu de délégation** (sports, vie associative, fêtes…). | Un élu est transversal : il voit tout et peut donner un avis sur toute demande de subvention. Le « secteur d'instruction » d'un dossier de subvention (Sport, Culture, Solidarité…) est une étiquette, sans effet sur qui est sollicité ; l'élu n'est pas notifié quand un dossier attend son avis. | Délégation portée par le compte de l'élu ; avis demandé aux seuls élus concernés ; notification à l'élu. |
| E5 | **Subventions : quel service instruit ?** Les associations sportives relèvent du Service des sports, les autres de la Vie associative. | Les droits sur les subventions tiennent au **rôle** (Gestionnaire : tout ; Agent : lecture), pas au service. Un seul service de contact se règle dans les paramètres (« Service de la vie associative »). | Répartition de l'instruction par service selon la case « association sportive » ou le secteur d'instruction ; contact du service instructeur sur le dossier. |
| E6 | **Usagers : service de référence.** | Le fichier des usagers est commun à tous les agents : tout agent en écriture valide une fiche, vérifie des pièces ou modifie une organisation, quel que soit son secteur. | Service de référence déduit du type (et de la case « sportive ») ; fiches à valider et pièces à vérifier présentées au bon service. |
| E7 | **Nommer les services** dans les écrans et les documents. | Les services n'existent pas en tant que tels : l'application connaît deux secteurs (Salles, Sports) et la fonction saisie sur chaque compte. Convention, courriels et factures portent l'identité de la collectivité, pas celle du service. | Référentiel des services (nom, courriel, téléphone) ; service affiché sur le dossier, la convention et les courriels. |
| E8 | **Gratuité des associations : périmètre exact.** | La gratuité tient à la grille : nulle pour une association de la commune, payante pour une association extérieure (150 € la journée salle Gabriel Péri dans le jeu de démonstration). | Confirmer la règle de la Ville : gratuité pour toutes les associations ou pour les seules associations châtillonnaises ; avec ou sans plafond annuel. |
| E9 | **Facturation réservée au Service des fêtes.** | Les rôles Agent et Gestionnaire ont l'écriture sur les paiements dans les deux secteurs. | Droit « Paiements » par service, ou confirmation que la règle actuelle convient. |
| E10 | **Comptes de démonstration** par service. | Le jeu de démonstration compte une gestionnaire du secteur Salles (qui tient à la fois la Vie associative et le Service des fêtes), un agent du secteur Sports et un élu ; aucun compte Communication, aucun financier. | Un compte par service et par niveau, un élu par délégation, pour dérouler les scénarios à plusieurs mains. |
| E11 | **Campagnes de créneaux par service.** Le Service des sports mène celle des gymnases, la Vie associative celle des salles. | Les campagnes ne suivent pas le secteur : tout agent en écriture voit toutes les campagnes et peut ouvrir aux vœux n'importe quel espace. Seule la décision sur un vœu est limitée aux espaces dont l'agent a la charge. | Campagne rattachée à un secteur (ou à un service) ; liste des campagnes et choix des espaces limités au périmètre de l'agent. |

Tant que ces écarts ne sont pas traités, la séparation entre Vie associative, Service des fêtes
et Communication repose sur l'organisation du travail (filtres, agent assigné, vues
enregistrées du planning), pas sur les droits.
