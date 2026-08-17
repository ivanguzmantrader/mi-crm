import type { EstadoBadge } from "@/components/ui/Badge";
import type { Doc } from "../../convex/_generated/dataModel";

export type EstadoCliente = Doc<"clientes">["estado"];

/**
 * Presentación del Estado del cliente (design.md §8 › Badge).
 *
 * El valor **se lee**, no se calcula: derivarlo de las ventas es PRO-17. El
 * seed ya lo deja coherente para que ese cambio no mueva ningún badge.
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
