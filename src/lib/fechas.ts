/**
 * Utilidades de fecha para seguimientos. Todas trabajan con ISO corto
 * (YYYY-MM-DD) y en la zona horaria **local del navegador**: lo que cuenta es
 * qué día es para la persona que mira la pantalla.
 */

/**
 * Hoy en ISO corto, construido con los getters locales.
 *
 * No usar `toISOString().slice(0,10)`: eso da la fecha en UTC y cerca de
 * medianoche devolvería otro día, mandando seguimientos al bloque equivocado.
 */
export function hoyISO(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/** Interpreta un ISO corto como medianoche local (no UTC). */
function aFechaLocal(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

/**
 * Días de retraso respecto a hoy: **positivo = vencido**, 0 = vence hoy,
 * negativo = aún por venir.
 */
export function diasDeRetraso(vence: string, hoy: string = hoyISO()): number {
  const ms = aFechaLocal(hoy).getTime() - aFechaLocal(vence).getTime();
  return Math.round(ms / 86_400_000);
}

/** "Venció ayer" · "Venció hace 3 días" · "Mañana" · "En 4 días" · "" si es hoy. */
export function etiquetaVencimiento(vence: string, hoy: string = hoyISO()): string {
  const d = diasDeRetraso(vence, hoy);
  if (d > 0) return d === 1 ? "Venció ayer" : `Venció hace ${d} días`;
  if (d < 0) return d === -1 ? "Mañana" : `En ${-d} días`;
  return "";
}

/**
 * "3 de junio" para fechas de este año, "3 de junio de 2025" para las de otro.
 *
 * El año se omite cuando es el actual porque en una lista de clientes casi todo
 * es reciente y repetirlo en cada fila es ruido; pero omitirlo siempre haría que
 * un contacto de hace año y medio pareciera de hace unas semanas.
 */
export function fechaCorta(iso: string, hoy: string = hoyISO()): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  const esteAnio = String(anio) === hoy.slice(0, 4);

  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    ...(esteAnio ? {} : { year: "numeric" }),
  }).format(new Date(anio, mes - 1, dia));
}

/** "Martes, 23 de junio" — con la inicial en mayúscula. */
export function etiquetaFechaLarga(fecha: Date = new Date()): string {
  const texto = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export type Bloque = "atrasado" | "hoy" | "proximo";

/**
 * Reparte los seguimientos pendientes en los tres bloques de la pantalla Hoy,
 * cada uno ordenado por fecha de vencimiento ascendente.
 */
export function agruparSeguimientos<T extends { vence: string }>(
  seguimientos: T[],
  hoy: string = hoyISO(),
): { atrasados: T[]; paraHoy: T[]; proximas: T[] } {
  const atrasados: T[] = [];
  const paraHoy: T[] = [];
  const proximas: T[] = [];

  for (const seg of seguimientos) {
    const d = diasDeRetraso(seg.vence, hoy);
    if (d > 0) atrasados.push(seg);
    else if (d === 0) paraHoy.push(seg);
    else proximas.push(seg);
  }

  const porVencimiento = (a: T, b: T) => a.vence.localeCompare(b.vence);
  return {
    atrasados: atrasados.sort(porVencimiento),
    paraHoy: paraHoy.sort(porVencimiento),
    proximas: proximas.sort(porVencimiento),
  };
}
