import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { exigirSesion } from "./autorizacion";
import { exigirFechaISO } from "./validaciones";

/**
 * Seguimientos del negocio (F9 / PRO-14).
 *
 * Todas las funciones exigen sesión. Que la lista no se filtre por responsable
 * es una decisión de producto, no un descuido: la pantalla "Hoy" es la vista del
 * equipo para que nada quede sin atender (T10 de Marta), no "mis tareas".
 */

/**
 * Todos los seguimientos pendientes del negocio, visibles para cualquier
 * persona del equipo con sesión iniciada.
 */
export const pendientes = query({
  args: {},
  handler: async (ctx) => {
    await exigirSesion(ctx);

    const filas = await ctx.db
      .query("seguimientos")
      .withIndex("por_hecho", (q) => q.eq("hecho", false))
      .collect();

    const decorados = await Promise.all(
      filas.map(async (seg) => {
        const cliente = await ctx.db.get(seg.clienteId);
        // Referencia colgante al cliente: se omite la fila. No tiene sentido
        // pintar un seguimiento "sobre" un cliente que ya no existe, y dejar
        // que reviente tumbaría la pantalla entera.
        if (!cliente) return null;

        // El responsable sí es accesorio (solo alimenta un avatar de 20px):
        // si falta, la fila se conserva sin nombre.
        const responsable = await ctx.db.get(seg.responsableId);

        return {
          _id: seg._id,
          accion: seg.accion,
          vence: seg.vence,
          clienteId: seg.clienteId,
          clienteNombre: cliente.nombre,
          clienteEstado: cliente.estado,
          responsableNombre: responsable?.nombre ?? null,
        };
      }),
    );

    // Orden en memoria: el índice `por_hecho` solo cubre el booleano. A volumen
    // de demo es correcto; si crece, hará falta un índice compuesto
    // ["hecho", "vence"] y paginación.
    return decorados
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .sort((a, b) => a.vence.localeCompare(b.vence));
  },
});

/**
 * Completa o reabre un seguimiento. Se expone el booleano (en vez de un
 * `completar` sin argumentos) para que PRO-55 pueda construir el "Deshacer"
 * encima sin cambiar esta API.
 */
export const marcarHecho = mutation({
  args: {
    id: v.id("seguimientos"),
    hecho: v.boolean(),
    /**
     * Fecha local de quien completa (YYYY-MM-DD). El servidor de Convex corre
     * en UTC, así que calcularla aquí la desplazaría un día cerca de medianoche
     * para cualquiera que no esté en UTC. Y `fechaHecho` no es un dato interno:
     * alimenta el historial de la ficha del cliente (PRO-11).
     *
     * Se omite en invocaciones desde CLI, donde no hay navegador que la aporte.
     *
     * Al venir del cliente, `v.string()` no basta: se valida el formato y se
     * acota a ±1 día de la fecha del servidor, para que no sea un valor libre.
     */
    fecha: v.optional(v.string()),
  },
  handler: async (ctx, { id, hecho, fecha }) => {
    await exigirSesion(ctx);

    const fechaHecho = hecho
      ? fecha === undefined
        ? hoyISOEnServidor()
        : exigirFechaCercana(exigirFechaISO(fecha, "fecha"))
      : // `fechaHecho` es v.optional(v.string()): al reabrir hay que **borrar**
        // el campo con undefined, no escribir null, o falla la validación.
        undefined;

    await ctx.db.patch(id, { hecho, fechaHecho });
  },
});

/** Respaldo en UTC para cuando no llega la fecha local del cliente. */
function hoyISOEnServidor(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Acota la fecha afirmada por el cliente a ayer, hoy o mañana según el servidor.
 *
 * La comparación es **por día, no por milisegundos**: se genera el conjunto de
 * los tres días aceptables y se comprueba pertenencia. Restar timestamps
 * provocaría falsos rechazos justo cerca de medianoche, que es el caso que este
 * acotado existe para cubrir. ±1 día cubre cualquier zona horaria (máx. ±14 h).
 */
function exigirFechaCercana(fecha: string): string {
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
