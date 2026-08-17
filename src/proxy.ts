import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

/**
 * Redirección optimista según haya sesión o no.
 *
 * En Next 16 esto se llama Proxy (antes Middleware) y el fichero va al mismo
 * nivel que `app/`, es decir `src/proxy.ts`.
 *
 * Es solo experiencia de uso: **no protege nada**. La comprobación que importa
 * está en las funciones de Convex (`convex/autorizacion.ts`), porque cualquiera
 * puede llamarlas sin pasar por el navegador. Aquí solo se lee el estado de
 * sesión de la cookie, nunca la base de datos.
 */
const esLogin = createRouteMatcher(["/login"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const autenticado = await convexAuth.isAuthenticated();

  if (esLogin(request) && autenticado) {
    return nextjsMiddlewareRedirect(request, "/hoy");
  }
  if (!esLogin(request) && !autenticado) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
});

export const config = {
  // Todo salvo estáticos de Next y el endpoint de la propia autenticación.
  matcher: ["/((?!.*\\..*|_next|api/auth).*)", "/", "/(api|trpc)(.*)"],
};
