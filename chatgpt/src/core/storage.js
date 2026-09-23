// THE NIGHT COUNT — storage that survives being run from a file:// page.
//
// Safari refuses localStorage entirely on file:// URLs, and Chrome can too
// under some settings. The single-file build is meant to be double-clicked, so
// storage degrades to memory instead of throwing: settings and saves still work
// for the session, and the game says so once rather than failing quietly.
let mem = Object.create(null);
let backed = null;

function probe() {
  if (backed !== null) return backed;
  try {
    const k = "__nc_probe";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    backed = true;
  } catch (e) {
    backed = false;
    console.warn("[storage] localStorage unavailable — progress will not survive a reload");
  }
  return backed;
}

export const persistent = () => probe();

export const store = {
  get(k) {
    if (probe()) { try { return localStorage.getItem(k); } catch (e) { /* fall through */ } }
    return k in mem ? mem[k] : null;
  },
  set(k, v) {
    mem[k] = v;
    if (probe()) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    return false;
  },
  remove(k) {
    delete mem[k];
    if (probe()) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  },
};
