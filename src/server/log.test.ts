import { afterEach, describe, expect, it, vi } from "vitest";
import { _assainir, journal } from "@/server/log";

describe("_assainir", () => {
  it("masque les clés sensibles, quelle que soit la casse", () => {
    expect(
      _assainir({
        password: "x",
        Mot_de_passe: "y",
        motdepasse: "z",
        SECRET: "s",
        token: "t",
        jeton: "j",
        cookie: "c",
        Authorization: "Bearer …",
        session: "s",
        api_key: "k",
        "api-key": "k",
        apikey: "k",
        cle: "k",
        code: "123456",
        ok: 1,
      }),
    ).toEqual({
      password: "[masqué]",
      Mot_de_passe: "[masqué]",
      motdepasse: "[masqué]",
      SECRET: "[masqué]",
      token: "[masqué]",
      jeton: "[masqué]",
      cookie: "[masqué]",
      Authorization: "[masqué]",
      session: "[masqué]",
      api_key: "[masqué]",
      "api-key": "[masqué]",
      apikey: "[masqué]",
      cle: "[masqué]",
      code: "[masqué]",
      ok: 1,
    });
  });

  it("ne masque que les clés exactes (codePostal ou password_hint restent lisibles)", () => {
    expect(_assainir({ codePostal: "92320", password_hint: "indice", tokens: 3 })).toEqual({
      codePostal: "92320",
      password_hint: "indice",
      tokens: 3,
    });
  });

  it("descend dans les objets et les tableaux", () => {
    expect(
      _assainir({
        user: { email: "a@b.fr", password: "x" },
        liste: [{ token: "t", n: 1 }, "texte", 2],
      }),
    ).toEqual({
      user: { email: "a@b.fr", password: "[masqué]" },
      liste: [{ token: "[masqué]", n: 1 }, "texte", 2],
    });
  });

  it("résume une Error (nom, message, pile)", () => {
    const e = new Error("boum");
    const out = _assainir({ erreur: e }) as {
      erreur: { nom: string; message: string; pile?: string };
    };
    expect(out.erreur.nom).toBe("Error");
    expect(out.erreur.message).toBe("boum");
    expect(typeof out.erreur.pile).toBe("string");
  });

  it("tronque les tableaux à 20 éléments et la profondeur à 4", () => {
    const grand = Array.from({ length: 30 }, (_, i) => i);
    expect((_assainir({ grand }) as { grand: number[] }).grand).toHaveLength(20);
    const profond = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    expect(_assainir(profond)).toEqual({ a: { b: { c: { d: { e: "[…]" } } } } });
  });

  it("laisse passer les valeurs simples", () => {
    expect(_assainir("texte")).toBe("texte");
    expect(_assainir(42)).toBe(42);
    expect(_assainir(null)).toBeNull();
    expect(_assainir(undefined)).toBeUndefined();
  });
});

describe("journal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("écrit une ligne lisible hors production, métadonnées masquées", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    journal.info("sms", "SMS simulé", { to: "+33698765432", code: "123456" });
    expect(log).toHaveBeenCalledTimes(1);
    const ligne = String(log.mock.calls[0][0]);
    expect(ligne.startsWith("[sms] SMS simulé ")).toBe(true);
    expect(ligne).toContain('"to":"+33698765432"');
    expect(ligne).toContain('"code":"[masqué]"');
    expect(ligne).not.toContain("123456");
  });

  it("sans métadonnées, la ligne est nue ; les niveaux vont sur warn et error", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    journal.info("mod", "info");
    journal.avert("mod", "attention", { token: "t" });
    journal.erreur("mod", "échec", { erreur: new Error("boum") });
    expect(log).toHaveBeenCalledWith("[mod] info");
    expect(String(warn.mock.calls[0][0])).toContain('"token":"[masqué]"');
    expect(String(error.mock.calls[0][0])).toContain('"message":"boum"');
  });

  it("en production, écrit une ligne JSON horodatée avec le niveau et le module", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    try {
      journal.info("cron", "passage", { password: "x", taches: ["a", "b"] });
    } finally {
      vi.unstubAllEnvs();
    }
    const obj = JSON.parse(String(log.mock.calls[0][0]));
    expect(obj).toMatchObject({
      niveau: "info",
      module: "cron",
      message: "passage",
      password: "[masqué]",
      taches: ["a", "b"],
    });
    expect(new Date(obj.t).toISOString()).toBe(obj.t);
  });

  it("ne lève jamais, même avec une métadonnée circulaire", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const cyclique: Record<string, unknown> = {};
    cyclique.moi = cyclique;
    expect(() => journal.info("x", "cycle", cyclique)).not.toThrow();
  });
});
