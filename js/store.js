/* ===== Storage layer — talks to the Python/SQLite backend =====
   Keeps a synchronous in-memory cache so the UI code stays simple,
   and persists every change to the server (permanent SQLite DB). */
const API = '/api';

const Store = {
  data: { users: [], students: [], faculty: [], courses: [],
          attendance: [], marks: [], fees: [], timetable: [],
          books: [], issues: [] },

  // load everything from the server into the cache
  async load() {
    const res = await fetch(`${API}/bootstrap`);
    if (!res.ok) throw new Error('bootstrap failed');
    this.data = await res.json();
    return this.data;
  },

  // server-side login
  async login(username, password, role) {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    if (!res.ok) return null;
    return res.json();
  },

  // ---- read (sync, from cache) ----
  all(col) { return this.data[col] || []; },
  find(col, id) { return this.all(col).find(x => x.id === id); },

  // ---- write (update cache now, persist in background) ----
  add(col, obj) {
    obj.id = obj.id || this._uid(col);
    this.data[col].push(obj);
    this._post(col, obj);
    return obj;
  },

  update(col, id, patch) {
    const item = this.find(col, id);
    if (item) {
      Object.assign(item, patch);
      this._put(col, id, patch);
    }
    return item;
  },

  remove(col, id) {
    this.data[col] = this.all(col).filter(x => x.id !== id);
    this._delete(col, id);
  },

  // ---- background persistence ----
  _post(col, obj) {
    fetch(`${API}/${col}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj),
    }).catch(() => this._fail());
  },
  _put(col, id, patch) {
    fetch(`${API}/${col}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => this._fail());
  },
  _delete(col, id) {
    fetch(`${API}/${col}/${id}`, { method: 'DELETE' }).catch(() => this._fail());
  },
  _fail() {
    const t = document.getElementById('toast');
    if (t) { t.textContent = 'Save failed — is the server running?'; t.className = 'toast err'; }
  },

  _uid(col) {
    const p = { students:'S', faculty:'F', courses:'C', attendance:'A',
                marks:'M', fees:'FE', timetable:'T', users:'u',
                books:'B', issues:'IS' }[col] || 'X';
    let n = 1, id;
    do { id = p + String(n).padStart(2, '0'); n++; } while (this.find(col, id));
    return id;
  },
};
