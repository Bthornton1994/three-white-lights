# Reference material for the §12.2 blind-A/B bars

GDD §12.2 grades several pieces by blind comparison against real reference.
Image hosts are refused by this sandbox's egress policy, so a critic cannot
fetch any of this itself — it has to be committed here. A critic that cannot
find a reference for its bar reports that half of the bar **unverifiable**
rather than passing it on reasoning (CLAUDE.md). Adding a file here is what
converts an unverifiable bar into a gradeable one.

Do not put approximations or redrawings here. A generated stand-in for a real
SNES sprite is worse than no reference: it would let a critic report a pass
against something this project made up.

## What is here, and what each file can actually grade

| file | what it is | grades |
|---|---|---|
| `sprite-ref-1-snes-wrestling.png` | SNES-era wrestling game, 256×224 — native SNES resolution, so pixel sizes are directly comparable | Lifter sprites & animation. Two figures under strain, a referee, a crowd, a canvas — close to our subject |
| `sprite-ref-2-16bit-baseball.png` | **NOT a 16-bit game — modern pixel art in a retro style.** The batter is captioned `C. MULLINS`, `POS: CF`, `#31`: a current Orioles player, beside the current MLB logo. Named before anyone read the caption. | **Do not use it as a positive craft reference.** It is an example of exactly the *modern pixel-art pastiche* the §12.2 bar exists to distinguish ours FROM, so grading toward it biases toward the failure mode. Usable only as a negative control, or for era-typical UI chrome layout |
| `scoresheet-ref-1-live-attempt-board.png` | A **live attempt board** from meet-running software, mid-meet | Result card. Carries the real column structure — per-lift attempt grid, subtotal, total, division, weight class, place — plus good/no-lift colour coding, three judge lights, and plate loading |
| `meet-photo-ref-1-ipf-squat-bottom.webp` | IPF Worlds, a lifter at the bottom of a squat, spotters around the rack | Sprite body position and strain at depth; meet staging |
| `meet-photo-ref-2-deadlift-lockout.png` | A chalked deadlift near lockout, judge lights in frame | Sprite body position under load; meet staging |

## What is still NOT covered

Say this plainly rather than letting a critic stretch a reference past what it
shows:

- **Meet-day tension** (§12.2 row 3) asks for *broadcast footage* of a
  third-attempt walkout and says to judge "pacing and sound". These are stills.
  They support the *look* of a maximal attempt; they cannot grade pacing or
  sound. That half of the bar stays unverifiable until there is video.
- **Result card vs. a real federation result sheet.** The board here is a live
  in-meet scoreboard, not a published post-meet results sheet. The column
  structure is the same and it is strong evidence, but a critic must say which
  of the two it actually compared against.
- **Gym / environment art** (§12.2 row 2) has no dedicated reference. The
  sprite refs give era context and the meet photos give staging; neither is a
  gym interior.
- **Anime cut-ins** (§12.2 row 7) have no reference at all. GDD §7.2 defers
  cut-in art from the early prototypes anyway.

## Which bars have an artifact to grade

A reference only helps where something exists to compare against. As of the
run that added these files, only the **lifter sprite system** (`src/art/`) is
built. The result card, gym art, meet-day sequence and cut-ins are not written
yet, so their references are staged here for when they are.
