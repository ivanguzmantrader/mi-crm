import type { ReactNode } from "react";

/** Icono en cuadro + título + una línea de ayuda + CTA (design.md §8, PRO-52). */
export function EmptyState({
  icon,
  title,
  help,
  action,
}: {
  icon: ReactNode;
  title: string;
  help?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-surface-2 text-text-muted">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-text">{title}</p>
        {help && <p className="text-[13px] text-text-muted">{help}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
