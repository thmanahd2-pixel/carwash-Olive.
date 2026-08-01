import { supabase, isSupabaseConfigured } from "./supabaseClient";
import {
  idbGetAll, idbBulkPut, idbGet, idbPut,
  idbGetPhotosForCar, idbPutPhotos, idbDeletePhotos, idbGetAllPhotos,
  enqueueSync, getQueue, removeFromQueue,
  getMeta, setMeta, idbDumpAll, idbRestoreAll
} from "./db";

/* =========================================================================
   Field mapping between the app's camelCase shape and Supabase's snake_case
   ========================================================================= */

const toDbCar = (c) => ({
  id: c.id,
  car_number: c.carNumber ?? null,
  customer_name: c.customerName ?? null,
  customer_phone: c.customerPhone ?? null,
  car_type: c.carType ?? null,
  car_size: c.carSize ?? null,
  dirt_level: c.dirtLevel ?? null,
  notes: c.notes ?? null,
  service_type: c.serviceType ?? null,
  employee_ids: c.employeeIds ?? [],
  price: Number(c.price) || 0,
  discount: Number(c.discount) || 0,
  payment_method: c.paymentMethod ?? null,
  paid: Boolean(c.paid),
  timestamps: c.timestamps ?? {},
  quality: c.quality ?? {},
  created_at: c.createdAt ?? new Date().toISOString(),
  deleted: Boolean(c.deleted)
});
const fromDbCar = (r) => ({
  id: r.id, carNumber: r.car_number, customerName: r.customer_name, customerPhone: r.customer_phone,
  carType: r.car_type, carSize: r.car_size, dirtLevel: r.dirt_level, notes: r.notes,
  serviceType: r.service_type, employeeIds: r.employee_ids || [], price: r.price, discount: r.discount,
  paymentMethod: r.payment_method, paid: r.paid, timestamps: r.timestamps || {}, quality: r.quality || {},
  createdAt: r.created_at, updatedAt: r.updated_at, deleted: r.deleted
});

const toDbEmployee = (e) => ({
  id: e.id, name: e.name, phone: e.phone ?? null, position: e.position ?? null,
  active: Boolean(e.active), deleted: Boolean(e.deleted)
});
const fromDbEmployee = (r) => ({
  id: r.id, name: r.name, phone: r.phone, position: r.position, active: r.active,
  updatedAt: r.updated_at, deleted: r.deleted
});

const toDbExpense = (x) => ({
  id: x.id, date: x.date ?? null, time: x.time ?? null, category: x.category ?? null,
  amount: Number(x.amount) || 0, description: x.description ?? null,
  receipt_url: x.receiptUrl ?? null, deleted: Boolean(x.deleted)
});
const fromDbExpense = (r) => ({
  id: r.id, date: r.date, time: r.time, category: r.category, amount: r.amount,
  description: r.description, receiptUrl: r.receipt_url, updatedAt: r.updated_at, deleted: r.deleted
});

/* ---- Phase 1 extension tables: roles, partners, dailyClose, fixedExpenses, auditLog ---- */

const toDbRole = (x) => ({
  id: x.id, email: x.email ?? null, name: x.name ?? null, role: x.role ?? "staff",
  permissions: x.permissions ?? [], active: x.active !== false, notes: x.notes ?? null,
  deleted: Boolean(x.deleted)
});
const fromDbRole = (r) => ({
  id: r.id, email: r.email, name: r.name, role: r.role, permissions: r.permissions || [],
  active: r.active, notes: r.notes, updatedAt: r.updated_at, deleted: r.deleted
});

const toDbPartner = (x) => ({
  id: x.id, name: x.name ?? null, phone: x.phone ?? null,
  share_percentage: Number(x.sharePercentage) || 0, active: x.active !== false,
  notes: x.notes ?? null, deleted: Boolean(x.deleted)
});
const fromDbPartner = (r) => ({
  id: r.id, name: r.name, phone: r.phone, sharePercentage: r.share_percentage,
  active: r.active, notes: r.notes, updatedAt: r.updated_at, deleted: r.deleted
});

