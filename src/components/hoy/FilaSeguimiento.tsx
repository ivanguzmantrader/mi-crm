"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ESTADO_CLIENTE } from "@/lib/estadoCliente";
import { etiquetaVencimiento, type Bloque } from "@/lib/fechas";
import type { SeguimientoPendiente } from "./PantallaHoy";

/**
 * Fila de la lista de "Hoy".
 *
 * El botón de completar y el enlace a la ficha son **hermanos, nunca
 * anidados**: un <button> dentro de un <Link> es HTML inválido, rompe el orden
 * de tabulación y haría que completar una tarea navegase de paso. Por eso
 * tampoco hace falta el stopPropagation() que usa el prototipo.
 */
export function FilaSeguimiento({
  seguimiento,
  bloque,
  hoy,
}: {
  seguimiento: SeguimientoPendiente;
  bloque: Bloque;
  hoy: string;
}) {
  const marcarHecho = useMutation(api.seguimientos.marcarHecho);
  const [fallo, setFallo] = useState(false);
  const estado = ESTADO_CLIENTE[seguimiento.clienteEstado];
  const vencimiento = etiquetaVencimiento(seguimiento.vence, hoy);

  async function completar() {
    setFallo(false);
    try {
      // `hoy` es la fecha local del navegador: el servidor corre en UTC y no
      // puede fecharlo bien por su cuenta.
      await marcarHecho({ id: seguimiento._id, hecho: true, fecha: hoy });
    } catch {
      // ANDAMIAJE(PRO-55): aviso mínimo en la fila, sin actualización optimista ni toast con Deshacer.
      setFallo(true);
    }
  }

  return (
    <div className="border-t border-border py-2 first:border-t-0">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Marcar como hecho: ${seguimiento.accion}`}
          onClick={completar}
          className="ring-focus group -ml-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <span className="size-6 rounded-full border-[1.5px] border-border-strong transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] group-hover:border-primary" />
        </button>

        <Link
          href={`/clientes/${seguimiento.clienteId}`}
          className="ring-focus flex min-w-0 flex-1 items-center gap-3 rounded-md py-0.5"
        >
          <Avatar name={seguimiento.clienteNombre} size={40} />

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[15px] font-semibold text-text">
                {seguimiento.clienteNombre}
              </span>
              <Badge status={estado.status} dot>
                {estado.label}
              </Badge>
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
                {seguimiento.accion}
              </span>
              {/*
                Si el responsable ya no existe la fila se conserva igualmente:
                el avatar cae a un neutro sin nombre en vez de desaparecer, para
                que no se lea como "sin responsable asignado".
              */}
              <Avatar
                name={seguimiento.responsableNombre ?? ""}
                size={20}
                variant="neutral"
              />
            </span>
          </span>

          <span className="flex shrink-0 flex-col items-end gap-1">
            {bloque === "atrasado" && (
              <Badge status="error" dot>
                Atrasado
              </Badge>
            )}
            {bloque === "hoy" && (
              <Badge status="neutral" dot>
                Hoy
              </Badge>
            )}
            {vencimiento && (
              <span
                className={
                  bloque === "atrasado"
                    ? "text-xs whitespace-nowrap text-error-text"
                    : "text-xs whitespace-nowrap text-text-subtle"
                }
              >
                {vencimiento}
              </span>
            )}
          </span>
        </Link>
      </div>

      {fallo && (
        <p role="alert" className="pl-11 text-xs text-error-text">
          No se pudo completar. Vuelve a intentarlo.
        </p>
      )}
    </div>
  );
}
