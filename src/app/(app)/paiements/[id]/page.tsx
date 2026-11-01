import { notFound } from "next/navigation";
import {
  BoutonOuvrir,
  Entete,
  Lu,
  Lus,
  MenuLien,
  MenuPost,
  MenuSep,
  ModalAction,
  Section,
} from "@/components/fiche";
import { Icone } from "@/components/icones";
import { Avatar, Chip, StatutFacture, StatutResa } from "@/components/macros";
import { FACTURE_TYPES, PAIEMENT_MODES } from "@/lib/constantes";
import { dateCourte, dateHeure, montant, nomCourt, plage, pluriel } from "@/lib/libelles";
import { todayParisISO } from "@/lib/paris-time";
import { aujourdhuiUtc, enRetard, payeDe, resteDe } from "@/modules/paiements/server";
import { Echeance, TypeFacture } from "@/modules/paiements/vues";
import { prisma } from "@/server/db";
import { chargerFacture } from "@/server/factures";
import { idDeRoute } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Facture - CityRésa" };

export default async function FacturePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("paiements", "paiements");
  const id = idDeRoute((await params).id);
  const f = await chargerFacture(id);
  if (!f) notFound();
  const auj = aujourdhuiUtc();
  const paye = payeDe(f);
  const reste = resteDe(f);
  const retard = enRetard(f, auj);
  const peutEditer = page.user.canEdit("paiements");
  const r = f.reservation;
  const client = f.organisation ?? r?.organisation ?? null;
  const contact = r?.user ?? null;
  const autresFactures = r
    ? await prisma.facture.findMany({
        where: { reservationId: r.id, id: { not: f.id } },
        orderBy: { createdAt: "asc" },
        select: { id: true, numero: true, type: true, status: true, montantTtc: true },
      })
    : [];
  const courrielConnu = Boolean(contact?.email ?? client?.email);
  const ici = `/paiements/${f.id}`;
  return (
    <>
      <Entete
        titre={`Facture ${f.numero}`}
        sousTitre={f.libelle}
        retour="/paiements"
        badges={
          <>
            <TypeFacture type={f.type} />
            <StatutFacture status={f.status} />
            {retard ? (
              <Chip teinte="red" dot>
                Échéance dépassée
              </Chip>
            ) : null}
          </>
        }
        actions={
          <>
            {peutEditer && f.status === "a_payer" ? (
              <BoutonOuvrir
                cible="modal-paiement"
                libelle="Enregistrer un paiement"
                icone="banknote"
              />
            ) : null}
            <a
              href={`${ici}/pdf`}
              className="btn btn-outline-secondary"
              target="_blank"
              rel="noopener"
            >
              <Icone nom="file-text" taille={14} /> PDF
            </a>
          </>
        }
        menu={[
          peutEditer && f.status !== "annulee" ? (
            <MenuPost
              key="renvoyer"
              url={`${ici}/renvoyer`}
              libelle={courrielConnu ? "Renvoyer à l'usager" : "Renvoyer (aucun courriel connu)"}
              icone="send"
              csrf={page.csrf}
              confirm={`Renvoyer la facture ${f.numero} par courriel, avec le PDF en pièce jointe ?`}
            />
          ) : null,
          r ? (
            <MenuLien
              key="dossier"
              url={`/reservations/${r.id}`}
              libelle={`Ouvrir le dossier ${r.numero}`}
              icone="clipboard-list"
            />
          ) : null,
          client ? (
            <MenuLien
              key="usager"
              url={`/usagers/${client.id}`}
              libelle="Fiche de l'organisation"
              icone="building-2"
            />
          ) : null,
          peutEditer && f.status === "a_payer" ? <MenuSep key="sep" /> : null,
          peutEditer && f.status === "a_payer" ? (
            <MenuPost
              key="annuler"
              url={`${ici}/annuler`}
              libelle="Annuler la facture"
              icone="ban"
              csrf={page.csrf}
              danger
              confirm={
                f.paiements.length
                  ? "Cette facture porte déjà un règlement : l'annulation sera refusée. Continuer ?"
                  : `Annuler la facture ${f.numero} ? Elle restera visible, marquée « Annulée ».`
              }
            />
          ) : null,
        ]}
      />

      <div className="fiche-colonnes">
        <div className="data-card">
          <Section titre="Facture" icone="receipt">
            <Lus>
              <Lu label="Numéro" valeur={f.numero} />
              <Lu label="Type" valeur={FACTURE_TYPES[f.type] ?? f.type} />
              <Lu label="Émise le" valeur={dateCourte(f.createdAt)} />
              <Lu label="Échéance" valeur={<Echeance f={f} aujourdhui={auj} />} tiret />
              <Lu
                label="Débiteur"
                valeur={
                  client ? (
                    <a href={`/usagers/${client.id}`}>{client.name}</a>
                  ) : contact ? (
                    `${contact.firstName} ${contact.lastName}`.trim()
                  ) : null
                }
                tiret
              />
              <Lu
                label="Contact"
                valeur={
                  contact
                    ? `${contact.firstName} ${contact.lastName}`.trim() +
                      (contact.email ? ` · ${contact.email}` : "")
                    : (client?.email ?? null)
                }
              />
              <Lu label="Créée par" valeur={f.createdBy} />
              <Lu label="Payée le" valeur={f.paidAt ? dateHeure(f.paidAt) : null} />
              <Lu label="Libellé" valeur={f.libelle} pleine />
            </Lus>
            <table className="montants w-100 mt-3">
              <tbody>
                <tr>
                  <td>{f.libelle}</td>
                  <td className="text-end tabular">{montant(f.montantHt)}</td>
                </tr>
                {f.tva ? (
                  <tr>
                    <td className="text-muted">TVA</td>
                    <td className="text-end tabular text-muted">{montant(f.tva)}</td>
                  </tr>
                ) : null}
                <tr className="total">
                  <td>Montant TTC</td>
                  <td className="text-end tabular">{montant(f.montantTtc)}</td>
                </tr>
                {paye ? (
                  <tr>
                    <td className="text-muted">Déjà réglé</td>
                    <td className="text-end tabular text-muted">{montant(paye)}</td>
                  </tr>
                ) : null}
                {f.status === "a_payer" ? (
                  <tr className="total">
                    <td>Reste dû</td>
                    <td className={`text-end tabular${reste ? " text-danger" : ""}`}>
                      {montant(reste)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Section>

          <Section titre="Dossier lié" icone="clipboard-list" ouverte={Boolean(r)}>
            {r ? (
              <>
                <Lus>
                  <Lu
                    label="Dossier"
                    valeur={
                      <a href={`/reservations/${r.id}`}>
                        {r.numero} · {r.title}
                      </a>
                    }
                  />
                  <Lu label="Statut" valeur={<StatutResa status={r.status} />} />
                  <Lu label="Espace" valeur={`${nomCourt(r.espace)} · ${r.espace.site.name}`} />
                  <Lu label="Dates" valeur={plage(r.startAt, r.endAt)} />
                  <Lu label="Montant du dossier" valeur={montant(r.montantTtc)} />
                  <Lu label="Acompte" valeur={r.acompte ? montant(r.acompte) : null} />
                  <Lu label="Caution" valeur={r.caution ? montant(r.caution) : null} />
                </Lus>
                {autresFactures.length ? (
                  <div className="mt-3">
                    <div className="form-label">Autres factures du dossier</div>
                    <ul className="liste-simple" style={{ fontSize: ".82rem" }}>
                      {autresFactures.map((x) => (
                        <li key={x.id} style={{ padding: "6px 0" }}>
                          <a href={`/paiements/${x.id}`}>{x.numero}</a>
                          <TypeFacture type={x.type} />
                          <StatutFacture status={x.status} />
                          <strong className="ms-auto tabular">{montant(x.montantTtc)}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-muted small mb-0">
                Facture libre, émise hors dossier de réservation
                {client ? (
                  <>
                    {" "}
                    pour <a href={`/usagers/${client.id}`}>{client.name}</a>
                  </>
                ) : null}
                .
              </p>
            )}
          </Section>
        </div>

        <div className="data-card" id="encaisser">
          <Section
            titre="Paiements"
            icone="banknote"
            nb={f.paiements.length}
            droite={
              peutEditer && f.status === "a_payer" ? (
                <BoutonOuvrir
                  cible="modal-paiement"
                  libelle="Enregistrer un paiement"
                  icone="plus"
                  classe="btn-outline-primary btn-sm"
                />
              ) : undefined
            }
          >
            {f.paiements.length ? (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-end">Montant</th>
                      <th>Mode</th>
                      <th>Référence</th>
                      <th>Saisi par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.paiements.map((p) => (
                      <tr key={p.id}>
                        <td className="text-nowrap">{dateHeure(p.paidAt)}</td>
                        <td className="text-end tabular fw-medium">{montant(p.montant)}</td>
                        <td>{PAIEMENT_MODES[p.mode] ?? p.mode}</td>
                        <td>{p.reference ?? <span className="text-faint">—</span>}</td>
                        <td>
                          {p.recordedBy ? (
                            <span className="d-inline-flex align-items-center gap-2">
                              <Avatar
                                nom={`${p.recordedBy.firstName} ${p.recordedBy.lastName}`}
                                taille="sm"
                                agent
                              />
                              {`${p.recordedBy.firstName} ${p.recordedBy.lastName}`.trim()}
                            </span>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="fw-medium">Total réglé</td>
                      <td className="text-end tabular fw-medium">{montant(paye)}</td>
                      <td colSpan={3} className="text-muted">
                        {pluriel(f.paiements.length, "règlement")}
                      </td>
                    </tr>
                    {f.status === "a_payer" ? (
                      <tr>
                        <td className="fw-medium">Reste dû</td>
                        <td className="text-end tabular fw-medium text-danger">{montant(reste)}</td>
                        <td colSpan={3} />
                      </tr>
                    ) : null}
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="vide-bloc py-4">
                <span className="ico">
                  <Icone nom="wallet" taille={24} />
                </span>
                <h5>Aucun règlement enregistré</h5>
                <p className="mb-0">
                  {f.status === "a_payer"
                    ? `Reste à encaisser : ${montant(reste)}.`
                    : f.status === "annulee"
                      ? "Cette facture est annulée."
                      : "Rien à encaisser."}
                </p>
              </div>
            )}
          </Section>
        </div>
      </div>

      {peutEditer && f.status === "a_payer" ? (
        <ModalAction
          id="modal-paiement"
          titre={`Enregistrer un paiement · ${f.numero}`}
          action={`${ici}/paiement`}
          csrf={page.csrf}
          bouton="Enregistrer"
          icone="banknote"
          aide={`Reste dû : ${montant(reste)}. Un règlement qui atteint le total solde la facture et prévient l'usager.`}
        >
          <input type="hidden" name="next" value={ici} />
          <div className="grille grille-2">
            <div>
              <label className="form-label" htmlFor="p-montant">
                Montant (€) <span className="req">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                name="montant"
                id="p-montant"
                className="form-control"
                defaultValue={reste.toFixed(2)}
                required
              />
            </div>
            <div>
              <label className="form-label" htmlFor="p-date">
                Date du règlement
              </label>
              <input
                type="date"
                name="date"
                id="p-date"
                className="form-control"
                defaultValue={todayParisISO()}
                max={todayParisISO()}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="p-mode">
                Mode <span className="req">*</span>
              </label>
              <select name="mode" id="p-mode" className="form-select" defaultValue="" required>
                <option value="" disabled>
                  Choisir…
                </option>
                {Object.entries(PAIEMENT_MODES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="p-reference">
                Référence
              </label>
              <input
                type="text"
                name="reference"
                id="p-reference"
                className="form-control"
                placeholder="n° de chèque, de virement, de quittance…"
                maxLength={80}
              />
            </div>
          </div>
        </ModalAction>
      ) : null}
    </>
  );
}
