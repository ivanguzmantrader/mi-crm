"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

/**
 * Sesión de la aplicación (PRO-6).
 *
 * Mantiene la misma forma `{ usuario, isLoading }` que consumían las pantallas
 * cuando la sesión era simulada, así que ninguna tuvo que cambiar al llegar el
 * login real.
 *
 * Ojo: esto es **presentación**, no seguridad. Que aquí haya un usuario con rol
 * "propietaria" no autoriza nada; quien autoriza es `convex/autorizacion.ts`.
 */

export type Usuario = Pick<Doc<"usuarios">, "nombre" | "email" | "rol"> & {
  _id: string;
};

interface Sesion {
  usuario: Usuario | null;
  isLoading: boolean;
}

export function useSession(): Sesion {
  const estado = useQuery(api.usuarios.actual);
  const { signOut } = useAuthActions();
  const router = useRouter();

  /**
   * Credencial válida sin perfil de negocio. No debería ocurrir —las
   * credenciales solo nacen junto a su fila de `usuarios`— pero es donde
   * desemboca cualquier grieta del bloqueo de alta, así que se corta en seco.
   *
   * Tratarlo como "aún no hay usuario" dejaría la app en /hoy reintentando
   * queries que fallan por autorización: pantalla vacía, errores en bucle y
   * ninguna pista de qué pasa.
   */
  const sinPerfil = estado?.estado === "sin_perfil";
  useEffect(() => {
    if (!sinPerfil) return;
    void signOut().then(() => router.replace("/login?motivo=sin-perfil"));
  }, [sinPerfil, signOut, router]);

  if (estado === undefined || sinPerfil) {
    return { usuario: null, isLoading: true };
  }
  if (estado.estado !== "activa") {
    return { usuario: null, isLoading: false };
  }
  return { usuario: estado.usuario, isLoading: false };
}

export const ETIQUETA_ROL: Record<Usuario["rol"], string> = {
  propietaria: "Dueña",
  comercial: "Atiende y vende",
};

export function esDuena(usuario: Usuario | null): boolean {
  return usuario?.rol === "propietaria";
}
