import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation } from "./_generated/server";
import { obtenerOCrearCredencial } from "./credenciales";
import { normalizarEmail } from "./validaciones";

/**
 * Arranque de un deployment: crea la primera dueña.
 *
 * **No es andamiaje, es herramienta de operación** — como `seed.ts`. El PRD
 * prohíbe el registro público, así que un deployment recién creado no tiene por
 * dónde empezar: nadie puede entrar hasta que exista una dueña, y la pantalla
 * que da de alta personas (PRO-8) exige ser dueña para usarse. Este es el
 * comando que rompe ese círculo, y hará falta cada vez que se levante un
 * entorno nuevo.
 *
 * El día a día del alta de usuarios ya no pasa por aquí: eso es la pantalla de
 * Equipo, que usa exactamente las mismas APIs (`convex/credenciales.ts`).
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

    // `activo: true` también: si se rearranca sobre alguien dado de baja, darle
    // credencial sin reactivarla lo dejaría con acceso pero rechazado por
    // `exigirSesion`, que es de los estados más difíciles de diagnosticar.
    await ctx.db.patch(usuarioId, { authUserId, activo: true });
  },
});
