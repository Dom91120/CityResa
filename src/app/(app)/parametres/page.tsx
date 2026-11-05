import { Icone } from "@/components/icones";
import { ScriptDiffere } from "@/components/scripts";
import { contexteAdmin } from "@/modules/admin/server";
import { ONGLETS } from "@/modules/parametres/server";
import {
  VoletApparence,
  VoletCollectivite,
  VoletConvention,
  VoletMessagerie,
  VoletModules,
  VoletPieces,
  VoletPortail,
  VoletReservations,
  VoletRgpd,
  VoletSauvegardes,
  VoletSms,
} from "@/modules/parametres/vues";
import { getSettings, invalidateSettings } from "@/server/config-store";

export const metadata = { title: "Paramètres - CityRésa" };

export default async function ParametresPage() {
  const page = await contexteAdmin();
  invalidateSettings();
  const cfg = await getSettings();
  const volets: Record<string, React.ReactNode> = {
    collectivite: <VoletCollectivite cfg={cfg} />,
    portail: <VoletPortail cfg={cfg} />,
    reservations: <VoletReservations cfg={cfg} />,
    convention: <VoletConvention cfg={cfg} />,
    messagerie: <VoletMessagerie cfg={cfg} emailTest={page.user.email} />,
    sms: <VoletSms cfg={cfg} />,
    modules: <VoletModules cfg={cfg} cles={ONGLETS.find((o) => o.cle === "modules")?.cles ?? []} />,
    pieces: <VoletPieces cfg={cfg} />,
    apparence: <VoletApparence cfg={cfg} />,
    rgpd: <VoletRgpd cfg={cfg} />,
    sauvegardes: <VoletSauvegardes cfg={cfg} />,
  };
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
          <p className="page-subtitle">
            La configuration de CityRésa : chaque onglet s'enregistre séparément.
          </p>
        </div>
      </div>

      <ul className="nav nav-onglets" role="tablist" data-onglets>
        {ONGLETS.map((o, i) => (
          <li key={o.cle} className="nav-item" role="presentation">
            <button
              type="button"
              className={`nav-link${i === 0 ? " active" : ""}`}
              id={`ong-${o.cle}`}
              data-bs-toggle="tab"
              data-bs-target={`#vol-${o.cle}`}
              role="tab"
              aria-controls={`vol-${o.cle}`}
              aria-selected={i === 0 ? "true" : "false"}
            >
              <Icone nom={o.icone} taille={14} /> {o.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="tab-content">
        {ONGLETS.map((o, i) => (
          <div
            key={o.cle}
            className={`tab-pane fade${i === 0 ? " show active" : ""}`}
            id={`vol-${o.cle}`}
            role="tabpanel"
            aria-labelledby={`ong-${o.cle}`}
          >
            <form
              method="POST"
              action="/parametres"
              className="form-seul"
              encType="multipart/form-data"
              data-double-envoi
            >
              <input type="hidden" name="csrf_token" value={page.csrf} />
              <input type="hidden" name="action" value={o.cle} />
              <fieldset className="form-section">
                <legend className="form-section-titre">
                  <Icone nom={o.icone} taille={14} />
                  {o.label}
                </legend>
                {volets[o.cle]}
              </fieldset>
              <div className="form-pied">
                <button type="submit" className="btn btn-primary">
                  <Icone nom="check" taille={14} /> Enregistrer
                </button>
              </div>
            </form>
          </div>
        ))}
      </div>
      <ScriptDiffere src="/js/parametres.js" nonce={page.nonce} />
    </>
  );
}
