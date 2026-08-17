import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Usuarios del negocio (F18 / PRO-51).
 *
 * ⚠️ Estas dos queries existen **solo para sostener la sesión simulada**
 * mientras no está el login (PRO-6): no comprueban identidad, así que sin
 * protección expondrían la lista de personas del negocio con sus emails y roles
 * a cualquiera con acceso a la app.
 *
 * Por eso fallan cerradas: exigen `PERMITIR_SESION_SIMULADA=true`, una variable
 * **por deployment** que se activa en dev y que producción no tiene (igual que
 * el guard de `seed.ts`). Así el NO-GO de despliegue deja de depender de que
 * alguien lea un comentario: si esto se sube a producción antes de PRO-6, la
 * sesión simulada no arranca en vez de filtrar datos.
 *
 * Al implementar PRO-6 este guard desaparece y lo sustituye la comprobación de
 * `ctx.auth` real.
 */
function exigirSesionSimulada() {
  if (process.env.PERMITIR_SESION_SIMULADA !== "true") {
    throw new Error(
      "La sesión simulada está desactivada en este deployment. Es andamiaje previo a PRO-6 " +
        "(login real) y no debe correr en producción. Para desarrollo: " +
        "npx convex env set PERMITIR_SESION_SIMULADA true",
    );
  }
}

/** Alimenta el selector de usuario de desarrollo (ver src/lib/session.tsx). */
export const listar = query({
  args: {},
  handler: async (ctx) => {
    exigirSesionSimulada();
    return await ctx.db.query("usuarios").collect();
  },
});

export const porEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    exigirSesionSimulada();
    return await ctx.db
      .query("usuarios")
      .withIndex("por_email", (q) => q.eq("email", email))
      .unique();
  },
});
