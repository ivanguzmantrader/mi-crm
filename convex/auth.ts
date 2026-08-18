import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";
import { ERROR_ACCESO, normalizarEmail } from "./validaciones";

/**
 * Autenticación por email y contraseña (PRO-6 / F17).
 *
 * **No hay registro público**: los usuarios los da de alta la dueña (PRO-8), o
 * el arranque por CLI mientras esa pantalla no exista. Lo impone `profile()`
 * más abajo.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      /**
       * Único punto de corte del alta que ofrece el proveedor: `Password` no
       * tiene opción para desactivar el flujo `signUp`, y mientras `signIn` sea
       * público —y tiene que serlo para poder entrar— cualquiera podría
       * llamarlo con `flow: "signUp"`.
       *
       * La comprobación es deliberadamente **síncrona y sin tocar la base de
       * datos**: el proveedor invoca este callback sin `await`, así que
       * devolver una promesa guardaría un `Promise` como perfil del usuario.
       * Si algún día hiciera falta lógica asíncrona en el ciclo de vida del
       * usuario, el punto correcto es `callbacks.createOrUpdateUser`.
       *
       * Las credenciales solo nacen de `createAccount`, que no pasa por aquí
       * (ver convex/bootstrap.ts).
       */
      profile(params) {
        if (params.flow === "signUp") {
          throw new ConvexError(ERROR_ACCESO);
        }
        // El email normalizado es lo que se usa como `account.id`: devolverlo
        // crudo haría que "Marta@Acme.es" no encontrase la cuenta creada como
        // "marta@acme.es".
        return { email: normalizarEmail(params.email) };
      },
    }),
  ],

  /**
   * 15 minutos en vez de la hora por defecto.
   *
   * Importa por lo que promete "cerrar tus otras sesiones" al cambiar la
   * contraseña (`convex/perfil.ts`). `invalidateSessions` borra el registro de
   * sesión de inmediato, pero el JWT ya emitido es autocontenido: nadie lo
   * contrasta con la tabla en cada petición, así que sigue valiendo hasta que
   * caduca. Con una hora, esa promesa era demasiado blanda; con 15 minutos el
   * peor caso queda acotado.
   *
   * Sigue sin ser revocación instantánea. Conseguir eso obligaría a que cada
   * función protegida comprobase la sesión contra la tabla —o a versionar un
   * claim revocable—, y eso encarece la autorización de todo el backend. No es
   * trabajo de PRO-7.
   */
  jwt: { durationMs: 15 * 60 * 1000 },

  /**
   * 30 intentos fallidos por hora en vez de 10.
   *
   * El limitador es compartido: verificar la contraseña actual en "Mi cuenta"
   * pasa por el mismo contador que iniciar sesión, porque ambos usan el
   * identificador de la cuenta. Con el valor por defecto, equivocarse 10 veces
   * al cambiar la contraseña dejaba a esa persona **sin poder entrar**, y la
   * pantalla de login —que muestra un mensaje genérico a propósito, para no
   * permitir enumerar cuentas— no podía explicarle por qué.
   *
   * A 30, se recupera un intento cada 2 minutos en lugar de cada 6. Sigue
   * siendo una barrera seria contra la fuerza bruta, pero el bloqueo accidental
   * por teclear mal deja de ser realista.
   *
   * Ojo con el nombre: la errata ("Attemps") es de la propia librería.
   */
  signIn: { maxFailedAttempsPerHour: 30 },
});
