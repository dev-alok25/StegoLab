var StegoLab = window.StegoLab || {};
StegoLab.UI = StegoLab.UI || {};

StegoLab.UI.Keyboard = (() => {
  const shortcuts = new Map();

  function register(combo, handler, description) {
    const normalized = combo.toLowerCase().replace(/\s+/g, '');
    shortcuts.set(normalized, { handler, description, combo });
  }

  function handleKey(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    const key = e.key.toLowerCase();
    if (key === 'control' || key === 'shift' || key === 'alt' || key === 'meta') return;
    if (key === ' ') parts.push('space');
    else parts.push(key);

    const combo = parts.join('+');
    const entry = shortcuts.get(combo);
    if (entry) {
      e.preventDefault();
      e.stopPropagation();
      entry.handler(e);
    }
  }

  function init() {
    document.addEventListener('keydown', handleKey);
  }

  return { register, init };
})();
