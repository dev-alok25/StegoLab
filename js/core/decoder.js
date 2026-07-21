var StegoLab = window.StegoLab || {};
StegoLab.Core = StegoLab.Core || {};

StegoLab.Core.Decoder = (() => {
  const { imageFileToImageData, getMimeFromExt } = StegoLab.Utils.File;
  const { decompress } = StegoLab.Compression.GZip;
  const { decrypt } = StegoLab.Crypto.AES;
  const { parse } = StegoLab.Core.Header;
  const { extractHeader, extractAdaptive } = StegoLab.Steganography.Extractor;
  const C = StegoLab.Core.Constants;

  async function decode({ imageFile, password, onStage, onProgress }) {
    const startTime = performance.now();

    onStage(C.STAGES.READING);
    onProgress(0);
    const { imageData, width, height } = await imageFileToImageData(imageFile);
    const totalPixels = width * height;

    onStage(C.STAGES.PARSING);

    const maxHeaderBytes = 256;
    const readBytes = Math.min(maxHeaderBytes, totalPixels);

    const headerCandidate = extractHeader({ imageData, payloadLength: readBytes, width, height });

    let parsedHeader;
    try {
      parsedHeader = parse(headerCandidate, width, height);
    } catch {
      throw new Error('No StegoLab header found. This image is not encoded with this tool.');
    }

    const headerSize = parsedHeader.headerLen;
    if (headerSize > readBytes) {
      const headerBytes = extractHeader({ imageData, payloadLength: headerSize, width, height });
      parsedHeader = parse(headerBytes, width, height);
    }

    let needsPassword = parsedHeader.isEncrypted;
    let actualPassword = password;

    if (needsPassword && (!password || password.length === 0)) {
      throw new Error('PASSWORD_REQUIRED');
    }

    const pixelOffset = Math.ceil(headerSize * 8);

    onStage(C.STAGES.EXTRACTING);
    onProgress(0);

    const extractedPayload = extractAdaptive({
      imageData,
      payloadLength: parsedHeader.payloadLength,
      password: actualPassword || '',
      pixelOffset,
      onProgress
    });

    let payloadData = extractedPayload;

    if (parsedHeader.isEncrypted) {
      onStage(C.STAGES.DECRYPTING);
      onProgress(0);
      payloadData = await decrypt(
        payloadData,
        actualPassword,
        parsedHeader.salt,
        parsedHeader.iv
      );
    }

    if (parsedHeader.isCompressed) {
      onStage(C.STAGES.DECOMPRESSING);
      onProgress(0);
      payloadData = await decompress(payloadData);
    }

    const duration = performance.now() - startTime;
    onProgress(1);
    onStage(C.STAGES.DONE);

    const mimeType = parsedHeader.mimeType || getMimeFromExt(parsedHeader.filename);
    const fileBlob = new Blob([payloadData], { type: mimeType });

    return {
      blob: fileBlob,
      filename: parsedHeader.filename || 'decoded-file.bin',
      mimeType,
      payloadSize: payloadData.length,
      originalPayloadSize: parsedHeader.payloadLength,
      isEncrypted: parsedHeader.isEncrypted,
      isCompressed: parsedHeader.isCompressed,
      timestamp: parsedHeader.timestamp,
      headerInfo: parsedHeader,
      duration,
      imageWidth: width,
      imageHeight: height
    };
  }

  return { decode };
})();
