# CityRésa — cahier des charges fonctionnel

Gestion des réservations des espaces municipaux (salles, équipements sportifs, matériel), des
usagers (associations, entreprises, particuliers, services de la ville) et des demandes de
subvention des associations, pour la **Ville de Châtillon (Hauts-de-Seine, 92320)**.

Ce document décrit le périmètre fonctionnel livré par CityRésa, ses règles de gestion, et la
façon dont il couvre le cahier des charges d'origine (notes Synbird, présentation
« SynBird Réservations 2026 », présentation AgoraManager, charte Mariloo). Les conventions
techniques sont dans `docs/CONVENTIONS.md`, le déploiement dans `docs/DEPLOY.md`.

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
| **Élu** | Back-office | Consulte l'activité (tableaux de bord), donne un **avis** sur les demandes de subvention. |
| **Administrateur** | Back-office | Paramètres, utilisateurs et rôles, référentiels, modèles de courriel, sauvegardes, audit. |
| **Lecteur** | Back-office | Lecture seule. |

Les droits se règlent **par rôle et par catégorie** (réservations, planning, sites et espaces,
matériel, usagers, messages, paiements, subventions, mon équipe) sur quatre niveaux (aucun,
lecture, écriture, suppression). Un agent peut en plus être rattaché à des espaces
(gestionnaire, lecteur ou simplement notifié) : c'est la **gestion des accès par service ou
par lieu** demandée par le cahier des charges.

---

## 3. Parcours en étapes

Le parcours reprend les sept étapes de la présentation SynBird, transposées à CityRésa.

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
(FAC-AAAA-0001), PDF, envoyées par courriel avec échéance. Enregistrement des règlements
(régie, chèque, virement, carte, mandat administratif, gratuité) ; l'acompte réglé confirme le
dossier signé ; relances des factures échues ; avoirs. Les services de la ville et les
mises à disposition gracieuses ne génèrent aucune facture.

### Étape 8 — Suivi et clôture

Rappels J-7 et J-1 à l'usager avec les consignes d'accès ; clôture automatique des réservations
passées (« terminée ») puis archivage après un délai paramétrable ; annulation par l'usager
tant que le délai d'annulation est respecté ; flux ICS personnel de l'usager.

### Étape 9 — Statistiques et tableaux de bord

Tableau de bord des agents (à traiter, messages sans réponse, conventions en attente,
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
- Numérotation RES-AAAA-0001. Source (portail / back-office).
- Statuts et transitions (voir § 5), motif de refus ou d'annulation, notes internes.
- Création par un agent au nom d'un usager, avec dérogation au délai.
- Listes filtrables (statut, espace, site, période, organisation), recherche globale,
  pagination et tri, préférences de colonnes par utilisateur.

### Planning

- Vues jour / semaine / mois, filtrage par site et espace, couleur par espace, créneaux et
  blocages (indisponibilités), événements publics.
- API de disponibilités utilisée par le portail (calendrier d'un espace).

### Sites, espaces, sous-espaces, équipements, tarifs, options

- Site : nom, description, adresse, code postal, ville, latitude / longitude, téléphone,
  courriel, informations d'accès, photos.
- Espace : nature (référentiel), description, capacités debout / assise, surface, étage,
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
- Stock disponible calculé sur la période du dossier (dossiers vivants) ; refus si insuffisant.

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
  agents (sans réponse), « Mes messages » côté portail.

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

- Dépôt par l'association depuis son espace : exercice, objet, type (fonctionnement, projet,
  exceptionnelle, investissement), montant demandé, budget total, bénéficiaires, description,
  pièces (budget prévisionnel, bilan, RIB). Numérotation SUB-AAAA-0001.
- Instruction par les agents (instructeur, notes), **avis des élus** (favorable, avec réserve,
  défavorable, montant proposé, commentaire), décision (votée / refusée) avec montant accordé
  et note, versement. Courriels de réception et de décision.
- Suivi par l'association (« Mes subventions »), tableau et statistiques côté collectivité.

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
  subventions, documents), TVA, pourcentage d'acompte, rappels, relances, archivage, délai
  d'annulation, validité des codes, texte de la convention, agents notifiés.
- **Utilisateurs et rôles** : agents, rôles avec permissions par catégorie, rattachement aux
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

- ICS public par espace (jeton), ICS personnel par usager (jeton révocable).
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

| Exigence d'origine (Synbird / Agora / Mariloo) | Couverture CityRésa |
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
| Module ASSO : espace dédié, compte, dépôt de demandes de subvention | **Oui** — « Mes subventions », dépôt avec pièces, suivi. |
| Back-office collectivité et application dédiée aux élus | **Oui / partiel** — instruction côté agents, rôle Élu avec avis et vote dans la même application (responsive), pas d'application mobile séparée. |
| CRM : fichier de contacts unique, filtres, segmentation, historique (Agora) | **Oui** — organisations et contacts, type, profil, notes, pièces, historique des dossiers et factures ; recherche globale. |
| Planning unique imprimable, exportable Excel, récurrences, annulations, alertes (Agora) | **Oui / partiel** — planning multi-espaces, flux ICS, exports Excel des statistiques ; impression par le navigateur. |
| Devis et factures avec mise en page paramétrable (Agora) | **Partiel** — devis en direct, factures et conventions PDF à l'identité de la collectivité (texte de convention paramétrable, pas d'éditeur de mise en page). |
| Modèles de documents, emailings (Agora) | **Partiel** — modèles de courriel ; pas d'emailing de masse. |
| Plusieurs services et accès, droits paramétrables (Agora) | **Oui** — rôles, permissions par catégorie, périmètre par espace. |
| Site internet responsive avec formulaire personnalisable (AgoraSite) | **Oui / partiel** — portail responsive aux couleurs de la ville (titre, accroche, conditions paramétrables) ; formulaire de demande fixe. |
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
