import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";

/**
 * Redirección optimista según haya sesión o no, más el saneado de los errores
 * del endpoint de autenticación.
 *
 * En Next 16 esto se llama Proxy (antes Middleware) y el fichero va al mismo
 * nivel que `app/`, es decir `src/proxy.ts`.
 *
 * La parte de redirección es solo experiencia de uso: **no protege nada**. La
 * comprobación que importa está en las funciones de Convex
 * (`convex/autorizacion.ts`), porque cualquiera puede llamarlas sin pasar por
 * el navegador.
 */

const esLogin = createRouteMatcher(["/login"]);
const esApiAuth = createRouteMatcher(["/api/auth", "/api/auth/"]);

/**
 * Mismo texto para cualquier fallo de acceso, y aquí es donde de verdad hace
 * falta: la pantalla de login puede descartar el error que recibe, pero un
 * atacante no usa la pantalla — llama a `/api/auth` directamente.
 */
const ERROR_ACCESO = "No se ha podido iniciar sesión.";

const middlewareBase = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (esApiAuth(request)) return;

    const autenticado = await convexAuth.isAuthenticated();
    if (esLogin(request) && autenticado) {
      return nextjsMiddlewareRedirect(request, "/hoy");
    }
    if (!esLogin(request) && !autenticado) {
      return nextjsMiddlewareRedirect(request, "/login");
    }
  },
);

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const respuesta = await middlewareBase(request, event);
  return anonimizarErrorDeAcceso(request, respuesta);
}

/**
 * Sustituye el cuerpo de los errores de `/api/auth` por un mensaje único.
 *
 * Convex Auth devuelve al cliente el mensaje crudo de `auth:signIn` —su propio
 * código lo comenta como *"Send raw error message to client"*— y el proveedor
 * Password distingue `InvalidAccountId` (el email no existe) de `InvalidSecret`
 * (existe, contraseña incorrecta). Eso es un oráculo de enumeración de cuentas:
 * basta con llamar al endpoint en bucle para averiguar quién tiene cuenta, sin
 * pasar en ningún momento por la interfaz.
 *
 * Se normaliza cualquier error, no solo esos dos, para que un mensaje nuevo en
 * una versión futura de la librería no vuelva a abrir el agujero en silencio.
 * Las cabeceras originales se conservan intactas: ahí van las cookies de sesión
 * que la librería limpia al fallar.
 */
function anonimizarErrorDeAcceso(
  request: NextRequest,
  respuesta: Awaited<ReturnType<typeof middlewareBase>>,
) {
  if (!respuesta || !esApiAuth(request) || respuesta.status < 400) {
    return respuesta;
  }

  const cabeceras = new Headers(respuesta.headers);
  cabeceras.delete("content-length");

  return new Response(JSON.stringify({ error: ERROR_ACCESO }), {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: cabeceras,
  });
}

export const config = {
  // Todo salvo estáticos de Next. `/api/auth` sí entra: es donde se sanean los
  // errores de acceso.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
