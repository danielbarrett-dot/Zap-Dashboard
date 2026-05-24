import type { PropsWithChildren, ReactNode } from "react";

type PanelProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}>;

export function Panel({ title, eyebrow, actions, children }: PanelProps) {
  return (
    <section className="rounded-lg border border-white/80 bg-white/90 p-6 shadow-panel backdrop-blur">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal">{eyebrow}</p>
          ) : null}
          <h2 className="mt-2 text-xl font-semibold text-ink">{title}</h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
