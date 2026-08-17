import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { exigirFechaISO } from "./validaciones";

/**
 * ⚠️ SIN AUTORIZACIÓN TODAVÍA.
 *
 * Estas funciones son públicas y el esquema no tiene identidad ni tenant:
 * cualquiera con acceso a la app puede leer los seguimientos del negocio y
 * completar cualquiera de ellos. Es aceptable en la fase local/demo previa al
 * login, pero **bloquea el despliegue público hasta PRO-6** (sesión real), que
 * es cuando deben validar `ctx.auth` y el rol.
 *
 * A diferencia de las queries de `usuarios.ts`, aquí no se pone un guard de
 * entorno: son funciones de producto que sobreviven a PRO-6, y apagarlas con un
 * flag de desarrollo solo escondería el problema. Su protección es la de
 * verdad — la que llega con PRO-6.
 */

/**
 * Todos los seguimientos pendientes del negocio — sin filtrar por responsable:
 * la pantalla "Hoy" es la vista del equipo, no "mis tareas" (T10 de Marta,
 * criterio explícito de PRO-14).
 */
export const pendientes = query({
  args: {},
  handler: async (ctx) => {
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
     * Al venir del cliente, `v.string()` no basta: se valida el formato en el
     * handler. Sigue siendo un valor **afirmado por el cliente** — acotarlo
     * contra la identidad de quien lo envía es cosa de PRO-6.
     */
    fecha: v.optional(v.string()),
  },
  handler: async (ctx, { id, hecho, fecha }) => {
    const fechaHecho = hecho
      ? fecha === undefined
        ? hoyISOEnServidor()
        : exigirFechaISO(fecha, "fecha")
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
