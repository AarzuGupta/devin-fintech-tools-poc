import type { ReactNode } from "react";

export function PageHeader({ title, description, meta }: { title: string; description?: string; meta?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 px-6 pt-5 pb-4">
      <div>
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.015em] text-fg">{title}</h1>
        {description && <p className="mt-1 text-fg-muted">{description}</p>}
      </div>
      {meta && <div className="text-fg-muted">{meta}</div>}
    </div>
  );
}
