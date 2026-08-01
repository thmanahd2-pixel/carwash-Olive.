import { openDB } from "idb";

const DB_NAME = "carwash-pro-db";
// v2: adds roles, partners, dailyClose, auditLog, fixedExpenses (Phase 1 extension)
const DB_VERSION = 2;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("cars")) db.createObjectStore("cars", { keyPath: "id" });
        if (!db.objectStoreNames.contains("employees")) db.createObjectStore("employees", { keyPath: "id" });
        if (!db.objectStoreNames.contains("expenses")) db.createObjectStore("expenses", { keyPath: "id" });
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
        if (!db.objectStoreNames.contains("photos")) {
          // One record per car: { carId, before: [dataUrl...], after: [dataUrl...] }
          db.createObjectStore("photos", { keyPath: "carId" });
        }
        if (!db.objectStoreNames.contains("syncQueue")) {
          db.createObjectStore("syncQueue", { keyPath: "qid", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
        // ---- Phase 1 extension stores ----
        if (!db.objectStoreNames.contains("roles")) db.createObjectStore("roles", { keyPath: "id" });
        if (!db.objectStoreNames.contains("partners")) db.createObjectStore("partners", { keyPath: "id" });
        if (!db.objectStoreNames.contains("dailyClose")) db.createObjectStore("dailyClose", { keyPath: "id" });
        if (!db.objectStoreNames.contains("fixedExpenses")) db.createObjectStore("fixedExpenses", { keyPath: "id" });
        if (!db.objectStoreNames.contains("auditLog")) db.createObjectStore("auditLog", { keyPath: "id" });
      }
    });
  }
  return dbPromise;
}

/* ---------- generic record stores (cars / employees / expenses / settings) ---------- */

export async function idbGetAll(store) {
  const db = await getDB();
  const all = await db.getAll(store);
  return all.filter((r) => !r.deleted);
}

export async function idbPut(store, record) {
  const db = await getDB();
  await db.put(store, record);
}

export async function idbBulkPut(store, records) {
  const db = await getDB();
  const tx = db.transaction(store, "readwrite");
  await Promise.all(records.map((r) => tx.store.put(r)));
  await tx.done;
}

export async function idbGet(store, id) {
  const db = await getDB();
  return db.get(store, id);
}

/* ---------- photos (one record per car: { carId, before: [], after: [] }) ---------- */

export async function idbGetPhotosForCar(carId) {
  const db = await getDB();
  return db.get("photos", carId);
}

export async function idbPutPhotos(carId, photos) {
  const db = await getDB();
  await db.put("photos", { carId, before: photos?.before || [], after: photos?.after || [] });
}

export async function idbDeletePhotos(carId) {
  const db = await getDB();
  await db.delete("photos", carId);
}

export async function idbGetAllPhotos() {
  const db = await getDB();
  return db.getAll("photos");
}

/* ---------- sync queue ---------- */

export async function enqueueSync(entry) {
  const db = await getDB();
  await db.add("syncQueue", { ...entry, createdAt: new Date().toISOString() });
}

export async function getQueue() {
  const db = await getDB();
  return db.getAll("syncQueue");
}

export async function removeFromQueue(qid) {
  const db = await getDB();
  await db.delete("syncQueue", qid);
}

/* ---------- meta (last sync time, etc.) ---------- */

export async function getMeta(key) {
  const db = await getDB();
  const r = await db.get("meta", key);
  return r ? r.value : null;
}

export async function setMeta(key, value) {
  const db = await getDB();
  await db.put("meta", { key, value });
}

/* ---------- full local dump (for backup export / restore) ---------- */

export async function idbDumpAll() {
  const db = await getDB();
  const [cars, employees, expenses, settingsRows, photos, roles, partners, dailyClose, fixedExpenses, auditLog] = await Promise.all([
    db.getAll("cars"),
    db.getAll("employees"),
    db.getAll("expenses"),
    db.getAll("settings"),
    db.getAll("photos"),
    db.getAll("roles"),
    db.getAll("partners"),
    db.getAll("dailyClose"),
    db.getAll("fixedExpenses"),
    db.getAll("auditLog")
  ]);
  return {
    cars, employees, expenses, settings: settingsRows[0] || null, photos,
    roles, partners, dailyClose, fixedExpenses, auditLog
  };
}

export async function idbRestoreAll({
  cars = [], employees = [], expenses = [], settings, photos = [],
  roles = [], partners = [], dailyClose = [], fixedExpenses = [], auditLog = []
}) {
  const db = await getDB();
  const stores = ["cars", "employees", "expenses", "settings", "photos", "roles", "partners", "dailyClose", "fixedExpenses", "auditLog"];
  const tx = db.transaction(stores, "readwrite");
  await Promise.all([
    ...cars.map((c) => tx.objectStore("cars").put(c)),
    ...employees.map((e) => tx.objectStore("employees").put(e)),
    ...expenses.map((e) => tx.objectStore("expenses").put(e)),
    settings ? tx.objectStore("settings").put(settings) : Promise.resolve(),
    ...photos.map((p) => tx.objectStore("photos").put(p)),
    ...roles.map((r) => tx.objectStore("roles").put(r)),
    ...partners.map((p) => tx.objectStore("partners").put(p)),
    ...dailyClose.map((d) => tx.objectStore("dailyClose").put(d)),
    ...fixedExpenses.map((f) => tx.objectStore("fixedExpenses").put(f)),
    ...auditLog.map((a) => tx.objectStore("auditLog").put(a))
  ]);
  await tx.done;
}
