"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

/**
 * Sesión **simulada** mientras no exista el login (PRO-6).
 *
 * Mantiene deliberadamente la forma que tendrá la sesión real, para que al
 * construir PRO-6 solo cambie el interior de este fichero y ninguna pantalla.
 * No protege nada: es un selector de identidad para desarrollo.
 */

const CLAVE_ALMACEN = "vibe-crm.dev-user";
const EMAIL_POR_DEFECTO = "marta@acme.es";

// localStorage es un almacén externo a React, así que se lee con
// useSyncExternalStore y no con un efecto: así el servidor renderiza "aún no se
// sabe" (null) y el cliente el valor real, sin desajuste de hidratación.
const oyentes = new Set<() => void>();

function suscribir(alCambiar: () => void) {
  oyentes.add(alCambiar);
  // El evento `storage` solo lo disparan *otras* pestañas: mantiene la sesión
  // sincronizada si se cambia de usuario en una segunda ventana.
  window.addEventListener("storage", alCambiar);
  return () => {
    oyentes.delete(alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

function leerEmail(): string {
  return window.localStorage.getItem(CLAVE_ALMACEN) ?? EMAIL_POR_DEFECTO;
}

function leerEmailEnServidor(): null {
  return null;
}

function guardarEmail(email: string) {
  window.localStorage.setItem(CLAVE_ALMACEN, email);
  for (const oyente of oyentes) oyente();
}

export type Usuario = Doc<"usuarios">;

interface Sesion {
  usuario: Usuario | null;
  /**
   * Cierto mientras no se sabe **quién** es el usuario ni, por tanto, su rol.
   * Cubre las dos esperas: leer localStorage (que el servidor no tiene) y
   * resolver la consulta a Convex.
   *
   * Todo lo que dependa del rol debe esperar a que sea falso: mostrar un ítem y
   * ocultarlo después es peor que mostrar un hueco.
   */
  isLoading: boolean;
  cambiarUsuario: (email: string) => void;
}

const SessionContext = createContext<Sesion | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const email = useSyncExternalStore(suscribir, leerEmail, leerEmailEnServidor);

  const usuario = useQuery(
    api.usuarios.porEmail,
    email === null ? "skip" : { email },
  );

  const cambiarUsuario = useCallback((nuevo: string) => guardarEmail(nuevo), []);

  const sesion = useMemo<Sesion>(
    () => ({
      usuario: usuario ?? null,
      isLoading: email === null || usuario === undefined,
      cambiarUsuario,
    }),
    [email, usuario, cambiarUsuario],
  );

  return (
    <SessionContext.Provider value={sesion}>{children}</SessionContext.Provider>
  );
}

export function useSession(): Sesion {
  const contexto = useContext(SessionContext);
  if (!contexto) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return contexto;
}

export const ETIQUETA_ROL: Record<Usuario["rol"], string> = {
  propietaria: "Dueña",
  comercial: "Atiende y vende",
};

export function esDuena(usuario: Usuario | null): boolean {
  return usuario?.rol === "propietaria";
}
