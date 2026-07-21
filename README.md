<div align="center">

# StegoLab

**Hide any file inside an image — entirely in your browser.**

No uploads. No server. No build step. Just open `index.html`.

</div>

## What is StegoLab?

StegoLab is a client-side steganography tool: it hides an arbitrary file (a document, another image, a ZIP, audio, plain text — anything) inside a carrier image, so the output looks like an ordinary picture but secretly carries your payload. Everything happens locally in the browser using the Canvas API and the Web Crypto API — nothing is ever sent to a server.

Under the hood it's more than basic LSB embedding: payload bytes can be GZIP-compressed and AES-256-GCM encrypted before Sobel edge detection picks the highest-detail pixels to hide them in, and a password-seeded PRNG scrambles the exact embedding order so the layout can't be reconstructed without the password.

## Features

- **Hide any file type** — text, PDF, ZIP, images, audio, or anything else, inside a PNG, BMP, TIFF, or WebP carrier image
- **Optional AES-256-GCM encryption** — password-based, with PBKDF2 key derivation (200,000 iterations) and a random salt/IV per file
- **Automatic GZIP compression** — applied before encryption when it actually reduces size
- **Adaptive LSB embedding** — Sobel edge detection ranks pixels so data is hidden in high-detail regions first, where changes are least visible
- **Password-seeded PRNG** — randomizes embedding order and channel rotation (R/G/B) so the layout can't be recovered without the password
- **Capacity & security stats** — live capacity estimate while picking a payload, plus modified-pixel count and PSNR after encoding
- **Hex viewer** — inspect a decoded payload's raw bytes
- **Dark/light theme**, drag-and-drop or click-to-browse for both the carrier image and the payload file, keyboard shortcuts

## Quick start

1. Open `index.html` in a modern browser (Chrome, Firefox, Edge, or Safari).
2. **Encode:** pick a carrier image and a payload file (or type a message), optionally set a password, then click **Encode**. A PNG with the hidden data downloads automatically.
3. **Decode:** pick the encoded image, enter the password if it was encrypted, then click **Decode** to recover the original file.

## Project structure

```
StegoLab/
├── index.html
├── styles.css
├── LICENSE
├── app/
│   └── StegoLab Setup 1.0.0.exe
└── js/
    ├── app.js                  # wires up the UI and orchestrates encode/decode
    ├── core/
    │   ├── constants.js        # magic bytes, flags, header layout, crypto params
    │   ├── header.js           # binary header build/parse
    │   ├── encoder.js          # full encode pipeline
    │   └── decoder.js          # full decode pipeline
    ├── crypto/
    │   └── aes.js              # AES-256-GCM encrypt/decrypt (Web Crypto API)
    ├── compression/
    │   └── gzip.js             # GZIP via CompressionStream
    ├── steganography/
    │   ├── prng.js             # Mulberry32 PRNG, password-seeded
    │   ├── sobel.js             # edge-magnitude computation
    │   ├── embedder.js         # adaptive LSB embedding
    │   └── extractor.js        # LSB extraction (mirrors embedder)
    ├── ui/
    │   ├── dashboard.js        # tab switching
    │   ├── theme.js            # dark/light theme + persistence
    │   ├── animation.js        # full-screen encode/decode animation overlay
    │   ├── progress.js         # progress bar during encode/decode
    │   ├── dragdrop.js         # drag-and-drop + click-to-browse for images
    │   ├── keyboard.js         # keyboard shortcut registry
    │   └── stats.js            # image stats, capacity, security analysis
    ├── utils/
    │   ├── crc32.js            # payload checksum
    │   ├── helpers.js          # byte/format helpers
    │   ├── bundle.js           # payload bundling helpers
    │   └── file.js             # file reading, image decoding, MIME/type detection
    └── storage/
        └── settings.js         # small localStorage key-value wrapper
```

## How it works

```
                               ┌─────────────────┐
                               │   Carrier Image  │
                               │  (PNG/BMP/TIFF) │
                               └────────┬────────┘
                                        │
┌────────────┐     ┌───────────┐     ┌──▼──────────┐     ┌────────────┐     ┌──────────┐
│  Payload   │────>│  GZIP     │────>│  AES-256-   │────>│   Sobel    │────>│  Adaptive│
│  (any file)│     │  Compress │     │  GCM Encrypt│     │  Edge      │     │  LSB     │
└────────────┘     └───────────┘     └─────────────┘     │  Detection │     │  Embed   │
                                                         └────────────┘     └────┬─────┘
                    ┌──────────┐     ┌────────────┐     ┌────────────┐          │
                    │  Binary  │<────│  Header    │<────│  PRNG      │<─────────┘
                    │  Output  │     │  (magic,   │     │  (password │
                    │  PNG     │     │  flags,    │     │   seeded)  │
                    └──────────┘     │  CRC32...) │     └────────────┘
                                     └────────────┘

                    ┌──────────┐     ┌────────────┐     ┌────────────┐
                    │  Encoded │────>│  Header    │────>│  PRNG      │
                    │  Image   │     │  Parse     │     │  (password │
                    └──────────┘     └────────────┘     │   seeded)  │
                                                         └──────┬─────┘
┌────────────┐     ┌───────────┐     ┌─────────────┐          │
│  Original  │<────│  GZIP     │<────│  AES-256-   │<─────────┘
│  Payload   │     │  Decompress│    │  GCM Decrypt│
└────────────┘     └───────────┘     └─────────────┘
```

**Header:** a small binary header (magic bytes, version, flags, filename, MIME type, payload length, timestamp, CRC32, and — if encrypted — salt and IV) is embedded sequentially in the image so it can always be parsed, even without a password.

**Payload placement:** Sobel edge detection scores every pixel, and the highest-detail pixels are used first. Within that set, a PRNG seeded from the password (or a fixed seed if none is given) shuffles both the pixel order and the R/G/B channel used for each bit, so the embedding pattern can't be reconstructed without the password.

**Encryption/compression:** payload bytes are GZIP-compressed (skipped if that doesn't help), then optionally encrypted with AES-256-GCM using a PBKDF2-derived key, before being embedded.

## Browser support

Requires Canvas, the Web Crypto API, and (for compression) `CompressionStream` — supported in current Chrome, Firefox, Edge, and Safari. If `CompressionStream` isn't available, compression is silently skipped.

## Credits

Built by [Alok](https://github.com/dev-alok25) and [Prateek](https://github.com/KairosBuilds).

## License

MIT — see [LICENSE](./LICENSE).
