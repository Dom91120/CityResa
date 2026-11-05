import { Icone } from "@/components/icones";
import { Chip } from "@/components/macros";
import { dateCourte } from "@/lib/libelles";
import { contexteAdmin } from "@/modules/admin/server";
import { prisma } from "@/server/db";
import { EMAIL_TEMPLATE_SEEDS } from "@/server/email-templates";

export const metadata = { title: "Modèles de courriel - CityRésa" };

export default async function ModelesCourrielPage() {
  await contexteAdmin();
  const rows = await prisma.emailTemplate.findMany();
  const enBase = new Map(rows.map((r) => [r.key, r]));
  const modeles = EMAIL_TEMPLATE_SEEDS.map((s) => {
    const r = enBase.get(s.key);
    return {
      key: s.key,
      label: r?.label ?? s.label,
      subject: r?.subject ?? s.subject,
      actif: r?.isActive ?? true,
      modifie: r ? r.subject !== s.subject || r.body !== s.body : false,
      updatedAt: r?.updatedAt ?? null,
      aide: s.aide,
    };
  });
  const inconnus = rows.filter((r) => !EMAIL_TEMPLATE_SEEDS.some((s) => s.key === r.key));
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Modèles de courriel{" "}
            <span className="page-count">{modeles.length + inconnus.length}</span>
          </h1>
          <p className="page-subtitle">
            Le sujet et le corps de chaque courriel envoyé par CityRésa. Un modèle désactivé
            n'envoie rien.
          </p>
        </div>
      </div>
      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Modèle</th>
                <th>Sujet</th>
                <th>État</th>
                <th>Modifié le</th>
              </tr>
            </thead>
            <tbody>
              {modeles.map((m) => (
                <tr key={m.key}>
                  <td>
                    <a href={`/modeles-courriel/${m.key}`} className="cell2">
                      <strong>{m.label}</strong>
                      <small>
                        <code>{m.key}</code> · {m.aide}
                      </small>
                    </a>
                  </td>
                  <td className="small">{m.subject}</td>
                  <td>
                    <span className="d-flex gap-1 flex-wrap">
                      {m.actif ? (
                        <Chip teinte="emerald">Actif</Chip>
                      ) : (
                        <Chip teinte="slate">Désactivé</Chip>
                      )}
                      {m.modifie ? <Chip teinte="violet">Personnalisé</Chip> : null}
                    </span>
                  </td>
                  <td className="small text-muted">
                    {m.updatedAt ? dateCourte(m.updatedAt) : "—"}
                  </td>
                </tr>
              ))}
              {inconnus.map((r) => (
                <tr key={r.key}>
                  <td>
                    <a href={`/modeles-courriel/${r.key}`} className="cell2">
                      <strong>{r.label}</strong>
                      <small>
                        <code>{r.key}</code> · pas de texte d'origine
                      </small>
                    </a>
                  </td>
                  <td className="small">{r.subject}</td>
                  <td>
                    {r.isActive ? (
                      <Chip teinte="emerald">Actif</Chip>
                    ) : (
                      <Chip teinte="slate">Désactivé</Chip>
                    )}
                  </td>
                  <td className="small text-muted">{dateCourte(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small text-muted mt-3 d-flex gap-2 align-items-start">
        <Icone nom="info" taille={14} />
        <span>
          Les variables s'écrivent <code>{"{{prenom}}"}</code> ; <code>{"{{collectivite}}"}</code>{" "}
          et <code>{"{{base_url}}"}</code> sont disponibles partout. Les courriels sont habillés
          automatiquement (en-tête à la couleur de la collectivité, pied de page).
        </span>
      </p>
    </>
  );
}
