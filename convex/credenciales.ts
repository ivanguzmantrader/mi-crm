import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";

/**
 * Operaciones sobre credenciales de Convex Auth.
 *
 * Vive aparte porque lo usan dos sitios —el arranque por CLI (`bootstrap.ts`) y
 * la gestión de usuarios (`usuarios.ts`)— y duplicarlo sería garantizar que las
 * copias diverjan justo en la parte que menos perdona.
 *
 * Todo aquí exige **contexto de action**: las APIs de credenciales de la
 * librería no funcionan en mutations. Como una action no escribe en la base de
 * datos, quien las llama tiene que delegar las escrituras en mutations.
 */

/** Proveedor único del proyecto: email + contraseña. */
export const PROVEEDOR = "password";

/**
 * Devuelve la credencial de ese email, creándola si no la hay.
 *
 * Parece más rebuscado de lo que debería, y es por cómo se comporta la
 * librería: **`retrieveAccount` lanza `InvalidAccountId` cuando la cuenta no
 * existe**, en vez de devolver `null` como sugiere su tipo. Por eso la búsqueda
 * va envuelta, y por eso el fallo de `createAccount` se reintenta como búsqueda:
 * así la operación converge al mismo estado se ejecute una vez o diez, que es lo
 * que permite reintentar un proceso que murió a medias.
 */
export async function obtenerOCrearCredencial(
  ctx: ActionCtx,
  datos: { email: string; password: string; nombre: string },
): Promise<{ authUserId: Id<"users">; reutilizada: boolean }> {
  const existente = await buscarCredencial(ctx, datos.email);
  if (existente !== null) return { authUserId: existente, reutilizada: true };

  try {
    const { user } = await createAccount(ctx, {
      provider: PROVEEDOR,
      account: { id: datos.email, secret: datos.password },
      profile: { email: datos.email, name: datos.nombre },
    });
    return { authUserId: user._id as Id<"users">, reutilizada: false };
  } catch (error) {
    // Si falló porque la cuenta ya existía, recupérala en vez de dejar el
    // proceso atascado.
    const tras = await buscarCredencial(ctx, datos.email);
    if (tras !== null) return { authUserId: tras, reutilizada: true };
    throw error;
  }
}

export async function buscarCredencial(
  ctx: ActionCtx,
  email: string,
): Promise<Id<"users"> | null> {
  try {
    const cuenta = await retrieveAccount(ctx, {
      provider: PROVEEDOR,
      // Sin `secret`: solo interesa saber si la cuenta está, no verificarla.
      account: { id: email },
    });
    return (cuenta?.user._id as Id<"users">) ?? null;
  } catch (error) {
    // Solo se traga el caso esperado: `retrieveAccount` lanza `InvalidAccountId`
    // cuando la cuenta no existe, en vez de devolver null como sugiere su tipo.
    // Cualquier otro fallo (configuración, datos corruptos) tiene que salir a la
    // superficie: enmascararlo llevaría a intentar crear una cuenta encima de un
    // problema distinto.
    if (esCuentaInexistente(error)) return null;
    throw error;
  }
}

function esCuentaInexistente(error: unknown): boolean {
  return error instanceof Error && error.message.includes("InvalidAccountId");
}