const toDbDailyClose = (x) => ({
  id: x.id, date: x.date ?? null, opening_cash: Number(x.openingCash) || 0,
  expected_cash: Number(x.expectedCash) || 0, counted_cash: Number(x.countedCash) || 0,
  difference: Number(x.difference) || 0, total_revenue: Number(x.totalRevenue) || 0,
  total_expenses: Number(x.totalExpenses) || 0, cash_by_method: x.cashByMethod ?? {},
  closed_by: x.closedBy ?? null, notes: x.notes ?? null, status: x.status ?? "closed",
  deleted: Boolean(x.deleted)
});
const fromDbDailyClose = (r) => ({
  id: r.id, date: r.date, openingCash: r.opening_cash, expectedCash: r.expected_cash,
  countedCash: r.counted_cash, difference: r.difference, totalRevenue: r.total_revenue,
  totalExpenses: r.total_expenses, cashByMethod: r.cash_by_method || {}, closedBy: r.closed_by,
  notes: r.notes, status: r.status, updatedAt: r.updated_at, deleted: r.deleted
});

const toDbFixedExpense = (x) => ({
  id: x.id, name: x.name ?? null, category: x.category ?? null,
  amount: Number(x.amount) || 0, frequency: x.frequency ?? "monthly",
  due_day: x.dueDay != null ? Number(x.dueDay) : null, active: x.active !== false,
  notes: x.notes ?? null, deleted: Boolean(x.deleted)
});
const fromDbFixedExpense = (r) => ({
  id: r.id, name: r.name, category: r.category, amount: r.amount, frequency: r.frequency,
  dueDay: r.due_day, active: r.active, notes: r.notes, updatedAt: r.updated_at, deleted: r.deleted
});

const toDbAuditLog = (x) => ({
  id: x.id, at: x.at ?? new Date().toISOString(), actor_email: x.actorEmail ?? null,
  action: x.action ?? null, entity_type: x.entityType ?? null, entity_id: x.entityId ?? null,
  details: x.details ?? {}
});
const fromDbAuditLog = (r) => ({
  id: r.id, at: r.at, actorEmail: r.actor_email, action: r.action,
  entityType: r.entity_type, entityId: r.entity_id, details: r.details || {}
});

const EXT_TABLES = {
  roles: { toDb: toDbRole, fromDb: fromDbRole },
  partners: { toDb: toDbPartner, fromDb: fromDbPartner },
  dailyClose: { toDb: toDbDailyClose, fromDb: fromDbDailyClose },
  fixedExpenses: { toDb: toDbFixedExpense, fromDb: fromDbFixedExpense }
};
// Supabase table names differ (snake_case) from the local store keys above.
const EXT_REMOTE_TABLE = { roles: "roles", partners: "partners", dailyClose: "daily_close", fixedExpenses: "fixed_expenses" };

/* =========================================================================
   Connectivity
   ========================================================================= */

export function isOnline() { return typeof navigator === "undefined" ? true : navigator.onLine; }

export function onConnectivityChange(cb) {
  const on = () => cb(true);
  const off = () => cb(false);
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
}

async function hasSession() {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data?.session);
}

/* =========================================================================
   Initial load: IndexedDB first (instant, offline-safe), then merge remote
   ========================================================================= */

export async function loadInitialState() {
  const [cars, employees, expenses, settingsRows] = await Promise.all([
    idbGetAll("cars"), idbGetAll("employees"), idbGetAll("expenses"), idbGetAll("settings")
  ]);
  const settings = settingsRows[0] || { id: "default", targets: { small: 35, medium: 40, large: 50 } };

  const photosMap = {};
  (await idbGetAllPhotos()).forEach((p) => { photosMap[p.carId] = { before: p.before, after: p.after }; });

  let state = { cars, employees, expenses, settings, photosMap };

  if (isSupabaseConfigured && isOnline() && (await hasSession())) {
    try { state = await pullAndMerge(state); } catch (e) { console.warn("Initial cloud sync skipped:", e.message); }
  }
  return state;
}

/* Remote is merged in by "latest updated_at wins" per record id; nothing is
   ever dropped — a record only disappears from the visible list if its
   `deleted` flag is true (soft delete), never through data simply going missing. */
