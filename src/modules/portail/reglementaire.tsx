/** Les pages réglementaires du portail : un gabarit commun, des sections en prose. */
import type { ReactNode } from "react";

export function PageReglementaire({
  titre,
  sousTitre,
  children,
}: {
  titre: string;
  sousTitre?: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{titre}</h1>
          {sousTitre ? <p className="page-subtitle">{sousTitre}</p> : null}
        </div>
      </div>
      <div className="data-card p-4" style={{ maxWidth: 860 }}>
        {children}
      </div>
    </>
  );
}

export function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="h5">{titre}</h2>
      {children}
    </section>
  );
}

/** Un texte libre saisi par la collectivité, sauts de ligne respectés. */
export function TexteLibre({ texte }: { texte: string }) {
  if (!texte.trim()) return null;
  return <div style={{ whiteSpace: "pre-wrap" }}>{texte}</div>;
}
