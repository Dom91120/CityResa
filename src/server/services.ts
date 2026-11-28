/**
 * Les services en base, sous la forme que lisent les règles pures de src/lib/services.ts.
 * À part de src/server/circuits.ts pour que les gardes (src/server/guards.ts) puissent s'en
 * servir sans dépendance circulaire.
 */

import { todayParisISO } from "@/lib/paris-time";
import {
  type Rattachement,
  rattachements,
  type ServiceBrut,
  type ServiceUsagers,
  type Signataire,
  serviceReference,
  servicesAgis,
  signataireDe,
  variablesService,
} from "@/lib/services";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { enabledIn } from "@/server/features";

const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function servicesBruts(): Promise<ServiceBrut[]> {
  const services = await prisma.service.findMany({
    select: {
      id: true,
      isActive: true,
      responsableId: true,
      suppleantId: true,
      suppleanceDu: true,
      suppleanceAu: true,
      membres: { select: { userId: true } },
    },
  });
  return services.map((s) => ({
    id: s.id,
    isActive: s.isActive,
    responsableId: s.responsableId,
    membres: s.membres.map((m) => m.userId),
    suppleantId: s.suppleantId,
    suppleanceDu: jour(s.suppleanceDu),
    suppleanceAu: jour(s.suppleanceAu),
  }));
}

/** Les services pour lesquels un agent agit aujourd'hui (suppléances en cours comprises). */
export async function servicesDe(userId: string): Promise<number[]> {
  return servicesAgis(userId, await servicesBruts(), todayParisISO());
}

/**
 * Les services d'un agent aujourd'hui, nommés, avec le titre auquel il agit pour chacun (fiche
 * d'un compte) ; dans l'ordre d'affichage des services.
 */
export async function rattachementsDe(userId: string): Promise<RattachementNomme[]> {
  return (await rattachementsParAgent([userId])).get(userId) ?? [];
}

export type RattachementNomme = Rattachement & { name: string; viaName: string | null };

/** Les mêmes pour plusieurs agents à la fois (liste des comptes), par identifiant de compte. */
export async function rattachementsParAgent(
  userIds: readonly string[],
): Promise<Map<string, RattachementNomme[]>> {
  const [bruts, noms] = await Promise.all([
    servicesBruts(),
    prisma.service.findMany({
      select: { id: true, name: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
  ]);
  const nom = new Map(noms.map((s) => [s.id, s.name]));
  const rang = new Map(noms.map((s, i) => [s.id, i]));
  const jour = todayParisISO();
  return new Map(
    userIds.map((userId) => [
      userId,
      rattachements(userId, bruts, jour)
        .map((l) => ({
          ...l,
          name: nom.get(l.id) ?? "",
          viaName: l.via ? (nom.get(l.via) ?? null) : null,
        }))
        .sort((a, b) => (rang.get(a.id) ?? 0) - (rang.get(b.id) ?? 0)),
    ]),
  );
}

/** Le titre auquel un agent agit pour un service, en clair. */
export function libelleRattachement(r: RattachementNomme): string {
  return r.lien === "suppleance" ? `supplée, par ${r.viaName}` : r.lien;
}

/**
 * Qui signe pour la collectivité les documents d'un dossier confié à ce service (convention,
 * avenant) : le signataire du service, sinon celui de Paramètres › Collectivité.
 */
export function signataireDossier(
  cfg: { COLLECTIVITE_SIGNATAIRE: string; COLLECTIVITE_SIGNATAIRE_QUALITE: string },
  service: { signataire: string | null; signataireQualite: string | null } | null | undefined,
): Signataire {
  return signataireDe(service, {
    nom: cfg.COLLECTIVITE_SIGNATAIRE,
    qualite: cfg.COLLECTIVITE_SIGNATAIRE_QUALITE,
  });
}

/** Les services et les usagers qu'ils suivent, pour calculer le service de référence. */
export async function servicesUsagers(): Promise<ServiceUsagers[]> {
  return prisma.service.findMany({
    select: {
      id: true,
      name: true,
      isActive: true,
      position: true,
      usagerTypes: true,
      usagersSportifs: true,
    },
  });
}

/** Le service de référence d'une organisation (null : aucun, ou module coupé). */
export async function referenceDe(org: {
  type: string;
  sportive: boolean;
}): Promise<ServiceUsagers | null> {
  if (!enabledIn(await getSettings(), "processus")) return null;
  return serviceReference(org, await servicesUsagers());
}

/**
 * Les services actifs, pour le filtre « service » d'une liste ou du planning ; aucun quand le
 * module Processus est éteint (le filtre ne s'affiche alors pas).
 */
export async function optionsServices(): Promise<[string, string][]> {
  if (!enabledIn(await getSettings(), "processus")) return [];
  const services = await prisma.service.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  return services.map((s) => [String(s.id), s.name]);
}

/**
 * Les variables de courriel du service instructeur d'une demande de subvention (nom, contact,
 * signature) ; vide sans service ou module éteint : la collectivité signe alors seule.
 */
export async function variablesServiceSubvention(id: number): Promise<Record<string, string>> {
  const cfg = await getSettings();
  if (!enabledIn(cfg, "processus")) return {};
  const s = await prisma.subvention.findUnique({
    where: { id },
    select: { service: { select: { name: true, email: true, phone: true } } },
  });
  if (!s?.service) return {};
  const { escapeHtml } = await import("@/server/email-templates");
  return variablesService(cfg.COLLECTIVITE_NOM, s.service, escapeHtml);
}

/**
 * La condition sur le dossier d'un créneau qui le limite à une file de travail (dossiers de ses
 * services et dossiers sans service) ; vide sans limite. À étaler dans `reservation: { … }`.
 */
export function dansLaFile(file: readonly number[] | null | undefined): {
  OR?: ({ serviceId: null } | { serviceId: { in: number[] } })[];
} {
  return file ? { OR: [{ serviceId: null }, { serviceId: { in: [...file] } }] } : {};
}
