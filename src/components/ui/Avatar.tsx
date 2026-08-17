import { cn } from "@/lib/cn";

/**
 * Avatar de iniciales — la interfaz es data-first, sin fotos (design.md §7).
 * `variant="neutral"` se usa para personas secundarias (p. ej. el responsable
 * de un seguimiento), para que no compitan con el avatar del cliente.
 */
export function Avatar({
  name,
  size = 40,
  variant = "primary",
  className,
}: {
  name: string;
  size?: number;
  variant?: "primary" | "neutral";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      title={name || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        variant === "primary"
          ? "bg-primary-subtle text-primary"
          : "bg-surface-2 text-text-muted",
        className,
      )}
      style={{
        width: size,
        height: size,
        // 14px a 40px de diámetro, escalado para el resto de tamaños.
        fontSize: Math.max(10, Math.round(size * 0.35)),
      }}
    >
      {iniciales(name)}
    </span>
  );
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
