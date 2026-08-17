import { Home, Shield, TrendingUp, Users, type LucideIcon } from "lucide-react";

export interface DefinicionNav {
  id: string;
  label: string;
  href: string;
  Icono: LucideIcon;
  /** Solo visible para el rol "propietaria" (F18 / PRO-18). */
  soloDuena?: boolean;
}

/** Hasta 4 accesos fijos; "Mi cuenta" va aparte, vía avatar (design.md §4). */
export const NAV: DefinicionNav[] = [
  { id: "hoy", label: "Hoy", href: "/hoy", Icono: Home },
  { id: "clientes", label: "Clientes", href: "/clientes", Icono: Users },
  { id: "ventas", label: "Ventas", href: "/ventas", Icono: TrendingUp },
  { id: "equipo", label: "Equipo", href: "/equipo", Icono: Shield, soloDuena: true },
];

/**
 * Sección activa a partir de la ruta, comparando por **prefijo**: estando en
 * /clientes/abc123 (la ficha) la pestaña Clientes debe seguir marcada.
 */
export function seccionActiva(pathname: string): string | null {
  const item = NAV.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return item?.id ?? null;
}
