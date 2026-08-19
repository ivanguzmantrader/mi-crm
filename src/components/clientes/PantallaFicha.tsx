"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CalendarPlus,
  Mail,
  MessageCircle,
  MessageSquare,
  Pencil,
  PencilLine,
  Phone,
  TrendingUp,
  UserSearch,
  Users,
} from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type EstadoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Overlay } from "@/components/ui/Overlay";
import { Skeleton } from "@/components/ui/Skeleton";
import { ESTADO_CLIENTE } from "@/lib/estadoCliente";
import { etiquetaVencimiento, fechaCorta } from "@/lib/fechas";
import { useHoy } from "@/lib/useHoy";
import { FormularioInteraccion } from "@/components/interacciones/FormularioInteraccion";
import { FormularioSeguimiento } from "@/components/seguimientos/FormularioSeguimiento";
import { ETIQUETA_CANAL, FormularioCliente } from "./FormularioCliente";

type Ficha = NonNullable<FunctionReturnType<typeof api.clientes.ficha>>;
type Pendiente = Ficha["pendientes"][number];
type ItemHistorial = Ficha["historial"][number];

interface AccionFicha {
  id: string;
  label: string;
  icono: ReactNode;
  /**
   * Issue que construye el formulario de verdad. Sin `issue`, la acción ya está
   * construida y abre su formulario real.
   */
  issue?: string;
}

/**
 * Las tres acciones rápidas de la ficha. PRO-11 dejó los botones y la
 * integración lista; los formularios son tareas propias de M4 y M5.
 *
 * Las que siguen siendo stub llevan **su propio marcador**, no uno compartido
 * que las nombre a todas: el inventario agrupa por issue, así que un marcador
 * único haría que al cerrar una quedara registrado como pendiente algo que en
 * realidad espera a otra. Un marcador apunta siempre a la issue que lo borra.
 */
const ACCIONES: AccionFicha[] = [
  // Ya construida (PRO-12): abre el formulario real con el cliente fijado.
  {
    id: "interaccion",
    label: "Anotar interacción",
    icono: <PencilLine size={18} strokeWidth={1.5} />,
  },
  // Ya construida (PRO-13): abre el formulario real con el cliente fijado.
  {
    id: "seguimiento",
    label: "Programar seguimiento",
    icono: <CalendarPlus size={18} strokeWidth={1.5} />,
  },
  // ANDAMIAJE(PRO-15): el botón abre un panel informativo; el formulario de venta lo construye PRO-15.
  {
    id: "venta",
    label: "Registrar venta",
    icono: <TrendingUp size={18} strokeWidth={1.5} />,
    issue: "PRO-15",
  },
];

const ESTADO_VENTA: Record<string, { label: string; status: EstadoBadge }> = {
  abierta: { label: "Abierta", status: "info" },
  ganada: { label: "Ganada", status: "success" },
  perdida: { label: "Perdida", status: "error" },
};

const CANAL_INTERACCION: Record<string, { label: string; icono: ReactNode }> = {
  llamada: { label: "Llamada", icono: <Phone size={18} strokeWidth={1.5} /> },
  email: { label: "Email", icono: <Mail size={18} strokeWidth={1.5} /> },
  whatsapp: {
    label: "WhatsApp",
    icono: <MessageCircle size={18} strokeWidth={1.5} />,
  },
  en_persona: {
    label: "En persona",
    icono: <Users size={18} strokeWidth={1.5} />,
  },
};

const EUROS = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * Ficha de cliente (PRO-11 / F2): la pantalla central del CRM.
 *
 * Todo llega en **una sola query** —datos, pendientes e historial ya mezclado y
 * ordenado— para que haya un único punto de autorización y para que la pantalla
 * no tenga que ordenar nada. Como esa query lee las cuatro tablas, completar un
 * seguimiento la reejecuta sola y la fila salta de "pendientes" a "historial".
 */
