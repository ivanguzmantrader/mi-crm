"use client";

import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

/** Select nativo con la misma caja que `Input` (design.md §8). */
export function Select({
  label,
  error,
  id,
  className,
  children,
  ...props
}: SelectProps) {
  const generado = useId();
  const selectId = id ?? generado;
  const errorId = `${selectId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          {...props}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "ring-focus h-12 w-full appearance-none rounded-md border bg-surface px-3.5 pr-10 text-[15px] text-text",
            "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
            "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-subtle",
            error ? "border-error" : "border-border-strong",
            className,
          )}
        >
          {children}
        </select>
        <ChevronDown
          size={18}
          strokeWidth={1.5}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-subtle"
        />
      </div>
      {error && (
        <p id={errorId} className="text-[13px] text-error-text">
          {error}
        </p>
      )}
    </div>
  );
}
