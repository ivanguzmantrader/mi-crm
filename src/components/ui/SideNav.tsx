import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";
import type { ItemNav } from "./TabBar";

/**
 * Barra lateral fija de escritorio, 240px (design.md §4 › Navegación).
 * Presentacional: los ítems llegan ya filtrados por rol; `footer` es el bloque
 * de "Mi cuenta" que compone AppShell.
 */
export function SideNav({
  items,
  activeId,
  footer,
  className,
}: {
  items: ItemNav[];
  activeId: string | null;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "h-full w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-5 px-3.5",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-3 pt-1.5 pb-5">
        <span className="inline-flex size-[26px] items-center justify-center rounded-[7px] bg-primary text-[15px] font-semibold text-on-primary">
          V
        </span>
        <span className="text-base font-semibold text-text">Vibe CRM</span>
      </div>

      <nav aria-label="Navegación principal" className="flex flex-col gap-1">
        {items.map((item) =>
          item.placeholder ? (
            <div key={item.id} className="flex items-center gap-2.5 px-3 py-2.5">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ) : (
            <Link
              key={item.id}
              href={item.href}
              aria-current={activeId === item.id ? "page" : undefined}
              className={cn(
                "ring-focus flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px]",
                "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
                activeId === item.id
                  ? "bg-primary-subtle font-semibold text-primary"
                  : "font-medium text-text-muted hover:bg-surface-2",
              )}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          ),
        )}
      </nav>

      <div className="flex-1" />
      {footer}
    </aside>
  );
}
