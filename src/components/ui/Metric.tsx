import { Badge } from "./Badge";
import { Card } from "./Card";

/**
 * KPI: etiqueta + cifra en mono tabular + delta opcional en pill
 * (design.md §8 › KPI / métrica). Lo consumen PRO-16 y PRO-29.
 */
export function Metric({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: { texto: string; tono: "success" | "error" };
}) {
  return (
    <Card className="flex flex-col gap-1.5">
      <span className="text-[13px] text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-3xl font-medium tabular-nums text-text">
          {value}
        </span>
        {delta && (
          <Badge status={delta.tono}>{delta.texto}</Badge>
        )}
      </div>
    </Card>
  );
}
