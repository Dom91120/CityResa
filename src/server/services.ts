/**
 * Les services en base, sous la forme que lisent les règles pures de src/lib/services.ts.
 * À part de src/server/circuits.ts pour que les gardes (src/server/guards.ts) puissent s'en
 * servir sans dépendance circulaire.
 */

import { todayParisISO } from "@/lib/paris-time";
import {
  type ServiceBrut,
  type ServiceUsagers,
  serviceReference,
  servicesAgis,
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
