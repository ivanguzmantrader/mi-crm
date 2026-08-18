"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Overlay } from "@/components/ui/Overlay";
import { Select } from "@/components/ui/Select";

export type Rol = "propietaria" | "comercial";

export interface DatosUsuario {
  nombre: string;
  email: string;
  rol: Rol;
  /** Solo en alta y reactivación; al editar no se toca la contraseña. */
  password?: string;
}

/**
 * Panel único para alta, edición, restablecer contraseña y reactivar.
 *
 * Los cuatro flujos piden variaciones de los mismos campos, así que se resuelven
 * con un formulario parametrizado en vez de cuatro casi idénticos.
 *
 * Los mensajes de error que llegan del servidor **sí se muestran tal cual**, al
 * revés que en el login: aquí las reglas son de negocio ("ya hay alguien con ese
 * email", "no puedes dejar el negocio sin dueña") y quien las lee es la dueña,
 * que ya tiene la lista entera delante. El criterio de mensaje indistinguible de
 * PRO-6 existe para no revelar qué cuentas hay a quien no ha iniciado sesión.
 */
export function FormularioUsuario({
  titulo,
  campos,
  valorInicial,
  textoAccion,
  onGuardar,
  onCerrar,
}: {
  titulo: string;
  campos: { perfil: boolean; password: boolean };
  valorInicial?: { nombre: string; email: string; rol: Rol };
  textoAccion: string;
  onGuardar: (datos: DatosUsuario) => Promise<void>;
  onCerrar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);
    setEnviando(true);

    try {
      await onGuardar({
        nombre: String(datos.get("nombre") ?? valorInicial?.nombre ?? ""),
        email: String(datos.get("email") ?? valorInicial?.email ?? ""),
        rol: (String(datos.get("rol") ?? valorInicial?.rol ?? "comercial") as Rol),
        password: campos.password
          ? String(datos.get("password") ?? "")
          : undefined,
      });
      onCerrar();
    } catch (fallo) {
      setError(mensajeDe(fallo));
      setEnviando(false);
    }
  }

  return (
    <Overlay open onClose={onCerrar} title={titulo}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        {campos.perfil && (
          <>
            <Input
              label="Nombre"
              name="nombre"
              required
              defaultValue={valorInicial?.nombre}
              autoComplete="off"
            />
            <Input
              label="Email"
              name="email"
              type="email"
              required
              defaultValue={valorInicial?.email}
              autoComplete="off"
            />
            <Select label="Rol" name="rol" defaultValue={valorInicial?.rol ?? "comercial"}>
              <option value="comercial">Atiende y vende</option>
              <option value="propietaria">Dueña</option>
            </Select>
          </>
        )}

        {campos.password && (
          <Input
            label="Contraseña"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby={error ? "error-formulario" : undefined}
          />
        )}

        {/*
          Los errores del servidor son del formulario, no de un campo concreto:
          "ya hay una persona con ese email" o "no puedes dejar el negocio sin
          dueña" no tienen nada que ver con la contraseña. Colgarlos del último
          Input haría que el usuario buscara el problema donde no está. Los
          errores de campo se los queda la validación del navegador.
        */}
        {error && (
          <p
            id="error-formulario"
            role="alert"
            className="flex items-start gap-1.5 rounded-md bg-error-bg px-3 py-2 text-[13px] text-error-text"
          >
            <AlertCircle size={14} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" loading={enviando} className="flex-1">
            {textoAccion}
          </Button>
          <Button type="button" variant="secondary" onClick={onCerrar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

/** Convex envuelve el error del servidor; interesa la última línea con sentido. */
function mensajeDe(fallo: unknown): string {
  if (!(fallo instanceof Error)) return "No se ha podido completar la operación.";
  const limpio = fallo.message
    .split("\n")
    .map((l) => l.replace(/^Uncaught Error:\s*/, "").trim())
    .filter((l) => l.length > 0 && !l.startsWith("[Request ID") && !l.startsWith("at "));
  return limpio.at(-1) ?? "No se ha podido completar la operación.";
}
