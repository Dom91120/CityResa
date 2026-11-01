import { notFound } from "next/navigation";
import { Section } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import { JOURS_ISO, TARIF_UNITES } from "@/lib/constantes";
import { lireHoraires } from "@/lib/creneaux";
import { duree, montant } from "@/lib/libelles";
import { aPartirDe } from "@/lib/tarification";
import {
  calendrierMois,
  documentsPublics,
  espacePublic,
  libelleReserveA,
  moisDemande,
  photos,
  profilAutorise,
  profilDe,
} from "@/modules/portail/catalogue";
import { CalendrierDispo } from "@/modules/portail/vues";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/guards";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const e = await espacePublic((await params).slug);
  return { title: `${e?.name ?? "Espace"} - CityRésa` };
}

export default async function FicheEspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mois?: string }>;
}) {
  const { slug } = await params;
  const espace = await espacePublic(slug);
  if (!espace) notFound();
  const [cfg, user, profils, sp] = await Promise.all([
    getSettings(),
    getCurrentUser(),
    prisma.referential.findMany({
      where: { kind: "profil" },
      orderBy: [{ position: "asc" }, { label: "asc" }],
    }),
    searchParams,
  ]);
  const profil = await profilDe(user);
  const mois = await calendrierMois(espace, moisDemande(sp.mois));
  const imgs = photos(espace);
  const docs = documentsPublics(espace);
  const horaires = lireHoraires(espace.openHours);
  const autorise = profilAutorise(espace.allowedProfiles, profil?.code ?? null);
  const base = `/portail/espaces/${espace.slug}`;
  const lienReserver = user
    ? user.isAgent
      ? `/reservations/nouvelle?espace=${espace.id}`
      : `/portail/reserver/${espace.slug}`
    : `/connexion?next=${encodeURIComponent(`/portail/reserver/${espace.slug}`)}`;

  // Grille tarifaire : une ligne par profil, une colonne par unité.
  const unites = Object.keys(TARIF_UNITES).filter((u) => espace.tarifs.some((t) => t.unite === u));
  const lignesTarif: { id: number | null; label: string; mien: boolean }[] = [];
  if (espace.tarifs.some((t) => t.profilId === null))
    lignesTarif.push({ id: null, label: "Tous profils", mien: false });
  for (const p of profils)
    if (espace.tarifs.some((t) => t.profilId === p.id))
      lignesTarif.push({ id: p.id, label: p.label, mien: profil?.id === p.id });
  if (profil && !lignesTarif.some((l) => l.mien) && lignesTarif[0]?.id === null)
    lignesTarif[0].mien = true;
  const site = espace.site;
  const carte =
    site.lat && site.lng
      ? `https://www.openstreetmap.org/?mlat=${site.lat}&mlon=${site.lng}#map=17/${site.lat}/${site.lng}`
      : null;

  return (
    <>
      <p className="mb-3">
        <a href="/portail" className="text-muted small">
          <Icone nom="arrow-left" taille={14} /> Tous les espaces
        </a>
      </p>
      <div className="fiche-espace">
        <div>
          {imgs.length ? (
            <div className={`galerie${imgs.length === 1 ? " galerie--une" : ""}`}>
              <a
                href={`/documents/${imgs[0].id}/view`}
                target="_blank"
                rel="noopener"
                className="principale"
              >
                <img
                  src={`/documents/${imgs[0].id}/thumb`}
                  alt={espace.name}
                  className="principale"
                />
              </a>
              {imgs.slice(1, 3).map((p) => (
                <a key={p.id} href={`/documents/${p.id}/view`} target="_blank" rel="noopener">
                  <img
                    src={`/documents/${p.id}/thumb`}
                    alt={p.title || espace.name}
                    loading="lazy"
                  />
                </a>
              ))}
              {imgs.length === 2 ? <div className="vide" /> : null}
            </div>
          ) : (
            <div className="galerie galerie--une">
              <div className="vide">
                <Icone nom={espace.nature?.icon || "door-open"} taille={64} />
              </div>
            </div>
          )}

          <h1 className="h2 mb-2">{espace.name}</h1>
          <div className="d-flex gap-2 flex-wrap mb-3">
            {espace.nature ? (
              <Chip teinte="rose">
                {espace.nature.icon ? <Icone nom={espace.nature.icon} taille={12} /> : null}
                {espace.nature.label}
              </Chip>
            ) : null}
            {espace.capacityStanding ? (
              <Chip teinte="sky">
                <Icone nom="users" taille={12} /> {espace.capacityStanding} debout
              </Chip>
            ) : null}
            {espace.capacitySeated ? (
              <Chip teinte="sky">
                <Icone nom="armchair" taille={12} /> {espace.capacitySeated} assis
              </Chip>
            ) : null}
            {espace.surface ? <Chip teinte="slate">{espace.surface} m²</Chip> : null}
            {espace.floor ? <Chip teinte="slate">{espace.floor}</Chip> : null}
            <Chip teinte="amber">
              <Icone nom="map-pin" taille={12} /> {site.name}
              {site.city ? ` · ${site.city}` : ""}
            </Chip>
          </div>
          {espace.description ? (
            <p style={{ whiteSpace: "pre-wrap" }} className="mb-4">
              {espace.description}
            </p>
          ) : null}

          <div className="data-card">
            {espace.equipements.length ? (
              <Section titre="Équipements" icone="sparkles">
                <ul className="equipements list-unstyled mb-0">
                  {espace.equipements.map((eq) => (
                    <li key={eq.equipementId}>
                      <Icone nom={eq.equipement.icon || "check"} taille={16} />
                      {eq.equipement.label}
                      {eq.quantity ? <span className="text-muted">× {eq.quantity}</span> : null}
                      {eq.note ? <span className="text-muted small">({eq.note})</span> : null}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {cfg.PORTAIL_AFFICHER_TARIFS ? (
              <Section titre="Tarifs" icone="euro">
                {lignesTarif.length ? (
                  <div className="table-responsive">
                    <table className="table mb-0">
                      <thead>
                        <tr>
                          <th>Profil</th>
                          {unites.map((u) => (
                            <th key={u} className="text-end">
                              {TARIF_UNITES[u]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lignesTarif.map((l) => (
                          <tr key={String(l.id)} className={l.mien ? "fw-semibold" : undefined}>
                            <td>
                              {l.label}
                              {l.mien ? (
                                <Chip teinte="rose" classes="ms-2">
                                  votre profil
                                </Chip>
                              ) : null}
                            </td>
                            {unites.map((u) => {
                              const t = espace.tarifs.find(
                                (x) => x.profilId === l.id && x.unite === u,
                              );
                              return (
                                <td key={u} className="text-end">
                                  {t ? (t.montant === 0 ? "Gratuit" : montant(t.montant)) : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted mb-0">Tarif sur demande.</p>
                )}
                {espace.cautionAmount ? (
                  <p className="text-muted small mt-2 mb-0">
                    Caution demandée : {montant(espace.cautionAmount)}, restituée après l'événement.
                  </p>
                ) : null}
                {!profil && !user ? (
                  <p className="text-muted small mt-2 mb-0">
                    Connectez-vous pour voir le tarif de votre profil.
                  </p>
                ) : null}
              </Section>
            ) : null}

            <Section titre="Horaires d'ouverture" icone="clock">
              {horaires ? (
                <ul className="list-unstyled mb-0" style={{ columns: 2 }}>
                  {JOURS_ISO.map((j) => {
                    const plages = horaires[String(j.iso)] ?? [];
                    return (
                      <li key={j.iso} className="d-flex gap-2">
                        <span style={{ width: 80 }}>{j.long}</span>
                        <span className={plages.length ? "" : "text-muted"}>
                          {plages.length
                            ? plages.map(([a, b]) => `${a} – ${b}`).join(", ")
                            : "Fermé"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mb-0">Ouvert tous les jours.</p>
              )}
            </Section>

            {espace.rules || (user && espace.instructions) ? (
              <Section titre="Règles et consignes" icone="scroll-text">
                {espace.rules ? (
                  <p
                    style={{ whiteSpace: "pre-wrap" }}
                    className={espace.instructions && user ? "" : "mb-0"}
                  >
                    {espace.rules}
                  </p>
                ) : null}
                {user && espace.instructions ? (
                  <div className="astuce">
                    <Icone nom="info" taille={16} />
                    <div style={{ whiteSpace: "pre-wrap" }}>{espace.instructions}</div>
                  </div>
                ) : null}
              </Section>
            ) : null}

            {docs.length ? (
              <Section titre="Documents" icone="file-text" nb={docs.length}>
                <ul className="list-unstyled mb-0">
                  {docs.map((d) => (
                    <li key={d.id} className="py-1">
                      <a href={`/documents/${d.id}/view`} target="_blank" rel="noopener">
                        <Icone nom="file-text" taille={14} /> {d.title || d.filename}
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section titre="Le site" icone="map-pin">
              <div className="fw-semibold">{site.name}</div>
              {site.address || site.postalCode || site.city ? (
                <div>
                  {site.address}
                  {site.address ? <br /> : null}
                  {[site.postalCode, site.city].filter(Boolean).join(" ")}
                </div>
              ) : null}
              {site.accessInfo ? (
                <p className="text-muted small mt-2 mb-0" style={{ whiteSpace: "pre-wrap" }}>
                  {site.accessInfo}
                </p>
              ) : null}
              {carte ? (
                <a
                  href={carte}
                  target="_blank"
                  rel="noopener"
                  className="btn btn-outline-secondary btn-sm mt-2"
                >
                  <Icone nom="map" taille={14} /> Voir sur la carte
                </a>
              ) : null}
            </Section>

            <Section titre="Disponibilités" icone="calendar-days" id="disponibilites">
              <p className="text-muted small">
                Cliquez sur un jour disponible pour commencer votre demande.
              </p>
              <CalendrierDispo mois={mois} slug={espace.slug} baseUrl={base} />
            </Section>
          </div>
        </div>

        <aside>
          <div className="data-card carte-resa p-4">
            {cfg.PORTAIL_AFFICHER_TARIFS ? (
              <div className="prix mb-1">{aPartirDe(espace.tarifs, profil?.id ?? null)}</div>
            ) : null}
            <ul className="list-unstyled small text-muted mb-3">
              <li className="py-1">
                <Icone nom="calendar-clock" taille={14} /> À demander au moins {espace.delayMinDays}{" "}
                jour{espace.delayMinDays > 1 ? "s" : ""} à l'avance
              </li>
              <li className="py-1">
                <Icone nom="timer" taille={14} /> Durée minimale : {duree(espace.minDurationMin)}
                {espace.maxDurationMin ? ` · maximale : ${duree(espace.maxDurationMin)}` : ""}
              </li>
              <li className="py-1">
                {espace.requiresValidation ? (
                  <>
                    <Icone nom="hourglass" taille={14} /> Demande validée par la collectivité
                  </>
                ) : (
                  <>
                    <Icone nom="check" taille={14} /> Réservation confirmée immédiatement
                  </>
                )}
              </li>
              {espace.cautionAmount ? (
                <li className="py-1">
                  <Icone nom="shield" taille={14} /> Caution : {montant(espace.cautionAmount)}
                </li>
              ) : null}
            </ul>
            {!autorise ? (
              <div className="alert alert-warning small">
                <Icone nom="lock" taille={14} /> {libelleReserveA(espace.allowedProfiles, profils)}.
                {user ? " Votre profil ne permet pas de réserver cet espace." : ""}
              </div>
            ) : null}
            <a href={lienReserver} className="btn btn-primary btn-lg w-100">
              <Icone nom="calendar-plus" taille={16} /> Demander une réservation
            </a>
            {!user ? (
              <p className="text-muted small text-center mt-2 mb-0">
                Vous devrez vous connecter
                {cfg.INSCRIPTION_ENABLED ? (
                  <>
                    {" "}
                    ou <a href="/inscription">créer votre espace</a>
                  </>
                ) : null}
                .
              </p>
            ) : null}
            {espace.icsToken ? (
              <a
                href={`/ics/espace/${espace.icsToken}`}
                className="btn btn-outline-secondary w-100 mt-2"
              >
                <Icone nom="calendar-plus" taille={14} /> Ajouter au calendrier
              </a>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}
