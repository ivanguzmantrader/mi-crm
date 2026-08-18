/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as autorizacion from "../autorizacion.js";
import type * as bootstrap from "../bootstrap.js";
import type * as credenciales from "../credenciales.js";
import type * as http from "../http.js";
import type * as perfil from "../perfil.js";
import type * as salud from "../salud.js";
import type * as seed from "../seed.js";
import type * as seguimientos from "../seguimientos.js";
import type * as usuarios from "../usuarios.js";
import type * as validaciones from "../validaciones.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  autorizacion: typeof autorizacion;
  bootstrap: typeof bootstrap;
  credenciales: typeof credenciales;
  http: typeof http;
  perfil: typeof perfil;
  salud: typeof salud;
  seed: typeof seed;
  seguimientos: typeof seguimientos;
  usuarios: typeof usuarios;
  validaciones: typeof validaciones;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