export function PantallaFicha({ id }: { id: string }) {
  const ficha = useQuery(api.clientes.ficha, { id });
  const actualizar = useMutation(api.clientes.actualizar);
  const anotar = useMutation(api.interacciones.crear);
  const programar = useMutation(api.seguimientos.crear);
  const [editando, setEditando] = useState(false);
  const [accion, setAccion] = useState<AccionFicha | null>(null);

  if (ficha === undefined) return <Cargando />;
  if (ficha === null) return <NoEncontrado />;

  const { cliente, pendientes, historial } = ficha;
  const estado = ESTADO_CLIENTE[cliente.estado];

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/clientes"
        className="ring-focus -ml-1 inline-flex w-fit items-center gap-1.5 rounded-md px-1 py-0.5 text-[13px] text-text-muted hover:text-text"
      >
        <ArrowLeft size={16} strokeWidth={1.5} aria-hidden />
        Clientes
      </Link>

      <Card className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <Avatar name={cliente.nombre} size={56} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="truncate text-[19px] font-semibold text-text">
              {cliente.nombre}
            </h1>
            {cliente.empresa && (
              <span className="truncate text-sm text-text-muted">
                {cliente.empresa}
              </span>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge status={estado.status} dot>
                {estado.label}
              </Badge>
              {cliente.canalOrigen && (
                <Badge status="neutral">
                  Origen: {ETIQUETA_CANAL[cliente.canalOrigen]}
                </Badge>
              )}
            </div>
          </div>
          <IconButton
            aria-label="Editar cliente"
            size="compact"
            onClick={() => setEditando(true)}
          >
            <Pencil size={18} strokeWidth={1.5} />
          </IconButton>
        </div>

        {/*
          Solo se pinta la fila del dato que existe: un `tel:` vacío es un enlace
          roto que al tocarlo parece un fallo de la aplicación.
        */}
        {(cliente.telefono || cliente.email) && (
          <div className="flex flex-col border-t border-border">
            {cliente.telefono && (
              <Contacto
                icono={<Phone size={18} strokeWidth={1.5} />}
                etiqueta="Teléfono"
                valor={cliente.telefono}
                href={`tel:${cliente.telefono.replace(/\s/g, "")}`}
              />
            )}
            {cliente.email && (
              <Contacto
                icono={<Mail size={18} strokeWidth={1.5} />}
                etiqueta="Email"
                valor={cliente.email}
                href={`mailto:${cliente.email}`}
              />
            )}
          </div>
        )}

        {cliente.nota && (
          <p className="border-t border-border pt-3 text-sm text-text-muted">
            {cliente.nota}
          </p>
        )}
      </Card>

      <div className="grid gap-2.5 md:grid-cols-3">
        {ACCIONES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAccion(item)}
            className="ring-focus flex min-h-13 items-center gap-3 rounded-xl border border-border bg-surface p-3.5 text-left text-[15px] font-medium text-text shadow-xs transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:border-border-strong hover:bg-surface-2 md:flex-col md:justify-center md:gap-2 md:px-2.5 md:py-4 md:text-center md:text-[13px]"
          >
            <span
              aria-hidden
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary"
            >
              {item.icono}
            </span>
            {item.label}
          </button>
        ))}
      </div>

      <Seccion titulo="Seguimientos pendientes">
        {pendientes.length === 0 ? (
          <p className="px-[18px] py-4 text-sm text-text-muted">
            Sin seguimientos pendientes.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {pendientes.map((pendiente) => (
              <FilaPendiente key={pendiente._id} pendiente={pendiente} />
            ))}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Historial">
        {historial.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={24} strokeWidth={1.5} />}
            title="Sin actividad todavía"
            help="Anota una interacción o registra una venta para empezar el historial."
          />
        ) : (
          <div className="divide-y divide-border">
            {historial.map((item) => (
              <FilaHistorial key={`${item.tipo}-${item._id}`} item={item} />
            ))}
          </div>
        )}
      </Seccion>

      {editando && (
        <FormularioCliente
          titulo="Editar cliente"
          textoAccion="Guardar cambios"
          valorInicial={cliente}
          onCerrar={() => setEditando(false)}
          onGuardar={async (datos) => {
            await actualizar({ id: cliente._id, ...datos });
          }}
        />
      )}

      {accion?.id === "interaccion" && (
        <FormularioInteraccion
          clienteId={cliente._id}
          onCerrar={() => setAccion(null)}
          onGuardar={async (datos) => {
            await anotar(datos);
            // No hace falta navegar ni refrescar: `clientes.ficha` lee las
            // cuatro tablas, así que se reejecuta sola y el apunte aparece.
          }}
        />
      )}

      {accion?.id === "seguimiento" && (
        <FormularioSeguimiento
          clienteId={cliente._id}
          onCerrar={() => setAccion(null)}
          onGuardar={async (datos) => {
            await programar(datos);
          }}
        />
      )}

      {accion?.issue !== undefined && (
        <Overlay open onClose={() => setAccion(null)} title={accion.label}>
          <p className="text-sm text-text-muted">
            El formulario se construye en{" "}
            <span className="font-mono text-text">{accion.issue}</span>. Al
            guardar volverá a esta misma ficha con el historial actualizado.
          </p>
        </Overlay>
      )}
    </div>
  );
}

function Contacto({
  icono,
  etiqueta,
  valor,
  href,
}: {
  icono: ReactNode;
  etiqueta: string;
  valor: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="ring-focus flex items-center gap-3 rounded-md py-3 not-last:border-b not-last:border-border"
    >
      <span aria-hidden className="shrink-0 text-text-subtle">
        {icono}
      </span>
      <span className="w-[72px] shrink-0 text-[13px] text-text-subtle">
        {etiqueta}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-text">{valor}</span>
    </a>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <Card padding={false}>
      <div className="border-b border-border px-[18px] py-3">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] text-text-muted uppercase">
          {titulo}
        </h2>
      </div>
      {children}
    </Card>
  );
}

/**
 * Fila de seguimiento pendiente.
 *
 * No reutiliza `FilaSeguimiento` de la pantalla Hoy a propósito: aquella enseña
 * el avatar del cliente, su nombre y su chip de estado, y enlaza a esta misma
 * ficha. Aquí el cliente **es el contexto**, así que todo eso sería ruido y el
 * enlace, un callejón. Lo que sí se comparte es lo que estaba resuelto de
 * verdad: la mutation y los helpers de fechas.
 *
 * El botón de completar no va dentro de ningún enlace —aquí no hay ninguno—,
 * manteniendo la regla de `FilaSeguimiento`: un `<button>` dentro de un `<Link>`
 * es HTML inválido y hace que completar una tarea navegue de paso.
 */
