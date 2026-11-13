/** "2026-11-13" -> "13/11/26" (padrão BR dd/mm/aa; sem passar por Date, evita problemas de fuso) */
export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(-2)}`;
}

/** "13/11/26" (ou "13/11/2026") -> "2026-11-13"; null se incompleta ou inexistente. */
export function parseBrDate(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const y = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
  const d = new Date(y, Number(mm) - 1, Number(dd));
  if (d.getFullYear() !== y || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null;
  return `${y}-${mm}-${dd}`;
}

/** Máscara enquanto digita: "131126" -> "13/11/26". */
export function maskBrDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].filter(Boolean).join("/");
}

export function todayLocalISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
