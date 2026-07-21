var StegoLab = window.StegoLab || {};
StegoLab.Crypto = StegoLab.Crypto || {};

StegoLab.Crypto.AES = (() => {
  const ITERATIONS = StegoLab.Core.Constants.PBKDF2_ITERATIONS;
  const HASH = StegoLab.Core.Constants.PBKDF2_HASH;
  const SALT_SIZE = StegoLab.Core.Constants.SALT_SIZE;
  const IV_SIZE = StegoLab.Core.Constants.IV_SIZE;

  async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: ITERATIONS,
        hash: HASH
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encrypt(data, password) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
    const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));
    const key = await deriveKey(password, salt);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return { encrypted: new Uint8Array(encrypted), salt, iv };
  }

  async function decrypt(data, password, salt, iv) {
    try {
      const key = await deriveKey(password, salt);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      return new Uint8Array(decrypted);
    } catch {
      throw new Error('Decryption failed. Wrong password or corrupted data.');
    }
  }

  return { encrypt, decrypt };
})();
