const MAGIC = 'STEG';
const HEADER_BYTES = 9;
const encFileInput = document.getElementById('enc-file');
const encPreview = document.getElementById('enc-preview');
const encMsg = document.getElementById('enc-msg');
const encCapacity = document.getElementById('enc-capacity');
const encStatus = document.getElementById('enc-status');
const encButton = document.getElementById('enc-btn');

const decFileInput = document.getElementById('dec-file');
const decPreview = document.getElementById('dec-preview');
const decStatus = document.getElementById('dec-status');
const decStatusText = document.getElementById('dec-status-text');
const decButton = document.getElementById('dec-btn');
const decOutput = document.getElementById('dec-output');
const copyButton = document.getElementById('copy-btn');
const downloadButton = document.getElementById('download-btn');
const themeToggle = document.getElementById('theme-toggle');

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function bytesToBits(bytes) {
  return Array.from(bytes, b => b.toString(2).padStart(8, '0')).join('');
}

function stringToBytes(text) {
  return new TextEncoder().encode(text);
}

function bytesToString(bytes) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function validatePngFile(file) {
  return file && (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png'));
}

function createStatus(element, message, busy = false) {
  element.innerHTML = '';
  if (busy) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    element.appendChild(spinner);
  }
  element.append(message);
}

function setPreview(imageElement, dataUrl) {
  imageElement.src = dataUrl;
  imageElement.style.display = 'block';
}

function clearPreview(imageElement) {
  imageElement.src = '';
  imageElement.style.display = 'none';
}

function computeCapacity(pixels) {
  const maxBytes = Math.floor((pixels - HEADER_BYTES * 8) / 8);
  return {
    pixels,
    maxPlainBytes: maxBytes
  };
}

