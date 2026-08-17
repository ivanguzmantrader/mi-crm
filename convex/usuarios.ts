import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { exigirDuena, usuarioActual } from "./autorizacion";

/**
 * Usuarios del negocio (F18 / PRO-51).
 *
 * No existe una búsqueda por email expuesta al cliente: la identidad se
 * resuelve siempre desde la sesión. Una función `porEmail` pública convertiría
 * la app en un enumerador de perfiles para cualquiera con cuenta.
 */

/** Estado de la sesión tal como lo necesita la UI. */
export type EstadoSesion =
  | { estado: "anonimo" }
  | { estado: "activa"; usuario: { _id: string; nombre: string; email: string; rol: "propietaria" | "comercial" } }
  /** Credencial válida sin perfil de negocio: no debería pasar nunca. */
  | { estado: "sin_perfil" };

/**
 * Perfil de quien llama, y nada más.
 *
 * Distingue tres estados, no dos. El tercero —sesión válida cuya credencial no
 * tiene fila en `usuarios`— tiene que ser explícito: si se colapsara con
 * "anónimo", la app se quedaría en /hoy reintentando queries que fallan por
 * autorización, con la pantalla vacía y sin ninguna pista de qué ocurre.
 * Al distinguirlo, el cliente puede cerrar sesión de inmediato.
 */
export const actual = query({
  args: {},
  handler: async (ctx): Promise<EstadoSesion> => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) return { estado: "anonimo" };

    const usuario = await usuarioActual(ctx);
    if (usuario === null) return { estado: "sin_perfil" };

    return {
      estado: "activa",
      usuario: {
        _id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    };
  },
});

/** Listado del equipo. Solo la dueña (F18). */
export const listar = query({
  args: {},
  handler: async (ctx) => {
    await exigirDuena(ctx);
    return await ctx.db.query("usuarios").collect();
  },
});
