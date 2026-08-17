import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Fila de lista: avatar + bloque principal + importe/meta a la derecha
 * (design.md §8 › Lista). Las filas se separan con un borde de 1px, que aplica
 * el contenedor con `divide-y divide-border`.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-[18px] py-3.5", className)}>
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="truncate text-[15px] font-medium text-text">{title}</div>
        {subtitle && (
          <div className="truncate text-[13px] text-text-muted">{subtitle}</div>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
