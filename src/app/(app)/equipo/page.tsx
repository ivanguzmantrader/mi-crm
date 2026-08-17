// ANDAMIAJE(PRO-8): pantalla placeholder — Gestión de usuarios.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PantallaPendiente } from "@/components/layout/PantallaPendiente";
import { Skeleton } from "@/components/ui/Skeleton";
import { esDuena, useSession } from "@/lib/session";

/**
 * Gestión de usuarios — solo para el rol dueña (F18 / PRO-8).
 *
 * Este guard es **presentación, no seguridad**: evita pintar una pantalla que
 * de todas formas no podría cargar datos. Quien protege de verdad es
 * `exigirDuena` en `convex/usuarios.ts`, porque las funciones de Convex se
 * pueden llamar sin pasar por el navegador.
 */
export default function EquipoPage() {
  const router = useRouter();
  const { usuario, isLoading } = useSession();
  const permitido = esDuena(usuario);

  useEffect(() => {
    if (!isLoading && !permitido) router.replace("/hoy");
  }, [isLoading, permitido, router]);

  // Nunca se renderiza el contenido restringido antes de conocer el rol.
  if (isLoading || !permitido) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <PantallaPendiente
      titulo="Equipo"
      issue="PRO-8"
      descripcion="Alta, edición y baja de las personas que usan el CRM."
    />
  );
}
