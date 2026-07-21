var StegoLab = window.StegoLab || {};
StegoLab.UI = StegoLab.UI || {};

StegoLab.UI.Theme = (() => {
  const STORAGE_KEY = 'stegolab-theme';
  const modes = ['dark', 'light'];

  function getPreferred() {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'dark';
    } catch {
      return 'dark';
    }
  }

  function setPreferred(mode) {
    if (!modes.includes(mode)) return;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
    apply(mode);
  }

  function apply(mode) {
    const resolved = modes.includes(mode) ? mode : 'dark';
    document.documentElement.setAttribute('data-theme', resolved);
  }

  function init() {
    apply(getPreferred());
  }

  function cycle() {
    const current = getPreferred();
    const idx = modes.indexOf(current);
    const next = modes[(idx + 1) % modes.length];
    setPreferred(next);
    return next;
  }

  function getCurrent() {
    return getPreferred();
  }

  return { init, apply, setPreferred, getPreferred, cycle, getCurrent };
})();
