var StegoLab = window.StegoLab || {};
StegoLab.Steganography = StegoLab.Steganography || {};

StegoLab.Steganography.Sobel = (() => {
  const GX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1]
  ];
  const GY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1]
  ];

  function computeMagnitudes(imageData) {
    const { data, width, height } = imageData;
    const magnitudes = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = 0.299 * (data[idx] & ~1) + 0.587 * (data[idx + 1] & ~1) + 0.114 * (data[idx + 2] & ~1);
            gx += gray * GX[ky + 1][kx + 1];
            gy += gray * GY[ky + 1][kx + 1];
          }
        }
        magnitudes[y * width + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    return magnitudes;
  }

  return { computeMagnitudes };
})();
