export function formatCurrency(amount: number, currency = "EUR"): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatDate(iso: string): string {
  if (!iso) return "N/A";
  return iso.slice(0, 10);
}

export function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  );

  const sep = widths.map((w) => "-".repeat(w)).join(" | ");
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join(" | ");
  const dataLines = rows.map((row) =>
    row.map((cell, i) => (cell ?? "").padEnd(widths[i])).join(" | ")
  );

  return [headerLine, sep, ...dataLines].join("\n");
}
