var StegoLab = window.StegoLab || {};
StegoLab.UI = StegoLab.UI || {};

StegoLab.UI.DragDrop = (() => {
  const { isImageFile } = StegoLab.Utils.File;
  const SUPPORTED_TYPES = StegoLab.Core.Constants.SUPPORTED_TYPES;

  let activeZone = null;

  function init(zone, options = {}) {
    activeZone = zone;

    const {
      onFile = () => {},
      onError = () => {}
    } = options;

    zone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) {
        onError(new Error('No files dropped'));
        return;
      }

      const file = files[0];
      if (!isImageFile(file)) {
        onError(new Error(`Unsupported file type. Supported: ${SUPPORTED_TYPES.join(', ')}`));
        return;
      }

      onFile(file);
    });

    zone.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.png,.bmp,.tiff,.tif,.webp,image/png,image/bmp,image/tiff,image/webp';
      input.addEventListener('change', () => {
        if (input.files && input.files[0]) {
          if (!isImageFile(input.files[0])) {
            onError(new Error('Unsupported file type.'));
            return;
          }
          onFile(input.files[0]);
        }
      });
      input.click();
    });
  }

  function updateDropMessage(count, type) {
    if (!activeZone) return;
    const msg = activeZone.querySelector('.drop-message');
    if (msg) {
      if (type === 'image') {
        msg.innerHTML = `<strong>${count}</strong> image ready`;
      } else {
        msg.innerHTML = 'Drop image here or click to browse';
      }
    }
  }

  return { init, updateDropMessage };
})();
