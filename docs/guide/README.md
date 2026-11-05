# Guide utilisateur de CityRésa

CityRésa est l'outil de la Ville de Châtillon pour réserver ses salles, ses équipements sportifs
et son matériel, suivre les usagers (associations, entreprises, particuliers, services de la
ville) et instruire les demandes de subvention des associations.

Ce guide présente l'application **fonctionnalité par fonctionnalité** (chapitres 1 à 9), puis
le **parcours métier** de chaque intervenant (chapitre 10). Toutes les captures d'écran viennent
du jeu de démonstration : les personnes, associations et dossiers cités sont fictifs.

## Deux portes d'entrée

| | Le portail | Le back-office |
| --- | --- | --- |
| Pour qui | Les usagers : habitants, associations, entreprises, services | Les agents de la Ville : agents, gestionnaires, financiers, élus, administrateurs |
| Adresse | `/portail` | `/` (après connexion d'un compte agent) |
| Pour quoi faire | Consulter le catalogue, déposer et suivre ses demandes, signer, échanger avec la Ville, demander une subvention | Traiter les demandes, tenir le planning, gérer les espaces, les usagers, les paiements et les subventions, piloter, paramétrer |

Les deux populations se connectent sur la même page ; l'application oriente chacun vers son
espace.

## Sommaire

1. [Accès, portail public et espace usager](01-portail-et-espace-usager.md)
2. [Les réservations](02-reservations.md)
3. [Planning et campagnes annuelles](03-planning-et-campagnes.md)
4. [Sites, espaces et matériel](04-sites-espaces-materiel.md)
5. [Usagers, messages et équipe](05-usagers-messages-equipe.md)
6. [Paiements](06-paiements.md)
7. [Subventions et valorisation](07-subventions-et-valorisation.md)
8. [Tableau de bord, statistiques et outils du quotidien](08-pilotage-et-outils.md)
9. [Administration](09-administration.md)
10. [Parcours métier par profil](10-parcours-metier.md)

## Lire ce guide

- Les libellés en **gras** sont ceux des boutons et menus tels qu'ils apparaissent à l'écran.
- Les encadrés **Astuce** donnent un raccourci, les encadrés **Attention** une règle qui peut
  surprendre.
- Certains écrans dépendent des modules activés par la Ville (portail, inscription, paiements,
  signature, matériel, subventions, campagnes…) et des droits de votre rôle : un menu absent
  n'est pas une anomalie.

## Mettre à jour les captures

Les captures se refont automatiquement à partir du jeu de démonstration, serveur de
développement lancé :

```
pnpm db:demo --reset
node scripts/captures-guide.mjs            # toutes les captures
node scripts/captures-guide.mjs planning-semaine espace   # seulement celles-ci
node scripts/guide-pdf.mjs                 # rassemble le guide en un PDF
```

Les écrans d'administration demandent un compte administrateur : `GUIDE_ADMIN` (adresse) et
`GUIDE_ADMIN_MDP` (mot de passe), par exemple celui affiché par `pnpm db:init`. La capture
« Mes vœux » demande une campagne au dépôt ouvert (la campagne de démonstration est en
instruction : la repasser en « Dépôt ouvert » le temps de la capture).
