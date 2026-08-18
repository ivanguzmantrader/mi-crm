/**
 * Saca el mensaje útil de un error devuelto por Convex.
 *
 * **Desenvuelve, no traduce.** Convex envuelve lo que lanza una función con un
 * identificador de petición y una traza; esto se queda con la última línea con
 * sentido. El texto legible lo pone el servidor — ver `convex/perfil.ts`, donde
 * los identificadores de Convex Auth (`InvalidSecret`, `TooManyFailedAttempts`)
 * se traducen antes de salir.
 */
export function mensajeDe(fallo: unknown, porDefecto = "No se ha podido completar la operación."): string {
  if (!(fallo instanceof Error)) return porDefecto;

  const limpio = fallo.message
    .split("\n")
    .map((linea) => linea.replace(/^Uncaught (Convex)?Error:\s*/, "").trim())
    .filter(
      (linea) =>
        linea.length > 0 &&
        !linea.startsWith("[Request ID") &&
        !linea.startsWith("at "),
    );

  return limpio.at(-1) ?? porDefecto;
}
