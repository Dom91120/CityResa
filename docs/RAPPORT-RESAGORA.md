# Rapport — fonctionnalités de Résagora intéressantes pour CityRésa

Date : 2 novembre 2026, mis à jour le 5 novembre 2026. Source : dépôt `../resagora` (README, `docs/recette/exigences.csv`,
`docs/avancement.md`, `docs/rapport-livraison.md`, écrans du back-office, du portail et du
mobile), comparé au `docs/CAHIER-DES-CHARGES.md` et au code de CityRésa.

---

## 1. Ce qu'est Résagora

Résagora (« Plateforme des équipements sportifs et associatifs de la Ville de Châtillon ») couvre
le même métier que CityRésa, avec un angle plus **sportif et RH** : réservations et créneaux
annuels, portail, tarification et cautions, documents et signature, **planning des gardiens**
avec application mobile hors ligne, matériel, **valorisation des avantages en nature**,
statistiques et éditions.

- Architecture différente : portail en DMZ (façade Starlette sans base) → flux mTLS unique →
  API Django sur le LAN ; trois fronts React (back-office, portail, PWA gardiens).
- 150 exigences identifiées (126 « M », 22 « S », 2 « C »), 7 lots, 62 étapes toutes marquées
  « fait » ; chaque exigence est reliée à son code et à ses tests dans `docs/recette/matrice.csv`.
- Le jeu de démonstration **reprend les données de CityRésa** (`outils/cityresa/extraire.mjs`),
  ce qui facilite une comparaison écran à écran avec les mêmes sites, espaces et associations.
- Les intégrations (AD, Ciril, PayFiP, DocuSeal, SMS) ont été éprouvées sur simulateurs, jamais
  sur les services réels.

## 2. Socle commun

Les deux applications ont déjà : référentiel sites / espaces / sous-espaces, horaires, récurrences,
statuts contrôlés, conflits, portail avec catalogue et demande guidée, compte usager validé par la
Ville, messagerie par dossier, grilles tarifaires par profil et unité, devis, factures, avoirs,
caution, signature électronique, modèles de courriel, SMS, matériel avec contrôle de stock,
statistiques d'occupation et de recettes, exports tableur, tableau de bord « à traiter », journal
d'audit, rôles et périmètre par espace.

CityRésa a en propre le **module ASSO (subventions)**, les modules débrayables, les sauvegardes
depuis l'interface, le flux ICS public par espace et une signature par code SMS sans service tiers.

---

## Avancement au 5 novembre 2026

Les dix points de la priorité haute ont été livrés depuis la rédaction du rapport (branche
`fermetures-exceptionnelles`, migrations `20261102140000_saisons_calendrier`,
`20261102160000_validite_pieces`, `20261105100048_horaires_saison_avenants`,
`20261105112816_campagnes` et `20261105115516_partage_annulation_caution`).

