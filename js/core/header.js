var StegoLab = window.StegoLab || {};
StegoLab.Core = StegoLab.Core || {};

StegoLab.Core.Header = (() => {
  const C = StegoLab.Core.Constants;
  const { crc32 } = StegoLab.Utils.CRC32;
  const { toUint64 } = StegoLab.Utils.Helpers;
  const { seededRandom, seedFromDimensions } = StegoLab.Steganography.PRNG;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function obfuscate(bytes, width, height) {
    const seed = seedFromDimensions(width, height, 'header-xor');
    const rng = seededRandom(seed);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      out[i] = bytes[i] ^ rng.nextInt(256);
    }
    return out;
  }

  function buildRaw(options) {
    const {
      payloadLength, filename, mimeType, timestamp,
      isEncrypted, isCompressed, salt, iv, compressedPayload
    } = options;

    const fnBytes = enc.encode(filename || 'message.bin');
    const mimeBytes = enc.encode(mimeType || 'application/octet-stream');

    const fnLen = fnBytes.length;
    const mimeLen = mimeBytes.length;

    let flags = 0;
    if (isEncrypted) flags |= C.FLAG_ENCRYPTED;
    if (isCompressed) flags |= C.FLAG_COMPRESSED;

    const checksum = compressedPayload ? crc32(compressedPayload) : 0;

    const saltSize = isEncrypted ? C.SALT_SIZE : 0;
    const ivSize = isEncrypted ? C.IV_SIZE : 0;

    const headerLen = C.HEADER_FIXED_SIZE + fnLen + 2 + mimeLen + 2 +
      C.TIMESTAMP_SIZE + saltSize + ivSize + C.CRC32_SIZE + C.RESERVED_SIZE;

    const buf = new ArrayBuffer(headerLen);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);
    let offset = 0;

    view.setUint32(offset, 0x53544732, false);
    offset += 4;
    view.setUint8(offset, C.VERSION);
    offset += 1;
    view.setUint8(offset, flags);
    offset += 1;
    view.setUint16(offset, headerLen, false);
    offset += 2;
    view.setUint32(offset, payloadLength, false);
    offset += 4;

    view.setUint16(offset, fnLen, false);
    offset += 2;
    bytes.set(fnBytes, offset);
    offset += fnLen;

    view.setUint16(offset, mimeLen, false);
    offset += 2;
    bytes.set(mimeBytes, offset);
    offset += mimeLen;

    const ts = toUint64(timestamp || Date.now());
    bytes.set(ts, offset);
    offset += C.TIMESTAMP_SIZE;

    if (isEncrypted && salt) {
      bytes.set(salt, offset);
      offset += C.SALT_SIZE;
    } else {
      offset += saltSize;
    }

    if (isEncrypted && iv) {
      bytes.set(iv, offset);
      offset += C.IV_SIZE;
    } else {
      offset += ivSize;
    }

    view.setUint32(offset, checksum, false);
    offset += C.CRC32_SIZE;

    offset += C.RESERVED_SIZE;

    return bytes;
  }

  function build(options) {
    const raw = buildRaw(options);
    return obfuscate(raw, options.width, options.height);
  }

  function parseRaw(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;

    const magic = String.fromCharCode(...bytes.slice(offset, offset + 4));
    offset += 4;
    if (magic !== C.MAGIC) throw new Error('Invalid magic number. Not a StegoLab encoded image.');

    const version = view.getUint8(offset);
    offset += 1;
    if (version !== C.VERSION) throw new Error(`Unsupported version: ${version}`);

    const flags = view.getUint8(offset);
    offset += 1;
    const isEncrypted = !!(flags & C.FLAG_ENCRYPTED);
    const isCompressed = !!(flags & C.FLAG_COMPRESSED);

    const headerLen = view.getUint16(offset, false);
    offset += 2;
    const payloadLength = view.getUint32(offset, false);
    offset += 4;

    const fnLen = view.getUint16(offset, false);
    offset += 2;
    const filename = dec.decode(bytes.slice(offset, offset + fnLen));
    offset += fnLen;

    const mimeLen = view.getUint16(offset, false);
    offset += 2;
    const mimeType = dec.decode(bytes.slice(offset, offset + mimeLen));
    offset += mimeLen;

    const timestamp = StegoLab.Utils.Helpers.fromUint64(bytes.slice(offset, offset + 8));
    offset += 8;

    let salt = null;
    let iv = null;
    if (isEncrypted) {
      salt = bytes.slice(offset, offset + C.SALT_SIZE);
      offset += C.SALT_SIZE;
      iv = bytes.slice(offset, offset + C.IV_SIZE);
      offset += C.IV_SIZE;
    }

    const checksum = view.getUint32(offset, false);
    offset += 4;

    offset += C.RESERVED_SIZE;

    return {
      magic, version, flags, headerLen, payloadLength,
      filename, mimeType, timestamp,
      isEncrypted, isCompressed, salt, iv, checksum
    };
  }

  function parse(bytes, width, height) {
    const raw = obfuscate(bytes, width, height);
    return parseRaw(raw);
  }

  function calculateHeaderSize(filename, mimeType, isEncrypted) {
    const fnBytes = new TextEncoder().encode(filename || 'message.bin');
    const mimeBytes = new TextEncoder().encode(mimeType || 'application/octet-stream');
    const saltSize = isEncrypted ? C.SALT_SIZE : 0;
    const ivSize = isEncrypted ? C.IV_SIZE : 0;
    return C.HEADER_FIXED_SIZE + fnBytes.length + 2 + mimeBytes.length + 2 +
      C.TIMESTAMP_SIZE + saltSize + ivSize + C.CRC32_SIZE + C.RESERVED_SIZE;
  }

  return { build, parse, calculateHeaderSize };
})();
