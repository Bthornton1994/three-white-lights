#!/usr/bin/env python3
"""Copy Fable PR #71 stills into public/ for runtime serving. Bytes must not change."""

from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-direction/concept-fable-20260916/reference-ai"
DEST = ROOT / "public/illustrated/fable-20260916"

FILES = {
    "AI-REF-01-MODEL-SHEET.png": "b484a534dfa54764245a006bb8e9ef8ce2a78077dd25773041bd6f8f8eb59ff9",
    "AI-REF-02-BENCH-THREE-QUARTER.png": "0e4410b6dc472bd423bdb551cce7497978c062fb55e9148896c7bf8fabe923b7",
    "AI-REF-03-DEADLIFT-SETUP-LOCKOUT-MAX.png": "b56e379f6c18b52f5a6e8da4f3bc0cd9781645477b446741ca1444ad505c16ba",
    "AI-REF-04-SQUAT-HOLE-LIGHT-VS-MAX.png": "bc6e03a8a83e5bfc77f2b4961c4f93f00342fc32e1b8dea1dcfa0be465ebc64a",
    "AI-REF-05-TITLE-SCREEN.png": "1bc09ab2231eb7a91fe7289cacfea23a5ac1a1dfc94402570806b614ff299d2f",
}

FEEL = ROOT / "src/feel.ts"
FEEL_SHA256 = "b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c"


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def sync() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    for name, expected in FILES.items():
        src = SRC / name
        if not src.is_file():
            raise SystemExit(f"missing Fable still: {src}")
        got = digest(src)
        if got != expected:
            raise SystemExit(f"refusing mutated Fable file {name}: {got}")
        dest = DEST / name
        shutil.copyfile(src, dest)
        if digest(dest) != expected:
            raise SystemExit(f"copy mismatch: {name}")


def check_feel() -> None:
    got = digest(FEEL)
    if got != FEEL_SHA256:
        raise SystemExit(f"feel.ts changed ({got}); illustrated edition must not touch it")


def main(argv: list[str]) -> int:
    check_feel()
    if argv[1:] == ["--check-only"]:
        for name, expected in FILES.items():
            src = SRC / name
            got = digest(src)
            if got != expected:
                raise SystemExit(f"Fable still hash mismatch {name}: {got}")
        print("illustrated check ok (feel.ts + 5 stills)")
        return 0
    sync()
    print(f"synced {len(FILES)} Fable stills -> {DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
