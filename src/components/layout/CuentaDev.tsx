"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ETIQUETA_ROL, useSession } from "@/lib/session";

/**
 * Pie de la barra lateral: acceso a "Mi cuenta" + selector de usuario.
 *
 * El selector es **andamiaje de desarrollo**: sin login (PRO-6) es la única
 * forma de comprobar que la pestaña "Equipo" solo aparece para el rol dueña.
 * Desaparece al construir PRO-6.
 */
export function CuentaDev() {
  const { usuario, isLoading, cambiarUsuario } = useSession();
  const usuarios = useQuery(api.usuarios.listar);

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2">
      {isLoading || !usuario ? (
        <div className="flex items-center gap-2.5 p-1.5">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ) : (
        <Link
          href="/perfil"
          className="ring-focus flex items-center gap-2.5 rounded-md p-1.5 hover:bg-surface-2"
        >
          <Avatar name={usuario.nombre} size={32} variant="neutral" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium text-text">
              {usuario.nombre}
            </span>
            <span className="text-xs text-text-subtle">
              {ETIQUETA_ROL[usuario.rol]}
            </span>
          </span>
        </Link>
      )}

      <label className="flex flex-col gap-1 px-1.5 pb-1">
        <span className="text-[11px] font-medium tracking-[0.06em] text-text-subtle uppercase">
          Usuario (dev)
        </span>
        <select
          value={usuario?.email ?? ""}
          disabled={isLoading || !usuarios}
          onChange={(e) => cambiarUsuario(e.target.value)}
          className="ring-focus h-9 rounded-md border border-border-strong bg-surface px-2 text-[13px] text-text disabled:bg-surface-2 disabled:text-text-subtle"
        >
          {(usuarios ?? []).map((u) => (
            <option key={u._id} value={u.email}>
              {u.nombre} · {ETIQUETA_ROL[u.rol]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
