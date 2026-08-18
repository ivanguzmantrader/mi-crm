"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { KeyRound, Pencil, UserMinus, UserPlus } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { ETIQUETA_ROL, useSession } from "@/lib/session";
import { FormularioUsuario, type DatosUsuario } from "./FormularioUsuario";

type Persona = {
  _id: Id<"usuarios">;
  nombre: string;
  email: string;
  rol: "propietaria" | "comercial";
  activo: boolean;
  tieneCredencial: boolean;
};

type Panel =
  | { tipo: "alta" }
  | { tipo: "editar"; persona: Persona }
  | { tipo: "contrasena"; persona: Persona }
  | { tipo: "reactivar"; persona: Persona }
  | null;

/**
 * Gestión del equipo (PRO-8 / F18).
 *
 * Todo lo que se ve aquí es cortesía: ocultar el botón de dar de baja a la
 * última dueña evita un error innecesario, pero quien impide de verdad la
 * operación es `convex/usuarios.ts`. Cualquiera puede llamar a esas funciones
 * sin pasar por esta pantalla.
 */
export function PantallaEquipo() {
  const { usuario: quienSoy } = useSession();
  const equipo = useQuery(api.usuarios.listar);
  const [panel, setPanel] = useState<Panel>(null);

  const crear = useAction(api.usuarios.crear);
  const actualizar = useMutation(api.usuarios.actualizar);
  const restablecer = useAction(api.usuarios.restablecerContrasena);
  const desactivar = useAction(api.usuarios.desactivar);
  const reactivar = useAction(api.usuarios.reactivar);

  if (equipo === undefined) return <Cargando />;

  const duenasConAcceso = equipo.filter(
    (p) => p.rol === "propietaria" && p.activo && p.tieneCredencial,
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold text-text">Equipo</h1>
        <Button
          size="compact"
          iconLeft={<UserPlus size={18} strokeWidth={1.5} />}
          onClick={() => setPanel({ tipo: "alta" })}
        >
          Añadir persona
        </Button>
      </header>

      <Card padding={false}>
        <div className="divide-y divide-border">
          {equipo.map((persona) => (
            <Fila
              key={persona._id}
              persona={persona}
              esUnoMismo={persona._id === quienSoy?._id}
              // Si es la única dueña con acceso, no se le puede quitar ni el rol
              // ni el acceso: la regla la impone el servidor, esto solo evita
              // ofrecer un botón que va a fallar.
              esUltimaDuena={
                persona.rol === "propietaria" &&
                persona.activo && persona.tieneCredencial &&
                duenasConAcceso.length === 1
              }
              onEditar={() => setPanel({ tipo: "editar", persona })}
              onContrasena={() => setPanel({ tipo: "contrasena", persona })}
              onReactivar={() => setPanel({ tipo: "reactivar", persona })}
              onDesactivar={() => void desactivar({ id: persona._id })}
            />
          ))}
        </div>
      </Card>

      {panel?.tipo === "alta" && (
        <FormularioUsuario
          titulo="Añadir persona"
          campos={{ perfil: true, password: true }}
          textoAccion="Crear y dar acceso"
          onCerrar={() => setPanel(null)}
          onGuardar={async (d: DatosUsuario) => {
            await crear({
              nombre: d.nombre,
              email: d.email,
              rol: d.rol,
              password: d.password ?? "",
            });
          }}
        />
      )}

      {panel?.tipo === "editar" && (
        <FormularioUsuario
          titulo="Editar persona"
          campos={{ perfil: true, password: false }}
          valorInicial={panel.persona}
          textoAccion="Guardar cambios"
          onCerrar={() => setPanel(null)}
          onGuardar={async (d) => {
            await actualizar({
              id: panel.persona._id,
              nombre: d.nombre,
              email: d.email,
              rol: d.rol,
            });
          }}
        />
      )}

      {panel?.tipo === "contrasena" && (
        <FormularioUsuario
          titulo={`Nueva contraseña para ${panel.persona.nombre}`}
          campos={{ perfil: false, password: true }}
          textoAccion="Restablecer"
          onCerrar={() => setPanel(null)}
          onGuardar={async (d) => {
            await restablecer({ id: panel.persona._id, password: d.password ?? "" });
          }}
        />
      )}

      {panel?.tipo === "reactivar" && (
        <FormularioUsuario
          titulo={`Devolver el acceso a ${panel.persona.nombre}`}
          campos={{ perfil: false, password: true }}
          textoAccion="Reactivar"
          onCerrar={() => setPanel(null)}
          onGuardar={async (d) => {
            await reactivar({ id: panel.persona._id, password: d.password ?? "" });
          }}
        />
      )}
    </div>
  );
}

function Fila({
  persona,
  esUnoMismo,
  esUltimaDuena,
  onEditar,
  onContrasena,
  onReactivar,
  onDesactivar,
}: {
  persona: Persona;
  esUnoMismo: boolean;
  esUltimaDuena: boolean;
  onEditar: () => void;
  onContrasena: () => void;
  onReactivar: () => void;
  onDesactivar: () => void;
}) {
  // Estar activa no basta: sin credencial tampoco se puede entrar. Es el estado
  // que deja un alta interrumpida, y pintarlo como acceso sería mentir.
  const tieneAcceso = persona.activo && persona.tieneCredencial;

  return (
    <div className="flex items-center gap-3 px-[18px] py-3.5">
      <Avatar
        name={persona.nombre}
        size={40}
        variant={tieneAcceso ? "primary" : "neutral"}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={
              tieneAcceso
                ? "truncate text-[15px] font-medium text-text"
                : "truncate text-[15px] font-medium text-text-subtle"
            }
          >
            {persona.nombre}
          </span>
          {esUnoMismo && <span className="text-xs text-text-subtle">(tú)</span>}
        </div>
        <span className="truncate text-[13px] text-text-muted">{persona.email}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge status={persona.rol === "propietaria" ? "primary" : "neutral"}>
          {ETIQUETA_ROL[persona.rol]}
        </Badge>
        {/*
          Sin acceso es un estado normal, no un dato roto: es lo que deja una
          baja, y lo que dejará una invitación sin aceptar (PRO-67).
        */}
        {!tieneAcceso && <Badge status="warning">Sin acceso</Badge>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <IconButton aria-label={`Editar ${persona.nombre}`} size="compact" onClick={onEditar}>
          <Pencil size={18} strokeWidth={1.5} />
        </IconButton>

        {tieneAcceso ? (
          <>
            <IconButton
              aria-label={`Restablecer contraseña de ${persona.nombre}`}
              size="compact"
              onClick={onContrasena}
            >
              <KeyRound size={18} strokeWidth={1.5} />
            </IconButton>
            <IconButton
              aria-label={`Quitar el acceso a ${persona.nombre}`}
              size="compact"
              variant="ghost"
              disabled={esUnoMismo || esUltimaDuena}
              title={
                esUnoMismo
                  ? "No puedes quitarte el acceso a ti misma"
                  : esUltimaDuena
                    ? "Es la única dueña con acceso"
                    : "Quitar el acceso"
              }
              onClick={onDesactivar}
            >
              <UserMinus size={18} strokeWidth={1.5} />
            </IconButton>
          </>
        ) : (
          <Button size="compact" variant="secondary" onClick={onReactivar}>
            Reactivar
          </Button>
        )}
      </div>
    </div>
  );
}

function Cargando() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-7 w-32" />
      <Card padding={false}>
        <div className="divide-y divide-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-[18px] py-3.5">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
