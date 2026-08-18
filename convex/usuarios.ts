import { getAuthUserId, invalidateSessions, modifyAccountCredentials } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import {
  estaActivo,
  exigirDuena,
  exigirDuenaAction,
  usuarioActual,
} from "./autorizacion";
import { PROVEEDOR, obtenerOCrearCredencial } from "./credenciales";
import { normalizarEmail } from "./validaciones";

/**
 * Usuarios del negocio (F18 / PRO-8).
 *
 * No existe una búsqueda por email expuesta al cliente: la identidad se
 * resuelve siempre desde la sesión. Una función `porEmail` pública convertiría
 * la app en un enumerador de perfiles para cualquiera con cuenta.
 *
 * Las operaciones sobre credenciales son **actions** porque las APIs de Convex
 * Auth solo funcionan ahí, y cada una empieza por `exigirDuenaAction` en su
 * primera línea — ver el comentario de esa función para el porqué.
 */

const ROL = v.union(v.literal("propietaria"), v.literal("comercial"));

// —————————————————————————————————————————————— Lecturas

/** Estado de la sesión tal como lo necesita la UI. */
export type EstadoSesion =
  | { estado: "anonimo" }
  | {
      estado: "activa";
      usuario: {
        _id: string;
        nombre: string;
        email: string;
        rol: "propietaria" | "comercial";
      };
    }
  /** Credencial válida sin perfil de negocio: no debería pasar nunca. */
  | { estado: "sin_perfil" };

/**
 * Perfil de quien llama, y nada más.
 *
 * Distingue tres estados, no dos. El tercero —sesión válida cuya credencial no
 * tiene fila en `usuarios`— tiene que ser explícito: si se colapsara con
 * "anónimo", la app se quedaría en /hoy reintentando queries que fallan por
 * autorización, con la pantalla vacía y sin ninguna pista de qué ocurre.
 *
 * Ojo: es el **contrario** de "perfil sin credencial", que es lo que deja una
 * baja y es un estado perfectamente normal.
 */
