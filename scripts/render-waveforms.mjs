import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { dirname, join, relative } from "node:path";

const WIDTH = 640;
const HEIGHT = 360;
const INPUT_ROOT = join(process.cwd(), "public/muni/supplementary");
const OUTPUT_ROOT = join(process.cwd(), "public/muni/waveforms");

const COLORS = {
  center: [161, 161, 170, 90],
  shadow: [59, 130, 246, 46],
  wave: [37, 99, 235, 226],
};

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let c = i;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  chunk.writeUInt32BE(crc, 8 + data.length);
  return chunk;
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (stride + 1);
    raw[rawOffset] = 0;
    rgba.copy(raw, rawOffset + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND"),
  ]);
}

function readChunkName(buffer, offset) {
  return buffer.toString("ascii", offset, offset + 4);
}

function parseWav(buffer) {
  if (readChunkName(buffer, 0) !== "RIFF" || readChunkName(buffer, 8) !== "WAVE") {
    throw new Error("Expected a RIFF/WAVE file.");
  }

  let fmt;
  let dataOffset = -1;
  let dataSize = 0;
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const name = readChunkName(buffer, offset);
    const size = buffer.readUInt32LE(offset + 4);
    const bodyOffset = offset + 8;

    if (name === "fmt ") {
      fmt = {
        audioFormat: buffer.readUInt16LE(bodyOffset),
        channels: buffer.readUInt16LE(bodyOffset + 2),
        sampleRate: buffer.readUInt32LE(bodyOffset + 4),
        blockAlign: buffer.readUInt16LE(bodyOffset + 12),
        bitsPerSample: buffer.readUInt16LE(bodyOffset + 14),
      };
    } else if (name === "data") {
      dataOffset = bodyOffset;
      dataSize = size;
    }

    offset = bodyOffset + size + (size % 2);
  }

  if (!fmt || dataOffset < 0) {
    throw new Error("Missing fmt or data chunk.");
  }

  if (![1, 3].includes(fmt.audioFormat)) {
    throw new Error(`Unsupported WAV format ${fmt.audioFormat}.`);
  }

  const frames = Math.floor(dataSize / fmt.blockAlign);
  const samples = new Float32Array(frames);
  const bytesPerSample = fmt.bitsPerSample / 8;

  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    const frameOffset = dataOffset + frame * fmt.blockAlign;

    for (let channel = 0; channel < fmt.channels; channel += 1) {
      const sampleOffset = frameOffset + channel * bytesPerSample;
      let value;

      if (fmt.audioFormat === 3 && fmt.bitsPerSample === 32) {
        value = buffer.readFloatLE(sampleOffset);
      } else if (fmt.bitsPerSample === 16) {
        value = buffer.readInt16LE(sampleOffset) / 32768;
      } else if (fmt.bitsPerSample === 24) {
        value = buffer.readIntLE(sampleOffset, 3) / 8388608;
      } else if (fmt.bitsPerSample === 32) {
        value = buffer.readInt32LE(sampleOffset) / 2147483648;
      } else {
        throw new Error(`Unsupported bit depth ${fmt.bitsPerSample}.`);
      }

      sum += value;
    }

    samples[frame] = sum / fmt.channels;
  }

  return samples;
}

function blendPixel(rgba, width, x, y, color) {
  if (x < 0 || x >= width || y < 0 || y >= HEIGHT) return;

  const offset = (y * width + x) * 4;
  const sourceAlpha = color[3] / 255;
  const targetAlpha = rgba[offset + 3] / 255;
  const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);

  if (outAlpha <= 0) return;

  rgba[offset] = Math.round(
    (color[0] * sourceAlpha + rgba[offset] * targetAlpha * (1 - sourceAlpha)) /
      outAlpha,
  );
  rgba[offset + 1] = Math.round(
    (color[1] * sourceAlpha +
      rgba[offset + 1] * targetAlpha * (1 - sourceAlpha)) /
      outAlpha,
  );
  rgba[offset + 2] = Math.round(
    (color[2] * sourceAlpha +
      rgba[offset + 2] * targetAlpha * (1 - sourceAlpha)) /
      outAlpha,
  );
  rgba[offset + 3] = Math.round(outAlpha * 255);
}

function drawRoundedRect(rgba, x, y, width, height, radius, color) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(WIDTH, Math.ceil(x + width));
  const y1 = Math.min(HEIGHT, Math.ceil(y + height));
  const r = Math.max(0, radius);

  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const dx = Math.max(x + r - px, 0, px - (x + width - r));
      const dy = Math.max(y + r - py, 0, py - (y + height - r));
      if (dx * dx + dy * dy <= r * r + 0.75) {
        blendPixel(rgba, WIDTH, px, py, color);
      }
    }
  }
}

function drawWaveform(samples) {
  const rgba = Buffer.alloc(WIDTH * HEIGHT * 4);
  const paddingX = 32;
  const paddingY = 34;
  const innerWidth = WIDTH - paddingX * 2;
  const innerHeight = HEIGHT - paddingY * 2;
  const centerY = HEIGHT / 2;
  const barGap = 2;
  const barWidth = 3;
  const barStep = barWidth + barGap;
  const barCount = Math.floor(innerWidth / barStep);

  drawRoundedRect(rgba, paddingX, centerY - 1, innerWidth, 2, 1, COLORS.center);

  for (let i = 0; i < barCount; i += 1) {
    const start = Math.floor((i / barCount) * samples.length);
    const end = Math.max(start + 1, Math.floor(((i + 1) / barCount) * samples.length));
    let peak = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      peak = Math.max(peak, Math.abs(samples[sampleIndex]));
    }

    const normalized = Math.max(0.035, Math.sqrt(Math.min(peak, 1)));
    const barHeight = Math.max(4, normalized * innerHeight * 0.86);
    const x = paddingX + i * barStep;
    const y = centerY - barHeight / 2;

    drawRoundedRect(rgba, x + 1, y + 2, barWidth, barHeight, 1.5, COLORS.shadow);
    drawRoundedRect(rgba, x, y, barWidth, barHeight, 1.5, COLORS.wave);
  }

  return encodePng(WIDTH, HEIGHT, rgba);
}

async function collectWavs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectWavs(path)));
    } else if (entry.isFile() && entry.name.endsWith(".wav")) {
      files.push(path);
    }
  }

  return files;
}

const wavFiles = await collectWavs(INPUT_ROOT);
let rendered = 0;

for (const wavFile of wavFiles) {
  const relativePath = relative(INPUT_ROOT, wavFile);
  const outputPath = join(OUTPUT_ROOT, relativePath.replace(/\.wav$/i, ".png"));
  const samples = parseWav(await readFile(wavFile));
  const png = drawWaveform(samples);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, png);
  rendered += 1;
}

console.log(`Rendered ${rendered} waveform assets to ${relative(process.cwd(), OUTPUT_ROOT)}.`);
