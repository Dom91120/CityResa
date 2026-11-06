# 11. Personnel de service

Ce chapitre présente le module **Personnel de service** : les gardiens, agents d'accueil et vacataires que la Ville place sur ses sites, leurs vacations, et la façon dont l'application rapproche ces vacations des créneaux réservés pour signaler ceux que personne ne couvre. Ces personnes n'ont pas de compte dans CityRésa : ce sont les agents qui les planifient. Le module s'active dans Administration › Paramètres › Modules (chapitre 9).

## 11.1 Le planning de service

**À quoi ça sert** — Voir, semaine par semaine ou jour par jour, qui est de service sur quel site, et repérer d'un coup d'œil les créneaux réservés qu'aucune vacation ne couvre.

**Qui** — Tous les agents en lecture ; ajout et modification des vacations avec le droit d'écriture sur « Personnel de service » (gestionnaires et agents par défaut). Comme ailleurs, un agent rattaché à certains espaces ne voit que les sites de son périmètre.

![Planning de service](captures/personnel-planning.webp)

*Figure — la semaine de service de Sophie Martin : la ligne « À couvrir » avec les créneaux réservés de ses sites, puis une ligne par personne avec ses vacations.*

**Ce que l'on voit**

- Le titre avec la semaine affichée, puis le résumé : nombre de vacations, nombre de créneaux réservés et leur état (couverts, partiels, à couvrir).
- Les boutons **Personnes**, **Imprimer** (semaine en PDF A4 ou A3, une page par site, créneaux à couvrir hachurés) et **Ajouter une vacation**.
- Les onglets **Planning** et **À couvrir** (avec le nombre de créneaux pas entièrement couverts), la navigation par période et les filtres : **Semaine / Jour**, la date, le **site** et la **personne**.
- La première ligne, **À couvrir**, liste par jour les créneaux réservés (dossiers acceptés, signés ou confirmés) de vos sites, avec l'espace, les heures et une mention colorée :
  - **Couvert** (vert) : une ou plusieurs vacations du site, mises bout à bout, couvrent tout le créneau, ou une personne y est épinglée ;
  - **Partiel** (orange) : une vacation le touche sans le couvrir entièrement ;
  - **À couvrir** (rouge) : personne n'est de service sur ce site à ce moment-là.
  La mention est suivie du nom des personnes concernées ; cliquer ouvre la fiche de la réservation.
- Ensuite, une ligne par personne avec sa couleur, sa fonction, et dans chaque jour ses vacations : le site, les heures et la note. Une vacation à cheval sur minuit s'affiche sur les deux jours.

**Comment faire — ajouter une vacation**

1. Cliquez sur **Ajouter une vacation**.
2. Choisissez la **Personne** et le **Site** : la personne est de service sur tous les espaces du site.
3. Saisissez la **Date**, le **Début** et la **Fin** (une fin avant le début = le lendemain, pour une soirée qui finit après minuit) et, au besoin, une **Note** (remise des clés, état des lieux…).
4. Pour une vacation régulière, cochez **Répéter chaque semaine, le même jour**, indiquez **Jusqu'au (inclus)** et choisissez de **sauter les jours fériés** ou **les vacances scolaires** du calendrier des saisons.
5. Cliquez sur **Ajouter**.

**Comment faire — modifier ou supprimer une vacation**

1. Cliquez sur la vacation dans le planning (ou sur le crayon dans la fiche de la personne).
2. Modifiez la personne, le site, la date, les heures ou la note, puis **Enregistrer**.
3. Pour la supprimer : **Supprimer cette vacation**, ou, si elle vient d'une répétition, **Supprimer celle-ci et les suivantes** pour arrêter la série à partir de cette date.

**Règles à connaître**

- Une même personne ne peut pas être de service deux fois sur des horaires qui se recouvrent : l'application refuse la vacation et dit laquelle gêne. Deux personnes peuvent en revanche être de service en même temps sur le même site.
- Une répétition crée une vacation par semaine, chacune modifiable séparément ; au plus 200 occurrences.
- Seuls les créneaux des dossiers **acceptés, signés ou confirmés** sont à couvrir : une demande encore à l'étude n'apparaît pas.
- Les créneaux à couvrir des 7 prochains jours remontent aussi dans les **alertes** du tableau de bord (chapitre 8).

## 11.2 L'onglet À couvrir

**À quoi ça sert** — Travailler la liste des créneaux de la période qui n'ont pas (ou pas entièrement) de personne de service, sans la grille.

![Créneaux à couvrir](captures/personnel-a-couvrir.webp)

*Figure — les créneaux de la semaine à couvrir ou partiellement couverts, avec l'état et les personnes déjà en place.*

**Ce que l'on voit** — Une ligne par créneau : date et heures, la réservation (titre et numéro, lien vers sa fiche), l'espace, le site, l'**État** et les **Personnes de service** déjà présentes sur une partie du créneau. Quand tout est couvert, la liste le dit.

**Comment faire** — Pour chaque ligne, soit ajoutez une vacation qui couvre le créneau (bouton **Ajouter une vacation**, le site est à choisir), soit ouvrez la réservation et épinglez une personne sur ce créneau précis (section 11.4).

