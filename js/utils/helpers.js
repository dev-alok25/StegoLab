var StegoLab = window.StegoLab || {};
StegoLab.Utils = StegoLab.Utils || {};

StegoLab.Utils.Helpers = (() => {
  function toUint64(n) {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setBigUint64(0, BigInt(n), false);
    return new Uint8Array(buf);
  }

  function fromUint64(bytes) {
    return Number(new DataView(bytes.buffer).getBigUint64(0, false));
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    toUint64,
    fromUint64,
    formatBytes,
    escapeHtml
  };
})();
