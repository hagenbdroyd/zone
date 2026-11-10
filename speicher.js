// Notizen liegen nur auf diesem Gerät, in der Browser-Datenbank (IndexedDB).
window.Speicher = (() => {
  let db;
  const oeffnen = () =>
    (db ??= new Promise((ok, fehler) => {
      const a = indexedDB.open("filmdenker", 1);
      a.onupgradeneeded = () => a.result.createObjectStore("notizen", { keyPath: "id" });
      a.onsuccess = () => ok(a.result);
      a.onerror = () => fehler(a.error);
    }));
  const tx = async (modus, fn) => {
    const d = await oeffnen();
    return new Promise((ok, fehler) => {
      const t = d.transaction("notizen", modus);
      const r = fn(t.objectStore("notizen"));
      t.oncomplete = () => ok(r.result);
      t.onerror = t.onabort = () => fehler(t.error);
    });
  };
  return {
    alle: () => tx("readonly", (s) => s.getAll()),
    sichern: (n) => tx("readwrite", (s) => s.put(n)),
    loeschen: (id) => tx("readwrite", (s) => s.delete(id)),
  };
})();
