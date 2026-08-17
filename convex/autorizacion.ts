import { getAuthUserId } from "@convex-dev/auth/server";
import type { Auth } from "convex/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/**
 * Punto único de autorización del backend.
 *
 * Toda query o mutation empieza por `exigirSesion` o `exigirDuena`. Aquí es
 * donde está la defensa real: el proxy de Next y los guards de React solo
 * sirven para la experiencia de uso, y cualquiera puede llamar a las funciones
 * de Convex directamente sin pasar por el navegador.
 */

/** `getAuthUserId` vale en query, mutation y action; con esto, estas también. */
type Contexto = { auth: Auth; db: QueryCtx["db"] };

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
 * Como `usuarioActual`, pero lanza si no hay sesión **o si la credencial no
 * tiene perfil**.
 *
 * Ese segundo caso no debería ocurrir —las credenciales solo nacen del arranque
 * o de PRO-8, siempre junto a su fila de `usuarios`— pero es donde desemboca
 * cualquier grieta del bloqueo de alta, así que falla ruidosamente en vez de
 * conceder acceso a medias.
 */
export async function exigirSesion(ctx: Contexto): Promise<Doc<"usuarios">> {
  const usuario = await usuarioActual(ctx);
  if (usuario === null) {
    throw new Error("No hay sesión iniciada.");
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
