var StegoLab = window.StegoLab || {};
StegoLab.Storage = StegoLab.Storage || {};

StegoLab.Storage.Settings = (() => {
  const PREFIX = 'stegolab-';

  function get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {}
  }

  return { get, set };
})();
