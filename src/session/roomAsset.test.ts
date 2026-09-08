import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { codeOnly } from '../tuning/audit';
import { ROOM_ASSET, ROOM_ASSET_IS_MISSING, ROOM_ASSET_PATH } from './roomAsset';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SOURCE = readFileSync(path.join(HERE, 'roomAsset.ts'), 'utf8');
/** The header may DESCRIBE the require that lands later; the code may not carry one yet. */
const CODE = codeOnly(SOURCE);

describe('roomAsset.ts — the room plate reference and its flag move together, and never to a painted scene', () => {
  it('the flag says missing exactly when the file is absent and the id is null', () => {
    const onDisk = existsSync(path.join(REPO, ROOM_ASSET_PATH));
    expect(ROOM_ASSET_IS_MISSING, `${ROOM_ASSET_PATH} on disk: ${onDisk}`).toBe(!onDisk);
    expect(ROOM_ASSET === null).toBe(ROOM_ASSET_IS_MISSING);
    if (!onDisk) expect(CODE).not.toMatch(/require\(/);
    else expect(SOURCE).toContain(`require('../../${ROOM_ASSET_PATH}')`);
  });

  it('never requires a painted squat scene, in any state', () => {
    expect(CODE).not.toMatch(/require\(/);
    expect(SOURCE).not.toMatch(/squat-(brace|hole|drive)\.jpg'\)/);
    expect(ROOM_ASSET_PATH).toBe('assets/iron-amber/squat-room-side.jpg');
  });
});
