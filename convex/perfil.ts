import { invalidateSessions, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { action, mutation } from "./_generated/server";
import { exigirSesion, exigirSesionAction } from "./autorizacion";
import { PROVEEDOR } from "./credenciales";
import {
  exigirCuentaLibre,
  exigirEmailLibre,
  renombrarCredencial,
} from "./usuarios";
import { normalizarEmail } from "./validaciones";

/**
 * Lo que cada persona puede hacer con su propia cuenta (F17 / PRO-7).
 *
 * **Ninguna función de aquí acepta un `id`, y es deliberado.** La identidad sale
 * siempre de la sesión. Es la diferencia de fondo con `usuarios.ts`: allí la
 * dueña opera sobre *otras* personas, y por eso hay un `id` que autorizar; aquí
 * se opera sobre uno mismo. No aceptar el argumento hace que "editar a otro" sea
 * imposible de programar por error, en vez de algo que hay que acordarse de
 * comprobar en cada llamada.
 *
 * Tampoco se acepta `rol`: PRO-7 permite cambiar nombre y email, no el rol. Al
 * no existir el argumento, nadie puede ascenderse a dueña ni llamando a la
 * mutation a mano — y la regla de "no dejar el negocio sin dueña" queda intacta
 * sin ninguna comprobación adicional.
 *
 * Para *leer* los datos propios no hay función nueva: `usuarios.actual` ya
 * devuelve el perfil de quien llama.
 */

/** Cambia el nombre y el email de quien llama. */
export const actualizarMisDatos = mutation({
  args: { nombre: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const usuario = await exigirSesion(ctx);

    const email = normalizarEmail(args.email);
    const cambiaEmail = email !== usuario.email;

    // Las dos comprobaciones de colisión, antes de escribir nada: perfil y
    // credencial. Validar una, escribir, y chocar con la otra dejaría ambos
    // desincronizados.
    if (cambiaEmail) {
      await exigirEmailLibre(ctx, email, usuario._id);
      if (usuario.authUserId !== undefined) {
        await exigirCuentaLibre(ctx, email, usuario.authUserId);
      }
    }

    await ctx.db.patch(usuario._id, { nombre: args.nombre.trim(), email });

    // El email es también con el que se entra, así que hay que renombrar la
    // credencial o la persona se quedaría fuera sin enterarse. Al ser una sola
    // mutation, es transaccional: o se cambian los dos o no se cambia ninguno.
    if (cambiaEmail && usuario.authUserId !== undefined) {
      await renombrarCredencial(ctx, usuario.authUserId, email);
    }

    return { seCambioElEmail: cambiaEmail };
  },
});

/**
 * Cambia la contraseña propia, exigiendo la actual.
 *
 * **El orden importa más que los pasos.** `invalidateSessions` y
 * `modifyAccountCredentials` son mutaciones internas distintas de Convex Auth y
 * no hay transacción entre ellas. Cambiando primero e invalidando después, una
 * caída en medio dejaría la contraseña nueva **y las sesiones viejas vivas** —
 * exactamente lo contrario de lo que se pretende. Invalidando primero, una
 * caída deja las sesiones cerradas y la contraseña sin tocar: molesto, pero
 * seguro.
 */
export const cambiarMiContrasena = action({
  args: { actual: v.string(), nueva: v.string() },
  handler: async (ctx, args) => {
    const { usuario, authUserId, authSessionId } = await exigirSesionAction(ctx);

    // 1. Verificar la actual. `modifyAccountCredentials` no comprueba nada por
    //    su cuenta, así que sin esto una sesión abierta y desatendida bastaría
    //    para quedarse con la cuenta.
    await verificarContrasenaActual(ctx, usuario.email, args.actual);

    // 2. Fuera todas las demás sesiones, conservando esta.
    await invalidateSessions(ctx, {
      userId: authUserId,
      except: [authSessionId],
    });

    // 3. Ahora sí, la contraseña nueva.
    await modifyAccountCredentials(ctx, {
      provider: PROVEEDOR,
      account: { id: usuario.email, secret: args.nueva },
    });

    // 4. Segunda pasada, mejor esfuerzo: cubre la ventana entre 2 y 3, en la que
    //    alguien con la contraseña vieja aún podría haber abierto sesión. Si
    //    falla no se aborta: la contraseña ya está cambiada y lo esencial se ha
    //    cumplido.
    try {
      await invalidateSessions(ctx, {
        userId: authUserId,
        except: [authSessionId],
      });
    } catch (error) {
      console.error("[perfil] segunda invalidación de sesiones falló", error);
    }
  },
});

/**
 * Comprueba la contraseña actual contra el hash guardado.
 *
 * Los identificadores de error de la librería se traducen **aquí**, no en la
 * pantalla: enseñar `InvalidSecret` dejaría la interfaz técnicamente correcta
 * pero inservible, y traducirlo en el servidor evita además que esos
 * identificadores lleguen siquiera al cliente.
 */
async function verificarContrasenaActual(
  ctx: ActionCtx,
  email: string,
  actual: string,
) {
  try {
    await retrieveAccount(ctx, {
      provider: PROVEEDOR,
      account: { id: email, secret: actual },
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "";

    if (mensaje.includes("TooManyFailedAttempts")) {
      // Ojo: esta verificación pasa por el mismo limitador que el login, así
      // que equivocarse muchas veces aquí puede dejar a la persona sin poder
      // entrar durante un rato. Conviene que el mensaje lo diga.
      throw new Error(
        "Demasiados intentos seguidos. Espera un momento antes de volver a probar.",
      );
    }
    if (mensaje.includes("InvalidSecret") || mensaje.includes("InvalidAccountId")) {
      throw new Error("La contraseña actual no es correcta.");
    }
    throw error;
  }
}
