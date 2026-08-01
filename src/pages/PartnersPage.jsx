import React, { useState, useMemo } from "react";
import { Plus, Trash2, Users2, AlertTriangle } from "lucide-react";
import { C } from "../styles/theme";
import { fmtMoney } from "../lib/utils";
import { Panel, Badge, Button, SectionTitle, Modal, Field, inputStyle, StatCard, EmptyState } from "../components/ui/Primitives";

function PartnerModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", phone: "", sharePercentage: "", notes: "" });
  function submit() {
    if (!form.name) return;
    onCreate(form);
    setForm({ name: "", phone: "", sharePercentage: "", notes: "" });
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="إضافة شريك">
      <Field label="اسم الشريك"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الشريك" /></Field>
      <Field label="رقم الهاتف"><input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07xxxxxxxx" /></Field>
      <Field label="نسبة الشراكة %"><input type="number" style={inputStyle} value={form.sharePercentage} onChange={(e) => setForm({ ...form, sharePercentage: e.target.value })} placeholder="0" /></Field>
      <Field label="ملاحظات"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      <Button onClick={submit} icon={Plus} className="w-full mt-2">إضافة الشريك</Button>
    </Modal>
  );
}

export default function PartnersPage({ partners, netProfit = 0, onCreate, onUpdate, onDelete }) {
  const [modalOpen, setModalOpen] = useState(false);
  const activePartners = useMemo(() => partners.filter((p) => p.active !== false), [partners]);
  const totalShare = useMemo(() => activePartners.reduce((s, p) => s + (Number(p.sharePercentage) || 0), 0), [activePartners]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle sub="الشركاء ونسبهم من الأرباح">الشركاء</SectionTitle>
        <Button onClick={() => setModalOpen(true)} icon={Plus}>إضافة شريك</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <StatCard label="صافي الربح الحالي" value={fmtMoney(netProfit)} icon={Users2} />
        <StatCard label="عدد الشركاء" value={activePartners.length} icon={Users2} />
        <StatCard label="إجمالي النسب" value={`${totalShare}%`} icon={Users2} accent={totalShare > 100 ? C.red : totalShare === 100 ? C.green : C.amber} />
      </div>

      {totalShare > 100 && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: C.redSoft, color: C.red, border: `1px solid rgba(241,106,106,0.35)` }}>
          <AlertTriangle size={14} /> مجموع نسب الشراكة يتجاوز 100% — يرجى تعديل النسب.
        </div>
      )}

      {partners.length === 0 ? (
        <EmptyState>لا يوجد شركاء مضافون بعد.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {partners.map((p) => {
            const share = Number(p.sharePercentage) || 0;
            const amount = Math.max(0, netProfit) * (share / 100);
            return (
              <Panel key={p.id} style={{ padding: "16px" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: C.text }}>{p.name}</span>
                      <Badge>{share}%</Badge>
                      {!p.active && <Badge color={C.textFaint} bg={C.panel2} border={C.border}>معطّل</Badge>}
                    </div>
                    {p.phone && <div className="text-xs mt-1" style={{ color: C.textMuted }}>{p.phone}</div>}
                    <div className="text-xs mt-1" style={{ color: C.textFaint }}>حصته التقديرية من الربح الحالي: {fmtMoney(amount)}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => onUpdate(p.id, { active: !p.active })} className="text-xs font-medium" style={{ color: p.active ? C.amber : C.green }}>
                      {p.active ? "تعطيل" : "تفعيل"}
                    </button>
                    <button onClick={() => onDelete(p.id)} style={{ color: C.red }}><Trash2 size={16} /></button>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <PartnerModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={onCreate} />
    </div>
  );
}
