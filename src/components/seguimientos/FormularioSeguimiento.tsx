"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "convex/react";
import { AlertCircle } from "lucide-react";
import { SelectorCliente } from "@/components/clientes/SelectorCliente";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Overlay } from "@/components/ui/Overlay";
import { Select } from "@/components/ui/Select";
import { mensajeDe } from "@/lib/errores";
import { useSession } from "@/lib/session";
import { useHoy } from "@/lib/useHoy";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export interface DatosSeguimiento {
  clienteId: Id<"clientes">;
  responsableId: Id<"usuarios">;
  accion: string;
  vence: string;
}

/**
 * Programar seguimiento (PRO-13 / F8).
 *
 * Se abre desde la ficha (cliente fijado, sin selector) y desde el acceso
 * rápido "Nueva tarea" de Hoy (con selector).
 *
 * **El responsable sí se elige**, al revés que el autor de una interacción: allí
 * se registra quién hizo algo, aquí se decide quién debe hacerlo. Por defecto,
 * quien está rellenando el formulario.
 *
 * Las dos listas se consultan **aquí y no dentro de los selectores** porque de
 * ellas depende si el formulario puede enviarse siquiera: un `<select>`
 * deshabilitado no viaja en el `FormData` y un aviso no es un campo, así que
 * mientras cargan enviar mandaría cadenas vacías a Convex. Es la lección que
 * costó una ronda de auditoría en PRO-12.
 */
export function FormularioSeguimiento({
  clienteId,
  onGuardar,
  onCerrar,
}: {
  /** Fijado si se abre desde la ficha; ausente si se abre desde Hoy. */
  clienteId?: Id<"clientes">;
  onGuardar: (datos: DatosSeguimiento) => Promise<void>;
  onCerrar: () => void;
}) {
  const { usuario } = useSession();
  const hoy = useHoy();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const hayQueElegirCliente = clienteId === undefined;
  const clientes = useQuery(
    api.clientes.opciones,
    hayQueElegirCliente ? {} : "skip",
  );
  const responsables = useQuery(api.usuarios.asignables);

  /**
   * El selector de responsable depende de **dos** cosas, no solo de la lista:
   * también de saber quién ha iniciado sesión, porque es el valor por defecto.
   *
   * `Select` es no controlado, así que `defaultValue` solo se aplica **al
   * montar**. Si el desplegable se montara con la lista ya cargada pero sin
   * `usuario`, `defaultValue` sería `""`, no casaría con ninguna opción, el
   * navegador elegiría la primera, y cuando `usuario` llegase después
   * `defaultValue` ya no corregiría nada. Resultado: quien programase sin tocar
   * el selector se lo asignaría a la primera persona por orden alfabético en vez
   * de a sí mismo — en silencio, porque el desplegable enseña un nombre
   * perfectamente plausible.
   *
   * Por eso el desplegable real no se monta hasta tener las dos.
   */
  const cargandoResponsables = responsables === undefined || usuario === null;

  const sinClientes = hayQueElegirCliente && clientes?.length === 0;
  const cargando =
    (hayQueElegirCliente && clientes === undefined) || cargandoResponsables;
  const puedeEnviar = !cargando && !sinClientes;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);

    // El botón ya va deshabilitado mientras falte algo; esto cubre el envío con
    // Enter desde un campo de texto, que un botón deshabilitado no impide.
    const cliente = clienteId ?? recortar(datos.get("clienteId"));
    if (cliente === undefined) {
      setError(
        sinClientes
          ? "Todavía no hay clientes: crea uno antes de programar nada."
          : "Selecciona un cliente.",
      );
      return;
    }

    const responsable = recortar(datos.get("responsableId"));
    if (responsable === undefined) {
      setError("Elige quién se encarga.");
      return;
    }

    setError(null);
    setEnviando(true);
    try {
      await onGuardar({
        clienteId: cliente as Id<"clientes">,
        responsableId: responsable as Id<"usuarios">,
        accion: String(datos.get("accion") ?? ""),
        vence: String(datos.get("vence") ?? ""),
      });
      onCerrar();
    } catch (fallo) {
      setError(mensajeDe(fallo));
      setEnviando(false);
    }
  }

  return (
    <Overlay open onClose={onCerrar} title="Programar seguimiento">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        {hayQueElegirCliente && (
          <SelectorCliente name="clienteId" clientes={clientes} />
        )}

        <Input
          label="Qué hay que hacer"
          name="accion"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="Llamar para cerrar la propuesta"
        />

        {/*
          Sin `min`: un seguimiento con fecha pasada no es un dato inválido, es
          uno atrasado, y la pantalla Hoy ya lo recoge en su bloque rojo.
          "Se me olvidó agendar que tenía que llamar el lunes" es un caso real.
        */}
        <Input
          label="Para cuándo"
          name="vence"
          type="date"
          required
          defaultValue={hoy ?? undefined}
        />

        {/*
          El selector de responsable no necesita el trato de `SelectorCliente`:
          nunca puede quedarse vacío, porque quien rellena esto tiene sesión y
          por tanto es asignable él mismo. Solo tiene estado de carga — pero ese
          estado incluye no saber todavía quién eres (ver `cargandoResponsables`).
        */}
        {cargandoResponsables ? (
          <Select
            key="responsable-cargando"
            label="Quién se encarga"
            name="responsableId"
            disabled
            defaultValue=""
          >
            <option value="">Cargando…</option>
          </Select>
        ) : (
          /*
            La `key` no es decorativa: sin ella React ve el mismo `Select` en la
            misma posición y **reutiliza el `<select>` del estado de carga** en
            vez de montar uno nuevo. Como `defaultValue` solo se aplica al
            montar, el desplegable se quedaba con lo que el navegador eligiera al
            cambiarle las opciones —la primera por orden alfabético— y el "por
            defecto, tú" no se cumplía. Cambiar de `key` fuerza el montaje.

            Va atada al id del usuario para que, si cambiara la identidad, el
            valor por defecto se recalcule en lugar de quedarse pegado.
          */
          <Select
            key={`responsable-${usuario._id}`}
            label="Quién se encarga"
            name="responsableId"
            required
            defaultValue={usuario._id}
          >
            {responsables.map((persona) => (
              <option key={persona._id} value={persona._id}>
                {persona.nombre}
                {persona._id === usuario._id ? " (tú)" : ""}
              </option>
            ))}
          </Select>
        )}

        {error && (
          <p
            role="alert"
            className="flex items-start gap-1.5 rounded-md bg-error-bg px-3 py-2 text-[13px] text-error-text"
          >
            <AlertCircle
              size={14}
              strokeWidth={1.5}
              aria-hidden
              className="mt-0.5 shrink-0"
            />
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="submit"
            loading={enviando}
            disabled={!puedeEnviar}
            className="flex-1"
          >
            Programar
          </Button>
          <Button type="button" variant="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

/** Valor de un campo del formulario, o `undefined` si viene vacío o no viene. */
function recortar(valor: FormDataEntryValue | null): string | undefined {
  const texto = String(valor ?? "").trim();
  return texto === "" ? undefined : texto;
}
