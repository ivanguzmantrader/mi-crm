/**
 * Validaciones de entrada compartidas por las funciones de Convex.
 *
 * El esquema guarda las fechas como `v.string()` en ISO corto (YYYY-MM-DD),
 * un contrato que el validador de Convex no puede hacer cumplir por sí solo.
 * En cuanto una fecha viene del cliente hay que comprobarla aquí: de lo
 * contrario se puede persistir "ayer" o "2026-99-99" y romper la ordenación y
 * el historial de la ficha (PRO-11), que comparan estas cadenas directamente.
 */

/**
 * Mensaje único para cualquier fallo de acceso. Es defensa en profundidad, no
 * la garantía: `Password` lanza su propio "Invalid credentials" desde
 * `retrieveAccount` y eso no se controla desde aquí. Quien garantiza que el
 * usuario nunca vea textos distintos —y por tanto que no se puedan enumerar
 * cuentas— es la pantalla de login, que descarta el error recibido.
 */
export const ERROR_ACCESO = "No se ha podido completar la operación.";

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normaliza un email a su forma canónica: sin espacios y en minúsculas.
 *
 * La usan `profile()` de convex/auth.ts y el arranque, a propósito la misma:
 * el email normalizado acaba siendo el `account.id` de la credencial, así que
 * si cada sitio normalizara por su cuenta, entrar como "Marta@Acme.es" no
 * encontraría la cuenta creada como "marta@acme.es" y se rechazaría un login
 * perfectamente válido.
 */
export function normalizarEmail(valor: unknown): string {
  if (typeof valor !== "string") throw new Error(ERROR_ACCESO);
  const normalizado = valor.trim().toLowerCase();
  if (!FORMATO_EMAIL.test(normalizado)) throw new Error(ERROR_ACCESO);
  return normalizado;
}

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
