import { internalQuery } from "./_generated/server";

/**
 * Comprobación de configuración de un deployment.
 *
 * Sirve para responder de un vistazo "¿está este deployment listo y limpio?"
 * antes de desplegar, en vez de descubrirlo cuando falla el primer login.
 *
 * Es `internalQuery` a propósito: no son secretos, pero sí configuración
 * operativa, y no hay ninguna razón para exponerla a quien abra la app.
 *
 *   npx convex run salud:configuracion --prod
 */
export const configuracion = internalQuery({
  args: {},
  handler: async () => {
    const puesta = (nombre: string) =>
      process.env[nombre] !== undefined && process.env[nombre] !== "";

    return {
      // Sin estas dos, la autenticación no funciona. Son por deployment: tenerlas
      // en dev no implica tenerlas en producción.
      auth: {
        JWT_PRIVATE_KEY: puesta("JWT_PRIVATE_KEY"),
        JWKS: puesta("JWKS"),
      },
      // Estas habilitan andamiaje destructivo o de desarrollo. En producción
      // deben estar TODAS a false.
      andamiaje: {
        PERMITIR_SEED: puesta("PERMITIR_SEED"),
        PERMITIR_BOOTSTRAP: puesta("PERMITIR_BOOTSTRAP"),
      },
    };
  },
});
