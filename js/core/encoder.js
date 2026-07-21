var StegoLab = window.StegoLab || {};
StegoLab.Core = StegoLab.Core || {};

StegoLab.Core.Encoder = (() => {
  const { imageFileToImageData } = StegoLab.Utils.File;
  const { compress } = StegoLab.Compression.GZip;
  const { encrypt } = StegoLab.Crypto.AES;
  const { build, calculateHeaderSize } = StegoLab.Core.Header;
  const { embedHeader, embedAdaptive } = StegoLab.Steganography.Embedder;

  // Hard ceiling so we never try to allocate an absurd canvas (browser tabs
  // typically choke well before this). ~40 megapixels is generous headroom.
  const MAX_UPSCALE_PIXELS = 40_000_000;
  const MAX_UPSCALE_DIMENSION = 8000;

  function upscaleImageData(canvas, imageData, width, height, targetWidth, targetHeight) {
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = width;
    srcCanvas.height = height;
    srcCanvas.getContext('2d').putImageData(imageData, 0, 0);

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(srcCanvas, 0, 0, width, height, 0, 0, targetWidth, targetHeight);

    return ctx.getImageData(0, 0, targetWidth, targetHeight);
  }

  async function encode({ file, imageFile, password, onStage, onProgress }) {
    const startTime = performance.now();

    onStage(StegoLab.Core.Constants.STAGES.READING);
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    let payload = fileBytes;
    let isCompressed = false;
    let compressedSize = null;

    if (StegoLab.Compression.GZip.isSupported()) {
      onStage(StegoLab.Core.Constants.STAGES.COMPRESSING);
      onProgress(0);
      const compressed = await compress(fileBytes);
      if (compressed.length < fileBytes.length) {
        payload = compressed;
        isCompressed = true;
        compressedSize = compressed.length;
      }
    }

    let isEncrypted = false;
    let salt = null;
    let iv = null;

    if (password && password.length > 0) {
      onStage(StegoLab.Core.Constants.STAGES.ENCRYPTING);
      onProgress(0);
      const result = await encrypt(payload, password);
      payload = result.encrypted;
      salt = result.salt;
      iv = result.iv;
      isEncrypted = true;
    }

    onStage(StegoLab.Core.Constants.STAGES.ANALYZING);
    onProgress(0);
    let { canvas, imageData, width, height } = await imageFileToImageData(imageFile);

    const headerSize = calculateHeaderSize(file.name, file.type || StegoLab.Utils.File.getMimeFromExt(file.name), isEncrypted);
    const headerBits = headerSize * 8;
    const payloadBits = payload.length * 8;
    // 5% headroom so rounding in the header/embed math never lands us exactly
    // at the edge of capacity.
    const neededPixels = Math.ceil((headerBits + Math.ceil(payloadBits / 3)) * 1.05);

    let wasUpscaled = false;
    let originalDimensions = null;
    let newDimensions = null;

    if (neededPixels > width * height) {
      onStage('Growing carrier image to fit payload...');
      onProgress(0);

      const scaleFactor = Math.sqrt(neededPixels / (width * height));
      let targetWidth = Math.ceil(width * scaleFactor);
      let targetHeight = Math.ceil(height * scaleFactor);

      // Respect the hard ceilings, scaling both dimensions down proportionally
      // if needed so aspect ratio is preserved.
      const dimCap = Math.min(
        MAX_UPSCALE_DIMENSION / Math.max(targetWidth, targetHeight),
        Math.sqrt(MAX_UPSCALE_PIXELS / (targetWidth * targetHeight))
      );
      if (dimCap < 1) {
        targetWidth = Math.floor(targetWidth * dimCap);
        targetHeight = Math.floor(targetHeight * dimCap);
      }

      if (targetWidth * targetHeight < neededPixels) {
        throw new Error(
          `Payload is too large even after upscaling the carrier image to its safe maximum (${targetWidth}x${targetHeight}). Use a bigger carrier image or a smaller payload.`
        );
      }

      originalDimensions = { width, height };
      imageData = upscaleImageData(canvas, imageData, width, height, targetWidth, targetHeight);
      width = targetWidth;
      height = targetHeight;
      newDimensions = { width, height };
      wasUpscaled = true;
    }

    let hadTransparency = false;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] !== 255) { hadTransparency = true; }
      imageData.data[i] = 255;
    }

    onStage(StegoLab.Core.Constants.STAGES.HEADER);
    onProgress(0);
    const header = build({
      payloadLength: payload.length,
      filename: file.name,
      mimeType: file.type || StegoLab.Utils.File.getMimeFromExt(file.name),
      timestamp: file.lastModified || Date.now(),
      isEncrypted,
      isCompressed,
      salt,
      iv,
      compressedPayload: payload,
      width,
      height
    });

    const headerBitsActual = header.length * 8;
    const pixelOffset = Math.ceil(headerBitsActual);

    onStage(StegoLab.Core.Constants.STAGES.EMBEDDING);
    onProgress(0);

    embedHeader({ imageData, payload: header, width, height });

    const { imageData: modifiedData, modifiedCount } = embedAdaptive({
      imageData, payload, password, pixelOffset, onProgress
    });

    onStage(StegoLab.Core.Constants.STAGES.EXPORTING);
    onProgress(0);
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(modifiedData, 0, 0);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

    const duration = performance.now() - startTime;
    onProgress(1);
    onStage(StegoLab.Core.Constants.STAGES.DONE);

    return {
      blob,
      filename: 'stego-output.png',
      metadata: {
        duration,
        originalSize: fileBytes.length,
        compressedSize,
        payloadSize: payload.length,
        totalEmbedded: header.length + payload.length,
        isEncrypted,
        isCompressed,
        modifiedCount,
        imageWidth: width,
        imageHeight: height,
        hadTransparency,
        wasUpscaled,
        originalDimensions,
        newDimensions
      }
    };
  }

  return { encode };
})();
