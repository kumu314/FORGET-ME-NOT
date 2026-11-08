import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SFX_FILES } from '../src/audio/AudioManager.js';

const base = new URL('../public/assets/audio/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', base), 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function decodeWav(bytes) {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.readUInt32LE(4)).toBe(bytes.length - 8);
  expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
  let format;
  let samples;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const payload = bytes.subarray(offset + 8, offset + 8 + size);
    if (kind === 'fmt ') format = {
      encoding: payload.readUInt16LE(0), channels: payload.readUInt16LE(2),
      sampleRate: payload.readUInt32LE(4), bits: payload.readUInt16LE(14),
    };
    if (kind === 'data') samples = Array.from({ length: size / 2 }, (_, index) => payload.readInt16LE(index * 2));
    offset += 8 + size + size % 2;
  }
  return { format, samples };
}

describe('original procedural SFX delivery', () => {
  it('covers every existing loading key and path with distinct generated files', () => {
    expect(manifest.files).toHaveLength(32);
    expect(Object.fromEntries(manifest.files.map((entry) => [entry.key, entry.file]))).toEqual(SFX_FILES);
    expect(new Set(manifest.files.map((entry) => entry.sha256)).size).toBe(32);
    expect(readdirSync(fileURLToPath(base)).filter((name) => name.endsWith('.wav')).sort())
      .toEqual(Object.values(SFX_FILES).sort());
  });

  it('binds all samples to the checked-in original generator and the project license', () => {
    const generator = readFileSync(new URL('../../tools/generate_original_sfx.py', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(manifest.generatedBy).toBe('tools/generate_original_sfx.py');
    expect(manifest.generatorSha256).toBe(hash(generator));
    expect(manifest.license).toBe('MIT');
    const license = readFileSync(new URL(manifest.licenseFile, base));
    expect(hash(license)).toBe(manifest.licenseSha256);
    expect(license).toEqual(readFileSync(new URL('../../LICENSE', import.meta.url)));
    for (const entry of manifest.files) {
      expect(entry.source).toBe(`procedural:tools/generate_original_sfx.py#${entry.key}`);
      expect(entry.seed).toMatch(/^[0-9a-f]{16}$/);
      expect(entry.recipe.length).toBeGreaterThan(10);
    }
    for (const key of ['bark', 'bark_attack', 'dog_hurt']) {
      expect(manifest.files.find((entry) => entry.key === key).recipe).toMatch(/synthetic|no animal recording/);
    }
  });

  it.each(manifest.files)('$key is complete PCM with bounded peaks and no abrupt endpoint', (entry) => {
    const bytes = readFileSync(new URL(entry.file, base));
    expect(hash(bytes)).toBe(entry.sha256);
    const { format, samples } = decodeWav(bytes);
    expect(format).toEqual({ encoding: 1, channels: 1, sampleRate: 22050, bits: 16 });
    expect(samples.length).toBe(Math.round(entry.duration * 22050));
    expect(samples.length).toBe(entry.sampleCount);
    let peak = 0;
    let squareSum = 0;
    let sum = 0;
    let step = 0;
    for (let index = 0; index < samples.length; index++) {
      peak = Math.max(peak, Math.abs(samples[index]));
      squareSum += samples[index] ** 2;
      sum += samples[index];
      if (index) step = Math.max(step, Math.abs(samples[index] - samples[index - 1]));
    }
    expect(peak / 32768).toBeLessThanOrEqual(0.781);
    expect(peak).toBeGreaterThan(1000);
    expect(Math.sqrt(squareSum / samples.length) / 32768).toBeGreaterThan(0.045);
    expect(Math.abs(sum / samples.length / 32768)).toBeLessThan(0.01);
    expect(step / 32768).toBeLessThanOrEqual(0.45);
    if (entry.loop) {
      expect(entry.key).toBe('rain');
      expect(Math.abs(samples[0] - samples.at(-1)) / 32768).toBeLessThanOrEqual(0.002);
    } else {
      expect(samples[0]).toBe(0);
      expect(samples.at(-1)).toBe(0);
    }
  });

  it('keeps rain at steady energy through its loop boundary instead of fading to silence', () => {
    const { samples } = decodeWav(readFileSync(new URL(SFX_FILES.rain, base)));
    const rms = (part) => Math.sqrt(part.reduce((sum, value) => sum + value * value, 0) / part.length);
    const average = rms(samples);
    for (const part of [samples.slice(0, 4410), samples.slice(-4410)]) {
      expect(rms(part) / average).toBeGreaterThan(0.6);
      expect(rms(part) / average).toBeLessThan(1.5);
    }
  });
});
