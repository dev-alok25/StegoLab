var StegoLab = window.StegoLab || {};
StegoLab.UI = StegoLab.UI || {};

StegoLab.UI.Progress = (() => {
  let container = null;

  function create(showStages = true) {
    const el = document.createElement('div');
    el.className = 'progress-panel';
    el.innerHTML = `
      <div class="progress-bar-track">
        <div class="progress-bar-fill"></div>
      </div>
      <div class="progress-info">
        <span class="progress-stage">Initializing...</span>
        <span class="progress-percent">0%</span>
      </div>
      <div class="progress-timing">
        <span class="progress-elapsed"></span>
        <span class="progress-eta"></span>
      </div>
    `;
    container = el;
    return el;
  }

  function setStage(stage) {
    if (!container) return;
    const s = container.querySelector('.progress-stage');
    if (s) s.textContent = stage;
  }

  function setProgress(fraction) {
    if (!container) return;
    const pct = Math.min(100, Math.max(0, Math.round(fraction * 100)));
    const fill = container.querySelector('.progress-bar-fill');
    const pctEl = container.querySelector('.progress-percent');
    if (fill) fill.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
  }

  function setTiming(elapsed, eta) {
    if (!container) return;
    const el = container.querySelector('.progress-elapsed');
    const et = container.querySelector('.progress-eta');
    if (el && elapsed) el.textContent = 'Elapsed: ' + elapsed;
    if (et && eta) et.textContent = 'ETA: ' + eta;
  }

  function show() {
    if (container && container.parentNode) container.style.display = '';
  }

  function hide() {
    if (container && container.parentNode) container.style.display = 'none';
  }

  function reset() {
    setProgress(0);
    setStage('Waiting...');
    setTiming('', '');
  }

  function destroy() {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
  }

  return { create, setStage, setProgress, setTiming, show, hide, reset, destroy };
})();