async function pullAndMerge(state) {
  const [carsRes, empRes, expRes, setRes] = await Promise.all([
    supabase.from("cars").select("*"),
    supabase.from("employees").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("settings").select("*").eq("id", "default").maybeSingle()
  ]);

  const merge = (local, remoteRows, fromDb) => {
    const byId = new Map(local.map((r) => [r.id, r]));
    (remoteRows || []).forEach((row) => {
      const mapped = fromDb(row);
      const existing = byId.get(mapped.id);
      if (!existing || !existing.updatedAt || new Date(mapped.updatedAt) >= new Date(existing.updatedAt)) {
        byId.set(mapped.id, mapped);
      }
    });
    return Array.from(byId.values()).filter((r) => !r.deleted);
  };

  const cars = carsRes.error ? state.cars : merge(state.cars, carsRes.data, fromDbCar);
  const employees = empRes.error ? state.employees : merge(state.employees, empRes.data, fromDbEmployee);
  const expenses = expRes.error ? state.expenses : merge(state.expenses, expRes.data, fromDbExpense);
  const settings = !setRes.error && setRes.data ? { id: "default", targets: setRes.data.targets } : state.settings;

  await Promise.all([
    idbBulkPut("cars", cars), idbBulkPut("employees", employees),
    idbBulkPut("expenses", expenses), idbPut("settings", settings)
  ]);
  await setMeta("lastSync", new Date().toISOString());

  return { ...state, cars, employees, expenses, settings };
}

/* =========================================================================
   Phase 1 extension tables: roles, partners, dailyClose, fixedExpenses.
   Loaded/persisted independently from the core tables above so the existing
   core load/persist/merge logic is never touched.
   ========================================================================= */

export async function loadExtendedState() {
  const [roles, partners, dailyClose, fixedExpenses, auditLog] = await Promise.all([
    idbGetAll("roles"), idbGetAll("partners"), idbGetAll("dailyClose"),
    idbGetAll("fixedExpenses"), idbGetAll("auditLog")
  ]);
  let state = { roles, partners, dailyClose, fixedExpenses, auditLog };
  if (isSupabaseConfigured && isOnline() && (await hasSession())) {
    try { state = await pullAndMergeExtended(state); } catch (e) { console.warn("Extended cloud sync skipped:", e.message); }
  }
  return state;
}

async function pullAndMergeExtended(state) {
  const keys = Object.keys(EXT_TABLES);
  const results = await Promise.all(
    keys.map((k) => supabase.from(EXT_REMOTE_TABLE[k]).select("*"))
  );

  const merge = (local, remoteRows, fromDb) => {
    const byId = new Map(local.map((r) => [r.id, r]));
    (remoteRows || []).forEach((row) => {
      const mapped = fromDb(row);
      const existing = byId.get(mapped.id);
      if (!existing || !existing.updatedAt || new Date(mapped.updatedAt) >= new Date(existing.updatedAt)) {
        byId.set(mapped.id, mapped);
      }
    });
    return Array.from(byId.values()).filter((r) => !r.deleted);
  };

  const next = { ...state };
  keys.forEach((k, i) => {
    const res = results[i];
    next[k] = res.error ? state[k] : merge(state[k], res.data, EXT_TABLES[k].fromDb);
  });

  // audit log is append-only: pull remote entries and union by id, newest first, no merge-by-updatedAt needed
  const auditRes = await supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(500);
  if (!auditRes.error) {
    const byId = new Map(state.auditLog.map((r) => [r.id, r]));
    (auditRes.data || []).forEach((row) => byId.set(row.id, fromDbAuditLog(row)));
    next.auditLog = Array.from(byId.values()).sort((a, b) => new Date(b.at) - new Date(a.at));
  }

  await Promise.all([
    ...keys.map((k) => idbBulkPut(k, next[k])),
    idbBulkPut("auditLog", next.auditLog)
  ]);
  return next;
}

export async function persistExtended({ roles, partners, dailyClose, fixedExpenses }) {
  await Promise.all([
    idbBulkPut("roles", roles), idbBulkPut("partners", partners),
    idbBulkPut("dailyClose", dailyClose), idbBulkPut("fixedExpenses", fixedExpenses)
  ]);
  pushExtendedToCloud({ roles, partners, dailyClose, fixedExpenses }).catch((e) => console.warn("Cloud push deferred:", e.message));
}

