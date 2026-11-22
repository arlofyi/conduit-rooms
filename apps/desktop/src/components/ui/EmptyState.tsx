import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}

/** Fills an empty panel: one short title, one plain sentence (Conduit's .empty-state). */
export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex h-full animate-fade-in flex-col items-center justify-center gap-3 px-6 text-center">
      {icon && <div className="text-accent">{icon}</div>}
      {title && <h2 className="text-heading font-medium text-bright">{title}</h2>}
      <p className="max-w-80 select-text text-title text-mid">{children}</p>
      {action}
    </div>
  );
}
