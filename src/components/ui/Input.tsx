"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({
  label,
  error,
  icon,
  id,
  className,
  ...props
}: InputProps) {
  const generado = useId();
  const inputId = id ?? generado;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-subtle"
          >
            {icon}
          </span>
        )}
        <input
          {...props}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-12 w-full rounded-md border bg-surface px-3.5 text-[15px] text-text",
            "placeholder:text-text-subtle",
            "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
            "focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-subtle",
            icon ? "pl-10" : null,
            error
              ? "border-error shadow-[0_0_0_3px_var(--color-error-bg)]"
              : "border-border-strong focus:border-primary focus:shadow-[var(--focus-ring)]",
            className,
          )}
        />
      </div>
      {/* El error se comunica con texto e icono, no solo con color (design.md §6). */}
      {error && (
        <p
          id={errorId}
          className="flex items-center gap-1.5 text-[13px] text-error-text"
        >
          <AlertCircle size={14} strokeWidth={1.5} aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