export async function pushExtendedToCloud({ roles, partners, dailyClose, fixedExpenses }) {
  if (!isSupabaseConfigured || !isOnline() || !(await hasSession())) return { skipped: true };
  const data = { roles, partners, dailyClose, fixedExpenses };
  const keys = Object.keys(EXT_TABLES);
  const results = await Promise.all(
    keys.map((k) => (data[k]?.length ? supabase.from(EXT_REMOTE_TABLE[k]).upsert(data[k].map(EXT_TABLES[k].toDb)) : Promise.resolve({})))
  );
  const errors = results.map((r) => r?.error).filter(Boolean);
  if (errors.length) throw new Error(errors.map((e) => e.message).join("; "));
  return { ok: true };
}

/* Soft delete for any of the extension tables (roles / partners / dailyClose / fixedExpenses). */
export async function softDeleteExtendedRecord(table, id, currentRecord) {
  const tombstoned = { ...currentRecord, id, deleted: true };
  await idbPut(table, tombstoned);
  const { toDb } = EXT_TABLES[table];
  if (isSupabaseConfigured && isOnline() && (await hasSession())) {
    try { await supabase.from(EXT_REMOTE_TABLE[table]).upsert(toDb(tombstoned)); return; } catch (e) { /* fall through to queue */ }
  }
  await enqueueSync({ table: EXT_REMOTE_TABLE[table], op: "upsert", record: toDb(tombstoned) });
}

/* =========================================================================
   Audit log — append-only. Every entry lands in IndexedDB immediately and
   is pushed to the cloud in the background (never blocks the UI, never
   edited or deleted afterwards).
   ========================================================================= */

export async function appendAuditLog({ actorEmail, action, entityType, entityId, details }) {
  const entry = {
    id: (Math.random().toString(36).slice(2, 10) + Date.now().toString(36)),
    at: new Date().toISOString(),
    actorEmail: actorEmail ?? null,
    action, entityType: entityType ?? null, entityId: entityId ?? null,
    details: details ?? {}
  };
  await idbPut("auditLog", entry);
  if (isSupabaseConfigured && isOnline() && (await hasSession())) {
    try { await supabase.from("audit_log").insert(toDbAuditLog(entry)); return entry; } catch (e) { /* fall through to queue */ }
  }
  await enqueueSync({ table: "audit_log", op: "upsert", record: toDbAuditLog(entry) });
  return entry;
}

/* =========================================================================
   Persist core arrays: IndexedDB write is synchronous-to-the-caller and
   always succeeds locally; the cloud push is best-effort and never blocks
   or throws back into the UI.
   ========================================================================= */

export async function persistCore({ cars, employees, expenses, settings }) {
  await Promise.all([
    idbBulkPut("cars", cars), idbBulkPut("employees", employees),
    idbBulkPut("expenses", expenses), idbPut("settings", settings)
  ]);
  pushCoreToCloud({ cars, employees, expenses, settings }).catch((e) => console.warn("Cloud push deferred:", e.message));
}

export async function pushCoreToCloud({ cars, employees, expenses, settings }) {
  if (!isSupabaseConfigured || !isOnline() || !(await hasSession())) return { skipped: true };
  const [r1, r2, r3, r4] = await Promise.all([
    cars.length ? supabase.from("cars").upsert(cars.map(toDbCar)) : Promise.resolve({}),
    employees.length ? supabase.from("employees").upsert(employees.map(toDbEmployee)) : Promise.resolve({}),
    expenses.length ? supabase.from("expenses").upsert(expenses.map(toDbExpense)) : Promise.resolve({}),
    supabase.from("settings").upsert({ id: "default", targets: settings.targets })
  ]);
  await setMeta("lastSync", new Date().toISOString());
  const errors = [r1, r2, r3, r4].map((r) => r?.error).filter(Boolean);
  if (errors.length) throw new Error(errors.map((e) => e.message).join("; "));
  return { ok: true };
}

/* Soft delete: record is tagged deleted=true and pushed (or queued) — the row
   itself is NEVER removed from IndexedDB or Supabase, only hidden from the UI. */
