/* ============================================================
   Living Companion — v6.3
   ============================================================
   A small character at the top of the home screen that breathes,
   notices time of day, greets the kid, cheers after long sessions.
   Pure UI delight — no skill recording, no scoring, nothing to
   tap. Just a friendly presence that makes the home screen feel
   alive instead of static.

   Mood states (CSS class on #companion):
     idle      — slow up/down bob (default)
     greet     — small wave on first appearance of the day
     cheer     — bigger bounce after a long session
     sleep     — closed-eye idle for night hours (21:00 - 06:00)

   The character emoji rotates by time of day:
     morning  06-11   🐦  (bird, energetic)
     midday   11-17   🐢  (turtle, content)
     evening  17-21   🦉  (owl, cozy)
     night    21-06   🌙  (moon, sleepy)

   Public:
     Companion.refresh()  re-paint based on current state
     Companion.cheer()    one-shot celebration animation
   ============================================================ */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'ln.companionGreet';

  function timeBucket() {
    const h = new Date().getHours();
    if (h >= 6  && h < 11) return { id: 'morning', emoji: '🐦', mood: 'idle' };
    if (h >= 11 && h < 17) return { id: 'midday',  emoji: '🐢', mood: 'idle' };
    if (h >= 17 && h < 21) return { id: 'evening', emoji: '🦉', mood: 'idle' };
    return                      { id: 'night',   emoji: '🌙', mood: 'sleep' };
  }

  /* First-visit-of-the-day greeting. Stored as YYYY-MM-DD; if today
     doesn't match we add the 'greet' class for one paint. */
  function shouldGreetToday() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const last = localStorage.getItem(STORAGE_KEY);
      if (last !== today) {
        localStorage.setItem(STORAGE_KEY, today);
        return true;
      }
    } catch {}
    return false;
  }

  function getEl() { return document.getElementById('companion'); }

  function refresh() {
    const el = getEl();
    if (!el) return;
    const bucket = timeBucket();
    const greet = shouldGreetToday();
    el.classList.remove('idle','greet','cheer','sleep','morning','midday','evening','night');
    el.classList.add(bucket.mood, bucket.id);
    if (greet) {
      el.classList.add('greet');
      // Strip greet after the animation runs once
      setTimeout(() => { el.classList.remove('greet'); el.classList.add(bucket.mood); }, 2200);
    }
    el.textContent = bucket.emoji;
    // Cheer trigger — if the active profile has played for >5 min today
    // (the session-cap break threshold), the companion bounces.
    try {
      const p = (typeof activeProfile === 'function') ? activeProfile() : null;
      const start = p?.todayPlayStartedAt || 0;
      if (start && (Date.now() - start) > 5 * 60 * 1000) {
        el.classList.add('cheer');
        setTimeout(() => el.classList.remove('cheer'), 1400);
      }
    } catch {}
  }

  function cheer() {
    const el = getEl();
    if (!el) return;
    el.classList.add('cheer');
    setTimeout(() => el.classList.remove('cheer'), 1400);
  }

  // Re-paint on visibility return (time of day may have shifted)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });

  global.Companion = { refresh, cheer };
})(window);
