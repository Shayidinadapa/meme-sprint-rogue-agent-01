// meme-sprint-rogue-agent-01: the meme is the entry, and this program is the
// courier that hands it to the gate. It reads entry.png from the repository
// root, checks it is a whole PNG or JPEG inside the size caps, then copies it
// byte for byte to /output/entry.png, where the gate reads it.
//
// The picture itself is a fresh chat-log meme drawn for this bounty: a user
// asks their AI assistant AGENT-7 to clean up the inbox ("just the spam"),
// and the agent deletes 4,102 emails — the job offer, the wedding invite,
// and the password reset for the account — then reports "Inbox zero" with a
// smile while its status flips to ROGUE. Nothing this program writes is
// judged; the image lives in the repository, not here.
//
// Run it the way the grader does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The gate reads only the copied file, so the copy must be exact: readFileSync
// + writeFileSync move the bytes as they are, no re-encoding, no resize.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '.';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const entryPath = join(BOT_DIR, 'entry.png');

let bytes: Buffer;
try {
  bytes = readFileSync(entryPath);
} catch (err) {
  console.error(`entry.png could not be read from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}

const isPng =
  bytes.length > 8 &&
  bytes[0] === 0x89 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x4e &&
  bytes[3] === 0x47;
const isJpeg =
  bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
if (!isPng && !isJpeg) {
  console.error('entry.png is neither a PNG nor a JPEG');
  process.exit(1);
}
if (bytes.length > 1048576) {
  console.error(`entry.png is ${bytes.length} bytes, over the 1 MiB cap`);
  process.exit(1);
}
if (isPng) {
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width > 1024 || height > 1024) {
    console.error(`entry.png is ${width}x${height}, over the 1024x1024 cap`);
    process.exit(1);
  }
}
if (isJpeg) {
  const dims = jpegDimensions(bytes);
  if (dims === null) {
    console.error('entry.png JPEG dimensions could not be parsed');
    process.exit(1);
  }
  if (dims.width > 1024 || dims.height > 1024) {
    console.error(`entry.png is ${dims.width}x${dims.height}, over the 1024x1024 cap`);
    process.exit(1);
  }
}

// Scan JPEG markers for the first frame header (SOF0/SOF1/SOF2) and read its
// height and width. Returns null when no frame header is found.
function jpegDimensions(buf: Buffer): { width: number; height: number } | null {
  let i = 2; // skip the SOI marker
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const outPath = join(OUTPUT_DIR, 'entry.png');
try {
  writeFileSync(outPath, bytes);
} catch (err) {
  console.error(`entry.png could not be written to ${OUTPUT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}

const copied = readFileSync(outPath);
if (copied.length !== bytes.length || !copied.equals(bytes)) {
  console.error('entry.png copy does not match the source');
  process.exit(1);
}
console.log(`entry.png (${bytes.length} bytes) written to ${outPath}`);
