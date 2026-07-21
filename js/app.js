(function () {
  'use strict';

  const App = {
    encodeFile: null,
    encodePayloadFiles: [],
    encodeImageFile: null,
    decodeFile: null
  };

  function getEl(id) { return document.getElementById(id); }

  document.addEventListener('DOMContentLoaded', () => {
    safeInit('Theme', () => StegoLab.UI.Theme.init());
    safeInit('Dashboard', () => StegoLab.UI.Dashboard.init());
    safeInit('Keyboard', () => StegoLab.UI.Keyboard.init());
    safeInit('EncodeTab', initEncodeTab);
    safeInit('DecodeTab', initDecodeTab);
    safeInit('Shortcuts', registerShortcuts);
    safeInit('Modals', initModals);
    safeInit('HeaderThemeToggle', initHeaderThemeToggle);
    safeInit('PasswordToggles', initPasswordToggles);
    safeInit('PasswordMeter', initPasswordMeter);
    safeInit('HeaderPageTitle', initHeaderPageTitle);
    safeInit('FabExecute', initFabExecute);
  });

  // ---------------------------------------------------------------------
  // Inline alert banners — one per tab, replaces the old toast popups.
  // ---------------------------------------------------------------------
  function alertMsg(scope, message, type) {
    const el = getEl(scope + '-alert');
    if (!el) return;
    el.textContent = message;
    el.className = 'inline-alert inline-alert-visible inline-alert-' + (type || 'info');
    clearTimeout(el._timer);
    if (type !== 'error') {
      el._timer = setTimeout(() => el.classList.remove('inline-alert-visible'), 6000);
    }
  }
  function clearAlert(scope) {
    const el = getEl(scope + '-alert');
    if (el) el.classList.remove('inline-alert-visible');
  }

  function initHeaderPageTitle() {
    const titleEl = getEl('header-page-title');
    if (!titleEl) return;
    document.addEventListener('tabchange', (e) => {
      titleEl.textContent = e.detail.tab;
    });
  }

  function initFabExecute() {
    const fab = getEl('fab-execute');
    if (!fab) return;
    const targetFor = (tab) => (tab === 'decode' ? getEl('dec-btn') : getEl('enc-btn'));
    let currentTab = 'encode';
    document.addEventListener('tabchange', (e) => { currentTab = e.detail.tab; });
    fab.addEventListener('click', () => {
      const btn = targetFor(currentTab);
      if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const toggle = () => {
      const btn = targetFor(currentTab);
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const onScreen = rect.top < window.innerHeight * 0.85 && rect.bottom > 0;
      fab.classList.toggle('fab-visible', window.innerWidth < 720 && !onScreen);
    };
    window.addEventListener('scroll', toggle, { passive: true });
    window.addEventListener('resize', toggle);
    document.addEventListener('tabchange', () => setTimeout(toggle, 50));
    setTimeout(toggle, 200);
  }

  function initPasswordToggles() {
    [['enc-pw-toggle', 'enc-password'], ['dec-pw-toggle', 'dec-password']].forEach(([btnId, inputId]) => {
      const btn = getEl(btnId);
      const input = getEl(inputId);
      if (!btn || !input) return;
      btn.addEventListener('click', () => {
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        btn.classList.toggle('pw-shown', !showing);
      });
    });
  }

  function initPasswordMeter() {
    const input = getEl('enc-password');
    const meter = getEl('enc-pw-meter');
    if (!input || !meter) return;
    input.addEventListener('input', () => {
      const val = input.value;
      meter.classList.remove('pw-1', 'pw-2', 'pw-3', 'pw-4');
      if (!val) return;
      let score = 0;
      if (val.length >= 8) score++;
      if (val.length >= 12) score++;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
      if (/[0-9]/.test(val) || /[^A-Za-z0-9]/.test(val)) score++;
      meter.classList.add('pw-' + Math.max(1, score));
    });
  }

  function safeInit(label, fn) {
    try {
      fn();
    } catch (err) {
      console.error(`[StegoLab] ${label} init failed:`, err);
    }
  }

  const FILE_ICON_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9z"/><path d="M13 3v6h6"/></svg>';

  function initEncodeTab() {
    const dropZone = getEl('encode-drop-zone');
    const fileInput = getEl('enc-file');
    const msgArea = getEl('enc-msg');
    const passInput = getEl('enc-password');
    const encodeBtn = getEl('enc-btn');
    const imagePreview = getEl('enc-preview');
    const statsContainer = getEl('enc-stats');
    const capacityContainer = getEl('enc-capacity');
    const securityContainer = getEl('enc-security');

    StegoLab.UI.DragDrop.init(dropZone, {
      onFile: (file) => {
        App.encodeImageFile = file;
        updateEncodePreview(file, imagePreview, statsContainer, capacityContainer);
      },
      onError: (err) => alertMsg('encode', err.message, 'error')
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        App.encodeImageFile = fileInput.files[0];
        updateEncodePreview(App.encodeImageFile, imagePreview, statsContainer, capacityContainer);
      }
    });

    encodeBtn.addEventListener('click', async () => {
      try {
        if (!App.encodeImageFile) {
          alertMsg('encode', 'Please select an image.', 'error');
          return;
        }
        const file = App.encodeFile;
        if (!file) {
          alertMsg('encode', 'Please select a file to hide.', 'error');
          return;
        }

        const password = passInput ? passInput.value : '';
        if (password && password.length < 8) {
          alertMsg('encode', 'Short passwords are easy to guess. 8+ characters is recommended, but continuing anyway.', 'warning');
        } else {
          clearAlert('encode');
        }

        encodeBtn.disabled = true;

        const progressEl = StegoLab.UI.Progress.create();
        const parent = encodeBtn.parentElement;
        parent.insertBefore(progressEl, encodeBtn.nextSibling);

        const anim = StegoLab.UI.Animation.playEncode(imagePreview);

        let result;
        try {
          result = await StegoLab.Core.Encoder.encode({
            file,
            imageFile: App.encodeImageFile,
            password,
            onStage: (stage) => StegoLab.UI.Progress.setStage(stage),
            onProgress: (pct) => StegoLab.UI.Progress.setProgress(pct)
          });
        } catch (err) {
          anim.stop();
          throw err;
        }
        await anim.finish();

        StegoLab.Utils.File.downloadBlob(result.blob, result.filename);

        const fileCountNote = App.encodePayloadFiles.length > 1 ? `${App.encodePayloadFiles.length} files bundled. ` : '';
        alertMsg('encode',
          `Encoded in ${(result.metadata.duration / 1000).toFixed(2)}s. ${fileCountNote}${result.metadata.isEncrypted ? 'Encrypted. ' : ''}${result.metadata.isCompressed ? 'Compressed. ' : ''}Downloaded as ${result.filename}`,
          'success'
        );

        if (result.metadata.wasUpscaled) {
          const { originalDimensions: od, newDimensions: nd } = result.metadata;
          alertMsg('encode', `The image was too small for this payload, so it was resized from ${od.width}x${od.height} to ${nd.width}x${nd.height} to fit.`, 'info');
        }

        if (result.metadata.hadTransparency) {
          alertMsg('encode', 'This image had transparency. It was flattened to fully opaque so the hidden data survives reliably.', 'warning');
        }

        if (securityContainer) {
          const originalData = App._encodeOriginalData;
          if (originalData) {
            const { computeSecurity } = StegoLab.UI.Stats;
            const currentData = await StegoLab.Utils.File.imageFileToImageData(
              new File([result.blob], 'temp.png', { type: 'image/png' })
            );
            const security = computeSecurity(currentData.imageData, originalData);
            StegoLab.UI.Stats.renderSecurity(securityContainer, security);
          }
        }

        StegoLab.UI.Progress.setStage('Complete!');
        StegoLab.UI.Progress.setProgress(1);

        setTimeout(() => StegoLab.UI.Progress.destroy(), 3000);
      } catch (err) {
        StegoLab.UI.Progress.setStage('Error');
        alertMsg('encode', err.message || 'Encoding failed', 'error');
      } finally {
        encodeBtn.disabled = false;
      }
    });

    const hiddenFileInput = getEl('enc-file-payload');
    const fileListEl = getEl('enc-file-list');

    function renderFileChips() {
      if (!fileListEl) return;
      fileListEl.innerHTML = App.encodePayloadFiles.map((f, i) => `
        <div class="file-chip" data-idx="${i}">
          <span class="file-chip-icon">${FILE_ICON_SVG}</span>
          <span class="file-chip-name">${StegoLab.Utils.Helpers.escapeHtml(f.name)}</span>
          <span class="file-chip-size">${StegoLab.Utils.Helpers.formatBytes(f.size)}</span>
          <button type="button" class="file-chip-remove" aria-label="Remove ${StegoLab.Utils.Helpers.escapeHtml(f.name)}" data-remove="${i}">&times;</button>
        </div>
      `).join('');
    }

    fileListEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      const idx = Number(btn.dataset.remove);
      App.encodePayloadFiles.splice(idx, 1);
      renderFileChips();
      rebuildPayload();
    });

    async function addPayloadFiles(fileList) {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      if (msgArea) msgArea.value = '';
      App.encodePayloadFiles.push(...files);
      renderFileChips();
      await rebuildPayload();
    }

    async function rebuildPayload() {
      const label = getEl('enc-file-label');
      const files = App.encodePayloadFiles;

      if (files.length === 0) {
        App.encodeFile = null;
        if (label) label.textContent = 'Drop files or click to browse';
        updatePayloadInfo();
        return;
      }

      if (label) {
        label.textContent = files.length === 1
          ? files[0].name
          : `${files.length} files selected`;
      }

      try {
        App.encodeFile = files.length === 1
          ? files[0]
          : await StegoLab.Utils.Bundle.pack(files);
        updatePayloadInfo();
      } catch (err) {
        alertMsg('encode', 'Failed to prepare files: ' + err.message, 'error');
      }
    }

    if (hiddenFileInput) {
      hiddenFileInput.addEventListener('change', () => {
        addPayloadFiles(hiddenFileInput.files);
        hiddenFileInput.value = '';
      });
    }

    const payloadDropZone = getEl('payload-drop-zone');
    if (payloadDropZone) {
      payloadDropZone.addEventListener('dragover', (e) => { e.preventDefault(); payloadDropZone.classList.add('drag-over'); });
      payloadDropZone.addEventListener('dragleave', () => payloadDropZone.classList.remove('drag-over'));
      payloadDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        payloadDropZone.classList.remove('drag-over');
        addPayloadFiles(e.dataTransfer.files);
      });
      payloadDropZone.addEventListener('click', () => {
        if (hiddenFileInput) hiddenFileInput.click();
      });
      payloadDropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (hiddenFileInput) hiddenFileInput.click();
        }
      });
    }

    if (msgArea) {
      msgArea.addEventListener('input', () => {
        const text = msgArea.value;
        if (text) {
          App.encodePayloadFiles = [];
          renderFileChips();
          const bytes = new TextEncoder().encode(text);
          App.encodeFile = new File([bytes], 'message.txt', { type: 'text/plain' });
          const label = getEl('enc-file-label');
          if (label) label.textContent = 'Drop files or click to browse';
          updatePayloadInfo();
        }
      });
    }

    function updatePayloadInfo() {
      const info = getEl('payload-size');
      if (!App.encodeFile) {
        if (info) info.textContent = 'no files selected';
        if (App._encodeCapacity && capacityContainer) {
          StegoLab.UI.Stats.renderCapacity(capacityContainer, App._encodeCapacity, 0);
        }
        return;
      }
      const size = App.encodeFile.size;
      if (info) info.textContent = StegoLab.Utils.Helpers.formatBytes(size);
      if (App._encodeCapacity && capacityContainer) {
        StegoLab.UI.Stats.renderCapacity(capacityContainer, App._encodeCapacity, size);
      }
    }
  }

  async function updateEncodePreview(file, imgEl, statsContainer, capacityContainer) {
    if (!file || !imgEl) return;
    try {
      const { imageFileToImageData } = StegoLab.Utils.File;
      const { computeImageStats, computeCapacity, renderStats, renderCapacity } = StegoLab.UI.Stats;
      const { imageData } = await imageFileToImageData(file);

      App._encodeOriginalData = imageData;

      const dataUrl = await StegoLab.Utils.File.readAsDataURL(file);
      imgEl.src = dataUrl;
      imgEl.style.display = 'block';
      if (imgEl.parentElement) imgEl.parentElement.classList.add('has-image');

      const stats = computeImageStats(imageData);
      if (statsContainer) renderStats(statsContainer, stats);

      const headerSize = StegoLab.Core.Header.calculateHeaderSize('file.bin', 'application/octet-stream', false);
      const capacity = computeCapacity(stats, headerSize * 8);
      App._encodeCapacity = capacity;
      const payloadSize = App.encodeFile ? App.encodeFile.size : 0;
      if (capacityContainer) renderCapacity(capacityContainer, capacity, payloadSize);
    } catch (err) {
      alertMsg('encode', 'Failed to load image: ' + err.message, 'error');
    }
  }

  function initDecodeTab() {
    const dropZone = getEl('decode-drop-zone');
    const fileInput = getEl('dec-file');
    const decodeBtn = getEl('dec-btn');
    const imagePreview = getEl('dec-preview');
    const statsContainer = getEl('dec-stats');
    const resultPanel = getEl('dec-result');
    const downloadBtn = getEl('dec-download');
    const passInput = getEl('dec-password');
    const metadataContainer = getEl('dec-metadata');
    const resultCard = getEl('dec-result-card');
    const metadataCard = getEl('dec-metadata-card');

    function hideDecodeResults() {
      if (resultPanel) resultPanel.innerHTML = '<p class="muted">Ready to decode. Click Decode.</p>';
      if (metadataContainer) metadataContainer.innerHTML = '';
      if (resultCard) resultCard.style.display = 'none';
      if (metadataCard) metadataCard.style.display = 'none';
      if (downloadBtn) downloadBtn.style.display = 'none';
    }

    StegoLab.UI.DragDrop.init(dropZone, {
      onFile: (file) => {
        App.decodeFile = file;
        updateDecodePreview(file, imagePreview, statsContainer);
        hideDecodeResults();
      },
      onError: (err) => alertMsg('decode', err.message, 'error')
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        App.decodeFile = fileInput.files[0];
        updateDecodePreview(App.decodeFile, imagePreview, statsContainer);
        hideDecodeResults();
      }
    });

    decodeBtn.addEventListener('click', async () => {
      try {
        if (!App.decodeFile) {
          alertMsg('decode', 'Please select an encoded image.', 'error');
          return;
        }

        clearAlert('decode');
        decodeBtn.disabled = true;
        const progressEl = StegoLab.UI.Progress.create();
        const parent = decodeBtn.parentElement;
        parent.insertBefore(progressEl, decodeBtn.nextSibling);

        const password = passInput ? passInput.value : '';

        const anim = StegoLab.UI.Animation.playDecode(imagePreview);

        let result;
        try {
          result = await StegoLab.Core.Decoder.decode({
            imageFile: App.decodeFile,
            password,
            onStage: (s) => StegoLab.UI.Progress.setStage(s),
            onProgress: (p) => StegoLab.UI.Progress.setProgress(p)
          });
        } catch (err) {
          anim.stop();
          if (err.message === 'PASSWORD_REQUIRED') {
            StegoLab.UI.Progress.destroy();
            decodeBtn.disabled = false;
            if (passInput) passInput.focus();
            alertMsg('decode', 'This image is encrypted. Please enter the password above and decode again.', 'warning');
            return;
          }
          if (err.message.includes('Decryption failed')) {
            StegoLab.UI.Progress.destroy();
            decodeBtn.disabled = false;
            alertMsg('decode', 'Wrong password. Decryption failed.', 'error');
            return;
          }
          throw err;
        }

        await anim.finish();

        const isBundle = await StegoLab.Utils.Bundle.isBundle(result.blob);

        if (isBundle) {
          const files = await StegoLab.Utils.Bundle.unpack(result.blob);
          const urls = files.map(f => URL.createObjectURL(f.blob));
          resultPanel.innerHTML = `
            <div class="result-file-count">${files.length} files recovered</div>
            <div class="result-file-list">
              ${files.map((f, i) => `
                <div class="result-file-item">
                  <span class="result-file-icon">${FILE_ICON_SVG}</span>
                  <div class="result-file-meta">
                    <div class="result-file-name">${StegoLab.Utils.Helpers.escapeHtml(f.name)}</div>
                    <div class="result-file-size">${StegoLab.Utils.Helpers.formatBytes(f.blob.size)}</div>
                  </div>
                  <a class="result-file-download" href="${urls[i]}" download="${StegoLab.Utils.Helpers.escapeHtml(f.name)}">
                    <span>&#8595;</span> download
                  </a>
                </div>
              `).join('')}
            </div>
          `;
          if (downloadBtn) downloadBtn.style.display = 'none';
        } else {
          const displayResult = async () => {
            if (result.mimeType.startsWith('text/') || result.mimeType === 'application/json') {
              const text = await result.blob.text();
              const maxPreview = 5000;
              resultPanel.innerHTML = `<pre class="decoded-text">${StegoLab.Utils.Helpers.escapeHtml(text.slice(0, maxPreview))}${text.length > maxPreview ? '\n... [truncated]' : ''}</pre>`;
            } else if (result.mimeType.startsWith('image/')) {
              const url = URL.createObjectURL(result.blob);
              resultPanel.innerHTML = `<img src="${url}" alt="Decoded image" class="decoded-image" />`;
            } else {
              resultPanel.innerHTML = `<p class="decoded-file-info">Decoded file: <strong>${StegoLab.Utils.Helpers.escapeHtml(result.filename)}</strong> (${StegoLab.Utils.Helpers.formatBytes(result.payloadSize)})</p>`;
            }
          };
          await displayResult();

          if (downloadBtn) {
            downloadBtn.style.display = 'inline-flex';
            downloadBtn.onclick = () => StegoLab.Utils.File.downloadBlob(result.blob, result.filename);
          }
        }

        if (resultCard) resultCard.style.display = '';
        if (metadataCard) metadataCard.style.display = '';

        if (metadataContainer) {
          metadataContainer.innerHTML = `
            <div class="metadata-grid">
              <div class="meta-item"><span class="meta-label">File</span><span class="meta-value">${StegoLab.Utils.Helpers.escapeHtml(result.filename)}</span></div>
              <div class="meta-item"><span class="meta-label">Type</span><span class="meta-value">${isBundle ? 'multi-file bundle' : result.mimeType}</span></div>
              <div class="meta-item"><span class="meta-label">Size</span><span class="meta-value">${StegoLab.Utils.Helpers.formatBytes(result.payloadSize)}</span></div>
              <div class="meta-item"><span class="meta-label">Encrypted</span><span class="meta-value">${result.isEncrypted ? 'Yes' : 'No'}</span></div>
              <div class="meta-item"><span class="meta-label">Compressed</span><span class="meta-value">${result.isCompressed ? 'Yes' : 'No'}</span></div>
              <div class="meta-item"><span class="meta-label">Embedded In</span><span class="meta-value">${result.imageWidth} x ${result.imageHeight}</span></div>
            </div>
          `;
        }

        alertMsg('decode',
          `Decoded in ${(result.duration / 1000).toFixed(2)}s: ${result.filename} (${StegoLab.Utils.Helpers.formatBytes(result.payloadSize)})`,
          'success'
        );

        StegoLab.UI.Progress.setStage('Complete!');
        StegoLab.UI.Progress.setProgress(1);
        setTimeout(() => StegoLab.UI.Progress.destroy(), 2000);
      } catch (err) {
        StegoLab.UI.Progress.setStage('Error');
        alertMsg('decode', err.message || 'Decoding failed', 'error');
      } finally {
        decodeBtn.disabled = false;
      }
    });
  }

  async function updateDecodePreview(file, imgEl, statsContainer) {
    if (!file || !imgEl) return;
    try {
      const { imageFileToImageData } = StegoLab.Utils.File;
      const { computeImageStats, renderStats } = StegoLab.UI.Stats;
      const { imageData } = await imageFileToImageData(file);

      const dataUrl = await StegoLab.Utils.File.readAsDataURL(file);
      imgEl.src = dataUrl;
      imgEl.style.display = 'block';
      if (imgEl.parentElement) imgEl.parentElement.classList.add('has-image');

      const stats = computeImageStats(imageData);
      if (statsContainer) renderStats(statsContainer, stats);
    } catch (err) {
      alertMsg('decode', 'Failed to load image: ' + err.message, 'error');
    }
  }

  function registerShortcuts() {
    const kb = StegoLab.UI.Keyboard;
    kb.register('ctrl+o', () => {
      const input = document.querySelector('.tab-panel.panel-active input[type="file"]');
      if (input) input.click();
    }, 'Open image');
    kb.register('ctrl+e', () => { StegoLab.UI.Dashboard.switchTab('encode'); }, 'Encode tab');
    kb.register('ctrl+d', () => { StegoLab.UI.Dashboard.switchTab('decode'); }, 'Decode tab');
    kb.register('ctrl+s', () => {
      const btn = document.querySelector('#dec-download');
      if (btn && btn.style.display !== 'none') btn.click();
    }, 'Download decoded file');
  }

  function initModals() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('modal-open');
      });
      overlay.querySelector('.modal-close')?.addEventListener('click', () => {
        overlay.classList.remove('modal-open');
      });
    });
  }

  function initHeaderThemeToggle() {
    const btn = getEl('theme-toggle');
    if (btn) {
      const icons = { dark: '◐', light: '◑' };
      const setIcon = (mode) => { btn.textContent = icons[mode] || '◐'; };
      setIcon(StegoLab.UI.Theme.getCurrent());
      btn.addEventListener('click', () => {
        const mode = StegoLab.UI.Theme.cycle();
        setIcon(mode);
      });
    }
  }

})();
