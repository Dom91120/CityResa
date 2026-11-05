import { describe, expect, it } from "vitest";
import type { AppSettings } from "@/server/config-store";
import { prochaineExecution, TACHES, tachesActives, tachesDues } from "@/server/jobs-registre";

// Le registre raisonne en heure LOCALE du serveur (TZ=Europe/Paris en production) : les
// dates de test sont construites avec le constructeur local pour être indépendantes du fuseau.
function local(h: number, mi: number, jour = 10): Date {
  return new Date(2026, 10, jour, h, mi, 0, 0);
}
const cfg = (extra: Partial<AppSettings> = {}): AppSettings =>
  ({
    BACKUP_DB_DIR: "",
    RAPPEL_J7: true,
    RAPPEL_J1: true,
    SIGNATURE_ENABLED: true,
    PAIEMENTS_ENABLED: true,
    ...extra,
  }) as unknown as AppSettings;

describe("tachesActives", () => {
  it("écarte les tâches dont le module ou le réglage est coupé", () => {
    const ids = tachesActives(cfg()).map((t) => t.id);
    expect(ids).not.toContain("backup_database");
    expect(ids).toContain("relances_signature");
    expect(ids).toContain("rappels_usagers");
    const sans = tachesActives(
      cfg({
        SIGNATURE_ENABLED: false,
        PAIEMENTS_ENABLED: false,
        RAPPEL_J7: false,
        RAPPEL_J1: false,
      }),
    ).map((t) => t.id);
    expect(sans).toEqual([
      "archivage_auto",
      "purge_notifications",
      "terminer_reservations",
      "options",
      "digest_agents",
    ]);
    expect(tachesActives(cfg({ BACKUP_DB_DIR: "/backups" })).map((t) => t.id)).toContain(
      "backup_database",
    );
  });

  it("chaque tâche a un identifiant unique et soit une heure, soit un intervalle", () => {
    expect(new Set(TACHES.map((t) => t.id)).size).toBe(TACHES.length);
    for (const t of TACHES)
      expect(Boolean(t.intervalleMinutes) !== (t.heure !== undefined)).toBe(true);
  });
});

describe("tachesDues sur une fenêtre de 5 minutes", () => {
  it("[07:00, 07:05) : les rappels de 7 h et la tâche horaire", () => {
    const ids = tachesDues(cfg(), local(7, 0), local(7, 5)).map((t) => t.id);
    expect(ids).toEqual(["terminer_reservations", "rappels_usagers"]);
  });

  it("[07:05, 07:10) : rien (le début est inclus, la fin exclue)", () => {
    expect(tachesDues(cfg(), local(7, 5), local(7, 10))).toEqual([]);
  });

  it("[07:13, 07:18) : les relances de signature, seulement si le module est actif", () => {
    expect(tachesDues(cfg(), local(7, 13), local(7, 18)).map((t) => t.id)).toEqual([
      "relances_signature",
    ]);
    expect(tachesDues(cfg({ SIGNATURE_ENABLED: false }), local(7, 13), local(7, 18))).toEqual([]);
  });

  it("[07:28, 07:33) et [07:43, 07:48) : relances de paiement puis récapitulatif", () => {
    expect(tachesDues(cfg(), local(7, 28), local(7, 33)).map((t) => t.id)).toEqual([
      "relances_paiement",
    ]);
    expect(tachesDues(cfg(), local(7, 43), local(7, 48)).map((t) => t.id)).toEqual([
      "digest_agents",
    ]);
  });

  it("[01:58, 02:03) : l'archivage de 2 h (et la tâche horaire) ; la sauvegarde de 1 h n'y est pas", () => {
    expect(
      tachesDues(cfg({ BACKUP_DB_DIR: "/b" }), local(1, 58), local(2, 3)).map((t) => t.id),
    ).toEqual(["archivage_auto", "terminer_reservations"]);
    expect(
      tachesDues(cfg({ BACKUP_DB_DIR: "/b" }), local(0, 58), local(1, 3)).map((t) => t.id),
    ).toEqual(["backup_database", "terminer_reservations"]);
    expect(tachesDues(cfg(), local(0, 58), local(1, 3)).map((t) => t.id)).toEqual([
      "terminer_reservations",
    ]);
  });

  it("une fenêtre à cheval sur minuit ne rate pas la tâche horaire", () => {
    const ids = tachesDues(cfg(), local(23, 58), local(0, 3, 11)).map((t) => t.id);
    expect(ids).toEqual(["terminer_reservations"]);
  });

  it("une fenêtre large rattrape tout ce qui tombe dedans", () => {
    const ids = tachesDues(cfg(), local(6, 55), local(8, 0)).map((t) => t.id);
    expect(ids).toEqual([
      "terminer_reservations",
      "rappels_usagers",
      "relances_signature",
      "relances_paiement",
      "options",
      "digest_agents",
    ]);
  });
});

describe("prochaineExecution", () => {
  const horaire = TACHES.find((t) => t.id === "digest_agents");
  const intervalle = TACHES.find((t) => t.id === "terminer_reservations");
  if (!horaire || !intervalle) throw new Error("registre incomplet");

  it("une tâche horaire : aujourd'hui si l'heure n'est pas passée, sinon demain", () => {
    expect(prochaineExecution(horaire, local(6, 0))).toEqual(local(7, 45));
    expect(prochaineExecution(horaire, local(7, 45))).toEqual(local(7, 45, 11));
    expect(prochaineExecution(horaire, local(9, 0))).toEqual(local(7, 45, 11));
  });

  it("une tâche à intervalle : le prochain multiple strictement après maintenant", () => {
    expect(prochaineExecution(intervalle, local(7, 10))).toEqual(local(8, 0));
    expect(prochaineExecution(intervalle, local(7, 0))).toEqual(local(8, 0));
  });
});
