# CityRésa — conventions de développement

Application Next.js 16 (App Router) + Prisma 7 / PostgreSQL + Better Auth, sur le socle de
sentinelle-next / culturesa-next. UI en français, multi-pages (pas de SPA), Bootstrap 5 +
`public/css/cityresa.css` (thème Vert : barre latérale blanche, accent vert,
cartes arrondies, pastilles pastel, Poppins). Icônes Lucide depuis le sprite
`public/vendor/lucide.svg` (liste des noms disponibles dans `scripts/build-lucide-sprite.mjs`).

## Arborescence

```
src/lib/          logique PURE (constantes, créneaux, tarification, libellés, dates Paris, navigation)
src/server/       services (db, auth, guards, config-store, reservations, convention, signature,
                  factures, mailer, sms, notifications, documents, dashboard, recherche, ics, taches…)
src/components/   gabarits partagés (shell, liste, fiche, formulaire, macros, documents, scripts, icones)
src/modules/<x>/  server.ts (lecture du formulaire, requêtes) + vues.tsx (sous-composants) d'un module
src/app/(app)/    pages du back-office (agents) — enveloppées par src/app/(app)/layout.tsx (Shell)
src/app/(portail)/ pages du portail public et de l'espace usager (layout propre, sans Shell)
src/app/(auth)/   connexion, 2FA, inscription, mot de passe
src/app/envoi/    gestionnaires POST (route.ts) : un formulaire POST /x/y est RÉÉCRIT par le
                  middleware vers /envoi/x/y (l'adresse ne change pas pour le navigateur)
src/app/api/      JSON (auth Better Auth, cron, devis, disponibilités, notifications)
```

## Une page de liste (back-office)

```tsx
import { contexteModule } from "@/server/module";            // droits + module actif
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const page = await contexteModule("espaces");              // Page = { user, counts, flashes, csrf, nonce, pathname, search, features }
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  // charger avec prisma, filtrer avec textSearch(items, q, champs), trier avec trier(items, page.search, colonnes, defaut)
  const perPage = await resolvePerPage(params, page.user, "espaces.list");
  const [rows, p] = paginate(items, params, perPage);
  return (<>
    <div className="page-header"> <h1 className="page-title">Espaces <span className="page-count">{p.total}</span></h1> <div className="page-actions">…</div></div>
    <SegTabs tabs={[…]} />                                   // onglets-segments (statuts)
    <Barre q={q} pathname={page.pathname} search={page.search} filtres={<Filtre name="site" … />} />
    <div className="data-card"><div className="table-responsive"><table className="table table-hover">…</table></div></div>
    <PaginationBar p={p} pathname={page.pathname} search={page.search} />
  </>);
}
```

Composants de `@/components/liste`: `Barre`, `Filtre`, `SegTabs`, `Vide`, `VideBloc`, `PaginationBar`,
`Th` (en-tête triable), `trier`, `urlAvec`. Helpers de `@/server/paging`: `resolvePerPage`,
`paginate`, `textSearch`, `param`, `normaliser`.

## Une fiche

