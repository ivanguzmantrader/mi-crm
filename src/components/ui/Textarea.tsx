"use client";

import { useId, type TextareaHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

/**
 * Campo de texto largo con la misma caja que `Input` (design.md §8).
 *
 * El porte del design system (PRO-54) no lo incluyó porque ninguna pantalla de
 * entonces tenía texto libre; lo pide la nota del formulario de cliente (PRO-9).
 * Mismo caso que `Select`, que se añadió durante PRO-8.
 */
export function Textarea({
  label,
  error,
  id,
  className,
  rows = 3,
  ...props
}: TextareaProps) {
  const generado = useId();
  const textareaId = id ?? generado;
  const errorId = `${textareaId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <textarea
        {...props}
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "w-full resize-y rounded-md border bg-surface px-3.5 py-3 text-[15px] text-text",
          "placeholder:text-text-subtle",
          "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
          "focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-subtle",
          error
            ? "border-error shadow-[0_0_0_3px_var(--color-error-bg)]"
            : "border-border-strong focus:border-primary focus:shadow-[var(--focus-ring)]",
          className,
        )}
      />
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
