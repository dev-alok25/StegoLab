var StegoLab = window.StegoLab || {};
StegoLab.Steganography = StegoLab.Steganography || {};

StegoLab.Steganography.Embedder = (() => {
  const { seededRandom, seedFromPassword, seedFromDimensions } = StegoLab.Steganography.PRNG;
  const { computeMagnitudes } = StegoLab.Steganography.Sobel;
  const CHANNELS = StegoLab.Core.Constants.CHANNELS;

  function headerChannelOrder(totalBits, width, height) {
    const seed = seedFromDimensions(width, height, 'header-channels');
    const rng = seededRandom(seed);
    const channelRotation = new Uint8Array(totalBits);
    for (let i = 0; i < totalBits; i++) {
      channelRotation[i] = CHANNELS[rng.nextInt(3)];
    }
    return channelRotation;
  }

  function embedHeader({ imageData, payload, width, height }) {
    const { data } = imageData;
    const totalBits = payload.length * 8;
    const channelRotation = headerChannelOrder(totalBits, width, height);
    let modifiedCount = 0;

    for (let i = 0; i < totalBits; i++) {
      const pixelIdx = i;
      const channel = channelRotation[i];
      const byteIdx = pixelIdx * 4 + channel;
      const bit = (payload[i >> 3] >> (7 - (i & 7))) & 1;
      const oldVal = data[byteIdx];
      data[byteIdx] = (oldVal & ~1) | bit;
      if ((oldVal & 1) !== bit) modifiedCount++;
    }

    return { imageData, modifiedCount, bitsUsed: totalBits };
  }

  function embedAdaptive({ imageData, payload, password, pixelOffset, onProgress }) {
    const { data, width, height } = imageData;
    const totalPixels = width * height;
    const totalBits = payload.length * 8;
    const usablePixels = totalPixels - pixelOffset;
    const capacityBits = usablePixels * 3;

    if (totalBits > capacityBits) {
      throw new Error('Payload too large for this image capacity.');
    }

    const magnitudes = computeMagnitudes(imageData);
    const pixelOrder = new Uint32Array(usablePixels);
    for (let i = 0; i < usablePixels; i++) pixelOrder[i] = i + pixelOffset;

    pixelOrder.sort((a, b) => magnitudes[b] - magnitudes[a]);

    // Expand each ranked pixel into its 3 channel slots so all available
    // capacity (not just 1 bit/pixel) is actually usable.
    const slots = new Uint32Array(usablePixels * 3);
    for (let p = 0; p < usablePixels; p++) {
      const pixelIdx = pixelOrder[p];
      slots[p * 3] = pixelIdx * 3;
      slots[p * 3 + 1] = pixelIdx * 3 + 1;
      slots[p * 3 + 2] = pixelIdx * 3 + 2;
    }

    const seed = seedFromPassword(password);
    const rng = seededRandom(seed);

    const usedSlots = slots.slice(0, totalBits);
    rng.shuffle(usedSlots);

    const reportInterval = Math.max(1, Math.floor(totalBits / 20));
    let modifiedCount = 0;

    for (let i = 0; i < totalBits; i++) {
      const slot = usedSlots[i];
      const pixelIdx = (slot / 3) | 0;
      const channel = slot % 3;
      const byteIdx = pixelIdx * 4 + channel;
      const bit = (payload[i >> 3] >> (7 - (i & 7))) & 1;
      const oldVal = data[byteIdx];
      data[byteIdx] = (oldVal & ~1) | bit;
      if ((oldVal & 1) !== bit) modifiedCount++;

      if (onProgress && i % reportInterval === 0) {
        onProgress(i / totalBits);
      }
    }

    if (onProgress) onProgress(1);

    return { imageData, modifiedCount, bitsUsed: totalBits };
  }

  return { embedHeader, embedAdaptive };
})();