export const actual = query({
  args: {},
  handler: async (ctx): Promise<EstadoSesion> => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) return { estado: "anonimo" };

    const usuario = await usuarioActual(ctx);
    if (usuario === null || !estaActivo(usuario)) return { estado: "sin_perfil" };

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

/** Listado del equipo, activos primero. Solo la dueña (F18). */
export const listar = query({
  args: {},
  handler: async (ctx) => {
    await exigirDuena(ctx);
    const filas = await ctx.db.query("usuarios").collect();

    return filas
      .map((u) => ({
        _id: u._id,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol,
        activo: estaActivo(u),
        tieneCredencial: u.authUserId !== undefined,
      }))
      .sort((a, b) => {
        if (a.activo !== b.activo) return a.activo ? -1 : 1;
        return a.nombre.localeCompare(b.nombre, "es");
      });
  },
});

// —————————————————————————————————————————————— Altas

/**
 * Da de alta a una persona con sus credenciales.
 *
 * Igual que el arranque: primero el perfil, después la credencial. Si algo
 * falla a medias queda una fila sin `authUserId`, que es un estado válido
 * —"invitada, sin acceso todavía"— y no una credencial huérfana.
 */
export const crear = action({
  args: {
    nombre: v.string(),
    email: v.string(),
    password: v.string(),
    rol: ROL,
  },
  handler: async (ctx, args): Promise<Id<"usuarios">> => {
    await exigirDuenaAction(ctx);

    const email = normalizarEmail(args.email);
    const usuarioId: Id<"usuarios"> = await ctx.runMutation(
      internal.usuarios.crearPerfil,
      { nombre: args.nombre.trim(), email, rol: args.rol },
    );

    const { authUserId } = await obtenerOCrearCredencial(ctx, {
      email,
      password: args.password,
      nombre: args.nombre.trim(),
    });

    await ctx.runMutation(internal.usuarios.enlazar, { usuarioId, authUserId });
    return usuarioId;
  },
});

/**
 * Crea el perfil, o **reutiliza el que quedó a medias**.
 *
 * Nace con `activo: false` a propósito: hasta que no tenga credencial no puede
 * entrar, y decir lo contrario en la lista sería mentir. Es `enlazar` quien lo
 * activa, una vez la credencial existe de verdad.
 *
 * Y es idempotente para el caso "perfil sin credencial", que es exactamente lo
 * que deja un alta interrumpida entre el paso 1 y el 3. Sin esto, reintentar
 * con el mismo email chocaría contra la comprobación de email único y el estado
 * no convergería nunca: quedaría una persona a medio crear, imposible de
 * terminar y imposible de recrear.
 *
 * Un perfil que **sí** tiene credencial es un duplicado de verdad y se rechaza.
 */
export const crearPerfil = internalMutation({
  args: { nombre: v.string(), email: v.string(), rol: ROL },
  handler: async (ctx, args): Promise<Id<"usuarios">> => {
    const existente = await ctx.db
      .query("usuarios")
      .withIndex("por_email", (q) => q.eq("email", args.email))
      .unique();

    if (existente !== null) {
      if (existente.authUserId !== undefined) {
        throw new Error(`Ya hay una persona con el email ${args.email}.`);
      }
      // Alta anterior que no llegó a terminar: se retoma con los datos nuevos.
      await ctx.db.patch(existente._id, { ...args, activo: false });
      return existente._id;
    }

    return await ctx.db.insert("usuarios", { ...args, activo: false });
  },
});

export const enlazar = internalMutation({
  args: { usuarioId: v.id("usuarios"), authUserId: v.id("users") },
  handler: async (ctx, { usuarioId, authUserId }) => {
    const yaEnlazado = await ctx.db
      .query("usuarios")
      .withIndex("por_authUser", (q) => q.eq("authUserId", authUserId))
      .unique();

    if (yaEnlazado !== null && yaEnlazado._id !== usuarioId) {
      throw new Error(
        "Esa credencial ya pertenece a otra persona. El enlace debe ser 1:1.",
      );
    }
    await ctx.db.patch(usuarioId, { authUserId, activo: true });
  },
});

// —————————————————————————————————————————————— Edición

/**
 * Cambia nombre, email y rol.
 *
 * Es una mutation y no una action porque no crea ni destruye credenciales: como
 * mucho renombra la existente, y eso se hace escribiendo directamente. Al ser
 * una sola mutation, es transaccional — no puede quedar el perfil actualizado y
 * la credencial no.
 */
export const actualizar = mutation({
  args: {
    id: v.id("usuarios"),
    nombre: v.string(),
    email: v.string(),
    rol: ROL,
  },
  handler: async (ctx, args) => {
    const quienLlama = await exigirDuena(ctx);

    const usuario = await ctx.db.get(args.id);
    if (usuario === null) throw new Error("Esa persona ya no existe.");

    const email = normalizarEmail(args.email);
    const cambiaEmail = email !== usuario.email;

    // Las dos comprobaciones de colisión van ANTES de la primera escritura: en
    // los dos mundos, perfil y credencial. Validar uno, escribir, y chocar en
    // el otro dejaría ambos desincronizados.
    if (cambiaEmail) {
      await exigirEmailLibre(ctx, email, args.id);
      if (usuario.authUserId !== undefined) {
        await exigirCuentaLibre(ctx, email, usuario.authUserId);
      }
    }

    if (args.rol !== usuario.rol) {
      await exigirQueQuedeAlgunaDuena(ctx, usuario, { nuevoRol: args.rol });
    }

    await ctx.db.patch(args.id, { nombre: args.nombre.trim(), email, rol: args.rol });

    if (cambiaEmail && usuario.authUserId !== undefined) {
      await renombrarCredencial(ctx, usuario.authUserId, email);
    }

    return { seCambioElEmail: cambiaEmail, esUnoMismo: args.id === quienLlama._id };
  },
});

/**
 * ANDAMIAJE(PRO-68): escritura directa sobre las tablas de Convex Auth.
 *
 * El email **es** el identificador de la credencial (`providerAccountId`), y la
 * librería no expone ninguna forma de cambiarlo: `modifyAccountCredentials`
 * solo toca el secreto. Sin esto, corregir una errata en un correo dejaría a
 * esa persona sin poder entrar, en silencio y sin error hasta que lo intentara.
 *
 * Se conserva el hash de la contraseña, así que sigue entrando con la misma
 * clave. Desaparece si la librería publica una API para renombrar cuentas.
 */
export async function renombrarCredencial(
  ctx: MutationCtx,
  authUserId: Id<"users">,
  emailNuevo: string,
) {
  const cuenta = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", authUserId).eq("provider", PROVEEDOR),
    )
    .unique();

  // Falla cerrado: si hay `authUserId` pero no aparece su cuenta, los datos ya
  // están inconsistentes y actualizar solo `users.email` lo empeoraría en
  // silencio — el perfil diría un email y la credencial otra. Al lanzar, Convex
  // revierte también el `patch` sobre `usuarios` de esta misma mutation.
  if (cuenta === null) {
    throw new Error(
      "Esa persona tiene acceso pero no se encuentra su cuenta. No se ha cambiado nada; revísalo antes de continuar.",
    );
  }

  await ctx.db.patch(cuenta._id, { providerAccountId: emailNuevo });
  await ctx.db.patch(authUserId, { email: emailNuevo });
}