`@/components/fiche`: `Entete` (titre, sousTitre, retour, badges, actions, menu=[<MenuLien/>, <MenuPost/>, <MenuSep/>]),
`Section` (accordéon `<details>` : titre, icone, ouverte, nb, droite), `Lus` + `Lu` (grille intitulé / valeur),
`ModalAction` (formulaire POST dans une modale, id + bouton `BoutonOuvrir`), `Panneau` (offcanvas latéral avec formulaire).
`@/components/macros`: `Chip` (teintes rose/amber/sky/emerald/violet/slate/red/lime), `StatutResa`,
`StatutFacture`, `StatutSubvention`, `TypeOrganisation`, `Avatar`, `Frise` (frise d'avancement), `Delta`,
`PastilleEspace`, `OuiNon`. `@/components/documents`: `ListeDocuments`, `FormDocument`, `Galerie`, `Vignette`.
Mise en page deux colonnes d'une fiche : `<div className="fiche-colonnes">`.

## Un formulaire

`@/components/formulaire`: `EnteteForm` (bouton Enregistrer lié à `form="form-principal"`), `PiedForm`,
`SectionForm`, `Grille` (2/3/4 colonnes), `Champ`, `Zone`, `Select`, `Interrupteur`, `Coches`.
Le `<form method="POST" id="form-principal" action="/espaces/12/modifier">` porte TOUJOURS
`<input type="hidden" name="csrf_token" value={page.csrf} />`. Attributs utiles (public/js/formulaire.js) :
`data-double-envoi` (anti double-clic), `data-recurrence="#bloc"` sur une case, `data-devis="#cible"` sur un
formulaire de demande (devis en direct via POST /api/devis), `data-slug-de="#champ"`, `data-confirm="…"` sur un bouton.

## Un gestionnaire POST (src/app/envoi/…/route.ts)

```ts
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id); if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("espaces");              // requireView / requireEdit / requireDelete / requireAdmin / requireUsager
    try { … } catch (e) { if (e instanceof UserFacingError) return redirigerAvecMessage(retour, e.message, "danger"); throw e; }
    await auditRecord("modification espace", nom, "espaces", user.email);
    return redirigerAvecMessage(`/espaces/${id}`, "Espace modifié", "success");
  });
}
```

Lecture des champs : `champ`, `champOuNull`, `parseInt_`, `parseFloat_`, `parseDate`, `coche`, `idOuNull`,
`ids`, `slugifier` de `@/lib/forms-util`. Date + heure saisies (heure de Paris) → instant :
`parisDateTimeToInstant(ymd, hm)` de `@/lib/paris-time`. Affichage : `dateCourte`, `dateMoyenne`,
`dateLongue`, `heure`, `plage`, `plageHoraire`, `montant`, `montantOuGratuit`, `duree`, `depuis`, `delai`,
`isoParis` de `@/lib/libelles`.

## Droits

`user.canView(cat)` / `canEdit(cat)` / `canDelete(cat)` / `isAdmin` / `isAgent` / `isUsager` /
`gereEspace(espaceId)` (périmètre d'un agent) ; catégories : reservations, planning, espaces, materiel,
usagers, messages, paiements, subventions, equipe. Modules débrayables (`page.features.x`) : portail,
inscription, paiements, signature, materiel, subventions, documents, campagnes. Un usager (portail) utilise
`contexteUsager()` (src/server/page.ts) et ne voit que `whereUsager(user)` (src/server/reservations.ts).

## Services métier (src/server)

- `reservations.ts` : `creerReservation(entree, acteur)`, `changerStatut(id, statut, acteur, {motif, message})`,
  `ajouterMessage(id, auteur, texte, interne)`, `verifierDisponibilite(espace, creneaux, excludeId)`,
  `occupants(espaceId, de, a)`, `deviser(...)`, `stockDisponible`, `recalculerMontants`, `chargerReservation`,
  `transitionsPossibles`, `annulableParUsager`, `INCLUDE_RESERVATION`, `ReservationComplete`.
- `convention.ts` (`genererConvention`, `pdfConvention`), `signature.ts` (`demanderCode`, `signer`),
  `factures.ts` (`creerFacture`, `enregistrerPaiement`, `annulerFacture`, `pdfFacture`, `chargerFacture`).
- `usagers.ts` (`creerCompteUsager`, `validerOrganisation`, `profilParDefaut`), `notifications.ts`
  (`notifier`, `notifierAgents`, `marquerLues`), `mailer.ts` (`envoyerDepuisModele`, `testerSmtp`),
  `documents.ts` (`forParent(kind, id)`, `deposerDocument`, `docCategories`), `dashboard.ts`, `recherche.ts`,
  `ics.ts`, `taches.ts` / `jobs-registre.ts`, `db-backup.ts`, `config-store.ts` (`getSettings`, `saveSettings`,
  `MANAGED`), `amorcage.ts` (`poserMotDePasse`), `two-factor.ts`.
- Toute erreur destinée à l'écran est une `UserFacingError` (src/server/errors.ts).

## Règles

- Pas de JavaScript inline ni d'attribut `onclick` (CSP à nonce) : des attributs `data-*` lus par les
  scripts de `public/js/`. Un script propre à une page : `<ScriptDiffere src="/js/x.js" nonce={page.nonce} />`.
- Pas de nouvelle dépendance npm. Pas de modification de `prisma/schema.prisma` sans migration.
- Libellés en français, dates affichées en heure de Paris, montants avec `montant()`.
- `pnpm typecheck` et `pnpm lint` doivent passer (Biome : `pnpm biome check --write .` corrige le formatage).
