#!/usr/bin/env node
/**
 * Self-test for `verify-lift-shots.mjs`.
 *
 * A verifier nobody has broken on purpose is a verifier nobody knows works.
 * This copies a real captured sequence, injects each failure the tool exists to
 * catch, and asserts the tool rejects it FOR THE RIGHT REASON — each mutant
 * declares the message it must provoke, so a check cannot be credited for a
 * rejection some unrelated clause happened to produce.
 *
 * Two of the mutants are here because the tool's second version passed them.
 * Eight of its nine mutants edited manifest JSON only, and the ninth copied one
 * stage PNG onto another — the single pixel mutation a byte hash can catch. So
 * nothing tested whether the tool could see:
 *
 *   FROZEN SPRITE — everything left of the bar-path panel held at one frame
 *   while the trace keeps drawing. A whole-canvas hash never notices, because
 *   the trace is redrawn from history at every beat.
 *
 *   TRANSPLANTED SEQUENCE — the light sequence's pictures copied over the
 *   maximal one's, both manifests untouched. The tool used to sign off with
 *   "the maximal one animates heavier" over two byte-identical sets of images.
 *
 * Both require WRITING pixels, so this file carries a small PNG encoder. That
 * encoder is also what keeps `tools/png.mjs` honest: `decoderRoundTrip()` below
 * encodes known pixels under every filter type and every colour type the
 * decoder claims to support and asserts they read back exactly, so a
 * mis-decoded scanline shows up here rather than as a confident wrong number
 * about a screenshot.
 *
 * Usage: node tools/verify-lift-shots.selftest.mjs [--root .gauntlet/shots]
 */
import { cp, mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodePng } from './png.mjs';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERIFIER = path.join(HERE, 'verify-lift-shots.mjs');

const args = process.argv.slice(2);
const flagAt = args.indexOf('--root');
const sourceRoot = path.resolve(flagAt === -1 ? '.gauntlet/shots' : args[flagAt + 1]);

/**
 * Stage geometry in logical points, restated from `LIFT_TUNING.LAYOUT` so the
 * frozen-sprite mutant can freeze exactly the lifter and nothing else.
 *
 * THE MUTANT IS DELIBERATELY MORE ADVERSARIAL THAN "hold the whole frame". It
 * holds the lifter's box at one frame while leaving BOTH the bar-path trace AND
 * the cue ring drawn live from the real frame. A verifier that hashed the
 * canvas sees the trace move. A verifier that compared the sprite box without
 * punching the cue ring out of it sees the ring shrink. Only a verifier that
 * looks at the lifter's own pixels sees that the lifter never moved.
 */
const STAGE_PT = Object.freeze({ W: 390, H: 520 });
const SPRITE_BOX_PT = Object.freeze({ x: 6, y: 292, w: 96 * 3, h: 72 * 3 });
const CUE_PT = Object.freeze({ cx: 150, cy: 374, r: 50 });

// ---------------------------------------------------------------------------
// PNG encoding (node:zlib only, matching `tools/sprites.mjs` and `card.mjs`)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Encode 8-bit samples as a PNG, forcing one filter type on every scanline.
 *
 * `filter` is a parameter rather than an adaptive choice because the point of
 * the round-trip test is to exercise all five un-filters, not to compress well.
 *
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} samples  width*height*channels, row-major
 * @param {number} colourType   0, 2, 4 or 6
 * @param {number} filter       0..4
 */
