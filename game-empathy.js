/* ============================================================
   Empathy Stories — Ethics, Religion & Philosophy (v5.26)

   Rammeplan area 6: Etikk, religion og filosofi.
   Short social-emotional scenarios with 2-3 responses. There is no
   "correct answer" — every choice records a different value tag
   (kindness, fairness, patience, comfort, courage). The platform
   is teaching that values exist and there are different ways to
   show care, not that one is right.

   Pedagogically grounded in Rammeplan's *danning* (cultivation)
   pillar — moral reasoning emerges through reflection on real
   social situations, not from rule-memorization.

   Public entry points (window-attached):
     startEmpathy(opts)
       opts.onAttempt(skillId, success)
       opts.onComplete()
     stopEmpathy()
   ============================================================ */
(function (global) {
  'use strict';

  /* Each scenario has 2-3 choices; every choice carries a `value`
     tag (kindness / fairness / patience / comfort / courage /
     curiosity). Recording differentiates only on the tag — never
     "right" or "wrong." */
  const SCENARIOS = [
    {
      emoji: '🍦',
      prompt: 'Your friend dropped their ice cream. What do you do?',
      choices: [
        { emoji: '🤗', text: 'Hug them',          value: 'comfort' },
        { emoji: '🤝', text: 'Share yours',       value: 'kindness' },
        { emoji: '🔍', text: 'Help find a new one', value: 'kindness' }
      ]
    },
    {
      emoji: '🛝',
      prompt: 'A new kid is alone at the playground. What do you do?',
      choices: [
        { emoji: '👋', text: 'Wave hello',       value: 'kindness' },
        { emoji: '🎾', text: 'Ask to play',      value: 'courage' },
        { emoji: '🧍', text: 'Stand near them',  value: 'comfort' }
      ]
    },
    {
      emoji: '😢',
      prompt: 'Your friend is crying. What do you do?',
      choices: [
        { emoji: '🤗', text: 'Hug them',           value: 'comfort' },
        { emoji: '💬', text: 'Ask what is wrong', value: 'kindness' },
        { emoji: '🧘', text: 'Sit quietly with them', value: 'patience' }
      ]
    },
    {
      emoji: '🧸',
      prompt: 'Your sibling broke your toy by accident. What do you do?',
      choices: [
        { emoji: '💛', text: 'Tell them it is okay', value: 'patience' },
        { emoji: '🔧', text: 'Try to fix it together', value: 'patience' },
        { emoji: '🎨', text: 'Build something new', value: 'curiosity' }
      ]
    },
    {
      emoji: '🍪',
      prompt: 'You have one cookie left and two friends want it. What do you do?',
      choices: [
        { emoji: '✂️', text: 'Break it in half',  value: 'fairness' },
        { emoji: '🎲', text: 'Take turns next time', value: 'fairness' },
        { emoji: '🤲', text: 'Give it to a friend', value: 'kindness' }
      ]
    },
    {
      emoji: '🐶',
      prompt: 'A puppy looks scared of a loud noise. What do you do?',
      choices: [
        { emoji: '🧘', text: 'Sit very still',    value: 'patience' },
        { emoji: '🤫', text: 'Speak in a soft voice', value: 'comfort' },
        { emoji: '🫥', text: 'Move slowly away',  value: 'patience' }
      ]
    },
    {
      emoji: '🎒',
      prompt: 'A classmate forgot their lunch. What do you do?',
      choices: [
        { emoji: '🍎', text: 'Share your apple',  value: 'kindness' },
        { emoji: '🏃', text: 'Tell the teacher',  value: 'courage' },
        { emoji: '🤝', text: 'Eat together',      value: 'kindness' }
      ]
    },
    {
      emoji: '😡',
      prompt: 'Someone is angry with you. What helps?',
      choices: [
        { emoji: '🌬️', text: 'Take three breaths', value: 'patience' },
        { emoji: '👂', text: 'Listen to them',     value: 'kindness' },
        { emoji: '🙏', text: 'Say sorry',          value: 'courage' }
      ]
    }
  ];

  const SCENARIOS_PER_SESSION = 5;

  let host = null;
  let order = [];
  let idx = 0;
  let onAttemptFn = null;
  let onCompleteFn = null;

  function pickSession() {
    const pool = SCENARIOS.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, SCENARIOS_PER_SESSION);
  }

  function render() {
    if (!host) return;
    if (idx >= order.length) {
      host.innerHTML = `
        <div class="empathy-card empathy-done">
          <div class="empathy-emoji">❤️</div>
          <h1 class="empathy-title">Thank you for thinking with us.</h1>
          <p class="empathy-sub">There are many ways to be kind.</p>
        </div>
      `;
      if (onAttemptFn) try { onAttemptFn('ethics-empathy-session', true); } catch {}
      setTimeout(() => { if (onCompleteFn) try { onCompleteFn(); } catch {} }, 1800);
      return;
    }
    const s = order[idx];
    host.innerHTML = `
      <div class="empathy-card">
        <div class="empathy-progress">
          <div class="empathy-progress-bar" style="width:${((idx + 1) / order.length) * 100}%"></div>
        </div>
        <div class="empathy-emoji">${s.emoji}</div>
        <h1 class="empathy-title">${s.prompt}</h1>
        <p class="empathy-sub">Pick what feels right to you.</p>
        <div class="empathy-choices">
          ${s.choices.map((c, i) => `
            <button class="empathy-choice" data-choice="${i}" type="button">
              <span class="empathy-choice-emoji">${c.emoji}</span>
              <span class="empathy-choice-text">${c.text}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    host.querySelectorAll('.empathy-choice').forEach((b) => {
      b.addEventListener('click', () => {
        const choice = s.choices[Number(b.dataset.choice)];
        if (!choice) return;
        b.classList.add('empathy-choice-picked');
        if (onAttemptFn) try { onAttemptFn(`ethics-empathy-value-${choice.value}`, true); } catch {}
        // Gentle pause so the kid sees their choice land before advancing
        setTimeout(() => { idx++; render(); }, 700);
      });
    });
  }

  function startEmpathy(opts = {}) {
    host = document.getElementById('screen-empathy');
    if (!host) { console.warn('Empathy screen missing'); return; }
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    idx = 0;
    order = pickSession();
    render();
  }

  function stopEmpathy() {
    if (host) host.innerHTML = '';
    host = null;
    order = [];
    idx = 0;
    onAttemptFn = null;
    onCompleteFn = null;
  }

  global.startEmpathy = startEmpathy;
  global.stopEmpathy  = stopEmpathy;
})(window);
