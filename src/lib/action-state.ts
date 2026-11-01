/**
 * Résultat d'une opération serveur en UNION DISCRIMINÉE : `ok: true` (+ charge utile `T`)
 * ou `ok: false` avec un `error` TOUJOURS renseigné.
 */
export type ActionResult<
  T extends object = Record<never, never>,
  E extends object = Record<never, never>,
> = ({ ok: true } & T) | ({ ok: false; error: string } & E);
