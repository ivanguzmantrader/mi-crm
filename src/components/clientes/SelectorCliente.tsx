"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Select } from "@/components/ui/Select";

export type OpcionCliente = FunctionReturnType<typeof api.clientes.opciones>[number];

/**
 * Desplegable de clientes para los formularios que no parten de una ficha
 * (PRO-12, y luego PRO-13 y PRO-15).
 *
 * **Es presentacional a propósito: la consulta la hace el formulario.** Tenerla
 * aquí dentro parecía más limpio, pero dejaba al formulario sin saber si se
 * podía enviar: en las ramas de carga y de "sin clientes" este componente no
 * aporta ningún campo —un `<select>` deshabilitado no viaja en el `FormData`, y
 * el aviso no es un campo—, así que el formulario acababa mandando un
 * `clienteId` vacío y el usuario veía un error de validador de Convex en vez de
 * una explicación. Quien decide si hay algo que enviar tiene que ser quien
 * envía.
 *
 * La opción vacía es un marcador de posición de un campo obligatorio, y quien
 * impide enviarla sin elegir es el `required` del navegador. **Eso no sustituye
 * a nada**: el servidor sigue resolviendo `ctx.db.get(clienteId)` y rechazando
 * si el cliente no existe. Que aquí solo se ofrezcan clientes vivos no es
 * garantía — esta lista pudo cargarse hace rato, y cualquiera puede llamar a la
 * mutation sin pasar por esta pantalla.
 */
export function SelectorCliente({
  name,
  clientes,
  label = "Cliente",
}: {
  name: string;
  /** `undefined` mientras carga. */
  clientes: OpcionCliente[] | undefined;
  label?: string;
}) {
  if (clientes === undefined) {
    return (
      <Select label={label} name={name} disabled defaultValue="">
        <option value="">Cargando clientes…</option>
      </Select>
    );
  }

  // Sin clientes no hay nada que anotar, y un desplegable vacío no explicaría
  // por qué. Se dice y se ofrece la salida.
  if (clientes.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-border bg-surface-2 px-3.5 py-3">
        <Users
          size={18}
          strokeWidth={1.5}
          aria-hidden
          className="mt-0.5 shrink-0 text-text-subtle"
        />
        <p className="text-[13px] text-text-muted">
          Todavía no hay clientes.{" "}
          <Link href="/clientes" className="font-medium text-primary underline">
            Crea el primero
          </Link>{" "}
          y podrás anotar lo que hables con él.
        </p>
      </div>
    );
  }

  return (
    <Select label={label} name={name} required defaultValue="">
      <option value="">Selecciona un cliente</option>
      {clientes.map((cliente) => (
        <option key={cliente._id} value={cliente._id}>
          {etiqueta(cliente)}
        </option>
      ))}
    </Select>
  );
}

/**
 * Nombre más el primer dato que sirva para distinguirlo.
 *
 * Hace falta porque los clientes duplicados están permitidos a propósito (ver
 * `convex/clientes.ts`): dos "Ana García" sin empresa serían dos filas idénticas
 * en el desplegable y no habría forma de saber cuál es cuál.
 */
function etiqueta(cliente: OpcionCliente): string {
  const distintivo = cliente.empresa ?? cliente.telefono ?? cliente.email;
  return distintivo === null ? cliente.nombre : `${cliente.nombre} · ${distintivo}`;
}
