/* ============================================================
   Who Lives With You? — Family roles (v5.29)

   Rammeplan area 7: Nærmiljø og samfunn.
   Configurable family composition — Rammeplan explicitly honors
   family diversity (single-parent, two-parent, two-mom, two-dad,
   grandparents-raising, extended family). The app asks the parent
   to set up the kid's actual family shape once, then the kid sees
   their own family represented.

   Storage: profile.family = { members: [{ key, emoji, label }, ...] }
   so the configuration roundtrips with the rest of the profile.

   Two views:
     - Set up (parent-gated by Settings — single tap on each emoji
       toggles whether that role is in this kid's family)
     - Tap to hear / explore — the kid taps a family member, hears
       their name read aloud. Calm-tap style, no scoring.

   Public entry points (window-attached):
     startFamily(opts) ; stopFamily()
   ============================================================ */
(function (global) {
  'use strict';

  /* The full bank of possible family-member labels. The parent
     toggles which ones apply. Defaults include the most-common
     shapes so first launch isn't empty. */
  const ROLES = [
    { key: 'mom',          emoji: '👩', label: 'Mom' },
    { key: 'dad',          emoji: '👨', label: 'Dad' },
    { key: 'mama2',        emoji: '👩‍🦰', label: 'Mama' },
    { key: 'papa2',        emoji: '🧔', label: 'Papa' },
    { key: 'sibling-bro',  emoji: '👦', label: 'Brother' },
    { key: 'sibling-sis',  emoji: '👧', label: 'Sister' },
    { key: 'baby',         emoji: '👶', label: 'Baby' },
    { key: 'grandma',      emoji: '👵', label: 'Grandma' },
    { key: 'grandpa',      emoji: '👴', label: 'Grandpa' },
    { key: 'auntie',       emoji: '🧑‍🦱', label: 'Auntie' },
    { key: 'uncle',        emoji: '👨‍🦱', label: 'Uncle' },
    { key: 'cousin',       emoji: '🧒', label: 'Cousin' },
    { key: 'pet-dog',      emoji: '🐕', label: 'Our dog' },
    { key: 'pet-cat',      emoji: '🐈', label: 'Our cat' }
  ];

  const DEFAULT_FAMILY = ['mom', 'dad'];

  let host = null;
  let mode = 'view';   // 'view' | 'setup'
  let onAttemptFn = null;
  let speakFn = null;
  let onCompleteFn = null;

  function getFamily() {
    if (typeof activeProfile !== 'function') return DEFAULT_FAMILY.slice();
    const p = activeProfile();
    if (!p) return DEFAULT_FAMILY.slice();
    if (!p.family) p.family = { members: DEFAULT_FAMILY.slice() };
    if (!Array.isArray(p.family.members)) p.family.members = DEFAULT_FAMILY.slice();
    return p.family.members;
  }
  function setFamily(arr) {
    const p = activeProfile?.();
    if (!p) return;
    p.family = p.family || {};
    p.family.members = arr;
    if (typeof saveStorage === 'function') saveStorage();
  }

  function render() {
    if (!host) return;
    const family = getFamily();
    if (mode === 'setup') {
      host.innerHTML = `
        <div class="family-card">
          <h1 class="family-title">Who lives with you?</h1>
          <p class="family-sub">Tap each one in your family. (Parent / older kid setup — you can change this any time.)</p>
          <div class="family-grid family-grid-setup">
            ${ROLES.map((r) => `
              <button class="family-cell ${family.includes(r.key) ? 'selected' : ''}" data-key="${r.key}" aria-pressed="${family.includes(r.key)}">
                <span class="family-emoji">${r.emoji}</span>
                <span class="family-label">${r.label}</span>
              </button>
            `).join('')}
          </div>
          <div class="family-actions">
            <button class="btn btn-secondary" id="family-mode-view">All set</button>
          </div>
        </div>
      `;
      host.querySelectorAll('[data-key]').forEach((b) => {
        b.addEventListener('click', () => {
          const k = b.dataset.key;
          const current = getFamily();
          const next = current.includes(k) ? current.filter((x) => x !== k) : [...current, k];
          setFamily(next);
          if (onAttemptFn) try { onAttemptFn(`society-family-config-${k}`, true); } catch {}
          render();
        });
      });
      host.querySelector('#family-mode-view').addEventListener('click', () => {
        mode = 'view';
        render();
      });
      return;
    }
    // VIEW mode
    const myRoles = ROLES.filter((r) => family.includes(r.key));
    host.innerHTML = `
      <div class="family-card">
        <h1 class="family-title">My family</h1>
        ${myRoles.length === 0
          ? '<p class="family-sub">No family set up yet — tap "Set up" to add who lives with you.</p>'
          : '<p class="family-sub">Tap each one to hear their name.</p>'}
        <div class="family-grid">
          ${myRoles.map((r) => `
            <button class="family-cell" data-key="${r.key}">
              <span class="family-emoji">${r.emoji}</span>
              <span class="family-label">${r.label}</span>
            </button>
          `).join('')}
        </div>
        <div class="family-actions">
          <button class="btn btn-secondary" id="family-mode-setup">Set up</button>
          <button class="btn btn-primary"   id="family-done">Done</button>
        </div>
      </div>
    `;
    host.querySelectorAll('[data-key]').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.key;
        const role = ROLES.find((r) => r.key === k);
        if (!role) return;
        b.classList.add('family-pulse');
        setTimeout(() => b.classList.remove('family-pulse'), 600);
        if (speakFn) try { speakFn(role.label, `family-${role.key}`); } catch {}
        if (onAttemptFn) try { onAttemptFn(`society-family-tap-${k}`, true); } catch {}
      });
    });
    host.querySelector('#family-mode-setup').addEventListener('click', () => {
      mode = 'setup';
      render();
    });
    host.querySelector('#family-done').addEventListener('click', () => {
      if (onCompleteFn) try { onCompleteFn(); } catch {}
    });
  }

  function startFamily(opts = {}) {
    host = document.getElementById('screen-family');
    if (!host) return;
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    speakFn      = typeof opts.speak      === 'function' ? opts.speak      : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    mode = (getFamily().length === 0) ? 'setup' : 'view';
    render();
  }
  function stopFamily() {
    if (host) host.innerHTML = '';
    host = null;
    onAttemptFn = speakFn = onCompleteFn = null;
  }

  global.startFamily = startFamily;
  global.stopFamily  = stopFamily;
})(window);