| Point | Livré | Reste à faire |
| --- | --- | --- |
| 1 — Calendrier des saisons | Module Administration › Calendrier des saisons : saisons (une seule active), vacances scolaires importées de l'open data « fr-en-calendrier-scolaire » pour la zone choisie ou depuis un export JSON, jours fériés calculés et modifiables, périodes saisies à la main. Options « hors vacances scolaires » et « hors jours fériés » sur les récurrences (back-office, portail, devis en direct, approbation) ; la fin de la saison active pré-remplit la date de fin. Tables `Saison` et `PeriodeCalendrier`, règles dans `src/lib/calendrier.ts`. **Horaires d'ouverture par saison** (REF-03) livrés le 5 novembre : grille particulière par saison sur le formulaire de l'espace (table `HorairesSaison`), appliquée à chaque créneau selon sa date (création, ajout, déplacement, devis en direct), affichée sur la fiche de l'espace. | Le calendrier public du portail, le taux d'occupation des statistiques et l'aide à la saisie restent sur les horaires de base de l'espace. |
| 2 — Campagne annuelle | Module « Campagnes » (débrayable, droit Réservations) : une campagne par saison avec date limite, consignes et espaces ouverts ; cycle brouillon → dépôt ouvert → instruction → clôturée. Sur le portail, « Mes vœux » : chaque organisation dépose ses vœux de créneaux hebdomadaires (espace, jour, heures, activité, hors vacances), contrôlés par les règles de l'espace, et les retire tant que le dépôt est ouvert. Au back-office, grille par espace avec conflits et priorité du demandeur (Ville > autre collectivité / scolaire > association conventionnée > association > entreprise, particulier, autre ; drapeau « conventionnée » sur la fiche usager), décision vœu par vœu ou **arbitrage automatique** (priorité puis ancienneté ; chaque vœu retenu crée un dossier sur toute la saison, accepté à signer ou confirmé, hors vacances et fériés ; un créneau déjà pris laisse le vœu en attente avec le motif), puis **courriel groupé** par organisation (attribués avec numéro de dossier, refusés avec motif). Règles pures dans `src/lib/campagnes.ts`, service `src/server/campagnes.ts`. | Pas de vœux classés par ordre de préférence ni de proposition d'alternative automatique (point 14). Pas de courriel d'annonce de l'ouverture : les usagers découvrent la campagne dans « Mes vœux ». La saisie d'un vœu par un agent pour le compte d'un usager passe par le compte de l'usager. |
| 3 — Pièces datées | Date de fin de validité facultative sur une pièce (dépôt ou correction par un agent), pastille valide / à renouveler / expirée, pièces attendues selon le type d'usager sur la fiche et dans « Mon organisation », onglet « Pièces à vérifier » des usagers, tâche quotidienne de relance (usager et gestionnaires à J-N puis le jour J, paramètre `ALERTE_PIECES_JOURS`). Règles dans `src/lib/pieces.ts`. **Réglage `PIECES_REGLE`** (Paramètres › Réservations, 5 novembre) : signaler seulement, bloquer le dépôt sur le portail, ou bloquer aussi l'acceptation par un agent, quand une pièce attendue manque ou est expirée ; message explicite sur la page de demande du portail. | Le choix revient à la Ville ; la valeur par défaut signale seulement. |
| 4 — Fermetures exceptionnelles | Aperçu des dossiers touchés (espace, parent et sous-espaces) avant de poser un blocage depuis la fiche d'un espace ou le planning ; annulation des créneaux touchés, retirés du montant dû ; courriel « Fermeture exceptionnelle » par dossier et notification, avec un lien pour convenir d'un report ; refus d'un aperçu périmé. Règles dans `src/lib/fermetures.ts`, orchestration dans `src/server/fermetures.ts`. | Proposition automatique de créneaux de remplacement (rejoint le point 14). |
| 5 — Modification de série | Depuis la fiche, chaque créneau prévu a un bouton « Modifier » : nouvel horaire et portée (cette occurrence seulement, celle-ci et les suivantes, toute la série). Les créneaux visés sont décalés du même nombre de jours et prennent les nouvelles heures ; règles de l'espace, chevauchements internes et disponibilité sont vérifiés avant toute écriture. Historique, bornes et montants recalculés, récurrence saisie suivie quand toute la série change de jour, convention régénérée si elle n'est pas encore signée, courriel « Créneaux modifiés » à l'usager. Règles dans `src/lib/serie.ts`, orchestration dans `src/server/serie.ts`. **Avenant** (5 novembre) : si la convention est déjà signée, un avenant numéroté (PDF : parties, convention de référence, créneaux modifiés, nouvelle liste, montant) est édité, joint au courriel « Avenant à signer » et signé par l'usager depuis son dossier avec le même circuit à code que la convention, ou sur papier par un agent ; relance automatique avec les conventions, table `Avenant`, service `src/server/avenant.ts`. | La série reste un seul dossier (pas de scission en deux numéros). Déplacement demandé par l'usager depuis le portail. L'avenant ne couvre que les créneaux : un changement d'options ou de tarif après signature n'en produit pas. |
| 6 — Barème de frais d'annulation | Réglage `ANNULATION_BAREME` (Paramètres › Réservations) en tranches « à moins de N jours du début : % du TTC », par exemple `30:20;7:50;2:100`. À l'annulation d'un dossier accepté, signé ou confirmé : les factures encore dues sont annulées, une facture « Frais d'annulation » est émise pour le montant du barème et l'usager est prévenu. L'agent voit le montant prévu dans la modale d'annulation et peut annuler sans frais ; l'usager voit le montant avant de confirmer sur le portail. Règles dans `src/lib/annulation.ts`. | Un acompte déjà réglé n'est pas compensé automatiquement avec les frais : avoir à faire à la main. |
| 7 — Caution et états des lieux | Cycle de la caution sur le dossier : attendue (dès l'acceptation) → encaissée (paiement de la facture de caution, ou constat d'un agent) → restituée ou retenue. États des lieux d'entrée et de sortie (observations, dégâts, usager présent, photos jointes visibles de l'usager). Restitution possible seulement après l'état des lieux de sortie ; retenue motivée, totale ou partielle, refusée sans constat ; au-delà du seuil `CAUTION_SEUIL_VALIDATION`, elle attend la validation d'un administrateur avant l'envoi à l'usager. Courriels « caution restituée » et « caution retenue », alertes du tableau de bord « cautions à clôturer depuis plus de N jours » (`CAUTION_DELAI_RESTITUTION_JOURS`) et « retenues à valider », filtres correspondants de la liste des réservations. Table `EtatDesLieux`, service `src/server/caution.ts`, règles dans `src/lib/caution.ts`. | Pas d'écran « Cautions » transverse : tout se fait depuis la fiche du dossier et les alertes. Pas de signature électronique de l'état des lieux (nom de l'usager présent seulement). |
| 8 — Espaces partageables | Champ « Occupations simultanées » sur l'espace (1 = exclusif). La disponibilité refuse un créneau seulement quand ce nombre de réservations se recouvrent déjà à un même instant (balayage des bornes, marges comprises) ; un blocage bloque toujours. Règle `conflitsCapacite` dans `src/lib/creneaux.ts`, affichée dans les règles de la fiche de l'espace. | Le calendrier public du portail et le planning continuent de montrer un jour « occupé » dès la première réservation. |
| 9 — Impressions au format calendrier | Planning hebdomadaire en PDF (A4 ou A3, paysage, noir et blanc, date d'édition, une page par espace, week-end grisé, fermetures hachurées, chevauchements en couloirs) depuis le menu « Imprimer » du planning, pour la sélection de sites et d'espaces en cours. Feuille de salle (PDF A4) depuis le planning d'un espace ou sa fiche : programme de la semaine, consignes, règlement et QR code vers la page publique de l'espace. Écran « Semaine type » (Planning › Semaine type) : les séries hebdomadaires acquises d'une saison ramenées sur une semaine, par espace, avec nombre de séances et lien vers le dossier, exportable en PDF A4 / A3. Règles dans `src/lib/editions.ts`, rendu dans `src/server/editions.ts`, script d'aperçu `scripts/apercu-editions.ts`. | Les éditions sont en noir et blanc par choix (photocopie, affichage) ; pas de version couleur ni de planning mensuel imprimable. |
| 10 — Alertes du tableau de bord | Bloc d'alertes à compteurs cliquables vers la liste filtrée : pièces expirées ou bientôt expirées, factures échues, conventions non signées malgré la relance, demandes sans réponse depuis plus de sept jours, fiches à valider, messages (`src/server/alertes.ts`). Compteurs « cautions à clôturer » et « retenues à valider » ajoutés le 5 novembre avec le point 7. | Compteurs « options expirantes » et « contrôles matériel » quand les points 13 et 23 existeront. |

Le point 26 (notifications groupées) est couvert par le courriel de fermeture et par le courriel
de décisions d'une campagne (attributions et refus d'une organisation dans un seul envoi).

---

## 3. Fonctionnalités à ajouter — priorité haute

Valeur métier forte, effort modéré, s'intègrent dans le socle existant (`src/lib`,
`src/server/reservations.ts`, migrations Prisma).

