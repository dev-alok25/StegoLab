var StegoLab = window.StegoLab || {};
StegoLab.Utils = StegoLab.Utils || {};

/**
 * Packs multiple files into a single File so they can be hidden through the
 * existing single-payload encode pipeline unchanged, and unpacks them again
 * after decode. Purely a client-side container format — has nothing to do
 * with the actual steganography/crypto layer.
 */
StegoLab.Utils.Bundle = (() => {
  const MAGIC = 'SLABNDL1';
  const MIME = 'application/x-stegolab-bundle';
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  async function pack(files) {
    if (!files || files.length === 0) throw new Error('No files to bundle');
    if (files.length === 1) return files[0];

    const magicBytes = enc.encode(MAGIC);
    const parts = [magicBytes];

    const countBuf = new ArrayBuffer(4);
    new DataView(countBuf).setUint32(0, files.length, false);
    parts.push(new Uint8Array(countBuf));

    for (const file of files) {
      const nameBytes = enc.encode(file.name || 'file.bin');
      const typeBytes = enc.encode(file.type || 'application/octet-stream');
      const dataBytes = new Uint8Array(await file.arrayBuffer());

      const head = new ArrayBuffer(4 + nameBytes.length + 4 + typeBytes.length + 4);
      const view = new DataView(head);
      let off = 0;
      view.setUint32(off, nameBytes.length, false); off += 4;
      new Uint8Array(head, off, nameBytes.length).set(nameBytes); off += nameBytes.length;
      view.setUint32(off, typeBytes.length, false); off += 4;
      new Uint8Array(head, off, typeBytes.length).set(typeBytes); off += typeBytes.length;
      view.setUint32(off, dataBytes.length, false);

      parts.push(new Uint8Array(head));
      parts.push(dataBytes);
    }

    const blob = new Blob(parts, { type: MIME });
    const totalName = files.length + '-files.slab';
    return new File([blob], totalName, { type: MIME });
  }

  async function isBundle(blob) {
    if (!blob) return false;
    const head = new Uint8Array(await blob.slice(0, MAGIC.length).arrayBuffer());
    return dec.decode(head) === MAGIC;
  }

  async function unpack(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let off = 0;

    const magic = dec.decode(buf.subarray(0, MAGIC.length));
    if (magic !== MAGIC) throw new Error('Not a StegoLab bundle');
    off += MAGIC.length;

    const count = view.getUint32(off, false); off += 4;
    const files = [];

    for (let i = 0; i < count; i++) {
      const nameLen = view.getUint32(off, false); off += 4;
      const name = dec.decode(buf.subarray(off, off + nameLen)); off += nameLen;
      const typeLen = view.getUint32(off, false); off += 4;
      const type = dec.decode(buf.subarray(off, off + typeLen)); off += typeLen;
      const dataLen = view.getUint32(off, false); off += 4;
      const data = buf.slice(off, off + dataLen); off += dataLen;

      files.push({ name, type, blob: new Blob([data], { type: type || 'application/octet-stream' }) });
    }

    return files;
  }

  return { pack, unpack, isBundle, MIME };
})();
