# StegoLab

A browser-based PNG steganography prototype.

## Features

- Encode hidden text in PNG images
- Decode hidden text from encoded PNGs
- Optional passphrase encryption
- PNG-only validation
- Image preview and capacity display
- Copy or download decoded text

## Usage

1. Open `index.html` in a browser.
2. In the **Encode** section:
   - select a PNG image
   - enter a secret message
   - optionally provide a passphrase
   - click **Encode & Download**
3. In the **Decode** section:
   - select an encoded PNG
   - optionally enter the same passphrase
   - click **Decode**

## Deployment

- Push this repo to GitHub
- Enable GitHub Pages for the repository
- GitHub Pages will serve `index.html` from the repo root

## Notes

- This is a prototype, not a secure communications tool.
- Hidden text is encrypted only when a passphrase is provided.