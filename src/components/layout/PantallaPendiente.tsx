import { Construction } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Destino de navegación aún sin construir. Existe para que la barra de
 * navegación (PRO-18) se pueda usar y validar de verdad antes de que estén
 * todas las pantallas.
 *
 * Cada pantalla que lo usa lleva su propio marcador ANDAMIAJE con la issue que
 * la construye, así que el inventario las lista una a una.
 */
export function PantallaPendiente({
  titulo,
  issue,
  descripcion,
}: {
  titulo: string;
  issue: string;
  descripcion: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-text">{titulo}</h1>
      <Card padding={false}>
        <EmptyState
          icon={<Construction size={24} strokeWidth={1.5} />}
          title={`Esta pantalla se construye en ${issue}`}
          help={descripcion}
        />
      </Card>
    </div>
  );
}