function encodePng(width, height, samples, colourType, filter) {
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colourType];
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const out = y * (stride + 1);
    raw[out] = filter;
    for (let i = 0; i < stride; i += 1) {
      const x = samples[y * stride + i];
      const a = i >= channels ? samples[y * stride + i - channels] : 0;
      const b = y > 0 ? samples[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= channels ? samples[(y - 1) * stride + i - channels] : 0;
      let value;
      switch (filter) {
        case 0: value = x; break;
        case 1: value = x - a; break;
        case 2: value = x - b; break;
        case 3: value = x - ((a + b) >> 1); break;
        default: value = x - paeth(a, b, c); break;
      }
      raw[out + 1 + i] = value & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colourType;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Re-encode a decoded image as RGBA. Used by the pixel mutants. */
function encodeRgba(image) {
  return encodePng(image.width, image.height, image.rgba, 6, 0);
}

// ---------------------------------------------------------------------------
// The decoder has to be right before anything it measures means anything
// ---------------------------------------------------------------------------

/** Patch one byte of the IHDR payload and fix its CRC, to forge a header. */
function mutateIhdr(png, byteInPayload, value) {
  const out = Buffer.from(png);
  const payload = 8 + 8; // signature + length + type
  out[payload + byteInPayload] = value;
  const body = out.subarray(payload - 4, payload + 13);
  out.writeUInt32BE(crc32(body), payload + 13);
  return out;
}

/**
 * A PNG whose filtered bytes were worked out BY HAND from the spec, with the
 * pixels it must decode to written out beside them.
 *
 * THE ROUND-TRIP ABOVE CANNOT REPLACE THIS. It encodes with the same Paeth
 * predictor the decoder inverts with, so any Paeth error that is symmetric —
 * and a wrong tie-break is exactly that — cancels out and the round-trip stays
 * green while real Chromium screenshots decode to garbage. Verified: changing
 * `pb <= pc` to `pb < pc` in the decoder leaves the round-trip passing and is
 * caught only here.
 *
 * Greyscale so the filters act on single bytes and the arithmetic below can be
 * followed by hand. Two rows carry the ties the spec's ordering exists for:
 *
 *   row 3 px 2: left 0, above 30, above-left 20 -> pa 10, pb 20, pc 10.
 *               `pa <= pc` ties; the spec takes LEFT (0). Taking above-left
 *               instead would decode 29 rather than 9.
 *   row 4 px 1: left 18, above 0, above-left 12 -> pa 12, pb 6, pc 6.
 *               `pb <= pc` ties; the spec takes ABOVE (0). Taking above-left
 *               instead would decode 17 rather than 5.
 *
 *   row 0  filter 0 (None)   raw    0  10  20  30   ->  10  20  30
 *   row 1  filter 4 (Paeth)  raw    4  30 226 236   ->  40  10   0
 *   row 2  filter 4 (Paeth)  raw    4 221  15  20   ->   5  20  30
 *   row 3  filter 4 (Paeth)  raw    4   7 236   9   ->  12   0   9
 *   row 4  filter 4 (Paeth)  raw    4   6   5   3   ->  18   5  12
 *
 * The third comparison, `pa <= pb`, has no vector here because it cannot have
 * one: if pa == pb and a != b then c is the midpoint of a and b, which forces
 * pc == 0 < pa and sends the spec down the same branch a weakened `pa < pb`
 * would. Weakening it is an equivalent mutation, not a gap in this fixture.
 */
const PAETH_REFERENCE = Object.freeze({
  raw: [
    0, 10, 20, 30,
    4, 30, 226, 236,
    4, 221, 15, 20,
    4, 7, 236, 9,
    4, 6, 5, 3,
  ],
  expectedGrey: [10, 20, 30, 40, 10, 0, 5, 20, 30, 12, 0, 9, 18, 5, 12],
  width: 3,
  height: 5,
});

function paethReferenceVector() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(PAETH_REFERENCE.width, 0);
  ihdr.writeUInt32BE(PAETH_REFERENCE.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 0; // greyscale, one channel, so the filters act on single bytes
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.from(PAETH_REFERENCE.raw))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  const decoded = decodePng(png);
  const problems = [];
  for (let p = 0; p < PAETH_REFERENCE.expectedGrey.length; p += 1) {
    const got = decoded.rgba[p * 4];
    if (got !== PAETH_REFERENCE.expectedGrey[p]) {
      problems.push(
        `hand-computed Paeth vector: pixel ${p} decoded to ${got}, spec says ` +
          `${PAETH_REFERENCE.expectedGrey[p]}`,
      );
    }
  }
  return problems;
}

function decoderRoundTrip() {
  const width = 37;
  const height = 23;
  const problems = paethReferenceVector();
  for (const colourType of [0, 2, 4, 6]) {
    const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colourType];
    const samples = new Uint8Array(width * height * channels);
    // A pattern with gradients, wrap-around and hard edges, so a wrong filter
    // reconstruction cannot coincidentally land on the right bytes.
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = (i * 37 + ((i / channels) | 0) * 11 + (i % channels) * 83) & 0xff;
    }
    for (let filter = 0; filter <= 4; filter += 1) {
      const decoded = decodePng(encodePng(width, height, samples, colourType, filter));
      if (decoded.width !== width || decoded.height !== height) {
        problems.push(`colour ${colourType} filter ${filter}: size ${decoded.width}x${decoded.height}`);
        continue;
      }
      for (let p = 0; p < width * height; p += 1) {
        const s = p * channels;
        const d = p * 4;
        const expected =
          colourType === 0
            ? [samples[s], samples[s], samples[s], 255]
            : colourType === 2
              ? [samples[s], samples[s + 1], samples[s + 2], 255]
              : colourType === 4
                ? [samples[s], samples[s], samples[s], samples[s + 1]]
                : [samples[s], samples[s + 1], samples[s + 2], samples[s + 3]];
        for (let c = 0; c < 4; c += 1) {
          if (decoded.rgba[d + c] !== expected[c]) {
            problems.push(
              `colour ${colourType} filter ${filter}: pixel ${p} channel ${c} is ` +
                `${decoded.rgba[d + c]}, expected ${expected[c]}`,
            );
            p = width * height;
            break;
          }
        }
      }
    }
  }
  // It must also REFUSE what it does not implement rather than guessing. A
  // decoder that returns plausible garbage for a 16-bit or interlaced PNG would
  // produce confident numbers about pixels that were never there.
  const refusals = [
    ['a buffer that is not a PNG', Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])],
    ['a 16-bit PNG', mutateIhdr(encodePng(4, 4, new Uint8Array(48), 2, 0), 8, 16)],
    ['an interlaced PNG', mutateIhdr(encodePng(4, 4, new Uint8Array(48), 2, 0), 12, 1)],
  ];
  for (const [what, bytes] of refusals) {
    let refused = false;
    try {
      decodePng(bytes);
    } catch {
      refused = true;
    }
    if (!refused) problems.push(`decoder accepted ${what}`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Mutants
// ---------------------------------------------------------------------------

async function verify(root) {
  try {
    const { stdout, stderr } = await run(process.execPath, [VERIFIER, '--root', root], {
      maxBuffer: 1 << 26,
    });
    return { ok: true, output: `${stdout}${stderr}` };
  } catch (e) {
    return { ok: false, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

async function withCopy(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'lift-shots-'));
  await cp(sourceRoot, dir, { recursive: true });
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function editManifest(root, seq, edit) {
  const file = path.join(root, seq, 'manifest.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  edit(manifest);
  await writeFile(file, JSON.stringify(manifest, null, 2));
}

/**
 * Hold the lifter at the first frame in every stage image, while leaving the
 * bar-path trace and the cue ring exactly as they were really drawn.
 */
async function freezeSprite(root, seq) {
  const stageDir = path.join(root, seq, 'stage');
  const names = (await readdir(stageDir)).filter((n) => n.endsWith('.png')).sort();
  const first = decodePng(await readFile(path.join(stageDir, names[0])));
  const scale = first.width / STAGE_PT.W;
  const box = {
    x: Math.round(SPRITE_BOX_PT.x * scale),
    y: Math.round(SPRITE_BOX_PT.y * scale),
    w: Math.round(SPRITE_BOX_PT.w * scale),
    h: Math.round(SPRITE_BOX_PT.h * scale),
  };
  const cue = { cx: CUE_PT.cx * scale, cy: CUE_PT.cy * scale, r: CUE_PT.r * scale };
  for (const name of names.slice(1)) {
    const file = path.join(stageDir, name);
    const image = decodePng(await readFile(file));
    for (let y = box.y; y < box.y + box.h; y += 1) {
      for (let x = box.x; x < box.x + box.w; x += 1) {
        const dx = x - cue.cx;
        const dy = y - cue.cy;
        // Leave the cue ring's footprint drawn live, so a check that forgot to
        // punch it out would still see motion here and let this through.
        if (dx * dx + dy * dy <= cue.r * cue.r) continue;
        const i = (y * image.width + x) * 4;
        image.rgba[i] = first.rgba[i];
        image.rgba[i + 1] = first.rgba[i + 1];
        image.rgba[i + 2] = first.rgba[i + 2];
        image.rgba[i + 3] = first.rgba[i + 3];
      }
    }
    await writeFile(file, encodeRgba(image));
  }
}

const MUTANTS = [
  {
    name: 'THE ORIGINAL FAILURE: three shots are all the resolved frame',
    expect: /rendered phase|identical state|same tick/,
    apply: async (root) => {
      await editManifest(root, 'L1-maximal', (m) => {
        const resolved = m.shots.find((s) => s.moment === 'result');
        for (const moment of ['descent', 'hole', 'losing']) {
          const shot = m.shots.find((s) => s.moment === moment);
          shot.probe = { ...resolved.probe, moment };
        }
      });
      // ...and give each a distinct byte, exactly as a dev-menu glyph did.
      for (const moment of ['01-descent', '03-hole', '05-losing']) {
        const src = path.join(root, 'L1-maximal', '08-result.png');
        const dst = path.join(root, 'L1-maximal', `${moment}.png`);
        const bytes = Buffer.concat([await readFile(src), Buffer.from(moment)]);
        await writeFile(dst, bytes);
      }
    },
  },
  {
    name: 'a shot is in the wrong phase',
    expect: /rendered phase LOCKOUT, expected ASCENT/,
    apply: (root) =>
      editManifest(root, 'L1-maximal', (m) => {
        m.shots.find((s) => s.moment === 'losing').probe.phase = 'LOCKOUT';
      }),
  },
  {
    name: 'the rep never lost anywhere (no grind)',
    expect: /there is no grind in this sequence/,
    apply: (root) =>
      editManifest(root, 'L1-maximal', (m) => {
        for (const shot of m.shots) if (shot.probe.netForce < 0) shot.probe.netForce = 0.1;
      }),
  },
  {
    name: 'the maximal attempt never reaches the top strain rung',
    expect: /peak strain level 2, expected the top authored rung 3/,
    apply: (root) =>
      editManifest(root, 'L1-maximal', (m) => {
        for (const shot of m.shots) shot.probe.strainLevel = Math.min(shot.probe.strainLevel, 2);
      }),
  },
  {
    name: 'the maximal attempt draws no heavier than the light one',
    expect: /the heavy rep does not draw more strained/,
    apply: (root) =>
      editManifest(root, 'L1-maximal', (m) => {
        for (const shot of m.shots) shot.probe.strainLevel = 0;
      }),
  },
  {
    name: 'no shot is anywhere near the sticking point',
    expect: /no shot within .* of the sticking point/,
    apply: (root) =>
      editManifest(root, 'L1-maximal', (m) => {
        for (const shot of m.shots) if (shot.probe.phase === 'ASCENT') shot.probe.height = 0.05;
      }),
  },
  {
    name: 'the replay route never engaged, so a shot has no probe',
    expect: /no probe — the shot may be of a live rep/,
    apply: (root) =>
      editManifest(root, 'L1-light', (m) => {
        m.shots.find((s) => s.moment === 'hole').probe = null;
      }),
  },
  {
    name: 'one stage frame is a byte copy of another',
    expect: /the sprite is frozen/,
    apply: async (root) => {
      const src = path.join(root, 'L1-maximal', 'stage', '05-losing.png');
      const dst = path.join(root, 'L1-maximal', 'stage', '06-sticking-point.png');
      await writeFile(dst, await readFile(src));
    },
  },
  {
    name: 'the captured rep was a miss',
    expect: /the captured rep was a miss/,
    apply: (root) =>
      editManifest(root, 'L1-maximal', (m) => {
        m.shots.find((s) => s.moment === 'result').probe.outcome = 'miss';
      }),
  },
  {
    // NEW. The failure a whole-canvas hash structurally cannot see.
    name: 'NEW: the sprite is frozen while the bar-path trace keeps animating',
    expect: /the sprite is frozen and only the trace and cue ring are animating/,
    apply: (root) => freezeSprite(root, 'L1-maximal'),
  },
  {
    // NEW. The exploit that passed the previous version verbatim.
    name: 'NEW: the maximal sequence IS the light sequence, both manifests untouched',
    expect: /the drawing is not responding to load/,
    apply: async (root) => {
      const from = path.join(root, 'L1-light');
      const to = path.join(root, 'L1-maximal');
      for (const name of (await readdir(from)).filter((n) => n.endsWith('.png'))) {
        await writeFile(path.join(to, name), await readFile(path.join(from, name)));
      }
      const stageFrom = path.join(from, 'stage');
      const stageTo = path.join(to, 'stage');
      for (const name of (await readdir(stageFrom)).filter((n) => n.endsWith('.png'))) {
        await writeFile(path.join(stageTo, name), await readFile(path.join(stageFrom, name)));
      }
    },
  },
];

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const decoderProblems = decoderRoundTrip();
if (decoderProblems.length > 0) {
  console.error('DECODER ROUND-TRIP FAILED — every pixel measurement below is untrustworthy');
  for (const p of decoderProblems.slice(0, 10)) console.error(`  ${p}`);
  process.exit(2);
}
console.log(
  'decoder: 4 colour types x 5 filter types round-trip exactly, a hand-computed Paeth vector ' +
    'decodes to spec, and 16-bit / interlaced / non-PNG inputs are refused',
);

const baseline = await verify(sourceRoot);
if (!baseline.ok) {
  console.error('BASELINE FAILED — the real sequence does not pass, so nothing below means anything');
  console.error(baseline.output);
  process.exit(2);
}

const survived = [];
for (const mutant of MUTANTS) {
  // eslint-disable-next-line no-await-in-loop
  const verdict = await withCopy(async (root) => {
    await mutant.apply(root);
    const result = await verify(root);
    if (result.ok) return { caught: false, why: 'the verifier signed it off' };
    if (!mutant.expect.test(result.output)) {
      return { caught: false, why: `rejected, but not by the check under test (${mutant.expect})` };
    }
    return { caught: true, why: '' };
  });
  console.log(`${verdict.caught ? 'caught  ' : 'SURVIVED'}  ${mutant.name}${verdict.caught ? '' : ` — ${verdict.why}`}`);
  if (!verdict.caught) survived.push(mutant.name);
}

console.log(`\n${MUTANTS.length - survived.length}/${MUTANTS.length} mutants caught`);
process.exit(survived.length === 0 ? 0 : 1);
