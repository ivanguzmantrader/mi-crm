/**
 * Saca el mensaje útil de un error devuelto por Convex.
 *
 * **Desenvuelve, no traduce.** El texto legible lo pone el servidor — ver
 * `convex/perfil.ts`, donde los identificadores de Convex Auth (`InvalidSecret`,
 * `TooManyFailedAttempts`) se traducen antes de salir.
 *
 * Lo que llega tiene esta forma, con envoltura por delante y por detrás:
 *
 * ```
 * [CONVEX M(interacciones:crear)] [Request ID: 7928…] Server Error
 * Uncaught Error: La fecha no puede ser futura: se recibió … y hoy es …
 *     at handler (../convex/interacciones.ts:96:48)
 *   Called by client
 * ```
 *
 * Por eso **no se elige por posición**. Quedarse con la última línea devolvía
 * "Called by client", y quedarse con la primera devuelve la línea de `[CONVEX`.
 * Se busca la línea que lleva el prefijo `Uncaught Error:`, que es donde va el
 * mensaje del servidor, y se le quita el prefijo.
 */
export function mensajeDe(
  fallo: unknown,
  porDefecto = "No se ha podido completar la operación.",
): string {
  if (!(fallo instanceof Error)) return porDefecto;

  const lineas = fallo.message
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0);

  const PREFIJO = /^Uncaught (Convex)?Error:\s*/;
  const delServidor = lineas.find((linea) => PREFIJO.test(linea));
  if (delServidor !== undefined) {
    return delServidor.replace(PREFIJO, "");
  }

  /**
   * Sin ese prefijo quedan dos casos: un error del propio cliente (de red, por
   * ejemplo) o un fallo de validación de argumentos. Se devuelve la primera
   * línea que no sea envoltura ni traza.
   *
   * Un `ArgumentValidationError` que llegue hasta aquí es un fallo de
   * programación, no algo que el usuario pueda arreglar; se enseña tal cual a
   * propósito, porque disimularlo lo dejaría sin diagnosticar.
   */
  const util = lineas.find(
    (linea) =>
      !linea.startsWith("at ") &&
      !linea.startsWith("Called by") &&
      !linea.includes("[Request ID") &&
      !linea.startsWith("[CONVEX"),
  );

  return util ?? porDefecto;
}
