var StegoLab = window.StegoLab || {};
StegoLab.Core = StegoLab.Core || {};

StegoLab.Core.Constants = {
  MAGIC: 'STG2',
  VERSION: 3,
  CONTAINER_KEY: 'StegoLab::proprietary-container::v3::9f3a1c7e2b5d',

  HEADER_MAGIC_OFFSET: 0,
  HEADER_MAGIC_SIZE: 4,
  HEADER_VERSION_OFFSET: 4,
  HEADER_VERSION_SIZE: 1,
  HEADER_FLAGS_OFFSET: 5,
  HEADER_FLAGS_SIZE: 1,
  HEADER_LENGTH_OFFSET: 6,
  HEADER_LENGTH_SIZE: 2,
  HEADER_PAYLOAD_LENGTH_OFFSET: 8,
  HEADER_PAYLOAD_LENGTH_SIZE: 4,
  HEADER_FILENAME_LENGTH_OFFSET: 12,
  HEADER_FILENAME_LENGTH_SIZE: 2,
  HEADER_FIXED_SIZE: 14,

  FLAG_ENCRYPTED: 1,
  FLAG_COMPRESSED: 2,

  SALT_SIZE: 16,
  IV_SIZE: 12,
  CRC32_SIZE: 4,
  TIMESTAMP_SIZE: 8,
  RESERVED_SIZE: 8,

  PBKDF2_ITERATIONS: 200000,
  PBKDF2_HASH: 'SHA-256',
  AES_MODE: 'AES-GCM',
  AES_KEY_LENGTH: 256,

  CHANNELS: [0, 1, 2],

  SUPPORTED_TYPES: ['image/png', 'image/bmp', 'image/tiff', 'image/webp'],
  SUPPORTED_EXTS: ['.png', '.bmp', '.tiff', '.tif', '.webp'],

  STAGES: {
    READING: 'Reading file...',
    COMPRESSING: 'Compressing data...',
    ENCRYPTING: 'Encrypting data...',
    HEADER: 'Building header...',
    ANALYZING: 'Analyzing image...',
    EMBEDDING: 'Embedding data...',
    EXPORTING: 'Generating output PNG...',
    EXTRACTING: 'Extracting data...',
    DECRYPTING: 'Decrypting...',
    DECOMPRESSING: 'Decompressing...',
    PARSING: 'Parsing header...',
    DONE: 'Complete!'
  }
};
