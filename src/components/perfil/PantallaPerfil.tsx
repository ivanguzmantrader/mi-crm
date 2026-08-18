"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAction, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { AlertCircle, KeyRound, LogOut, Pencil, Shield } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Overlay } from "@/components/ui/Overlay";
import { Skeleton } from "@/components/ui/Skeleton";
import { mensajeDe } from "@/lib/errores";
import { ETIQUETA_ROL, esDuena, useSession } from "@/lib/session";

type Panel = "datos" | "contrasena" | null;

/**
 * Mi cuenta (PRO-7 / F17).
 *
 * El rol se muestra pero **no se edita**: cambiarlo es cosa de la dueña desde
 * Equipo, y las funciones de `convex/perfil.ts` ni siquiera aceptan ese campo.
 */
export function PantallaPerfil() {
  const { usuario, isLoading } = useSession();
  const [panel, setPanel] = useState<Panel>(null);
  const { signOut } = useAuthActions();
  const router = useRouter();

  const actualizar = useMutation(api.perfil.actualizarMisDatos);
  const cambiarContrasena = useAction(api.perfil.cambiarMiContrasena);

  if (isLoading || !usuario) return <Cargando />;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-text">Mi cuenta</h1>

      <Card className="flex items-center gap-4">
        <Avatar name={usuario.nombre} size={56} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[17px] font-semibold text-text">
            {usuario.nombre}
          </span>
          <span className="truncate text-sm text-text-muted">{usuario.email}</span>
        </div>
        <Badge status={usuario.rol === "propietaria" ? "primary" : "neutral"}>
          {ETIQUETA_ROL[usuario.rol]}
        </Badge>
      </Card>

      <Card padding={false}>
        <div className="divide-y divide-border">
          <Accion
            icono={<Pencil size={18} strokeWidth={1.5} />}
            titulo="Editar mis datos"
            detalle="Cambia tu nombre o tu email"
            onClick={() => setPanel("datos")}
          />
          <Accion
            icono={<KeyRound size={18} strokeWidth={1.5} />}
            titulo="Cambiar mi contraseña"
            detalle="Necesitarás la contraseña actual"
            onClick={() => setPanel("contrasena")}
          />
          {esDuena(usuario) && (
            <Enlace
              icono={<Shield size={18} strokeWidth={1.5} />}
              titulo="Usuarios"
              detalle="Da de alta y gestiona a tu equipo"
              href="/equipo"
            />
          )}
        </div>
      </Card>

      <Button
        variant="secondary"
        iconLeft={<LogOut size={18} strokeWidth={1.5} />}
        onClick={() => void signOut().then(() => router.replace("/login"))}
      >
        Cerrar sesión
      </Button>

      {panel === "datos" && (
        <FormularioPanel
          titulo="Editar mis datos"
          textoAccion="Guardar cambios"
          onCerrar={() => setPanel(null)}
          onGuardar={async (datos) => {
            await actualizar({
              nombre: String(datos.get("nombre") ?? ""),
              email: String(datos.get("email") ?? ""),
            });
          }}
        >
          <Input label="Nombre" name="nombre" required defaultValue={usuario.nombre} />
          <Input
            label="Email"
            name="email"
            type="email"
            required
            defaultValue={usuario.email}
            autoComplete="off"
          />
          {/*
            No es evidente que el email sea también la credencial de acceso, y
            cambiarlo sin saberlo dejaría a alguien preguntándose por qué ya no
            entra con el de antes.
          */}
          <p className="text-[13px] text-text-muted">
            Tu email es también con el que entras. Si lo cambias, la próxima vez
            tendrás que iniciar sesión con el nuevo (la contraseña sigue igual).
          </p>
        </FormularioPanel>
      )}

      {panel === "contrasena" && (
        <FormularioPanel
          titulo="Cambiar mi contraseña"
          textoAccion="Cambiar contraseña"
          onCerrar={() => setPanel(null)}
          validar={(datos) =>
            datos.get("nueva") !== datos.get("repetir")
              ? "Las dos contraseñas nuevas no coinciden."
              : null
          }
          onGuardar={async (datos) => {
            await cambiarContrasena({
              actual: String(datos.get("actual") ?? ""),
              nueva: String(datos.get("nueva") ?? ""),
            });
          }}
        >
          <Input
            label="Contraseña actual"
            name="actual"
            type="password"
            required
            autoComplete="current-password"
          />
          <Input
            label="Contraseña nueva"
            name="nueva"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Input
            label="Repite la nueva"
            name="repetir"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          {/*
            No promete instantaneidad a propósito: el registro de sesión se
            revoca al momento, pero el token ya emitido en el otro dispositivo
            sigue valiendo hasta que caduca (15 minutos, ver convex/auth.ts).
            Decir "se cerrarán" a secas sería prometer más de lo que ocurre.
          */}
          <p className="text-[13px] text-text-muted">
            Al cambiarla, tus otras sesiones dejarán de renovarse y se cerrarán
            en unos minutos.
          </p>
        </FormularioPanel>
      )}
    </div>
  );
}

function Accion({
  icono,
  titulo,
  detalle,
  onClick,
}: {
  icono: ReactNode;
  titulo: string;
  detalle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ring-focus flex w-full items-center gap-3 px-[18px] py-3.5 text-left hover:bg-surface-2"
    >
      <Contenido icono={icono} titulo={titulo} detalle={detalle} />
    </button>
  );
}

function Enlace({
  icono,
  titulo,
  detalle,
  href,
}: {
  icono: ReactNode;
  titulo: string;
  detalle: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="ring-focus flex w-full items-center gap-3 px-[18px] py-3.5 hover:bg-surface-2"
    >
      <Contenido icono={icono} titulo={titulo} detalle={detalle} />
    </Link>
  );
}

function Contenido({
  icono,
  titulo,
  detalle,
}: {
  icono: ReactNode;
  titulo: string;
  detalle: string;
}) {
  return (
    <>
      <span
        aria-hidden
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary"
      >
        {icono}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium text-text">{titulo}</span>
        <span className="text-[13px] text-text-muted">{detalle}</span>
      </span>
    </>
  );
}

/**
 * Panel de formulario con manejo de errores.
 *
 * Los errores del servidor se muestran como alerta del formulario, no colgando
 * de un campo: "la contraseña actual no es correcta" no pertenece al campo que
 * quede último. Y se muestran tal cual, al revés que en el login: aquí quien
 * pregunta ya ha iniciado sesión y está viendo sus propios datos, así que el
 * criterio de mensaje indistinguible de PRO-6 sería solo ruido.
 */
function FormularioPanel({
  titulo,
  textoAccion,
  children,
  validar,
  onGuardar,
  onCerrar,
}: {
  titulo: string;
  textoAccion: string;
  children: ReactNode;
  validar?: (datos: FormData) => string | null;
  onGuardar: (datos: FormData) => Promise<void>;
  onCerrar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);

    const fallaLocal = validar?.(datos);
    if (fallaLocal) {
      setError(fallaLocal);
      return;
    }

    setError(null);
    setEnviando(true);
    try {
      await onGuardar(datos);
      onCerrar();
    } catch (fallo) {
      setError(mensajeDe(fallo));
      setEnviando(false);
    }
  }

  return (
    <Overlay open onClose={onCerrar} title={titulo}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        {children}

        {error && (
          <p
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

function Cargando() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
