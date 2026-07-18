const MAGIC = 'STEG';
const HEADER_BYTES = 9;
const ENCRYPTION_OVERHEAD = 28;
const encFileInput = document.getElementById('enc-file');
const encPreview = document.getElementById('enc-preview');
const encMsg = document.getElementById('enc-msg');
const encPassphrase = document.getElementById('enc-passphrase');
const encCapacity = document.getElementById('enc-capacity');
const encStatus = document.getElementById('enc-status');
const encButton = document.getElementById('enc-btn');

const decFileInput = document.getElementById('dec-file');
const decPreview = document.getElementById('dec-preview');
const decPassphrase = document.getElementById('dec-passphrase');
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
    maxPlainBytes: maxBytes,
    maxEncryptedBytes: Math.max(0, maxBytes - ENCRYPTION_OVERHEAD)
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
    const { maxPlainBytes, maxEncryptedBytes } = computeCapacity(pixels);
    encCapacity.innerHTML = `
      Image size: ${img.width}×${img.height} (${pixels} pixels)<br />
      Max plain text: ${maxPlainBytes} bytes<br />
      Max encrypted text: ${maxEncryptedBytes} bytes
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
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Invalid image data'));
    image.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { image, ctx, canvas, imageData: ctx.getImageData(0, 0, img.width, img.height) };
}

function buildHeader(flags, lengthBytes) {
  const magicBytes = stringToBytes(MAGIC);
  const header = new Uint8Array(HEADER_BYTES);
  header.set(magicBytes, 0);
  header[4] = flags;
  const view = new DataView(header.buffer);
  view.setUint32(5, lengthBytes, false);
  return header;
}

async function deriveKey(passphrase, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    stringToBytes(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptPayload(payload, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
  return { salt, iv, cipher: new Uint8Array(cipherBuffer) };
}

async function decryptPayload(payload, passphrase) {
  const salt = payload.slice(0, 16);
  const iv = payload.slice(16, 28);
  const cipher = payload.slice(28);
  const key = await deriveKey(passphrase, salt);
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new Uint8Array(plainBuffer);
}

async function createEncodedUrl(file, message, passphrase) {
  const { imageData, ctx, canvas } = await getImageDataFromFile(file);
  const pixels = imageData.data.length / 4;
  const plainBytes = stringToBytes(message);
  let payload;
  let flags = 0;

  if (passphrase) {
    const encrypted = await encryptPayload(plainBytes, passphrase);
    payload = new Uint8Array(encrypted.salt.length + encrypted.iv.length + encrypted.cipher.length);
    payload.set(encrypted.salt, 0);
    payload.set(encrypted.iv, 16);
    payload.set(encrypted.cipher, 28);
    flags = 1;
  } else {
    payload = plainBytes;
  }

  const payloadLength = payload.length;
  const maxPayload = computeCapacity(pixels).maxPlainBytes;
  const maxEncrypted = computeCapacity(pixels).maxEncryptedBytes;
  if ((!passphrase && payloadLength > maxPayload) || (passphrase && payloadLength > maxEncrypted)) {
    throw new Error('Message too long for selected image.');
  }

  const header = buildHeader(flags, payloadLength);
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

async function parseDecodedBytes(bytes, passphrase) {
  const header = bytes.slice(0, HEADER_BYTES);
  const magic = bytesToString(header.slice(0, 4));
  if (magic !== MAGIC) throw new Error('The image is not encoded with this tool.');
  const flags = header[4];
  const length = new DataView(header.buffer).getUint32(5, false);
  const payload = bytes.slice(HEADER_BYTES, HEADER_BYTES + length);
  if (payload.length !== length) throw new Error('Incomplete hidden message in image.');

  if (flags === 1) {
    if (!passphrase) {
      return { text: null, encrypted: true };
    }
    const decrypted = await decryptPayload(payload, passphrase);
    return { text: bytesToString(decrypted), encrypted: true };
  }

  return { text: bytesToString(payload), encrypted: false };
}

async function decodeImage(file, passphrase) {
  const { imageData } = await getImageDataFromFile(file);
  const pixels = imageData.data.length / 4;
  let bits = '';
  for (let i = 0; i < pixels; i++) {
    bits += (imageData.data[i * 4] & 1).toString();
  }
  if (bits.length < HEADER_BYTES * 8) throw new Error('No hidden data found. The image is not encoded with this tool.');

  const byteCount = Math.floor(bits.length / 8);
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }

  return parseDecodedBytes(bytes, passphrase);
}

async function handleEncode() {
  const file = encFileInput.files?.[0];
  if (!file || !validatePngFile(file)) throw new Error('Please select a PNG image.');
  const message = encMsg.value || '';
  const passphrase = encPassphrase.value || '';
  const start = performance.now();
  createStatus(encStatus, 'Encoding...', true);
  const dataUrl = await createEncodedUrl(file, message, passphrase);
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
  const passphrase = decPassphrase.value || '';
  const start = performance.now();
  createStatus(decStatus, 'Decoding...', true);
  const { text, encrypted } = await decodeImage(file, passphrase);
  const elapsed = ((performance.now() - start) / 1000).toFixed(2);
  decStatus.textContent = `Done in ${elapsed}s`;
  decStatusText.textContent = encrypted && !text
    ? 'Encoded with passphrase. Enter the passphrase to view the message.'
    : 'Decoded successfully.';
  decOutput.textContent = text || '[No text available or passphrase required]';
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
encPassphrase.addEventListener('input', updateEncodeInfo);
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