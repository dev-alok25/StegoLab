var StegoLab = window.StegoLab || {};
StegoLab.Utils = StegoLab.Utils || {};

StegoLab.Utils.File = (() => {
  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  function getExtension(filename) {
    const i = filename.lastIndexOf('.');
    return i >= 0 ? filename.slice(i).toLowerCase() : '';
  }

  function getMimeFromExt(filename) {
    const ext = getExtension(filename);
    const map = {
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.rar': 'application/vnd.rar',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.exe': 'application/octet-stream',
      '.bin': 'application/octet-stream'
    };
    return map[ext] || 'application/octet-stream';
  }

  async function imageFileToImageData(file) {
    const dataUrl = await readAsDataURL(file);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode image'));
      el.src = dataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return { canvas, ctx, imageData: ctx.getImageData(0, 0, img.width, img.height), width: img.width, height: img.height };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function isImageFile(file) {
    if (!file) return false;
    const constants = StegoLab.Core && StegoLab.Core.Constants;
    const supportedTypes = (constants && constants.SUPPORTED_TYPES) || [];
    const supportedExts = (constants && constants.SUPPORTED_EXTS) || [];

    if (file.type && supportedTypes.includes(file.type)) return true;

    // Fall back to extension check — file.type can be empty/wrong
    // (e.g. some browsers don't set a MIME type for .tiff/.tif).
    const ext = getExtension(file.name || '');
    return supportedExts.includes(ext);
  }

  return {
    readAsDataURL,
    getExtension,
    getMimeFromExt,
    imageFileToImageData,
    downloadBlob,
    isImageFile
  };
})();
