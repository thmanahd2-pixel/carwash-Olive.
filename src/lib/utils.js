// Small shared helpers for the new Phase 1 modules (roles, partners, daily
// close, fixed expenses, audit log). App.jsx has its own local copies of the
// equivalents for the existing features — left untouched intentionally.

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function fmtMoney(n) {
  if (n == null || isNaN(n)) return "0";
  return Math.round(n).toLocaleString("ar-EG");
}

export function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

export function download(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