function updateEncodeInfo() {
  const file = encFileInput.files?.[0];
  if (!file || !validatePngFile(file)) {
    encCapacity.textContent = 'Select a valid PNG image to calculate capacity.';
    clearPreview(encPreview);
    return;
  }
  const url = URL.createObjectURL(file);
  setPreview(encPreview, url);
  const img = new Image();
  img.onload = () => {
    const pixels = img.width * img.height;
    const { maxPlainBytes } = computeCapacity(pixels);
    encCapacity.innerHTML = `
      Image size: ${img.width}×${img.height} (${pixels} pixels)<br />
      Max plain text: ${maxPlainBytes} bytes
    `;
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    encCapacity.textContent = 'Unable to read selected image.';
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

async function getImageDataFromFile(file) {
  const dataUrl = await readFileAsDataURL(file);
  const img = await new Promise((resolve, reject) => {
    const loaded = new Image();
    loaded.onload = () => resolve(loaded);
    loaded.onerror = () => reject(new Error('Invalid image data'));
    loaded.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { ctx, canvas, imageData: ctx.getImageData(0, 0, img.width, img.height) };
}

function buildHeader(lengthBytes) {
  const magicBytes = stringToBytes(MAGIC);
  const header = new Uint8Array(HEADER_BYTES);
  header.set(magicBytes, 0);
  const view = new DataView(header.buffer);
  view.setUint32(5, lengthBytes, false);
  return header;
}

async function createEncodedUrl(file, message) {
  const { imageData, ctx, canvas } = await getImageDataFromFile(file);
  const pixels = imageData.data.length / 4;
  const payload = stringToBytes(message);
  const payloadLength = payload.length;
  const maxPayload = computeCapacity(pixels).maxPlainBytes;

  if (payloadLength > maxPayload) {
    throw new Error('Message too long for selected image.');
  }

  const header = buildHeader(payloadLength);
  const bytes = new Uint8Array(header.length + payload.length);
  bytes.set(header, 0);
  bytes.set(payload, header.length);
  const bits = bytesToBits(bytes);

  const data = imageData.data;
  for (let i = 0; i < bits.length; i++) {
    const idx = i * 4;
    data[idx] = (data[idx] & ~1) | Number(bits[i]);
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function parseDecodedBytes(bytes) {
  const header = bytes.slice(0, HEADER_BYTES);
  const magic = bytesToString(header.slice(0, 4));
  if (magic !== MAGIC) {
    throw new Error('The image is not encoded with this tool.');
  }
  const length = new DataView(header.buffer).getUint32(5, false);
  const payload = bytes.slice(HEADER_BYTES, HEADER_BYTES + length);
  if (payload.length !== length) {
    throw new Error('Incomplete hidden message in image.');
  }
  return bytesToString(payload);
}

async function decodeImage(file) {
  const { imageData } = await getImageDataFromFile(file);
  const pixels = imageData.data.length / 4;
  let bits = '';
  for (let i = 0; i < pixels; i++) {
    bits += (imageData.data[i * 4] & 1).toString();
  }
  if (bits.length < HEADER_BYTES * 8) {
    throw new Error('No hidden data found. The image is not encoded with this tool.');
  }
  const byteCount = Math.floor(bits.length / 8);
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return parseDecodedBytes(bytes);
}

async function handleEncode() {
  const file = encFileInput.files?.[0];
  if (!file || !validatePngFile(file)) throw new Error('Please select a PNG image.');
  const message = encMsg.value || '';
  const start = performance.now();
  createStatus(encStatus, 'Encoding...', true);
  const dataUrl = await createEncodedUrl(file, message);
  const elapsed = ((performance.now() - start) / 1000).toFixed(2);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = 'stego-output.png';
  link.textContent = 'Download encoded PNG';
  link.className = 'download-link';
  encStatus.innerHTML = '';
  encStatus.append(link, ` · Done in ${elapsed}s`);
}

async function handleDecode() {
  const file = decFileInput.files?.[0];
  if (!file || !validatePngFile(file)) throw new Error('Please select a PNG image.');
  const start = performance.now();
  createStatus(decStatus, 'Decoding...', true);
  const text = await decodeImage(file);
  const elapsed = ((performance.now() - start) / 1000).toFixed(2);
  decStatus.textContent = `Done in ${elapsed}s`;
  decStatusText.textContent = 'Decoded successfully.';
  decOutput.textContent = text || '[No text found]';
  copyButton.disabled = false;
  downloadButton.disabled = false;
}

function setDecodedPreview(file) {
  if (!file) {
    clearPreview(decPreview);
    return;
  }
  const src = URL.createObjectURL(file);
  setPreview(decPreview, src);
  decPreview.onload = () => URL.revokeObjectURL(src);
}

function setEncodePreview(file) {
  if (!file) {
    clearPreview(encPreview);
    return;
  }
  const src = URL.createObjectURL(file);
  setPreview(encPreview, src);
  encPreview.onload = () => URL.revokeObjectURL(src);
}

function copyDecodedText() {
  const text = decOutput.textContent;
  if (!text || text.startsWith('[No text')) return;
  navigator.clipboard.writeText(text).catch(() => {});
}

function downloadDecodedText() {
  const text = decOutput.textContent;
  if (!text || text.startsWith('[No text')) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'decoded-message.txt';
  link.click();
  URL.revokeObjectURL(link.href);
}

function toggleTheme() {
  document.documentElement.classList.toggle('light');
  themeToggle.textContent = document.documentElement.classList.contains('light') ? '☀️' : '🌙';
}

encFileInput.addEventListener('change', () => {
  updateEncodeInfo();
  setEncodePreview(encFileInput.files?.[0]);
});
encMsg.addEventListener('input', updateEncodeInfo);

decFileInput.addEventListener('change', () => {
  setDecodedPreview(decFileInput.files?.[0]);
  decStatusText.textContent = 'Ready to decode.';
});
encButton.addEventListener('click', async () => {
  try {
    await handleEncode();
  } catch (error) {
    createStatus(encStatus, `Error: ${error.message || error}`, false);
  }
});
decButton.addEventListener('click', async () => {
  try {
    await handleDecode();
  } catch (error) {
    createStatus(decStatus, `Error: ${error.message || error}`, false);
    decStatusText.textContent = 'Unable to decode.';
    decOutput.textContent = '';
  }
});
copyButton.addEventListener('click', copyDecodedText);
downloadButton.addEventListener('click', downloadDecodedText);
themeToggle.addEventListener('click', toggleTheme);

document.addEventListener('DOMContentLoaded', () => {
  clearPreview(encPreview);
  clearPreview(decPreview);
  copyButton.disabled = true;
  downloadButton.disabled = true;
});