// —————————————————————————————————————————————— Contraseñas

/** Restablece la contraseña de otra persona y le cierra las sesiones abiertas. */
export const restablecerContrasena = action({
  args: { id: v.id("usuarios"), password: v.string() },
  handler: async (ctx, args) => {
    await exigirDuenaAction(ctx);

    const usuario = await ctx.runQuery(internal.usuarios.porId, { id: args.id });
    if (usuario === null) throw new Error("Esa persona ya no existe.");
    if (usuario.authUserId === undefined) {
      throw new Error("Esa persona no tiene acceso todavía. Reactívala primero.");
    }

    await modifyAccountCredentials(ctx, {
      provider: PROVEEDOR,
      account: { id: usuario.email, secret: args.password },
    });
    // Quien tuviera la contraseña vieja deja de estar dentro.
    await invalidateSessions(ctx, { userId: usuario.authUserId });
  },
});

// —————————————————————————————————————————————— Baja y reactivación

/**
 * Da de baja: quita el acceso, conserva la persona.
 *
 * Secuencia deliberada, ver el plan de PRO-8. Lo importante: se borran la
 * cuenta y su `users`, y se limpia `authUserId`. Conservar `users` haría que al
 * reactivar `createAccount` creara una segunda identidad para la misma persona.
 */
export const desactivar = action({
  args: { id: v.id("usuarios") },
  handler: async (ctx, args) => {
    const quienLlama = await exigirDuenaAction(ctx);

    const usuario = await ctx.runQuery(internal.usuarios.porId, { id: args.id });
    if (usuario === null) throw new Error("Esa persona ya no existe.");
    if (usuario._id === quienLlama._id) {
      throw new Error("No puedes quitarte el acceso a ti misma.");
    }

    if (usuario.authUserId !== undefined) {
      await invalidateSessions(ctx, { userId: usuario.authUserId });
    }
    await ctx.runMutation(internal.usuarios.borrarCredencialYMarcarBaja, {
      id: args.id,
    });
  },
});

export const borrarCredencialYMarcarBaja = internalMutation({
  args: { id: v.id("usuarios") },
  handler: async (ctx, { id }) => {
    const usuario = await ctx.db.get(id);
    if (usuario === null) throw new Error("Esa persona ya no existe.");

    await exigirQueQuedeAlgunaDuena(ctx, usuario, { seDaDeBaja: true });

    const authUserId = usuario.authUserId;
    if (authUserId !== undefined) {
      const cuentas = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", authUserId))
        .collect();

      for (const cuenta of cuentas) {
        // Los códigos de verificación apuntan a la cuenta. Hoy el proveedor
        // Password sin email no genera ninguno, pero PRO-66 sí lo hará y para
        // entonces nadie volverá a mirar esta función.
        const codigos = await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", cuenta._id))
          .collect();
        for (const codigo of codigos) await ctx.db.delete(codigo._id);

        await ctx.db.delete(cuenta._id);
      }
      await ctx.db.delete(authUserId);
    }

    await ctx.db.patch(id, { activo: false, authUserId: undefined });
  },
});

