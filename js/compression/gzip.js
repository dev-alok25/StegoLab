var StegoLab = window.StegoLab || {};
StegoLab.Compression = StegoLab.Compression || {};

StegoLab.Compression.GZip = (() => {
  const COMPRESSION_STREAM_SUPPORTED = typeof CompressionStream !== 'undefined';

  async function compress(data) {
    if (!COMPRESSION_STREAM_SUPPORTED) {
      throw new Error('CompressionStream API not available in this browser');
    }
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();
    const reader = cs.readable.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((a, c) => a + c.byteLength, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      result.set(new Uint8Array(c), offset);
      offset += c.byteLength;
    }
    return result;
  }

  async function decompress(data) {
    if (!COMPRESSION_STREAM_SUPPORTED) {
      throw new Error('DecompressionStream API not available in this browser');
    }
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((a, c) => a + c.byteLength, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      result.set(new Uint8Array(c), offset);
      offset += c.byteLength;
    }
    return result;
  }

  function isSupported() {
    return COMPRESSION_STREAM_SUPPORTED;
  }

  return { compress, decompress, isSupported };
})();
