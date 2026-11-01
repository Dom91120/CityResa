import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Indispensable pour l'image Docker minimale (cf. Dockerfile)
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  // Driver Postgres de Prisma 7 (pg : require dynamique), Puppeteer (PDF) et sharp
  // (vignettes) gardés hors bundle serveur.
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "puppeteer", "sharp"],
  outputFileTracingExcludes: {
    "*": [
      "./backups/**",
      "./docs/**",
      "./Documents/**",
      "./.env",
      "./.env*",
      "./scripts/**",
      "./*.tsbuildinfo",
      "./**/*.test.ts",
    ],
  },
  devIndicators: {
    position: "bottom-right",
  },
  // En-tetes de securite poses PAR L'APP. La CSP porte un nonce par reponse et se
  // construit dans le middleware (src/proxy.ts).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      allowedOrigins: process.env.APP_DOMAIN
        ? process.env.APP_DOMAIN.split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined,
      // Pieces jointes (photos d'espaces, attestations) : 25 Mo.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
