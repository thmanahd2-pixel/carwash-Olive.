import React, { useState } from "react";
import { Plus, Trash2, ShieldCheck, Mail } from "lucide-react";
import { C } from "../styles/theme";
import { Panel, Badge, Button, SectionTitle, Modal, Field, inputStyle, PillGroup, EmptyState } from "../components/ui/Primitives";

const ROLE_OPTIONS = [
  { value: "owner", label: "مالك" },
  { value: "admin", label: "مدير عام" },
  { value: "manager", label: "مشرف" },
  { value: "cashier", label: "محاسب" },
  { value: "staff", label: "موظف" },
];
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));
const ROLE_COLOR = { owner: C.violet, admin: C.aqua, manager: C.amber, cashier: C.green, staff: C.textMuted };

function RoleModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ email: "", name: "", role: "staff", notes: "" });
  function submit() {
    if (!form.email && !form.name) return;
    onCreate(form);
    setForm({ email: "", name: "", role: "staff", notes: "" });
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="إضافة صلاحية مستخدم">
      <Field label="البريد الإلكتروني (لتسجيل الدخول)">
        <input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" />
      </Field>
      <Field label="الاسم">
        <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم المستخدم" />
      </Field>
      <Field label="الدور"><PillGroup options={ROLE_OPTIONS} value={form.role} onChange={(v) => setForm({ ...form, role: v })} /></Field>
      <Field label="ملاحظات">
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
      <Button onClick={submit} icon={Plus} className="w-full mt-2">إضافة</Button>
    </Modal>
  );
}

export default function RolesPage({ roles, currentUserRole, onCreate, onUpdate, onDelete }) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!currentUserRole?.isOwnerOrAdmin) {
    return (
      <div>
        <SectionTitle sub="إدارة الأدوار والصلاحيات">الأدوار والصلاحيات</SectionTitle>
        <EmptyState>هذه الصفحة متاحة فقط للمالك أو المدير العام.</EmptyState>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle sub="تحديد من يمكنه الدخول ودوره في النظام (المرحلة الأولى: عرض وإدارة فقط)">الأدوار والصلاحيات</SectionTitle>
        <Button onClick={() => setModalOpen(true)} icon={Plus}>إضافة مستخدم</Button>
      </div>

      {roles.length === 0 ? (
        <EmptyState>لا يوجد مستخدمون مُعرَّفون بعد — كل من يسجل الدخول يُعامل كمالك افتراضيًا.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {roles.map((r) => (
            <Panel key={r.id} style={{ padding: "16px" }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: C.text }}>{r.name || r.email || "—"}</span>
                    <Badge color={ROLE_COLOR[r.role] || C.textMuted} bg={`${ROLE_COLOR[r.role] || C.textMuted}1F`} border={`${ROLE_COLOR[r.role] || C.textMuted}55`}>
                      <ShieldCheck size={11} /> {ROLE_LABEL[r.role] || r.role}
                    </Badge>
                    {!r.active && <Badge color={C.textFaint} bg={C.panel2} border={C.border}>معطّل</Badge>}
                  </div>
                  {r.email && <div className="text-xs mt-1 flex items-center gap-1" style={{ color: C.textMuted }}><Mail size={11} /> {r.email}</div>}
                  {r.notes && <div className="text-xs mt-1" style={{ color: C.textFaint }}>{r.notes}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PillGroup options={ROLE_OPTIONS} value={r.role} onChange={(v) => onUpdate(r.id, { role: v })} />
                  <button onClick={() => onDelete(r.id)} style={{ color: C.red }}><Trash2 size={16} /></button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <RoleModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={onCreate} />
    </div>
  );
}
