"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { SideNav } from "@/components/ui/SideNav";
import { TabBar, type ItemNav } from "@/components/ui/TabBar";
import { esDuena, useSession } from "@/lib/session";
import { Cuenta } from "./Cuenta";
import { NAV, seccionActiva } from "./navItems";

/**
 * Chrome de la aplicación (PRO-18): barra lateral en escritorio, barra inferior
 * en móvil.
 *
 * El cambio entre ambas es **puro CSS** (`hidden md:flex` / `flex md:hidden`),
 * no una medición de `window.innerWidth` como en el prototipo: medir en JS
 * provoca desajuste de hidratación y un parpadeo en el primer render.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { usuario, isLoading } = useSession();
  const activo = seccionActiva(pathname);

  const items: ItemNav[] = NAV.flatMap((item) => {
    const nodo = {
      id: item.id,
      label: item.label,
      href: item.href,
      icon: <item.Icono size={20} strokeWidth={1.5} />,
    };

    if (!item.soloDuena) return [nodo];
    // Mientras no se sepa el rol se reserva la ranura con un hueco. Nunca
    // mostrar el ítem y retirarlo después (ver src/lib/session.tsx).
    if (isLoading) return [{ ...nodo, placeholder: true }];
    return esDuena(usuario) ? [nodo] : [];
  });

  const tituloSeccion = NAV.find((i) => i.id === activo)?.label ?? "Vibe CRM";

  return (
    <div className="flex min-h-0 flex-1">
      <SideNav
        className="hidden md:flex"
        items={items}
        activeId={activo}
        footer={<Cuenta />}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-15 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 md:hidden">
          {/*
            No es un <h1>: el encabezado de la página lo pone cada pantalla
            ("6 seguimientos" en Hoy). Esto es la etiqueta de la sección actual,
            que en móvil se vería a la vez que aquél — dos h1 en la misma
            pantalla. La sección ya se anuncia con aria-current en la tab bar.
          */}
          <p className="flex-1 truncate pl-1 text-[17px] font-semibold text-text">
            {tituloSeccion}
          </p>
          {isLoading || !usuario ? (
            <Skeleton className="size-11 rounded-full" />
          ) : (
            <Link
              href="/perfil"
              aria-label="Mi cuenta"
              className="ring-focus inline-flex size-11 shrink-0 items-center justify-center rounded-full"
            >
              <Avatar name={usuario.nombre} size={32} variant="neutral" />
            </Link>
          )}
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[860px] px-4 pt-4 pb-8 md:px-8 md:pt-7 md:pb-14">
            {children}
          </div>
        </main>

        <TabBar className="flex md:hidden" items={items} activeId={activo} />
      </div>
    </div>
  );
}
