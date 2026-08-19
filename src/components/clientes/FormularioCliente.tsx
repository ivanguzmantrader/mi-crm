"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Overlay } from "@/components/ui/Overlay";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { mensajeDe } from "@/lib/errores";

export type CanalOrigen = "web" | "redes" | "email" | "whatsapp";

export const CANALES: Array<{ valor: CanalOrigen; etiqueta: string }> = [
  { valor: "web", etiqueta: "Web" },
  { valor: "redes", etiqueta: "Redes" },
  { valor: "email", etiqueta: "Email" },
  { valor: "whatsapp", etiqueta: "WhatsApp" },
];

export const ETIQUETA_CANAL: Record<CanalOrigen, string> = {
  web: "Web",
  redes: "Redes",
  email: "Email",
  whatsapp: "WhatsApp",
};

/** Lo que se manda al servidor. Los opcionales vacíos van como `undefined`. */
export interface DatosCliente {
  nombre: string;
  telefono?: string;
  email?: string;
  empresa?: string;
  canalOrigen?: CanalOrigen;
  nota?: string;
}

export interface ValorInicialCliente {
  nombre: string;
  telefono: string | null;
  email: string | null;
  empresa: string | null;
  canalOrigen: CanalOrigen | null;
  nota: string | null;
}

/**
 * Panel único para el alta y la edición de un cliente (PRO-9 y PRO-11).
 *
 * Los dos flujos piden exactamente los mismos campos, así que se resuelven con
 * un formulario compartido en vez de dos casi idénticos — la misma solución que
 * `FormularioUsuario` en PRO-8.
 *
 * **No hay campo de Estado**, ni aquí ni en ninguna otra pantalla: se deriva de
 * las ventas del cliente (PRO-17) y las funciones de `convex/clientes.ts` ni
 * siquiera lo aceptan como argumento.
 *
 * Los errores del servidor se muestran tal cual, como en PRO-8 y PRO-7: son
 * reglas de negocio ("el email no es válido") dirigidas a alguien que ya ha
 * iniciado sesión. El criterio de mensaje indistinguible de PRO-6 existe para el
 * login, donde quien pregunta es anónimo.
 */
export function FormularioCliente({
  titulo,
  textoAccion,
  valorInicial,
  onGuardar,
  onCerrar,
}: {
  titulo: string;
  textoAccion: string;
  valorInicial?: ValorInicialCliente;
  onGuardar: (datos: DatosCliente) => Promise<void>;
  onCerrar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);

    const nombre = campo(datos, "nombre") ?? "";
    const telefono = campo(datos, "telefono");
    const email = campo(datos, "email");

    // "Al menos uno de los dos" no se puede expresar con `required`, así que se
    // comprueba aquí. La garantía de verdad la da el servidor; esto solo evita
    // el viaje y señala el problema como lo que es: del formulario, no de un
    // campo concreto.
    if (telefono === undefined && email === undefined) {
      setError("Indica al menos un teléfono o un email.");
      return;
    }

    setError(null);
    setEnviando(true);
    try {
      await onGuardar({
        nombre,
        telefono,
        email,
        empresa: campo(datos, "empresa"),
        canalOrigen: canalDe(datos),
        nota: campo(datos, "nota"),
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
        <Input
          label="Nombre"
          name="nombre"
          required
          maxLength={120}
          defaultValue={valorInicial?.nombre}
          autoComplete="off"
        />
        <Input
          label="Empresa"
          name="empresa"
          maxLength={120}
          defaultValue={valorInicial?.empresa ?? ""}
          autoComplete="off"
        />
        <Input
          label="Teléfono"
          name="telefono"
          type="tel"
          maxLength={40}
          defaultValue={valorInicial?.telefono ?? ""}
          autoComplete="off"
        />
        <Input
          label="Email"
          name="email"
          type="email"
          maxLength={200}
          defaultValue={valorInicial?.email ?? ""}
          autoComplete="off"
        />

        <Select
          label="Canal de origen"
          name="canalOrigen"
          defaultValue={valorInicial?.canalOrigen ?? ""}
        >
          <option value="">Sin especificar</option>
          {CANALES.map((canal) => (
            <option key={canal.valor} value={canal.valor}>
              {canal.etiqueta}
            </option>
          ))}
        </Select>

        <Textarea
          label="Nota"
          name="nota"
          maxLength={2000}
          rows={3}
          defaultValue={valorInicial?.nota ?? ""}
          placeholder="Cómo ha llegado, qué necesita, cualquier cosa que convenga recordar."
        />

        <p className="text-[13px] text-text-muted">
          El teléfono y el email son opcionales por separado, pero hace falta al
          menos uno de los dos para poder contactar.
        </p>

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

/** Texto recortado, o `undefined` si queda vacío. Nunca `""`. */
function campo(datos: FormData, nombre: string): string | undefined {
  const valor = String(datos.get(nombre) ?? "").trim();
  return valor === "" ? undefined : valor;
}

/**
 * Canal de origen del `<select>`, o `undefined` si es la opción vacía.
 *
 * **Esto no es una limpieza cosmética, es obligatorio.** En el esquema
 * `canalOrigen` es una unión de literales (`web` | `redes` | `email` |
 * `whatsapp`) y opcional; `""` **no es un valor válido**. Mandarlo haría fallar
 * la validación de argumentos de Convex *antes* de entrar al handler, así que la
 * normalización del servidor no llegaría siquiera a verlo y el usuario recibiría
 * un error de validador en vez de guardar.
 *
 * Devolver `undefined` equivale a no mandar la clave: al serializar los
 * argumentos, Convex descarta las claves con valor `undefined`. (Ojo, en un
 * `db.patch` el mismo `undefined` significa lo contrario —borrar el campo—; ver
 * `actualizar` en `convex/clientes.ts`.)
 */
function canalDe(datos: FormData): CanalOrigen | undefined {
  const valor = String(datos.get("canalOrigen") ?? "");
  return valor === "" ? undefined : (valor as CanalOrigen);
}
