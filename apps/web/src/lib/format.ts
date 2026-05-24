export const formatCurrency = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "Restricted"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0
      }).format(value);

export const formatHours = (value: number | null | undefined) =>
  value === null || value === undefined ? "Restricted" : `${value.toFixed(1)}h`;

export const formatDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(new Date(value))
    : "—";

export const formatPercent = (value: number | null | undefined) =>
  value === null || value === undefined ? "Restricted" : `${value.toFixed(1)}%`;
