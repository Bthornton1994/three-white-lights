# The canonical athlete asset pipeline

**Status:** Specification. No production asset exists yet — see §2.
**Date:** 2026-09-07
**Owner:** Claude Code Session A — visual / animation / player-experience
**Measured at:** `20a1aa55` on `grok/session-a-iron-amber-training-art-01` (PR #48 head)
**Depends on:** `docs/design/ADR-001-athlete-animation-architecture.md` (architecture),
`docs/design/IRON-AND-AMBER-REFERENCE.md` (binding direction)

---

## 1. What this document is for

Three athlete implementations have now been produced by engineering and two
have been rejected. This document exists so the third is authored by an artist
against a written target instead of being improvised by whoever is holding the
renderer.

It specifies the athlete as an **asset with an owner**, not as code: identity,
proportions, wardrobe, palette, lighting, construction, rig, deformation rules,
and the exact delivered file. Everything downstream of the ADR is blocked on
this asset, so the specification is written now, while the blocker is open,
rather than after it clears.

**It does not specify gameplay.** Every mechanical number quoted here is read
from the shipped simulation and cited to its file. Where the asset needs a
number the simulation does not currently expose, that is a request in
`docs/design/PRESENTATION-CONTRACT-REQUEST.md`, not a value invented here.

## 2. `ASSET_PIPELINE_BLOCKED`

Stated first, because everything below is a specification for something that
does not exist and cannot be produced from this environment.

| | |
| --- | --- |
| **Missing asset** | The canonical athlete: one rigged, skinned, deformable 2D character with authored squat motion, success and failure states. |
| **Required format** | `.riv` (Rive runtime binary), plus the editor-source project file, plus a flat PNG/SVG reference sheet for review. |
| **Required authoring tool** | The Rive editor. Rigging, meshing and state-machine authoring are editor work; there is no code path that produces a `.riv` and none should be built. |
| **Required upstream** | Character design: a human illustrator or an image pipeline whose output is **owned or licensed**, per `docs/design/IRON-AND-AMBER-REFERENCE.md` ("Production assets must be owned, generated with appropriate rights, or properly licensed"). |
| **Ownership / licensing need** | The athlete is a recurring player-facing identity and the product's face. It needs clear ownership before it ships, and it must be **fictional** — CLAUDE.md's hard constraint forbids a real athlete's name, likeness or brand in any asset, string or code path until a human unlocks a specific licensed partner by name. |
| **Blocked by this** | The athlete on the training stage; the ADR §7 runtime spike (it needs a `.riv` to run at all); every VISUAL, ANIMATION and SOFT-FEEL gate on the lift surface. |
| **Not blocked by this** | §13. |

**This is not a reason to ship a fourth placeholder body.** The product
standard refuses one, and the two rejections in ADR-001 §2 are what a
placeholder costs: each one consumed a round and taught the same lesson.

## 3. Canonical identity — the character bible

**One athlete. The same athlete every session.** The first rejection's sharpest
failure was that the person changed between frames; identity is therefore a
requirement of the asset, not an aspiration.

- **Fictional, and owned.** No real lifter's name, likeness, competition
  record, or sponsor marks. No real federation wordmark on the singlet or the
  bar. This is a legal constraint, not a style one — an unlicensed real mark
  cannot be patched out after a store build.
- **A serious lifter mid-career**, not a hero build and not a beginner. The
  game's subject is grinding a hard rep, so the body reads as **capable and
  working**, not as a physique render.
- **Gender-neutral silhouette for v1.** The stage draws one athlete and the
  player has no avatar choice yet. Do not encode a specific face at v1 — the
  camera framing (§8) keeps the head small, and a strongly characterised face
  becomes a constraint the moment additional lifter appearances are added.
- **The silhouette is the identity.** At the size the athlete is actually
  drawn on a phone, posture, mass distribution and gear read; facial detail
  does not. Author the silhouette first and check it as a solid black shape at
  the delivered on-screen size before any rendering is done.

**Additional appearances later** (the stated requirement) means the rig,
proportions and deformation rules in §4 and §10 are **shared**, and only
skin/texture/wardrobe layers change. Do not author v1 in a way that makes a
second athlete a second rig.

## 4. Proportions and body construction

Authored in a **side-on sagittal view** — this is the squat camera (§8) and the
one view every mechanical beat has to read in.

- **Nominal athlete height: 1750 mm.** Every measurement below and every
  equipment scale in §7 is expressed against this so the bar, plates and body
  agree. The number is a drawing scale, not a gameplay value.
- **Eight-head canon is wrong here.** Use ~7.5 heads: powerlifting silhouettes
  read short-limbed and thick-torsoed, and an idealised fashion proportion
  makes a heavy squat look weightless.
- Femur and torso lengths are the two measurements the squat's shape depends
  on. Pick them once, write them in the character bible, and never adjust them
  per-pose to make a frame look better — a limb that changes length between
  the top and the bottom of the rep is the mannequin problem returning as an
  art bug.
- **Body construction is anatomical, not primitive.** No capsule limbs, no
  circle joints, no rounded-rect torso. That construction is the rejected
  architecture (ADR-001 §2) and is a rejection condition regardless of how it
  is painted.
- **Feet are planted and are the anchor.** In a squat the feet do not move.
  Author them as the fixed root; everything else is measured from them.

**Deliverable: a reference sheet** — front, side and three-quarter, at the same
scale, on the same baseline, with the bar in frame at lockout height. The side
view is the production view; front and three-quarter exist so proportion and
mass stay consistent when a second appearance or a second camera is added.

## 5. Wardrobe and equipment

The gear is part of the identity and part of the mechanical read.

- **Singlet** — plain, no wordmark, no federation logo, no sponsor. Iron &
  Amber palette (§6).
- **Belt** — a lever or prong belt, visibly stiff. The belt is the clearest
  cue that the athlete is under real load; it must not deform like cloth.
- **Knee sleeves** — neoprene, not wraps. Wraps imply a different equipment
  division; the shipped mechanics do not model one.
- **Flat shoes or squat shoes** — pick one and keep it. Heel height changes
  the authored torso angle at depth, so this is a proportion decision, not a
  costume decision.
- **Wrist wraps and chalked hands** — the contract carries `chalk` as an
  intensity (§11), so chalk on the hands and bar is authored, not a particle
  system supplied by the renderer.
- **No headphones, no phone, no watch.** The stage is a competition-adjacent
  moment, not a gym-floor moment.

## 6. Palette and lighting

Both are inherited, not invented here. `docs/design/IRON-AND-AMBER-REFERENCE.md`
is binding: dark espresso, charcoal and amber foundation; warm, atmospheric;
premium illustrated; nostalgia as restrained texture rather than as sprite
resolution.

Lighting rules for the athlete specifically:

- **One dominant warm key from high front-left**, consistent with the room
  plates. The athlete must sit in the room's light, not carry its own.
- **Cool charcoal fill** so the shadow side stays readable against a dark
  environment. Pure black shadow loses the silhouette against the room.
- **A rim/backlight is what separates the athlete from the background.** At
  phone size against an espresso room this is the difference between a figure
  and a smudge. It is a requirement, not a flourish.
- **Lighting is baked into the artwork.** There is no runtime lighting model
  in the chosen architecture. What the renderer may modulate is limited to the
  contract's own scalars (§11) — for example an amber cue bloom driven by
  `commandGlow`.
- **The light does not move during a rep.** Motion comes from the body.

## 7. Equipment scale — measured from the shipped simulation, not invented

The bar drawn must plausibly be the weight the mechanic says is on it. These
diameters are read from `src/art/plates.ts`, which is the loading authority:

| Plate | Colour | Diameter |
| --- | --- | --- |
| 25 kg | red | 450 mm |
| 20 kg | blue | 450 mm |
| 15 kg | yellow | 400 mm |
| 10 kg | green | 325 mm |
| 5 kg | black | 228 mm |
| 2.5 kg | black | 190 mm |
| 1.25 kg | black | 160 mm |

Bar and collars are **25 kg** (`BAR_AND_COLLARS_KG`), being a 20 kg bar plus
2.5 kg collars.

Two consequences the artwork has to honour:

- **A 450 mm plate against a 1750 mm athlete is roughly a quarter of their
  height.** Loaded plates reach from the floor to around mid-shin. This is the
  single most common scale error in gym art, and getting it wrong makes every
  weight look the same.
- **The plate ladder must be drawn as seven distinct discs at the right
  relative sizes**, because the loading is real: 80 kg and 220 kg are
  different pictures, and the contract carries the actual per-side kg list so
  the renderer can draw the difference.

Do not draw a bumper-plate-only gym. The black small plates are what makes an
80 kg bar look like 80 kg.

## 8. The squat, beat by beat — the mechanical reference

The rep the athlete must perform, with the beats named as the shipped
simulation names them. `LIFT_PHASES` in `src/game/lift.ts` is the authority:
`BRACE`, `DESCENT`, `HOLE`, `ASCENT`, `LOCKOUT`, `RESOLVED`.

**Camera: side-on sagittal, athlete facing frame-right, feet on the floor line,
bar in frame at both lockout and depth.** The full rep must fit one framing —
a camera that cuts between poses re-introduces the phase-swap the first
implementation was rejected for.

| Beat | What the body does | What must read |
| --- | --- | --- |
| **Brace** | Bar racked on the traps, air in, belt tight, ribs down. Stillness with tension. | That the athlete is *already under load* before anything moves. |
| **Descent** | Hips back and down, knees track out over the toes, torso angle opens, weight stays mid-foot. | Control. The bar path is close to vertical over mid-foot — a bar drifting forward is a fault, not a style. |
| **Depth / hole** | Hip crease below the knee. Maximum torso lean, maximum knee flexion, shins forward. | That depth was actually reached. This is a judged fact in the sport and must be legible. |
| **Reversal** | The direction change out of the hole. The one moment of the rep that is not continuous velocity. | Weight. The bar visibly loses speed and takes it back. |
| **Drive** | Hips and chest rise together, knees extend. | Intent — this is where the player's input lands. |
| **Sticking point** | Bar speed collapses to near zero somewhere in the mid-range. Hips may shoot slightly; torso angle closes. | The grind. This is the game's title beat and the asset's hardest authored state. |
| **Grind** | Sustained near-stall with visible tremor, held for as long as the mechanic says the bar is slow. | That the outcome is genuinely in doubt. |
| **Lockout** | Knees and hips extended, bar settles, breath out. | Relief, then control. |

**Failure is authored, not a reversed success.** A missed squat is its own
motion: the bar wins, the athlete descends under it, and it is caught or
dumped. `LIFT_OUTCOMES` is `'good-lift' | 'grind' | 'miss'` — three endings,
so three authored resolutions. A `grind` that ends up locked out is not a
`good-lift` with a slower playback rate; it looks like it cost something.

**Length is not fixed and must not be baked.** The grind lasts as long as the
simulation says it does, which depends on the player. The rig is driven by
`stand` (§11), not by a timeline. Nothing in this asset may assume a rep
duration.

## 9. Rig specification

The rig is the deliverable that makes the motion continuous. It is authored in
the Rive editor.

- **Bone hierarchy rooted at the feet**, ankles → knees → hips → spine chain →
  shoulders → elbows → wrists, plus a neck and head. The bar is a child of a
  bar transform, not of a hand — both hands attach *to* the bar.
- **The bar is part of the rig.** The hands and the traps must stay in contact
  with it under every deformation. A bar drawn by the host renderer and a body
  drawn by the rig will separate; this is not negotiable.
- **IK on the legs**, so the feet stay planted while the hips travel. Feet
  sliding at depth is the single most damaging animation artifact for this
  subject.
- **Mesh deformation on torso, thighs, and arms.** Bone-only rotation on
  cut-out limbs produces the joint-pinch look that reads as a puppet.
- **One state machine**, with states corresponding to the beats in §8 and
  transitions driven by the inputs in §11. Success, grind and miss are
  authored terminal states.
- **`stand` drives the rep pose directly** — the pose at any moment is a
  function of the input, not of elapsed time. This is the property that makes
  the motion follow gameplay instead of a clock, and it is the reason the
  contract exists.

## 10. Deformation rules

Written down because these are what separate "rigged" from "convincing", and
because they are the rules a second athlete must also obey.

- **Volume is preserved.** A compressed thigh at depth widens; it does not
  shrink.
- **Limb lengths never change.** See §4 — an inconsistent femur is the
  mannequin defect in a different medium.
- **Contact points are hard constraints.** Feet to floor, hands to bar, bar to
  traps. Any frame that breaks one of these is a rejection, not a note.
- **The belt does not stretch.** It compresses the torso above and below it and
  keeps its own shape.
- **Cloth follows the body one step late.** The singlet is not welded to the
  mesh; a small lag is what sells mass.
- **Tremor is authored in the rig, not supplied as coordinates.** The contract
  carries `strain` and `grindIntensity`; the shake is the artist's expression
  of them. This is deliberate — the mechanics lane's contract doc §9 excludes
  face, hand and cloth instructions by design, and `src/art/athleteRig.ts`'s
  header records why carrying tremor as a number would re-import the rejected
  architecture.
- **Deadlift's lower-after-lockout is choreography, not mechanics.** The
  simulation owns no eccentric return after a made deadlift lockout — after
  `complete` with a made `outcome`, `barHeight` stays up. The controlled
  lower-to-floor the player expects to see is authored in the rig as a
  post-resolution transition keyed on `complete` + `outcome`, and is NEVER
  written back into gameplay state. (Deadlift art itself stays blocked until
  the squat proves the system; the rule is recorded now so it is not lost.)
- **No pose is a re-used mirror of another.** The descent is not the ascent
  played backwards; they have different torso angles and different intent.

## 11. Delivery — what the `.riv` must expose

The rig is driven by `src/art/athleteRig.ts`, the visual lane's binding to
the mechanics lane's frozen contract (`src/game/liftPresentation.ts`,
`src/game/LIFT-PRESENTATION.md`, PR #48 at `20bda71d`). **`rigInputPaths()`
in that module is the authoritative list** — derived from the record type, so
this table cannot drift from it without `athleteRig.test.ts` going red. The
ViewModel property paths, verbatim:

| Path | Type | Range / unit | Meaning |
| --- | --- | --- | --- |
| `lift` | enum | `squat` \| `bench` \| `deadlift` | Which skeleton. v1 authors `squat` only. |
| `phase` | enum | the six `LIFT_PHASES` | The mechanic's beat. **Not the driver** — see `barHeight`. |
| `barHeight` | number | `0..1` (may clip) | 0 hole/floor, 1 lockout. **THE driver.** Continuous through descent and ascent; the contract says pose from this, not from `phase`. |
| `barVelocity` | number | heights / second, signed | Actual Δheight per tick, scaled to seconds. `+` rising, `−` descending. `0` is rest ONLY when `motionSampleValid`. |
| `motionSampleValid` | boolean | — | False on an unpaired snapshot: then `barVelocity` is 0 for lack of a sample, not because the bar sat still. |
| `integratorVelocity` | number | heights / second | The ascent force integrator. 0 through squat/bench descent by design. Stall/grind feel reads this, not `barVelocity`. |
| `strain` | number | `0..1` | Load + phase + current deficit. Effort expression. Not a fatigue meter. |
| `grindIntensity` | number | `0..1` | 1 = stalled or being beaten on the way up. The game's title beat. |
| `effortBand` | enum | `easy` \| `normal` \| `hard` \| `grind` \| `failing` | A derived band the state machine may key on. Not an animation name. |
| `barTiltDeg` | number | degrees | Lifter's right side high is positive. |
| `barForwardPx` / `barLateralPx` / `barBendPx` | number | sprite px | The sim's bar-pose offsets. **Scale in the editor**; do not re-derive. |
| `commandGlow` | number | `0..1` | Cue prominence — full while held, peaks at the cue's ideal instant. A visual reading of the timing window. |
| `held` / `pressCommandLive` / `lockoutHoldLive` | boolean | — | Finger down; the bench command is live; the lockout hold is live. |
| `chalk` | number | `0..1` | Chalk intensity. Placement is the rig's. |
| `depthAchieved` / `lockedOut` / `complete` | boolean | — | Judged depth; reached lockout; `phase === RESOLVED`. |
| `outcome` | enum | `good-lift` \| `grind` \| `miss` \| `none` | Terminal state selector. `none` until resolved. |
| `missReason` | enum | `no-depth` \| `buried` \| `stalled` \| `timeout` \| `dropped` \| `none` | Why, on a miss. |
| `totalKg` | number | kg | What the HUD shows. The drawn bar must plausibly be this weight. |
| `plates/<i>/on` | boolean | `i` in `0..7` | Slot `i` on one sleeve is loaded. Inboard first. Mirror for the far sleeve. |
| `plates/<i>/size` | number | index into the §7 ladder | `0` = 25 kg red … `6` = 1.25 kg black (the `PLATE_SPECS` order). Meaningless when `on` is false. |
| `platesOverflow` | number | count | Discs the eight slots could not show. Non-zero is a finding to report, not a look. |
| `seed` | number | — | Deterministic, so authored variation is stable across replays. |

**`barHeight` alone poses the athlete through the rep; `phase` and
`effortBand` select states around it.** The contract is explicit that
animation is not keyed primarily from phase names where continuous state
exists — the descent and the ascent are the same `barHeight` curve read in
two directions, with `barVelocity`'s sign saying which. If the rig needs a
beat none of these carries, that is a request through the contract doc's §10
process — do not have the rig infer it from a timer, and do not have the
binding compute it.

**Plates are slots, not a number.** `load.discs` is a list; a ViewModel
scalar cannot hold one. Eight `{on, size}` pairs per sleeve
(`ATHLETE_RIG.PLATE_SLOTS_PER_SIDE` in `spriteTuning.ts`) cover the loading
range the game reaches; the binding fills them inboard-first and reports any
overflow rather than truncating silently.

**Naming, so the asset survives a second athlete:** `athlete-<name>.riv`, one
artboard per lift, state machine named for the lift. Paths exactly as above —
a renamed input is a silent no-op at runtime in both Rive runtimes, which is
the failure mode `rigInputPaths()` exists to prevent.

## 12. What counts as delivered

- The reference sheet (§4) — front, side, three-quarter, same scale, bar in
  frame.
- The rig (§9) driven by `stand` alone through a full rep, with feet planted
  and contact points held.
- All three outcomes authored (§8), success visibly different from grind.
- Scale checked against §7 at three loads: a light bar, a mid bar, a heavy bar.
- The silhouette test (§3) passed at the real on-screen size.
- `.riv` plus editor source plus reference sheet, all owned or licensed.

**None of these gates is closeable by an automated test.** Technical and
integration evidence can be produced from here; VISUAL, ANIMATION and
SOFT-FEEL cannot, and OWNER PLAYTEST is Bryant's alone.

## 13. What proceeds while this is blocked

Blocked work is the athlete. Not blocked, and either done or doable now:

- **The binding to the frozen contract** — `src/art/athleteRig.ts` and its
  tests, consuming `src/game/liftPresentation.ts` at `20bda71d`. Identical
  under every option in ADR-001, so it is not a bet. The unmounted production
  stage pair (`src/session/AthleteStage.native.tsx` / `.web.tsx`) sits on it.
- **The data request to Grok** — `docs/design/PRESENTATION-CONTRACT-REQUEST.md`.
- **This specification**, so the asset is authored against a target.
- **Equipment and room presentation**, which are not the athlete: plate
  drawing, bar, rack, floor, and the room plates that already exist.
- **UI / HUD / typography** on the training surface.
- The ADR §7 spike **design**, ready to run the moment a `.riv` — even a crude
  test one — exists.

Do not idle waiting on artwork, and do not fill the wait by building a fourth
athlete.
