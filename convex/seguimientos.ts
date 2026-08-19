import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { exigirSesion, tieneAcceso } from "./autorizacion";
import {
  exigirFechaCercana,
  exigirFechaISO,
  hoyISOEnServidor,
} from "./validaciones";

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

const MAX_ACCION = 200;

/**
 * Programa un seguimiento (PRO-13 / F8).
 *
 * **`hecho` no es un argumento.** El enunciado pide que el estado inicial sea
 * siempre "pendiente", y la forma de cumplirlo es que no exista en el validador
 * — igual que `estado` en clientes.ts y `autorId` en interacciones.ts.
 * `fechaHecho` tampoco se escribe: lo que acaba de nacer no está hecho.
 *
 * **`responsableId` sí es un argumento**, al revés que el `autorId` de una
 * interacción, y la diferencia no es un descuido: aquel registra *quién hizo
 * algo* (un hecho, con una sola respuesta verdadera) y este asigna *quién debe
 * hacerlo* (una decisión). El enunciado pide explícitamente poder asignárselo a
 * otra persona del equipo.
 */
export const crear = mutation({
  args: {
    clienteId: v.id("clientes"),
    responsableId: v.id("usuarios"),
    accion: v.string(),
    /**
     * Obligatoria, a diferencia de la fecha de una interacción: aquí no hay un
     * valor por defecto que el servidor pueda inventar, porque el sentido de un
     * seguimiento *es* su fecha.
     */
    vence: v.string(),
  },
  handler: async (ctx, { clienteId, responsableId, accion, vence }) => {
    await exigirSesion(ctx);

    /**
     * `v.id(...)` es una referencia tipada, no una clave foránea: comprueba la
     * tabla, no que el documento exista.
     *
     * Con un cliente inexistente el destrozo sería silencioso y distinto del de
     * una interacción huérfana: el seguimiento **sí** llegaría a `pendientes`,
     * que recorre la tabla por `por_hecho`, pero esa función descarta la fila
     * cuando el cliente no existe para no tumbar la pantalla Hoy. Es decir, se
     * crearía, no aparecería en ninguna parte, y nadie sabría que está ahí.
     */
    const cliente = await ctx.db.get(clienteId);
    if (cliente === null) {
      throw new Error("Este cliente ya no existe.");
    }

    // Mismo criterio —y misma función— que filtra `usuarios.asignables`. Con una
    // copia por cada lado, el desplegable y el servidor divergirían en cuanto
    // alguien tocase uno de los dos.
    const responsable = await ctx.db.get(responsableId);
    if (responsable === null || !tieneAcceso(responsable)) {
      throw new Error("Esa persona no puede hacerse cargo de un seguimiento.");
    }

    const tarea = accion.trim();
    if (tarea.length === 0) {
      throw new Error("Escribe qué hay que hacer.");
    }
    if (tarea.length > MAX_ACCION) {
      throw new Error(`La descripción no puede pasar de ${MAX_ACCION} caracteres.`);
    }

    /**
     * Solo se valida el **formato**, no el rango, y es deliberado: un
     * seguimiento es un plan, y uno con fecha pasada no es un dato inválido sino
     * uno **atrasado**, que la pantalla Hoy ya recoge en su bloque rojo. Es la
     * asimetría con `interacciones.crear`, donde el futuro sí es imposible
     * porque allí se registra algo que ya ocurrió.
     */
    return await ctx.db.insert("seguimientos", {
      clienteId,
      responsableId,
      accion: tarea,
      vence: exigirFechaISO(vence, "vence"),
      hecho: false,
    });
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