export async function softDeleteRecord(table, id, currentRecord) {
  const tombstoned = { ...currentRecord, id, deleted: true };
  await idbPut(table, tombstoned);
  const toDb = table === "cars" ? toDbCar : table === "employees" ? toDbEmployee : toDbExpense;
  if (isSupabaseConfigured && isOnline() && (await hasSession())) {
    try { await supabase.from(table).upsert(toDb(tombstoned)); return; } catch (e) { /* fall through to queue */ }
  }
  await enqueueSync({ table, op: "upsert", record: toDb(tombstoned) });
}

/* =========================================================================
   Photos — local base64 is the always-available copy; cloud upload is a
   redundant permanent backup that never blocks the UI.
   ========================================================================= */

export async function getPhotosLocal(carId) {
  const rec = await idbGetPhotosForCar(carId);
  return rec ? { before: rec.before, after: rec.after } : undefined;
}

export async function savePhotosLocal(carId, photos) {
  await idbPutPhotos(carId, photos);
  uploadPhotosBackup(carId, photos).catch((e) => console.warn("Photo cloud backup deferred:", e.message));
}

export async function deletePhotosLocal(carId) {
  await idbDeletePhotos(carId);
}

async function uploadPhotosBackup(carId, photos) {
  if (!isSupabaseConfigured || !isOnline() || !(await hasSession())) {
    await enqueueSync({ table: "car_photos", op: "upload", record: { carId } });
    return;
  }
  for (const kind of ["before", "after"]) {
    const list = photos?.[kind] || [];
    for (let i = 0; i < list.length; i++) {
      const dataUrl = list[i];
      if (!dataUrl?.startsWith?.("data:")) continue; // already backed up / not a fresh base64
      const path = `${carId}/${kind}/${i}-${Date.now()}.jpg`;
      const blob = await (await fetch(dataUrl)).blob();
      const { error } = await supabase.storage.from("car-photos").upload(path, blob, {
        contentType: "image/jpeg", upsert: true
      });
      if (!error) {
        await supabase.from("car_photos").insert({ car_id: carId, kind, storage_path: path });
      }
    }
  }
}

/* =========================================================================
   Sync queue processing — runs on reconnect
   ========================================================================= */

export async function flushQueue() {
  if (!isSupabaseConfigured || !isOnline() || !(await hasSession())) return { flushed: 0 };
  const queue = await getQueue();
  let flushed = 0;
  for (const item of queue) {
    try {
      if (item.op === "upsert") {
        const { error } = await supabase.from(item.table).upsert(item.record);
        if (error) continue;
      } else if (item.op === "upload") {
        const photos = await getPhotosLocal(item.record.carId);
        if (photos) await uploadPhotosBackup(item.record.carId, photos);
      }
      await removeFromQueue(item.qid);
      flushed++;
    } catch (e) { /* leave in queue, retry next time */ }
  }
  return { flushed };
}

export async function getPendingCount() {
  return (await getQueue()).length;
}

export async function getLastSync() {
  return getMeta("lastSync");
}

/* =========================================================================
   Full backup (export / import / restore) — used by SettingsPage
   ========================================================================= */

export async function exportFullBackup() {
  return idbDumpAll();
}

export async function importFullBackup(data) {
  await idbRestoreAll(data);
  const [cars, employees, expenses, settingsRows, roles, partners, dailyClose, fixedExpenses, auditLog] = await Promise.all([
    idbGetAll("cars"), idbGetAll("employees"), idbGetAll("expenses"), idbGetAll("settings"),
    idbGetAll("roles"), idbGetAll("partners"), idbGetAll("dailyClose"), idbGetAll("fixedExpenses"), idbGetAll("auditLog")
  ]);
  const photosMap = {};
  (await idbGetAllPhotos()).forEach((p) => { photosMap[p.carId] = { before: p.before, after: p.after }; });
  await pushCoreToCloud({ cars, employees, expenses, settings: settingsRows[0] }).catch(() => {});
  await pushExtendedToCloud({ roles, partners, dailyClose, fixedExpenses }).catch(() => {});
  return { cars, employees, expenses, settings: settingsRows[0], photosMap, roles, partners, dailyClose, fixedExpenses, auditLog };
}
