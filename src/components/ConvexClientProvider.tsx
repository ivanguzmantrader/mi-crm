"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

/**
 * Envuelve la app con el cliente de Convex y la sesión de Convex Auth.
 *
 * Si falta NEXT_PUBLIC_CONVEX_URL se renderiza un aviso **en lugar de** los
 * hijos, nunca los hijos sin proveedor: `useQuery` lanza una excepción dura
 * cuando no encuentra cliente en el árbol (ver convex/src/react/use_queries.ts),
 * así que dejarlos pasar solo cambiaría un mensaje claro por un crash al pintar
 * la primera pantalla con datos.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) return <ConvexNoConfigurado />;

  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}

function ConvexNoConfigurado() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col gap-2 rounded-xl border border-border bg-surface p-5 shadow-xs">
        <h1 className="text-[15px] font-semibold text-text">
          Convex no está configurado
        </h1>
        <p className="text-sm text-text-muted">
          Falta la variable <code className="font-mono">NEXT_PUBLIC_CONVEX_URL</code>.
          Ejecuta <code className="font-mono">npx convex dev</code> y copia la URL
          generada a <code className="font-mono">.env.local</code> (ver{" "}
          <code className="font-mono">.env.local.example</code>).
        </p>
      </div>
    </div>
  );
}
