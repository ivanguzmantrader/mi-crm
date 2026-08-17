"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Pantalla de acceso (PRO-6 / F17).
 *
 * No hay registro: las cuentas las crea la dueña desde Equipo (PRO-8). El
 * backend rechaza cualquier intento de alta, y esta pantalla ni siquiera lo
 * ofrece.
 */

/**
 * Un único mensaje para todos los fallos posibles.
 *
 * Da igual si el email no existe, si existe con otra contraseña, si estaba
 * malformado o si la librería falló por dentro: distinguirlos convertiría la
 * pantalla en un enumerador de cuentas, y PRO-6 pide explícitamente no revelar
 * si el email existe.
 */
const ERROR_ACCESO = "Email o contraseña incorrectos.";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);
    setEnviando(true);

    try {
      await signIn("password", {
        email: String(datos.get("email") ?? ""),
        password: String(datos.get("password") ?? ""),
        flow: "signIn",
      });
      router.replace("/hoy");
    } catch (fallo) {
      // NO mostrar `fallo` al usuario, por muy tentador que sea: distinguir un
      // caso de otro reabriría la enumeración de cuentas sin que ningún test se
      // entere. El endpoint tampoco los distingue ya (ver src/proxy.ts); esto
      // es la segunda capa.
      //
      // El detalle solo se traza en desarrollo: en producción no hay motivo
      // para dejar información de autenticación en la consola del navegador.
      if (process.env.NODE_ENV !== "production") {
        console.error("[login] fallo de acceso", fallo);
      }
      setError(ERROR_ACCESO);
      setEnviando(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-[9px] bg-primary text-xl font-semibold text-on-primary">
            V
          </span>
          <h1 className="text-2xl font-semibold text-text">Vibe CRM</h1>
        </div>

        <form
          onSubmit={entrar}
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs"
        >
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="tucorreo@ejemplo.com"
          />
          <Input
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            error={error ?? undefined}
          />
          <Button type="submit" loading={enviando}>
            Entrar
          </Button>
        </form>

        {/*
          PRO-6 pide este enlace. El flujo por email necesita un proveedor de
          correo que el proyecto todavía no tiene (issue aparte), así que de
          momento explica la vía real: la dueña restablece la contraseña desde
          Equipo (PRO-8).
        */}
        <p className="text-center text-[13px] text-text-muted">
          ¿Olvidaste tu contraseña? Pídele a la dueña que te la restablezca desde
          la pantalla de Equipo.
        </p>
      </div>
    </main>
  );
}