## 11.3 Les personnes

**À quoi ça sert** — Tenir la liste du personnel de service et la fiche de chacun : coordonnées, couleur dans le planning, lien d'agenda, envoi de son planning.

**Qui** — Lecture pour tous les agents ; création et modification en écriture ; suppression avec le droit de suppression (gestionnaires par défaut).

![Liste des personnes](captures/personnel-personnes.webp)

*Figure — les quatre personnes du jeu de démonstration : fonction, contact, vacations à venir, lien d'agenda et état.*

**Ce que l'on voit** — Une recherche (nom, fonction, courriel, téléphone), le filtre **En service / Plus en service / Tous**, et pour chaque personne : sa couleur et son nom, sa **Fonction**, son **Contact**, ses **Vacations à venir** (lien vers son planning), une pastille **ICS** si un lien d'agenda existe, et son **État**.

**Comment faire — ajouter une personne**

1. Cliquez sur **Ajouter une personne**.
2. Saisissez le **Prénom** et le **Nom** (obligatoires), la **Fonction** (gardien, agent d'accueil, vacataire…), la **Couleur dans le planning** (une couleur libre est proposée), le **Courriel** (pour lui envoyer son planning), le **Téléphone** et une **Note**.
3. Cliquez sur **Ajouter** : sa fiche s'ouvre.

![Fiche d'une personne](captures/personnel-fiche.webp)

*Figure — la fiche d'Ali Keita, gardien : identité, lien d'agenda ICS, vacations à venir et créneaux épinglés.*

**La fiche**

- **Identité** : fonction, courriel, téléphone, note, date d'ajout ; le bouton **Modifier** ouvre le formulaire.
- **Calendrier (ICS)** : **Générer le lien ICS** crée une adresse personnelle à coller dans l'agenda de la personne (Outlook, Google Agenda, téléphone) ; ses vacations et les créneaux où elle est épinglée s'y mettent à jour seuls. **Révoquer le lien** l'invalide.
- **Vacations à venir** : les 30 prochaines, avec le site, la note et la mention « chaque semaine » pour celles d'une série ; le crayon ouvre la vacation. Le nombre de vacations passées est rappelé dessous.
- **Créneaux épinglés** : les créneaux de réservation sur lesquels la personne a été placée nommément (section 11.4).
- Le menu **⋯** : **Envoyer son planning de la semaine** (courriel immédiat avec le PDF de la semaine en cours, si la personne a une adresse), **Plus en service** / **Remettre en service**, **Supprimer**.

**Règles à connaître**

- Une personne **plus en service** ne peut plus recevoir de vacation, mais ses vacations passées restent consultables ; elle disparaît du planning.
- **Supprimer** une personne supprime ses vacations ; les créneaux où elle était épinglée reviennent à l'état déduit des vacations.
- Le lien ICS est un secret : ne le transmettez qu'à la personne, et révoquez-le si elle quitte le service.

## 11.4 Épingler une personne sur un créneau

**À quoi ça sert** — Désigner nommément qui s'occupe d'un créneau précis (état des lieux, événement sensible), même sans vacation sur le site ce jour-là.

**Qui** — Agents et gestionnaires qui décident sur le dossier (périmètre) et qui ont le droit d'écriture sur « Personnel de service ».

**Comment faire**

1. Ouvrez la fiche de la réservation ; dans la liste des **Créneaux** de la section **Événement**, une colonne montre pour chaque séance à venir qui est de service.
2. Cliquez sur le bouclier (**Personne de service**) de la séance voulue.
3. Choisissez la personne, ou **Aucune (vacations du site)** pour retirer l'épinglage, puis **Enregistrer**.

**Règles à connaître**

- Un créneau épinglé est toujours **Couvert**, et la personne apparaît en tête, marquée d'un signet.
- L'épinglage ne crée pas de vacation : il n'empêche pas la personne d'être de service ailleurs au même moment. Pour une présence régulière, préférez une vacation.
- Les séances passées ne s'épinglent plus ; elles gardent le nom déjà enregistré.

## 11.5 Courriel hebdomadaire et PDF

**À quoi ça sert** — Donner à chaque personne son planning de la semaine sans ressaisie : par courriel chaque semaine, ou imprimé par site.

**Comment faire — activer l'envoi hebdomadaire**

1. Dans Administration › Paramètres, onglet **Réservations**, activez **Planning de service par courriel au personnel** ; le **Jour d'envoi du planning hebdomadaire** est commun avec celui des gestionnaires (du lundi au jeudi, la semaine en cours ; du vendredi au dimanche, la suivante).
2. Vérifiez que le modèle de courriel **Planning de service (personnel)** est actif (Administration › Modèles de courriel) ; ses variables : `{{prenom}}`, `{{semaine}}`, `{{sites}}`, `{{resume}}`, `{{lien_ics}}`.
3. La tâche planifiée **Planning de service envoyé au personnel** part à 6 h 45 le jour choisi ; elle s'envoie une seule fois par personne et par jour (journal des courriels).

**Imprimer** — Dans le planning de service, **Imprimer › Semaine en PDF** : une page par site, les vacations en couleur et les créneaux à couvrir hachurés, à afficher à la loge ou à l'accueil.
