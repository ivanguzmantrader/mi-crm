import { cn } from "@/lib/cn";

/** Bloque de carga con pulse (design.md §8 › Estados de carga y vacío). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block rounded-md bg-surface-2", className)}
      style={{ animation: "vibe-pulse 1.4s var(--ease-standard) infinite" }}
    />
  );
}
