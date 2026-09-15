import { FEEL } from "../feel.ts";

export type StreakRecord = {
  count: number;
  lastMeetAt: number;
};

export function readSessionStreak(storage: Pick<Storage, "getItem"> | null): number {
  if (!storage) {
    return 0;
  }
  try {
    const raw = storage.getItem(FEEL.STREAK_STORAGE_KEY);
    if (!raw) {
      return 0;
    }
    const parsed = JSON.parse(raw) as Partial<StreakRecord>;
    if (typeof parsed.count !== "number" || parsed.count < 0) {
      return 0;
    }
    return Math.floor(parsed.count);
  } catch {
    return 0;
  }
}

export function writeSessionStreak(
  storage: Pick<Storage, "setItem"> | null,
  nextCount: number,
): void {
  if (!storage) {
    return;
  }
  const record: StreakRecord = {
    count: Math.max(0, Math.floor(nextCount)),
    lastMeetAt: Date.now(),
  };
  storage.setItem(FEEL.STREAK_STORAGE_KEY, JSON.stringify(record));
}

export function nextSessionStreak(current: number, bombed: boolean, madeAny: boolean): number {
  if (bombed || !madeAny) {
    return 0;
  }
  return current + 1;
}
