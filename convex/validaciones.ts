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
 * ¿Tiene forma de email? La comprobación cruda, sin política de errores.
 *
 * Existe aparte de `normalizarEmail` a propósito, aunque compartan la expresión
 * regular. Aquella es del login y lanza `ERROR_ACCESO`, un mensaje opaco para
 * que nadie pueda averiguar qué cuentas existen probando emails. Ese mismo
 * mensaje en un formulario de cliente sería inservible: quien lo lee ya tiene
 * sesión y lo único que ha pasado es que se ha equivocado tecleando. Son dos
 * problemas distintos, así que cada lado construye su propio error a partir de
 * esta comprobación.
 */
export function esEmail(valor: string): boolean {
  return FORMATO_EMAIL.test(valor);
}

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

/** Respaldo en UTC para cuando no llega la fecha local del cliente. */
export function hoyISOEnServidor(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Acota la fecha afirmada por el cliente a ayer, hoy o mañana según el servidor.
 *
 * Hace falta porque el servidor de Convex corre en UTC y no puede fechar por su
 * cuenta nada que le importe al usuario: cerca de medianoche, su "hoy" y el del
 * navegador son días distintos. La fecha la aporta entonces el cliente, y esto
 * evita que sea un valor libre.
 *
 * La comparación es **por día, no por milisegundos**: se genera el conjunto de
 * los tres días aceptables y se comprueba pertenencia. Restar timestamps
 * provocaría falsos rechazos justo cerca de medianoche, que es el caso que este
 * acotado existe para cubrir. ±1 día cubre cualquier zona horaria (máx. ±14 h).
 */
export function exigirFechaCercana(fecha: string): string {
  const hoy = new Date(`${hoyISOEnServidor()}T00:00:00Z`);
  const aceptables = [-1, 0, 1].map((dias) => {
    const d = new Date(hoy);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
  });

  if (!aceptables.includes(fecha)) {
    throw new Error(
      `fecha debe estar entre ${aceptables[0]} y ${aceptables[2]}; se recibió ${fecha}`,
    );
  }
  return fecha;
}
