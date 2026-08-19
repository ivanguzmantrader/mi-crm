"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "convex/react";
import { AlertCircle, UserRound } from "lucide-react";
import { SelectorCliente } from "@/components/clientes/SelectorCliente";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Overlay } from "@/components/ui/Overlay";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { mensajeDe } from "@/lib/errores";
import { useSession } from "@/lib/session";
import { useHoy } from "@/lib/useHoy";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type CanalInteraccion = "llamada" | "email" | "whatsapp" | "en_persona";

const CANALES: Array<{ valor: CanalInteraccion; etiqueta: string }> = [
  { valor: "llamada", etiqueta: "Llamada" },
  { valor: "email", etiqueta: "Email" },
  { valor: "whatsapp", etiqueta: "WhatsApp" },
  { valor: "en_persona", etiqueta: "En persona" },
];

export interface DatosInteraccion {
  clienteId: Id<"clientes">;
  canal: CanalInteraccion;
  texto: string;
  /** Se omiten si el navegador aún no las conoce; el servidor tiene su respaldo. */
  fecha?: string;
  hoy?: string;
}

/**
 * Anotar interacción (PRO-12 / F7).
 *
 * Se abre desde dos sitios y solo cambia una cosa: si `clienteId` viene fijado
 * (desde la ficha) no se pinta selector; si no (desde Hoy), hay que elegir.
 *
 * **El autor no es un campo.** Lo pone el servidor a partir de la sesión, y por
 * eso ni siquiera aparece en el formulario — solo se anuncia, más abajo.
 *
 * La lista de clientes se consulta **aquí y no dentro de `SelectorCliente`**
 * porque de ella depende si el formulario se puede enviar siquiera: mientras
 * carga, y si no hay ningún cliente, el selector no aporta campo alguno al
 * `FormData` y enviar mandaría un `clienteId` vacío a Convex.
 */
export function FormularioInteraccion({
  clienteId,
  onGuardar,
  onCerrar,
}: {
  /** Fijado si se abre desde la ficha; ausente si se abre desde Hoy. */
  clienteId?: Id<"clientes">;
  onGuardar: (datos: DatosInteraccion) => Promise<void>;
  onCerrar: () => void;
}) {
  const { usuario } = useSession();
  const hoy = useHoy();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Abierto desde la ficha el cliente ya está decidido, así que no se consulta.
  const hayQueElegir = clienteId === undefined;
  const clientes = useQuery(api.clientes.opciones, hayQueElegir ? {} : "skip");

  const cargandoClientes = hayQueElegir && clientes === undefined;
  const sinClientes = hayQueElegir && clientes?.length === 0;
  const puedeEnviar = !cargandoClientes && !sinClientes;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);

    /**
     * El selector no siempre aporta campo: deshabilitado mientras carga y
     * ausente si no hay clientes. Sin esta comprobación, esas dos ramas
     * mandarían `clienteId: ""` y el usuario vería un `ArgumentValidationError`
     * de Convex — un error de programador — en vez de una explicación.
     *
     * El botón ya va deshabilitado en esos casos; esto cubre el envío con Enter
     * desde un campo de texto, que no lo impide un botón deshabilitado.
     */
    const elegido = clienteId ?? recortar(datos.get("clienteId"));
    if (elegido === undefined) {
      setError(
        sinClientes
          ? "Todavía no hay clientes: crea uno antes de anotar nada."
          : "Selecciona un cliente.",
      );
      return;
    }

    setError(null);
    setEnviando(true);
    try {
      await onGuardar({
        clienteId: elegido as Id<"clientes">,
        canal: String(datos.get("canal") ?? "llamada") as CanalInteraccion,
        texto: String(datos.get("texto") ?? ""),
        // Se omiten en vez de mandarse vacías: el servidor las valida con
        // `exigirFechaISO` y `""` fallaría con un mensaje que no ayuda a nadie.
        fecha: recortar(datos.get("fecha")),
        hoy: hoy ?? undefined,
      });
      onCerrar();
    } catch (fallo) {
      setError(mensajeDe(fallo));
      setEnviando(false);
    }
  }

  return (
    <Overlay open onClose={onCerrar} title="Anotar interacción">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        {hayQueElegir && (
          <SelectorCliente name="clienteId" clientes={clientes} />
        )}

        {/*
          Sin opción vacía a propósito: el canal es obligatorio y arranca en
          "Llamada". Eso hace imposible reproducir el fallo de PRO-9 — mandar ""
          a una unión de literales revienta la validación de argumentos antes de
          entrar al handler. Si alguien añade aquí un "Selecciona un canal" como
          opción vacía, vuelve el bug; el tipo no lo impide.
        */}
        <Select label="Canal" name="canal" defaultValue="llamada">
          {CANALES.map((canal) => (
            <option key={canal.valor} value={canal.valor}>
              {canal.etiqueta}
            </option>
          ))}
        </Select>

        <Input
          label="Fecha"
          name="fecha"
          type="date"
          required
          defaultValue={hoy ?? undefined}
          max={hoy ?? undefined}
        />

        <Textarea
          label="Nota"
          name="texto"
          required
          rows={3}
          maxLength={2000}
          placeholder="Qué se ha hablado, próximos pasos…"
        />

        {/*
          Hace visible que el autor se registra solo y no se elige, que es el
          criterio de aceptación. Mientras la sesión carga no se pinta: un "Se
          registrará como" a medias diría lo contrario de lo que existe para
          decir, que se sabe con certeza quién firma.
        */}
        {usuario && (
          <p className="flex items-center gap-2 text-[13px] text-text-muted">
            <UserRound
              size={14}
              strokeWidth={1.5}
              aria-hidden
              className="shrink-0 text-text-subtle"
            />
            Se registrará como {usuario.nombre}
          </p>
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
            Guardar interacción
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
