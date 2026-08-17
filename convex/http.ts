import { httpRouter } from "convex/server";
import { auth } from "./auth";

/**
 * Rutas HTTP de la autenticación (JWKS, metadatos OIDC, intercambio de tokens).
 *
 * Sin este router el login no arranca por mucho que el esquema y el proveedor
 * estén bien configurados: no hay endpoints donde canjear el token.
 */
const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