/**
 * Devuelve el acceso con una contraseña nueva.
 *
 * Tiene que ser nueva: al dar de baja se borró la credencial y con ella el hash,
 * que no se guarda en ningún otro sitio.
 */
export const reactivar = action({
  args: { id: v.id("usuarios"), password: v.string() },
  handler: async (ctx, args) => {
    await exigirDuenaAction(ctx);

    const usuario = await ctx.runQuery(internal.usuarios.porId, { id: args.id });
    if (usuario === null) throw new Error("Esa persona ya no existe.");

    const { authUserId } = await obtenerOCrearCredencial(ctx, {
      email: usuario.email,
      password: args.password,
      nombre: usuario.nombre,
    });
    await ctx.runMutation(internal.usuarios.enlazar, {
      usuarioId: args.id,
      authUserId,
    });
  },
});

/** Lectura interna para las actions, que no pueden tocar la base de datos. */
export const porId = internalQuery({
  args: { id: v.id("usuarios") },
  handler: async (ctx, { id }): Promise<Doc<"usuarios"> | null> => {
    return await ctx.db.get(id);
  },
});

// —————————————————————————————————————————————— Reglas compartidas

/** El email identifica a la persona y a su credencial: no puede repetirse. */
export async function exigirEmailLibre(
  ctx: MutationCtx,
  email: string,
  exceptoId: Id<"usuarios"> | null,
) {
  const otro = await ctx.db
    .query("usuarios")
    .withIndex("por_email", (q) => q.eq("email", email))
    .unique();

  if (otro !== null && otro._id !== exceptoId) {
    throw new Error(`Ya hay una persona con el email ${email}.`);
  }
}

/**
 * Lo mismo, en el mundo de las credenciales.
 *
 * Los índices de Convex no son únicos, así que `providerAndAccountId` no impide
 * por sí solo dos cuentas `password` con el mismo email. Con dos, cuál resuelve
 * el login pasaría a depender del orden de inserción.
 */
export async function exigirCuentaLibre(
  ctx: MutationCtx,
  email: string,
  authUserIdPropio: Id<"users">,
) {
  const cuenta = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) =>
      q.eq("provider", PROVEEDOR).eq("providerAccountId", email),
    )
    .unique();

  if (cuenta !== null && cuenta.userId !== authUserIdPropio) {
    throw new Error(`Ya hay una cuenta con el email ${email}.`);
  }
}

/**
 * El negocio no puede quedarse sin ninguna dueña con acceso.
 *
 * Cubre las dos vías de PRO-8: darle de baja y cambiarle el rol.
 */
async function exigirQueQuedeAlgunaDuena(
  ctx: MutationCtx,
  usuario: Doc<"usuarios">,
  cambio: { nuevoRol?: "propietaria" | "comercial"; seDaDeBaja?: boolean },
) {
  const seguiriaSiendoDuena =
    usuario.rol === "propietaria" &&
    !cambio.seDaDeBaja &&
    (cambio.nuevoRol ?? usuario.rol) === "propietaria";

  if (usuario.rol !== "propietaria" || seguiriaSiendoDuena) return;

  // "Con acceso" es activa **y** con credencial: una dueña sin credencial no
  // puede entrar, así que no sirve para cumplir la regla por mucho que su fila
  // diga `activo: true`.
  const todos = await ctx.db.query("usuarios").collect();
  const otrasDuenas = todos.filter(
    (u) =>
      u._id !== usuario._id &&
      u.rol === "propietaria" &&
      estaActivo(u) &&
      u.authUserId !== undefined,
  );

  if (otrasDuenas.length === 0) {
    throw new Error(
      "El negocio no puede quedarse sin ninguna dueña con acceso. Nombra antes a otra.",
    );
  }
}
