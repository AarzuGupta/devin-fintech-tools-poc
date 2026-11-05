import type { ReactNode } from "react";

export function PageHeader({ title, description, meta }: { title: string; description?: string; meta?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 px-6 pt-4 pb-3">
      <div>
        <h1 className="text-xl font-semibold text-fg">{title}</h1>
        {description && <p className="mt-0.5 text-fg-muted">{description}</p>}
      </div>
      {meta && <div className="text-fg-muted">{meta}</div>}
    </div>
  );
}
