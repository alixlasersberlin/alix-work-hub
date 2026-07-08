export function formatKpi(value: number | string, format?: string, unit?: string): string {
  if (typeof value === "string") return value + (unit ? ` ${unit}` : "");
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
    case "percent":
      return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
    case "duration":
      return `${value} h`;
    default:
      return `${value.toLocaleString("de-DE")}${unit ? ` ${unit}` : ""}`;
  }
}
