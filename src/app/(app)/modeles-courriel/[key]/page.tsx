import { notFound } from "next/navigation";
import { Section } from "@/components/fiche";
import { EnteteForm, Interrupteur } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import { contexteAdmin, exemplesVariables, variablesDe } from "@/modules/admin/server";
import { prisma } from "@/server/db";
import { EMAIL_TEMPLATE_SEEDS, rendre } from "@/server/email-templates";

export const metadata = { title: "Modèle de courriel - CityRésa" };

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
  const variables = variablesDe(seed?.subject ?? subject, seed?.body ?? body);
  const exemples = exemplesVariables(
    page.user.settings.APP_BASE_URL,
    page.user.settings.COLLECTIVITE_NOM,
  );
  const vars: Record<string, string> = {};
  for (const v of ["collectivite", "base_url", ...variables]) vars[v] = exemples[v] ?? `[${v}]`;
  const apercuSujet = rendre(subject, vars)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
  const apercuCorps = rendre(body, vars);
  const ici = `/modeles-courriel/${key}`;
  const personnalise = seed && row ? row.subject !== seed.subject || row.body !== seed.body : false;
  return (
    <>
      <EnteteForm
        titre={label}
        retour="/modeles-courriel"
        sousTitre={
          <>
            <code>{key}</code>
            {seed ? ` · ${seed.aide}` : null}
          </>
        }
      />
      <div className="fiche-colonnes fiche-colonnes--50-50">
        <div>
          <form method="POST" action={ici} id="form-principal" data-double-envoi>
            <input type="hidden" name="csrf_token" value={page.csrf} />
            <input type="hidden" name="action" value="enregistrer" />
            <fieldset className="form-section">
              <legend className="form-section-titre">
                <Icone nom="mail" taille={14} />
                Contenu
              </legend>
              <div className="mb-3">
                <Interrupteur
                  label="Modèle actif (le courriel est envoyé)"
                  name="is_active"
                  coche={actif}
                />
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
              <div className="mb-2">
                <label className="form-label" htmlFor="f-body">
                  Corps (HTML simple)
                </label>
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
                  <code>&lt;a href&gt;</code>, <code>&lt;ul&gt;&lt;li&gt;</code>,{" "}
                  <code>&lt;blockquote&gt;</code>, <code>&lt;br&gt;</code>. Les variables sont
                  échappées ; <code>{"{{{x}}}"}</code> insère du HTML brut.
                </div>
              </div>
            </fieldset>
            <div className="form-pied">
              <a href="/modeles-courriel" className="btn btn-outline-secondary js-retour">
                Annuler
              </a>
              <button type="submit" className="btn btn-primary">
                <Icone nom="check" taille={14} /> Enregistrer
              </button>
            </div>
          </form>
        </div>
        <div className="data-card overflow-visible">
          <Section titre="Variables disponibles" icone="hash">
            <div className="coches mb-2">
              {/* Sans doublon : la graine peut déjà citer collectivite ou base_url. */}
              {[...new Set(["collectivite", "base_url", ...variables])].map((v) => (
                <span key={v} className="chip chip-sky" title={exemples[v] ?? ""}>
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
            <p className="small text-muted mb-0">
              Déduites du texte d'origine du modèle. Une variable absente est remplacée par une
              chaîne vide à l'envoi.
            </p>
          </Section>

          <Section titre="Aperçu avec des valeurs d'exemple" icone="eye">
            <div className="small text-muted mb-1">Sujet</div>
            <p className="fw-medium mb-3">{apercuSujet}</p>
            <div className="small text-muted mb-1">Corps</div>
            <div
              className="border rounded p-3"
              style={{ borderColor: "var(--line)", fontSize: ".9rem", lineHeight: 1.55 }}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: contenu rédigé par un administrateur, variables échappées par rendre().
              dangerouslySetInnerHTML={{ __html: apercuCorps }}
            />
          </Section>

          <Section titre="Actions" icone="sliders-horizontal">
            <div className="d-flex gap-2 flex-wrap align-items-center">
              <form method="POST" action={ici}>
                <input type="hidden" name="csrf_token" value={page.csrf} />
                <input type="hidden" name="action" value="test" />
                <button type="submit" className="btn btn-outline-primary btn-sm">
                  <Icone nom="send" taille={14} /> M'envoyer un test ({page.user.email})
                </button>
              </form>
              {seed ? (
                <form method="POST" action={ici}>
                  <input type="hidden" name="csrf_token" value={page.csrf} />
                  <input type="hidden" name="action" value="retablir" />
                  <button
                    type="submit"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={!personnalise}
                    data-confirm="Remplacer le sujet et le corps par le texte d'origine ?"
                  >
                    <Icone nom="rotate-ccw" taille={14} /> Rétablir le texte d'origine
                  </button>
                </form>
              ) : null}
              {personnalise ? (
                <Chip teinte="violet">Personnalisé</Chip>
              ) : (
                <Chip teinte="slate">Texte d'origine</Chip>
              )}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
