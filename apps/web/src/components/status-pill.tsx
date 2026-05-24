import clsx from "clsx";

const statusTone = (value: string) => {
  const status = value.toLowerCase();

  if (status.includes("quote")) {
    return "bg-amber/15 text-amber-700";
  }

  if (status.includes("outstanding") || status.includes("partial") || status.includes("review") || status.includes("failed") || status.includes("duplicate")) {
    return "bg-coral/10 text-coral";
  }

  if (status.includes("paid") || status.includes("completed") || status.includes("approved") || status.includes("matched") || status.includes("assigned") || status.includes("connected")) {
    return "bg-pine/10 text-pine";
  }

  return "bg-slate-100 text-slate-700";
};

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
        statusTone(value)
      )}
    >
      {value}
    </span>
  );
}
