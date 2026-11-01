/**
 * Le contexte d'une page de module du back-office : `contextePage()` + contrôle du droit
 * de lecture sur la catégorie (+ module actif pour un module débrayable).
 */
import { notFound } from "next/navigation";
import type { PermissionCategory } from "@/lib/constantes";
import { enabledIn, type FeatureName, MODULE_CATEGORIES } from "@/server/features";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { contextePage, type Page } from "@/server/page";

export async function contexteModule(
  category: PermissionCategory,
  feature?: FeatureName,
): Promise<Page> {
  const page = await contextePage();
  for (const [name, cat] of Object.entries(MODULE_CATEGORIES)) {
    if (cat === category && !enabledIn(page.user.settings, name as FeatureName)) notFound();
  }
  if (feature && !enabledIn(page.user.settings, feature)) notFound();
  if (!page.user.canView(category)) {
    redirigerAvecFlashDepuisRendu("/", "Accès non autorisé à cette section.", "danger");
  }
  return page;
}
