/**
 * Validaciones de entrada compartidas por las funciones de Convex.
 *
 * El esquema guarda las fechas como `v.string()` en ISO corto (YYYY-MM-DD),
 * un contrato que el validador de Convex no puede hacer cumplir por sí solo.
 * En cuanto una fecha viene del cliente hay que comprobarla aquí: de lo
 * contrario se puede persistir "ayer" o "2026-99-99" y romper la ordenación y
 * el historial de la ficha (PRO-11), que comparan estas cadenas directamente.
 */

const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** ¿Es una fecha real en formato YYYY-MM-DD? */
export function esFechaISO(valor: string): boolean {
  if (!FORMATO_ISO.test(valor)) return false;

  const [anio, mes, dia] = valor.split("-").map(Number);

  // Ida y vuelta por Date: descarta desbordamientos que la regex sí acepta,
  // como 2026-02-30 (que Date normalizaría a marzo) o 2026-99-99.
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/** Igual que `esFechaISO`, pero lanza con el nombre del campo. */
export function exigirFechaISO(valor: string, campo: string): string {
  if (!esFechaISO(valor)) {
    // Se recorta el eco del valor recibido: puede ser una cadena arbitrariamente
    // larga y no tiene sentido volcarla entera en los logs.
    throw new Error(
      `${campo} debe ser una fecha real en formato YYYY-MM-DD; se recibió ${JSON.stringify(valor.slice(0, 30))}`,
    );
  }
  return valor;
}
