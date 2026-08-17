import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";

export interface ItemNav {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
  /**
   * Ranura reservada mientras aún no se sabe si el ítem corresponde al rol del
   * usuario. Se pinta un hueco en vez del ítem real, para no mostrarlo y
   * ocultarlo después (ver src/lib/session.tsx).
   */
  placeholder?: boolean;
}

/**
 * Barra inferior de móvil, hasta 4 ítems (design.md §8 › Tab bar).
 * Presentacional: recibe los ítems ya filtrados por rol y cuál está activo.
 */
export function TabBar({
  items,
  activeId,
  className,
}: {
  items: ItemNav[];
  activeId: string | null;
  className?: string;
}) {
  return (
    <nav
      aria-label="Navegación principal"
      className={cn("shrink-0 border-t border-border bg-surface", className)}
    >
      {items.map((item) =>
        item.placeholder ? (
          <div
            key={item.id}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
          >
            <Skeleton className="size-[22px] rounded-full" />
            <Skeleton className="h-2.5 w-10" />
          </div>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            aria-current={activeId === item.id ? "page" : undefined}
            className={cn(
              "ring-focus flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2",
              "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
              activeId === item.id
                ? "font-semibold text-primary"
                : "font-medium text-text-subtle",
            )}
          >
            <span aria-hidden>{item.icon}</span>
            <span className="text-[11px]">{item.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
