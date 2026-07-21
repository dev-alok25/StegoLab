var StegoLab = window.StegoLab || {};
StegoLab.Steganography = StegoLab.Steganography || {};

StegoLab.Steganography.PRNG = (() => {
  function mulberry32(seed) {
    let s = seed | 0;
    return function () {
      s |= 0;
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededRandom(seed) {
    const gen = mulberry32(seed);
    return {
      next() { return gen(); },
      nextInt(max) { return Math.floor(gen() * max); },
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(gen() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }
    };
  }

  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & 0x7FFFFFFF;
    }
    return hash >>> 0;
  }

  function seedFromPassword(password) {
    const containerKey = StegoLab.Core.Constants.CONTAINER_KEY;
    const str = (password && password.length > 0) ? containerKey + '::' + password : containerKey + '::default';
    return hashString(str);
  }

  function seedFromDimensions(width, height, salt) {
    const containerKey = StegoLab.Core.Constants.CONTAINER_KEY;
    return hashString(containerKey + '::' + salt + '::' + width + 'x' + height);
  }

  return { mulberry32, seededRandom, seedFromPassword, seedFromDimensions, hashString };
})();
