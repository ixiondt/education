/* ============================================================
   Client-side sync — v6.0
   ============================================================
   Owns the opt-in cross-device sync flow against /api/auth/* and
   /api/sync/*. Local-first: the PWA is fully functional with
   sync OFF; events still flow to the local skill store.

   When sync is ON and the parent is signed in:
     - Every recordAttempt() also queues an entry into the outbox
     - Outbox flushes to /api/sync/push every 30s (when online +
       visible) and on visibility-restore
     - The first push for a local profile mints a server childId,
       which we persist on profile.serverChildId
     - Pulls run on sign-in + on resume; replay merges into local
       skill_progress (idempotent on clientEventId)

   Failure modes are non-fatal:
     - Offline: outbox grows; flush retries when online
     - Server 4xx: log + drop (probably stale client)
     - Server 5xx: log + retry next cycle

   Public API (window.Sync):
     init()                   read state, register listeners
     status()                 → { signedIn, email, syncEnabled, outbox, lastPush }
     requestLink(email)       → { sent, link? }
     refreshSession()         → re-checks /api/auth/me
     signOut()
     setEnabled(bool)         turn sync on/off (per-device)
     enqueue(event)           called from recordAttempt()
     flush()                  manual flush trigger
     onChange(fn)             UI subscriber
   ============================================================ */
(function (global) {
  'use strict';

  const API = '/api';
  const FLUSH_INTERVAL_MS = 30 * 1000;
  const MAX_OUTBOX = 2000;
  const DEVICE_ID_KEY = 'ln.deviceId';
  const SYNC_ENABLED_KEY = 'ln.syncEnabled';
  const OUTBOX_KEY = 'ln.syncOutbox';
  const PARENT_KEY = 'ln.syncParent';   // cached { id, email } for UI

  /* --------- Local state --------- */
  let signedIn = false;
  let parent   = null;         // { id, email } when signed in
  let lastPush = null;
  let timer    = null;
  const subs   = [];

  function notify() {
    const state = status();
    subs.forEach((fn) => { try { fn(state); } catch {} });
  }

  /* --------- Device ID (stable across reloads) --------- */
  function deviceId() {
    let d = localStorage.getItem(DEVICE_ID_KEY);
    if (!d) {
      d = (crypto.randomUUID && crypto.randomUUID()) ||
          ('d_' + Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(DEVICE_ID_KEY, d);
    }
    return d;
  }

  /* --------- Outbox (localStorage; capped) --------- */
  function readOutbox() {
    try {
      const raw = localStorage.getItem(OUTBOX_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function writeOutbox(arr) {
    try {
      const trimmed = arr.slice(-MAX_OUTBOX);
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(trimmed));
    } catch {}
  }

  function isEnabled() {
    return localStorage.getItem(SYNC_ENABLED_KEY) === '1';
  }
  function setEnabled(on) {
    if (on) localStorage.setItem(SYNC_ENABLED_KEY, '1');
    else    localStorage.removeItem(SYNC_ENABLED_KEY);
    notify();
    if (on) flush();
  }

  /* --------- Auth flow --------- */
  async function refreshSession() {
    try {
      const r = await fetch(`${API}/auth/me`, { credentials: 'same-origin' });
      const j = await r.json();
      if (j.signedIn && j.parent) {
        signedIn = true;
        parent = j.parent;
        localStorage.setItem(PARENT_KEY, JSON.stringify(parent));
      } else {
        signedIn = false;
        parent = null;
        localStorage.removeItem(PARENT_KEY);
      }
    } catch {
      // Network unavailable — keep cached parent for UI continuity
      const cached = localStorage.getItem(PARENT_KEY);
      if (cached) {
        try { parent = JSON.parse(cached); signedIn = !!parent; }
        catch { signedIn = false; parent = null; }
      }
    }
    notify();
  }

  async function requestLink(email) {
    if (!email || !/.+@.+/.test(email)) {
      return { ok: false, error: 'Please enter a valid email.' };
    }
    try {
      const r = await fetch(`${API}/auth/request-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: j?.error?.message || 'Could not send link.' };
      return { ok: true, sent: j.sent, link: j.link };
    } catch (err) {
      return { ok: false, error: 'Network unreachable.' };
    }
  }

  async function signOut() {
    try {
      await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'same-origin' });
    } catch {}
    signedIn = false;
    parent = null;
    localStorage.removeItem(PARENT_KEY);
    setEnabled(false);
    notify();
  }

  /* --------- Outbox: enqueue + flush --------- */
  function enqueue(event) {
    if (!isEnabled()) return;
    if (!event || !event.skillId || typeof event.success !== 'boolean') return;
    const ob = readOutbox();
    ob.push({
      clientEventId: (crypto.randomUUID && crypto.randomUUID()) ||
                     (Date.now() + '_' + Math.random().toString(36).slice(2)),
      skillId:       String(event.skillId).slice(0, 120),
      success:       !!event.success,
      durationMs:    typeof event.durationMs === 'number' ? Math.max(0, Math.min(600000, event.durationMs|0)) : undefined,
      mode:          event.mode ? String(event.mode).slice(0, 60) : undefined,
      clientTs:      new Date(event.ts || Date.now()).toISOString(),
    });
    writeOutbox(ob);
  }

  async function flush() {
    if (!isEnabled() || !signedIn) return;
    if (!navigator.onLine) return;
    const ob = readOutbox();
    if (!ob.length) return;

    // Resolve active profile + server child id
    const profile = (typeof activeProfile === 'function') ? activeProfile() : null;
    if (!profile) return;

    const payload = {
      childId:        profile.serverChildId || undefined,
      childKey:       profile.id,
      childName:      profile.name,
      childAgeMonths: profile.ageMonths,
      deviceId:       deviceId(),
      events:         ob,
    };

    try {
      const r = await fetch(`${API}/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 401) {
          signedIn = false; parent = null; notify();
        }
        return;
      }
      // Persist server child id back to profile (first push)
      if (j.childId && !profile.serverChildId) {
        profile.serverChildId = j.childId;
        if (typeof saveStorage === 'function') saveStorage();
      }
      // Drop pushed events (idempotent on server, so this is safe)
      writeOutbox([]);
      lastPush = Date.now();
      notify();
    } catch {
      // Will retry next cycle
    }
  }

  /* --------- Bootstrap --------- */
  function start() {
    if (timer) return;
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') flush();
    }, FLUSH_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') flush();
    });
    window.addEventListener('online', flush);
  }

  function status() {
    return {
      signedIn,
      email: parent?.email || null,
      syncEnabled: isEnabled(),
      outbox: readOutbox().length,
      lastPush,
      deviceId: deviceId(),
    };
  }

  function onChange(fn) {
    if (typeof fn === 'function') subs.push(fn);
  }

  async function init() {
    // Hot cache from previous session for instant UI
    try {
      const cached = localStorage.getItem(PARENT_KEY);
      if (cached) { parent = JSON.parse(cached); signedIn = true; }
    } catch {}
    start();
    refreshSession();  // async, will re-notify
  }

  global.Sync = {
    init, status, requestLink, refreshSession, signOut, setEnabled, enqueue, flush, onChange
  };
})(window);
