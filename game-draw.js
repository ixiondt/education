/* ============================================================
   Draw — Free drawing canvas (v5.25)

   Rammeplan area 3: Kunst, kultur og kreativitet.
   Open-ended drawing surface with calm palette + brush sizes.
   No theme prompts, no grading, no time limit. Pure expression.

   Storage: drawings saved as data URLs to localStorage under
   `ln.drawings.<profileId>` — capped at the 12 most recent so the
   key never exceeds the ~5MB localStorage quota even with the
   palette-heavy PNG output Canvas produces.

   Public entry points (window-attached):
     startDraw(opts)
       opts.onAttempt(skillId, success)  records ef-creativity events
       opts.onComplete()                  exit to home
     stopDraw()
   ============================================================ */
(function (global) {
  'use strict';

  /* Calm palette (8 colors) — matches the rest of the platform's
     OKLCH-derived tokens visually. Black + Eraser are the last two
     buttons to keep the colorful options in the foreground. */
  const PALETTE = [
    '#ef476f', // rose
    '#ffd166', // honey
    '#06d6a0', // mint
    '#118ab2', // sky
    '#8a64c2', // lilac
    '#c46a2a', // terracotta
    '#3a2e1a', // ink (near-black)
    '__eraser' // eraser sentinel
  ];

  const BRUSHES = [
    { id: 'small',  px: 6,  label: '·' },
    { id: 'medium', px: 14, label: '•' },
    { id: 'large',  px: 26, label: '●' }
  ];

  const MAX_DRAWINGS = 12;

  let canvas = null;
  let ctx = null;
  let host = null;
  let drawing = false;
  let lastX = 0;
  let lastY = 0;
  let activeColor = PALETTE[0];
  let activeBrush = BRUSHES[1];
  let dprScale = 1;
  let onAttemptFn = null;
  let onCompleteFn = null;

  function storageKey() {
    const p = (typeof activeProfile === 'function') ? activeProfile() : null;
    return 'ln.drawings.' + (p?.id || 'default');
  }
  function loadGallery() {
    try {
      const raw = localStorage.getItem(storageKey());
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function saveGallery(arr) {
    try {
      const trimmed = arr.slice(-MAX_DRAWINGS);
      localStorage.setItem(storageKey(), JSON.stringify(trimmed));
    } catch (err) {
      // Quota exceeded — drop the oldest half and retry once
      try {
        const trimmed = arr.slice(-Math.floor(MAX_DRAWINGS / 2));
        localStorage.setItem(storageKey(), JSON.stringify(trimmed));
      } catch {}
    }
  }

  function fitCanvas() {
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    dprScale = dpr;
    // Cream paper background
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, rect.width, rect.height);
    // Smooth line rendering
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function clientToCanvas(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function onPointerDown(ev) {
    ev.preventDefault();
    canvas.setPointerCapture?.(ev.pointerId);
    drawing = true;
    const { x, y } = clientToCanvas(ev);
    lastX = x; lastY = y;
    // Dot for tap-without-drag
    ctx.beginPath();
    ctx.fillStyle = (activeColor === '__eraser') ? '#fffaf0' : activeColor;
    ctx.arc(x, y, activeBrush.px / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  function onPointerMove(ev) {
    if (!drawing) return;
    const { x, y } = clientToCanvas(ev);
    ctx.strokeStyle = (activeColor === '__eraser') ? '#fffaf0' : activeColor;
    ctx.lineWidth = activeBrush.px;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x; lastY = y;
  }
  function onPointerUp(ev) {
    if (!drawing) return;
    drawing = false;
    try { canvas.releasePointerCapture?.(ev.pointerId); } catch {}
  }

  function clearCanvas() {
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }

  function saveDrawing() {
    if (!canvas) return;
    try {
      // JPEG at 70% — small, still recognizable, much smaller than PNG
      // for typical kid drawings (mostly sparse strokes on cream paper).
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const gallery = loadGallery();
      gallery.push({
        ts: Date.now(),
        dataUrl
      });
      saveGallery(gallery);
      if (onAttemptFn) try { onAttemptFn('arts-drawing-saved', true); } catch {}
      flashSaved();
      renderGalleryStrip();
    } catch (err) {
      console.warn('Drawing save failed', err);
    }
  }

  function flashSaved() {
    const note = host?.querySelector('#draw-saved-note');
    if (!note) return;
    note.classList.add('show');
    setTimeout(() => note.classList.remove('show'), 1400);
  }

  function renderGalleryStrip() {
    const strip = host?.querySelector('#draw-gallery-strip');
    if (!strip) return;
    const gallery = loadGallery();
    if (!gallery.length) {
      strip.innerHTML = '<div class="draw-gallery-empty">No drawings yet — make one and tap Save.</div>';
      return;
    }
    strip.innerHTML = '';
    gallery.slice().reverse().forEach((d, i) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'draw-thumb';
      thumb.title = new Date(d.ts).toLocaleString();
      thumb.innerHTML = `<img alt="" src="${d.dataUrl}"><span class="draw-thumb-del" data-ts="${d.ts}" aria-label="Delete">✕</span>`;
      strip.appendChild(thumb);
    });
  }

  function deleteDrawing(ts) {
    const gallery = loadGallery().filter((d) => d.ts !== ts);
    saveGallery(gallery);
    renderGalleryStrip();
  }

  function buildUI() {
    host.innerHTML = `
      <div class="draw-toolbar">
        <div class="draw-palette" id="draw-palette" role="radiogroup" aria-label="Color">
          ${PALETTE.map((c) => `
            <button type="button" class="draw-color${c === '__eraser' ? ' draw-eraser' : ''}"
              data-color="${c}"
              style="${c === '__eraser' ? '' : `background:${c};`}"
              aria-label="${c === '__eraser' ? 'Eraser' : 'Color ' + c}"
              role="radio" aria-checked="false">${c === '__eraser' ? '🧽' : ''}</button>
          `).join('')}
        </div>
        <div class="draw-brushes" id="draw-brushes" role="radiogroup" aria-label="Brush size">
          ${BRUSHES.map((b) => `
            <button type="button" class="draw-brush" data-brush="${b.id}"
              style="font-size:${b.px}px;line-height:1;"
              role="radio" aria-checked="false" aria-label="${b.id} brush">${b.label}</button>
          `).join('')}
        </div>
        <div class="draw-actions">
          <button class="btn btn-secondary" id="draw-clear">Clear</button>
          <button class="btn btn-primary"   id="draw-save">Save</button>
          <button class="btn btn-secondary" id="draw-done">Done</button>
        </div>
      </div>
      <div class="draw-canvas-wrap">
        <canvas id="draw-canvas" class="draw-canvas"></canvas>
        <div class="draw-saved-note" id="draw-saved-note">Saved ✓</div>
      </div>
      <div class="draw-gallery" id="draw-gallery-strip"></div>
    `;
  }

  function selectColor(color) {
    activeColor = color;
    host.querySelectorAll('#draw-palette .draw-color').forEach((b) => {
      const on = b.dataset.color === color;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.classList.toggle('selected', on);
    });
  }
  function selectBrush(brushId) {
    activeBrush = BRUSHES.find((b) => b.id === brushId) || BRUSHES[1];
    host.querySelectorAll('#draw-brushes .draw-brush').forEach((b) => {
      const on = b.dataset.brush === brushId;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.classList.toggle('selected', on);
    });
  }

  function startDraw(opts = {}) {
    host = document.getElementById('screen-draw');
    if (!host) { console.warn('Draw screen missing'); return; }
    onAttemptFn  = typeof opts.onAttempt  === 'function' ? opts.onAttempt  : null;
    onCompleteFn = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    buildUI();
    canvas = host.querySelector('#draw-canvas');
    fitCanvas();
    selectColor(PALETTE[0]);
    selectBrush(BRUSHES[1].id);
    renderGalleryStrip();

    // Pointer events — works for mouse, touch, pen
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup',   onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    host.querySelectorAll('#draw-palette .draw-color').forEach((b) =>
      b.addEventListener('click', () => selectColor(b.dataset.color)));
    host.querySelectorAll('#draw-brushes .draw-brush').forEach((b) =>
      b.addEventListener('click', () => selectBrush(b.dataset.brush)));
    host.querySelector('#draw-clear').addEventListener('click', clearCanvas);
    host.querySelector('#draw-save').addEventListener('click', saveDrawing);
    host.querySelector('#draw-done').addEventListener('click', () => {
      if (onCompleteFn) try { onCompleteFn(); } catch {}
    });

    // Gallery delegation
    host.querySelector('#draw-gallery-strip')?.addEventListener('click', (e) => {
      const del = e.target.closest('.draw-thumb-del');
      if (del) {
        const ts = Number(del.dataset.ts);
        if (Number.isFinite(ts)) deleteDrawing(ts);
        e.stopPropagation();
        return;
      }
      // tap a thumbnail = re-open it onto the canvas as the new starting state
      const thumb = e.target.closest('.draw-thumb');
      if (!thumb) return;
      const img = thumb.querySelector('img');
      if (!img) return;
      const ghost = new Image();
      ghost.onload = () => {
        const rect = canvas.getBoundingClientRect();
        clearCanvas();
        ctx.drawImage(ghost, 0, 0, rect.width, rect.height);
      };
      ghost.src = img.src;
    });

    window.addEventListener('resize', onResize);
  }
  function onResize() {
    if (!canvas) return;
    // Preserve current image when resizing
    const data = canvas.toDataURL();
    fitCanvas();
    const img = new Image();
    img.onload = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = data;
  }

  function stopDraw() {
    if (canvas) {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup',   onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    }
    window.removeEventListener('resize', onResize);
    if (host) host.innerHTML = '';
    host = null;
    canvas = null;
    ctx = null;
    drawing = false;
    onAttemptFn = null;
    onCompleteFn = null;
  }

  global.startDraw = startDraw;
  global.stopDraw  = stopDraw;
})(window);
