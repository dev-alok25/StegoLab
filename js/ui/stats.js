var StegoLab = window.StegoLab || {};
StegoLab.UI = StegoLab.UI || {};

StegoLab.UI.Stats = (() => {
  function computeImageStats(imageData) {
    const { data, width, height } = imageData;
    const totalPixels = width * height;
    let sumR = 0, sumG = 0, sumB = 0;
    let entropyR = 0, entropyG = 0, entropyB = 0;

    const histR = new Uint32Array(256);
    const histG = new Uint32Array(256);
    const histB = new Uint32Array(256);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      sumR += data[idx];
      sumG += data[idx + 1];
      sumB += data[idx + 2];
      histR[data[idx]]++;
      histG[data[idx + 1]]++;
      histB[data[idx + 2]]++;
    }

    const avgR = sumR / totalPixels;
    const avgG = sumG / totalPixels;
    const avgB = sumB / totalPixels;

    for (let i = 0; i < 256; i++) {
      if (histR[i] > 0) {
        const p = histR[i] / totalPixels;
        entropyR -= p * Math.log2(p);
      }
      if (histG[i] > 0) {
        const p = histG[i] / totalPixels;
        entropyG -= p * Math.log2(p);
      }
      if (histB[i] > 0) {
        const p = histB[i] / totalPixels;
        entropyB -= p * Math.log2(p);
      }
    }

    const avgEntropy = (entropyR + entropyG + entropyB) / 3;

    return {
      width,
      height,
      totalPixels,
      channels: 3,
      avgColor: { r: Math.round(avgR), g: Math.round(avgG), b: Math.round(avgB) },
      entropy: avgEntropy,
      entropyR,
      entropyG,
      entropyB
    };
  }

  function computeCapacity(stats, headerBits) {
    const headerBitsVal = headerBits || 0;
    const maxBits = stats.totalPixels * 3 - headerBitsVal;
    const maxBytes = Math.floor(maxBits / 8);
    return {
      maxBits,
      maxBytes,
      headerBits: headerBitsVal,
      width: stats.width,
      height: stats.height,
      totalPixels: stats.totalPixels
    };
  }

  // Mirrors the projection used by the encoder's auto-upscale so the UI can
  // show what will actually happen instead of just reporting "over capacity".
  function projectUpscale(capacity, payloadBytes) {
    const payloadBits = payloadBytes * 8;
    const neededPixels = Math.ceil((capacity.headerBits + Math.ceil(payloadBits / 3)) * 1.05);
    if (neededPixels <= capacity.totalPixels) return null;

    const scaleFactor = Math.sqrt(neededPixels / capacity.totalPixels);
    const width = Math.ceil(capacity.width * scaleFactor);
    const height = Math.ceil(capacity.height * scaleFactor);
    return { width, height };
  }

  function computeSecurity(imageData, originalData) {
    if (!originalData) return null;

    let modifiedPixels = 0;
    let totalMSE = 0;
    const { data } = imageData;
    const { data: origData } = originalData;
    const totalPixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== origData[i] ||
          data[i + 1] !== origData[i + 1] ||
          data[i + 2] !== origData[i + 2]) {
        modifiedPixels++;
      }
      totalMSE += (data[i] - origData[i]) ** 2;
      totalMSE += (data[i + 1] - origData[i + 1]) ** 2;
      totalMSE += (data[i + 2] - origData[i + 2]) ** 2;
    }

    const mse = totalMSE / (totalPixels * 3);
    const psnr = mse > 0 ? 10 * Math.log10((255 * 255) / mse) : Infinity;
    const modPercent = (modifiedPixels / totalPixels) * 100;

    let detectability = 'Low';
    if (psnr < 35) detectability = 'High';
    else if (psnr < 45) detectability = 'Medium';

    return {
      modifiedPixels,
      modPercent,
      psnr: psnr === Infinity ? Infinity : Math.round(psnr * 100) / 100,
      detectability,
      embeddingDensity: modPercent
    };
  }

  function renderStats(container, stats) {
    if (!container) return;
    container.innerHTML = `
      <div class="stat-item"><span class="stat-label">Resolution</span><span class="stat-value">${stats.width} x ${stats.height}</span></div>
      <div class="stat-item"><span class="stat-label">Pixels</span><span class="stat-value">${stats.totalPixels.toLocaleString()}</span></div>
      <div class="stat-item"><span class="stat-label">Channels</span><span class="stat-value">${stats.channels} (RGB)</span></div>
      <div class="stat-item"><span class="stat-label">Avg Color</span><span class="stat-value">RGB(${stats.avgColor.r}, ${stats.avgColor.g}, ${stats.avgColor.b})</span></div>
      <div class="stat-item"><span class="stat-label">Est. Entropy</span><span class="stat-value">${stats.entropy.toFixed(2)} bits/pixel</span></div>
    `;
  }

  function renderCapacity(container, capacity, payloadSize) {
    if (!container) return;
    const used = payloadSize || 0;
    const pct = capacity.maxBytes > 0 ? (used / capacity.maxBytes) * 100 : 0;
    const fitsNatively = used <= capacity.maxBytes;
    const remaining = Math.max(0, capacity.maxBytes - used);

    if (fitsNatively) {
      const success = pct < 90 ? 'High' : 'Marginal';
      container.innerHTML = `
        <div class="stat-item"><span class="stat-label">Max Capacity</span><span class="stat-value">${StegoLab.Utils.Helpers.formatBytes(capacity.maxBytes)}</span></div>
        <div class="stat-item"><span class="stat-label">Message</span><span class="stat-value">${StegoLab.Utils.Helpers.formatBytes(used)}</span></div>
        <div class="stat-item"><span class="stat-label">Remaining</span><span class="stat-value">${StegoLab.Utils.Helpers.formatBytes(remaining)}</span></div>
        <div class="stat-item"><span class="stat-label">Usage</span><span class="stat-value">${pct.toFixed(1)}%</span></div>
        <div class="stat-item"><span class="stat-label">Est. Success</span><span class="stat-value value-good">${success}</span></div>
      `;
      return;
    }

    // Payload exceeds this image's native capacity — the encoder will
    // auto-upscale the carrier to fit, so reflect that instead of "Failed".
    const projection = projectUpscale(capacity, used);
    container.innerHTML = `
      <div class="stat-item"><span class="stat-label">Max Capacity</span><span class="stat-value">${StegoLab.Utils.Helpers.formatBytes(capacity.maxBytes)}</span></div>
      <div class="stat-item"><span class="stat-label">Message</span><span class="stat-value">${StegoLab.Utils.Helpers.formatBytes(used)}</span></div>
      <div class="stat-item"><span class="stat-label">Over Capacity By</span><span class="stat-value value-warn">${StegoLab.Utils.Helpers.formatBytes(used - capacity.maxBytes)}</span></div>
      <div class="stat-item"><span class="stat-label">Will Resize To</span><span class="stat-value">${projection ? projection.width + ' x ' + projection.height : 'exceeds max size'}</span></div>
      <div class="stat-item"><span class="stat-label">Est. Success</span><span class="stat-value ${projection ? 'value-good' : 'value-bad'}">${projection ? 'Auto-Upscale' : 'Too Large'}</span></div>
    `;
  }

  function renderSecurity(container, security) {
    if (!container || !security) return;
    const detClass = security.detectability === 'Low' ? 'safe' :
      security.detectability === 'Medium' ? 'warning' : 'danger';

    container.innerHTML = `
      <div class="stat-item"><span class="stat-label">Modified Pixels</span><span class="stat-value">${security.modifiedPixels.toLocaleString()}</span></div>
      <div class="stat-item"><span class="stat-label">Modification</span><span class="stat-value">${security.modPercent.toFixed(2)}%</span></div>
      <div class="stat-item"><span class="stat-label">PSNR</span><span class="stat-value">${security.psnr === Infinity ? '∞' : security.psnr + ' dB'}</span></div>
      <div class="stat-item"><span class="stat-label">Detectability</span><span class="stat-value ${detClass}">${security.detectability}</span></div>
      <div class="stat-item"><span class="stat-label">Embedding Density</span><span class="stat-value">${security.embeddingDensity.toFixed(2)}%</span></div>
    `;
  }

  return { computeImageStats, computeCapacity, computeSecurity, renderStats, renderCapacity, renderSecurity, projectUpscale };
})();
