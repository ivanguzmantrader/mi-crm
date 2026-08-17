import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type VarianteBoton = "primary" | "secondary" | "ghost" | "destructive";
export type TamanoControl = "default" | "compact";

const VARIANTES: Record<VarianteBoton, string> = {
  primary:
    "bg-primary text-on-primary font-semibold hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "bg-surface text-text font-medium border border-border-strong hover:bg-surface-2",
  ghost: "bg-transparent text-text-muted font-medium hover:bg-surface-2",
  destructive: "bg-error text-white font-semibold hover:brightness-90",
};

/** 48px en móvil, 44px compacto (design.md §5). */
const TAMANOS: Record<TamanoControl, string> = {
  default: "h-12 px-5",
  compact: "h-11 px-4",
};

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: VarianteBoton;
  size?: TamanoControl;
  loading?: boolean;
  iconLeft?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "default",
  loading = false,
  iconLeft,
  disabled,
  className,
  children,
  ...props
}: BotonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "ring-focus inline-flex items-center justify-center gap-2 rounded-md text-[15px] whitespace-nowrap",
        "transition-[background-color,color,filter] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        "disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface-2",
        "disabled:text-text-subtle disabled:shadow-none disabled:hover:brightness-100",
        VARIANTES[variant],
        TAMANOS[size],
        className,
      )}
    >
      {loading ? <Spinner /> : iconLeft}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 shrink-0 rounded-full border-[3px] border-surface-2 border-t-primary"
      style={{ animation: "vibe-spin .7s linear infinite" }}
    />
  );
}