function FilaPendiente({ pendiente }: { pendiente: Pendiente }) {
  const marcarHecho = useMutation(api.seguimientos.marcarHecho);
  const hoy = useHoy();
  const [fallo, setFallo] = useState(false);

  const vencimiento = hoy === null ? "" : etiquetaVencimiento(pendiente.vence, hoy);
  const atrasado = hoy !== null && pendiente.vence < hoy;

  async function completar() {
    setFallo(false);
    try {
      // La fecha local la aporta el navegador: el servidor corre en UTC y cerca
      // de medianoche fecharía el "hecho" en otro día.
      await marcarHecho({
        id: pendiente._id,
        hecho: true,
        fecha: hoy ?? undefined,
      });
    } catch {
      // ANDAMIAJE(PRO-55): aviso mínimo en la fila, sin actualización optimista ni toast con Deshacer.
      setFallo(true);
    }
  }

  return (
    <div className="px-[18px] py-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Marcar como hecho: ${pendiente.accion}`}
          onClick={completar}
          className="ring-focus group -ml-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <span className="size-6 rounded-full border-[1.5px] border-border-strong transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] group-hover:border-primary" />
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-medium text-text">
            {pendiente.accion}
          </span>
          <span className="truncate text-[13px] text-text-muted">
            {fechaCorta(pendiente.vence)}
            {vencimiento && ` · ${vencimiento}`}
          </span>
        </div>

        <Avatar
          name={pendiente.responsableNombre ?? ""}
          size={24}
          variant="neutral"
        />
        {atrasado && (
          <Badge status="error" dot>
            Atrasado
          </Badge>
        )}
      </div>

      {fallo && (
        <p role="alert" className="pl-11 text-xs text-error-text">
          No se pudo completar. Vuelve a intentarlo.
        </p>
      )}
    </div>
  );
}

function FilaHistorial({ item }: { item: ItemHistorial }) {
  const { icono, fondo, titulo, detalle, chip, autor } = describir(item);

  return (
    <div className="flex items-start gap-3 px-[18px] py-3.5">
      <span
        aria-hidden
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${fondo}`}
      >
        {icono}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] font-medium text-text">{titulo}</span>
        {chip}
        {detalle && <span className="text-[13px] text-text-muted">{detalle}</span>}
        {autor && <span className="text-xs text-text-subtle">{autor}</span>}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {item.tipo === "venta" && (
          <span className="font-mono text-sm font-semibold tabular-nums text-text">
            {EUROS.format(item.importe)}
          </span>
        )}
        <span className="text-xs whitespace-nowrap text-text-subtle">
          {fechaCorta(item.fecha)}
        </span>
      </div>
    </div>
  );
}

function describir(item: ItemHistorial): {
  icono: ReactNode;
  fondo: string;
  titulo: string;
  detalle: string | null;
  chip: ReactNode;
  autor: string | null;
} {
  if (item.tipo === "interaccion") {
    const canal = CANAL_INTERACCION[item.canal];
    return {
      icono: canal.icono,
      fondo: "bg-surface-2 text-text-muted",
      titulo: canal.label,
      detalle: item.texto,
      chip: null,
      autor: item.autorNombre && `Registrado por ${item.autorNombre}`,
    };
  }

  if (item.tipo === "venta") {
    const estado = ESTADO_VENTA[item.estado];
    return {
      icono: <TrendingUp size={18} strokeWidth={1.5} />,
      fondo:
        item.estado === "ganada"
          ? "bg-success-bg text-success-text"
          : item.estado === "perdida"
            ? "bg-error-bg text-error-text"
            : "bg-info-bg text-info-text",
      titulo: item.concepto,
      detalle: null,
      chip: (
        <span className="w-fit">
          <Badge status={estado.status} dot>
            {estado.label}
          </Badge>
        </span>
      ),
      autor: item.autorNombre && `Registrado por ${item.autorNombre}`,
    };
  }

  return {
    icono: <CalendarPlus size={18} strokeWidth={1.5} />,
    fondo: "bg-primary-subtle text-primary",
    titulo: item.accion,
    detalle: "Seguimiento completado",
    chip: null,
    autor: item.responsableNombre && `Responsable: ${item.responsableNombre}`,
  };
}

function NoEncontrado() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-text">Cliente</h1>
      <Card padding={false}>
        <EmptyState
          icon={<UserSearch size={24} strokeWidth={1.5} />}
          title="No hemos encontrado este cliente"
          help="Puede que se haya borrado o que el enlace esté mal."
          action={
            <Link href="/clientes">
              <Button variant="secondary">Volver a Clientes</Button>
            </Link>
          }
        />
      </Card>
    </div>
  );
}

function Cargando() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-4 w-24" />
      <Card className="flex items-start gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      </Card>
      <div className="grid gap-2.5 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-13 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
