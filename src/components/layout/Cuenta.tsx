"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { ETIQUETA_ROL, useSession } from "@/lib/session";

/** Pie de la barra lateral: acceso a "Mi cuenta" y cierre de sesión. */
export function Cuenta() {
  const { usuario, isLoading } = useSession();
  const { signOut } = useAuthActions();
  const router = useRouter();

  if (isLoading || !usuario) {
    return (
      <div className="flex items-center gap-2.5 border-t border-border p-1.5 pt-3">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 border-t border-border pt-2">
      <Link
        href="/perfil"
        className="ring-focus flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1.5 hover:bg-surface-2"
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
      <IconButton
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        size="compact"
        onClick={() => void signOut().then(() => router.replace("/login"))}
      >
        <LogOut size={18} strokeWidth={1.5} />
      </IconButton>
    </div>
  );
}
