# Rive authoring handoff — the athlete rig, `athlete-01`

**Status: `ASSET_AUTHORING_BLOCKED`.** No Rive editor exists in the build
environment, and by ruling no binary generator, format reverse-engineering,
placeholder body or AI-generated pose frame may stand in for the authored
asset. This document is everything an editor author needs to build the rig
WITHOUT reading the source code: the canvas, the names, the full input
schema, the rig and state-machine plan, the deformation limits, the failure
states, the layer order, the export name, and the exact command that decides
whether the file is accepted. The companion
`docs/design/ATHLETE-SOURCE-PACKAGE.md` fixes the athlete's identity,
proportions, wardrobe, scale and light; this file assumes it.

The schema tables below are generated from `docs/design/athlete-rig-manifest.json`,
which the test suite pins byte-for-byte to the binding that writes the
ViewModel — so this document cannot drift from the code without a red test.

## 1. Deliverable and naming

| Item | Value |
| --- | --- |
| Runtime file | `assets/athlete/athlete-01.riv` |
| Editor source | `assets/athlete/athlete-01.rev` (the editor's own backup, committed beside the runtime file for provenance) |
| Reference sheet | `assets/athlete/athlete-01-reference-sheet.png` (front / side / three-quarter, §ATHLETE-SOURCE-PACKAGE) |
| Provenance package | `assets/athlete/ATHLETE-01-PROVENANCE.md` with one line each: `SHA-256:` (of the delivered `.riv`), `Licence:`, `Artist:`, `Marks:` (attesting no real federation, brand, sponsor or likeness), `Editor source:`. `node tools/athleteIntake.mjs` refuses the delivery without it, and refuses a hash that names other bytes. |
| Version | Bump a suffix on breaking rig changes only: `athlete-01.riv` → `athlete-01-v2.riv`. The host references one path. |
| Licence | Owned outright or licensed for redistribution, with the artist agreement filed. No real lifter's likeness, no federation mark, no shoe or apparel brand, no sponsor. |

## 2. Canvas and camera

| | |
| --- | --- |
| Artboard size | **1152 × 1728 px** — the stage plate's size (`assets/iron-amber/*.jpg`), so the rig composites 1:1 |
| Camera | **Side-on sagittal**, athlete facing frame-right, orthographic feel (no perspective on the bar) |
| Floor line | **y = 1400** (0.81 of height — where the stage plates put the feet) |
| Lockout bar line (`barHeight = 1`) | **y = 553** (bar centre on the traps at lockout) |
| Hole bar line (`barHeight = 0`) | **y = 968** (bar centre at the authored bottom — set from the athlete's anatomy in the source package §4, a 720 mm drop) |
| Judged-depth line (`barHeight = 0.2`) | **y = 885** — hip joint at or below the knee joint is reached here; `depthAchieved` flips true |
| Sticking band (`barHeight = 0.34 ± 0.14`) | **centre y = 827, band y = 769…885** — where the sim's stall lives; author the grind pose here. The band's lower edge IS the judged-depth line |
| Scale | **0.577 px per mm** — the 1750 mm athlete stands **1010 px** tall, crown at y ≈ 390 |
| Sprite-px → canvas-px | **× 16.8** (the sim's bar offsets arrive in a 60-px-tall sprite unit; 1010 / 60) |

`barHeight` is CLAMPED to 0..1 by the contract (`clamp01(1 − depth)` in the
sim) — it never reads below 0 or above 1. A buried descent is carried by
`depth`, which keeps rising past 1 to the sim's collapse depth (1.3) while
`barHeight` sits at 0: key the collapse pose on `depth` (depth 1.3 → bar
y ≈ 1093, the same line the source package derives). An earlier draft of
this section said `barHeight` clips to −0.3; the trace corpus
(`docs/design/athlete-traces/buried-miss.json`) read 0 on every buried tick
and the chain guard (`src/art/rigContractChain.test.ts`) now holds this
table to the binding.

## 3. Artboards and state machines

| Artboard | State machine | Status |
| --- | --- | --- |
| `squat` | `squat` | **v1 — author this** |
| `bench` | `bench` | reserved — **do not author yet** (ruled: squat proves the system first) |
| `deadlift` | `deadlift` | reserved — **do not author yet** |

The host selects the artboard by lift and plays the state machine **of the
same name**; it binds that artboard's **default ViewModel**. Two facts were
measured on the runtime spike and are hard requirements, not preferences:

1. **A state machine must be running for data binding to reach the screen.**
   A file whose artboard only carries a linear animation binds its ViewModel,
   reports "bound", and draws nothing that follows the inputs (measured:
   0 of 458,240 pixels changed across 450 ms). Name the state machine
   exactly as the artboard.
2. **The ViewModel the host writes is the artboard's default.** Set the
   `Athlete` ViewModel as the artboard's default in the editor; a ViewModel
   that exists in the file but is not the artboard's default is not bound.

## 4. The ViewModel — `Athlete`

One ViewModel, named `Athlete`, set as the default of every lift artboard.
Every property below must exist with exactly this path, this type and — for
enums — exactly these values (case-sensitive). A missing or renamed property
is a silent no-op at runtime, which is why §9's command fails closed on it.

**Nesting.** Rive's slash-path grammar is used for the plate slots: a
ViewModel property `plates` of type ViewModel (`PlateSlots`), whose
properties `0` … `7` are each a ViewModel (`PlateSlot`) with `on` (boolean)
and `size` (number). The host writes `plates/3/on`, `plates/3/size`.

| Path | Type | Range / unit | Meaning |
| --- | --- | --- | --- |
| `lift` | enum — values `squat`, `bench`, `deadlift` | `squat` \| `bench` \| `deadlift` | Which skeleton. v1 authors `squat`; the other two are reserved. |
| `phase` | enum — values `BRACE`, `DESCENT`, `HOLE`, `ASCENT`, `LOCKOUT`, `RESOLVED` | the six beats | The mechanic's beat. NOT the pose driver — see `barHeight`. Keys state transitions. |
| `barHeight` | number | `0..1`, clamped | 0 = authored bottom of the hole, 1 = lockout. **THE pose driver.** Continuous through descent and ascent. Never below 0: see `depth`. |
| `depth` | number | `0..1`, rising past 1 on a buried descent (to ≈ 1.3) | 0 = standing, 1 = the authored bottom. The ONLY input that carries the buried collapse — `barHeight` floors at 0 there. Key the `buried` pose on `depth > 1`. |
| `barVelocity` | number | heights / second, signed | Actual bar motion: `+` rising, `−` descending. `0` means rest ONLY when `motionSampleValid`. |
| `motionSampleValid` | boolean | — | False on an unpaired snapshot: then `barVelocity` is 0 for lack of a sample, not because the bar sat still. |
| `integratorVelocity` | number | heights / second | The ascent force integrator; 0 through the descent by design. Stall/grind feel reads this, not `barVelocity`. |
| `strain` | number | `0..1` | Effort expression: load + phase + current deficit. Not a fatigue meter. |
| `grindIntensity` | number | `0..1` | 1 = stalled or being beaten on the way up. The title beat; drives tremor. |
| `effortBand` | enum — values `easy`, `normal`, `hard`, `grind`, `failing` | `easy` \| `normal` \| `hard` \| `grind` \| `failing` | A derived band a state may key on. Not an animation name. |
| `barTiltDeg` | number | degrees | Lifter's right side high is positive. Rotate the bar about its centre. |
| `barForwardPx` | number | sprite px | Bar-pose offset from the sim. Scale to the canvas (see §6), do not re-derive. |
| `barLateralPx` | number | sprite px | As above. |
| `barBendPx` | number | sprite px | As above; draw as sleeve droop, never as a change in bar length. |
| `commandGlow` | number | `0..1` | Cue prominence — full while held, peaks at the cue's ideal instant. An amber bloom, not a target ring. |
| `held` | boolean | — | The finger is down. |
| `pressCommandLive` | boolean | — | Bench only: the press command is live. Inert on squat. |
| `lockoutHoldLive` | boolean | — | Deadlift only: the lockout hold is live. Inert on squat. |
| `chalk` | number | `0..1` | Chalk intensity on hands, bar and air. Placement is the rig's. |
| `depthAchieved` | boolean | — | Judged depth reached (the sport's fact). Legible, not decorative. |
| `lockedOut` | boolean | — | Reached lockout. |
| `complete` | boolean | — | The rep is resolved; `outcome` is now meaningful. |
| `outcome` | enum — values `good-lift`, `grind`, `miss`, `none` | `good-lift` \| `grind` \| `miss` \| `none` | Terminal state selector. `none` until resolved. Three authored endings. |
| `missReason` | enum — values `no-depth`, `buried`, `stalled`, `timeout`, `dropped`, `none` | `no-depth` \| `buried` \| `stalled` \| `timeout` \| `dropped` \| `none` | Why, on a miss. Each authored as its own resolution (§9). |
| `totalKg` | number | kg | What the HUD shows. The drawn bar must plausibly be this weight. |
| `plates/0/on` | boolean | — | Sleeve slot 0 (0 = inboard) is loaded. Mirror to the far sleeve. |
| `plates/0/size` | number | `0..6` ladder index | Slot 0 disc drawing: 0 = 25 kg red … 6 = 1.25 kg black (§7). Meaningless while `on` is false. |
| `plates/1/on` | boolean | — | Sleeve slot 1 (0 = inboard) is loaded. Mirror to the far sleeve. |
| `plates/1/size` | number | `0..6` ladder index | Slot 1 disc drawing: 0 = 25 kg red … 6 = 1.25 kg black (§7). Meaningless while `on` is false. |
| `plates/2/on` | boolean | — | Sleeve slot 2 (0 = inboard) is loaded. Mirror to the far sleeve. |
| `plates/2/size` | number | `0..6` ladder index | Slot 2 disc drawing: 0 = 25 kg red … 6 = 1.25 kg black (§7). Meaningless while `on` is false. |
| `plates/3/on` | boolean | — | Sleeve slot 3 (0 = inboard) is loaded. Mirror to the far sleeve. |
| `plates/3/size` | number | `0..6` ladder index | Slot 3 disc drawing: 0 = 25 kg red … 6 = 1.25 kg black (§7). Meaningless while `on` is false. |
| `plates/4/on` | boolean | — | Sleeve slot 4 (0 = inboard) is loaded. Mirror to the far sleeve. |
| `plates/4/size` | number | `0..6` ladder index | Slot 4 disc drawing: 0 = 25 kg red … 6 = 1.25 kg black (§7). Meaningless while `on` is false. |
| `plates/5/on` | boolean | — | Sleeve slot 5 (0 = inboard) is loaded. Mirror to the far sleeve. |
| `plates/5/size` | number | `0..6` ladder index | Slot 5 disc drawing: 0 = 25 kg red … 6 = 1.25 kg black (§7). Meaningless while `on` is false. |
| `plates/6/on` | boolean | — | Sleeve slot 6 (0 = inboard) is loaded. Mirror to the far sleeve. |
| `plates/6/size` | number | `0..6` ladder index | Slot 6 disc drawing: 0 = 25 kg red … 6 = 1.25 kg black (§7). Meaningless while `on` is false. |
| `plates/7/on` | boolean | — | Sleeve slot 7 (0 = inboard) is loaded. Mirror to the far sleeve. |
| `plates/7/size` | number | `0..6` ladder index | Slot 7 disc drawing: 0 = 25 kg red … 6 = 1.25 kg black (§7). Meaningless while `on` is false. |
| `platesOverflow` | number | count | Discs the eight slots could not show. Non-zero is a finding to report, not a look. |
| `seed` | number | integer | Deterministic; authored variation may key on it so replays are stable. |

**Inert on v1 and documented as such, not omitted:** `pressCommandLive` and
`lockoutHoldLive` are bench and deadlift facts and drive nothing on the squat
artboard; `lift` is always `squat` on that artboard; `seed` may drive nothing
at v1. They must still exist with the right types — the validator checks
the schema, and the other artboards will use them.

## 5. State-machine plan — `squat`

The pose is a function of the inputs, never of elapsed time. No state may
assume a rep duration: the grind lasts as long as the simulation says.

**Layers (Rive state-machine layers, blended top to bottom):**

1. **`pose`** — a 1D blend state driven by `barHeight`: keyframed poses at
   `barHeight` 1.0 (lockout / brace), 0.75, 0.5, **0.34 (the stick)**, 0.2
   (judged depth), 0.0 (the hole); the buried collapse is a second blend
   on `depth` from 1.0 to 1.3, additive past the hole, because `barHeight`
   never goes below 0. Descent and ascent read the
   same curve; `barVelocity`'s sign selects a small additive "intent" blend
   (torso angle closes on the way up, opens on the way down — see §7 of the
   source package). This layer alone must produce a legible rep.
2. **`effort`** — additive layer keyed on `strain` (0..1) and `effortBand`:
   bracing; head / neck / jaw-SILHOUETTE tension (the outline of the head
   and neck setting under load — no eyes, no mouth, no facial acting, no
   likeness detail, because the source package authors no face at v1);
   forearm tension; belt bite. No shake here.
3. **`grind`** — additive tremor and bar creep keyed on `grindIntensity`
   (0..1), strongest inside the sticking band. Amplitude authored, never
   supplied as coordinates. Zero at `grindIntensity = 0`.
4. **`cue`** — an amber bloom on the bar and hands keyed on `commandGlow`
   (0..1), plus a `held` grip tighten.
5. **`resolution`** — entered when `complete` is true; branches on
   `outcome` and `missReason` (§8). Exits back to `pose` on `complete` false
   (the next rep).

**Transitions key on the enums** — `phase` for brace → descent → hole →
ascent → lockout, `outcome` / `missReason` for the endings — while the
pose itself keys on `barHeight`. Do not build the rep as a timeline that
`phase` triggers; that is the phase-swap this project already rejected.

## 6. Rig plan — bones, IK, meshes, bar, plates

**Bone hierarchy (names are the contract for a second athlete):**

```
root                      (floor, mid-foot; never moves)
├── foot_near / foot_far  (planted; IK effectors, never animated directly)
├── pelvis
│   ├── spine_1 → spine_2 → spine_3 → chest
│   │   ├── neck → head
│   │   ├── shoulder_near → upper_arm_near → forearm_near → hand_near
│   │   ├── shoulder_far  → upper_arm_far  → forearm_far  → hand_far
│   │   └── bar_anchor    (the trap contact point; the bar hangs here)
│   ├── thigh_near → shin_near   (IK chain, target foot_near)
│   └── thigh_far  → shin_far    (IK chain, target foot_far)
└── bar_root  (child of bar_anchor: barHeight/tilt/offsets applied here)
    ├── bar_shaft
    ├── sleeve_near → plates/0..7 (near)
    └── sleeve_far  → plates/0..7 (far)
```

- **Feet are the root.** Two-bone IK on each leg from hip to a planted foot
  target; the pelvis travels, the feet do not. Knee tracks forward over the
  toes on the way down (a knee pole target, not a free joint).
- **Hands attach TO the bar**, two-bone IK from shoulder to a grip point on
  `bar_shaft`. The bar is a child of the trap anchor, not of a hand, so a
  hand can never separate from it.
- **Meshes with bone weights**, not cut-outs on rotating bones: torso (front
  and back), each thigh, each upper arm and forearm, the singlet as its own
  mesh lagging the torso, the neck. Belt, knee sleeves, shoes, wraps are
  RIGID pieces parented to their bone (the belt to `spine_2`, sleeves to the
  knee joint) and do not stretch.
- **Bar transform.** `bar_root` y is a linear map of `barHeight` from the
  hole line to the lockout line (§2); `barTiltDeg` rotates `bar_root` about
  its centre (side-on, tilt reads as the far sleeve rising); `barForwardPx`
  translates along the athlete's facing (× 16.8 to canvas px);
  `barLateralPx` translates in depth (scale and a small y shift in a side
  view); `barBendPx` droops both sleeves (× 16.8), never changes bar length.
- **Plate slots.** Eight slot positions per sleeve, inboard-first from the
  collar, pitched one disc thickness apart; each slot holds the seven disc
  drawings and shows the one `size` selects when `on` is true. The near
  sleeve is drawn IN FRONT of the athlete, the far sleeve behind. Diameters
  per the source package (25 kg = 260 px on this canvas).
- **Chalk** is a topmost layer keyed on `chalk`: hands, bar knurl, a little
  air. No particle system is supplied by the host.

**Deformation limits (rejections, not notes):**

| Limit | Value |
| --- | --- |
| Limb length change | **0** — femur, tibia, upper arm, forearm never change length between any two poses |
| Volume | preserved within ±5% of the mesh's lockout area; a compressed thigh widens |
| Knee flexion | ≤ 140° at the hole |
| Hip flexion | ≤ 125° at the hole |
| Torso angle from vertical | 10° at brace, 45° ± 5° at depth, closing back to ≤ 15° at lockout |
| Ankle dorsiflexion | ≤ 35° |
| Contact | feet on the floor line, hands on the bar, bar on the trap anchor — in EVERY pose including the misses |
| Belt | rigid; compresses the torso mesh above and below it |
| Cloth lag | the singlet trails the torso by a small authored amount; it is never welded |

## 7. Squat top and bottom references

- **Top / brace (`barHeight = 1`):** hips and knees extended, bar at y = 553
  on the traps, air in, belt tight, ribs down, torso 10° from vertical, gaze
  level. Stillness with tension — already under load.
- **Judged depth (`barHeight = 0.2`, y = 885):** hip joint at or below the
  knee joint, hip crease visibly below the top of the knee. This is the sport's judged fact and must be legible at
  phone size; `depthAchieved` flips true here.
- **Bottom / hole (`barHeight = 0`, y = 968):** maximum torso lean (45°),
  maximum knee flexion, shins forward, bar over mid-foot.
- **Buried (`depth > 1`, `barHeight = 0`):** past the authored bottom, up to
  depth 1.3 (bar y ≈ 1093): the athlete is folding, the bar drifts forward —
  the picture of a rep that went too deep and is about to be lost. Keyed on
  `depth`, not on `barHeight`, which sits at 0 the whole way down.
- **The stick (`barHeight ≈ 0.34`):** hips risen ahead of the chest, torso
  angle briefly closed, bar speed near zero. The grind layer's home.

## 8. Failure and resolution states

`outcome` has three authored endings; a `grind` that locks out must look like
it cost something, not like a slower `good-lift`. `missReason` names five
ways a miss happens and each is its own authored motion — a miss is never
the success played backwards:

| `missReason` | What is authored |
| --- | --- |
| `no-depth` | Cut high: the athlete rises without ever reaching the judged-depth line; re-racks; a small shake of the head. |
| `buried` | Went past the authored bottom and could not return: folds forward, the bar rolls up the neck, the athlete steps out under it onto the rack safeties. |
| `stalled` | The grind lost: bar speed collapses in the sticking band, the bar wins, the athlete descends under control to the safeties. |
| `timeout` | The same descent as `stalled`, reached slower — the rep ran out of time rather than force. |
| `dropped` | The bar leaves the traps (a lockout slip): a step back, the bar to the safeties, the athlete clear of it. |

Which of the five the squat engine can actually produce is the mechanics
lane's fact; the enum carries all five, so all five are authored.

## 9. Layer ordering (back to front)

room plate (EMPTY, side-on, 1152 × 1728, the same Iron & Amber light, the
same floor line and lockout framing — a NEW production asset, never a crop
or re-use of the existing `assets/iron-amber/squat-*.jpg`, which carry a
painted lifter, the wrong camera and brand-like marks) → rack (static,
J-cups at the lockout line) → far-sleeve plates → athlete and bar (one rig)
→ near-sleeve plates → chalk. The near sleeve in front of the body is what
makes the bar read as loaded rather than painted on.

## 10. Validation — the command that decides

From the repository root, with the exported file in place:

```
node tools/rivContract.mjs assets/athlete/athlete-01.riv --artboard squat
```

It prints a JSON report on stdout and a verdict on stderr, and exits 0 ONLY
when the named artboard exists, carries a state machine of the same name,
and its default ViewModel exposes every input in §4 with the right type and
every enum value. Anything else is `NOT SATISFIED` and exit 1; a file the
engine cannot load is exit 1 with `valid: false`. Without `--artboard` the
command checks all three lift artboards — the bar for production eligibility
once bench and deadlift exist.

To see what a file exposes without judging it: `node tools/rivSchema.mjs <file.riv>`.
To print this document's schema from the code: `node tools/rivContract.mjs --manifest`.

**Acceptance checklist for v1:**

1. `rivContract.mjs … --artboard squat` → `SATISFIED`, exit 0.
2. The reference sheet (§ATHLETE-SOURCE-PACKAGE) matches the rig's
   proportions — the same athlete, not a rig that drifted from its sheet.
3. Every §6 deformation limit holds in every state, including the five misses.
4. A full rep driven by the real simulation reads brace → descent → depth →
   reversal → ascent → stick → grind → lockout, and at least one authentic
   miss, with body, bar and plates one coherent physical scene.
5. TECHNICAL / INTEGRATION / PERFORMANCE are measured by the harness.
   **VISUAL, ANIMATION and SOFT-FEEL are graded by a human reviewer, and
   OWNER PLAYTEST only by Bryant.** The asset is not on the player path until
   those pass; passing item 1 makes it eligible for review, not shipped.

## 11. Do not

- Do not author the rep as timelines that `phase` triggers — the pose is
  `barHeight`'s function.
- Do not read or reconstruct any mechanical quantity (velocity, grind, load,
  outcome) inside the rig; every one arrives as an input.
- Do not author `bench` or `deadlift` artboards yet.
- Do not put a real federation mark, shoe brand, apparel brand or sponsor
  anywhere on the athlete, the bar or the plates.
- Do not rename a path to something nicer; the host writes these exact
  strings.
