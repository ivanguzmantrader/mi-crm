import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Superficie base: blanco sobre el lienzo gris, separada por un borde de 1px y
 * una sombra muy sutil (design.md §8 › Tarjeta).
 */
export function Card({
  padding = true,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padding?: boolean }) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-xl border border-border bg-surface shadow-xs",
        padding && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
