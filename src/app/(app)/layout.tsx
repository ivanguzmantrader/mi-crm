import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Shell compartido por todas las pantallas de la app (PRO-18). Es un grupo de
 * rutas `(app)`, así que no añade segmento a la URL: /hoy sigue siendo /hoy.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
