# CityRésa — scénarios de test et de prise en main

Ces scénarios se déroulent à la main, dans l'ordre, sur le jeu de démonstration. Ils servent à
trois choses à la fois :

- **vérifier** que les actions s'enchaînent comme prévu d'un acteur à l'autre ;
- **se former** à l'outil et à la logique métier (qui fait quoi, quand, et pourquoi) ;
- **voir toute l'application** et le rôle de chacun : usagers, services, élus, administrateur.

Chaque scénario raconte une situation réelle de la Ville, donne les comptes à utiliser, puis les
étapes une à une avec **ce que l'on doit constater**. Le détail des écrans est dans le guide
utilisateur (`docs/guide/`, chapitre indiqué entre parenthèses) ; l'organisation des services
et les écarts connus sont dans le cahier des charges (`docs/CAHIER-DES-CHARGES.md`, § 2 et § 8).

Les encadrés **Écart** signalent ce que l'organisation de la Ville demande et que l'application
ne fait pas encore : ce n'est pas une anomalie à corriger tout de suite, c'est la matière de la
suite du projet.

---

## Avant de commencer

### Préparer le poste

1. Rechargez le jeu de démonstration pour partir d'une base connue :

   ```powershell
   pnpm db:demo --reset
   ```

2. Lancez le serveur de développement et gardez sa **console** visible :

   ```powershell
   pnpm dev
   ```

3. Ouvrez deux fenêtres de navigateur : une fenêtre normale pour le **back-office**
   (`http://localhost:3000`) et une fenêtre de navigation privée pour le **portail**
   (`http://localhost:3000/portail`). Vous jouez ainsi l'agent et l'usager en même temps, sans
   vous déconnecter à chaque étape.

### Courriels, SMS et codes de signature

Rien ne part réellement : les courriels et les SMS sont **simulés** et s'affichent dans la
console du serveur (lignes « Courriel (simulé) → … » et « SMS (simulé) → … »). C'est là que vous
lisez :

- le **code de signature** à six chiffres d'une convention ou d'une attestation ;
- le texte des courriels reçus par l'usager (accusé de réception, acceptation, facture, rappel).

Les dossiers « Acceptée » déjà présents dans le jeu de démonstration se signent avec le code
indiqué dans le `README.md` (section « Comptes de démonstration »).

### Les comptes

Le mot de passe commun des comptes de démonstration est dans le `README.md` ; celui de
l'administrateur est celui affiché par `pnpm db:init`.

