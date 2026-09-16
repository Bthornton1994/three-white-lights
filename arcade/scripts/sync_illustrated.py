#!/usr/bin/env python3
"""Copy illustrated stills into public/ for runtime serving. Bytes must not change."""

from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parent.parent
FABLE_SRC = ROOT / "art-direction/concept-fable-20260916/reference-ai"
FABLE_DEST = ROOT / "public/illustrated/fable-20260916"
REVISED_SRC = ROOT / "art-direction/illustrated-direct-use/assets"
REVISED_DEST = ROOT / "public/illustrated/direct-use"

FABLE_FILES = {
    "AI-REF-01-MODEL-SHEET.png": "b484a534dfa54764245a006bb8e9ef8ce2a78077dd25773041bd6f8f8eb59ff9",
    "AI-REF-02-BENCH-THREE-QUARTER.png": "0e4410b6dc472bd423bdb551cce7497978c062fb55e9148896c7bf8fabe923b7",
    "AI-REF-03-DEADLIFT-SETUP-LOCKOUT-MAX.png": "b56e379f6c18b52f5a6e8da4f3bc0cd9781645477b446741ca1444ad505c16ba",
    "AI-REF-04-SQUAT-HOLE-LIGHT-VS-MAX.png": "bc6e03a8a83e5bfc77f2b4961c4f93f00342fc32e1b8dea1dcfa0be465ebc64a",
    "AI-REF-05-TITLE-SCREEN.png": "1bc09ab2231eb7a91fe7289cacfea23a5ac1a1dfc94402570806b614ff299d2f",
}

REVISED_FILES = {
    "bench-revised-20260916.png": "6ded9e1d74512e42527a3e1e4d86d915d210f8326a07b331c34973c4ab99548b",
}

FEEL = ROOT / "src/feel.ts"
FEEL_SHA256 = "b26c21b520d17a8e87e6abac17661fc219870a2320a376b5b1b1adfe0bc2425c"


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def copy_locked(src_dir: Path, dest_dir: Path, files: dict[str, str]) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    for name, expected in files.items():
        src = src_dir / name
        if not src.is_file():
            raise SystemExit(f"missing still: {src}")
        got = digest(src)
        if got != expected:
            raise SystemExit(f"refusing mutated file {name}: {got}")
        dest = dest_dir / name
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
        for name, expected in FABLE_FILES.items():
            got = digest(FABLE_SRC / name)
            if got != expected:
                raise SystemExit(f"Fable still hash mismatch {name}: {got}")
        for name, expected in REVISED_FILES.items():
            got = digest(REVISED_SRC / name)
            if got != expected:
                raise SystemExit(f"revised still hash mismatch {name}: {got}")
        print("illustrated check ok (feel.ts + 5 Fable stills + revised bench)")
        return 0
    copy_locked(FABLE_SRC, FABLE_DEST, FABLE_FILES)
    copy_locked(REVISED_SRC, REVISED_DEST, REVISED_FILES)
    print(f"synced {len(FABLE_FILES)} Fable stills + {len(REVISED_FILES)} revised stills")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
