"use client";

import { useEffect } from "react";

/**
 * Charge les scripts de la page APRÈS l'hydratation React : les pages les déclarent
 * inertes (`<script type="text/x-differe" data-src>`), et ce composant les rejoue, dans
 * l'ordre (socle d'abord, page ensuite), puis déclenche les écouteurs `DOMContentLoaded`
 * qu'ils ont posés.
 */
declare global {
  interface Window {
    __cityresaScriptsCharges?: boolean;
  }
}

async function charger() {
  const tous = Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[type="text/x-differe"]'),
  );
  const inertes = [
    ...tous.filter((s) => s.dataset.rang !== "2"),
    ...tous.filter((s) => s.dataset.rang === "2"),
  ];
  if (!inertes.length) return;
  const attente: EventListenerOrEventListenerObject[] = [];
  const original = document.addEventListener;
  document.addEventListener = ((
    type: string,
    fn: EventListenerOrEventListenerObject | null,
    opts?: boolean | AddEventListenerOptions,
  ) => {
    if (type === "DOMContentLoaded" && fn) {
      attente.push(fn);
      return;
    }
    return original.call(document, type, fn as EventListenerOrEventListenerObject, opts);
  }) as typeof document.addEventListener;
  try {
    for (const inerte of inertes) {
      await new Promise<void>((resolve) => {
        const el = document.createElement("script");
        el.nonce = inerte.nonce || inerte.getAttribute("nonce") || "";
        const src = inerte.dataset.src;
        if (src) {
          el.src = src;
          el.onload = () => resolve();
          el.onerror = () => resolve();
          inerte.after(el);
        } else {
          el.textContent = inerte.textContent;
          inerte.after(el);
          resolve();
        }
      });
    }
  } finally {
    document.addEventListener = original;
  }
  const ev = new Event("DOMContentLoaded");
  for (const fn of attente) {
    try {
      if (typeof fn === "function") fn.call(document, ev);
      else fn.handleEvent(ev);
    } catch (e) {
      console.error(e);
    }
  }
  document.documentElement.dataset.pret = "1";
  document.dispatchEvent(new Event("cityresa:pret"));
}

export function ChargeurScripts() {
  useEffect(() => {
    if (window.__cityresaScriptsCharges) return;
    window.__cityresaScriptsCharges = true;
    void charger();
  }, []);
  return null;
}
