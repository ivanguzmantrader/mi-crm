"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { CheckCheck } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { FormularioCliente } from "@/components/clientes/FormularioCliente";
import { FormularioInteraccion } from "@/components/interacciones/FormularioInteraccion";
import { FormularioSeguimiento } from "@/components/seguimientos/FormularioSeguimiento";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Overlay } from "@/components/ui/Overlay";
import { Skeleton } from "@/components/ui/Skeleton";
import { agruparSeguimientos, etiquetaFechaLarga } from "@/lib/fechas";
import { useHoy } from "@/lib/useHoy";
import {
  ACCESO_NUEVA_TAREA,
  AccesosRapidos,
  type AccesoRapido,
} from "./AccesosRapidos";
import { SeccionSeguimientos } from "./SeccionSeguimientos";

export type SeguimientoPendiente = FunctionReturnType<
  typeof api.seguimientos.pendientes
>[number];

/**
 * Pantalla de inicio (PRO-14): a quién hay que contactar hoy y qué está
 * atrasado.
 *
 * Muestra los seguimientos de **todo el equipo**, sin filtrar por responsable:
 * es la vista del negocio, no "mis tareas" (T10 de Marta).
 */
export function PantallaHoy() {
  const seguimientos = useQuery(api.seguimientos.pendientes);
  const crear = useMutation(api.clientes.crear);
  const anotar = useMutation(api.interacciones.crear);
  const programar = useMutation(api.seguimientos.crear);
  const router = useRouter();
  const [abierto, setAbierto] = useState<AccesoRapido | null>(null);

  // "Hoy" depende de la zona horaria de quien mira la pantalla, así que se
  // resuelve en el cliente: calcularlo al renderizar en el servidor daría un
  // desajuste de hidratación.
  const hoy = useHoy();

  return (
    <div className="flex flex-col gap-5">
      {seguimientos === undefined || hoy === null ? (
        <CabeceraCargando />
      ) : (
        <Cabecera seguimientos={seguimientos} hoy={hoy} />
      )}

      <AccesosRapidos onAbrir={setAbierto} />

      {seguimientos === undefined || hoy === null ? (
        <SeccionesCargando />
      ) : seguimientos.length === 0 ? (
        <Card padding={false}>
          <EmptyState
            icon={<CheckCheck size={24} strokeWidth={1.5} />}
            title="No hay seguimientos para hoy"
            help="Estás al día. Disfruta del día o añade un nuevo seguimiento."
            action={
              <Button onClick={() => setAbierto(ACCESO_NUEVA_TAREA)}>
                Nueva tarea
              </Button>
            }
          />
        </Card>
      ) : (
        <Secciones seguimientos={seguimientos} hoy={hoy} />
      )}

      {/*
        Reparto explícito por `id` en vez de ternarios encadenados: ya hay dos
        accesos construidos y quedan dos por construir, así que encadenar
        condiciones haría fácil dejarse un caso sin cubrir. El panel informativo
        es la rama por defecto, para los que siguen siendo stub.
      */}
      {abierto?.id === "cliente" && (
        <FormularioCliente
          titulo="Nuevo cliente"
          textoAccion="Crear cliente"
          onCerrar={() => setAbierto(null)}
          onGuardar={async (datos) => {
            const id = await crear(datos);
            // Mismo aterrizaje que desde la lista: PRO-9 pide abrir la ficha del
            // cliente recién creado, sin decir desde dónde se haya abierto.
            router.push(`/clientes/${id}`);
          }}
        />
      )}

      {abierto?.id === "interaccion" && (
        <FormularioInteraccion
          onCerrar={() => setAbierto(null)}
          onGuardar={async (datos) => {
            await anotar(datos);
            // Desde aquí no hay ficha a la que volver, así que se va a la del
            // cliente elegido: PRO-12 pide aterrizar en ella con el historial
            // ya actualizado.
            router.push(`/clientes/${datos.clienteId}`);
          }}
        />
      )}

      {abierto?.id === "tarea" && (
        <FormularioSeguimiento
          onCerrar={() => setAbierto(null)}
          onGuardar={async (datos) => {
            await programar(datos);
            // PRO-13 pide volver a la ficha del cliente con el seguimiento ya
            // visible en sus pendientes.
            router.push(`/clientes/${datos.clienteId}`);
          }}
        />
      )}

      {abierto?.issue !== undefined && (
        <Overlay
          open
          onClose={() => setAbierto(null)}
          title={abierto.label}
        >
          <p className="text-sm text-text-muted">
            El formulario se construye en{" "}
            <span className="font-mono text-text">{abierto.issue}</span>, con su
            propio selector de cliente.
          </p>
        </Overlay>
      )}
    </div>
  );
}

function Cabecera({
  seguimientos,
  hoy,
}: {
  seguimientos: SeguimientoPendiente[];
  hoy: string;
}) {
  const { atrasados, paraHoy } = agruparSeguimientos(seguimientos, hoy);
  // Lo "pendiente hoy" es lo vencido más lo de hoy; las próximas no cuentan.
  const total = atrasados.length + paraHoy.length;

  return (
    <header className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-[0.06em] text-text-subtle uppercase">
        {etiquetaFechaLarga()}
      </span>
      <h1 className="text-2xl font-semibold text-text">
        {total === 0
          ? "Todo al día"
          : `${total} ${total === 1 ? "seguimiento" : "seguimientos"}`}
      </h1>
    </header>
  );
}

function Secciones({
  seguimientos,
  hoy,
}: {
  seguimientos: SeguimientoPendiente[];
  hoy: string;
}) {
  const { atrasados, paraHoy, proximas } = agruparSeguimientos(seguimientos, hoy);

  return (
    <>
      <SeccionSeguimientos
        bloque="atrasado"
        titulo="Atrasados"
        seguimientos={atrasados}
        hoy={hoy}
      />
      <SeccionSeguimientos
        bloque="hoy"
        titulo="Para hoy"
        seguimientos={paraHoy}
        hoy={hoy}
      />
      <SeccionSeguimientos
        bloque="proximo"
        titulo="Próximas"
        seguimientos={proximas}
        hoy={hoy}
      />
    </>
  );
}

function CabeceraCargando() {
  return (
    <header className="flex flex-col gap-2">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-7 w-56" />
    </header>
  );
}

function SeccionesCargando() {
  return (
    <div className="flex flex-col gap-5">
      {[0, 1].map((seccion) => (
        <Card key={seccion} padding={false}>
          <div className="border-b border-border px-[18px] py-3">
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex flex-col gap-4 px-[18px] py-4">
            {[0, 1, 2].map((fila) => (
              <div key={fila} className="flex items-center gap-3">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="size-10 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
