import type { ReactNode } from "react";

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-stroke-subtle px-5 py-4">
      <h3 className="mb-3 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">{title}</h3>
      {children}
    </section>
  );
}

export function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}
