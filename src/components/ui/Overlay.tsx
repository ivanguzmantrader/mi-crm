"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

/**
 * Panel superpuesto: hoja inferior en móvil, modal centrado en escritorio
 * (diseñado en PRO-39).
 *
 * Alcance deliberadamente mínimo: role/aria, cierre con Esc y devolución del
 * foco al elemento que lo abrió. **El focus trap completo y el comportamiento
 * unificado de formularios son PRO-19** — no se implementan aquí.
 */
export function Overlay({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const origenFoco = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    origenFoco.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", alPulsar);

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = overflowPrevio;
      origenFoco.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-surface shadow-lg outline-none md:max-h-[90vh] md:w-[480px] md:rounded-xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <h2 className="flex-1 text-[17px] font-semibold text-text">{title}</h2>
          <IconButton aria-label="Cerrar" size="compact" onClick={onClose}>
            <X size={20} strokeWidth={1.5} />
          </IconButton>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
