import { notFound } from "next/navigation";
import { EnteteForm, Interrupteur } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import { ScriptDiffere } from "@/components/scripts";
import { contexteAdmin, exemplesVariables, variablesDe } from "@/modules/admin/server";
import { prisma } from "@/server/db";
import { EMAIL_TEMPLATE_SEEDS } from "@/server/email-templates";

export const metadata = { title: "Modèle de courriel - CityRésa" };

const OUTILS: { outil: string; icone: string; titre: string }[] = [
  { outil: "gras", icone: "bold", titre: "Gras" },
  { outil: "italique", icone: "italic", titre: "Italique" },
  { outil: "lien", icone: "link", titre: "Lien" },
  { outil: "liste", icone: "list", titre: "Liste à puces" },
  { outil: "citation", icone: "quote", titre: "Citation" },
  { outil: "paragraphe", icone: "pilcrow", titre: "Paragraphe simple" },
];

export default async function ModeleCourrielPage({ params }: { params: Promise<{ key: string }> }) {
  const page = await contexteAdmin();
  const { key } = await params;
  const seed = EMAIL_TEMPLATE_SEEDS.find((s) => s.key === key);
  const row = await prisma.emailTemplate.findUnique({ where: { key } });
  if (!seed && !row) notFound();
  const label = row?.label ?? seed?.label ?? key;
  const subject = row?.subject ?? seed?.subject ?? "";
  const body = row?.body ?? seed?.body ?? "";
  const actif = row?.isActive ?? true;
  const cfg = page.user.settings;
  const variables = [
    ...new Set([
      "collectivite",
      "base_url",
      ...variablesDe(seed?.subject ?? subject, seed?.body ?? body),
    ]),
  ];
  const exemples = exemplesVariables(cfg.APP_BASE_URL, cfg.COLLECTIVITE_NOM);
  const valeurs: Record<string, string> = {};
  for (const v of variables) valeurs[v] = exemples[v] ?? `[${v}]`;
  const ici = `/modeles-courriel/${key}`;
  const personnalise = seed && row ? row.subject !== seed.subject || row.body !== seed.body : false;
  const pied = [cfg.COLLECTIVITE_NOM, cfg.COLLECTIVITE_ADRESSE, cfg.COLLECTIVITE_EMAIL]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <EnteteForm titre={label} retour="/modeles-courriel" sousTitre={seed?.aide} />
      <form
        method="POST"
        action={ici}
        id="form-principal"
        className="form-seul"
        data-double-envoi
        style={{ maxWidth: 960 }}
      >
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <input type="hidden" name="action" value="enregistrer" />
        <fieldset className="form-section">
          <legend className="form-section-titre">
            <Icone nom="mail" taille={14} />
            Le courriel
          </legend>
          <div className="mb-3 d-flex flex-wrap align-items-center gap-3">
            <Interrupteur
              label="Modèle actif (le courriel est envoyé)"
              name="is_active"
              coche={actif}
            />
            {personnalise ? (
              <Chip teinte="violet">Personnalisé</Chip>
            ) : (
              <Chip teinte="slate">Texte d'origine</Chip>
            )}
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="f-subject">
              Sujet
            </label>
            <input
              type="text"
              name="subject"
              id="f-subject"
              className="form-control"
              defaultValue={subject}
              required
              maxLength={200}
            />
          </div>
          <div
            className="editeur-courriel"
            data-editeur-courriel
            data-exemples={JSON.stringify(valeurs)}
          >
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
              <span className="form-label mb-0">Corps</span>
              <span className="d-flex align-items-center gap-3 small">
                <span className="form-check form-switch mb-0 zone-editeur">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="f-exemples"
                    data-exemples-toggle
                  />
                  <label className="form-check-label" htmlFor="f-exemples">
                    Voir avec des valeurs d'exemple
                  </label>
                </span>
                <button type="button" className="btn btn-link btn-sm p-0" data-basculer-html>
                  Afficher le HTML
                </button>
              </span>
            </div>
            <div className="zone-editeur">
              <div className="barre-outils" role="toolbar" aria-label="Mise en forme et variables">
                {OUTILS.map((o) => (
                  <button
                    key={o.outil}
                    type="button"
                    className="btn btn-ghost btn-icone btn-sm"
                    data-outil={o.outil}
                    title={o.titre}
                    aria-label={o.titre}
                  >
                    <Icone nom={o.icone} taille={15} />
                  </button>
                ))}
                <span className="sep" />
                <span className="variables-boutons">
                  {variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      data-variable={v}
                      title={`Insérer au curseur · exemple : ${valeurs[v]}`}
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </span>
              </div>
              <div className="lien-saisie" data-lien-saisie hidden>
                <label className="small text-muted mb-0" htmlFor="f-lien-url">
                  Adresse du lien
                </label>
                <input
                  type="text"
                  id="f-lien-url"
                  className="form-control form-control-sm"
                  placeholder="https://… ou {{lien}}"
                />
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  data-lien-appliquer
                >
                  Appliquer
                </button>
              </div>
              <div className="courriel-cadre">
                <div className="courriel-carte">
                  <div className="courriel-bandeau">
                    {cfg.COLLECTIVITE_NOM} · Réservation d'espaces
                  </div>
                  <div
                    className="courriel-corps"
                    contentEditable
                    suppressContentEditableWarning
                    data-zone
                    role="textbox"
                    tabIndex={0}
                    aria-multiline="true"
                    aria-label="Corps du courriel"
                    spellCheck
                  />
                  <div className="courriel-pied">{pied}</div>
                </div>
              </div>
            </div>
            <div className="zone-html">
              <textarea
                name="body"
                id="f-body"
                className="form-control font-monospace"
                rows={14}
                defaultValue={body}
                required
                style={{ fontSize: ".82rem" }}
              />
              <div className="form-text">
                Balises admises : <code>&lt;p&gt;</code>, <code>&lt;strong&gt;</code>,{" "}
                <code>&lt;em&gt;</code>, <code>&lt;a href&gt;</code>,{" "}
                <code>&lt;ul&gt;&lt;li&gt;</code>, <code>&lt;blockquote&gt;</code>,{" "}
                <code>&lt;br&gt;</code> ; le reste est retiré à l'enregistrement. Les variables sont
                échappées ; <code>{"{{{x}}}"}</code> insère du HTML brut.
              </div>
            </div>
          </div>
        </fieldset>
        <div className="form-pied">
          <div className="form-pied-supprimer d-flex gap-2 flex-wrap">
            <button
              type="submit"
              form="form-test"
              className="btn btn-outline-secondary"
              title={`Envoie le modèle enregistré, avec des valeurs d'exemple, à ${page.user.email}`}
            >
              <Icone nom="send" taille={14} /> M'envoyer un test
            </button>
            {seed ? (
              <button
                type="submit"
                form="form-retablir"
                className="btn btn-outline-secondary"
                disabled={!personnalise}
                title="Remplace le sujet et le corps par le texte livré avec l'application"
                data-confirm="Remplacer le sujet et le corps par le texte d'origine ?"
                data-confirm-form="#form-retablir"
              >
                <Icone nom="rotate-ccw" taille={14} /> Rétablir le texte d'origine
              </button>
            ) : null}
          </div>
        </div>
      </form>
      <form method="POST" action={ici} id="form-test">
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <input type="hidden" name="action" value="test" />
      </form>
      {seed ? (
        <form method="POST" action={ici} id="form-retablir">
          <input type="hidden" name="csrf_token" value={page.csrf} />
          <input type="hidden" name="action" value="retablir" />
        </form>
      ) : null}
      <ScriptDiffere src="/js/modeles-courriel.js" nonce={page.nonce} />
    </>
  );
}
