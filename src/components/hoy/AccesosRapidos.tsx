import type { ReactNode } from "react";
import { CalendarPlus, PencilLine, TrendingUp, UserPlus } from "lucide-react";

export interface AccesoRapido {
  id: string;
  label: string;
  icono: ReactNode;
  /** Issue de Linear que construye el formulario de verdad. */
  issue: string;
  /** Acción primaria de la pantalla: una sola, en verde sólido (design.md §1). */
  primaria?: boolean;
}

export const ACCESOS: AccesoRapido[] = [
  {
    id: "tarea",
    label: "Nueva tarea",
    icono: <CalendarPlus size={18} strokeWidth={1.5} />,
    issue: "PRO-13",
    primaria: true,
  },
  {
    id: "interaccion",
    label: "Anotar interacción",
    icono: <PencilLine size={18} strokeWidth={1.5} />,
    issue: "PRO-12",
  },
  {
    id: "venta",
    label: "Registrar venta",
    icono: <TrendingUp size={18} strokeWidth={1.5} />,
    issue: "PRO-15",
  },
  {
    id: "cliente",
    label: "Nuevo cliente",
    icono: <UserPlus size={18} strokeWidth={1.5} />,
    issue: "PRO-9",
  },
];

export const ACCESO_NUEVA_TAREA = ACCESOS[0];

/**
 * Los 4 accesos rápidos de la pantalla Hoy: permiten crear sin pasar antes por
 * la ficha de un cliente (PRO-14). Presentacional — el panel lo abre y lo
 * gobierna PantallaHoy, porque el estado vacío también dispara "Nueva tarea".
 */
export function AccesosRapidos({
  onAbrir,
}: {
  onAbrir: (acceso: AccesoRapido) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {ACCESOS.map((acceso) => (
        <button
          key={acceso.id}
          type="button"
          onClick={() => onAbrir(acceso)}
          className="ring-focus flex min-h-13 items-center gap-3 rounded-xl border border-border bg-surface p-3.5 text-left text-[15px] font-medium text-text shadow-xs transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:border-border-strong hover:bg-surface-2 md:flex-col md:justify-center md:gap-2 md:px-2.5 md:py-4 md:text-center md:text-[13px]"
        >
          <span
            aria-hidden
            className={
              acceso.primaria
                ? "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
                : "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary"
            }
          >
            {acceso.icono}
          </span>
          {acceso.label}
        </button>
      ))}
    </div>
  );
}
