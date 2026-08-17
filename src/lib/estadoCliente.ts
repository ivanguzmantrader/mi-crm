import type { EstadoBadge } from "@/components/ui/Badge";
import type { Doc } from "../../convex/_generated/dataModel";

export type EstadoCliente = Doc<"clientes">["estado"];

/**
 * Presentación del Estado del cliente (design.md §8 › Badge).
 *
 * ANDAMIAJE(PRO-17): el estado se lee de la tabla, no se deriva de las ventas.
 *
 * El seed ya lo deja coherente con la precedencia correcta, para que ese cambio
 * no mueva ningún badge cuando llegue.
 */
export const ESTADO_CLIENTE: Record<
  EstadoCliente,
  { label: string; status: EstadoBadge }
> = {
  nuevo_lead: { label: "Nuevo lead", status: "info" },
  en_negociacion: { label: "En negociación", status: "primary" },
  ganado: { label: "Ganado", status: "success" },
  perdido: { label: "Perdido", status: "error" },
};
