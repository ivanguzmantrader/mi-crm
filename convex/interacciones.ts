import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { exigirSesion } from "./autorizacion";
import {
  exigirFechaCercana,
  exigirFechaISO,
  exigirFechaNoFutura,
  hoyISOEnServidor,
} from "./validaciones";

/**
 * Interacciones anotadas sobre un cliente (F7 / PRO-12).
 *
 * Es lo que alimenta el historial de la ficha y lo que hace que el "último
 * contacto" de la lista de clientes deje de estar congelado.
 */

const CANAL = v.union(
  v.literal("llamada"),
  v.literal("email"),
  v.literal("whatsapp"),
  v.literal("en_persona"),
);

const MAX_TEXTO = 2000;

/**
 * Anota una interacción.
 *
 * **`autorId` no es un argumento.** El enunciado pide que el autor quede
 * registrado y no sea editable a mano; la forma de cumplirlo no es ignorar el
 * campo si llega, es que no exista en el validador. Sale de `exigirSesion`.
 * Mismo criterio que `estado` en clientes.ts y que `rol` en perfil.ts.
 */
export const crear = mutation({
  args: {
    clienteId: v.id("clientes"),
    canal: CANAL,
    texto: v.string(),
    /** Cuándo ocurrió la conversación. Por defecto, el `hoy` de más abajo. */
    fecha: v.optional(v.string()),
    /**
     * Fecha local de quien anota (YYYY-MM-DD), la referencia contra la que se
     * decide si `fecha` es futura. Se omite en invocaciones desde CLI.
     */
    hoy: v.optional(v.string()),
  },
  handler: async (ctx, { clienteId, canal, texto, fecha, hoy }) => {
    const autor = await exigirSesion(ctx);

    /**
     * `v.id("clientes")` es una **referencia tipada, no una clave foránea**:
     * Convex comprueba que el id pertenezca a la tabla, no que el documento
     * exista. Sin esto, un id bien formado de un cliente borrado entraría.
     *
     * Y el destrozo sería invisible: `clientes.ficha` monta el historial
     * consultando `por_cliente` desde un cliente que sí existe, así que el
     * apunte huérfano no aparecería en ninguna pantalla.
     */
    const cliente = await ctx.db.get(clienteId);
    if (cliente === null) {
      throw new Error("Este cliente ya no existe.");
    }

    const nota = texto.trim();
    if (nota.length === 0) {
      throw new Error("Escribe qué se ha hablado.");
    }
    // Convex tiene un tope de 1 MB por documento: sin límite, un texto enorme
    // falla en el insert con un error de infraestructura ilegible.
    if (nota.length > MAX_TEXTO) {
      throw new Error(`La nota no puede pasar de ${MAX_TEXTO} caracteres.`);
    }

    /**
     * Dos pasos con papeles distintos, y no se pueden fundir (ver
     * `exigirFechaNoFutura`):
     *
     * 1. `hoy` acota lo que el usuario **afirma que es hoy**, para que no pueda
     *    declarar una referencia arbitraria. ±1 día cubre cualquier huso.
     * 2. `fecha` se compara **contra esa referencia**, sin margen. Así, quien
     *    esté en Auckland puede anotar en su "hoy" aunque el servidor siga en
     *    ayer, pero nadie puede fechar una conversación en el futuro.
     *
     * Sin límite inferior a propósito: rellenar histórico antiguo es legítimo.
     */
    const referencia =
      hoy === undefined
        ? hoyISOEnServidor()
        : exigirFechaCercana(exigirFechaISO(hoy, "hoy"));

    const cuando =
      fecha === undefined
        ? referencia
        : exigirFechaNoFutura(exigirFechaISO(fecha, "fecha"), referencia);

    return await ctx.db.insert("interacciones", {
      clienteId,
      autorId: autor._id,
      canal,
      texto: nota,
      fecha: cuando,
    });
  },
});