| Qui | Compte | Rôle dans l'application | Service joué dans les scénarios |
| --- | --- | --- | --- |
| Sophie Martin | `sophie.martin@exemple.fr` | Gestionnaire, secteur Salles | **Vie associative** et **Service des fêtes** (voir l'écart E1) |
| Karim Benali | `karim.benali@exemple.fr` | Agent, secteur Sports | **Service des sports** |
| Pierre Durand | `pierre.durand@exemple.fr` | Élu, transversal | **Élu** |
| Administrateur | compte de `pnpm db:init` | Administrateur | Administration ; crée le compte **Communication** (scénario 10) |
| Martine Dupont | `martine.dupont@exemple.fr` | Usager | Particulier de la commune |
| Antoine Garcia | `antoine.garcia@exemple.fr` | Usager | Particulier extérieur |
| Julien Bernard | `julien.bernard@exemple.fr` | Usager | Entreprise (Atelier Numérique SAS) |
| Sandra Da Silva | `sandra.da-silva@exemple.fr` | Usager | Association non sportive (Around dance) |
| Madeleine Legouez | `madeleine.legouez@exemple.fr` | Usager | Association (Espace Yoga), dossier de subvention en rédaction |
| Redouane El Bennane | `redouane.el-bennane@exemple.fr` | Usager | Association sportive (ASCB, basket) |
| Jean-Luc Vandamme | `jean-luc.vandamme@exemple.fr` | Usager | Association sportive (TTMC, tennis de table) |
| Josette Nickels | `josette.nickels@exemple.fr` | Usager | Association extérieure (GAMA), fiche à valider |
| Léa Fontaine | `lea.fontaine@exemple.fr` | Usager | Service interne (Service Culturel) |

> **Écart E10** — Le jeu de démonstration n'a qu'un compte pour tout le secteur Salles : Sophie
> Martin joue donc tour à tour la Vie associative et le Service des fêtes. Il n'y a ni compte
> Communication (on le crée au scénario 10), ni compte Financier.

### Comment lire un scénario

- **Qui** : la personne dont vous prenez le compte à cette étape. Un changement de personne
  veut dire : passez dans l'autre fenêtre, ou déconnectez-vous et reconnectez-vous.
- **Constat** : ce qui doit être vrai après l'étape. Si ce n'est pas le cas, notez-le dans la
  grille de suivi en fin de document.
- Les dates sont données en relatif (« dans trois semaines ») : choisissez un jour ouvré, hors
  jours fériés.

### L'ordre conseillé

| # | Scénario | Service | Durée | Ce que l'on apprend |
| --- | --- | --- | --- | --- |
| 1 | Tour d'horizon : qui voit quoi | Tous | 15 min | Rôles, secteurs, périmètres |
| 2 | Un particulier loue une salle | Service des fêtes | 40 min | Le cycle complet d'une réservation payante |
| 3 | Une entreprise réserve, modifie, annule | Service des fêtes | 30 min | Devis, option, avenant, frais d'annulation |
| 4 | Une association réserve une salle | Vie associative | 25 min | Gratuité, pièces, validation d'une fiche |
| 5 | Les créneaux de la saison | Service des sports | 35 min | Campagne de vœux, arbitrage, dossier récurrent |
| 6 | Le personnel de service | Service des sports | 30 min | Vacations, couverture, absences, propositions |
| 7 | La Ville est prioritaire | Tous | 20 min | Service interne, réquisition, fermeture |
| 8 | Une demande de subvention | Vie associative, élu | 40 min | Dépôt, instruction, avis, vote, versement |
| 9 | Ce que voit et fait un élu | Élu | 10 min | Lecture, avis, limites |
| 10 | La Communication suit et remplace | Communication | 20 min | Création de comptes, suivi, suppléance |
| 11 | Encaisser, relancer, corriger | Service des fêtes | 20 min | Paiements, avoirs, export |
| 12 | La fin de l'année | Vie associative | 15 min | Valorisation, statistiques |
| 13 | Faire vivre l'outil | Administrateur | 20 min | Paramètres, tâches planifiées, journal |

---

## Scénario 1 — Tour d'horizon : qui voit quoi

**Situation** — Avant de traiter quoi que ce soit, on regarde l'application avec les yeux de
chacun. Les mêmes données ne donnent pas les mêmes écrans.

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Sophie | Connectez-vous au back-office ; lisez le tableau de bord (ch. 8). | Demandes à traiter, alertes, sept prochains jours : uniquement des **salles**. Le menu de gauche est complet (Réservations … Statistiques), sans la rubrique Administration. |
| 2 | Sophie | Ouvrez **Espaces**. | Les huit salles ; aucun gymnase. Le filtre « Secteur » ne propose rien d'utile : elle n'a qu'un secteur. |
| 3 | Sophie | Ouvrez **Mon équipe** (ch. 5). | Elle-même et l'élu (transversal). Karim, du secteur Sports, n'y est pas. |
| 4 | Karim | Connectez-vous ; lisez le tableau de bord. | Uniquement des **équipements sportifs**. Pas d'entrée **Mon équipe** dans son menu. |
| 5 | Karim | Ouvrez **Réservations**, puis cherchez « R260017 » avec Ctrl K (un dossier de salle). | Le dossier d'une salle n'est pas dans sa liste ; s'il l'atteint, il lit « Vous n'avez pas la main sur cet espace ». |
| 6 | Karim | Ouvrez **Subventions**. | Il voit les dossiers mais aucun bouton d'instruction : lecture seule. |
| 7 | Pierre | Connectez-vous. | Tableau de bord complet, salles et sports confondus ; pas de lien **+ Nouvelle réservation** dans la barre du haut. |
| 8 | Pierre | Ouvrez une demande « À traiter ». | Aucun bouton **Approuver** ni **Décliner**. |
| 9 | Administrateur | Connectez-vous ; ouvrez **Administration › Comptes** puis **Rôles & permissions** (ch. 9). | Les comptes du back-office avec rôle et secteur ; le tableau des droits par rôle et par domaine sur quatre niveaux. |
| 10 | Martine | Dans la fenêtre privée, connectez-vous au portail. | Menu Espaces, Mes réservations, Mes vœux, Mes messages ; pas de « Mes subventions » (réservé aux associations). |
| 11 | Sandra | Connectez-vous au portail. | « Mes subventions » est présent ; « Mon organisation » (menu à son prénom) montre la fiche d'Around dance et ses pièces. |

**Ce qu'il faut retenir**

- Le **rôle** fixe ce que l'on peut faire par domaine (lecture, écriture, suppression) ; le
  **secteur** (Salles ou Sports) et les **espaces rattachés** fixent sur quoi.
- Un agent sans secteur (élu, administrateur) voit tout.

> **Écart E1** — Sophie voit toutes les demandes des salles, celles des associations (Vie
> associative) comme celles des particuliers et des entreprises (Service des fêtes). Rien ne
> sépare les deux services. Dans **Réservations**, essayez le filtre **Tous les types
> d'usager** : c'est aujourd'hui le seul moyen pour chaque service de ne voir que ses dossiers.

---

## Scénario 2 — Service des fêtes : un particulier loue une salle

**Situation** — Martine Dupont, habitante de Châtillon, veut la Salle Gabriel Péri pour un
anniversaire. Le Service des fêtes instruit, fait signer la convention, encaisse l'acompte,
remet les clés, puis solde le dossier. C'est le cycle de référence : tous les autres en sont
des variantes.

**Comptes** — Martine (portail), Sophie (back-office, pour le Service des fêtes).

### A. La demande

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Martine | **Espaces** › Salle Gabriel Péri : lisez la fiche, simulez un tarif (ch. 1.5). | Les tarifs affichés sont ceux du profil « Particulier de la commune » (35 € l'heure, 120 € la demi-journée, 200 € la journée). |
| 2 | Martine | **Demander une réservation** : essayez d'abord une date dans **trois jours**. | Refus : la salle demande au moins 10 jours de délai. |
| 3 | Martine | Reprenez avec un samedi dans **trois semaines**, de 14 h à 23 h ; objet « Anniversaire », 40 participants ; cochez une option (ménage) ; ajoutez du matériel (tables, chaises). | Le **devis** se met à jour à chaque choix. L'unité la moins chère est retenue d'office (ici la journée plutôt que neuf heures). Acompte de 30 % et caution de 400 € sont annoncés. |
| 4 | Martine | Cochez l'acceptation du règlement, **Envoyer ma demande**. | Le dossier apparaît dans **Mes réservations**, statut **À traiter**, avec la phrase « Votre demande est bien reçue… ». Dans la console : le courriel d'accusé de réception. |

### B. L'instruction

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 5 | Sophie | Regardez la cloche et le compteur vert de **Réservations**. | Une notification « nouvelle demande » ; le compteur a augmenté d'un. |
| 6 | Sophie | **Réservations** › onglet **À traiter** › **Répondre** sur le dossier de Martine (ch. 2.5). | Carte « Une décision est attendue » ; à droite, Événement, Demandeur (profil tarifaire), Matériel « À sortir », Montants. |
| 7 | Sophie | **J'ai besoin d'informations** : demandez l'attestation d'assurance. | Statut **En traitement**. Le message est dans le fil de discussion. |
| 8 | Martine | Ouvrez le dossier : lisez le message, répondez dans **Messages**, déposez un fichier dans **Documents** (nature : attestation d'assurance). | Côté usager, la phrase devient « La collectivité vous a demandé des précisions… ». |
| 9 | Sophie | **Messages** (ch. 5.6), puis rouvrez le dossier. | La conversation est « à répondre » ; la pièce est dans la section Documents. |
| 10 | Sophie | Dans le fil, écrivez une **note interne**. | Elle porte la pastille « Note interne ». Vérifiez côté Martine : elle ne la voit pas. |
| 11 | Sophie | **Approuver** : vérifiez le récapitulatif, laissez la tarification payante, ajoutez un message (consignes), validez. | Statut **Acceptée**. La convention PDF est générée (menu « … » › Convention). La caution passe « attendue ». |

### C. La signature et l'acompte

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 12 | Martine | **Mes réservations** : un chiffre signale la convention à signer. Ouvrez le dossier, **Lire la convention (PDF)**. | La convention reprend la salle, la date, le devis et l'identité de la Ville. |
| 13 | Martine | Demandez le code ; lisez-le dans la console du serveur ; saisissez-le avec votre nom, cochez, **Signer la convention**. | Statut **Signée**. Phrase : « votre réservation sera confirmée à réception de l'acompte ». Une **facture d'acompte** (30 %) est dans Factures, « À payer ». |
| 14 | Martine | Essayez un mauvais code avant le bon. | Refus, avec le nombre d'essais restants. |
| 15 | Sophie | Sur le dossier : section **Convention & signature**. | « Signée le… », signataire, mode électronique, adresse IP. |
| 16 | Sophie | **Paiements** (ch. 6) › la facture d'acompte › **Enregistrer un paiement** : mode Chèque, une référence. | Facture **Payée** ; le dossier passe **Confirmée** tout seul. Martine reçoit « Paiement reçu ». |

### D. Avant et après l'événement

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 17 | Sophie | Sur le dossier, section Factures : **Facturer la caution** ; puis **Marquer encaissée** (section Caution). | Facture de caution de 400 €, sans TVA ; caution « encaissée ». |
| 18 | Sophie | **Planning** (ch. 3) : retrouvez le créneau. Filtrez sur la seule Salle Gabriel Péri, **Feuille de salle**. | Le créneau est sur la grille ; la feuille de salle s'ouvre en aperçu PDF. |
| 19 | Sophie | Section **Matériel** : **Sortie** sur chaque article. | Pastille « Sorti » avec la date. |
| 20 | Sophie | **Faire l'état des lieux** d'entrée (observations, nom de l'usager). | L'état des lieux est daté ; Martine le voit dans son dossier. |
| 21 | Sophie | Pour le test, sans attendre la date : **Terminer**. Puis état des lieux de **sortie**, **Retour** du matériel (rendez une chaise de moins). | Statut **Terminée** ; « Rendu avec manquants » ; le stock utilisable du matériel baisse d'une unité (fiche du matériel). |
| 22 | Sophie | **Facturer le solde**, enregistrez son paiement. | Solde = total moins l'acompte. |
| 23 | Sophie | **Retenir tout ou partie** de la caution : 20 €, motif « chaise manquante ». | Sous le seuil de 500 €, la retenue est immédiate ; Martine voit le motif. |
| 24 | Martine | Ouvrez le dossier, onglet **Passées et archivées**. | Frise complète, trois factures, caution retenue en partie, historique. |
| 25 | Sophie | Section **Historique** du dossier. | Chaque étape ci-dessus, horodatée, avec son auteur. |

**Règles illustrées** — délai minimal de l'espace ; profil tarifaire déduit du type et du code
postal ; unité la moins chère ; statuts À traiter › En traitement › Acceptée › Signée ›
Confirmée › Terminée ; l'acompte réglé confirme le dossier ; la caution a son propre cycle ;
les manquants ne sont pas facturés d'office.

**Variantes à essayer**

- Avec **Antoine Garcia** (particulier extérieur), même salle : le devis applique le tarif
  « extérieur » (400 € la journée).
- **Décliner** une demande avec un motif, puis **Rouvrir** : elle repasse « À traiter ».
- Sur un dossier accepté, **Marquer signée (papier)** au lieu de la signature en ligne.
- Demandez un créneau **déjà pris** : le portail propose la liste d'attente et des créneaux
  équivalents.

---

## Scénario 3 — Service des fêtes : une entreprise réserve, modifie, annule

**Situation** — Atelier Numérique SAS veut la grande salle de l'Espace Maison Blanche pour un
séminaire. La date n'est pas ferme : le service pose une option. L'entreprise change ensuite
d'horaire, puis annule tard.

**Comptes** — Administrateur (une fois), Sophie, Julien Bernard.

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Administrateur | **Paramètres › Réservations** : barème de frais d'annulation `30:20;7:50;2:100`, **Enregistrer** (ch. 9.4). | La phrase sous le champ rappelle le barème : 20 % à moins de 30 jours, 50 % à moins de 7, 100 % à moins de 2. |
| 2 | Sophie | **+ Nouvelle réservation** (ch. 2.11) : Salle EMB - Rez de chaussée, **Appliquer** ; demandeur Atelier Numérique SAS ; un jour de semaine dans **quatre semaines**, 9 h – 18 h ; objet « Séminaire annuel », 120 participants ; une option et du matériel. | Le devis en direct applique la grille **Entreprise** (1 200 € la journée) ; caution de 1 000 €. |
| 3 | Sophie | Dans **Décision** : statut initial « Acceptée », **Option jusqu'au** dans dix jours. **Créer la réservation**. | Dossier **Acceptée**, origine « Back-office », pastille « Option jusqu'au… ». Le créneau est bloqué au planning. |
| 4 | Sophie | Recommencez l'étape 2 avec une date dans **dix jours**. | Refus (délai de 21 jours), sauf en cochant **Passer outre le délai et l'horizon**. Annulez la saisie. |
| 5 | Sophie | Saisissez une autre réservation sur le **même créneau** que l'étape 2. | Conflit, avec l'encadré **Créneaux équivalents libres**. Annulez la saisie. |
| 6 | Julien | Portail › dossier : l'échéance de l'option est affichée. Signez la convention (code dans la console). | Statut **Signée** ; l'option tombe ; facture d'acompte émise. |
| 7 | Sophie | Enregistrez le paiement de l'acompte (Virement). | Dossier **Confirmée**. |
| 8 | Sophie | Sur le dossier, crayon du créneau (ch. 2.13) : décalez à 10 h – 19 h, **Prévenir l'usager par courriel**, **Déplacer**. | Les montants sont recalculés ; la convention étant signée, un **avenant** numéroté est édité. |
| 9 | Julien | Ouvrez le dossier : signez l'avenant comme la convention. | L'avenant est signé ; il est listé dans Convention & signature côté Sophie. |
| 10 | Sophie | **Personnel de service** (ch. 11) : cherchez le créneau du séminaire. | L'Espace Maison Blanche est en **affectation automatique** : une personne est déjà affectée au créneau (signet vert), et l'historique du dossier le dit. |
| 11 | Julien | **Annuler ma réservation**. | La fenêtre annonce les frais prévus : 20 % (on est à moins de 30 jours). Confirmez. |
| 12 | Sophie | Rouvrez le dossier, puis **Paiements**. | Statut **Annulée** ; les factures encore dues sont annulées ; une facture **Frais d'annulation** est émise. L'acompte déjà réglé n'est **pas** déduit : c'est à l'agent de faire un avoir (scénario 11). |
| 13 | Sophie | **Planning** : le créneau. | Il est libéré. |
| 14 | Administrateur | Remettez le barème à vide si vous préférez poursuivre sans frais. | — |

**Règles illustrées** — un agent crée directement un dossier accepté ; l'option bloque le
créneau jusqu'à l'échéance, puis l'annule d'office si rien n'est signé ; la dérogation au
délai est une décision d'agent ; toute modification après signature passe par un avenant ; les
frais d'annulation suivent le barème de la Ville ; l'agent peut toujours **Annuler sans
frais**.

**Variante** — Laissez une option arriver à échéance sans signer, puis lancez la tâche à la
main : `pnpm tsx scripts/executer-tache.ts options`. Le dossier est annulé d'office, sans frais.

---

## Scénario 4 — Vie associative : une association réserve une salle

**Situation** — Around dance, association châtillonnaise, demande la Salle de la Folie Desmares
pour son gala. La mise à disposition est gratuite. À côté, une association de Fontenay vient de
s'inscrire : sa fiche est à valider et elle, elle paiera.

**Comptes** — Sandra Da Silva, Josette Nickels, Sophie (pour la Vie associative).

### A. L'association de la commune

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Sandra | **Mon organisation** (menu à son prénom, ch. 1.15). | Profil « Association de la commune » ; pièces attendues (statuts, assurance) avec leur état et leur date de validité. |
| 2 | Sandra | **Espaces** › Salle de la Folie Desmares › demande pour un samedi dans **un mois**, 14 h – 22 h, « Gala de fin d'année », événement **ouvert au public**. | Le devis affiche **Gratuit** : le tarif du profil est nul. Aucun acompte. |
| 3 | Sandra | Envoyez la demande. | Statut **À traiter**. |
| 4 | Sophie | Ouvrez le dossier : section **Montants**. | Lignes à zéro, total « Gratuit ». Section Demandeur : profil « Association de la commune ». |
| 5 | Sophie | **Approuver**. | Statut **Acceptée**, convention à signer. |
| 6 | Sandra | Signez la convention. | Le dossier passe **directement Confirmée** : pas d'acompte attendu, donc pas d'étape « Signée ». Aucune facture. |
| 7 | Sophie | Section **Factures** du dossier. | Aucun bouton de facturation. |
| 8 | Sophie | **Valorisation** (ch. 7.5), exercice en cours, ligne Around dance, dépliez « N dossiers ». | Le dossier compte dans les heures mises à disposition et dans l'**avantage en nature** (valeur de référence moins redevance nulle). |

### B. La gratuité accordée à la main

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 9 | Sophie | **+ Nouvelle réservation** pour **Martine Dupont** (particulier), Salle Gabriel Péri, dans trois semaines ; dans Décision, activez **Mise à disposition gratuite** sans fondement. | Refus : le fondement est obligatoire. |
| 10 | Sophie | Saisissez le fondement (« Intérêt général – fête de quartier »), statut initial « Confirmée ». | Pastille **Gratuité** et son fondement dans Montants ; redevance et caution à zéro ; aucune facture. |

### C. L'association extérieure à valider

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 11 | Josette | Portail › **Mon organisation**. | « En attente de validation » ; profil « Association extérieure » déduit du code postal. |
| 12 | Sophie | **Usagers** › onglet **À valider** › GAMA (ch. 5.3). | Pastille « À valider », pièces attendues manquantes. |
| 13 | Sophie | **Valider**. | La fiche est validée ; courriel aux membres dans la console. |
| 14 | Josette | Demandez la Salle Gabriel Péri, une journée dans trois semaines. | Le devis est **payant** (150 € la journée) : la gratuité tient à la commune, pas au statut d'association. |
| 15 | Sophie | **Usagers** › onglet **Pièces à vérifier** (ch. 5.5). | Les organisations dont une pièce manque, expire bientôt ou a expiré. |

**Règles illustrées** — la gratuité d'une association châtillonnaise vient de la **grille**
(tarif nul de son profil), pas d'une décision au cas par cas ; la gratuité **accordée** exige un
fondement, qui figure sur la convention ; sans acompte, la signature confirme ; ce qui est
gratuit est quand même **valorisé** en fin d'année.

> **Écart E8** — À confirmer avec la Ville : la gratuité vaut-elle pour toutes les associations
> ou pour les seules associations châtillonnaises ? Est-elle plafonnée dans l'année ?
>
> **Écart E1** — À l'étape 4, c'est le compte du secteur Salles qui instruit : rien ne réserve
> ce dossier à la Vie associative, ni les dossiers du scénario 2 au Service des fêtes.
>
> **Écart E6** — À l'étape 12, n'importe quel agent en écriture (Karim compris) peut valider la
> fiche : vérifiez-le en vous connectant avec son compte.

---

## Scénario 5 — Service des sports : les créneaux de la saison

**Situation** — Chaque année, le Service des sports recueille les vœux des associations
sportives, arbitre et attribue les créneaux hebdomadaires des gymnases. Deux clubs veulent le
même créneau.

**Comptes** — Karim (Service des sports), Redouane El Bennane (ASCB), Jean-Luc Vandamme (TTMC).

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Karim | **Campagnes** › **Nouvelle campagne** (ch. 3.12) : « Créneaux gymnases (test) », saison active, date limite dans quinze jours, consignes ; cochez **Gymnase Gambetta**. **Créer la campagne**. | Campagne en **Brouillon**. La liste des espaces ouverts aux vœux lui propose aussi les salles, et la liste des campagnes lui montre celle des salles (écart E11). |
| 2 | Redouane | Portail › **Mes vœux**. | « Aucune campagne n'est ouverte au dépôt pour l'instant. » |
| 3 | Karim | Menu « … » › **Ouvrir le dépôt des vœux**. | État **Dépôt ouvert**. |
| 4 | Redouane | **Mes vœux** › Nouveau vœu : Gymnase Gambetta, jeudi 20 h – 22 h, « Entraînement seniors », 20 participants, hors vacances scolaires. **Déposer ce vœu**. | Vœu « En attente » ; le bandeau rappelle la date limite et les consignes. |
| 5 | Jean-Luc | **Mes vœux** : même gymnase, jeudi **20 h 30 – 22 h 30**, « Entraînement compétition ». Ajoutez un second vœu le mardi 18 h – 20 h. | Deux vœux « En attente ». |
| 6 | Karim | Ouvrez la campagne (ch. 3.13). | Onglet Gymnase Gambetta : trois vœux, dont deux portent la pastille **1 conflit**. |
| 7 | Karim | Menu « … » › **Clore le dépôt et instruire**. | État **En instruction**. Côté portail, le formulaire de vœu a disparu. |
| 8 | Karim | **Arbitrer automatiquement**, confirmez. | Deux associations de même priorité : le vœu déposé **le premier** (ASCB) est attribué ; celui de TTMC qui le chevauche est refusé avec « Créneau attribué en priorité à… ». Le vœu du mardi est attribué. |
| 9 | Karim | **Prévenir les demandeurs**. | Un seul courriel par association dans la console, avec attributions (numéro de dossier) et refus (motif). |
| 10 | Redouane | **Mes vœux**, puis **Mes réservations**. | Vœu « Attribué » avec son dossier ; le dossier récurrent est à signer. Signez-le : il est **Confirmée** aussitôt (gratuit). |
| 11 | Karim | Ouvrez le dossier d'ASCB (ch. 2.12). | Récurrence « Chaque semaine le jeudi, jusqu'au 31/08 » ; une liste de créneaux **sans** les vacances scolaires ni les jours fériés ; Montants : « Gratuit ». |
| 12 | Karim | **Planning** › **Semaine type** (ch. 3.9). | Les créneaux attribués y figurent une fois signés ou acceptés ; PDF A4 / A3. |
| 13 | Karim | Sur le dossier : annulez **une** séance (croix), puis déplacez la suivante (crayon, « Cette occurrence seulement »). | La séance annulée est barrée ; la série reste un seul dossier ; convention déjà signée, donc avenant. |
| 14 | Karim | Menu « … » de la campagne › **Clôturer la campagne**. | État **Clôturée**. |
| 15 | Karim | **Planning** › **Présences** (ch. 3.10) : sur une semaine passée, constatez une présence et une absence. | Pastilles « Présent » avec les heures et « Absent sans prévenir » sur les dossiers ; la fiche de l'usager compte l'absence. |

**Règles illustrées** — une seule campagne ouverte à la fois côté portail ; ordre de priorité
(Ville, collectivité ou scolaire, association conventionnée, association, autres), puis
ancienneté du dépôt ; un vœu attribué devient un dossier sur toute la saison ; chaque séance se
modifie ou s'annule seule ; les heures constatées remplacent les heures prévues dans la
valorisation.

**Variante** — Avant l'étape 8, cochez **Conventionnée** sur la fiche de TTMC (Usagers) : c'est
TTMC qui obtient le jeudi, bien qu'il ait déposé après.

> **Écart E11** — Les campagnes ne suivent pas le secteur : Karim voit la campagne des salles
> et peut ouvrir des salles aux vœux. Seule la décision sur chaque vœu est limitée à ses
> espaces : ouvrez la campagne « Créneaux annuels 2026-2027 » avec son compte pour le constater.
>
> **Écart E3** — L'attribution des créneaux de la saison est une décision à laquelle les élus
> sont associés. Connectez-vous avec Pierre et ouvrez la campagne : il la lit, mais ne peut ni
> donner d'avis ni valider l'arbitrage.

---

## Scénario 6 — Service des sports : le personnel de service

**Situation** — Un gymnase ouvert à une association, c'est un gardien sur place. Le Service des
sports vérifie que chaque créneau réservé est couvert, gère une absence et valide les
propositions de l'application.

**Comptes** — Karim. (Sophie pour la partie salles.)

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Karim | **Personnel de service** (ch. 11.1), vue Semaine. | La ligne **À couvrir** liste les créneaux réservés de ses sites, chacun **Couvert**, **Partiel** ou **À couvrir** ; puis une ligne par personne, avec « X h sur Y h ». Uniquement des sites sportifs. |
| 2 | Karim | Onglet **À couvrir** (ch. 11.2). | La liste des créneaux sans personne, ou couverts en partie. |
| 3 | Karim | **Ajouter une vacation** : Hermione Granger, Gymnase les Sablons, un jour où un créneau est « À couvrir », sur des heures qui l'englobent. | Le créneau passe **Couvert**. Le compteur d'heures de la personne augmente. |
| 4 | Karim | Ajoutez une vacation qui **chevauche** la précédente, pour la même personne. | Refus, avec la vacation qui gêne. |
| 5 | Karim | Ajoutez une vacation pour une personne sur un site qui n'est **pas** le sien. | Enregistrée avec un **avertissement** (bandeau orange). |
| 6 | Karim | Créez une vacation **répétée chaque semaine**, hors vacances scolaires, sur un mois. | Une vacation par semaine, chacune modifiable ; **Supprimer celle-ci et les suivantes** arrête la série. |
| 7 | Karim | Survolez une case, bouton au calendrier barré : posez une **absence** (Maladie) le jour de la vacation de l'étape 3 (ch. 11.7). | Case hachurée ; le message dit que des créneaux repassent en affectation ; le créneau redevient **À couvrir**. |
| 8 | Karim | Bouton **Affecter** (période et site affichés). | Résumé : affectés, proposés, sans personne disponible. Le Gymnase les Sablons n'étant pas en affectation automatique, une personne est **proposée**. |
| 9 | Karim | Onglet **Propositions** (ch. 11.8) : validez l'une (coche), écartez l'autre (personne barrée), choisissez un **autre candidat** pour une troisième. | Validée : signet vert dans la case de la personne. Écartée : la personne n'est plus proposée sur ce créneau. |
| 10 | Karim | Ouvrez la réservation du créneau, colonne **Service** : **épinglez** une personne (ch. 11.4). | Le créneau est Couvert, la personne en tête avec un signet. Essayez d'épingler la personne absente : refus motivé. |
| 11 | Karim | Fiche d'une personne (ch. 11.3) : contrat, horaires, sites, absences ; **Générer le lien ICS** ; menu « ⋯ » › **Envoyer son planning de la semaine**. | Le courriel et son PDF dans la console. |
| 12 | Karim | **Imprimer** › Semaine en PDF. | Une page par site, créneaux à couvrir hachurés. |
| 13 | Sophie | **Personnel de service**. | Elle ne voit que les sites des salles. L'Espace Maison Blanche est en affectation automatique : les créneaux acceptés y sont affectés d'office. |
| 14 | Karim | Tableau de bord, bloc d'alertes. | Compteurs des créneaux sans personne de service dans les 7 jours et des propositions en attente. |

**Règles illustrées** — une vacation couvre un **site entier** ; seuls les créneaux des dossiers
acceptés, signés ou confirmés sont à couvrir ; une personne est disponible si elle est en
service, rattachée au site, sous contrat, en poste d'après ses horaires, non absente et pas
déjà ailleurs ; les candidats sont classés par site principal, puis par charge de la semaine ;
une personne absente ne couvre rien.

---

## Scénario 7 — La Ville est prioritaire

**Situation** — Le conseil municipal se tiendra salle de la Folie Desmares un soir où une
association y a son créneau. Puis des travaux ferment un gymnase une semaine.

**Comptes** — Léa Fontaine (Service Culturel), Sophie, Karim, l'association touchée.

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Léa | Portail : demandez la Salle Gabriel Péri pour une réunion, dans deux semaines. | Profil « Service de la collectivité » : devis **gratuit**. |
| 2 | Sophie | Approuvez ; laissez Léa signer. | Confirmée, sans facture. |
| 3 | Sophie | Ouvrez un dossier **récurrent confirmé** d'une association à la Folie Desmares (R260003, l'entraînement de twirling du mardi et du mercredi). Sur une séance à venir, icône de bâtiment public : **Réquisitionner ce créneau pour la Ville** (ch. 2.14). | Page « Priorité municipale ». |
| 4 | Sophie | Événement « Conseil municipal » ; **Déplacer** sur l'un des créneaux libres proposés ; laissez **Prévenir l'usager** et **Enchaîner sur la saisie** ; **Réquisitionner**. | Le créneau de l'association est déplacé, un avenant est édité (convention signée), le courriel « Priorité municipale » est dans la console ; la page de saisie s'ouvre pré-remplie sur le créneau libéré. |
| 5 | Sophie | Terminez la saisie au nom du **Service Culturel**, statut « Confirmée ». | La Ville occupe le créneau ; l'historique du dossier de l'association porte « Réquisition municipale » et son motif. |
| 6 | Association | Connectez-vous avec son compte : dossier, puis signature de l'avenant. | Le déplacement et son motif sont visibles. |
| 7 | Karim | **Planning** › **Bloquer un créneau** (ch. 3.7) : Gymnase les Sablons, du lundi au vendredi d'une semaine où il est réservé, motif « Travaux ». | La page **Fermeture exceptionnelle** liste les dossiers et créneaux touchés, avec des créneaux de remplacement. |
| 8 | Karim | **Annuler les créneaux touchés** et **Prévenir les usagers**, puis **Fermer l'espace**. | Créneaux annulés et retirés des montants ; un courriel « Fermeture exceptionnelle » par dossier ; le blocage est hachuré au planning ; chaque dossier garde la trace. |
| 9 | Karim | Levez le blocage (croix de son étiquette). | Le blocage disparaît ; les créneaux annulés ne reviennent pas d'eux-mêmes. |

**Règles illustrées** — un service de la Ville réserve gratuitement, sans facture ; la
réquisition porte sur un créneau à la fois, d'un dossier accepté, signé ou confirmé ; la
réservation de la Ville n'est pas créée d'office, on la saisit dans la foulée ; une fermeture
traite en une fois tous les dossiers touchés.

> **Écart E3** — Réquisitionner le créneau d'une association est une décision sensible : aucun
> visa d'élu n'est demandé ni tracé.

---

## Scénario 8 — Vie associative et élus : une demande de subvention

**Situation** — Espace Yoga termine son dossier de subvention pour l'exercice suivant. La Vie
associative l'instruit, le renvoie une fois, le soumet aux élus ; l'élu donne son avis ; le
vote puis le versement sont enregistrés.

**Comptes** — Madeleine Legouez (Espace Yoga), Sophie, Pierre.

### A. Le dépôt

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Sophie | **Subventions** › **Campagnes** (ch. 7.1). | La campagne de l'exercice suivant est **ouverte**, du 1er octobre au 20 novembre. Passé le 20 novembre, la carte indique « Dépôt clos » : **Modifier** la campagne et repoussez la date de clôture, sinon l'étape 6 sera refusée. |
| 2 | Madeleine | Portail › **Mes subventions** (ch. 1.18) : **Reprendre mon dossier**. | Le dossier porte un numéro provisoire (P…) ; dix fiches, chacune avec une coche verte ou un point orange. |
| 3 | Madeleine | Parcourez les fiches ; dans **Budget prévisionnel**, saisissez des montants. | Totaux, résultat et part de la subvention calculés. Demandez plus que le total des produits : refus. |
| 4 | Madeleine | Fiche **Pièces** : déposez les pièces manquantes (un PDF quelconque), en choisissant leur nature. | Chaque pièce attendue passe du signal orange à la coche verte. |
| 5 | Madeleine | Fiche **Attestation** : cochez les engagements, **Recevoir mon code**, signez. | Attestation signée. Modifiez ensuite une fiche : la signature est **annulée**, il faut resigner. |
| 6 | Madeleine | **Aperçu PDF**, puis **Déposer mon dossier**. | Le bloc « Déposer le dossier » liste ce qui manque tant qu'il manque quelque chose. Au dépôt : numéro définitif (S…), PDF généré, accusé de réception. Le dossier ne se modifie plus. |

### B. L'instruction

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 7 | Sophie | **Subventions** › onglet **Déposées** › le dossier (ch. 7.2). | Cadre réservé, synthèse, fiches en lecture, pièces, frise des étapes. |
| 8 | Sophie | **Renvoyer comme incomplet**, avec une remarque. | Le dossier repasse en **rédaction** en gardant son numéro ; courriel à l'association. |
| 9 | Madeleine | Corrigez, resignez, redéposez. | De nouveau **Déposée**. |
| 10 | Sophie | Enregistrez le **Secteur d'instruction**, puis **Prendre en instruction**. | Statut **En instruction** ; Sophie est l'instructrice. Côté portail : « Dossier en cours d'instruction ». |
| 11 | Sophie | **Soumettre aux élus**. | Statut **Avis des élus**. |

### C. L'avis, le vote, le versement

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 12 | Pierre | **Subventions** › onglet **Avis** › le dossier (ch. 7.3). | Il lit tout le dossier ; il a **Donner mon avis** mais ni **Voter**, ni **Refuser**. La carte Instruction rappelle que la décision est enregistrée par les agents. |
| 13 | Pierre | Avis « Avec réserve », montant proposé inférieur au montant demandé, commentaire. Puis **Modifier mon avis**. | Un seul avis par personne : le second remplace le premier. |
| 14 | Sophie | **Voter la subvention**. | Le montant accordé est pré-rempli avec la moyenne des montants proposés. Ajoutez une note (délibération). Statut **Votée** ; courriel et notification à l'association. |
| 15 | Pierre | Rouvrez le dossier. | Les avis sont clos. |
| 16 | Sophie | **Marquer versée**, date du jour. | Statut **Versée**, dossier clos. |
| 17 | Madeleine | **Mes subventions**, puis le dossier (ch. 1.20). | Pastille « Versée le … » ; bandeau « Subvention versée le … : montant » puis le parcours ; bloc Décision ; **Dossier PDF** en aperçu. |
| 18 | Sophie | **Valorisation**, exercice concerné. | La subvention votée s'ajoute aux avantages en nature dans le **total des aides**. |

**Règles illustrées** — un dossier par association et par exercice ; le dépôt n'est possible
que campagne ouverte et dans ses dates ; un dossier incomplet ne se dépose pas ; l'ordre des
étapes est fixe (Rédaction › Déposé › Instruction › Avis › Voté › Versé) ; l'élu donne un avis,
il ne décide pas.

**Variantes** — **Refuser** un dossier avec un motif ; déposer un dossier **au nom d'une
association** depuis le back-office (**Commencer un dossier**), hors période, avec un motif de
dérogation ; ouvrir le dossier d'une association **sportive** (ASCB) pour voir l'autre plan de
budget.

> **Écart E4** — À l'étape 11, Pierre n'est pas prévenu qu'un dossier attend son avis : il doit
> aller voir l'onglet **Avis**. Et tout élu peut se prononcer, quelle que soit sa délégation.
>
> **Écart E5** — Le dossier d'une association sportive devrait revenir au Service des sports.
> Connectez-vous avec Karim : il ne peut qu'en lire le contenu.

---

## Scénario 9 — Ce que voit et fait un élu

**Situation** — Pierre Durand, adjoint au maire, prépare une commission.

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Pierre | Tableau de bord (ch. 8.4). | Indicateurs, alertes, demandes à traiter de toute la Ville. |
| 2 | Pierre | **Statistiques** (ch. 8.5) : changez de période, exportez en Excel. | Volume de demandes, taux d'acceptation, taux d'occupation par espace, recettes, valeur des mises à disposition gratuites. |
| 3 | Pierre | **Planning**, **Réservations**, **Usagers**, **Paiements**. | Tout se lit ; aucun bouton de création, de décision ou de modification. |
| 4 | Pierre | **Valorisation**. | Le total des aides par association. Il a aussi le bouton **Figer l'exercice et déposer les attestations**, parce que le rôle Élu a l'écriture sur les subventions : à noter « À revoir », ce geste revient au service. |
| 5 | Pierre | **Subventions** : donnez un avis (scénario 8). | Seule action possible de l'élu dans l'application. |

> **Écart E3** — Tout ce que l'élu fait dans les circuits de réservation se passe aujourd'hui
> hors de l'application. Pendant ce scénario, notez pour chaque décision où vous attendriez un
> avis ou un visa d'élu : gratuité accordée (scénario 4), dérogation au délai (scénario 3),
> attribution des créneaux (scénario 5), réquisition (scénario 7), refus d'une demande.

---

## Scénario 10 — La Communication suit, relit, remplace

**Situation** — Le service Communication suit les dossiers de la Vie associative et du Service
des fêtes, et les traite quand l'un des deux est absent. Aucun compte n'existe : on les crée,
ce qui fait découvrir l'administration des comptes.

**Comptes** — Administrateur, puis les deux comptes créés.

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Administrateur | **Administration › Comptes** › **Nouveau compte** (ch. 9.12) : un compte « Communication – suivi », rôle **Lecteur**, secteur **Salles**. | Un mot de passe provisoire s'affiche **une seule fois** : notez-le. |
| 2 | Administrateur | Second compte « Communication – suppléance », rôle **Agent**, secteur **Salles**. | Idem. |
| 3 | Communication (suivi) | Connectez-vous ; parcourez Réservations, Planning, Messages. | Toutes les salles, aucun gymnase ; tout en lecture. |
| 4 | Communication (suivi) | Dans **Réservations** et dans le **Planning**, filtrez sur les événements des associations, puis enregistrez une vue du planning (**Mes vues**, ch. 3.5). | La vue se retrouve d'un clic. Il n'existe pas de filtre « événement ouvert au public ». |
| 5 | Communication (suppléance) | Connectez-vous ; traitez une demande « À traiter » d'une salle (approuver ou demander des informations). | Mêmes boutons que Sophie sur les réservations ; pas de suppression ; **Subventions** en lecture ; pas de **Mon équipe**. |
| 6 | Sophie | Sur un dossier, section Événement, **Agent assigné** : choisissez le compte de suppléance (ch. 2.10). | Notification « Dossier assigné » pour ce compte ; le filtre **Tous les agents** de la liste retrouve ses dossiers. |
| 7 | Sophie | **Mon équipe** › icône de porte du compte de suppléance : rattachez-le à deux salles seulement, rôle « Gestionnaire ». | Reconnectez-vous avec ce compte : il ne voit plus que ces deux salles. |
| 8 | Administrateur | **Rôles & permissions** › **Nouveau rôle** « communication » : lecture partout, écriture sur Messages (ch. 9.14). Attribuez-le au compte de suivi. | Le compte peut répondre aux usagers sans décider. |

> **Écart E2** — Trois limites apparaissent :
>
> - la **relecture** n'existe pas : à l'étape 5, la réponse part à l'usager sans second regard ;
> - la **suppléance** est un compte permanent, pas un remplacement daté d'un service ;
> - le compte de suivi voit **tout** le secteur Salles, sans distinguer Vie associative et
>   Service des fêtes (écart E1).
>
> Notez ce que la Communication relit réellement (réponse, convention, événement public,
> facture) : c'est la question à trancher avant de faire évoluer l'application.

---

## Scénario 11 — Service des fêtes : encaisser, relancer, corriger

**Situation** — La régie fait le point sur les factures.

**Comptes** — Sophie (le jeu de démonstration n'a pas de compte Financier ; on peut en créer un
comme au scénario 10, rôle **Financier**, sans secteur).

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Sophie | **Paiements** (ch. 6.1) : onglets à payer, échues, payées. | Factures d'acompte, de solde, de caution, de frais d'annulation, numérotées F26…. Aucune facture pour une association de la commune ni pour un service de la Ville. |
| 2 | Sophie | Ouvrez une facture « À payer » : enregistrez un règlement **partiel**, puis le reste. | Reste dû mis à jour ; **Payée** quand le total est atteint. Une date de règlement future est refusée. |
| 3 | Sophie | Sur la facture d'acompte du dossier annulé au scénario 3 : essayez **Annuler la facture**. | Refus : elle porte un règlement. Il faut un **avoir** (ch. 6.4). |
| 4 | Sophie | Émettez l'avoir correspondant. | L'avoir est listé, rattaché à l'organisation. |
| 5 | Sophie | Créez une **facture libre** pour la chaise manquante du scénario 2. | Facture hors dossier, envoyée par courriel (console). |
| 6 | Sophie | Menu « … » d'une facture : **Renvoyer à l'usager**. | Courriel avec le PDF dans la console. |
| 7 | Sophie | Lancez les relances : `pnpm tsx scripts/executer-tache.ts relances_paiement` (ou, pour l'administrateur, Administration › Tâches planifiées). | Les factures échues sont relancées (ch. 6.5). |
| 8 | Sophie | **Exporter** (ch. 6.6). | Le journal pour la comptabilité. |
| 9 | Financier (si créé) | Parcourez l'application. | Écriture et suppression sur Paiements, lecture partout ailleurs. |

> **Écart E9** — Connectez-vous avec Karim : il a lui aussi l'écriture sur les paiements, alors
> que seul le Service des fêtes facture.

---

## Scénario 12 — Vie associative : la fin de l'année

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Sophie | **Valorisation** (ch. 7.5), exercice en cours. | Organisations aidées, heures mises à disposition, avantages en nature, total des aides ; « Calcul en direct, exercice non figé ». |
| 2 | Sophie | Dépliez « N dossiers » d'une association ; comparez avec ses réservations et les présences constatées au scénario 5. | Les heures constatées remplacent les heures prévues ; une absence compte zéro. |
| 3 | Sophie | Icône d'attestation d'une ligne. | L'attestation annuelle en aperçu PDF. |
| 4 | Sophie | **Figer l'exercice et déposer les attestations**. | Montants arrêtés ; une attestation déposée sur la fiche de chaque organisation. |
| 5 | Sandra | Portail › **Mon organisation**. | L'attestation de valorisation est dans ses documents. |
| 6 | Sophie | Créez une réservation gratuite de plus pour Around dance, revenez à la Valorisation. | Pastille **écart** sur la ligne ; le bouton devient **Refiger et rééditer les attestations**. |
| 7 | Sophie | **Annexe (CSV)**. | L'annexe du compte administratif. |
| 8 | Sophie | **Statistiques** : période « cette année », export Excel. | Occupation par espace, recettes, valeur des mises à disposition. |

**Règles illustrées** — l'avantage en nature se calcule dossier par dossier (valeur de
référence moins redevance, jamais négatif) ; au-delà de 23 000 € d'aides une convention est
obligatoire, au-delà de 153 000 € les comptes doivent être certifiés.

---

## Scénario 13 — Administrateur : faire vivre l'outil

| # | Qui | Action | Constat |
| --- | --- | --- | --- |
| 1 | Administrateur | **Paramètres** (ch. 9.2 à 9.11) : parcourez les onglets. | Identité de la Ville, portail, réservations, convention, messagerie, SMS, modules, pièces jointes, apparence, données personnelles. |
| 2 | Administrateur | Onglet **Modules** : désactivez **Subventions**, enregistrez. | L'entrée disparaît du menu de Sophie et du portail de Sandra. Réactivez. |
| 3 | Administrateur | Onglet **Réservations** : passez « Pièces attendues manquantes ou expirées » sur **Bloquer le dépôt d'une demande sur le portail**. | Une association sans assurance à jour ne peut plus déposer : le portail lui propose **Déposer mes pièces**. Remettez « Signaler seulement ». |
| 4 | Administrateur | **Référentiels** (ch. 9.15) : ajoutez une nature d'événement. | Elle est proposée dans le formulaire de demande. |
| 5 | Administrateur | **Calendrier des saisons** (ch. 9.16). | Saison active, vacances de la zone C, jours fériés : ce sont eux qui retirent des séances aux récurrences. |
| 6 | Administrateur | **Modèles de courriel** (ch. 9.17) : modifiez l'objet de l'accusé de réception, déposez une demande avec Martine. | Le nouveau texte est dans la console. |
| 7 | Administrateur | **Tâches planifiées** (ch. 9.20) : lancez à la main « Rappels J-7 / J-1 aux usagers » et « Clôture des réservations passées ». | Dernière exécution mise à jour ; rappels J-7 / J-1 dans la console pour les dossiers concernés. |
| 8 | Administrateur | **Journal d'audit** (ch. 9.19), filtré sur Réservations. | Les actions des scénarios précédents, avec leur auteur. |
| 9 | Administrateur | **Sauvegardes** (ch. 9.21) : lancez-en une, téléchargez-la. | Un fichier daté. |
| 10 | Administrateur | Ouvrez un dossier refusé ou annulé : menu « … » › **Supprimer le dossier**. Vérifiez avec Sophie que ce menu ne lui est pas proposé. | La suppression d'un dossier est réservée à l'administrateur, pour un brouillon, un refus ou une annulation. |

---

## Grille de suivi

À remplir au fil de l'eau : **OK**, **KO** (l'application ne fait pas ce qui est écrit) ou
**À revoir** (elle le fait, mais ce n'est pas ce que la Ville veut). Les « À revoir » et les
écarts alimentent la suite du projet.

| # | Scénario | Date | Résultat | Étapes en cause | Remarques |
| --- | --- | --- | --- | --- | --- |
| 1 | Tour d'horizon | | | | |
| 2 | Particulier loue une salle | | | | |
| 3 | Entreprise : option, avenant, annulation | | | | |
| 4 | Association : gratuité, validation | | | | |
| 5 | Créneaux de la saison | | | | |
| 6 | Personnel de service | | | | |
| 7 | Priorité de la Ville | | | | |
| 8 | Subvention | | | | |
| 9 | Élu | | | | |
| 10 | Communication | | | | |
| 11 | Paiements | | | | |
| 12 | Fin d'année | | | | |
| 13 | Administration | | | | |

### Les écarts rencontrés

| Écart | Où on le rencontre | Constaté ? | Ce que la Ville attend |
| --- | --- | --- | --- |
| E1 — Vie associative et Service des fêtes non séparés | Scénarios 1, 4, 10 | | |
| E2 — Communication : pas de relecture, pas de suppléance datée | Scénario 10 | | |
| E3 — Élus absents des circuits de réservation | Scénarios 5, 7, 9 | | |
| E4 — Élu de délégation, notification de l'avis attendu | Scénario 8 | | |
| E5 — Service instructeur des subventions | Scénario 8 | | |
| E6 — Service de référence des usagers | Scénario 4 | | |
| E7 — Services non nommés dans les écrans et les documents | Tous | | |
| E8 — Périmètre de la gratuité des associations | Scénario 4 | | |
| E9 — Facturation ouverte aux deux secteurs | Scénario 11 | | |
| E10 — Comptes de démonstration par service | Tous | | |
| E11 — Campagnes de créneaux communes aux deux secteurs | Scénario 5 | | |