| # | Fonctionnalité | Réf. Résagora | Situation CityRésa | Où l'ajouter |
| --- | --- | --- | --- | --- |
| 1 | **Calendrier des saisons** : vacances scolaires zone C et jours fériés importés ; exclusion automatique dans les récurrences ; saisons (septembre → juin) comme période de référence | ADM-01, PLA-04 | **Réalisé le 2 novembre** (voir Avancement) ; restent les horaires d'ouverture par saison | Tables `Saison` + `PeriodeCalendrier`, options « hors vacances scolaires » et « hors jours fériés » sur la récurrence ; à venir : horaires d'ouverture par saison (REF-03) |
| 2 | **Campagne annuelle des créneaux** : dépôt des vœux par les associations, instruction, arbitrage des conflits selon une priorité (Ville > scolaire > associations conventionnées > autres > entreprises), attribution en lot, courriels d'attribution / refus | PLA-05, RG-03, USR-04 | **Réalisé le 5 novembre** (voir Avancement) | Module `campagnes` (écrans back-office + « Mes vœux » portail), drapeau `conventionnee` sur `Organisation`, tables `Campagne`, `CampagneEspace`, `Voeu` |
| 3 | **Pièces justificatives avec date de validité** (assurance, statuts, RIB) et **alertes d'expiration** au tableau de bord et à l'usager | USR-03, DSH-03 | **Réalisé le 2 novembre** (voir Avancement) | Colonne `valid_until`, règles dans `src/lib/pieces.ts`, bloc d'alertes et tâche quotidienne de relance |
| 4 | **Fermetures exceptionnelles** : à la création d'une indisponibilité, lister les occurrences impactées, notifier les usagers en lot et proposer le report | REF-06, COM-03 | **Réalisé le 4 novembre** (voir Avancement) ; le report reste à convenir avec l'usager | Aperçu `/planning/fermeture`, annulation des créneaux touchés, courriel « Fermeture exceptionnelle » |
| 5 | **Modification d'une récurrence** : cette occurrence seule, celle-ci et les suivantes, ou toute la série | PLA-04 | **Réalisé le 5 novembre** (voir Avancement) | Page « Modifier un créneau » de la fiche, règles dans `src/lib/serie.ts`, orchestration dans `src/server/serie.ts` |
| 6 | **Barème de frais d'annulation** selon le délai (ex. 50 % à J-3), appliqué à l'annulation tardive, facturé | TAR-08, RG-08, PLA-10 | **Réalisé le 5 novembre** (voir Avancement) | Réglage `ANNULATION_BAREME`, règles dans `src/lib/annulation.ts`, facture « Frais d'annulation » |
| 7 | **Cycle de la caution et état des lieux** : statuts attendue → encaissée → restituée / retenue, restitution seulement après l'état des lieux de sortie, retenue motivée avec photos et notification, double validation au-delà d'un seuil, alerte de délai | CAU-02 à CAU-07, RG-11, MOB-03 | **Réalisé le 5 novembre** (voir Avancement) | Cycle de la caution sur `Reservation`, table `EtatDesLieux` (entrée / sortie, photos), service `src/server/caution.ts`, section « Caution & états des lieux » de la fiche |
| 8 | **Espaces partageables** jusqu'à une capacité simultanée (pistes, bassins, terrain multisport) | REF-07, RG-01 | **Réalisé le 5 novembre** (voir Avancement) | Colonne `capacite_simultanee` sur `Espace`, règle `conflitsCapacite` dans `src/lib/creneaux.ts` |
| 9 | **Impressions au format calendrier** : planning hebdomadaire d'un espace ou d'un site (A4 / A3, noir et blanc, date d'édition), **feuille de salle** avec QR code vers la version en ligne, **semaine type** d'un espace ou d'un site | IMP-01, IMP-03, « Semaine type » | **Réalisé le 5 novembre** (voir Avancement) | Routes `planning/semaine.pdf` et `espaces/<id>/feuille.pdf`, écran Planning › Semaine type, règles dans `src/lib/editions.ts` |
| 10 | **Tableau de bord « alertes »** avec compteurs cliquables vers la liste filtrée : pièces expirées, options expirantes, cautions en retard, factures impayées, contrôles matériel | DSH-03, DSH-06 | **Réalisé le 2 novembre** (voir Avancement) ; compteurs options, cautions et matériel à brancher avec les points 13, 7 et 23 | `src/server/alertes.ts` + page d'accueil |

## 4. Fonctionnalités à ajouter — priorité moyenne

Valeur réelle mais effort plus important ou dépendant d'une décision de la Ville.

| # | Fonctionnalité | Réf. Résagora | Situation CityRésa | Remarques |
| --- | --- | --- | --- | --- |
| 11 | **Valorisation des avantages en nature** : méthode par famille d'espace (tarif de référence, coût de revient, valeur locative), calcul par association et par exercice (espaces, matériel, personnel), **attestation annuelle** déposée sur le portail, **annexe du compte administratif** exportable, alertes de seuil **23 000 €** (convention obligatoire) et 153 000 € en cumulant les subventions en numéraire, montants figés à la clôture | VAL-01 à VAL-08, RG-05, RG-12 | Seule une « valeur des gratuités » apparaît dans les statistiques | Synergie directe avec le module ASSO : le seuil de 23 000 € additionne subventions et mises à disposition. Suppose de conserver un tarif de référence même en gratuité (déjà le cas : lignes à zéro gardées « pour mémoire ») |
| 12 | **Grilles tarifaires datées et votées** : date de validité, référence de délibération ; **tarif en vigueur à la date d'occupation**, figé sur le devis accepté ; gratuité ou réduction avec **fondement obligatoire** | TAR-01, TAR-03, TAR-04, RG-04 | Grille sans date ; vérifier que la modification d'une grille ne recalcule pas un dossier accepté | Permet de préparer les tarifs de l'année suivante à l'avance |
| 13 | **Options (pré-réservations) avec date d'expiration**, relance puis libération automatique ; **liste d'attente** sur un créneau occupé, notifiée à la libération | PLA-08, PLA-09, RG-07 | Statut « en traitement » sans échéance ; pas de liste d'attente | Tâche planifiée dans `src/server/taches.ts` |
| 14 | **Alternatives en cas de conflit** : proposer trois créneaux ou espaces libres équivalents | PLA-07 | Refus simple du créneau | Portail et back-office |
| 15 | **Priorité municipale** : déplacer une réservation confirmée pour un événement de la Ville, avec notification et motif | PLA-12 | Blocage manuel + annulation | Transition dédiée dans la machine à états |
| 16 | **Présence et heures réalisées par occurrence**, « absence non signalée » ; alimente la valorisation et les statistiques d'occupation réelle | PLA-11, VAL-03 | Occupation = occupation planifiée | Saisie rapide depuis le planning |
| 17 | **Planning** : vue chronologie par espace, vue multi-sites, vue liste accessible ; **glisser-déposer** avec contrôle serveur ; **vues enregistrées** par agent ; couleur par statut ou type d'usager | PLA-01 à PLA-03 | Jour / semaine / mois, couleur par espace | Le glisser-déposer suppose du JavaScript côté client (CSP à nonce à respecter) |
| 18 | **Portail** : brouillon de demande repris plus tard ; **simulateur de tarif** public avant demande ; disponibilités publiques anonymisées ; attestations de valorisation téléchargeables | POR-04, TAR-11, POR-02, VAL-04 | Statut « brouillon » existe en base ; devis en direct seulement dans le formulaire | Le simulateur réutilise `src/lib/tarification.ts` |
| 19 | **Modèles de documents .docx versionnés**, éditables par un administrateur fonctionnel, fusion typée (« tous les mardis de 18 h à 20 h, hors vacances scolaires »), PDF/A avec empreinte, **avenant** pour toute modification d'un document signé, génération **en lot** | DOC-01 à DOC-06, RG-13 | Texte de convention paramétrable + PDF généré en code ; le cahier des charges liste « éditeur de mise en page » hors périmètre | Grosse valeur pour les agents (ils maîtrisent Word) ; coût : moteur de fusion docx + conversion PDF (Gotenberg ou LibreOffice) |
| 20 | **Finances publiques** : numérotation sans trou par exercice, IBAN du comptable public et référence sur la facture, **export des titres de recettes vers CIVIL Finances Publiques** (lots rejouables), **import des encaissements** ou pointage, rapprochement des factures échues | TAR-05, TAR-06, TAR-10, TAR-12, TAR-13 | Numérotation FAC-AAAA-0001, saisie manuelle des règlements, export CSV | Formats à valider avec Ciril GROUP (voir `resagora/docs/a-brancher.md`) |
| 21 | **Paiement en ligne PayFiP** (Titres ou Régie) : tentative tracée, notification revérifiée, idempotence, rapprochement, trop-perçus | POR-07, TAR-07 | Listé comme évolution dans le cahier des charges | Résagora fournit un simulateur PayFiP réutilisable pour les tests |
| 22 | **RGPD** : durées de conservation paramétrées, anonymisation des usagers inactifs, export des données d'un usager | USR-06 | Archivage et purge des notifications seulement | Tâche planifiée + bouton « exporter mes données » sur le portail |
| 23 | **Matériel** : mouvements de stock (sortie, retour, transfert, perte), retours avec manquants signalés, contrôles périodiques, signalement de panne rendant l'article indisponible | MAT-03 à MAT-05 | Catalogue et stock théorique | Journal de mouvements lié aux réservations |
| 24 | **Envoi programmé des plannings** (hebdomadaire, par courriel, aux gestionnaires d'un site) | IMP-04 | Récapitulatif quotidien des agents | Variante du récapitulatif existant |
| 25 | **Accessibilité outillée** : tests axe-core dans les parcours Playwright, déclaration d'accessibilité et pages réglementaires sur le portail | POR-09, `pages/Reglementaires.tsx` | RGAA « à compléter par la collectivité » | Faible coût, forte valeur réglementaire |
| 26 | **Notifications groupées** : fermeture, attributions de campagne, refus motivés en lot | COM-03 | Un courriel par dossier | Lié aux points 2 et 4 |

## 5. Hors périmètre probable de CityRésa

Spécifique à l'organisation de Résagora ou coûteux pour un gain limité à Châtillon tant que la
Ville ne l'exige pas.

- **Planning des gardiens** (lot 4) : présence par site, besoins générés par les séances,
  vacations et trames, absences / remplacements, moteur de règles de temps de travail, compteurs,
  export paie, habilitations SSIAP / PSC1. Module RH complet, hors de la vocation de CityRésa.
- **Application mobile hors ligne** (PWA, IndexedDB chiffrée) pour pointage, états des lieux et
  incidents dans les gymnases sans réseau. Les états des lieux (point 7) peuvent se faire depuis
  le navigateur sur mobile si le réseau est présent.
- **Architecture DMZ / façade / mTLS**, authentification **Active Directory + TOTP imposé**,
  antivirus **ClamAV** sur les dépôts, **journal d'audit chaîné et ancré**, signature **DocuSeal**.
  Ce sont des choix d'hébergement. Deux idées restent transposables à peu de frais : l'analyse
  antivirus des pièces déposées et la vérification d'intégrité du journal d'audit.
- **Signalement d'incident** rattaché à l'occurrence et à l'usager (PER-09) : utile seulement
  avec un personnel sur place.

## 6. Ordre de mise en œuvre suggéré

1. ~~**Saisons, vacances zone C, jours fériés** (point 1)~~ : livré le 2 novembre.
2. ~~**Pièces avec validité et alertes** (points 3, 10)~~ : livré le 2 novembre.
3. ~~**Fermetures exceptionnelles** (point 4)~~ : livré le 4 novembre.
4. ~~**Modification de série** (point 5)~~ : livré le 5 novembre.
5. ~~**Campagne annuelle** (point 2)~~ : livré le 5 novembre.
6. ~~**Caution et états des lieux** (point 7), **frais d'annulation** (point 6), **espaces partageables** (point 8)~~ : livrés le 5 novembre.
7. ~~**Éditions PDF au format calendrier et semaine type** (point 9)~~ : livré le 5 novembre.
8. **Valorisation des avantages en nature** (point 11), en lien avec le module ASSO : prochaine étape.
9. Ensuite, selon les décisions de la Ville : finances Ciril, PayFiP, modèles .docx, RGPD.

Chaque point se déclare comme module dans `src/server/features.ts` quand il est débrayable, ses
règles vont dans `src/lib` (testées) ou `src/server/reservations.ts`, et toute évolution du
schéma passe par une migration Prisma, conformément à `docs/CONVENTIONS.md`.
