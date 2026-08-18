import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Auth } from "convex/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, QueryCtx } from "./_generated/server";
import { internalQuery } from "./_generated/server";

/**
 * Punto único de autorización del backend.
 *
 * Toda query o mutation empieza por `exigirSesion` o `exigirDuena`; toda action
 * por `exigirDuenaAction`. Aquí es donde está la defensa real: el proxy de Next
 * y los guards de React solo sirven para la experiencia de uso, y cualquiera
 * puede llamar a las funciones de Convex directamente sin pasar por el navegador.
 */

/** `getAuthUserId` vale en query, mutation y action; con esto, estas también. */
type Contexto = { auth: Auth; db: QueryCtx["db"] };

/**
 * Una persona dada de baja conserva su fila pero pierde el acceso.
 *
 * Se comprueba con `!== false` y no con `=== true` porque `activo` es opcional:
 * las filas anteriores a PRO-8 no lo tienen y son activas.
 */
export function estaActivo(usuario: Doc<"usuarios">): boolean {
  return usuario.activo !== false;
}

/** Perfil de quien llama, o `null` si no hay sesión. */
export async function usuarioActual(
  ctx: Contexto,
): Promise<Doc<"usuarios"> | null> {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId === null) return null;

  return await ctx.db
    .query("usuarios")
    .withIndex("por_authUser", (q) => q.eq("authUserId", authUserId))
    .unique();
}

/**
 * Como `usuarioActual`, pero lanza si no hay sesión, si la credencial no tiene
 * perfil, o si la persona está dada de baja.
 *
 * Lo de la baja es defensa en profundidad: al desactivar ya se borra la
 * credencial y se invalidan las sesiones, así que no debería llegar nadie por
 * aquí. Pero es una línea y cubre el caso de una fila marcada inactiva cuya
 * credencial sobreviviera por lo que fuese.
 */
export async function exigirSesion(ctx: Contexto): Promise<Doc<"usuarios">> {
  const usuario = await usuarioActual(ctx);
  if (usuario === null) {
    throw new Error("No hay sesión iniciada.");
  }
  if (!estaActivo(usuario)) {
    throw new Error("Esta cuenta ya no tiene acceso.");
  }
  return usuario;
}

/** `exigirSesion` + rol de dueña. Para lo que solo puede hacer la propietaria. */
export async function exigirDuena(ctx: Contexto): Promise<Doc<"usuarios">> {
  const usuario = await exigirSesion(ctx);
  if (usuario.rol !== "propietaria") {
    throw new Error("Esta acción solo está disponible para la dueña.");
  }
  return usuario;
}

/**
 * Igual que `exigirDuena`, pero para actions.
 *
 * Hace falta una versión aparte porque **una action no tiene `ctx.db`**: solo
 * `runQuery` / `runMutation`. Sin esto, las operaciones sobre credenciales —que
 * por fuerza viven en actions— quedarían sin autorizar, y comprobar el rol en
 * una mutation posterior no sirve: para entonces `createAccount` ya habría
 * creado la credencial, y que la mutation falle después no la deshace.
 *
 * **Llamarla en la primera línea del handler.** No normalizar argumentos, ni
 * buscar credenciales, ni contar dueñas antes: cualquier cosa por delante es
 * trabajo hecho a petición de alguien todavía no autorizado.
 */
export async function exigirDuenaAction(
  ctx: ActionCtx,
): Promise<Doc<"usuarios">> {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId === null) {
    throw new Error("No hay sesión iniciada.");
  }

  const usuario = await ctx.runQuery(internal.autorizacion.perfilPorAuthUser, {
    authUserId,
  });
  if (usuario === null) {
    throw new Error("No hay sesión iniciada.");
  }
  if (usuario.activo === false) {
    throw new Error("Esta cuenta ya no tiene acceso.");
  }
  if (usuario.rol !== "propietaria") {
    throw new Error("Esta acción solo está disponible para la dueña.");
  }
  return usuario;
}

/**
 * Resuelve el perfil desde una action.
 *
 * Vive aquí y no en `usuarios.ts` a propósito: `usuarios.ts` importa de este
 * módulo, así que ponerla allí crearía un ciclo entre los dos.
 */
export const perfilPorAuthUser = internalQuery({
  args: { authUserId: v.id("users") },
  handler: async (ctx, { authUserId }): Promise<Doc<"usuarios"> | null> => {
    return await ctx.db
      .query("usuarios")
      .withIndex("por_authUser", (q) =>
        q.eq("authUserId", authUserId as Id<"users">),
      )
      .unique();
  },
});
