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
});
