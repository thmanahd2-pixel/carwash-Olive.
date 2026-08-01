import React, { useState, useMemo } from "react";
import { Plus, Trash2, Repeat } from "lucide-react";
import { C } from "../styles/theme";
import { fmtMoney } from "../lib/utils";
import { Panel, Badge, Button, SectionTitle, Modal, Field, inputStyle, PillGroup, StatCard, EmptyState } from "../components/ui/Primitives";

const FREQUENCIES = [
  { value: "monthly", label: "شهري" },
  { value: "weekly", label: "أسبوعي" },
  { value: "yearly", label: "سنوي" },
];
const FREQ_LABEL = Object.fromEntries(FREQUENCIES.map((f) => [f.value, f.label]));
const CATEGORIES = ["إيجار", "رواتب ثابتة", "اشتراكات", "تأمين", "صيانة دورية", "أخرى"];

function monthlyEquivalent(f) {
  const amt = Number(f.amount) || 0;
  if (f.frequency === "weekly") return amt * (52 / 12);
  if (f.frequency === "yearly") return amt / 12;
  return amt;
}

function FixedExpenseModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", category: CATEGORIES[0], amount: "", frequency: "monthly", dueDay: "", notes: "" });
  function submit() {
    if (!form.name || !form.amount) return;
    onCreate(form);
    setForm({ name: "", category: CATEGORIES[0], amount: "", frequency: "monthly", dueDay: "", notes: "" });
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="إضافة مصروف ثابت">
      <Field label="اسم المصروف"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: إيجار المحل" /></Field>
      <Field label="التصنيف"><PillGroup options={CATEGORIES} value={form.category} onChange={(v) => setForm({ ...form, category: v })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="المبلغ"><input type="number" style={inputStyle} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" /></Field>
        <Field label="يوم الاستحقاق (اختياري)"><input type="number" min="1" max="31" style={inputStyle} value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} placeholder="1-31" /></Field>
      </div>
      <Field label="التكرار"><PillGroup options={FREQUENCIES} value={form.frequency} onChange={(v) => setForm({ ...form, frequency: v })} /></Field>
      <Field label="ملاحظات"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      <Button onClick={submit} icon={Plus} className="w-full mt-2">إضافة</Button>
    </Modal>
  );
}

export default function FixedExpensesPage({ fixedExpenses, onCreate, onToggleActive, onDelete }) {
  const [modalOpen, setModalOpen] = useState(false);
  const activeList = useMemo(() => fixedExpenses.filter((f) => f.active !== false), [fixedExpenses]);
  const monthlyTotal = useMemo(() => activeList.reduce((s, f) => s + monthlyEquivalent(f), 0), [activeList]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle sub="مصاريف متكررة كالإيجار والرواتب — منفصلة عن المصروفات اليومية">المصروفات الثابتة</SectionTitle>
        <Button onClick={() => setModalOpen(true)} icon={Plus}>إضافة مصروف ثابت</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard label="الإجمالي الشهري المقدّر" value={fmtMoney(monthlyTotal)} icon={Repeat} accent={C.amber} />
        <StatCard label="عدد المصاريف الفعّالة" value={activeList.length} icon={Repeat} />
      </div>

      {fixedExpenses.length === 0 ? (
        <EmptyState>لا توجد مصاريف ثابتة مضافة بعد.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {fixedExpenses.map((f) => (
            <Panel key={f.id} style={{ padding: "16px" }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: C.text }}>{f.name}</span>
                    <Badge>{f.category}</Badge>
                    <Badge color={C.amber} bg={C.amberSoft} border="rgba(240,168,60,0.35)">{FREQ_LABEL[f.frequency] || f.frequency}</Badge>
                    {!f.active && <Badge color={C.textFaint} bg={C.panel2} border={C.border}>معطّل</Badge>}
                  </div>
                  <div className="text-xs mt-1" style={{ color: C.textMuted }}>
                    {fmtMoney(f.amount)} / {FREQ_LABEL[f.frequency] || f.frequency}
                    {f.dueDay ? ` — الاستحقاق يوم ${f.dueDay}` : ""}
                  </div>
                  {f.notes && <div className="text-xs mt-1" style={{ color: C.textFaint }}>{f.notes}</div>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => onToggleActive(f.id)} className="text-xs font-medium" style={{ color: f.active ? C.amber : C.green }}>
                    {f.active ? "تعطيل" : "تفعيل"}
                  </button>
                  <button onClick={() => onDelete(f.id)} style={{ color: C.red }}><Trash2 size={16} /></button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <FixedExpenseModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={onCreate} />
    </div>
  );
}
