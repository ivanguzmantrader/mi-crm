import { cn } from "@/lib/cn";
import type { Bloque } from "@/lib/fechas";
import { FilaSeguimiento } from "./FilaSeguimiento";
import type { SeguimientoPendiente } from "./PantallaHoy";

/**
 * Tarjeta por bloque. "Atrasados" va primero y resaltado: borde superior rojo y
 * cabecera sobre error-bg (PRO-42 / PRO-14).
 */
const ESTILOS: Record<
  Bloque,
  { tarjeta: string; cabecera: string; titulo: string; punto: string }
> = {
  atrasado: {
    tarjeta: "border-t-[3px] border-t-error",
    cabecera: "bg-error-bg",
    titulo: "text-error-text",
    punto: "bg-error",
  },
  hoy: {
    tarjeta: "",
    cabecera: "",
    titulo: "text-text-muted",
    punto: "bg-text-subtle",
  },
  proximo: {
    tarjeta: "",
    cabecera: "",
    titulo: "text-text-muted",
    punto: "bg-text-subtle",
  },
};

export function SeccionSeguimientos({
  bloque,
  titulo,
  seguimientos,
  hoy,
}: {
  bloque: Bloque;
  titulo: string;
  seguimientos: SeguimientoPendiente[];
  hoy: string;
}) {
  if (seguimientos.length === 0) return null;
  const estilo = ESTILOS[bloque];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface shadow-xs",
        estilo.tarjeta,
      )}
    >
      <header
        className={cn(
          "flex items-center gap-2 border-b border-border px-[18px] py-2.5",
          estilo.cabecera,
        )}
      >
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", estilo.punto)}
        />
        <h2
          className={cn(
            "flex-1 text-[13px] font-semibold tracking-[0.04em] uppercase",
            estilo.titulo,
          )}
        >
          {titulo}
        </h2>
        <span
          className={cn(
            "font-mono text-[13px] font-semibold tabular-nums",
            bloque === "atrasado" ? "text-error-text" : "text-text-subtle",
          )}
        >
          {seguimientos.length}
        </span>
      </header>

      <div className="px-[18px] py-1.5">
        {seguimientos.map((seg) => (
          <FilaSeguimiento
            key={seg._id}
            seguimiento={seg}
            bloque={bloque}
            hoy={hoy}
          />
        ))}
      </div>
    </section>
  );
}
