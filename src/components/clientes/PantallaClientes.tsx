"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Search, SearchX, UserPlus, Users } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ESTADO_CLIENTE } from "@/lib/estadoCliente";
import { fechaCorta } from "@/lib/fechas";
import { FormularioCliente } from "./FormularioCliente";

type Cliente = FunctionReturnType<typeof api.clientes.listar>[number];

/**
 * Listado de clientes con buscador (PRO-10 / F3).
 *
 * El filtrado ocurre **en el navegador**, sobre la lista completa. No es un
 * atajo: ningún índice de búsqueda de Convex puede casar "612345678" con un
 * teléfono guardado como "612 34 56 78" —es criterio de aceptación de la
 * issue— ni encontrar subcadenas dentro de una palabra, y filtrar en el
 * servidor metería un viaje de red por cada tecla cuando lo que se pide es que
 * se sienta instantáneo. El techo está anotado en `convex/clientes.ts`.
 */
export function PantallaClientes() {
  const clientes = useQuery(api.clientes.listar);
  const crear = useMutation(api.clientes.crear);
  const router = useRouter();

  const [busqueda, setBusqueda] = useState("");
  const [alta, setAlta] = useState(false);

  const filtrados = useMemo(
    () => filtrar(clientes ?? [], busqueda),
    [clientes, busqueda],
  );

  const hayBusqueda = busqueda.trim() !== "";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-semibold tracking-[0.06em] text-text-subtle uppercase">
            Clientes
          </span>
          <h1 className="text-2xl font-semibold text-text">
            {clientes === undefined
              ? " "
              : hayBusqueda
                ? `${filtrados.length} ${filtrados.length === 1 ? "resultado" : "resultados"}`
                : `${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`}
          </h1>
        </div>
        <Button
          size="compact"
          iconLeft={<UserPlus size={18} strokeWidth={1.5} />}
          onClick={() => setAlta(true)}
        >
          Nuevo cliente
        </Button>
      </header>

      <Input
        type="search"
        aria-label="Buscar clientes"
        placeholder="Buscar por nombre, teléfono o email"
        icon={<Search size={18} strokeWidth={1.5} />}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {clientes === undefined ? (
        <Cargando />
      ) : clientes.length === 0 ? (
        <Card padding={false}>
          <EmptyState
            icon={<Users size={24} strokeWidth={1.5} />}
            title="Sin clientes todavía"
            help="Añade tu primer cliente para empezar a vender."
            action={<Button onClick={() => setAlta(true)}>Añadir cliente</Button>}
          />
        </Card>
      ) : filtrados.length === 0 ? (
        /*
          Dos estados vacíos distintos porque tienen salidas distintas: este se
          arregla borrando la búsqueda, el de arriba dando de alta a alguien.
        */
        <Card padding={false}>
          <EmptyState
            icon={<SearchX size={24} strokeWidth={1.5} />}
            title="Sin resultados"
            help="No hay clientes que coincidan con tu búsqueda."
            action={
              <Button variant="secondary" onClick={() => setBusqueda("")}>
                Limpiar búsqueda
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-border">
            {filtrados.map((cliente) => (
              <Fila key={cliente._id} cliente={cliente} />
            ))}
          </div>
        </Card>
      )}

      {alta && (
        <FormularioCliente
          titulo="Nuevo cliente"
          textoAccion="Crear cliente"
          onCerrar={() => setAlta(false)}
          onGuardar={async (datos) => {
            const id = await crear(datos);
            // PRO-9: al guardar se abre la ficha del cliente recién creado, para
            // poder empezar a trabajar con él sin pasos intermedios.
            router.push(`/clientes/${id}`);
          }}
        />
      )}
    </div>
  );
}

function Fila({ cliente }: { cliente: Cliente }) {
  const estado = ESTADO_CLIENTE[cliente.estado];

  return (
    <Link
      href={`/clientes/${cliente._id}`}
      className="ring-focus flex items-center gap-3 px-[18px] py-3.5 hover:bg-surface-2"
    >
      <Avatar name={cliente.nombre} size={40} />

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-medium text-text">
          {cliente.nombre}
          {cliente.empresa && (
            <span className="text-text-muted"> · {cliente.empresa}</span>
          )}
        </span>
        {/*
          La etiqueta cambia con el dato en vez de fingir que siempre hay un
          último contacto: un cliente recién dado de alta no tiene ninguno, y
          poner ahí su fecha de alta sin decirlo sería mentir.
        */}
        <span className="truncate text-[13px] text-text-muted">
          {cliente.ultimoContacto === null
            ? `Alta el ${fechaCorta(cliente.fechaAlta)}`
            : `Último contacto: ${fechaCorta(cliente.ultimoContacto)}`}
        </span>
      </span>

      <Badge status={estado.status} dot>
        {estado.label}
      </Badge>
    </Link>
  );
}

/** Solo los dígitos, para comparar teléfonos escritos de cualquier manera. */
function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

function filtrar(clientes: Cliente[], busqueda: string): Cliente[] {
  const consulta = busqueda.trim().toLowerCase();
  if (consulta === "") return clientes;

  const digitos = soloDigitos(consulta);

  return clientes.filter((cliente) => {
    if (cliente.nombre.toLowerCase().includes(consulta)) return true;
    if ((cliente.email ?? "").toLowerCase().includes(consulta)) return true;

    // Con un solo dígito casarían casi todos los teléfonos y la búsqueda
    // parecería rota, así que la vía del teléfono pide dos o más. Las tres
    // condiciones se suman, nunca se elige una según el aspecto de la consulta:
    // un email puede llevar dígitos.
    return (
      digitos.length >= 2 &&
      soloDigitos(cliente.telefono ?? "").includes(digitos)
    );
  });
}

function Cargando() {
  return (
    <Card padding={false}>
      <div className="divide-y divide-border">
        {[0, 1, 2, 3, 4].map((fila) => (
          <div key={fila} className="flex items-center gap-3 px-[18px] py-3.5">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}
