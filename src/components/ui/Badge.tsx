import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type EstadoBadge =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "primary"
  | "neutral";

/** Pares fondo/texto y color del punto (design.md §8 › Badge). */
const ESTADOS: Record<EstadoBadge, { pill: string; dot: string }> = {
  success: { pill: "bg-success-bg text-success-text", dot: "bg-success" },
  warning: { pill: "bg-warning-bg text-warning-text", dot: "bg-warning" },
  error: { pill: "bg-error-bg text-error-text", dot: "bg-error" },
  info: { pill: "bg-info-bg text-info-text", dot: "bg-info" },
  primary: { pill: "bg-primary-subtle text-primary", dot: "bg-primary" },
  neutral: { pill: "bg-surface-2 text-text-muted", dot: "bg-text-subtle" },
};

export function Badge({
  status = "neutral",
  dot = false,
  className,
  children,
}: {
  status?: EstadoBadge;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const estilo = ESTADOS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[13px] font-medium whitespace-nowrap",
        estilo.pill,
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("size-[7px] shrink-0 rounded-full", estilo.dot)}
        />
      )}
      {children}
    </span>
  );
}
