"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PantallaPendiente } from "@/components/layout/PantallaPendiente";
import { Skeleton } from "@/components/ui/Skeleton";
import { esDuena, useSession } from "@/lib/session";

/**
 * Gestión de usuarios — solo para el rol dueña (F18 / PRO-8).
 *
 * El guard es de cliente a propósito: con la sesión simulada el rol vive en
 * localStorage y en un hook de Convex, así que el servidor no lo conoce y un
 * `redirect()` en el servidor no tendría con qué decidir. Cuando PRO-6 aporte
 * sesión real, esto pasa a ser una comprobación de servidor — y deja de ser
 * solo cosmética.
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
