import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { internalAction, internalMutation } from "./_generated/server";
import { normalizarEmail } from "./validaciones";

/**
 * ANDAMIAJE(PRO-8): alta de usuarios por CLI.
 *
 * Existe porque el PRD prohíbe el registro público y la pantalla que da de alta
 * personas (PRO-8) todavía no está: sin esto no habría forma de crear la primera
 * dueña, ni de tener un segundo usuario con el que probar el control por rol.
 * Desaparece cuando PRO-8 traiga la pantalla real, que usará exactamente las
 * mismas APIs de Convex Auth.
 *
 * Uso:
 *   npx convex env set PERMITIR_BOOTSTRAP true
 *   npx convex run bootstrap:crearUsuario '{"nombre":"…","email":"…","password":"…","rol":"propietaria"}'
 *   npx convex env remove PERMITIR_BOOTSTRAP
 */

function exigirPermiso() {
  if (process.env.PERMITIR_BOOTSTRAP !== "true") {
    throw new Error(
      "bootstrap está desactivado en este deployment. Actívalo solo mientras creas usuarios: " +
        "npx convex env set PERMITIR_BOOTSTRAP true",
    );
  }
}

/**
 * Crea una persona con sus credenciales.
 *
 * Va en tres pasos porque `createAccount` solo funciona en actions y una action
 * no escribe en la base de datos. El orden importa: **primero el perfil, después
 * la credencial**. Así, si el proceso muere a medias, lo que queda es una fila
 * de `usuarios` sin `authUserId` — un estado válido y resumible (el mismo que
 * producirá PRO-8 al dar de alta a alguien antes de asignarle contraseña)— y no
 * una credencial huérfana que bloquee los reintentos.
 */
export const crearUsuario = internalAction({
  args: {
    nombre: v.string(),
    email: v.string(),
    password: v.string(),
    rol: v.union(v.literal("propietaria"), v.literal("comercial")),
  },
  handler: async (ctx, args) => {
    exigirPermiso();

    const email = normalizarEmail(args.email);

    // 1. Perfil de negocio. Idempotente: si ya existe, lo reutiliza.
    const usuarioId: Id<"usuarios"> = await ctx.runMutation(
      internal.bootstrap.asegurarPerfil,
      { nombre: args.nombre, email, rol: args.rol },
    );

    // 2. Credencial, de forma idempotente.
    const { authUserId, reutilizada } = await obtenerOCrearCredencial(ctx, {
      email,
      password: args.password,
      nombre: args.nombre,
    });

    // 3. Enlace, con la invariante 1:1.
    await ctx.runMutation(internal.bootstrap.enlazarCredencial, {
      usuarioId,
      authUserId,
    });

    return { usuarioId, authUserId, email, reutilizada };
  },
});

/**
 * Devuelve la credencial de ese email, creándola si no la hay.
 *
 * Parece más rebuscado de lo que debería, y es por cómo se comporta la
 * librería: **`retrieveAccount` lanza `InvalidAccountId` cuando la cuenta no
 * existe**, en vez de devolver `null` como sugiere su tipo. Por eso la búsqueda
 * va envuelta, y por eso el fallo de `createAccount` se reintenta como búsqueda:
 * así la operación converge al mismo estado se ejecute una vez o diez, que es lo
 * que permite reintentar un arranque que murió a medias.
 */
async function obtenerOCrearCredencial(
  ctx: ActionCtx,
  datos: { email: string; password: string; nombre: string },
): Promise<{ authUserId: Id<"users">; reutilizada: boolean }> {
  const existente = await buscarCredencial(ctx, datos.email);
  if (existente !== null) return { authUserId: existente, reutilizada: true };

  try {
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: datos.email, secret: datos.password },
      profile: { email: datos.email, name: datos.nombre },
    });
    return { authUserId: user._id as Id<"users">, reutilizada: false };
  } catch (error) {
    // Si falló porque la cuenta ya existía, recupérala en vez de dejar el
    // arranque atascado.
    const tras = await buscarCredencial(ctx, datos.email);
    if (tras !== null) return { authUserId: tras, reutilizada: true };
    throw error;
  }
}

async function buscarCredencial(
  ctx: ActionCtx,
  email: string,
): Promise<Id<"users"> | null> {
  try {
    const cuenta = await retrieveAccount(ctx, {
      provider: "password",
      // Sin `secret`: solo interesa saber si la cuenta está, no verificarla.
      account: { id: email },
    });
    return (cuenta?.user._id as Id<"users">) ?? null;
  } catch {
    // `InvalidAccountId` — la cuenta no existe.
    return null;
  }
}

/**
 * Crea el perfil, o devuelve el existente si ya hay uno con ese email.
 *
 * Impone la unicidad de email a mano: los índices de Convex no son únicos, y dos
 * filas con el mismo email dejarían ambiguo a qué persona pertenece la
 * credencial — con el riesgo de acabar heredando el rol de otra.
 */
export const asegurarPerfil = internalMutation({
  args: {
    nombre: v.string(),
    email: v.string(),
    rol: v.union(v.literal("propietaria"), v.literal("comercial")),
  },
  handler: async (ctx, args) => {
    exigirPermiso();
    const email = normalizarEmail(args.email);

    const existente = await ctx.db
      .query("usuarios")
      .withIndex("por_email", (q) => q.eq("email", email))
      .unique();

    if (existente !== null) return existente._id;

    // El negocio no puede quedarse sin dueña, así que la primera persona que se
    // da de alta tiene que serlo (PRO-8 mantendrá la misma regla al eliminar o
    // cambiar roles).
    const hayAlguien = await ctx.db.query("usuarios").first();
    if (hayAlguien === null && args.rol !== "propietaria") {
      throw new Error("La primera persona del negocio debe tener el rol 'propietaria'.");
    }

    return await ctx.db.insert("usuarios", {
      nombre: args.nombre,
      email,
      rol: args.rol,
    });
  },
});

/** Enlaza perfil y credencial, comprobando que la relación siga siendo 1:1. */
export const enlazarCredencial = internalMutation({
  args: { usuarioId: v.id("usuarios"), authUserId: v.id("users") },
  handler: async (ctx, { usuarioId, authUserId }) => {
    exigirPermiso();

    const yaEnlazado = await ctx.db
      .query("usuarios")
      .withIndex("por_authUser", (q) => q.eq("authUserId", authUserId))
      .unique();

    if (yaEnlazado !== null && yaEnlazado._id !== usuarioId) {
      throw new Error(
        `Esa credencial ya está enlazada a otra persona (${yaEnlazado.email}). ` +
          "El enlace usuario ↔ credencial debe ser 1:1.",
      );
    }

    await ctx.db.patch(usuarioId, { authUserId });
  },
});
