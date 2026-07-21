var StegoLab = window.StegoLab || {};
StegoLab.UI = StegoLab.UI || {};

StegoLab.UI.Animation = (() => {
  const MIN_SHOW_MS = 900;
  const FINALE_MS = 620;
  const EXIT_MS = 380;

  const FILE_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9z"/><path d="M13 3v6h6"/><path d="M8.5 13h7M8.5 16.5h5"/></svg>';

  function particleSpans(count, prefix) {
    return Array.from({ length: count })
      .map((_, i) => `<span class="${prefix} ${prefix}${i}"></span>`)
      .join('');
  }

  function play(imgEl, kind) {
    const src = imgEl && imgEl.src;
    if (!src) {
      return { finish: () => Promise.resolve(), stop: () => {} };
    }

    const overlay = document.createElement('div');
    overlay.className = `stego-fullscreen-anim stego-fullscreen-${kind}`;

    const effectsHtml = kind === 'encode'
      ? `
        <div class="enc-file-icon">${FILE_ICON_SVG}</div>
        <div class="enc-impact-ring"></div>
        <div class="enc-particles">${particleSpans(14, 'enc-particle p')}</div>
      `
      : `
        <div class="dec-scanline"></div>
        <div class="dec-lens"></div>
        <div class="dec-pixels">${particleSpans(10, 'dec-pixel px')}</div>
        <div class="dec-file-out">${FILE_ICON_SVG}</div>
      `;

    overlay.innerHTML = `
      <div class="stego-fs-backdrop"></div>
      <div class="stego-fs-stage">
        <img class="stego-fs-image" src="${src}" alt="" />
      </div>
      <div class="stego-anim stego-anim-${kind}">${effectsHtml}</div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add('stego-fs-lock');

    // Trigger the entrance transition on the next frame.
    requestAnimationFrame(() => overlay.classList.add('stego-fs-visible'));

    const startTime = performance.now();
    let done = false;

    function cleanup() {
      if (done) return;
      done = true;
      overlay.remove();
      if (!document.querySelector('.stego-fullscreen-anim')) {
        document.body.classList.remove('stego-fs-lock');
      }
    }

    // Immediate teardown — used on errors, where there's nothing to celebrate.
    function stop() {
      cleanup();
    }

    // Plays a short finale flourish, then fades the overlay out. The ambient
    // effects (scanline, lens, particles) loop indefinitely via CSS while we
    // wait, so this looks the same whether the real work takes 200ms or 20s —
    // it never runs out and "dies" partway through a big payload.
    function finish() {
      return new Promise((resolve) => {
        if (done) { resolve(); return; }
        const elapsed = performance.now() - startTime;
        const untilMinShow = Math.max(0, MIN_SHOW_MS - elapsed);
        setTimeout(() => {
          if (done) { resolve(); return; }
          overlay.classList.add(kind === 'encode' ? 'stego-encode-done' : 'stego-decode-found');
          setTimeout(() => {
            if (done) { resolve(); return; }
            overlay.classList.add('stego-fs-exit');
            setTimeout(() => { cleanup(); resolve(); }, EXIT_MS);
          }, FINALE_MS);
        }, untilMinShow);
      });
    }

    return { finish, stop };
  }

  function playEncode(imgEl) {
    return play(imgEl, 'encode');
  }

  function playDecode(imgEl) {
    return play(imgEl, 'decode');
  }

  return { playEncode, playDecode };
})();
