import React, { useState, useMemo } from "react";
import { History, Search } from "lucide-react";
import { C } from "../styles/theme";
import { fmtDateTime } from "../lib/utils";
import { Panel, Badge, SectionTitle, inputStyle, EmptyState } from "../components/ui/Primitives";

const ACTION_COLOR = (action = "") => {
  if (action.endsWith(".delete")) return C.red;
  if (action.endsWith(".create")) return C.green;
  if (action.endsWith(".update") || action.endsWith(".toggleActive")) return C.amber;
  return C.aqua;
};

export default function AuditLogPage({ auditLog }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...auditLog].sort((a, b) => new Date(b.at) - new Date(a.at));
    if (!q) return sorted;
    return sorted.filter((e) =>
      (e.action || "").toLowerCase().includes(q) ||
      (e.actorEmail || "").toLowerCase().includes(q) ||
      (e.entityType || "").toLowerCase().includes(q)
    );
  }, [auditLog, query]);

  return (
    <div>
      <SectionTitle sub="سجل غير قابل للتعديل أو الحذف — من فعل ماذا ومتى">سجل التدقيق</SectionTitle>

      <div className="relative mb-4">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 end-3" style={{ color: C.textFaint }} />
        <input style={{ ...inputStyle, paddingInlineEnd: 36 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث بالإجراء أو البريد الإلكتروني..." />
      </div>

      {filtered.length === 0 ? (
        <EmptyState>لا توجد سجلات مطابقة.</EmptyState>
      ) : (
        <div className="grid gap-2">
          {filtered.slice(0, 300).map((e) => (
            <Panel key={e.id} style={{ padding: "12px 16px" }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <History size={14} style={{ color: C.textFaint }} className="shrink-0" />
                  <Badge color={ACTION_COLOR(e.action)} bg={`${ACTION_COLOR(e.action)}1F`} border={`${ACTION_COLOR(e.action)}55`}>{e.action}</Badge>
                  {e.entityType && <span className="text-xs" style={{ color: C.textFaint }}>{e.entityType}</span>}
                  <span className="text-xs truncate" style={{ color: C.textMuted }}>{e.actorEmail || "—"}</span>
                </div>
                <span className="text-xs shrink-0" style={{ color: C.textFaint }}>{fmtDateTime(e.at)}</span>
              </div>
            </Panel>
          ))}
          {filtered.length > 300 && (
            <div className="text-xs text-center mt-2" style={{ color: C.textFaint }}>يتم عرض أحدث 300 سجل فقط.</div>
          )}
        </div>
      )}
    </div>
  );
}
