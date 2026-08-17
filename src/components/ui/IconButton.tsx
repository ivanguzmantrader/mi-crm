import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { TamanoControl, VarianteBoton } from "./Button";

const VARIANTES: Record<VarianteBoton, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active",
  secondary: "bg-surface text-text border border-border-strong hover:bg-surface-2",
  ghost: "bg-transparent text-text-muted hover:bg-surface-2",
  destructive: "bg-error text-white hover:brightness-90",
};

const TAMANOS: Record<TamanoControl, string> = {
  default: "size-12",
  compact: "size-11",
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: VarianteBoton;
  size?: TamanoControl;
  /** Obligatorio: el botón no lleva texto visible. */
  "aria-label": string;
  children: ReactNode;
}

export function IconButton({
  variant = "ghost",
  size = "default",
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "ring-focus inline-flex shrink-0 items-center justify-center rounded-md",
        "transition-[background-color,color,filter] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-subtle",
        VARIANTES[variant],
        TAMANOS[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
