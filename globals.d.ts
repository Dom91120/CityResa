// Les imports d'images statiques tirent leurs types de `next/image-types/global`,
// référencé par `next-env.d.ts` (généré, ignoré par git). Posé ici pour que `tsc`
// donne le même verdict partout (CI comprise).
/// <reference types="next/image-types/global" />

// Les imports CSS (`import "./globals.css"`) sont gérés par Next.js au build.
declare module "*.css";
